from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from app.schemas.auth import OrganizationProfile, OrganizationProfileUpdate, PublicOrganizationProfile
from app.services.organization_profiles import (
    get_organization_profile,
    get_public_profile_by_slug,
    upsert_organization_profile,
)

from .auth import get_current_user_id

router = APIRouter(prefix='/api/organizations', tags=['organizations'])
public_router = APIRouter(prefix='/api/public/organizations', tags=['organizations'])


@router.get('/{organization_id}/profile', response_model=OrganizationProfile | None)
async def fetch_profile(organization_id: str, current_user_id: str = Depends(get_current_user_id)) -> OrganizationProfile | None:
    return await run_in_threadpool(get_organization_profile, organization_id, current_user_id)


@router.put('/{organization_id}/profile', response_model=OrganizationProfile)
async def update_profile(
    organization_id: str,
    payload: OrganizationProfileUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> OrganizationProfile:
    return await run_in_threadpool(upsert_organization_profile, organization_id, current_user_id, payload)


@public_router.get('/by-slug/{slug}', response_model=PublicOrganizationProfile)
async def public_profile(slug: str) -> PublicOrganizationProfile:
    return await run_in_threadpool(get_public_profile_by_slug, slug)

