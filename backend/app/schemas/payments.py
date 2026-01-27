"""
Payment-related Pydantic schemas
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# PAYMENT TRANSACTION SCHEMAS
# ============================================================

class PaymentTransaction(BaseModel):
    """Payment transaction record"""
    id: str
    organization_id: str
    subscription_id: Optional[str] = None
    payment_provider: str
    external_transaction_id: str
    amount_cents: int
    currency: str
    transaction_type: Literal[
        'trial_preauth',
        'subscription_payment',
        'one_time_fee',
        'refund',
        'upgrade_charge'
    ]
    status: Literal[
        'pending',
        'processing',
        'succeeded',
        'failed',
        'canceled',
        'refunded'
    ]
    payment_method_last4: Optional[str] = None
    payment_method_brand: Optional[str] = None
    failure_reason: Optional[str] = None
    description: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime
    succeeded_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    updated_at: datetime


class PaymentTransactionList(BaseModel):
    """List of payment transactions"""
    transactions: list[PaymentTransaction]
    total: int
    page: int
    per_page: int


# ============================================================
# CHECKOUT SCHEMAS
# ============================================================

class CheckoutTrialRequest(BaseModel):
    """Request to initiate trial with pre-auth"""
    organization_id: str = Field(..., description="Organization UUID")
    plan_id: str = Field(..., description="Subscription plan UUID")


class CheckoutSubscriptionRequest(BaseModel):
    """Request to checkout subscription payment"""
    organization_id: str = Field(..., description="Organization UUID")
    plan_id: str = Field(..., description="Subscription plan UUID")
    billing_period: Literal['monthly', 'yearly'] = Field(
        default='monthly',
        description="Billing period"
    )


class CheckoutResponse(BaseModel):
    """Response from checkout endpoints"""
    checkout_url: str = Field(..., description="URL to redirect user for payment")
    payment_id: str = Field(..., description="External payment ID")
    subscription_id: str = Field(..., description="Created subscription ID")
    amount_cents: int = Field(..., description="Amount to be charged in cents")
    currency: str = Field(default='RUB', description="Currency code")


# ============================================================
# WEBHOOK SCHEMAS
# ============================================================

class WebhookEvent(BaseModel):
    """Generic webhook event"""
    event_type: str = Field(..., description="Event type (payment.succeeded, etc)")
    object: dict = Field(..., description="Payment object from provider")


class YukassaWebhookPayload(BaseModel):
    """YooKassa webhook payload structure"""
    type: str = Field(..., description="Event type")
    event: str = Field(..., description="Event name (payment.succeeded, etc)")
    object: dict = Field(..., description="Payment object")


# ============================================================
# SUBSCRIPTION MANAGEMENT SCHEMAS
# ============================================================

class CancelSubscriptionRequest(BaseModel):
    """Request to cancel subscription"""
    reason: Optional[str] = Field(
        None,
        description="Reason for cancellation",
        max_length=500
    )
    cancel_at_period_end: bool = Field(
        default=True,
        description="Cancel at end of billing period or immediately"
    )


class ReactivateSubscriptionRequest(BaseModel):
    """Request to reactivate canceled subscription"""
    payment_method_token: Optional[str] = Field(
        None,
        description="New payment method token if updating"
    )


# ============================================================
# RETRY ATTEMPT SCHEMAS
# ============================================================

class RetryAttempt(BaseModel):
    """Subscription payment retry attempt"""
    id: str
    subscription_id: str
    attempt_number: int
    next_retry_at: datetime
    attempted_at: Optional[datetime] = None
    transaction_id: Optional[str] = None
    result: Optional[Literal['pending', 'success', 'failed', 'skipped']] = None
    failure_reason: Optional[str] = None
    created_at: datetime


# ============================================================
# PAYMENT METHOD SCHEMAS
# ============================================================

class PaymentMethodInfo(BaseModel):
    """Payment method information"""
    last4: str = Field(..., description="Last 4 digits of card")
    brand: str = Field(..., description="Card brand (Visa, Mastercard, etc)")
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None


class UpdatePaymentMethodRequest(BaseModel):
    """Request to update payment method"""
    payment_method_token: str = Field(
        ...,
        description="Payment method token from provider"
    )


# ============================================================
# WEBHOOK LOG SCHEMAS (admin only)
# ============================================================

class WebhookLog(BaseModel):
    """Webhook log entry"""
    id: str
    payment_provider: str
    event_type: str
    external_transaction_id: str
    payload: dict
    signature: Optional[str] = None
    processed: bool
    processing_error: Optional[str] = None
    retry_count: int
    received_at: datetime
    processed_at: Optional[datetime] = None
