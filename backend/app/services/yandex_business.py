"""
Yandex Business Integration Service.

Provides functionality for:
- Linking Yandex Business profiles to organizations
- Profile verification
- Review import from CSV exports
- Rating sync and badge display
"""
from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.yandex_business import (
    YandexBusinessProfileLink,
    YandexBusinessProfileResponse,
    YandexBusinessStatus,
    YandexReviewImportResult,
    YandexReviewImportRow,
)

logger = logging.getLogger(__name__)


def _extract_permalink(yandex_url: str) -> str:
    """Extract the numeric permalink ID from a Yandex Maps URL."""
    patterns = [
        r'yandex\.[a-z]+/maps/org/[^/]+/(\d+)',
        r'yandex\.[a-z]+/maps/-/[^/]+/(\d+)',
        r'maps\.yandex\.[a-z]+/org/[^/]+/(\d+)',
        r'/(\d{8,})/?',  # Fallback: any long number
    ]
    for pattern in patterns:
        match = re.search(pattern, yandex_url)
        if match:
            return match.group(1)
    raise ValueError("Could not extract permalink from URL")


def _generate_verification_code() -> str:
    """Generate a unique verification code."""
    return f"chestno-{secrets.token_hex(4)}"


def _hash_review_content(author: str, date_str: str, text: str) -> str:
    """Generate hash for review deduplication."""
    content = f"{author}|{date_str}|{text[:200]}"
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:32]


