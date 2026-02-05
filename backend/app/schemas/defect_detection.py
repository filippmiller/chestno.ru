"""
Defect Detection Schemas
Pydantic models for manufacturing defect early warning feature.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DefectPattern(BaseModel):
    """Schema for a detected defect pattern."""
    id: str
    organization_id: str
    product_id: Optional[str] = None
    pattern_type: str  # keyword_cluster, sentiment_spike, rating_drop
    keywords: List[str] = []
    severity: str  # low, medium, high, critical
    affected_reviews_count: int
    confidence_score: float
    first_detected_at: datetime
    last_updated_at: datetime
    status: str  # active, investigating, resolved, false_positive
    resolution_notes: Optional[str] = None

    class Config:
        from_attributes = True


class DefectAlert(BaseModel):
    """Schema for a defect alert."""
    id: str
    pattern_id: str
    organization_id: str
    title: str
    description: str
    severity: str
    keywords: List[str] = []
    sample_reviews: List[Dict[str, Any]] = []
    recommended_actions: List[str] = []
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None

    class Config:
        from_attributes = True


class DefectAnalysis(BaseModel):
    """Detailed defect analysis."""
    pattern: DefectPattern
    trend_data: List[Dict[str, Any]] = []
    affected_products: List[str] = []
    geographic_distribution: Dict[str, int] = {}
    time_distribution: Dict[str, int] = {}
    related_patterns: List[str] = []


class DefectPatternUpdate(BaseModel):
    """Schema for updating a defect pattern."""
    status: Optional[str] = None
    resolution_notes: Optional[str] = None


class DefectStats(BaseModel):
    """Statistics about defect patterns."""
    total_patterns: int
    active_patterns: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    resolved_this_month: int


class KeywordTopic(BaseModel):
    """Schema for a keyword topic cluster."""
    topic_id: str
    keywords: List[str]
    review_count: int
    avg_rating: float
    sentiment_score: float
    trend: str  # rising, stable, declining
