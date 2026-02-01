"""
API routes for public product pages and product journey.
"""
from fastapi import APIRouter, Depends, Request

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.product_journey import (
    JourneyStep,
    JourneyStepCreate,
    JourneyStepUpdate,
    ProductJourney,
    PublicProductPage,
)
from app.services import product_journey as journey_service


public_router = APIRouter(prefix='/api/v1/products', tags=['product-pages'])
journey_router = APIRouter(prefix='/api/v1/products', tags=['product-journey'])


# =====================
# Public Product Pages
# =====================

@public_router.get('/by-slug/{slug}', response_model=PublicProductPage)
async def get_product_by_slug(slug: str) -> PublicProductPage:
    """
    Get public product page data by slug.

    Returns full product information including organization details,
    journey summary, and engagement stats. No authentication required.
    """
    return journey_service.get_public_product_page(slug)


# =====================
# Product Journey
# =====================

@public_router.get('/{product_id}/journey', response_model=ProductJourney)
async def get_product_journey(product_id: str) -> ProductJourney:
    """
    Get the complete journey/supply chain for a product.

    Returns all journey steps showing the product's lifecycle
    from origin to retail. No authentication required.
    """
    return journey_service.get_product_journey(product_id)


@journey_router.post('/{product_id}/journey', response_model=JourneyStep)
async def create_journey_step(
    request: Request,
    product_id: str,
    payload: JourneyStepCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> JourneyStep:
    """
    Add a new journey step to a product.

    Only producers (organization members with editor+ role) can add steps.
    Steps represent stages in the product's supply chain or lifecycle.
    """
    return journey_service.create_journey_step(product_id, current_user_id, payload)


@journey_router.put('/{product_id}/journey/{step_id}', response_model=JourneyStep)
async def update_journey_step(
    request: Request,
    product_id: str,
    step_id: str,
    payload: JourneyStepUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> JourneyStep:
    """
    Update an existing journey step.

    Only producers can update journey steps.
    """
    return journey_service.update_journey_step(product_id, step_id, current_user_id, payload)


@journey_router.delete('/{product_id}/journey/{step_id}')
async def delete_journey_step(
    request: Request,
    product_id: str,
    step_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Delete a journey step.

    Only producers can delete journey steps.
    """
    journey_service.delete_journey_step(product_id, step_id, current_user_id)
    return {'success': True}
