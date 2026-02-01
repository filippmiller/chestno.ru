"""
Certification & Compliance Hub Schemas.

Defines Pydantic models for the certification management system.
Supports GOST, organic, halal, kosher, eco-labels, and other certifications.
"""
from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class CertificationCategory(str, Enum):
    """Categories of certifications."""
    QUALITY_STANDARD = "quality_standard"   # GOST, ISO, etc.
    ORGANIC = "organic"                     # Organic certifications
    RELIGIOUS = "religious"                 # Halal, Kosher
    ECO_LABEL = "eco_label"                 # Eco-friendly labels
    SAFETY = "safety"                       # Sanitary, safety certs
    ORIGIN = "origin"                       # PDO, PGI, geographic
    OTHER = "other"


class VerificationStatus(str, Enum):
    """Verification status of a certification."""
    PENDING = "pending"             # Awaiting review
    VERIFIED = "verified"           # Confirmed by chestno.ru
    REJECTED = "rejected"           # Failed verification
    EXPIRED = "expired"             # Past expiry date
    REVOKED = "revoked"             # Revoked by issuing body
    AUTO_VERIFIED = "auto_verified" # Verified via API


class VerificationRequestType(str, Enum):
    """Types of consumer verification requests."""
    AUTHENTICITY_CHECK = "authenticity_check"
    DISPUTE = "dispute"
    RENEWAL_INQUIRY = "renewal_inquiry"


class VerificationRequestStatus(str, Enum):
    """Status of verification requests."""
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


# =============================================================================
# Certification Types (Reference Data)
# =============================================================================

class CertificationTypeBase(BaseModel):
    """Base certification type info."""
    code: str
    name_ru: str
    name_en: str
    description_ru: Optional[str] = None
    description_en: Optional[str] = None
    category: CertificationCategory
    issuing_body_name_ru: Optional[str] = None
    issuing_body_name_en: Optional[str] = None
    issuing_body_website: Optional[str] = None
    issuing_body_country: str = "RU"
    logo_url: Optional[str] = None
    badge_color: str = "#4F46E5"


class CertificationType(CertificationTypeBase):
    """Full certification type with metadata."""
    id: str
    requires_document: bool = True
    auto_verify_enabled: bool = False
    is_active: bool = True
    display_order: int = 100
    created_at: datetime
    updated_at: datetime


class CertificationTypePublic(BaseModel):
    """Public view of certification type."""
    id: str
    code: str
    name_ru: str
    name_en: str
    category: CertificationCategory
    logo_url: Optional[str] = None
    badge_color: str


# =============================================================================
# Producer Certifications
# =============================================================================

class ProducerCertificationCreate(BaseModel):
    """Request to add a new certification."""
    certification_type_id: str
    certificate_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    scope_description: Optional[str] = None
    product_ids: Optional[list[str]] = None
    is_public: bool = True
    display_on_products: bool = True


class ProducerCertificationUpdate(BaseModel):
    """Request to update a certification."""
    certificate_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    scope_description: Optional[str] = None
    product_ids: Optional[list[str]] = None
    is_public: Optional[bool] = None
    display_on_products: Optional[bool] = None


class ProducerCertification(BaseModel):
    """Full producer certification record."""
    id: str
    organization_id: str
    certification_type_id: str
    certification_type: Optional[CertificationTypePublic] = None

    # Certificate details
    certificate_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    scope_description: Optional[str] = None
    product_ids: Optional[list[str]] = None

    # Document
    document_url: Optional[str] = None
    document_original_name: Optional[str] = None
    document_uploaded_at: Optional[datetime] = None

    # Verification
    verification_status: VerificationStatus = VerificationStatus.PENDING
    verification_notes: Optional[str] = None
    verified_at: Optional[datetime] = None

    # Visibility
    is_public: bool = True
    display_on_products: bool = True

    # Computed
    is_valid: bool = False  # True if verified and not expired
    days_until_expiry: Optional[int] = None

    created_at: datetime
    updated_at: datetime


class ProducerCertificationPublic(BaseModel):
    """Public view of a certification (for consumers)."""
    id: str
    certification_type: CertificationTypePublic
    certificate_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    scope_description: Optional[str] = None
    verification_status: VerificationStatus
    is_valid: bool


# =============================================================================
# Document Upload
# =============================================================================

class DocumentUploadResponse(BaseModel):
    """Response after uploading a certification document."""
    document_url: str
    original_name: str
    uploaded_at: datetime
    file_size_bytes: int


class DocumentVerificationResult(BaseModel):
    """Result of automated document verification."""
    is_valid: bool
    confidence_score: float  # 0.0 to 1.0
    extracted_data: dict = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


# =============================================================================
# Verification
# =============================================================================

class VerifyExternalRequest(BaseModel):
    """Request to verify against external certification body."""
    certification_id: str
    certificate_number: str


class VerifyExternalResponse(BaseModel):
    """Response from external verification."""
    is_verified: bool
    verification_source: str  # e.g., "rosstandart_api"
    external_id: Optional[str] = None
    verification_date: datetime
    valid_until: Optional[date] = None
    details: dict = Field(default_factory=dict)
    raw_response: Optional[dict] = None


class ManualVerificationRequest(BaseModel):
    """Admin request to manually verify/reject a certification."""
    certification_id: str
    action: str  # 'verify', 'reject', 'revoke'
    notes: Optional[str] = None


class VerificationLogEntry(BaseModel):
    """Single verification log entry."""
    id: str
    certification_id: str
    action: str
    previous_status: Optional[str] = None
    new_status: str
    notes: Optional[str] = None
    performed_by: Optional[str] = None
    performed_at: datetime