def get_yandex_profile(
    organization_id: str,
    user_id: str,
) -> YandexBusinessProfileResponse:
    """
    Get Yandex Business profile link for an organization.

    Args:
        organization_id: Organization UUID
        user_id: Current user ID (for access check)

    Returns:
        YandexBusinessProfileResponse
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify user has access to organization
        cur.execute(
            """
            SELECT 1 FROM organization_members
            WHERE organization_id = %s AND user_id = %s
            """,
            (organization_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Get link
        cur.execute(
            """
            SELECT * FROM yandex_business_links
            WHERE organization_id = %s
            """,
            (organization_id,)
        )
        row = cur.fetchone()

    if not row:
        return YandexBusinessProfileResponse(
            link=None,
            is_linked=False,
            can_display_badge=False,
        )

    link = YandexBusinessProfileLink(
        id=str(row["id"]),
        organization_id=str(row["organization_id"]),
        yandex_permalink=row["yandex_permalink"],
        yandex_url=row["yandex_url"],
        business_name=row["business_name"],
        business_address=row["business_address"],
        yandex_rating=float(row["yandex_rating"]) if row["yandex_rating"] else None,
        yandex_review_count=row["yandex_review_count"],
        status=YandexBusinessStatus(row["status"]),
        last_synced_at=row["last_synced_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )

    can_display = (
        link.status == YandexBusinessStatus.VERIFIED
        and link.yandex_rating is not None
    )

    return YandexBusinessProfileResponse(
        link=link,
        is_linked=True,
        can_display_badge=can_display,
    )


def link_yandex_profile(
    organization_id: str,
    yandex_url: str,
    user_id: str,
) -> YandexBusinessProfileLink:
    """
    Link a Yandex Business profile to an organization.

    Args:
        organization_id: Organization UUID
        yandex_url: Yandex Maps profile URL
        user_id: User performing the action

    Returns:
        Created YandexBusinessProfileLink
    """
    # Extract permalink
    try:
        permalink = _extract_permalink(yandex_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    verification_code = _generate_verification_code()

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Check user is admin/owner
        cur.execute(
            """
            SELECT role FROM organization_members
            WHERE organization_id = %s AND user_id = %s
            """,
            (organization_id, user_id)
        )
        member = cur.fetchone()
        if not member or member["role"] not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and admins can link Yandex profiles"
            )

        # Check if already linked
        cur.execute(
            "SELECT id FROM yandex_business_links WHERE organization_id = %s",
            (organization_id,)
        )
        existing = cur.fetchone()

        if existing:
            # Update existing link
            cur.execute(
                """
                UPDATE yandex_business_links
                SET yandex_permalink = %s,
                    yandex_url = %s,
                    verification_code = %s,
                    status = 'pending',
                    updated_at = now()
                WHERE organization_id = %s
                RETURNING *
                """,
                (permalink, yandex_url, verification_code, organization_id)
            )
        else:
            # Create new link
            cur.execute(
                """
                INSERT INTO yandex_business_links (
                    organization_id, yandex_permalink, yandex_url,
                    verification_code, status, created_by
                )
                VALUES (%s, %s, %s, %s, 'pending', %s)
                RETURNING *
                """,
                (organization_id, permalink, yandex_url, verification_code, user_id)
            )

        row = cur.fetchone()
        conn.commit()

    logger.info(f"Linked Yandex profile {permalink} to org {organization_id}")

    return YandexBusinessProfileLink(
        id=str(row["id"]),
        organization_id=str(row["organization_id"]),
        yandex_permalink=row["yandex_permalink"],
        yandex_url=row["yandex_url"],
        business_name=row["business_name"],
        business_address=row["business_address"],
        yandex_rating=float(row["yandex_rating"]) if row["yandex_rating"] else None,
        yandex_review_count=row["yandex_review_count"],
        status=YandexBusinessStatus(row["status"]),
        last_synced_at=row["last_synced_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def update_yandex_rating(
    organization_id: str,
    rating: float,
    review_count: int,
    user_id: str,
) -> YandexBusinessProfileLink:
    """
    Manually update Yandex rating for an organization.

    Used when users manually check their Yandex rating and update it.

    Args:
        organization_id: Organization UUID
        rating: Yandex rating (0.0 - 5.0)
        review_count: Number of reviews on Yandex
        user_id: User performing the update

    Returns:
        Updated YandexBusinessProfileLink
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify admin access
        cur.execute(
            """
            SELECT role FROM organization_members
            WHERE organization_id = %s AND user_id = %s
            """,
            (organization_id, user_id)
        )
        member = cur.fetchone()
        if not member or member["role"] not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Update rating
        cur.execute(
            """
            UPDATE yandex_business_links
            SET yandex_rating = %s,
                yandex_review_count = %s,
                last_synced_at = now(),
                updated_at = now()
            WHERE organization_id = %s
            RETURNING *
            """,
            (rating, review_count, organization_id)
        )
        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Yandex profile not linked"
            )

        conn.commit()

    return YandexBusinessProfileLink(
        id=str(row["id"]),
        organization_id=str(row["organization_id"]),
        yandex_permalink=row["yandex_permalink"],
        yandex_url=row["yandex_url"],
        business_name=row["business_name"],
        business_address=row["business_address"],
        yandex_rating=float(row["yandex_rating"]) if row["yandex_rating"] else None,
        yandex_review_count=row["yandex_review_count"],
        status=YandexBusinessStatus(row["status"]),
        last_synced_at=row["last_synced_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def verify_yandex_profile(
    organization_id: str,
    admin_user_id: str,
) -> YandexBusinessProfileLink:
    """
    [Admin] Verify a Yandex Business profile link.

    Called after admin confirms the verification code is present
    in the Yandex Business profile.

    Args:
        organization_id: Organization UUID
        admin_user_id: Admin user performing verification

    Returns:
        Updated YandexBusinessProfileLink with verified status
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE yandex_business_links
            SET status = 'verified',
                verified_at = now(),
                verified_by = %s,
                updated_at = now()
            WHERE organization_id = %s
            RETURNING *
            """,
            (admin_user_id, organization_id)
        )
        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Yandex profile not found"
            )

        conn.commit()

    logger.info(f"Verified Yandex profile for org {organization_id}")

    return YandexBusinessProfileLink(
        id=str(row["id"]),
        organization_id=str(row["organization_id"]),
        yandex_permalink=row["yandex_permalink"],
        yandex_url=row["yandex_url"],
        business_name=row["business_name"],
        business_address=row["business_address"],
        yandex_rating=float(row["yandex_rating"]) if row["yandex_rating"] else None,
        yandex_review_count=row["yandex_review_count"],
        status=YandexBusinessStatus(row["status"]),
        last_synced_at=row["last_synced_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def import_yandex_reviews(
    organization_id: str,
    reviews: list[YandexReviewImportRow],
    user_id: str,
) -> YandexReviewImportResult:
    """
    Import reviews from Yandex Business CSV export.

    Users can export their reviews from Yandex Business dashboard
    and import them here for unified management.

    Args:
        organization_id: Organization UUID
        reviews: List of review rows from CSV
        user_id: User performing import

    Returns:
        Import result with counts
    """
    imported = 0
    skipped_duplicates = 0
    skipped_errors = 0
    errors: list[str] = []

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify access and get link ID
        cur.execute(
            """
            SELECT ybl.id as link_id, om.role
            FROM yandex_business_links ybl
            JOIN organization_members om ON om.organization_id = ybl.organization_id
            WHERE ybl.organization_id = %s AND om.user_id = %s
            """,
            (organization_id, user_id)
        )
        result = cur.fetchone()

        if not result:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied or Yandex profile not linked"
            )

        if result["role"] not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and admins can import reviews"
            )

        link_id = result["link_id"]

        for i, review in enumerate(reviews):
            try:
                # Parse date
                review_date = _parse_review_date(review.date)

                # Generate hash for deduplication
                content_hash = _hash_review_content(
                    review.author_name,
                    review.date,
                    review.text
                )

                # Try to insert
                cur.execute(
                    """
                    INSERT INTO yandex_imported_reviews (
                        organization_id, yandex_link_id, author_name,
                        rating, review_text, review_date,
                        response_text, response_date, content_hash, imported_by
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (organization_id, content_hash) DO NOTHING
                    RETURNING id
                    """,
                    (
                        organization_id, link_id, review.author_name,
                        review.rating, review.text, review_date,
                        review.response_text,
                        _parse_review_date(review.response_date) if review.response_date else None,
                        content_hash, user_id
                    )
                )

                if cur.fetchone():
                    imported += 1
                else:
                    skipped_duplicates += 1

            except Exception as e:
                skipped_errors += 1
                errors.append(f"Row {i + 1}: {str(e)}")
                if len(errors) >= 10:
                    errors.append("... (остальные ошибки скрыты)")
                    break

        # Update last import timestamp
        cur.execute(
            """
            UPDATE yandex_business_links
            SET last_import_at = now(), updated_at = now()
            WHERE id = %s
            """,
            (link_id,)
        )

        conn.commit()

    logger.info(
        f"Imported {imported} Yandex reviews for org {organization_id}, "
        f"skipped {skipped_duplicates} duplicates, {skipped_errors} errors"
    )

    return YandexReviewImportResult(
        total_submitted=len(reviews),
        imported=imported,
        skipped_duplicates=skipped_duplicates,
        skipped_errors=skipped_errors,
        errors=errors[:10],
    )


