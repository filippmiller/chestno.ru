"""
Warranty Management Schemas
Pydantic models for warranty registration, claims, and policies.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ============================================================
# WARRANTY POLICY SCHEMAS
# ============================================================

class WarrantyPolicyBase(BaseModel):
    """Base schema for warranty policies"""
    product_category: str
    duration_months: int = Field(ge=1, le=120)
    coverage_description: str
    terms: Optional[str] = None
    is_transferable: bool = False
    requires_registration: bool = True
    registration_deadline_days: Optional[int] = None


class WarrantyPolicyCreate(WarrantyPolicyBase):
    """Create a new warranty policy"""
    pass


class WarrantyPolicyUpdate(BaseModel):
    """Update an existing warranty policy"""
    product_category: Optional[str] = None
    duration_months: Optional[int] = Field(default=None, ge=1, le=120)
    coverage_description: Optional[str] = None
    terms: Optional[str] = None
    is_transferable: Optional[bool] = None
    requires_registration: Optional[bool] = None
    registration_deadline_days: Optional[int] = None
    is_active: Optional[bool] = None


class WarrantyPolicy(WarrantyPolicyBase):
    """Full warranty policy record"""
    id: str
    organization_id: str
    is_active: bool
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# WARRANTY REGISTRATION SCHEMAS
# ============================================================

class WarrantyRegistrationBase(BaseModel):
    """Base schema for warranty registrations"""
    product_id: str
    serial_number: Optional[str] = None
    purchase_date: date
    purchase_location: Optional[str] = None
    purchase_proof_url: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None


class WarrantyRegistrationCreate(WarrantyRegistrationBase):
    """Create warranty registration via QR scan"""
    qr_code_id: Optional[str] = None


class WarrantyRegistrationUpdate(BaseModel):
    """Update warranty registration"""
    serial_number: Optional[str] = None
    purchase_location: Optional[str] = None
    purchase_proof_url: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None


class WarrantyRegistration(WarrantyRegistrationBase):
    """Full warranty registration record"""
    id: str
    user_id: str
    qr_code_id: Optional[str] = None
    policy_id: Optional[str] = None
    warranty_start: date
    warranty_end: date
    status: Literal['pending', 'active', 'expired', 'voided', 'transferred']
    registered_at: datetime
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    # Computed fields (added in service)
    days_remaining: Optional[int] = None
    is_valid: Optional[bool] = None


class WarrantyRegistrationWithProduct(WarrantyRegistration):
    """Registration with product details"""
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    organization_name: Optional[str] = None
    organization_id: Optional[str] = None


# ============================================================
# WARRANTY CLAIM SCHEMAS
# ============================================================

class WarrantyClaimBase(BaseModel):
    """Base schema for warranty claims"""
    claim_type: Literal['repair', 'replacement', 'refund', 'inspection', 'other']
    description: str = Field(min_length=10, max_length=2000)
    photos: Optional[list[str]] = None


class WarrantyClaimCreate(WarrantyClaimBase):
    """Submit a new warranty claim"""
    pass


class WarrantyClaimUpdate(BaseModel):
    """Update claim status (business side)"""
    status: Optional[Literal['submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'resolved', 'closed']] = None
    priority: Optional[Literal['low', 'normal', 'high', 'urgent']] = None
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolution_type: Optional[Literal['repaired', 'replaced', 'refunded', 'no_fault_found', 'out_of_warranty', 'user_error', 'other']] = None


class WarrantyClaim(WarrantyClaimBase):
    """Full warranty claim record"""
    id: str
    registration_id: str
    status: Literal['submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'resolved', 'closed']
    priority: Literal['low', 'normal', 'high', 'urgent']
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolution_type: Optional[Literal['repaired', 'replaced', 'refunded', 'no_fault_found', 'out_of_warranty', 'user_error', 'other']] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    metadata: Optional[dict] = None


class WarrantyClaimWithDetails(WarrantyClaim):
    """Claim with registration and product details"""
    product_name: Optional[str] = None
    product_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    warranty_end: Optional[date] = None


class WarrantyClaimHistoryEntry(BaseModel):
    """Claim status change history entry"""
    id: str
    claim_id: str
    performed_by: Optional[str] = None
    old_status: Optional[str] = None
    new_status: str
    comment: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime


# ============================================================
# RESPONSE SCHEMAS
# ============================================================

class WarrantyRegistrationsResponse(BaseModel):
    """Paginated list of warranty registrations"""
    items: list[WarrantyRegistrationWithProduct]
    total: int


class WarrantyClaimsResponse(BaseModel):
    """Paginated list of warranty claims"""
    items: list[WarrantyClaimWithDetails]
    total: int


class WarrantyValidityResponse(BaseModel):
    """Warranty validity check result"""
    registration_id: str
    is_valid: bool
    status: str
    warranty_end: date
    days_remaining: int
    message: str


class WarrantyStatsResponse(BaseModel):
    """Warranty statistics for organization"""
    total_registrations: int
    active_registrations: int
    expiring_soon: int  # Within 30 days
    total_claims: int
    pending_claims: int
    resolved_claims: int
    avg_resolution_days: Optional[float] = None


# ============================================================
# CLAIM TYPE AND STATUS LABELS (Russian)
# ============================================================

CLAIM_TYPE_LABELS = {
    'repair': 'Ремонт',
    'replacement': 'Замена',
    'refund': 'Возврат',
    'inspection': 'Диагностика',
    'other': 'Другое',
}

CLAIM_STATUS_LABELS = {
    'submitted': 'Подана',
    'under_review': 'На рассмотрении',
    'approved': 'Одобрена',
    'rejected': 'Отклонена',
    'in_progress': 'В работе',
    'resolved': 'Решена',
    'closed': 'Закрыта',
}

WARRANTY_STATUS_LABELS = {
    'pending': 'Ожидает подтверждения',
    'active': 'Активна',
    'expired': 'Истекла',
    'voided': 'Аннулирована',
    'transferred': 'Передана',
}

RESOLUTION_TYPE_LABELS = {
    'repaired': 'Отремонтировано',
    'replaced': 'Заменено',
    'refunded': 'Возврат средств',
    'no_fault_found': 'Неисправность не обнаружена',
    'out_of_warranty': 'Вне гарантии',
    'user_error': 'Ошибка пользователя',
    'other': 'Другое',
}
