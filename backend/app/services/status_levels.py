"""
Status Levels Service

Comprehensive service for managing organization status levels (A/B/C badges).

Core Features:
- Query organization status and eligibility
- Grant and revoke status levels
- Check level C criteria and progress
- Subscription integration (automatic level A)
- Grace period management
- Upgrade request handling

Database tables:
- organization_status_levels: Active status levels
- organization_status_history: Audit trail
- status_upgrade_requests: Upgrade request tracking

SQL functions:
- get_current_status_level(org_id): Get current level (0/A/B/C)
- check_level_c_criteria(org_id): Check level C eligibility
- grant_status_level(...): Grant a status level with history
- revoke_status_level(...): Revoke a status level with history
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection

logger = logging.getLogger(__name__)

# Simple in-memory cache with expiration
_cache: dict[str, tuple[any, datetime]] = {}
CACHE_TTL_SECONDS = 60


# ============================================================
# CACHE UTILITIES
# ============================================================

def _get_cached(key: str) -> Optional[any]:
    """Get value from cache if not expired"""
    if key in _cache:
        value, expires_at = _cache[key]
        if datetime.utcnow() < expires_at:
            return value
        del _cache[key]
    return None


def _set_cache(key: str, value: any, ttl_seconds: int = CACHE_TTL_SECONDS) -> None:
    """Set value in cache with expiration"""
    expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
    _cache[key] = (value, expires_at)


def _invalidate_cache(organization_id: str) -> None:
    """Invalidate all cache entries for an organization"""
    keys_to_delete = [k for k in _cache.keys() if organization_id in k]
    for key in keys_to_delete:
        del _cache[key]


# ============================================================
# CORE STATUS QUERIES
# ============================================================

def get_organization_status(
    organization_id: str,
    user_id: Optional[str] = None
) -> dict:
    """
    Get current status and all active levels for an organization.

    Args:
        organization_id: Organization UUID
        user_id: Optional user ID to check if they can manage the org

    Returns:
        dict with:
        - organization_id: str
        - current_level: '0', 'A', 'B', or 'C'
        - active_levels: list of active status level records
        - level_c_progress: optional progress data (if user can manage or has B)
        - can_manage: bool (if user is org member)

    Caching:
        Results cached for 60 seconds, invalidated on grant/revoke
    """
    cache_key = f"org_status:{organization_id}:{user_id or 'anon'}"

    # Check cache
    cached = _get_cached(cache_key)
    if cached:
        logger.debug(f"[status_levels] Cache hit for {cache_key}")
        return cached

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get current level using SQL function
            cur.execute(
                'SELECT public.get_current_status_level(%s::uuid) as current_level',
                (organization_id,)
            )
            row = cur.fetchone()
            current_level = row['current_level'] if row else '0'

            # Get all active status levels
            cur.execute(
                '''
                SELECT
                    id::text,
                    organization_id::text,
                    granted_by::text,
                    subscription_id::text,
                    level,
                    is_active,
                    can_use_badge,
                    granted_at,
                    valid_until,
                    last_verified_at,
                    notes,
                    metadata,
                    created_at,
                    updated_at
                FROM public.organization_status_levels
                WHERE organization_id = %s
                  AND is_active = true
                  AND (valid_until IS NULL OR valid_until > now())
                ORDER BY
                    CASE level
                        WHEN 'C' THEN 3
                        WHEN 'B' THEN 2
                        WHEN 'A' THEN 1
                    END DESC
                ''',
                (organization_id,)
            )
            rows = cur.fetchall()
            active_levels = [dict(row) for row in rows]

            # Check if user can manage (is member/admin of org)
            can_manage = False
            if user_id:
                cur.execute(
                    '''
                    SELECT 1 FROM public.organization_memberships
                    WHERE organization_id = %s
                      AND user_id = %s
                      AND status = 'active'
                    LIMIT 1
                    ''',
                    (organization_id, user_id)
                )
                can_manage = cur.fetchone() is not None

            # Get level C progress if user can manage or if has level B
            level_c_progress = None
            has_level_b = any(lvl['level'] == 'B' for lvl in active_levels)
            if can_manage or has_level_b:
                level_c_progress = get_level_c_progress(organization_id)

            result = {
                'organization_id': organization_id,
                'current_level': current_level,
                'active_levels': active_levels,
                'level_c_progress': level_c_progress,
                'can_manage': can_manage
            }

            # Cache result
            _set_cache(cache_key, result)

            return result

    except Exception as e:
        logger.error(f"[status_levels] Error getting org status for {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving organization status: {str(e)}"
        )


def check_level_c_eligibility(organization_id: str) -> dict:
    """
    Check if organization meets all criteria for level C.

    Criteria:
    - Has active level B
    - 15+ published reviews in last 12 months
    - 85%+ response rate in last 90 days
    - <48 hour average response time in last 90 days
    - 1+ published public case study

    Args:
        organization_id: Organization UUID

    Returns:
        dict with:
        - organization_id: str
        - meets_criteria: bool
        - criteria: dict with detailed breakdown
        - timestamp: datetime

    Raises:
        HTTPException: If database error
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT public.check_level_c_criteria(%s::uuid) as result',
                (organization_id,)
            )
            row = cur.fetchone()
            result_json = row['result']

            return {
                'organization_id': organization_id,
                'meets_criteria': result_json.get('meets_criteria', False),
                'criteria': result_json.get('criteria', {}),
                'timestamp': datetime.utcnow()
            }

    except Exception as e:
        logger.error(f"[status_levels] Error checking level C eligibility for {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking level C eligibility: {str(e)}"
        )


