from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from app.schemas.auth import OrganizationProfile, OrganizationProfileUpdate, PublicOrganizationProfile
from app.schemas.onboarding import OnboardingSummary
from app.schemas.public import PublicOrganizationDetails, PublicOrganizationsResponse
from app.services.organization_profiles import (
    get_organization_profile,
    get_public_profile_by_slug,
    get_public_organization_details_by_slug,
    search_public_organizations,
    upsert_organization_profile,
)
from app.services.onboarding import get_onboarding_summary

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


@router.get('/{organization_id}/onboarding', response_model=OnboardingSummary)
async def onboarding_summary(organization_id: str, current_user_id: str = Depends(get_current_user_id)) -> OnboardingSummary:
    return await run_in_threadpool(get_onboarding_summary, organization_id, current_user_id)


@public_router.get('/by-slug/{slug}', response_model=PublicOrganizationProfile)
async def public_profile(slug: str) -> PublicOrganizationProfile:
    return await run_in_threadpool(get_public_profile_by_slug, slug)


@public_router.get('/details/{slug}', response_model=PublicOrganizationDetails)
async def public_details(slug: str) -> PublicOrganizationDetails:
    return await run_in_threadpool(get_public_organization_details_by_slug, slug)


@public_router.get('/{organization_id}', response_model=PublicOrganizationDetails)
async def public_details_by_id(organization_id: str) -> PublicOrganizationDetails:
    """Получить детали организации по ID (публичный API)."""
    from app.services.organization_profiles import get_public_organization_details_by_id
    return await run_in_threadpool(get_public_organization_details_by_id, organization_id)


@public_router.get('/search', response_model=PublicOrganizationsResponse)
async def public_search(
    q: str | None = Query(default=None),
    country: str | None = Query(default=None),
    category: str | None = Query(default=None),
    verified_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PublicOrganizationsResponse:
    items, total = await run_in_threadpool(
        search_public_organizations,
        q,
        country,
        category,
        verified_only,
        limit,
        offset,
    )
    return PublicOrganizationsResponse(items=items, total=total)

