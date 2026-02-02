"""
Warranty Management Service

Comprehensive service for digital warranty registration, tracking, and claims.

Core Features:
- Register warranty via QR scan or manual entry
- Track warranty validity and expiration
- Submit and manage warranty claims
- Organization claim management
- Warranty statistics and analytics

Database tables:
- warranty_policies: Warranty policies per organization/category
- warranty_registrations: User warranty registrations
- warranty_claims: Claim submissions and resolutions
- warranty_claim_history: Audit trail for claim changes
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection

logger = logging.getLogger(__name__)


# ============================================================
# WARRANTY POLICY MANAGEMENT
# ============================================================

def get_warranty_policy(
    organization_id: str,
    product_category: str
) -> Optional[dict]:
    """
    Get active warranty policy for organization and category.

    Args:
        organization_id: Organization UUID
        product_category: Product category string

    Returns:
        Policy dict or None if not found
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    id::text,
                    organization_id::text,
                    product_category,
                    duration_months,
                    coverage_description,
                    terms,
                    is_transferable,
                    requires_registration,
                    registration_deadline_days,
                    is_active,
                    metadata,
                    created_at,
                    updated_at
                FROM public.warranty_policies
                WHERE organization_id = %s
                  AND product_category = %s
                  AND is_active = true
                ''',
                (organization_id, product_category)
            )
            row = cur.fetchone()
            return dict(row) if row else None

    except Exception as e:
        logger.error(f"[warranty] Error getting policy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving warranty policy: {str(e)}"
        )


def create_warranty_policy(
    organization_id: str,
    product_category: str,
    duration_months: int,
    coverage_description: str,
    terms: Optional[str] = None,
    is_transferable: bool = False,
    requires_registration: bool = True,
    registration_deadline_days: Optional[int] = None
) -> dict:
    """
    Create a new warranty policy for an organization.

    Args:
        organization_id: Organization UUID
        product_category: Category name
        duration_months: Warranty duration in months
        coverage_description: What the warranty covers
        terms: Full terms and conditions
        is_transferable: Can warranty be transferred
        requires_registration: Must user register
        registration_deadline_days: Days to register after purchase

    Returns:
        Created policy dict
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                INSERT INTO public.warranty_policies (
                    organization_id,
                    product_category,
                    duration_months,
                    coverage_description,
                    terms,
                    is_transferable,
                    requires_registration,
                    registration_deadline_days
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                    id::text,
                    organization_id::text,
                    product_category,
                    duration_months,
                    coverage_description,
                    terms,
                    is_transferable,
                    requires_registration,
                    registration_deadline_days,
                    is_active,
                    metadata,
                    created_at,
                    updated_at
                ''',
                (
                    organization_id,
                    product_category,
                    duration_months,
                    coverage_description,
                    terms,
                    is_transferable,
                    requires_registration,
                    registration_deadline_days
                )
            )
            row = cur.fetchone()
            conn.commit()

            logger.info(f"[warranty] Created policy for org {organization_id}, category {product_category}")
            return dict(row)

    except Exception as e:
        if 'idx_unique_active_policy_per_category' in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Active policy already exists for this category"
            )
        logger.error(f"[warranty] Error creating policy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating warranty policy: {str(e)}"
        )


