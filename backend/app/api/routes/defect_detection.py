"""
API routes for Manufacturing Defect Early Warning System.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import Optional

from app.services.defect_detection import (
    get_complaint_topics,
    get_organization_alerts,
    update_alert_status,
    get_topic_trends,
    run_daily_detection,
)
from .auth import get_current_user_id

router = APIRouter(prefix='/api/defects', tags=['defects'])
org_router = APIRouter(prefix='/api/organizations', tags=['defects'])


class AlertStatusUpdate(BaseModel):
    status: str  # new, acknowledged, investigating, resolved, dismissed
    notes: Optional[str] = None


# Public endpoint for topics
@router.get('/topics')
async def list_complaint_topics():
    """Get all complaint topics used for classification."""
    topics = await run_in_threadpool(get_complaint_topics)
    return {'topics': topics}


# Organization endpoints
@org_router.get('/{organization_id}/defect-alerts')
async def list_org_defect_alerts(
    organization_id: str,
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get defect alerts for an organization."""
    alerts = await run_in_threadpool(
        get_organization_alerts,
        organization_id,
        status,
        limit,
    )
    return {'alerts': alerts}


@org_router.patch('/{organization_id}/defect-alerts/{alert_id}')
async def update_org_defect_alert(
    organization_id: str,
    alert_id: str,
    payload: AlertStatusUpdate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Update the status of a defect alert."""
    result = await run_in_threadpool(
        update_alert_status,
        alert_id,
        current_user_id,
        payload.status,
        payload.notes,
    )
    return result


@org_router.get('/{organization_id}/defect-trends')
async def get_org_defect_trends(
    organization_id: str,
    days: int = Query(default=30, ge=1, le=90),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get topic trend data for visualization."""
    trends = await run_in_threadpool(get_topic_trends, organization_id, days)
    return {'trends': trends}


@org_router.post('/{organization_id}/defect-detection/run')
async def trigger_defect_detection(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Manually trigger defect detection for an organization."""
    result = await run_in_threadpool(run_daily_detection, organization_id)
    return result
