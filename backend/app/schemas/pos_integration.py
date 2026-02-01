"""
POS Integration Schemas.

Pydantic models for POS integration and digital receipts.
"""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ==================== POS Integration Models ====================

POSProvider = Literal['1c', 'atol', 'evotor', 'custom']


class POSIntegrationBase(BaseModel):
    """Base model for POS integration."""
    pos_provider: POSProvider
    api_key: str | None = None
    webhook_url: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    print_badges: bool = True
    digital_receipts: bool = False
    review_prompt: bool = True


class POSIntegrationCreate(POSIntegrationBase):
    """Create POS integration."""
    store_id: str


class POSIntegrationResponse(POSIntegrationBase):
    """Response model for POS integration."""
    id: str
    store_id: str
    is_active: bool
    last_sync_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== Webhook Models ====================

class POSLineItem(BaseModel):
    """Line item from POS transaction."""
    barcode: str | None = None
    product_name: str
    quantity: int = 1
    unit_price_cents: int | None = None


class POSWebhookRequest(BaseModel):
    """POS webhook payload."""
    external_transaction_id: str
    store_id: str
    items: list[POSLineItem]
    customer_phone: str | None = None
    customer_email: str | None = None
    purchased_at: datetime | None = None
    # HMAC signature for verification
    signature: str | None = None


class POSWebhookResponse(BaseModel):
    """Response to POS webhook."""
    success: bool
    transaction_id: str | None = None
    receipt_token: str | None = None
    verified_items_count: int = 0
    error: str | None = None


# ==================== Transaction Models ====================

class PurchaseTransactionResponse(BaseModel):
    """Response model for purchase transaction."""
    id: str
    store_id: str
    external_transaction_id: str | None
    customer_phone: str | None
    customer_email: str | None
    customer_user_id: str | None
    loyalty_points_earned: int
    receipt_sent: bool
    review_requested: bool
    purchased_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseLineItemResponse(BaseModel):
    """Response model for purchase line item."""
    id: str
    transaction_id: str
    product_id: str | None
    barcode: str | None
    product_name: str
    status_level: str | None
    is_verified: bool
    quantity: int
    unit_price_cents: int | None

    class Config:
        from_attributes = True


# ==================== Receipt Models ====================

DeliveryMethod = Literal['sms', 'email', 'qr']


class ReceiptItemDisplay(BaseModel):
    """Single item for receipt display."""
    name: str
    quantity: int
    price: int | None = None
    verified: bool
    status_level: str | None = None
    product_url: str | None = None


class ReceiptSummary(BaseModel):
    """Receipt summary."""
    total_items: int
    verified_items: int
    verification_percent: int
    total_amount: int | None = None


class ReceiptLoyalty(BaseModel):
    """Loyalty info for receipt."""
    points_earned: int
    total_points: int | None = None
    tier: str | None = None


class ReceiptActions(BaseModel):
    """Action URLs for receipt."""
    review_url: str
    view_all_products_url: str
    loyalty_dashboard_url: str | None = None


class DigitalReceiptResponse(BaseModel):
    """Full digital receipt for display."""
    transaction: dict
    items: list[ReceiptItemDisplay]
    summary: ReceiptSummary
    loyalty: ReceiptLoyalty | None = None
    actions: ReceiptActions
    expires_at: datetime
    viewed_at: datetime | None = None


class ReceiptTokenResponse(BaseModel):
    """Response with receipt token."""
    token: str
    receipt_url: str
    delivery_method: DeliveryMethod
    expires_at: datetime


# ==================== Review from Receipt Models ====================

class ReceiptReviewRequest(BaseModel):
    """Submit review from receipt."""
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    text: str | None = Field(None, max_length=2000)


class ReceiptReviewResponse(BaseModel):
    """Response after submitting review from receipt."""
    success: bool
    review_id: str | None = None
    points_earned: int = 0
    message: str | None = None
