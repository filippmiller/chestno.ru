"""Schemas for verified business response system."""

from datetime import datetime, date
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field


# ============================================
# Enums
# ============================================

class VerificationMethod(str, Enum):
    DOCUMENT = "document"
    DOMAIN = "domain"
    PHONE = "phone"
    INN_CHECK = "inn_check"
    MANUAL = "manual"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    DOCUMENTS_REQUIRED = "documents_required"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class DocumentType(str, Enum):
    REGISTRATION_CERTIFICATE = "registration_certificate"
    INN_CERTIFICATE = "inn_certificate"
    DIRECTOR_PASSPORT = "director_passport"
    POWER_OF_ATTORNEY = "power_of_attorney"
    BANK_STATEMENT = "bank_statement"
    UTILITY_BILL = "utility_bill"
    OTHER = "other"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TemplateCategory(str, Enum):
    POSITIVE_REVIEW = "positive_review"
    NEUTRAL_REVIEW = "neutral_review"
    NEGATIVE_REVIEW = "negative_review"
    QUALITY_ISSUE = "quality_issue"
    DELIVERY_ISSUE = "delivery_issue"
    SERVICE_ISSUE = "service_issue"
    GENERAL = "general"


class ResponseStatus(str, Enum):
    PENDING = "pending"
    RESPONDED = "responded"
    FOLLOW_UP_NEEDED = "follow_up_needed"
    RESOLVED = "resolved"


class BadgeLevel(str, Enum):
    NONE = "none"
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


class VerificationLevel(str, Enum):
    UNVERIFIED = "unverified"
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"


class SatisfactionCategory(str, Enum):
    RESOLVED_ISSUE = "resolved_issue"
    APPRECIATED_RESPONSE = "appreciated_response"
    UNPROFESSIONAL = "unprofessional"
    DID_NOT_ADDRESS_ISSUE = "did_not_address_issue"
    OTHER = "other"


# ============================================
# Business Verification Schemas
# ============================================

class VerificationRequestCreate(BaseModel):
    """Create a business verification request."""
    verification_method: VerificationMethod
    verification_data: dict[str, Any] = Field(default_factory=dict)


class VerificationDocumentUpload(BaseModel):
    """Upload a verification document."""
    document_type: DocumentType
    file_url: str
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None


class VerificationDocumentResponse(BaseModel):
    """Verification document response."""
    id: str
    request_id: str
    document_type: DocumentType
    file_url: str
    file_name: str
    file_size: Optional[int]
    mime_type: Optional[str]
    status: DocumentStatus
    review_notes: Optional[str]
    uploaded_at: datetime
    reviewed_at: Optional[datetime]


class VerificationRequestResponse(BaseModel):
    """Verification request response."""
    id: str
    organization_id: str
    requested_by: str
    verification_method: VerificationMethod
    status: VerificationStatus
    verification_data: dict[str, Any]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime]
    documents: list[VerificationDocumentResponse] = Field(default_factory=list)


class VerificationReview(BaseModel):
    """Admin review of verification request."""
    status: VerificationStatus
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


# ============================================
# Response Templates Schemas
# ============================================

class ResponseTemplateCreate(BaseModel):
    """Create a response template."""
    name: str
    description: Optional[str] = None
    category: TemplateCategory
    template_text: str
    variables: list[str] = Field(default_factory=list)
    is_default: bool = False