def get_level_c_progress(organization_id: str) -> dict:
    """
    Get detailed progress toward level C eligibility.

    Args:
        organization_id: Organization UUID

    Returns:
        dict with criteria breakdown:
        - meets_criteria: bool
        - has_active_b: bool
        - review_count: int (current)
        - review_count_needed: int (15)
        - response_rate: float (current %)
        - response_rate_needed: float (85%)
        - avg_response_hours: float (current)
        - avg_response_hours_max: float (48)
        - public_cases: int (current)
        - public_cases_needed: int (1)
        - error: optional str

    Raises:
        HTTPException: If database error
    """
    eligibility = check_level_c_eligibility(organization_id)
    return eligibility['criteria']


# ============================================================
# GRANT/REVOKE STATUS LEVELS
# ============================================================

def grant_status_level(
    organization_id: str,
    level: Literal['A', 'B', 'C'],
    granted_by: str,
    valid_until: Optional[datetime] = None,
    subscription_id: Optional[str] = None,
    notes: Optional[str] = None
) -> dict:
    """
    Grant a status level to an organization.

    Business rules:
    - Level C requires active level B
    - Level A typically tied to subscription (provide subscription_id)
    - Level B valid for 18 months unless renewed
    - Level C is permanent (valid_until should be NULL)

    Args:
        organization_id: Organization UUID
        level: Status level to grant (A, B, or C)
        granted_by: User UUID granting the level
        valid_until: Optional expiration date (None for C, auto-set for B)
        subscription_id: Optional subscription UUID (for level A)
        notes: Optional admin notes

    Returns:
        dict with created status level record

    Raises:
        HTTPException: If business rules violated or database error
    """
    try:
        # Validate business logic for level C
        if level == 'C':
            eligibility = check_level_c_eligibility(organization_id)
            if not eligibility['meets_criteria']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Organization does not meet level C criteria. Must have active level B."
                )

        # Set default valid_until for level B if not provided
        if level == 'B' and valid_until is None:
            valid_until = datetime.utcnow() + timedelta(days=18*30)  # 18 months

        # Grant using SQL function
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT public.grant_status_level(
                    %s::uuid,
                    %s::text,
                    %s::uuid,
                    %s::timestamptz,
                    %s::uuid,
                    %s::text
                ) as status_id
                ''',
                (
                    organization_id,
                    level,
                    granted_by,
                    valid_until,
                    subscription_id,
                    notes
                )
            )
            row = cur.fetchone()
            status_id = row['status_id']

            # Fetch the created record
            cur.execute(
                '''
                SELECT
                    id::text,
                    organization_id::text,
                    granted_by::text,
                    subscription_id::text,
                    level,
                    is_active,
                    can_use_badge,
                    granted_at,
                    valid_until,
                    last_verified_at,
                    notes,
                    metadata,
                    created_at,
                    updated_at
                FROM public.organization_status_levels
                WHERE id = %s
                ''',
                (status_id,)
            )
            result_row = cur.fetchone()
            conn.commit()

            # Invalidate cache
            _invalidate_cache(organization_id)

            logger.info(f"[status_levels] Granted level {level} to org {organization_id} by user {granted_by}")

            return dict(result_row)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[status_levels] Error granting level {level} to {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error granting status level: {str(e)}"
        )


def revoke_status_level(
    organization_id: str,
    level: Literal['A', 'B', 'C'],
    revoked_by: str,
    reason: Optional[str] = None
) -> bool:
    """
    Revoke a status level from an organization.

    This deactivates the status level and logs to history.

    Args:
        organization_id: Organization UUID
        level: Status level to revoke (A, B, or C)
        revoked_by: User UUID revoking the level
        reason: Optional reason for revocation

    Returns:
        True if level was revoked, False if level was not active

    Raises:
        HTTPException: If database error
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT public.revoke_status_level(
                    %s::uuid,
                    %s::text,
                    %s::uuid,
                    %s::text
                ) as success
                ''',
                (organization_id, level, revoked_by, reason)
            )
            row = cur.fetchone()
            success = row['success']
            conn.commit()

            # Invalidate cache
            _invalidate_cache(organization_id)

            if success:
                logger.info(f"[status_levels] Revoked level {level} from org {organization_id} by user {revoked_by}")
            else:
                logger.warning(f"[status_levels] Attempted to revoke inactive level {level} from org {organization_id}")

            return success

    except Exception as e:
        logger.error(f"[status_levels] Error revoking level {level} from {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error revoking status level: {str(e)}"
        )