def _parse_review_date(date_str: str) -> datetime:
    """Parse date string from Yandex export."""
    # Try common formats
    formats = [
        "%Y-%m-%d",
        "%d.%m.%Y",
        "%d/%m/%Y",
        "%Y-%m-%dT%H:%M:%S",
        "%d.%m.%Y %H:%M",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    raise ValueError(f"Could not parse date: {date_str}")


def get_imported_reviews(
    organization_id: str,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    Get imported Yandex reviews for an organization.

    Args:
        organization_id: Organization UUID
        user_id: User requesting the data
        limit: Max results per page
        offset: Pagination offset

    Returns:
        Tuple of (reviews list, total count)
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify access
        cur.execute(
            """
            SELECT 1 FROM organization_members
            WHERE organization_id = %s AND user_id = %s
            """,
            (organization_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Get total count
        cur.execute(
            "SELECT COUNT(*) as count FROM yandex_imported_reviews WHERE organization_id = %s",
            (organization_id,)
        )
        total = cur.fetchone()["count"]

        # Get reviews
        cur.execute(
            """
            SELECT * FROM yandex_imported_reviews
            WHERE organization_id = %s
            ORDER BY review_date DESC
            LIMIT %s OFFSET %s
            """,
            (organization_id, limit, offset)
        )
        reviews = [dict(r) for r in cur.fetchall()]

    return reviews, total


def unlink_yandex_profile(
    organization_id: str,
    user_id: str,
) -> bool:
    """
    Remove Yandex Business profile link from organization.

    Args:
        organization_id: Organization UUID
        user_id: User performing the action

    Returns:
        True if unlinked successfully
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify owner access
        cur.execute(
            """
            SELECT role FROM organization_members
            WHERE organization_id = %s AND user_id = %s
            """,
            (organization_id, user_id)
        )
        member = cur.fetchone()
        if not member or member["role"] != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can unlink Yandex profiles"
            )

        # Delete link (cascade will delete imported reviews)
        cur.execute(
            "DELETE FROM yandex_business_links WHERE organization_id = %s RETURNING id",
            (organization_id,)
        )
        deleted = cur.fetchone()
        conn.commit()

    if deleted:
        logger.info(f"Unlinked Yandex profile from org {organization_id}")
        return True

    return False
