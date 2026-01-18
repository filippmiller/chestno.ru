"""
Admin Organizations API Routes
Organization management for platform admins.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.services.admin_organizations import (
    list_all_organizations,
    update_organization_status,
    block_organization,
    get_organization_details,
    update_organization_details,
)

router = APIRouter(prefix='/api/admin/organizations', tags=['admin-organizations'])


@router.get('')
async def admin_list_organizations(
    request: Request,
    search: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern='^(pending|verified|rejected)$'),
    city: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    List all organizations (admin only).
    
    Supports filtering by:
    - search: Search in name, slug, email
    - status: Filter by verification_status
    - city: Filter by city
    - category: Filter by category
    """
    try:
        items, total = await run_in_threadpool(
            list_all_organizations,
            current_user_id,
            search,
            status,
            city,
            category,
            limit,
            offset,
        )
        return {'items': items, 'total': total}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to list organizations: {str(e)}')


@router.patch('/{organization_id}/status')
async def admin_update_status(
    request: Request,
    organization_id: str,
    verification_status: str | None = Query(default=None, pattern='^(pending|verified|rejected)$'),
    verification_comment: str | None = Query(default=None),
    public_visible: bool | None = Query(default=None),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Update organization verification status (admin only).
    """
    try:
        return await run_in_threadpool(
            update_organization_status,
            organization_id,
            current_user_id,
            verification_status,
            verification_comment,
            public_visible,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to update organization: {str(e)}')


@router.patch('/{organization_id}/block')
async def admin_block_organization(
    request: Request,
    organization_id: str,
    blocked: bool = Query(...),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Block/unblock organization (admin only).
    """
    try:
        return await run_in_threadpool(
            block_organization,
            organization_id,
            current_user_id,
            blocked,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to block/unblock organization: {str(e)}')


@router.get('/{organization_id}/details')
async def admin_get_organization_details(
    request: Request,
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Get full organization details including owners (admin only).
    """
    try:
        return await run_in_threadpool(
            get_organization_details,
            organization_id,
            current_user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to get organization details: {str(e)}')


@router.patch('/{organization_id}/details')
async def admin_update_organization_details(
    request: Request,
    organization_id: str,
    payload: dict,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Update organization details (admin only).
    """
    try:
        return await run_in_threadpool(
            update_organization_details,
            organization_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to update organization details: {str(e)}')