# ============================================================
# HISTORY AND AUDIT
# ============================================================

def get_status_history(
    organization_id: str,
    user_id: str,
    page: int = 1,
    per_page: int = 20
) -> tuple[list[dict], int]:
    """
    Get status change history for an organization.

    Args:
        organization_id: Organization UUID
        user_id: Current user ID (for auth check)
        page: Page number (1-indexed)
        per_page: Items per page (max 100)

    Returns:
        Tuple of (history entries list, total count)
    """
    try:
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get total count
            cur.execute(
                'SELECT COUNT(*) as total FROM public.organization_status_history WHERE organization_id = %s',
                (organization_id,)
            )
            total = cur.fetchone()['total']

            # Get history entries
            cur.execute(
                '''
                SELECT
                    id::text,
                    organization_id::text,
                    level,
                    action,
                    reason,
                    performed_by::text,
                    metadata,
                    ip_address::text as ip_address,
                    user_agent,
                    created_at
                FROM public.organization_status_history
                WHERE organization_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                ''',
                (organization_id, per_page, offset)
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows], total

    except Exception as e:
        logger.error(f"[status_levels] Error getting status history for {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving status history: {str(e)}"
        )


# ============================================================
# SUBSCRIPTION INTEGRATION (Level A)
# ============================================================

def ensure_level_a(
    org_id: str,
    subscription_id: str,
    granted_by: Optional[str] = None
) -> dict:
    """
    Ensure organization has active level A status.
    Idempotent - only grants if not already active.

    Args:
        org_id: Organization UUID
        subscription_id: Subscription UUID that grants level A
        granted_by: User UUID who granted (None for automatic)

    Returns:
        dict with status_level_id and action ('granted' or 'already_active')
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Check if level A already active
        cur.execute("""
            SELECT id, valid_until
            FROM public.organization_status_levels
            WHERE organization_id = %s
              AND level = 'A'
              AND is_active = true
              AND (valid_until IS NULL OR valid_until > now())
        """, (org_id,))

        existing = cur.fetchone()

        if existing:
            # Already has active A - just update subscription reference
            cur.execute("""
                UPDATE public.organization_status_levels
                SET subscription_id = %s,
                    updated_at = now()
                WHERE id = %s
            """, (subscription_id, existing['id']))
            conn.commit()

            _invalidate_cache(org_id)

            return {
                'status_level_id': str(existing['id']),
                'action': 'already_active'
            }

        # Grant new level A
        cur.execute("""
            SELECT public.grant_status_level(
                %s::uuid,  -- org_id
                'A',       -- level
                %s::uuid,  -- granted_by (NULL for auto)
                NULL,      -- valid_until (tied to subscription)
                %s::uuid,  -- subscription_id
                'Auto-granted via subscription activation'
            ) as new_id
        """, (org_id, granted_by, subscription_id))

        result = cur.fetchone()
        conn.commit()

        _invalidate_cache(org_id)

        return {
            'status_level_id': str(result['new_id']),
            'action': 'granted'
        }


def revoke_level_a_for_subscription(
    org_id: str,
    subscription_id: str,
    reason: str = 'subscription_cancelled',
    revoked_by: Optional[str] = None
) -> dict:
    """
    Revoke level A status when subscription is cancelled/expired.
    Only revokes if the level A is associated with this subscription.

    Args:
        org_id: Organization UUID
        subscription_id: Subscription UUID
        reason: Reason for revocation
        revoked_by: User UUID who revoked (None for automatic)

    Returns:
        dict with action ('revoked' or 'not_found')
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Find level A tied to this subscription
        cur.execute("""
            SELECT id
            FROM public.organization_status_levels
            WHERE organization_id = %s
              AND level = 'A'
              AND subscription_id = %s
              AND is_active = true
        """, (org_id, subscription_id))

        level_a = cur.fetchone()

        if not level_a:
            return {
                'action': 'not_found',
                'message': 'No active level A found for this subscription'
            }

        # Use SQL function to revoke (includes history logging)
        cur.execute("""
            SELECT public.revoke_status_level(
                %s::uuid,  -- org_id
                'A',       -- level
                %s::uuid,  -- revoked_by
                %s         -- reason
            ) as success
        """, (org_id, revoked_by, reason))

        result = cur.fetchone()
        conn.commit()

        _invalidate_cache(org_id)

        return {
            'action': 'revoked' if result['success'] else 'failed',
            'level_id': str(level_a['id'])
        }


