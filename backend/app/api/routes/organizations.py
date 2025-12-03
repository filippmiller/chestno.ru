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


@public_router.get('/test', response_model=dict)
async def test_search():
    """Тестовый эндпоинт для проверки работы search_public_organizations"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info("Test endpoint called")
        items, total = await run_in_threadpool(
            search_public_organizations,
            None, None, None, False, 5, 0, False
        )
        return {"status": "ok", "total": total, "items_count": len(items), "items": [{"id": str(item.id), "name": item.name} for item in items]}
    except Exception as e:
        import traceback
        logger.error(f"Test endpoint error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}



@public_router.get('/search', response_model=PublicOrganizationsResponse)
async def public_search(
    q: str | None = Query(default=None),
    country: str | None = Query(default=None),
    category: str | None = Query(default=None),
    verified_only: bool = Query(default=False),
    include_non_public: bool = Query(default=False),  # Admin can use this
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PublicOrganizationsResponse:
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    
    logger.info(f"public_search called: q={q}, country={country}, category={category}, verified_only={verified_only}, limit={limit}, offset={offset}")
    
    try:
        items, total = await run_in_threadpool(
            search_public_organizations,
            q,
            country,
            category,
            verified_only,
            limit,
            offset,
            include_non_public,
        )
        logger.info(f"public_search success: total={total}, items_count={len(items)}")
        return PublicOrganizationsResponse(items=items, total=total)
    except Exception as e:
        error_msg = str(e)
        error_traceback = traceback.format_exc()
        logger.error(f"Error in public_search: {error_msg}")
        logger.error(f"Traceback: {error_traceback}")
        from fastapi import HTTPException, status
        # Return error details in development, but keep it safe for production
        detail = f"Failed to search organizations: {error_msg}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail
        )


@public_router.get('/{organization_id}', response_model=PublicOrganizationDetails)
async def public_details_by_id(organization_id: str) -> PublicOrganizationDetails:
    """Получить детали организации по ID (публичный API)."""
    from app.services.organization_profiles import get_public_organization_details_by_id
    return await run_in_threadpool(get_public_organization_details_by_id, organization_id)

