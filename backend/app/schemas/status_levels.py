from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# ============================================================
# STATUS LEVEL SCHEMAS
# ============================================================

class StatusLevelBase(BaseModel):
    """Base schema for status levels"""
    level: Literal['A', 'B', 'C']
    is_active: bool
    can_use_badge: bool
    granted_at: datetime
    valid_until: Optional[datetime] = None
    last_verified_at: Optional[datetime] = None


class StatusLevel(StatusLevelBase):
    """Full status level record"""
    id: str
    organization_id: str
    granted_by: Optional[str] = None
    subscription_id: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class OrganizationStatus(BaseModel):
    """Current status for an organization"""
    organization_id: str
    current_level: Literal['0', 'A', 'B', 'C']
    active_levels: list[StatusLevel]
    level_c_progress: Optional['LevelCProgress'] = None
    can_manage: bool = False  # True if user is org member/admin


class LevelCProgress(BaseModel):
    """Progress toward level C eligibility"""
    meets_criteria: bool
    has_active_b: bool
    review_count: int
    review_count_needed: int
    response_rate: float
    response_rate_needed: float
    avg_response_hours: float
    avg_response_hours_max: float
    public_cases: int
    public_cases_needed: int
    error: Optional[str] = None


class LevelCEligibility(BaseModel):
    """Eligibility check result for level C"""
    organization_id: str
    meets_criteria: bool
    criteria: LevelCProgress
    timestamp: datetime


# ============================================================
# GRANT/REVOKE SCHEMAS
# ============================================================

class GrantStatusLevelRequest(BaseModel):
    """Request to grant a status level"""
    organization_id: str
    level: Literal['A', 'B', 'C']
    valid_until: Optional[datetime] = None
    subscription_id: Optional[str] = None
    notes: Optional[str] = None


class RevokeStatusLevelRequest(BaseModel):
    """Request to revoke a status level"""
    organization_id: str
    level: Literal['A', 'B', 'C']
    reason: Optional[str] = None


# ============================================================
# HISTORY SCHEMAS
# ============================================================

class StatusHistoryEntry(BaseModel):
    """Single history entry"""
    id: str
    organization_id: str
    level: str
    action: Literal['granted', 'renewed', 'suspended', 'revoked', 'degraded', 'auto_granted']
    reason: Optional[str] = None
    performed_by: Optional[str] = None
    metadata: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime


# ============================================================
# UPGRADE REQUEST SCHEMAS
# ============================================================

class UpgradeRequest(BaseModel):
    """Status upgrade request"""
    id: str
    organization_id: str
    target_level: Literal['B', 'C']
    status: Literal['pending', 'approved', 'rejected', 'cancelled']
    message: Optional[str] = None
    evidence_urls: Optional[list[str]] = None
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    requested_by: str
    reviewed_by: Optional[str] = None
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    metadata: Optional[dict] = None


class CreateUpgradeRequest(BaseModel):
    """Create a new upgrade request"""
    organization_id: str
    target_level: Literal['B', 'C']
    message: Optional[str] = None
    evidence_urls: Optional[list[str]] = None
