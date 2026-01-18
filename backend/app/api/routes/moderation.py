from fastapi import APIRouter, Depends, Query, Request
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.moderation import ModerationAction, ModerationOrganization
from app.services import moderation as moderation_service

router = APIRouter(prefix='/api/moderation', tags=['moderation'])


@router.get('/organizations', response_model=list[ModerationOrganization])
async def list_organizations(
    request: Request,
    status: str | None = Query(default='pending'),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[ModerationOrganization]:
    return await run_in_threadpool(moderation_service.list_organizations, current_user_id, status, limit, offset)


@router.post('/organizations/{organization_id}/verify', response_model=ModerationOrganization)
async def verify_organization(
    request: Request,
    organization_id: str,
    payload: ModerationAction,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ModerationOrganization:
    return await run_in_threadpool(moderation_service.verify_organization, organization_id, current_user_id, payload)