def list_organization_policies(
    organization_id: str,
    include_inactive: bool = False
) -> list[dict]:
    """
    List all warranty policies for an organization.

    Args:
        organization_id: Organization UUID
        include_inactive: Include deactivated policies

    Returns:
        List of policy dicts
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            query = '''
                SELECT
                    id::text,
                    organization_id::text,
                    product_category,
                    duration_months,
                    coverage_description,
                    terms,
                    is_transferable,
                    requires_registration,
                    registration_deadline_days,
                    is_active,
                    metadata,
                    created_at,
                    updated_at
                FROM public.warranty_policies
                WHERE organization_id = %s
            '''
            if not include_inactive:
                query += ' AND is_active = true'
            query += ' ORDER BY product_category'

            cur.execute(query, (organization_id,))
            rows = cur.fetchall()
            return [dict(row) for row in rows]

    except Exception as e:
        logger.error(f"[warranty] Error listing policies: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing warranty policies: {str(e)}"
        )


# ============================================================
# WARRANTY REGISTRATION
# ============================================================

def register_warranty(
    user_id: str,
    product_id: str,
    purchase_date: date,
    qr_code_id: Optional[str] = None,
    serial_number: Optional[str] = None,
    purchase_location: Optional[str] = None,
    purchase_proof_url: Optional[str] = None,
    contact_email: Optional[str] = None,
    contact_phone: Optional[str] = None
) -> dict:
    """
    Register a warranty for a product.

    Automatically calculates warranty period based on organization policy
    or defaults to 12 months if no policy exists.

    Args:
        user_id: User UUID
        product_id: Product UUID
        purchase_date: Date of purchase
        qr_code_id: Optional QR code used for registration
        serial_number: Optional product serial number
        purchase_location: Where purchased
        purchase_proof_url: Receipt/invoice URL
        contact_email: Contact email for claims
        contact_phone: Contact phone for claims

    Returns:
        Created registration dict

    Raises:
        HTTPException: If product not found or already registered
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get product and organization info
            cur.execute(
                '''
                SELECT
                    p.id,
                    p.organization_id,
                    p.category,
                    p.name as product_name,
                    o.name as organization_name
                FROM public.products p
                JOIN public.organizations o ON o.id = p.organization_id
                WHERE p.id = %s
                ''',
                (product_id,)
            )
            product = cur.fetchone()

            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Product not found"
                )

            # Check for existing active registration
            cur.execute(
                '''
                SELECT id FROM public.warranty_registrations
                WHERE product_id = %s AND user_id = %s
                  AND status IN ('pending', 'active')
                ''',
                (product_id, user_id)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Warranty already registered for this product"
                )

            # Get warranty policy for product category
            policy_id = None
            duration_months = 12  # Default

            if product['category']:
                cur.execute(
                    '''
                    SELECT id, duration_months, registration_deadline_days
                    FROM public.warranty_policies
                    WHERE organization_id = %s
                      AND product_category = %s
                      AND is_active = true
                    ''',
                    (product['organization_id'], product['category'])
                )
                policy = cur.fetchone()
                if policy:
                    policy_id = policy['id']
                    duration_months = policy['duration_months']

                    # Check registration deadline
                    if policy['registration_deadline_days']:
                        deadline = purchase_date + timedelta(days=policy['registration_deadline_days'])
                        if date.today() > deadline:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Registration deadline passed. Must register within {policy['registration_deadline_days']} days of purchase."
                            )

            # Calculate warranty period
            warranty_start = purchase_date
            # Add months (approximate - 30 days per month)
            warranty_end = purchase_date + timedelta(days=duration_months * 30)

            # Create registration
            cur.execute(
                '''
                INSERT INTO public.warranty_registrations (
                    product_id,
                    user_id,
                    qr_code_id,
                    policy_id,
                    serial_number,
                    purchase_date,
                    purchase_location,
                    purchase_proof_url,
                    warranty_start,
                    warranty_end,
                    status,
                    contact_email,
                    contact_phone
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s)
                RETURNING
                    id::text,
                    product_id::text,
                    user_id::text,
                    qr_code_id::text,
                    policy_id::text,
                    serial_number,
                    purchase_date,
                    purchase_location,
                    purchase_proof_url,
                    warranty_start,
                    warranty_end,
                    status,
                    contact_email,
                    contact_phone,
                    registered_at,
                    metadata,
                    created_at,
                    updated_at
                ''',
                (
                    product_id,
                    user_id,
                    qr_code_id,
                    policy_id,
                    serial_number,
                    purchase_date,
                    purchase_location,
                    purchase_proof_url,
                    warranty_start,
                    warranty_end,
                    contact_email,
                    contact_phone
                )
            )
            row = cur.fetchone()
            conn.commit()

            result = dict(row)
            result['product_name'] = product['product_name']
            result['organization_name'] = product['organization_name']
            result['organization_id'] = str(product['organization_id'])
            result['days_remaining'] = (warranty_end - date.today()).days
            result['is_valid'] = True

            logger.info(f"[warranty] Registered warranty {result['id']} for user {user_id}, product {product_id}")
            return result

    except HTTPException:
        raise
    except Exception as e:
        if 'idx_unique_warranty_per_product_user' in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Warranty already registered for this product"
            )
        logger.error(f"[warranty] Error registering warranty: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error registering warranty: {str(e)}"
        )


