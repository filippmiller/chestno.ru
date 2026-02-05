"""
API routes for Review Intelligence Dashboard.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from app.services.review_intelligence import (
    generate_intelligence_report,
    get_latest_report,
    get_keyword_trends,
    get_category_benchmarks,
    generate_improvement_suggestions,
    get_active_suggestions,
    dismiss_suggestion,
    get_sentiment_timeline,
)
from .auth import get_current_user_id

router = APIRouter(prefix='/api/intelligence', tags=['intelligence'])
org_router = APIRouter(prefix='/api/organizations', tags=['intelligence'])


# Organization endpoints
@org_router.get('/{organization_id}/intelligence/report')
async def get_org_intelligence_report(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get the latest intelligence report for an organization."""
    report = await run_in_threadpool(get_latest_report, organization_id)
    if not report:
        raise HTTPException(status_code=404, detail='No report available. Generate one first.')
    return report


@org_router.post('/{organization_id}/intelligence/report/generate')
async def generate_org_intelligence_report(
    organization_id: str,
    days: int = Query(default=30, ge=7, le=90),
    current_user_id: str = Depends(get_current_user_id),
):
    """Generate a new intelligence report for an organization."""
    report = await run_in_threadpool(generate_intelligence_report, organization_id, days)
    return report


@org_router.get('/{organization_id}/intelligence/keywords/{keyword}/trends')
async def get_org_keyword_trends(
    organization_id: str,
    keyword: str,
    periods: int = Query(default=6, ge=1, le=12),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get trend data for a specific keyword."""
    trends = await run_in_threadpool(get_keyword_trends, organization_id, keyword, periods)
    return {'keyword': keyword, 'trends': trends}


@org_router.get('/{organization_id}/intelligence/suggestions')
async def get_org_suggestions(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Get active improvement suggestions."""
    suggestions = await run_in_threadpool(get_active_suggestions, organization_id)
    return {'suggestions': suggestions}


@org_router.post('/{organization_id}/intelligence/suggestions/generate')
async def generate_org_suggestions(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Generate new improvement suggestions."""
    suggestions = await run_in_threadpool(generate_improvement_suggestions, organization_id)
    return {'suggestions': suggestions}


@org_router.post('/{organization_id}/intelligence/suggestions/{suggestion_id}/dismiss')
async def dismiss_org_suggestion(
    organization_id: str,
    suggestion_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Dismiss a suggestion."""
    dismissed = await run_in_threadpool(dismiss_suggestion, suggestion_id, current_user_id)
    return {'dismissed': dismissed}


@org_router.get('/{organization_id}/intelligence/sentiment')
async def get_org_sentiment_timeline(
    organization_id: str,
    days: int = Query(default=30, ge=7, le=90),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get daily sentiment breakdown."""
    timeline = await run_in_threadpool(get_sentiment_timeline, organization_id, days)
    return {'timeline': timeline}


# Category benchmarks (public)
@router.get('/benchmarks/{category}')
async def get_benchmarks(category: str):
    """Get industry benchmarks for a category."""
    benchmarks = await run_in_threadpool(get_category_benchmarks, category)
    if not benchmarks:
        raise HTTPException(status_code=404, detail='No benchmarks available for this category')
    return benchmarks
