"""
Content Moderation Schemas
Pydantic models for moderation queue, reports, and appeals.
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# =============================================================================
# AI MODERATION
# =============================================================================

class AIFlagResult(BaseModel):
    """Result from AI content analysis."""
    flags: list[dict] = Field(default_factory=list)
    confidence_score: float = 0.0
    priority_boost: int = 0
    recommended_action: Optional[str] = None


# =============================================================================
# MODERATION QUEUE
# =============================================================================

class ModerationQueueFilters(BaseModel):
    """Filters for listing moderation queue."""
    status: Optional[str] = 'pending'
    content_type: Optional[str] = None
    source: Optional[str] = None
    assigned_to: Optional[str] = None
    min_priority: Optional[int] = None
    escalation_level: Optional[int] = None
    order_by: str = 'priority'  # priority, created_at, updated_at
    limit: int = 50
    offset: int = 0


class ModerationQueueItem(BaseModel):
    """A single item in the moderation queue."""
    id: str
    content_type: str
    content_id: str
    content_snapshot: Optional[dict] = None
    priority_score: int
    priority_reason: list[str] = Field(default_factory=list)
    status: str
    source: str
    ai_flags: dict = Field(default_factory=dict)
    ai_confidence_score: Optional[float] = None
    ai_recommended_action: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    escalation_level: int = 0
    escalated_by: Optional[str] = None
    escalated_at: Optional[datetime] = None
    escalation_reason: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_action: Optional[str] = None
    resolution_notes: Optional[str] = None
    report_count: int = 0
    created_at: datetime
    updated_at: datetime


class ModerationDecision(BaseModel):
    """Decision made on a moderation queue item."""
    action: str  # approve, reject, escalate, request_changes, delete
    reason: Optional[str] = None
    notes: Optional[str] = None
    violation_type: Optional[str] = None
    guideline_code: Optional[str] = None
    severity: Optional[str] = None  # low, medium, high, critical


class ModerationStats(BaseModel):
    """Statistics for the moderation queue."""
    pending_count: int = 0
    in_review_count: int = 0
    escalated_count: int = 0
    appealed_count: int = 0
    resolved_today: int = 0
    avg_resolution_hours: float = 0.0
    pending_by_type: dict = Field(default_factory=dict)


# =============================================================================
# CONTENT REPORTS
# =============================================================================

class ContentReportCreate(BaseModel):
    """Request to create a content report."""
    content_type: str  # organization, product, review, post, media, user
    content_id: str
    reason: str  # fake_business, misleading_claims, counterfeit_cert, etc.
    reason_details: Optional[str] = None
    evidence_urls: Optional[list[str]] = None


class ContentReport(BaseModel):
    """A content report submitted by a user."""
    id: str
    content_type: str
    content_id: str
    reporter_user_id: Optional[str] = None
    reason: str
    reason_details: Optional[str] = None
    evidence_urls: list[str] = Field(default_factory=list)
    status: str = 'new'
    linked_queue_item: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime


# =============================================================================
# APPEALS
# =============================================================================

class ModerationAppealCreate(BaseModel):
    """Request to create an appeal."""
    content_type: str
    content_id: str
    organization_id: Optional[str] = None
    appeal_reason: str
    supporting_evidence: Optional[list[str]] = None
    additional_context: Optional[str] = None


class ModerationAppeal(BaseModel):
    """An appeal for a moderation decision."""
    id: str
    content_type: str
    content_id: str
    appellant_user_id: str
    organization_id: Optional[str] = None
    original_queue_item_id: Optional[str] = None
    appeal_reason: str
    supporting_evidence: list[str] = Field(default_factory=list)
    additional_context: Optional[str] = None
    status: str = 'pending'
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_decision: Optional[str] = None
    review_notes: Optional[str] = None
    new_queue_item_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# =============================================================================
# MODERATOR NOTES
# =============================================================================

class ModeratorNoteCreate(BaseModel):
    """Request to add a moderator note."""
    subject_type: str  # organization, user, product, review, report, appeal
    subject_id: str
    note_type: str = 'observation'  # observation, warning, context, follow_up, evidence
    content: str
    attachments: Optional[dict] = None


class ModeratorNote(BaseModel):
    """A note from a moderator."""
    id: str
    subject_type: str
    subject_id: str
    note_type: str
    content: str
    attachments: Optional[dict] = None
    created_by: str
    author_name: Optional[str] = None
    created_at: datetime


# =============================================================================
# VIOLATION HISTORY
# =============================================================================

class ViolationRecord(BaseModel):
    """A record of a violation."""
    id: str
    violator_type: str  # user, organization
    violator_id: str
    violation_type: str
    guideline_code: Optional[str] = None
    guideline_title: Optional[str] = None
    severity: str
    content_type: Optional[str] = None
    content_id: Optional[str] = None
    queue_item_id: Optional[str] = None
    consequence: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


# =============================================================================
# QUALITY GUIDELINES
# =============================================================================

class ModerationGuideline(BaseModel):
    """A moderation guideline."""
    id: str
    code: str
    category: str
    title_ru: str
    title_en: Optional[str] = None
    description_ru: str
    description_en: Optional[str] = None
    examples: Optional[dict] = None
    applies_to: list[str] = Field(default_factory=list)
    severity: str
    auto_flag: bool = False
    auto_reject: bool = False
    is_active: bool = True