def get_user_warranties(
    user_id: str,
    status_filter: Optional[str] = None,
    page: int = 1,
    per_page: int = 20
) -> tuple[list[dict], int]:
    """
    Get all warranties for a user.

    Args:
        user_id: User UUID
        status_filter: Optional filter by status
        page: Page number (1-indexed)
        per_page: Items per page

    Returns:
        Tuple of (warranties list, total count)
    """
    try:
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build query
            where_clause = "WHERE wr.user_id = %s"
            params = [user_id]

            if status_filter:
                where_clause += " AND wr.status = %s"
                params.append(status_filter)

            # Get total count
            cur.execute(
                f'''
                SELECT COUNT(*) as total
                FROM public.warranty_registrations wr
                {where_clause}
                ''',
                params
            )
            total = cur.fetchone()['total']

            # Get warranties with product info
            cur.execute(
                f'''
                SELECT
                    wr.id::text,
                    wr.product_id::text,
                    wr.user_id::text,
                    wr.qr_code_id::text,
                    wr.policy_id::text,
                    wr.serial_number,
                    wr.purchase_date,
                    wr.purchase_location,
                    wr.purchase_proof_url,
                    wr.warranty_start,
                    wr.warranty_end,
                    wr.status,
                    wr.contact_email,
                    wr.contact_phone,
                    wr.registered_at,
                    wr.metadata,
                    wr.created_at,
                    wr.updated_at,
                    p.name as product_name,
                    p.main_image_url as product_image_url,
                    o.name as organization_name,
                    o.id::text as organization_id
                FROM public.warranty_registrations wr
                JOIN public.products p ON p.id = wr.product_id
                JOIN public.organizations o ON o.id = p.organization_id
                {where_clause}
                ORDER BY wr.registered_at DESC
                LIMIT %s OFFSET %s
                ''',
                params + [per_page, offset]
            )
            rows = cur.fetchall()

            warranties = []
            today = date.today()
            for row in rows:
                w = dict(row)
                w['days_remaining'] = max(0, (row['warranty_end'] - today).days)
                w['is_valid'] = row['status'] == 'active' and row['warranty_end'] >= today
                warranties.append(w)

            return warranties, total

    except Exception as e:
        logger.error(f"[warranty] Error getting user warranties: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving warranties: {str(e)}"
        )


