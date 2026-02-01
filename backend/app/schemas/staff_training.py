"""
Staff Training Schemas.

Pydantic models for retail staff management, training, and certification.
"""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ==================== Training Module Models ====================

ContentType = Literal['video', 'interactive', 'quiz']
ProgressStatus = Literal['not_started', 'in_progress', 'completed', 'failed']


class TrainingModuleBase(BaseModel):
    """Base model for training module."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    duration_minutes: int = Field(15, ge=1, le=240)
    content_type: ContentType
    content_url: str | None = None
    content_data: dict[str, Any] | None = None
    prerequisite_module_id: str | None = None
    passing_score: int = Field(80, ge=0, le=100)


class TrainingModuleCreate(TrainingModuleBase):
    """Create a new training module."""
    pass


class TrainingModuleResponse(TrainingModuleBase):
    """Response model for training module."""
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # For authenticated users
    user_progress: 'TrainingProgressResponse | None' = None

    class Config:
        from_attributes = True


class TrainingModuleListResponse(BaseModel):
    """List of training modules."""
    modules: list[TrainingModuleResponse]
    total: int


# ==================== Training Progress Models ====================

class TrainingProgressUpdate(BaseModel):
    """Update training progress."""
    module_id: str
    progress_percent: int = Field(..., ge=0, le=100)
    status: ProgressStatus | None = None


class TrainingProgressResponse(BaseModel):
    """Response model for training progress."""
    id: str
    staff_id: str
    module_id: str
    status: ProgressStatus
    progress_percent: int
    quiz_attempts: int
    best_score: int | None
    started_at: datetime | None
    completed_at: datetime | None

    class Config:
        from_attributes = True


class TrainingProgressListResponse(BaseModel):
    """List of training progress entries."""
    progress: list[TrainingProgressResponse]
    total_modules: int
    completed_modules: int
    overall_progress_percent: int


# ==================== Quiz Models ====================

class QuizAnswer(BaseModel):
    """Single quiz answer."""
    question_id: str
    selected_option: str | int


class QuizSubmitRequest(BaseModel):
    """Submit quiz answers."""
    module_id: str
    answers: list[QuizAnswer]


class QuizResult(BaseModel):
    """Quiz result."""
    module_id: str
    score: int
    passing_score: int
    passed: bool
    correct_answers: int
    total_questions: int
    attempt_number: int
    feedback: list[dict] | None = None


# ==================== Staff Models ====================

class RetailStaffBase(BaseModel):
    """Base model for retail staff."""
    store_id: str
    employee_id: str | None = None
    department: str | None = None
    position: str | None = None


class RetailStaffCreate(RetailStaffBase):
    """Create retail staff record."""
    user_id: str


class RetailStaffResponse(RetailStaffBase):
    """Response model for retail staff."""
    id: str
    user_id: str
    user_name: str | None = None
    user_email: str | None = None
    is_certified: bool
    certified_at: datetime | None
    certification_expires_at: datetime | None
    customer_assists: int
    scans_assisted: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RetailStaffListResponse(BaseModel):
    """List of retail staff."""
    staff: list[RetailStaffResponse]
    total: int
    certified_count: int


# ==================== Certification Models ====================

class CertificationStatus(BaseModel):
    """Staff certification status."""
    is_certified: bool
    certified_at: datetime | None = None
    expires_at: datetime | None = None
    days_until_expiry: int | None = None
    modules_completed: int
    total_modules: int
    can_take_certification: bool
    next_step: str | None = None


class CertificationBadge(BaseModel):
    """Certification badge data."""
    staff_id: str
    staff_name: str
    store_name: str
    certified_at: datetime
    expires_at: datetime
    badge_url: str
    verification_code: str


# ==================== Assisted Scan Models ====================

AssistanceType = Literal['helped_scan', 'explained_badge', 'answered_question']


class AssistedScanCreate(BaseModel):
    """Log an assisted scan."""
    scan_event_id: str
    assistance_type: AssistanceType


class AssistedScanResponse(BaseModel):
    """Response for assisted scan."""
    id: str
    staff_id: str
    scan_event_id: str
    assistance_type: AssistanceType
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Leaderboard Models ====================

class StaffLeaderboardEntry(BaseModel):
    """Single entry in staff leaderboard."""
    rank: int
    staff_id: str
    staff_name: str
    department: str | None
    customer_assists: int
    scans_assisted: int
    is_certified: bool
    score: int


class StaffLeaderboardResponse(BaseModel):
    """Staff engagement leaderboard."""
    entries: list[StaffLeaderboardEntry]
    period: str
    store_id: str
    store_name: str
