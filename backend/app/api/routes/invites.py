from fastapi import APIRouter, Depends, Header, Query
from fastapi.concurrency import run_in_threadpool

from app.api.routes.auth import get_current_user_id
from app.core.supabase import supabase_admin
from app.schemas.auth import OrganizationInvite, OrganizationInviteCreate, OrganizationInvitePreview, SessionResponse
from app.services import invites as invites_service

router = APIRouter(prefix='/api', tags=['invites'])


def _parse_optional_user_id(authorization: str | None = Header(default=None)) -> str | None:
    if not authorization:
        return None
    if not authorization.startswith('Bearer '):
        return None
    token = authorization.split(' ', 1)[1]
    supabase_user = supabase_admin.get_user_by_access_token(token)
    return supabase_user.get('id')


@router.post('/organizations/{organization_id}/invites', response_model=OrganizationInvite, status_code=201)
async def create_invite(
    organization_id: str,
    payload: OrganizationInviteCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationInvite:
    return await run_in_threadpool(invites_service.create_invite, organization_id, current_user_id, payload)


@router.get('/organizations/{organization_id}/invites', response_model=list[OrganizationInvite])
async def list_invites(
    organization_id: str,
    status: str | None = Query(default=None, description='Filter by status'),
    current_user_id: str = Depends(get_current_user_id),
) -> list[OrganizationInvite]:
    return await run_in_threadpool(invites_service.list_invites, organization_id, current_user_id, status)


@router.get('/invites/{code}', response_model=OrganizationInvitePreview)
async def preview_invite(code: str) -> OrganizationInvitePreview:
    return await run_in_threadpool(invites_service.get_invite_preview, code)


@router.post('/invites/{code}/accept')
async def accept_invite(
    code: str,
    current_user_id: str | None = Depends(_parse_optional_user_id),
):
    result_type, payload = await run_in_threadpool(invites_service.accept_invite, code, current_user_id)
    if result_type == 'session':
        return payload  # SessionResponse
    return payload  # OrganizationInvitePreview with requires_auth

