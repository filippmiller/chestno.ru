"""
Admin Users API Routes
User management for platform admins.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.services.admin_users import list_all_users, update_user_role, block_user

router = APIRouter(prefix='/api/admin/users', tags=['admin-users'])


@router.get('')
async def admin_list_users(
    request: Request,
    email: str | None = Query(default=None, alias='email_search'),
    role: str | None = Query(default=None, pattern='^(admin|business_owner|user)$'),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    List all users (admin only).

    Supports filtering by:
    - email: Search by email (partial match, case-insensitive)
    - role: Filter by role (admin/business_owner/user)
    """
    try:
        items, total = await run_in_threadpool(
            list_all_users,
            current_user_id,
            email,
            role,
            limit,
            offset,
        )
        return {'items': items, 'total': total}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to list users: {str(e)}')


@router.patch('/{user_id}/role')
async def admin_update_role(
    request: Request,
    user_id: str,
    role: str = Query(..., pattern='^(admin|business_owner|user)$'),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Update user role (admin only).
    """
    try:
        return await run_in_threadpool(
            update_user_role,
            user_id,
            current_user_id,
            role,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to update user role: {str(e)}')


@router.patch('/{user_id}/block')
async def admin_block_user(
    request: Request,
    user_id: str,
    blocked: bool = Query(...),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Block/unblock user (admin only).

    Note: Blocking functionality is a placeholder and needs database schema update.
    """
    try:
        return await run_in_threadpool(
            block_user,
            user_id,
            current_user_id,
            blocked,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to block/unblock user: {str(e)}')

