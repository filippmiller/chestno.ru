"""
Trust Score Schemas
Pydantic models for open trust score algorithm feature.
"""
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class TrustSignal(BaseModel):
    """Schema for a trust score signal."""
    id: str
    code: str
    name_ru: str
    name_en: str
    description_ru: Optional[str] = None
    description_en: Optional[str] = None
    weight: float
    max_points: int
    formula_description: Optional[str] = None
    display_order: int
    is_active: bool

    class Config:
        from_attributes = True


class SignalScore(BaseModel):
    """Individual signal score breakdown."""
    raw: float
    weight: float
    weighted: Optional[float] = None
    details: Optional[Dict[str, Any]] = None


class OrganizationTrustScore(BaseModel):
    """Schema for organization trust score."""
    id: str
    organization_id: str
    overall_score: int
    score_grade: Optional[str] = None  # A, B, C, D, F
    signal_scores: Dict[str, SignalScore] = {}
    review_rating_score: Optional[float] = None
    review_count_score: Optional[float] = None
    response_rate_score: Optional[float] = None
    challenge_resolution_score: Optional[float] = None
    supply_chain_docs_score: Optional[float] = None
    platform_tenure_score: Optional[float] = None
    content_freshness_score: Optional[float] = None
    verification_level_score: Optional[float] = None
    last_calculated_at: datetime

    class Config:
        from_attributes = True


class TrustScoreHistory(BaseModel):
    """Historical trust score record."""
    id: str
    organization_id: str
    total_score: float
    signal_scores: Dict[str, Any] = {}
    recorded_at: date

    class Config:
        from_attributes = True


class TrustScoreTrend(BaseModel):
    """Trust score trend data."""
    dates: List[date]
    scores: List[float]
    change_percent: Optional[float] = None
    trend_direction: str  # up, down, stable


class TrustScoreBreakdown(BaseModel):
    """Detailed trust score breakdown for transparency."""
    organization_id: str
    overall_score: int
    grade: str
    signals: List[TrustSignal]
    signal_scores: Dict[str, SignalScore]
    calculation_formula: str
    last_updated: datetime