def start_grace_period(
    org_id: str,
    days: int = 14
) -> dict:
    """
    Start grace period for organization's subscription.
    Updates subscription record with grace period end date.
    Level A remains active during grace period.

    Args:
        org_id: Organization UUID
        days: Grace period duration in days (default 14 for level A)

    Returns:
        dict with grace_period_ends_at timestamp
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        grace_ends_at = datetime.utcnow() + timedelta(days=days)

        # Update subscription with grace period
        cur.execute("""
            UPDATE public.organization_subscriptions
            SET grace_period_days = %s,
                grace_period_ends_at = %s,
                updated_at = now()
            WHERE organization_id = %s
              AND status = 'past_due'
            RETURNING id
        """, (days, grace_ends_at, org_id))

        result = cur.fetchone()

        if not result:
            return {
                'grace_period_ends_at': None,
                'action': 'no_subscription_found'
            }

        # Log to status history
        cur.execute("""
            INSERT INTO public.organization_status_history (
                organization_id,
                level,
                action,
                reason,
                metadata
            ) VALUES (
                %s,
                'A',
                'suspended',
                'Subscription past due - grace period started',
                %s
            )
        """, (org_id, {'grace_period_days': days, 'grace_period_ends_at': grace_ends_at.isoformat()}))

        conn.commit()

        return {
            'grace_period_ends_at': grace_ends_at.isoformat(),
            'action': 'grace_period_started'
        }


def is_grace_period_ended(org_id: str) -> bool:
    """
    Check if organization's grace period has expired.

    Args:
        org_id: Organization UUID

    Returns:
        True if grace period expired, False otherwise
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("""
            SELECT grace_period_ends_at
            FROM public.organization_subscriptions
            WHERE organization_id = %s
              AND grace_period_ends_at IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 1
        """, (org_id,))

        result = cur.fetchone()

        if not result or not result['grace_period_ends_at']:
            return False

        return datetime.utcnow() >= result['grace_period_ends_at']


def handle_subscription_status_change(
    subscription_id: str,
    new_status: str,
    organization_id: str,
    actor_user_id: Optional[str] = None
) -> dict:
    """
    Main webhook handler for subscription status changes.
    Coordinates status level changes based on subscription state.

    Args:
        subscription_id: Subscription UUID
        new_status: New subscription status ('active', 'past_due', 'cancelled', etc.)
        organization_id: Organization UUID
        actor_user_id: User who triggered the change (optional)

    Returns:
        dict describing the action taken
    """
    result = {
        'subscription_id': subscription_id,
        'new_status': new_status,
        'organization_id': organization_id,
        'timestamp': datetime.utcnow().isoformat()
    }

    if new_status == 'active':
        level_result = ensure_level_a(
            org_id=organization_id,
            subscription_id=subscription_id,
            granted_by=actor_user_id
        )
        result['level_a_action'] = level_result

    elif new_status == 'past_due':
        grace_result = start_grace_period(
            org_id=organization_id,
            days=14
        )
        result['grace_period_action'] = grace_result

    elif new_status == 'cancelled':
        grace_ended = is_grace_period_ended(organization_id)
        result['grace_period_ended'] = grace_ended

        if grace_ended:
            revoke_result = revoke_level_a_for_subscription(
                org_id=organization_id,
                subscription_id=subscription_id,
                reason='subscription_cancelled_after_grace',
                revoked_by=actor_user_id
            )
            result['level_a_action'] = revoke_result
        else:
            result['level_a_action'] = {
                'action': 'retained',
                'message': 'Level A retained during grace period'
            }

    else:
        result['action'] = 'no_status_change_needed'

    return result