def get_warranty_details(
    registration_id: str,
    user_id: Optional[str] = None
) -> dict:
    """
    Get full warranty details.

    Args:
        registration_id: Registration UUID
        user_id: Optional user ID for ownership check

    Returns:
        Warranty details dict

    Raises:
        HTTPException: If not found or not authorized
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    wr.id::text,
                    wr.product_id::text,
                    wr.user_id::text,
                    wr.qr_code_id::text,
                    wr.policy_id::text,
                    wr.serial_number,
                    wr.purchase_date,
                    wr.purchase_location,
                    wr.purchase_proof_url,
                    wr.warranty_start,
                    wr.warranty_end,
                    wr.status,
                    wr.contact_email,
                    wr.contact_phone,
                    wr.registered_at,
                    wr.metadata,
                    wr.created_at,
                    wr.updated_at,
                    p.name as product_name,
                    p.main_image_url as product_image_url,
                    p.category as product_category,
                    o.name as organization_name,
                    o.id::text as organization_id,
                    wp.coverage_description,
                    wp.terms as warranty_terms
                FROM public.warranty_registrations wr
                JOIN public.products p ON p.id = wr.product_id
                JOIN public.organizations o ON o.id = p.organization_id
                LEFT JOIN public.warranty_policies wp ON wp.id = wr.policy_id
                WHERE wr.id = %s
                ''',
                (registration_id,)
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Warranty registration not found"
                )

            # Check ownership if user_id provided
            if user_id and row['user_id'] != user_id:
                # Check if user is org member
                cur.execute(
                    '''
                    SELECT 1 FROM public.organization_members
                    WHERE organization_id = %s AND user_id = %s
                    ''',
                    (row['organization_id'], user_id)
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view this warranty"
                    )

            result = dict(row)
            today = date.today()
            result['days_remaining'] = max(0, (row['warranty_end'] - today).days)
            result['is_valid'] = row['status'] == 'active' and row['warranty_end'] >= today

            return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[warranty] Error getting warranty details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving warranty details: {str(e)}"
        )


def check_warranty_validity(registration_id: str) -> dict:
    """
    Check if a warranty is currently valid.

    Args:
        registration_id: Registration UUID

    Returns:
        Validity check result dict
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    id::text,
                    status,
                    warranty_end,
                    public.is_warranty_valid(%s) as is_valid,
                    public.get_warranty_days_remaining(%s) as days_remaining
                FROM public.warranty_registrations
                WHERE id = %s
                ''',
                (registration_id, registration_id, registration_id)
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Warranty registration not found"
                )

            is_valid = row['is_valid']
            days_remaining = row['days_remaining']

            if is_valid:
                message = f"Warranty is valid. {days_remaining} days remaining."
            elif row['status'] == 'expired':
                message = "Warranty has expired."
            elif row['status'] == 'voided':
                message = "Warranty has been voided."
            elif row['status'] == 'transferred':
                message = "Warranty has been transferred."
            else:
                message = "Warranty is not active."

            return {
                'registration_id': row['id'],
                'is_valid': is_valid,
                'status': row['status'],
                'warranty_end': row['warranty_end'],
                'days_remaining': days_remaining,
                'message': message
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[warranty] Error checking warranty validity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking warranty validity: {str(e)}"
        )


# ============================================================
# WARRANTY CLAIMS
# ============================================================

def submit_claim(
    registration_id: str,
    user_id: str,
    claim_type: Literal['repair', 'replacement', 'refund', 'inspection', 'other'],
    description: str,
    photos: Optional[list[str]] = None
) -> dict:
    """
    Submit a warranty claim.

    Args:
        registration_id: Warranty registration UUID
        user_id: User UUID (must own the registration)
        claim_type: Type of claim
        description: Description of the issue
        photos: Optional list of photo URLs

    Returns:
        Created claim dict

    Raises:
        HTTPException: If warranty invalid or not owned
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Verify ownership and validity
            cur.execute(
                '''
                SELECT
                    wr.id,
                    wr.user_id,
                    wr.status,
                    wr.warranty_end,
                    p.name as product_name,
                    p.id as product_id
                FROM public.warranty_registrations wr
                JOIN public.products p ON p.id = wr.product_id
                WHERE wr.id = %s
                ''',
                (registration_id,)
            )
            registration = cur.fetchone()

            if not registration:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Warranty registration not found"
                )

            if str(registration['user_id']) != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to submit claim for this warranty"
                )

            if registration['status'] != 'active':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot submit claim: warranty status is '{registration['status']}'"
                )

            if registration['warranty_end'] < date.today():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot submit claim: warranty has expired"
                )

            # Create claim
            cur.execute(
                '''
                INSERT INTO public.warranty_claims (
                    registration_id,
                    claim_type,
                    description,
                    photos
                )
                VALUES (%s, %s, %s, %s)
                RETURNING
                    id::text,
                    registration_id::text,
                    claim_type,
                    description,
                    photos,
                    status,
                    priority,
                    assigned_to::text,
                    resolution_notes,
                    resolution_type,
                    created_at,
                    updated_at,
                    resolved_at,
                    metadata
                ''',
                (registration_id, claim_type, description, photos)
            )
            row = cur.fetchone()
            conn.commit()

            result = dict(row)
            result['product_name'] = registration['product_name']
            result['product_id'] = str(registration['product_id'])
            result['warranty_end'] = registration['warranty_end']

            logger.info(f"[warranty] Submitted claim {result['id']} for registration {registration_id}")
            return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[warranty] Error submitting claim: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error submitting warranty claim: {str(e)}"
        )


def get_user_claims(
    user_id: str,
    status_filter: Optional[str] = None,
    page: int = 1,
    per_page: int = 20
) -> tuple[list[dict], int]:
    """
    Get all warranty claims for a user.

    Args:
        user_id: User UUID
        status_filter: Optional filter by claim status
        page: Page number
        per_page: Items per page

    Returns:
        Tuple of (claims list, total count)
    """
    try:
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            where_clause = "WHERE wr.user_id = %s"
            params = [user_id]

            if status_filter:
                where_clause += " AND wc.status = %s"
                params.append(status_filter)

            # Get total
            cur.execute(
                f'''
                SELECT COUNT(*) as total
                FROM public.warranty_claims wc
                JOIN public.warranty_registrations wr ON wr.id = wc.registration_id
                {where_clause}
                ''',
                params
            )
            total = cur.fetchone()['total']

            # Get claims
            cur.execute(
                f'''
                SELECT
                    wc.id::text,
                    wc.registration_id::text,
                    wc.claim_type,
                    wc.description,
                    wc.photos,
                    wc.status,
                    wc.priority,
                    wc.assigned_to::text,
                    wc.resolution_notes,
                    wc.resolution_type,
                    wc.created_at,
                    wc.updated_at,
                    wc.resolved_at,
                    wc.metadata,
                    p.name as product_name,
                    p.id::text as product_id,
                    wr.warranty_end
                FROM public.warranty_claims wc
                JOIN public.warranty_registrations wr ON wr.id = wc.registration_id
                JOIN public.products p ON p.id = wr.product_id
                {where_clause}
                ORDER BY wc.created_at DESC
                LIMIT %s OFFSET %s
                ''',
                params + [per_page, offset]
            )
            rows = cur.fetchall()

            return [dict(row) for row in rows], total

    except Exception as e:
        logger.error(f"[warranty] Error getting user claims: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving claims: {str(e)}"
        )


def get_organization_claims(
    organization_id: str,
    status_filter: Optional[str] = None,
    page: int = 1,
    per_page: int = 20
) -> tuple[list[dict], int]:
    """
    Get all warranty claims for an organization's products.

    Args:
        organization_id: Organization UUID
        status_filter: Optional filter by claim status
        page: Page number
        per_page: Items per page

    Returns:
        Tuple of (claims list, total count)
    """
    try:
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            where_clause = "WHERE p.organization_id = %s"
            params = [organization_id]

            if status_filter:
                where_clause += " AND wc.status = %s"
                params.append(status_filter)

            # Get total
            cur.execute(
                f'''
                SELECT COUNT(*) as total
                FROM public.warranty_claims wc
                JOIN public.warranty_registrations wr ON wr.id = wc.registration_id
                JOIN public.products p ON p.id = wr.product_id
                {where_clause}
                ''',
                params
            )
            total = cur.fetchone()['total']

            # Get claims with customer info
            cur.execute(
                f'''
                SELECT
                    wc.id::text,
                    wc.registration_id::text,
                    wc.claim_type,
                    wc.description,
                    wc.photos,
                    wc.status,
                    wc.priority,
                    wc.assigned_to::text,
                    wc.resolution_notes,
                    wc.resolution_type,
                    wc.created_at,
                    wc.updated_at,
                    wc.resolved_at,
                    wc.metadata,
                    p.name as product_name,
                    p.id::text as product_id,
                    wr.warranty_end,
                    wr.contact_email as customer_email,
                    au.display_name as customer_name
                FROM public.warranty_claims wc
                JOIN public.warranty_registrations wr ON wr.id = wc.registration_id
                JOIN public.products p ON p.id = wr.product_id
                JOIN public.app_users au ON au.id = wr.user_id
                {where_clause}
                ORDER BY
                    CASE wc.priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'normal' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    wc.created_at DESC
                LIMIT %s OFFSET %s
                ''',
                params + [per_page, offset]
            )
            rows = cur.fetchall()

            return [dict(row) for row in rows], total

    except Exception as e:
        logger.error(f"[warranty] Error getting organization claims: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving organization claims: {str(e)}"
        )


def update_claim_status(
    claim_id: str,
    updated_by: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
    resolution_notes: Optional[str] = None,
    resolution_type: Optional[str] = None
) -> dict:
    """
    Update a warranty claim (business side).

    Args:
        claim_id: Claim UUID
        updated_by: User UUID making the update
        status: New status
        priority: New priority
        assigned_to: Staff user to assign
        resolution_notes: Notes about resolution
        resolution_type: Type of resolution

    Returns:
        Updated claim dict
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build update query
            updates = []
            params = []

            if status:
                updates.append("status = %s")
                params.append(status)
            if priority:
                updates.append("priority = %s")
                params.append(priority)
            if assigned_to is not None:
                updates.append("assigned_to = %s")
                params.append(assigned_to if assigned_to else None)
            if resolution_notes:
                updates.append("resolution_notes = %s")
                params.append(resolution_notes)
            if resolution_type:
                updates.append("resolution_type = %s")
                params.append(resolution_type)

            if not updates:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No updates provided"
                )

            updates.append("updated_at = now()")
            params.append(claim_id)

            cur.execute(
                f'''
                UPDATE public.warranty_claims
                SET {', '.join(updates)}
                WHERE id = %s
                RETURNING
                    id::text,
                    registration_id::text,
                    claim_type,
                    description,
                    photos,
                    status,
                    priority,
                    assigned_to::text,
                    resolution_notes,
                    resolution_type,
                    created_at,
                    updated_at,
                    resolved_at,
                    metadata
                ''',
                params
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Claim not found"
                )

            conn.commit()

            logger.info(f"[warranty] Updated claim {claim_id} by user {updated_by}")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[warranty] Error updating claim: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating claim: {str(e)}"
        )


def get_claim_history(claim_id: str) -> list[dict]:
    """
    Get status change history for a claim.

    Args:
        claim_id: Claim UUID

    Returns:
        List of history entries
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    id::text,
                    claim_id::text,
                    performed_by::text,
                    old_status,
                    new_status,
                    comment,
                    metadata,
                    created_at
                FROM public.warranty_claim_history
                WHERE claim_id = %s
                ORDER BY created_at DESC
                ''',
                (claim_id,)
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows]

    except Exception as e:
        logger.error(f"[warranty] Error getting claim history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving claim history: {str(e)}"
        )


