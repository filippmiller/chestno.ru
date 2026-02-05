"""
API routes for Open Trust Score Algorithm.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from app.services.trust_score import (
    get_trust_score_formula,
    calculate_organization_trust_score,
    get_organization_trust_score,
    get_trust_score_history,
    get_trust_score_leaderboard,
)
from .auth import get_current_user_id

router = APIRouter(prefix='/api/trust-score', tags=['trust-score'])
public_router = APIRouter(prefix='/api/public/trust-score', tags=['trust-score'])
org_router = APIRouter(prefix='/api/organizations', tags=['trust-score'])


# Public endpoints - transparency is the core feature
@public_router.get('/formula')
async def get_formula():
    """Get the public trust score formula documentation."""
    return get_trust_score_formula()


@public_router.get('/organization/{organization_id}')
async def get_public_trust_score(organization_id: str):
    """Get the trust score for an organization (public)."""
    score = await run_in_threadpool(get_organization_trust_score, organization_id)
    if not score:
        raise HTTPException(status_code=404, detail='Trust score not calculated yet')
    return score


@public_router.get('/organization/{organization_id}/history')
async def get_public_score_history(
    organization_id: str,
    days: int = Query(default=30, ge=1, le=365),
):
    """Get trust score history for an organization (public)."""
    history = await run_in_threadpool(get_trust_score_history, organization_id, days)
    return {'history': history}


@public_router.get('/leaderboard')
async def get_leaderboard(
    limit: int = Query(default=20, ge=1, le=100),
):
    """Get top organizations by trust score."""
    leaders = await run_in_threadpool(get_trust_score_leaderboard, limit)
    return {'leaders': leaders}


# Organization endpoints
@org_router.get('/{organization_id}/trust-score')
async def get_org_trust_score(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get detailed trust score for organization dashboard."""
    score = await run_in_threadpool(get_organization_trust_score, organization_id)
    if not score:
        raise HTTPException(status_code=404, detail='Trust score not calculated yet')
    return score


@org_router.post('/{organization_id}/trust-score/recalculate')
async def recalculate_org_trust_score(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Request trust score recalculation."""
    result = await run_in_threadpool(calculate_organization_trust_score, organization_id)
    if not result:
        raise HTTPException(status_code=404, detail='Organization not found')
    return result


@org_router.get('/{organization_id}/trust-score/history')
async def get_org_score_history(
    organization_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get trust score history for organization dashboard."""
    history = await run_in_threadpool(get_trust_score_history, organization_id, days)
    return {'history': history}