class ResponseTemplateUpdate(BaseModel):
    """Update a response template."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[TemplateCategory] = None
    template_text: Optional[str] = None
    variables: Optional[list[str]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class ResponseTemplateResponse(BaseModel):
    """Response template response."""
    id: str
    organization_id: str
    name: str
    description: Optional[str]
    category: TemplateCategory
    template_text: str
    variables: list[str]
    usage_count: int
    last_used_at: Optional[datetime]
    is_default: bool
    is_active: bool
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime


class ResponseTemplatesResponse(BaseModel):
    """List of response templates."""
    items: list[ResponseTemplateResponse]
    total: int


# ============================================
# Response Management Schemas
# ============================================

class ReviewResponseCreate(BaseModel):
    """Create/update review response."""
    response: str
    template_id: Optional[str] = None


class ResponseHistoryItem(BaseModel):
    """Response history entry."""
    id: str
    review_id: str
    response_text: str
    response_by: str
    responder_name: Optional[str] = None
    template_id: Optional[str]
    template_name: Optional[str] = None
    template_modified: bool
    version: int
    is_current: bool
    edit_reason: Optional[str]
    created_at: datetime


class ResponseHistoryResponse(BaseModel):
    """Response history list."""
    items: list[ResponseHistoryItem]
    total: int


# ============================================
# Metrics Schemas
# ============================================

class DailyMetrics(BaseModel):
    """Daily response metrics."""
    metric_date: date
    total_reviews: int
    reviews_responded: int
    reviews_pending: int
    response_rate: float = Field(description="Percentage of reviews responded")
    avg_response_time_hours: Optional[float]
    min_response_time_hours: Optional[float]
    max_response_time_hours: Optional[float]
    median_response_time_hours: Optional[float]
    positive_reviews: int
    neutral_reviews: int
    negative_reviews: int
    positive_responded: int
    neutral_responded: int
    negative_responded: int


class MetricsSummary(BaseModel):
    """Summary metrics for dashboard."""
    period_days: int
    total_reviews: int
    total_responded: int
    response_rate: float
    avg_response_time_hours: Optional[float]
    pending_reviews: int
    oldest_pending_hours: Optional[float]
    reviews_by_rating: dict[int, int]
    response_rate_by_rating: dict[int, float]


class MetricsResponse(BaseModel):
    """Response metrics data."""
    summary: MetricsSummary
    daily: list[DailyMetrics]


# ============================================
# Accountability Schemas
# ============================================

class AccountabilityScore(BaseModel):
    """Monthly accountability score."""
    score_month: date
    response_rate_score: int
    response_time_score: int
    response_quality_score: int
    overall_score: int
    badge_level: BadgeLevel
    total_reviews: int
    total_responded: int
    avg_response_hours: Optional[float]
    calculated_at: datetime


class AccountabilityScoresResponse(BaseModel):
    """List of accountability scores."""
    items: list[AccountabilityScore]
    current_badge: BadgeLevel
    trend: str = Field(description="improving, stable, or declining")


class PublicAccountability(BaseModel):
    """Public accountability display."""
    organization_id: str
    organization_name: str
    verification_level: VerificationLevel
    badge_level: BadgeLevel
    overall_score: int
    response_rate: float
    avg_response_time_hours: Optional[float]
    total_reviews_last_month: int
    last_updated: datetime


# ============================================
# Response Satisfaction Schemas
# ============================================

class SatisfactionRatingCreate(BaseModel):
    """Rate a business response."""
    is_helpful: bool
    feedback_text: Optional[str] = None
    feedback_category: Optional[SatisfactionCategory] = None


class SatisfactionRatingResponse(BaseModel):
    """Satisfaction rating response."""
    id: str
    review_id: str
    user_id: str
    is_helpful: bool
    feedback_text: Optional[str]
    feedback_category: Optional[SatisfactionCategory]
    created_at: datetime


class SatisfactionSummary(BaseModel):
    """Summary of satisfaction ratings."""
    total_ratings: int
    helpful_count: int
    unhelpful_count: int
    helpful_percentage: float
    category_breakdown: dict[str, int]


# ============================================
# Dashboard Schemas
# ============================================

class PendingReviewItem(BaseModel):
    """Pending review awaiting response."""
    id: str
    rating: int
    title: Optional[str]
    body: str
    author_name: Optional[str]
    product_name: Optional[str]
    created_at: datetime
    hours_pending: float
    is_urgent: bool = Field(description="True if pending > 48 hours")


class ResponseDashboard(BaseModel):
    """Business response dashboard data."""
    verification_level: VerificationLevel
    current_badge: BadgeLevel
    metrics_summary: MetricsSummary
    pending_reviews: list[PendingReviewItem]
    suggested_templates: list[ResponseTemplateResponse]
    accountability_trend: str
