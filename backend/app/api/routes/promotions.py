"""
API routes for Manufacturer Promotions.

Endpoints for organizations to create and manage promotional codes,
and for users to view their received promo codes.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.session_deps import get_current_user_id_from_session
from app.schemas.promotions import (
    DistributeRequest,
    DistributeResponse,
    MarkCodeUsedRequest,
    PromoCode,
    PromoCodeListResponse,
    PromoCodeStatus,
    Promotion,
    PromotionCreate,
    PromotionListResponse,
    PromotionStatus,
    PromotionUpdate,
    SubscriberCountResponse,
)
from app.services import promotions as promo_service


router = APIRouter(tags=['promotions'])


# =============================================================================
# ORGANIZATION ENDPOINTS (for manufacturers)
# =============================================================================

@router.post(
    '/api/v1/organizations/{organization_id}/promotions',
    response_model=Promotion,
    status_code=status.HTTP_201_CREATED,
)
async def create_promotion(
    organization_id: str,
    payload: PromotionCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Promotion:
    """
    Create a new promotion for the organization.

    Only organization owners, admins, and managers can create promotions.
    The promotion starts in 'draft' status and must be activated before
    codes can be distributed.
    """
    return promo_service.create_promotion(
        organization_id=organization_id,
        user_id=current_user_id,
        payload=payload,
    )


@router.get(
    '/api/v1/organizations/{organization_id}/promotions',
    response_model=PromotionListResponse,
)
async def list_promotions(
    organization_id: str,
    status_filter: Optional[PromotionStatus] = Query(
        None, alias='status', description='Filter by promotion status'
    ),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> PromotionListResponse:
    """
    List all promotions for the organization.

    Returns promotions ordered by creation date (newest first).
    Includes subscriber count and usage statistics.
    """
    return promo_service.list_promotions(
        organization_id=organization_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get(
    '/api/v1/organizations/{organization_id}/promotions/{promotion_id}',
    response_model=Promotion,
)
async def get_promotion(
    organization_id: str,
    promotion_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Promotion:
    """
    Get details of a specific promotion.

    Includes subscriber count and code distribution statistics.
    """
    promotion = promo_service.get_promotion(promotion_id, organization_id)
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Promotion not found',
        )
    return promotion


@router.put(
    '/api/v1/organizations/{organization_id}/promotions/{promotion_id}',
    response_model=Promotion,
)
async def update_promotion(
    organization_id: str,
    promotion_id: str,
    payload: PromotionUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Promotion:
    """
    Update an existing promotion.

    Can update all fields except codes that have already been distributed.
    To activate a promotion, set status to 'active'.
    """
    promotion = promo_service.update_promotion(
        promotion_id=promotion_id,
        organization_id=organization_id,
        payload=payload,
    )
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Promotion not found',
        )
    return promotion


@router.delete(
    '/api/v1/organizations/{organization_id}/promotions/{promotion_id}',
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_promotion(
    organization_id: str,
    promotion_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> None:
    """
    Delete a promotion.

    If codes have been distributed, the promotion is marked as cancelled.
    Otherwise, it's permanently deleted.
    """
    success = promo_service.delete_promotion(promotion_id, organization_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Promotion not found',
        )


@router.get(
    '/api/v1/organizations/{organization_id}/subscribers/count',
    response_model=SubscriberCountResponse,
)
async def get_subscriber_count(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> SubscriberCountResponse:
    """
    Get the number of active subscribers for the organization.

    Useful for previewing how many codes will be generated.
    """
    return promo_service.get_subscriber_count(organization_id)


@router.post(
    '/api/v1/organizations/{organization_id}/promotions/{promotion_id}/distribute',
    response_model=DistributeResponse,
)
async def distribute_promotion(
    organization_id: str,
    promotion_id: str,
    payload: DistributeRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> DistributeResponse:
    """
    Distribute promo codes to all active subscribers.

    Generates unique codes for each subscriber and sends notifications
    based on their preferences. The promotion must be in 'active' status.

    This action cannot be undone - codes will be created for all current
    subscribers. New subscribers after distribution won't receive codes.
    """
    # Verify promotion exists and is active
    promotion = promo_service.get_promotion(promotion_id, organization_id)
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Promotion not found',
        )

    if promotion.status != PromotionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Promotion must be active to distribute codes',
        )

    return promo_service.distribute_codes(
        promotion_id=promotion_id,
        organization_id=organization_id,
        notify_email=payload.notify_email,
        notify_in_app=payload.notify_in_app,
    )


# =============================================================================
# USER ENDPOINTS (for consumers)
# =============================================================================

@router.get(
    '/api/v1/me/promo-codes',
    response_model=PromoCodeListResponse,
)
async def list_my_promo_codes(
    status_filter: Optional[PromoCodeStatus] = Query(
        None, alias='status', description='Filter by code status'
    ),
    limit: int = Query(50, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> PromoCodeListResponse:
    """
    List all promo codes received by the current user.

    Returns codes grouped by status with organization and discount details.
    Codes are ordered by creation date (newest first).
    """
    return promo_service.list_user_promo_codes(
        user_id=current_user_id,
        status=status_filter,
        limit=limit,
    )


@router.post(
    '/api/v1/me/promo-codes/{code_id}/view',
    response_model=PromoCode,
)
async def mark_code_viewed(
    code_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> PromoCode:
    """
    Mark a promo code as viewed.

    Records when the user first viewed/copied the code.
    """
    code = promo_service.mark_code_viewed(code_id, current_user_id)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Promo code not found',
        )
    return code


@router.post(
    '/api/v1/me/promo-codes/{code_id}/use',
    response_model=PromoCode,
)
async def mark_code_used(
    code_id: str,
    payload: MarkCodeUsedRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> PromoCode:
    """
    Mark a promo code as used.

    User self-reports when they've used the code on the target platform.
    """
    code = promo_service.mark_code_used(code_id, current_user_id)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Promo code not found or already used',
        )
    return code


@router.get(
    '/api/v1/promo-codes/lookup',
    response_model=PromoCode,
)
async def lookup_promo_code(
    code: str = Query(..., description='The promo code to look up'),
) -> PromoCode:
    """
    Look up a promo code by its code string.

    Public endpoint - allows checking code validity without authentication.
    """
    promo_code = promo_service.get_promo_code_by_code(code)
    if not promo_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Promo code not found',
        )
    return promo_code