# ============================================================
# STATISTICS
# ============================================================

def get_organization_warranty_stats(organization_id: str) -> dict:
    """
    Get warranty statistics for an organization.

    Args:
        organization_id: Organization UUID

    Returns:
        Statistics dict
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Registration stats
            cur.execute(
                '''
                SELECT
                    COUNT(*) as total_registrations,
                    COUNT(*) FILTER (WHERE wr.status = 'active') as active_registrations,
                    COUNT(*) FILTER (
                        WHERE wr.status = 'active'
                          AND wr.warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
                    ) as expiring_soon
                FROM public.warranty_registrations wr
                JOIN public.products p ON p.id = wr.product_id
                WHERE p.organization_id = %s
                ''',
                (organization_id,)
            )
            reg_stats = cur.fetchone()

            # Claim stats
            cur.execute(
                '''
                SELECT
                    COUNT(*) as total_claims,
                    COUNT(*) FILTER (WHERE wc.status IN ('submitted', 'under_review', 'approved', 'in_progress')) as pending_claims,
                    COUNT(*) FILTER (WHERE wc.status IN ('resolved', 'closed')) as resolved_claims,
                    AVG(
                        EXTRACT(EPOCH FROM (wc.resolved_at - wc.created_at)) / 86400
                    ) FILTER (WHERE wc.resolved_at IS NOT NULL) as avg_resolution_days
                FROM public.warranty_claims wc
                JOIN public.warranty_registrations wr ON wr.id = wc.registration_id
                JOIN public.products p ON p.id = wr.product_id
                WHERE p.organization_id = %s
                ''',
                (organization_id,)
            )
            claim_stats = cur.fetchone()

            return {
                'total_registrations': reg_stats['total_registrations'],
                'active_registrations': reg_stats['active_registrations'],
                'expiring_soon': reg_stats['expiring_soon'],
                'total_claims': claim_stats['total_claims'],
                'pending_claims': claim_stats['pending_claims'],
                'resolved_claims': claim_stats['resolved_claims'],
                'avg_resolution_days': round(claim_stats['avg_resolution_days'], 1) if claim_stats['avg_resolution_days'] else None
            }

    except Exception as e:
        logger.error(f"[warranty] Error getting organization stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving warranty statistics: {str(e)}"
        )
