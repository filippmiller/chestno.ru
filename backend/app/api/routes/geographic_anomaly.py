"""
Geographic Anomaly Detection API Routes

REST API endpoints for gray market detection - detecting products
appearing outside authorized distribution regions.
"""

from datetime import datetime
from typing import Optional, Literal
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.core.session_deps import get_current_user_id_from_session

logger = logging.getLogger(__name__)

# Router for authenticated organization routes
router = APIRouter(prefix='/api/organizations', tags=['geo-anomaly'])

# Router for stats/alerts endpoints
alerts_router = APIRouter(prefix='/api/geo-anomaly', tags=['geo-anomaly'])


# ==================== Pydantic Models ====================

class AuthorizedRegionCreate(BaseModel):
    """Request model for creating an authorized region"""
    region_code: str = Field(..., description="ISO 3166-2 region code (e.g., 'RU-MOW')")
    region_name: str = Field(..., description="Human-readable region name")
    product_id: Optional[str] = Field(None, description="Product UUID (null for org-wide)")
    is_exclusive: bool = Field(False, description="If true, ONLY this region is authorized")
    center_lat: Optional[float] = Field(None, description="Center latitude")
    center_lng: Optional[float] = Field(None, description="Center longitude")
    radius_km: int = Field(100, ge=1, le=5000, description="Radius in km")
    notes: Optional[str] = Field(None, description="Internal notes")


class AuthorizedRegionUpdate(BaseModel):
    """Request model for updating an authorized region"""
    region_name: Optional[str] = None
    is_exclusive: Optional[bool] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[int] = Field(None, ge=1, le=5000)
    notes: Optional[str] = None


class AuthorizedRegion(BaseModel):
    """Response model for authorized region"""
    id: str
    organization_id: str
    product_id: Optional[str]
    region_code: str
    region_name: str
    is_exclusive: bool
    center_lat: Optional[float]
    center_lng: Optional[float]
    radius_km: int
    notes: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime


class AnomalyStatusUpdate(BaseModel):
    """Request model for updating anomaly status"""
    status: Literal['new', 'under_review', 'confirmed', 'false_positive', 'resolved']
    investigation_notes: Optional[str] = None
    resolution: Optional[str] = None


class GeographicAnomaly(BaseModel):
    """Response model for geographic anomaly"""
    id: str
    organization_id: str
    product_id: Optional[str]
    product_name: Optional[str]
    product_sku: Optional[str]
    qr_code_id: Optional[str]
    scan_event_id: Optional[str]
    expected_region: str
    actual_region: str
    actual_region_name: Optional[str]
    scan_lat: Optional[float]
    scan_lng: Optional[float]
    distance_from_authorized_km: Optional[int]
    severity: str
    anomaly_type: str
    status: str
    investigated_at: Optional[datetime]
    investigated_by: Optional[str]
    investigation_notes: Optional[str]
    resolution: Optional[str]
    scan_metadata: Optional[dict]
    created_at: datetime
    updated_at: datetime


class AnomalyStatistics(BaseModel):
    """Response model for anomaly statistics"""
    period_days: int
    total_anomalies: int
    by_status: dict
    by_severity: dict
    top_anomaly_regions: list


class AnomalyTrendItem(BaseModel):
    """Single item in anomaly trend"""
    date: str
    total: int
    critical: int
    high: int
    medium: int
    low: int


class CheckLocationRequest(BaseModel):
    """Request model for checking a scan location"""
    product_id: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class CheckLocationResponse(BaseModel):
    """Response model for location check"""
    is_authorized: bool
    nearest_region_code: str
    nearest_region_name: str
    distance_km: int
    severity: str


# ==================== Authorized Regions Routes ====================