# ============================================================
# UPGRADE REQUESTS
# ============================================================

def create_upgrade_request(
    organization_id: str,
    target_level: Literal['B', 'C'],
    requested_by: str,
    message: Optional[str] = None,
    evidence_urls: Optional[list[str]] = None
) -> dict:
    """
    Create a new status upgrade request.

    Business rules:
    - Only one pending request per organization (enforced by DB constraint)
    - Can only request B or C (A is subscription-based)

    Args:
        organization_id: Organization UUID
        target_level: Desired level (B or C)
        requested_by: User UUID making the request
        message: Optional explanation from the organization
        evidence_urls: Optional supporting material links

    Returns:
        dict with created upgrade request

    Raises:
        HTTPException: If duplicate pending request or database error
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                INSERT INTO public.status_upgrade_requests (
                    organization_id,
                    target_level,
                    requested_by,
                    message,
                    evidence_urls
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING
                    id::text,
                    organization_id::text,
                    target_level,
                    status,
                    message,
                    evidence_urls,
                    review_notes,
                    rejection_reason,
                    requested_by::text,
                    reviewed_by::text,
                    requested_at,
                    reviewed_at,
                    metadata
                ''',
                (organization_id, target_level, requested_by, message, evidence_urls)
            )
            row = cur.fetchone()
            conn.commit()

            logger.info(f"[status_levels] Created upgrade request for org {organization_id} to level {target_level}")

            return dict(row)

    except Exception as e:
        # Check for duplicate pending request constraint violation
        if 'idx_one_pending_per_org' in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Organization already has a pending upgrade request"
            )
        logger.error(f"[status_levels] Error creating upgrade request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating upgrade request: {str(e)}"
        )


def get_upgrade_requests_for_org(
    organization_id: str,
    limit: int = 20
) -> list[dict]:
    """Get all upgrade requests for an organization, newest first"""
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    id::text,
                    organization_id::text,
                    target_level,
                    status,
                    message,
                    evidence_urls,
                    review_notes,
                    rejection_reason,
                    requested_by::text,
                    reviewed_by::text,
                    requested_at,
                    reviewed_at,
                    metadata
                FROM public.status_upgrade_requests
                WHERE organization_id = %s
                ORDER BY requested_at DESC
                LIMIT %s
                ''',
                (organization_id, limit)
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows]

    except Exception as e:
        logger.error(f"[status_levels] Error getting upgrade requests: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving upgrade requests: {str(e)}"
        )


def get_status_levels_info() -> dict:
    """
    Get public information about all status levels.

    No authentication required. Returns information about:
    - Level names and descriptions
    - Pricing for each level
    - Features included
    - Criteria for Level C

    Returns:
        dict with level information
    """
    return {
        "levels": {
            "A": {
                "name": "Самодекларация",
                "description": "Организация самостоятельно заявляет о своей честности",
                "price": {"monthly": 990, "yearly": 9900},
                "features": [
                    "Значок 'Уровень A' на профиле",
                    "Доступ к базовой аналитике",
                    "Возможность отвечать на отзывы",
                    "Публикация продукции"
                ]
            },
            "B": {
                "name": "Проверено платформой",
                "description": "Платформа провела проверку организации",
                "price": {"production": 5000, "subscription": 2990},
                "features": [
                    "Значок 'Проверено' на профиле",
                    "Приоритет в поиске",
                    "Расширенная аналитика",
                    "Публикация кейсов",
                    "Интеграция с QR-кодами"
                ]
            },
            "C": {
                "name": "Высшая репутация",
                "description": "Заслужено органическим путем через отличный сервис",
                "price": "FREE",
                "criteria": [
                    "Активный уровень B",
                    "50+ одобренных отзывов за последний год",
                    "95%+ процент ответов на отзывы",
                    "Среднее время ответа ≤ 48 часов",
                    "30+ публичных кейсов разрешения конфликтов"
                ],
                "features": [
                    "Премиум значок 'Высшая репутация'",
                    "Топ позиции в каталоге",
                    "Полный доступ ко всем функциям",
                    "Персональный менеджер",
                    "PR поддержка"
                ]
            }
        }
    }


# ============================================================
# LEGACY COMPATIBILITY (maintained for backward compatibility)
# ============================================================

def get_organization_status_summary(org_id: str) -> dict:
    """
    Legacy function - use get_organization_status() instead.
    Get current status levels for an organization.

    Args:
        org_id: Organization UUID

    Returns:
        dict with current status levels and details
    """
    return get_organization_status(org_id, user_id=None)
