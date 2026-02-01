"""
Service layer for social sharing functionality.
"""
from __future__ import annotations

import hashlib
from typing import Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.core.config import get_settings
from app.schemas.social_sharing import (
    ShareCardData,
    ShareEvent,
    ShareEventCreate,
    ShareStats,
    ShareTargetType,
)


settings = get_settings()


def log_share_event(
    payload: ShareEventCreate,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None
) -> ShareEvent:
    """Log a share event."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Validate target exists
        target_table = _get_target_table(payload.target_type)
        cur.execute(f'SELECT id FROM {target_table} WHERE id = %s', (payload.target_id,))
        if not cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'{payload.target_type.value.capitalize()} not found'
            )

        # Map platform to db values
        platform_map = {
            'telegram': 'telegram',
            'whatsapp': 'whatsapp',
            'vk': 'vk',
            'twitter': 'twitter',
            'facebook': 'facebook',
            'copy_link': 'copy_link',
            'qr_code': 'qr_scan',
            'other': 'other',
        }
        db_platform = platform_map.get(payload.platform.value, 'other')

        cur.execute(
            '''
            INSERT INTO share_events (
                id, user_id, shared_type, shared_id, platform,
                share_url, ip_address, user_agent
            )
            VALUES (gen_random_uuid(), %s, %s, %s::uuid, %s, %s, %s, %s)
            RETURNING *
            ''',
            (
                user_id,
                payload.target_type.value,
                payload.target_id,
                db_platform,
                payload.referrer_url,
                ip_address,
                payload.user_agent,
            )
        )
        row = cur.fetchone()
        conn.commit()

        # Hash IP for response (privacy)
        ip_hash = None
        if ip_address:
            ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()[:16]

        return ShareEvent(
            id=str(row['id']),
            user_id=str(row['user_id']) if row['user_id'] else None,
            target_type=row['shared_type'],
            target_id=str(row['shared_id']),
            platform=row['platform'],
            referrer_url=row['share_url'],
            ip_hash=ip_hash,
            created_at=row['created_at'],
        )


def get_share_card_data(target_type: ShareTargetType, target_id: str) -> ShareCardData:
    """Generate share card data for an entity."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        base_url = settings.frontend_url.rstrip('/')

        if target_type == ShareTargetType.product:
            cur.execute(
                '''
                SELECT
                    p.id, p.name, p.short_description, p.main_image_url, p.slug,
                    o.name as organization_name, o.logo_url as organization_logo_url,
                    (SELECT COUNT(*) FROM consumer_subscriptions WHERE target_type = 'product' AND target_id = p.id AND is_active = true) as followers_count,
                    (SELECT COUNT(*) FROM share_events WHERE shared_type = 'product' AND shared_id = p.id) as shares_count
                FROM products p
                JOIN organizations o ON o.id = p.organization_id
                WHERE p.id = %s AND p.status = 'published'
                ''',
                (target_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='Product not found'
                )

            return ShareCardData(
                title=row['name'],
                description=row['short_description'],
                image_url=row['main_image_url'],
                canonical_url=f"{base_url}/product/{row['slug']}",
                og_type='product',
                target_type=target_type,
                target_id=target_id,
                followers_count=row['followers_count'],
                shares_count=row['shares_count'],
                organization_name=row['organization_name'],
                organization_logo_url=row['organization_logo_url'],
            )

        elif target_type == ShareTargetType.organization:
            cur.execute(
                '''
                SELECT
                    o.id, o.name, o.description, o.logo_url, o.slug,
                    (SELECT COUNT(*) FROM consumer_subscriptions WHERE target_type = 'organization' AND target_id = o.id AND is_active = true) as followers_count,
                    (SELECT COUNT(*) FROM share_events WHERE shared_type = 'organization' AND shared_id = o.id) as shares_count
                FROM organizations o
                WHERE o.id = %s
                ''',
                (target_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='Organization not found'
                )

            return ShareCardData(
                title=row['name'],
                description=row['description'],
                image_url=row['logo_url'],
                canonical_url=f"{base_url}/org/{row['slug']}",
                og_type='business.business',
                target_type=target_type,
                target_id=target_id,
                followers_count=row['followers_count'],
                shares_count=row['shares_count'],
                organization_name=row['name'],
                organization_logo_url=row['logo_url'],
            )

        elif target_type == ShareTargetType.post:
            cur.execute(
                '''
                SELECT
                    p.id, p.title, p.excerpt, p.cover_image_url, p.slug,
                    o.name as organization_name, o.logo_url as organization_logo_url, o.slug as org_slug,
                    (SELECT COUNT(*) FROM share_events WHERE shared_type = 'post' AND shared_id = p.id) as shares_count
                FROM posts p
                JOIN organizations o ON o.id = p.organization_id
                WHERE p.id = %s AND p.status = 'published'
                ''',
                (target_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='Post not found'
                )

            return ShareCardData(
                title=row['title'],
                description=row['excerpt'],
                image_url=row['cover_image_url'],
                canonical_url=f"{base_url}/org/{row['org_slug']}/posts/{row['slug']}",
                og_type='article',
                target_type=target_type,
                target_id=target_id,
                shares_count=row['shares_count'],
                organization_name=row['organization_name'],
                organization_logo_url=row['organization_logo_url'],
            )

        elif target_type == ShareTargetType.review:
            cur.execute(
                '''
                SELECT
                    r.id, r.content, r.rating,
                    o.name as organization_name, o.logo_url as organization_logo_url, o.slug as org_slug,
                    (SELECT COUNT(*) FROM share_events WHERE shared_type = 'review' AND shared_id = r.id) as shares_count
                FROM reviews r
                JOIN organizations o ON o.id = r.organization_id
                WHERE r.id = %s AND r.status = 'published'
                ''',
                (target_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='Review not found'
                )

            title = f"Review: {row['rating']}/5 stars for {row['organization_name']}"
            description = row['content'][:200] + '...' if len(row['content'] or '') > 200 else row['content']

            return ShareCardData(
                title=title,
                description=description,
                image_url=row['organization_logo_url'],
                canonical_url=f"{base_url}/org/{row['org_slug']}/reviews/{row['id']}",
                og_type='article',
                target_type=target_type,
                target_id=target_id,
                shares_count=row['shares_count'],
                organization_name=row['organization_name'],
                organization_logo_url=row['organization_logo_url'],
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid target type'
        )


def get_share_stats(target_type: ShareTargetType, target_id: str) -> ShareStats:
    """Get sharing statistics for an entity."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get total and last shared
        cur.execute(
            '''
            SELECT
                COUNT(*) as total_shares,
                MAX(created_at) as last_shared_at
            FROM share_events
            WHERE shared_type = %s AND shared_id = %s::uuid
            ''',
            (target_type.value, target_id)
        )
        totals = cur.fetchone()

        # Get breakdown by platform
        cur.execute(
            '''
            SELECT platform, COUNT(*) as count
            FROM share_events
            WHERE shared_type = %s AND shared_id = %s::uuid
            GROUP BY platform
            ''',
            (target_type.value, target_id)
        )
        platform_rows = cur.fetchall()
        by_platform = {row['platform']: row['count'] for row in platform_rows}

        return ShareStats(
            target_type=target_type,
            target_id=target_id,
            total_shares=totals['total_shares'] or 0,
            shares_by_platform=by_platform,
            last_shared_at=totals['last_shared_at'],
        )


def _get_target_table(target_type: ShareTargetType) -> str:
    """Map target type to table name."""
    mapping = {
        ShareTargetType.product: 'products',
        ShareTargetType.organization: 'organizations',
        ShareTargetType.post: 'posts',
        ShareTargetType.review: 'reviews',
    }
    return mapping[target_type]
