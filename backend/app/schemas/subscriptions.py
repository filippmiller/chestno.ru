from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SubscriptionPlan(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    price_monthly_cents: Optional[int] = 0
    price_yearly_cents: Optional[int] = None
    currency: str = 'RUB'
    max_products: Optional[int] = None
    max_qr_codes: Optional[int] = None
    max_members: Optional[int] = None
    analytics_level: str
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SubscriptionPlanCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    price_monthly_cents: Optional[int] = 0
    price_yearly_cents: Optional[int] = None
    currency: str = 'RUB'
    max_products: Optional[int] = None
    max_qr_codes: Optional[int] = None
    max_members: Optional[int] = None
    analytics_level: str = 'basic'
    is_default: bool = False
    is_active: bool = True


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_monthly_cents: Optional[int] = None
    price_yearly_cents: Optional[int] = None
    currency: Optional[str] = None
    max_products: Optional[int] = None
    max_qr_codes: Optional[int] = None
    max_members: Optional[int] = None
    analytics_level: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class OrganizationSubscription(BaseModel):
    id: str
    organization_id: str
    plan_id: str
    status: str
    current_period_start: datetime
    current_period_end: Optional[datetime] = None
    cancel_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    plan: SubscriptionPlan


class OrganizationUsage(BaseModel):
    products_used: int
    qr_codes_used: int
    members_used: int


class OrganizationSubscriptionSummary(BaseModel):
    plan: SubscriptionPlan
    usage: OrganizationUsage