# =============================================================================
# Expiry Alerts
# =============================================================================

class ExpiryAlert(BaseModel):
    """Certification expiry alert."""
    id: str
    certification_id: str
    organization_id: str
    certification_type_name: str
    certificate_number: Optional[str] = None
    expiry_date: date
    alert_days_before: int
    scheduled_at: datetime
    sent_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None


class ExpiryAlertSettings(BaseModel):
    """Settings for expiry alerts."""
    alert_days: list[int] = [90, 60, 30, 14, 7, 1]
    email_enabled: bool = True
    push_enabled: bool = True


class AcknowledgeAlertRequest(BaseModel):
    """Request to acknowledge an expiry alert."""
    alert_id: str


# =============================================================================
# Consumer Verification Portal
# =============================================================================

class ConsumerVerificationRequest(BaseModel):
    """Consumer request to verify a certification."""
    certification_id: str
    request_type: VerificationRequestType
    reason: Optional[str] = None


class ConsumerVerificationResponse(BaseModel):
    """Response to consumer verification request."""
    request_id: str
    status: VerificationRequestStatus
    certification: ProducerCertificationPublic
    message: str


class CertificationSearchFilters(BaseModel):
    """Filters for searching products by certification."""
    certification_types: Optional[list[str]] = None  # cert type codes
    categories: Optional[list[CertificationCategory]] = None
    verified_only: bool = True
    include_expired: bool = False


class CertificationSearchResult(BaseModel):
    """Single search result."""
    product_id: str
    product_name: str
    organization_id: str
    organization_name: str
    certifications: list[ProducerCertificationPublic]


class CertificationSearchResponse(BaseModel):
    """Paginated search results."""
    results: list[CertificationSearchResult]
    total: int
    page: int
    page_size: int
    has_more: bool


# =============================================================================
# Organization Certification Summary
# =============================================================================

class OrganizationCertificationSummary(BaseModel):
    """Summary of organization's certifications."""
    organization_id: str
    total_certifications: int
    verified_count: int
    pending_count: int
    expiring_soon_count: int  # Within 30 days
    expired_count: int
    certifications_by_category: dict[str, int]
    certifications: list[ProducerCertificationPublic]


# =============================================================================
# Admin Dashboard
# =============================================================================

class CertificationAdminStats(BaseModel):
    """Admin dashboard statistics."""
    total_certifications: int
    pending_verification: int
    verified_today: int
    expiring_this_week: int
    open_disputes: int
    by_status: dict[str, int]
    by_category: dict[str, int]
    recent_submissions: list[ProducerCertification]


class PendingVerificationItem(BaseModel):
    """Item in pending verification queue."""
    certification: ProducerCertification
    organization_name: str
    submitted_at: datetime
    days_pending: int
    document_available: bool


class PendingVerificationQueue(BaseModel):
    """Queue of certifications awaiting verification."""
    items: list[PendingVerificationItem]
    total: int
    page: int
    page_size: int


# =============================================================================
# Status Display Configuration
# =============================================================================

VERIFICATION_STATUS_CONFIG = {
    VerificationStatus.PENDING: {
        "label_ru": "На проверке",
        "label_en": "Pending",
        "color": "text-yellow-700",
        "bg_color": "bg-yellow-100",
        "icon": "clock",
    },
    VerificationStatus.VERIFIED: {
        "label_ru": "Подтверждён",
        "label_en": "Verified",
        "color": "text-green-700",
        "bg_color": "bg-green-100",
        "icon": "check-circle",
    },
    VerificationStatus.AUTO_VERIFIED: {
        "label_ru": "Автоподтверждён",
        "label_en": "Auto-verified",
        "color": "text-green-700",
        "bg_color": "bg-green-100",
        "icon": "check-badge",
    },
    VerificationStatus.REJECTED: {
        "label_ru": "Отклонён",
        "label_en": "Rejected",
        "color": "text-red-700",
        "bg_color": "bg-red-100",
        "icon": "x-circle",
    },
    VerificationStatus.EXPIRED: {
        "label_ru": "Истёк",
        "label_en": "Expired",
        "color": "text-gray-700",
        "bg_color": "bg-gray-100",
        "icon": "exclamation-circle",
    },
    VerificationStatus.REVOKED: {
        "label_ru": "Отозван",
        "label_en": "Revoked",
        "color": "text-red-700",
        "bg_color": "bg-red-100",
        "icon": "ban",
    },
}

CATEGORY_DISPLAY_CONFIG = {
    CertificationCategory.QUALITY_STANDARD: {
        "label_ru": "Стандарт качества",
        "label_en": "Quality Standard",
        "icon": "badge-check",
    },
    CertificationCategory.ORGANIC: {
        "label_ru": "Органик",
        "label_en": "Organic",
        "icon": "leaf",
    },
    CertificationCategory.RELIGIOUS: {
        "label_ru": "Религиозный",
        "label_en": "Religious",
        "icon": "star",
    },
    CertificationCategory.ECO_LABEL: {
        "label_ru": "Эко-маркировка",
        "label_en": "Eco Label",
        "icon": "globe",
    },
    CertificationCategory.SAFETY: {
        "label_ru": "Безопасность",
        "label_en": "Safety",
        "icon": "shield-check",
    },
    CertificationCategory.ORIGIN: {
        "label_ru": "Происхождение",
        "label_en": "Origin",
        "icon": "map-pin",
    },
    CertificationCategory.OTHER: {
        "label_ru": "Другое",
        "label_en": "Other",
        "icon": "document-text",
    },
}
