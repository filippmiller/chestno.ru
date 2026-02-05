"""
Verification Challenges Schemas
Pydantic models for consumer verification challenges feature.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class VerificationChallengeCreate(BaseModel):
    """Schema for creating a new verification challenge."""
    organization_id: str
    product_id: Optional[str] = None
    question: str = Field(..., min_length=10, max_length=1000)
    evidence_urls: Optional[List[str]] = None


class VerificationChallengeUpdate(BaseModel):
    """Schema for updating a challenge (business response)."""
    response: str = Field(..., min_length=10, max_length=2000)
    evidence_urls: Optional[List[str]] = None


class VerificationChallenge(BaseModel):
    """Schema for a verification challenge."""
    id: str
    organization_id: str
    product_id: Optional[str] = None
    challenger_user_id: Optional[str] = None
    question: str
    evidence_urls: Optional[List[str]] = None
    status: str  # pending, responded, expired
    response: Optional[str] = None
    response_evidence_urls: Optional[List[str]] = None
    responded_by: Optional[str] = None
    responded_at: Optional[datetime] = None
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ChallengeModerationAction(BaseModel):
    """Schema for moderating a challenge."""
    action: str  # approve, reject
    reason: Optional[str] = None


class ChallengeStats(BaseModel):
    """Statistics about challenges for an organization."""
    total_challenges: int
    pending_count: int
    responded_count: int
    expired_count: int
    avg_response_time_hours: Optional[float] = None
