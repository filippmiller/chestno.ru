"""
API routes for Personal Product Portfolio and Recall Alerts.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List, Optional

from app.services.product_portfolio import (
    add_to_portfolio,
    get_portfolio,
    update_portfolio_item,
    remove_from_portfolio,
    create_recall,
    list_active_recalls,
    check_recalls_for_user,
    send_recall_alerts_for_user,
    acknowledge_recall_alert,
    get_user_recall_alerts,
    create_category,
    get_user_categories,
    add_item_to_category,
)
from .auth import get_current_user_id

router = APIRouter(prefix='/api/portfolio', tags=['portfolio'])
admin_router = APIRouter(prefix='/api/admin/recalls', tags=['recalls'])
public_router = APIRouter(prefix='/api/public/recalls', tags=['recalls'])


# Request models
class PortfolioItemUpdate(BaseModel):
    is_favorite: Optional[bool] = None
    user_notes: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_location: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None


class RecallCreate(BaseModel):
    title: str
    description: str
    severity: str = 'warning'
    product_id: Optional[str] = None
    organization_id: Optional[str] = None
    recall_reason: Optional[str] = None
    affected_product_names: Optional[List[str]] = None
    affected_batch_numbers: Optional[List[str]] = None
    source: str = 'admin'
    source_url: Optional[str] = None


# Consumer portfolio endpoints
@router.post('/products/{product_id}')
async def add_product_to_portfolio(
    product_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Add a product to user's portfolio."""
    result = await run_in_threadpool(add_to_portfolio, current_user_id, product_id)
    return result


@router.get('')
async def get_my_portfolio(
    favorites_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get user's product portfolio."""
    items, total = await run_in_threadpool(
        get_portfolio,
        current_user_id,
        favorites_only,
        limit,
        offset,
    )
    return {'items': items, 'total': total}


@router.patch('/items/{item_id}')
async def update_portfolio_item_endpoint(
    item_id: str,
    payload: PortfolioItemUpdate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Update a portfolio item."""
    result = await run_in_threadpool(
        update_portfolio_item,
        current_user_id,
        item_id,
        payload.is_favorite,
        payload.user_notes,
        payload.purchase_date,
        payload.purchase_location,
    )
    return result


@router.delete('/items/{item_id}')
async def remove_portfolio_item(
    item_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Remove a product from portfolio."""
    deleted = await run_in_threadpool(remove_from_portfolio, current_user_id, item_id)
    return {'deleted': deleted}


# Portfolio categories
@router.get('/categories')
async def get_my_categories(
    current_user_id: str = Depends(get_current_user_id),
):
    """Get user's portfolio categories."""
    categories = await run_in_threadpool(get_user_categories, current_user_id)
    return {'categories': categories}


@router.post('/categories')
async def create_portfolio_category(
    payload: CategoryCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Create a portfolio category."""
    result = await run_in_threadpool(
        create_category,
        current_user_id,
        payload.name,
        payload.color,
        payload.icon,
    )
    return result


@router.post('/items/{item_id}/categories/{category_id}')
async def add_to_portfolio_category(
    item_id: str,
    category_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Add a portfolio item to a category."""
    await run_in_threadpool(add_item_to_category, current_user_id, item_id, category_id)
    return {'success': True}


# Recall alerts for consumers
@router.get('/recalls')
async def get_my_recall_alerts(
    unacknowledged_only: bool = Query(default=True),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get user's recall alerts."""
    alerts = await run_in_threadpool(get_user_recall_alerts, current_user_id, unacknowledged_only)
    return {'alerts': alerts}


@router.get('/recalls/check')
async def check_my_recalls(
    current_user_id: str = Depends(get_current_user_id),
):
    """Check if any portfolio products have active recalls."""
    affected = await run_in_threadpool(check_recalls_for_user, current_user_id)
    return {'affected_products': affected, 'count': len(affected)}


@router.post('/recalls/{alert_id}/acknowledge')
async def acknowledge_recall(
    alert_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """Acknowledge a recall alert."""
    result = await run_in_threadpool(acknowledge_recall_alert, current_user_id, alert_id)
    return result


# Public recalls endpoint
@public_router.get('')
async def list_public_recalls(
    limit: int = Query(default=20, ge=1, le=100),
):
    """List all active product recalls."""
    recalls = await run_in_threadpool(list_active_recalls, limit)
    return {'recalls': recalls}


# Admin endpoints for recall management
@admin_router.post('')
async def create_admin_recall(
    payload: RecallCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """Create a new product recall (admin only)."""
    result = await run_in_threadpool(
        create_recall,
        payload.title,
        payload.description,
        payload.severity,
        payload.product_id,
        payload.organization_id,
        payload.recall_reason,
        payload.affected_product_names,
        payload.affected_batch_numbers,
        payload.source,
        payload.source_url,
        current_user_id,
    )
    return result
