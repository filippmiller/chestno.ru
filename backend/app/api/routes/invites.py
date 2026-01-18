from fastapi import APIRouter, Cookie, Depends, Query, Request
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.core.config import get_settings
from app.schemas.auth import OrganizationInvite, OrganizationInviteCreate, OrganizationInvitePreview, SessionResponse
from app.services import invites as invites_service
from app.services.sessions import get_session

settings = get_settings()
router = APIRouter(prefix='/api', tags=['invites'])


def _parse_optional_user_id_from_session(
    request: Request,
    session_id: str | None = Cookie(None, alias=settings.session_cookie_name),
) -> str | None:
    """Parse user ID from session cookie (optional - returns None if no session)."""
    if not session_id:
        return None
    session = get_session(session_id)
    if not session:
        return None
    return session.get('user_id')


@router.post('/organizations/{organization_id}/invites', response_model=OrganizationInvite, status_code=201)
async def create_invite(
    request: Request,
    organization_id: str,
    payload: OrganizationInviteCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> OrganizationInvite:
    return await run_in_threadpool(invites_service.create_invite, organization_id, current_user_id, payload)


@router.get('/organizations/{organization_id}/invites', response_model=list[OrganizationInvite])
async def list_invites(
    request: Request,
    organization_id: str,
    status: str | None = Query(default=None, description='Filter by status'),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[OrganizationInvite]:
    return await run_in_threadpool(invites_service.list_invites, organization_id, current_user_id, status)


@router.get('/invites/{code}', response_model=OrganizationInvitePreview)
async def preview_invite(code: str) -> OrganizationInvitePreview:
    return await run_in_threadpool(invites_service.get_invite_preview, code)


@router.post('/invites/{code}/accept')
async def accept_invite(
    request: Request,
    code: str,
    current_user_id: str | None = Depends(_parse_optional_user_id_from_session),
):
    result_type, payload = await run_in_threadpool(invites_service.accept_invite, code, current_user_id)
    if result_type == 'session':
        return payload  # SessionResponse
    return payload  # OrganizationInvitePreview with requires_auth
