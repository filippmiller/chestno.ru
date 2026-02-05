"""
Review Intelligence Schemas
Pydantic models for review intelligence dashboard feature.
"""
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class KeywordAnalysis(BaseModel):
    """Schema for keyword analysis."""
    keyword: str
    count: int
    sentiment_score: float  # -1 to 1
    avg_rating: float
    trend: str  # rising, stable, declining
    sample_reviews: List[str] = []


class SentimentData(BaseModel):
    """Schema for sentiment data point."""
    date: date
    positive_count: int
    neutral_count: int
    negative_count: int
    avg_sentiment: float


class TopicCluster(BaseModel):
    """Schema for a topic cluster."""
    topic_id: str
    name: str
    keywords: List[str]
    review_count: int
    avg_rating: float
    sentiment_score: float
    trend: str


class ReviewIntelligenceReport(BaseModel):
    """Schema for review intelligence report."""
    organization_id: str
    product_id: Optional[str] = None
    period_start: date
    period_end: date

    # Summary stats
    total_reviews: int
    avg_rating: float
    rating_change: float
    sentiment_score: float
    sentiment_change: float

    # Breakdown
    positive_keywords: List[KeywordAnalysis] = []
    negative_keywords: List[KeywordAnalysis] = []
    topic_clusters: List[TopicCluster] = []
    sentiment_timeline: List[SentimentData] = []

    # Insights
    improvement_suggestions: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []

    generated_at: datetime

    class Config:
        from_attributes = True


class CompetitorComparison(BaseModel):
    """Schema for competitor comparison data."""
    competitor_id: str
    competitor_name: str
    avg_rating: float
    review_count: int
    sentiment_score: float
    top_keywords: List[str] = []


class IntelligenceDashboard(BaseModel):
    """Schema for the full intelligence dashboard."""
    organization_id: str

    # Current period
    current_report: ReviewIntelligenceReport

    # Trends
    rating_trend: List[Dict[str, Any]] = []
    volume_trend: List[Dict[str, Any]] = []

    # Alerts
    negative_spikes: List[Dict[str, Any]] = []
    emerging_issues: List[str] = []

    # Competitor data (if available)
    competitors: List[CompetitorComparison] = []

    last_updated: datetime


class SentimentTimelineRequest(BaseModel):
    """Request schema for sentiment timeline."""
    organization_id: str
    product_id: Optional[str] = None
    days: int = 30


class ImprovementSuggestion(BaseModel):
    """Schema for an improvement suggestion."""
    category: str  # product, service, communication, etc.
    suggestion: str
    based_on_keywords: List[str] = []
    affected_reviews_count: int
    potential_rating_impact: float
    priority: str  # high, medium, low