@router.get('/{organization_id}/geo-anomaly/regions', response_model=list[AuthorizedRegion])
async def get_authorized_regions(
    organization_id: str,
    product_id: Optional[str] = Query(None, description="Filter by product"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[AuthorizedRegion]:
    """
    Get authorized distribution regions for an organization.

    Filters:
    - product_id: Get regions for a specific product (includes org-wide)

    Returns list of authorized regions.
    """
    from app.services.geographic_anomaly import get_authorized_regions

    regions = await run_in_threadpool(
        get_authorized_regions,
        organization_id,
        product_id
    )
    return regions


@router.post('/{organization_id}/geo-anomaly/regions', response_model=AuthorizedRegion, status_code=201)
async def add_authorized_region(
    organization_id: str,
    payload: AuthorizedRegionCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AuthorizedRegion:
    """
    Add an authorized distribution region.

    Creates a new authorized region for the organization or a specific product.
    Scans outside these regions will trigger anomaly alerts.

    Requires: manager+ role
    """
    from app.services.geographic_anomaly import add_authorized_region

    return await run_in_threadpool(
        add_authorized_region,
        organization_id,
        current_user_id,
        payload.region_code,
        payload.region_name,
        payload.product_id,
        payload.is_exclusive,
        payload.center_lat,
        payload.center_lng,
        payload.radius_km,
        payload.notes
    )


@router.put('/{organization_id}/geo-anomaly/regions/{region_id}', response_model=AuthorizedRegion)
async def update_authorized_region(
    organization_id: str,
    region_id: str,
    payload: AuthorizedRegionUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AuthorizedRegion:
    """
    Update an authorized region.

    Requires: manager+ role
    """
    from app.services.geographic_anomaly import update_authorized_region

    return await run_in_threadpool(
        update_authorized_region,
        region_id,
        organization_id,
        current_user_id,
        payload.region_name,
        payload.is_exclusive,
        payload.center_lat,
        payload.center_lng,
        payload.radius_km,
        payload.notes
    )


@router.delete('/{organization_id}/geo-anomaly/regions/{region_id}', status_code=204)
async def delete_authorized_region(
    organization_id: str,
    region_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Delete an authorized region.

    Requires: manager+ role
    """
    from app.services.geographic_anomaly import delete_authorized_region

    deleted = await run_in_threadpool(
        delete_authorized_region,
        region_id,
        organization_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Region not found")
    return None


@router.post('/{organization_id}/geo-anomaly/check-location', response_model=CheckLocationResponse)
async def check_location(
    organization_id: str,
    payload: CheckLocationRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> CheckLocationResponse:
    """
    Check if a location is within authorized regions.

    Useful for testing region configuration before deployment.

    Returns:
    - is_authorized: Whether the location is authorized
    - nearest_region_code: Nearest authorized region code
    - nearest_region_name: Nearest authorized region name
    - distance_km: Distance to nearest authorized region
    - severity: Would-be severity if this were an anomaly
    """
    from app.services.geographic_anomaly import check_scan_location

    return await run_in_threadpool(
        check_scan_location,
        organization_id,
        payload.product_id,
        payload.latitude,
        payload.longitude
    )


# ==================== Anomaly Alert Routes ====================

@router.get('/{organization_id}/geo-anomaly/alerts')
async def get_anomalies(
    organization_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    product_id: Optional[str] = Query(None, description="Filter by product"),
    days: int = Query(30, ge=1, le=365, description="Look back period"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Get geographic anomaly alerts for an organization.

    Filters:
    - status: new, under_review, confirmed, false_positive, resolved
    - severity: low, medium, high, critical
    - product_id: Filter by specific product
    - days: Look back period (default 30)

    Returns paginated list of anomalies.
    """
    from app.services.geographic_anomaly import get_anomalies

    anomalies, total = await run_in_threadpool(
        get_anomalies,
        organization_id,
        status,
        severity,
        product_id,
        days,
        page,
        per_page
    )

    total_pages = (total + per_page - 1) // per_page

    return {
        "anomalies": anomalies,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages
        }
    }


@router.get('/{organization_id}/geo-anomaly/alerts/{anomaly_id}', response_model=GeographicAnomaly)
async def get_anomaly(
    organization_id: str,
    anomaly_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> GeographicAnomaly:
    """
    Get a single anomaly by ID.
    """
    from app.services.geographic_anomaly import get_anomaly_by_id

    anomaly = await run_in_threadpool(
        get_anomaly_by_id,
        anomaly_id,
        organization_id
    )
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return anomaly


@router.put('/{organization_id}/geo-anomaly/alerts/{anomaly_id}/investigate', response_model=GeographicAnomaly)
async def investigate_anomaly(
    organization_id: str,
    anomaly_id: str,
    payload: AnomalyStatusUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> GeographicAnomaly:
    """
    Update anomaly status and add investigation notes.

    Status transitions:
    - new -> under_review, confirmed, false_positive
    - under_review -> confirmed, false_positive, resolved
    - confirmed -> resolved
    - false_positive -> (no further transitions)
    - resolved -> (no further transitions)

    Requires: manager+ role
    """
    from app.services.geographic_anomaly import update_anomaly_status

    return await run_in_threadpool(
        update_anomaly_status,
        anomaly_id,
        organization_id,
        current_user_id,
        payload.status,
        payload.investigation_notes,
        payload.resolution
    )


# ==================== Statistics Routes ====================

@router.get('/{organization_id}/geo-anomaly/stats', response_model=AnomalyStatistics)
async def get_statistics(
    organization_id: str,
    days: int = Query(30, ge=1, le=365, description="Look back period"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> AnomalyStatistics:
    """
    Get anomaly statistics for an organization.

    Returns:
    - Total anomaly count
    - Breakdown by status
    - Breakdown by severity
    - Top anomaly regions
    """
    from app.services.geographic_anomaly import get_anomaly_statistics

    return await run_in_threadpool(
        get_anomaly_statistics,
        organization_id,
        days
    )


@router.get('/{organization_id}/geo-anomaly/trend', response_model=list[AnomalyTrendItem])
async def get_trend(
    organization_id: str,
    days: int = Query(30, ge=1, le=365, description="Look back period"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[AnomalyTrendItem]:
    """
    Get daily anomaly trend data for charts.

    Returns list of daily counts by severity level.
    """
    from app.services.geographic_anomaly import get_anomaly_trend

    return await run_in_threadpool(
        get_anomaly_trend,
        organization_id,
        days
    )
