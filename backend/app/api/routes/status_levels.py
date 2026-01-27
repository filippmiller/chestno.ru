"""
Status Levels API Routes
REST API endpoints for organization status level management.
"""
from datetime import datetime
from typing import Optional, Literal
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.status_levels import (
    OrganizationStatus,
    StatusLevel,
    StatusHistoryEntry,
    UpgradeRequest,
    GrantStatusLevelRequest,
    RevokeStatusLevelRequest,
)
from app.services.admin_guard import assert_platform_admin

logger = logging.getLogger(__name__)

# Public routes (no auth required)
public_router = APIRouter(prefix='/api/status-levels', tags=['status-levels'])

# Authenticated routes (user must be logged in)
router = APIRouter(prefix='/api/organizations', tags=['status-levels'])

# Admin routes (platform admin only)
admin_router = APIRouter(prefix='/api/admin/organizations', tags=['admin-status-levels'])


# ==================== Public Routes ====================

@public_router.get('/info', response_model=dict)
async def get_status_levels_info() -> dict:
    """
    Get public information about all status levels.

    No authentication required. Returns information about:
    - Level names and descriptions
    - Pricing for each level
    - Features included
    - Criteria for Level C
    """
    from app.services.status_levels import get_status_levels_info
    return await run_in_threadpool(get_status_levels_info)


# ==================== Authenticated Routes ====================

@router.get('/{organization_id}/status', response_model=OrganizationStatus)
async def get_organization_status(
    organization_id: str,
    request: Request,
) -> OrganizationStatus:
    """
    Get current status levels for an organization.

    Returns:
    - current_level: The highest active level (0, A, B, or C)
    - active_levels: All active status levels
    - level_c_progress: Progress toward Level C (only for org members)
    - can_manage: Whether current user can manage this org

    Public access shows limited data (current level only).
    Authenticated org members see full details and progress.
    """
    from app.services.status_levels import get_organization_status

    # Try to get user ID (optional - public access allowed)
    user_id = None
    try:
        from app.core.session_deps import SESSION_COOKIE_NAME
        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        if session_id:
            user_id = await get_current_user_id_from_session(request, session_id)
    except HTTPException:
        pass  # Not authenticated, show public view

    return await run_in_threadpool(
        get_organization_status,
        organization_id,
        user_id
    )


@router.post('/{organization_id}/status-upgrade-request', response_model=UpgradeRequest)
async def create_upgrade_request(
    organization_id: str,
    target_level: Literal['B', 'C'],
    message: Optional[str] = None,
    evidence_urls: Optional[list[str]] = None,
    request: Request = None,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> UpgradeRequest:
    """
    Request an upgrade to a higher status level.

    Requirements:
    - Must be organization admin or owner
    - Rate limit: 1 request per 30 days
    - Level C requires active Level B

    Args:
        organization_id: Organization to upgrade
        target_level: Target level (B or C)
        message: Optional message explaining why you deserve the upgrade
        evidence_urls: Optional URLs to supporting evidence (certifications, etc.)

    Returns:
        Created upgrade request

    Errors:
        403: Not authorized (not org admin)
        422: Cannot request (e.g., requesting C without B)
        429: Rate limit exceeded
    """
    from app.services.status_levels import create_upgrade_request as create_request

    try:
        return await run_in_threadpool(
            create_request,
            organization_id,
            current_user_id,
            target_level,
            message,
            evidence_urls
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error creating upgrade request: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to create upgrade request: {str(e)}'
        )


@router.get('/{organization_id}/status-history')
async def get_status_history(
    organization_id: str,
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Get status level change history for an organization.

    Accessible by:
    - Organization members (all roles)
    - Platform admins

    Args:
        organization_id: Organization ID
        page: Page number (1-indexed)
        per_page: Items per page (max 100)

    Returns:
        {
            "history": [...],
            "pagination": {
                "page": 1,
                "per_page": 20,
                "total": 100,
                "total_pages": 5
            }
        }
    """
    from app.services.status_levels import get_status_history as get_history

    try:
        entries, total = await run_in_threadpool(
            get_history,
            organization_id,
            current_user_id,
            page,
            per_page
        )

        total_pages = (total + per_page - 1) // per_page

        return {
            "history": [entry.model_dump() for entry in entries],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error retrieving status history: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to retrieve status history: {str(e)}'
        )


# ==================== Admin Routes ====================

@admin_router.post('/{organization_id}/status-levels', response_model=StatusLevel)
async def grant_status_level(
    organization_id: str,
    payload: GrantStatusLevelRequest,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StatusLevel:
    """
    Grant a status level to an organization (platform admin only).

    Requirements:
    - Must be platform admin
    - Level C requires active Level B
    - Cannot grant level that's already active

    Args:
        organization_id: Organization ID
        payload: {
            level: "A" | "B" | "C",
            valid_until: datetime (optional),
            notes: string (optional),
            subscription_id: string (optional)
        }

    Returns:
        Created status level record

    Errors:
        403: Not authorized (not platform admin)
        409: Level already active
        422: Business logic violation (e.g., granting C without B)
    """
    from app.services.status_levels import grant_status_level as grant_level

    try:
        # Validate admin permissions
        assert_platform_admin(current_user_id)

        return await run_in_threadpool(
            grant_level,
            organization_id,
            payload.level,
            current_user_id,
            payload.valid_until,
            payload.subscription_id,
            payload.notes
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error granting status level: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to grant status level: {str(e)}'
        )


@admin_router.delete('/{organization_id}/status-levels/{level}')
async def revoke_status_level(
    organization_id: str,
    level: Literal['A', 'B', 'C'],
    request: Request,
    reason: Optional[str] = Query(None, max_length=500),
    notify: bool = Query(True),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Revoke a status level from an organization (platform admin only).

    Requirements:
    - Must be platform admin

    Args:
        organization_id: Organization ID
        level: Level to revoke (A, B, or C)
        reason: Optional reason for revocation
        notify: Whether to send notification to organization (default: true)

    Returns:
        {
            "revoked": true,
            "level": "A",
            "organization_id": "...",
            "revoked_at": "2026-01-27T...",
            "revoked_by": "...",
            "reason": "...",
            "notification_sent": true
        }

    Errors:
        403: Not authorized
        404: Level not found or already inactive
    """
    from app.services.status_levels import revoke_status_level as revoke_level

    try:
        # Validate admin permissions
        assert_platform_admin(current_user_id)

        success = await run_in_threadpool(
            revoke_level,
            organization_id,
            level,
            current_user_id,
            reason
        )

        # TODO: Send notification if notify=True
        notification_sent = False
        if notify:
            # This would call notification service
            # await send_status_revoked_notification(organization_id, level, reason)
            notification_sent = False  # Not implemented yet

        return {
            "revoked": success,
            "level": level,
            "organization_id": organization_id,
            "revoked_at": datetime.utcnow().isoformat(),
            "revoked_by": current_user_id,
            "reason": reason,
            "notification_sent": notification_sent
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error revoking status level: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to revoke status level: {str(e)}'
        )
