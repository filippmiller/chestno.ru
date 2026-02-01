"""
Retail Store Schemas.

Pydantic models for retail store registry, analytics, and store products.
"""
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


# ==================== Store Models ====================

class RetailStoreBase(BaseModel):
    """Base model for retail store."""
    name: str = Field(..., min_length=1, max_length=255)
    store_code: str = Field(..., min_length=1, max_length=50, pattern=r'^[A-Z0-9\-]+$')
    chain_name: str | None = None
    address: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1)
    region: str | None = None
    postal_code: str | None = None
    latitude: Decimal | None = Field(None, ge=-90, le=90)
    longitude: Decimal | None = Field(None, ge=-180, le=180)
    manager_name: str | None = None
    manager_email: str | None = None
    manager_phone: str | None = None


class RetailStoreCreate(RetailStoreBase):
    """Create a new retail store."""
    pass


class RetailStoreUpdate(BaseModel):
    """Update an existing retail store."""
    name: str | None = None
    chain_name: str | None = None
    address: str | None = None
    city: str | None = None
    region: str | None = None
    postal_code: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    manager_name: str | None = None
    manager_email: str | None = None
    manager_phone: str | None = None
    is_active: bool | None = None


class RetailStoreResponse(RetailStoreBase):
    """Response model for retail store."""
    id: str
    is_active: bool
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RetailStoreListResponse(BaseModel):
    """Paginated list of retail stores."""
    stores: list[RetailStoreResponse]
    total: int
    has_more: bool


# ==================== Store Product Models ====================

class StoreProductBase(BaseModel):
    """Base model for store product."""
    product_id: str
    aisle: str | None = None
    shelf_position: str | None = None
    store_price_cents: int | None = Field(None, ge=0)
    in_stock: bool = True


class StoreProductCreate(StoreProductBase):
    """Add a product to a store."""
    pass


class StoreProductUpdate(BaseModel):
    """Update store product."""
    aisle: str | None = None
    shelf_position: str | None = None
    store_price_cents: int | None = None
    in_stock: bool | None = None


class StoreProductResponse(StoreProductBase):
    """Response model for store product."""
    id: str
    store_id: str
    organization_id: str
    product_name: str | None = None
    product_brand: str | None = None
    last_stock_check: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StoreProductListResponse(BaseModel):
    """Paginated list of store products."""
    products: list[StoreProductResponse]
    total: int
    has_more: bool


# ==================== Store Scan Event Models ====================

ScanSource = Literal['shelf', 'kiosk', 'checkout', 'staff_device', 'signage']


class StoreScanEventCreate(BaseModel):
    """Create a store scan event."""
    qr_scan_event_id: str | None = None
    store_id: str | None = None
    product_id: str | None = None
    scan_source: ScanSource = 'shelf'
    store_staff_id: str | None = None


class StoreScanEventResponse(BaseModel):
    """Response model for store scan event."""
    id: str
    qr_scan_event_id: str | None
    store_id: str | None
    product_id: str | None
    organization_id: str
    scan_source: ScanSource
    store_staff_id: str | None
    scanned_at: datetime

    class Config:
        from_attributes = True


# ==================== Analytics Models ====================

class StoreAnalyticsItem(BaseModel):
    """Analytics for a single store."""
    store_id: str
    store_name: str
    store_code: str
    chain_name: str | None
    city: str
    total_scans: int
    unique_products_scanned: int
    scans_today: int
    scans_this_week: int
    scans_this_month: int
    top_source: ScanSource | None = None


class StoreAnalyticsResponse(BaseModel):
    """Aggregated store analytics."""
    stores: list[StoreAnalyticsItem]
    total_stores: int
    total_scans: int
    period_start: datetime
    period_end: datetime


class StoreDetailedAnalytics(StoreAnalyticsItem):
    """Detailed analytics for a single store."""
    scans_by_source: dict[str, int]
    scans_by_day: list[dict]
    top_products: list[dict]
    staff_performance: list[dict]
