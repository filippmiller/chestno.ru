"""Pydantic schemas for Competitor Benchmarking feature."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MetricComparison(BaseModel):
    """Single metric comparison between organization and category."""
    value: float | None = Field(description="Значение метрики организации")
    category_avg: float | None = Field(description="Среднее значение по категории")
    percentile: int | None = Field(
        ge=0, le=100,
        description="Процентиль организации (0-100, где 100 = лучший в категории)"
    )
    diff_percent: float | None = Field(
        description="Разница в процентах относительно среднего по категории"
    )


class TrendData(BaseModel):
    """Trend comparison between current and previous period."""
    current_period_value: float | None = Field(description="Значение за текущий период")
    previous_period_value: float | None = Field(description="Значение за предыдущий период")
    change_percent: float | None = Field(description="Изменение в процентах")
    trend: str = Field(description="Направление тренда: up, down, stable")


class BenchmarkMetrics(BaseModel):
    """All benchmark metrics for an organization."""
    average_rating: MetricComparison = Field(description="Средний рейтинг")
    total_reviews: MetricComparison = Field(description="Общее количество отзывов")
    response_rate: MetricComparison = Field(description="Процент отзывов с ответом")
    avg_response_time_hours: MetricComparison | None = Field(
        default=None,
        description="Среднее время ответа в часах (если есть данные)"
    )


class BenchmarkTrends(BaseModel):
    """Trend data for benchmark metrics."""
    rating_trend: TrendData = Field(description="Тренд среднего рейтинга")
    reviews_trend: TrendData = Field(description="Тренд количества отзывов")
    response_rate_trend: TrendData = Field(description="Тренд процента ответов")


class CategoryInfo(BaseModel):
    """Information about the category being benchmarked against."""
    name: str | None = Field(description="Название категории")
    total_organizations: int = Field(description="Количество организаций в категории")
    total_reviews: int = Field(description="Общее количество отзывов в категории")


class BenchmarkResponse(BaseModel):
    """Complete benchmark response for an organization."""
    organization_id: str
    organization_name: str
    category: CategoryInfo
    metrics: BenchmarkMetrics
    trends: BenchmarkTrends
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    period_days: int = Field(default=30, description="Период анализа трендов в днях")
