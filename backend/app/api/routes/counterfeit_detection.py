"""
API routes for AI Photo Counterfeit Detection.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List, Optional

from app.services.counterfeit_detection import (
    upload_reference_image,
    list_reference_images,
    delete_reference_image,
    check_authenticity,
    submit_counterfeit_report,
    get_counterfeit_stats,
)
from .auth import get_current_user_id

router = APIRouter(prefix='/api/counterfeit', tags=['counterfeit'])
org_router = APIRouter(prefix='/api/organizations', tags=['counterfeit'])
public_router = APIRouter(prefix='/api/public/counterfeit', tags=['counterfeit'])


class ReferenceImageUpload(BaseModel):
    image_url: str
    image_type: str = 'packaging'
    description: Optional[str] = None


class AuthenticityCheck(BaseModel):
    product_id: str
    submitted_image_url: str
    location_country: Optional[str] = None
    location_city: Optional[str] = None


class CounterfeitReport(BaseModel):
    check_id: str
    reporter_email: Optional[str] = None
    purchase_location: Optional[str] = None
    purchase_date: Optional[str] = None
    report_notes: Optional[str] = None


# Public consumer endpoints
@public_router.post('/check')
async def check_product_authenticity(
    payload: AuthenticityCheck,
    current_user_id: Optional[str] = None,
):
    """Check if a submitted image matches the product's reference images."""
    result = await check_authenticity(
        payload.product_id,
        payload.submitted_image_url,
        current_user_id,
        payload.location_country,
        payload.location_city,
    )
    return result


@public_router.post('/report')
async def report_counterfeit(
    payload: CounterfeitReport,
    current_user_id: Optional[str] = None,
):
    """Submit a counterfeit report for follow-up investigation."""
    result = await run_in_threadpool(
        submit_counterfeit_report,
        payload.check_id,
        payload.reporter_email,
        current_user_id,
        payload.purchase_location,
        payload.purchase_date,
        payload.report_notes,
    )
    return result


@public_router.get('/product/{product_id}/references')
async def get_product_reference_images(product_id: str):
    """Get reference images for a product (public)."""
    images = await run_in_threadpool(list_reference_images, product_id)
    return {'images': images}


# Organization endpoints
@org_router.post('/{organization_id}/products/{product_id}/reference-images')
async def upload_product_reference_image(
    organization_id: str,
    product_id: str,
    payload: ReferenceImageUpload,
    current_user_id: str = Depends(get_current_user_id),
):
    """Upload a reference image for counterfeit detection."""
    result = await run_in_threadpool(
        upload_reference_image,
        product_id,
        organization_id,
        current_user_id,
        payload.image_url,
        payload.image_type,
        payload.description,
    )
    return result


@org_router.get('/{organization_id}/products/{product_id}/reference-images')
async def list_product_reference_images(
    organization_id: str,
    product_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """List reference images for a product."""
    images = await run_in_threadpool(list_reference_images, product_id)
    return {'images': images}


@org_router.delete('/{organization_id}/reference-images/{image_id}')
async def delete_product_reference_image(
    organization_id: str,
    image_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Delete a reference image."""
    deleted = await run_in_threadpool(delete_reference_image, image_id, organization_id)
    return {'deleted': deleted}


@org_router.get('/{organization_id}/counterfeit/stats')
async def get_org_counterfeit_stats(
    organization_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get counterfeit detection statistics for an organization."""
    stats = await run_in_threadpool(get_counterfeit_stats, organization_id, days)
    return stats
