"""
Product Portfolio Schemas
Pydantic models for personal product portfolio and recall alerts feature.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class PortfolioProductAdd(BaseModel):
    """Schema for adding a product to portfolio."""
    product_id: str
    purchase_date: Optional[datetime] = None
    purchase_location: Optional[str] = None
    notes: Optional[str] = None
    batch_number: Optional[str] = None


class PortfolioProductUpdate(BaseModel):
    """Schema for updating a portfolio product."""
    purchase_date: Optional[datetime] = None
    purchase_location: Optional[str] = None
    notes: Optional[str] = None
    batch_number: Optional[str] = None
    is_favorite: Optional[bool] = None


class PortfolioProduct(BaseModel):
    """Schema for a product in user's portfolio."""
    id: str
    user_id: str
    product_id: str
    product_name: Optional[str] = None
    organization_name: Optional[str] = None
    product_image_url: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_location: Optional[str] = None
    notes: Optional[str] = None
    batch_number: Optional[str] = None
    is_favorite: bool = False
    added_at: datetime
    has_active_recall: bool = False

    class Config:
        from_attributes = True


class RecallAlertCreate(BaseModel):
    """Schema for creating a recall alert."""
    product_id: str
    title: str
    description: str
    severity: str  # low, medium, high, critical
    affected_batches: Optional[List[str]] = None
    affected_date_from: Optional[datetime] = None
    affected_date_to: Optional[datetime] = None
    action_required: Optional[str] = None


class RecallAlert(BaseModel):
    """Schema for a recall alert."""
    id: str
    product_id: str
    organization_id: str
    title: str
    description: str
    severity: str
    affected_batches: Optional[List[str]] = None
    affected_date_from: Optional[datetime] = None
    affected_date_to: Optional[datetime] = None
    action_required: Optional[str] = None
    is_active: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecallNotification(BaseModel):
    """Schema for a recall notification to user."""
    id: str
    user_id: str
    recall_id: str
    portfolio_product_id: str
    is_read: bool = False
    is_acknowledged: bool = False
    notified_at: datetime
    acknowledged_at: Optional[datetime] = None
    recall: Optional[RecallAlert] = None

    class Config:
        from_attributes = True


class PortfolioStats(BaseModel):
    """Statistics about user's portfolio."""
    total_products: int
    favorite_count: int
    active_recalls: int
    categories: Dict[str, int] = {}
