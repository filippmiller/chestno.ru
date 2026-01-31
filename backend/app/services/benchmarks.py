"""
Benchmark calculation service for comparing organizations against category peers.

This service calculates:
- Average rating comparison
- Total reviews comparison
- Response rate (% of reviews with owner response)
- Percentile rankings
- Trend analysis (current vs previous period)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.benchmarks import (
    BenchmarkMetrics,
    BenchmarkResponse,
    BenchmarkTrends,
    CategoryInfo,
    MetricComparison,
    TrendData,
)

logger = logging.getLogger(__name__)


def _ensure_member(cur, organization_id: str, user_id: str) -> None:
    """Verify user is a member of the organization."""
    cur.execute(
        'SELECT 1 FROM organization_members WHERE organization_id = %s AND user_id = %s',
        (organization_id, user_id),
    )
    if cur.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Нет доступа к организации'
        )


def _get_organization_info(cur, organization_id: str) -> dict[str, Any]:
    """Get organization name and category."""
    cur.execute(
        '''
        SELECT o.id, o.name, COALESCE(p.category, p.tags) as category
        FROM organizations o
        LEFT JOIN organization_profiles p ON p.organization_id = o.id
        WHERE o.id = %s
        ''',
        (organization_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Организация не найдена'
        )
    return dict(row)


def _get_category_organizations(cur, category: str | None, exclude_org_id: str) -> list[str]:
    """Get list of organization IDs in the same category."""
    if not category:
        # If no category, compare against all verified organizations
        cur.execute(
            '''
            SELECT o.id FROM organizations o
            WHERE o.verification_status = 'verified'
              AND o.id != %s
            ''',
            (exclude_org_id,),
        )
    else:
        # Find organizations with matching category or tags
        cur.execute(
            '''
            SELECT o.id FROM organizations o
            LEFT JOIN organization_profiles p ON p.organization_id = o.id
            WHERE o.verification_status = 'verified'
              AND o.id != %s
              AND (p.category ILIKE %s OR p.tags ILIKE %s)
            ''',
            (exclude_org_id, f'%{category}%', f'%{category}%'),
        )

    return [row['id'] for row in cur.fetchall()]


def _calculate_org_metrics(
    cur,
    organization_id: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> dict[str, Any]:
    """Calculate metrics for a single organization."""
    date_filter = ""
    params: list[Any] = [organization_id]

    if start_date and end_date:
        date_filter = " AND r.created_at BETWEEN %s AND %s"
        params.extend([start_date, end_date])

    cur.execute(
        f'''
        SELECT
            COUNT(*) as total_reviews,
            AVG(r.rating)::numeric(3,2) as avg_rating,
            COUNT(*) FILTER (WHERE r.response IS NOT NULL) as reviews_with_response,
            AVG(
                CASE WHEN r.response_at IS NOT NULL AND r.created_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (r.response_at - r.created_at)) / 3600
                END
            )::numeric(10,2) as avg_response_time_hours
        FROM reviews r
        WHERE r.organization_id = %s
          AND r.status = 'approved'
          {date_filter}
        ''',
        params,
    )
    row = cur.fetchone()

    total_reviews = row['total_reviews'] or 0
    reviews_with_response = row['reviews_with_response'] or 0

    return {
        'total_reviews': total_reviews,
        'avg_rating': float(row['avg_rating']) if row['avg_rating'] else None,
        'response_rate': (reviews_with_response / total_reviews * 100) if total_reviews > 0 else 0.0,
        'avg_response_time_hours': float(row['avg_response_time_hours']) if row['avg_response_time_hours'] else None,
    }


def _calculate_category_metrics(
    cur,
    org_ids: list[str],
) -> dict[str, Any]:
    """Calculate aggregate metrics for category organizations."""
    if not org_ids:
        return {
            'avg_rating': None,
            'avg_reviews': None,
            'avg_response_rate': None,
            'avg_response_time_hours': None,
            'total_reviews': 0,
        }

    placeholders = ','.join(['%s'] * len(org_ids))

    cur.execute(
        f'''
        WITH org_stats AS (
            SELECT
                r.organization_id,
                COUNT(*) as total_reviews,
                AVG(r.rating)::numeric(3,2) as avg_rating,
                COUNT(*) FILTER (WHERE r.response IS NOT NULL) as reviews_with_response,
                AVG(
                    CASE WHEN r.response_at IS NOT NULL AND r.created_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (r.response_at - r.created_at)) / 3600
                    END
                )::numeric(10,2) as avg_response_time_hours
            FROM reviews r
            WHERE r.organization_id IN ({placeholders})
              AND r.status = 'approved'
            GROUP BY r.organization_id
        )
        SELECT
            AVG(avg_rating)::numeric(3,2) as category_avg_rating,
            AVG(total_reviews)::numeric(10,2) as category_avg_reviews,
            AVG(
                CASE WHEN total_reviews > 0
                THEN (reviews_with_response::float / total_reviews * 100)
                ELSE 0
                END
            )::numeric(5,2) as category_avg_response_rate,
            AVG(avg_response_time_hours)::numeric(10,2) as category_avg_response_time,
            SUM(total_reviews) as total_reviews
        FROM org_stats
        ''',
        org_ids,
    )
    row = cur.fetchone()

    return {
        'avg_rating': float(row['category_avg_rating']) if row['category_avg_rating'] else None,
        'avg_reviews': float(row['category_avg_reviews']) if row['category_avg_reviews'] else None,
        'avg_response_rate': float(row['category_avg_response_rate']) if row['category_avg_response_rate'] else None,
        'avg_response_time_hours': float(row['category_avg_response_time']) if row['category_avg_response_time'] else None,
        'total_reviews': row['total_reviews'] or 0,
    }


def _calculate_percentile(
    cur,
    org_value: float | None,
    org_ids: list[str],
    metric: str,
) -> int | None:
    """Calculate percentile ranking for a metric."""
    if org_value is None or not org_ids:
        return None

    placeholders = ','.join(['%s'] * len(org_ids))

    if metric == 'rating':
        query = f'''
            SELECT COUNT(*) as below_count
            FROM (
                SELECT AVG(r.rating) as org_rating
                FROM reviews r
                WHERE r.organization_id IN ({placeholders})
                  AND r.status = 'approved'
                GROUP BY r.organization_id
            ) sub
            WHERE org_rating < %s
        '''
    elif metric == 'reviews':
        query = f'''
            SELECT COUNT(*) as below_count
            FROM (
                SELECT COUNT(*) as org_reviews
                FROM reviews r
                WHERE r.organization_id IN ({placeholders})
                  AND r.status = 'approved'
                GROUP BY r.organization_id
            ) sub
            WHERE org_reviews < %s
        '''
    elif metric == 'response_rate':
        query = f'''
            SELECT COUNT(*) as below_count
            FROM (
                SELECT
                    CASE WHEN COUNT(*) > 0
                    THEN (COUNT(*) FILTER (WHERE r.response IS NOT NULL)::float / COUNT(*) * 100)
                    ELSE 0
                    END as org_response_rate
                FROM reviews r
                WHERE r.organization_id IN ({placeholders})
                  AND r.status = 'approved'
                GROUP BY r.organization_id
            ) sub
            WHERE org_response_rate < %s
        '''
    else:
        return None

    cur.execute(query, org_ids + [org_value])
    below_count = cur.fetchone()['below_count']

    total_orgs = len(org_ids)
    if total_orgs == 0:
        return None

    # Percentile = (number of orgs below / total orgs) * 100
    percentile = int((below_count / total_orgs) * 100)
    return min(100, max(0, percentile))


def _calculate_diff_percent(value: float | None, category_avg: float | None) -> float | None:
    """Calculate percentage difference from category average."""
    if value is None or category_avg is None or category_avg == 0:
        return None
    return round((value - category_avg) / category_avg * 100, 1)


def _calculate_trend(
    current_value: float | None,
    previous_value: float | None,
) -> TrendData:
    """Calculate trend between two periods."""
    if current_value is None and previous_value is None:
        return TrendData(
            current_period_value=None,
            previous_period_value=None,
            change_percent=None,
            trend='stable',
        )

    if previous_value is None or previous_value == 0:
        trend = 'up' if (current_value or 0) > 0 else 'stable'
        return TrendData(
            current_period_value=current_value,
            previous_period_value=previous_value,
            change_percent=None,
            trend=trend,
        )

    current = current_value or 0
    change_percent = round((current - previous_value) / previous_value * 100, 1)

    if change_percent > 5:
        trend = 'up'
    elif change_percent < -5:
        trend = 'down'
    else:
        trend = 'stable'

    return TrendData(
        current_period_value=current_value,
        previous_period_value=previous_value,
        change_percent=change_percent,
        trend=trend,
    )


def get_organization_benchmarks(
    organization_id: str,
    user_id: str,
    period_days: int = 30,
) -> BenchmarkResponse:
    """
    Get benchmark comparison for an organization against its category peers.

    Args:
        organization_id: The organization to benchmark
        user_id: The requesting user (for access control)
        period_days: Number of days for trend analysis (default 30)

    Returns:
        BenchmarkResponse with metrics, trends, and category info
    """
    now = datetime.now(timezone.utc)
    current_period_start = now - timedelta(days=period_days)
    previous_period_start = current_period_start - timedelta(days=period_days)

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify access
        _ensure_member(cur, organization_id, user_id)

        # Get organization info
        org_info = _get_organization_info(cur, organization_id)
        category = org_info.get('category')

        # Get category peers
        category_org_ids = _get_category_organizations(cur, category, organization_id)

        # Calculate organization's overall metrics
        org_metrics = _calculate_org_metrics(cur, organization_id)

        # Calculate category averages
        category_metrics = _calculate_category_metrics(cur, category_org_ids)

        # Calculate percentiles
        rating_percentile = _calculate_percentile(
            cur, org_metrics['avg_rating'], category_org_ids, 'rating'
        )
        reviews_percentile = _calculate_percentile(
            cur, float(org_metrics['total_reviews']), category_org_ids, 'reviews'
        )
        response_rate_percentile = _calculate_percentile(
            cur, org_metrics['response_rate'], category_org_ids, 'response_rate'
        )

        # Build metrics comparison
        metrics = BenchmarkMetrics(
            average_rating=MetricComparison(
                value=org_metrics['avg_rating'],
                category_avg=category_metrics['avg_rating'],
                percentile=rating_percentile,
                diff_percent=_calculate_diff_percent(
                    org_metrics['avg_rating'],
                    category_metrics['avg_rating']
                ),
            ),
            total_reviews=MetricComparison(
                value=float(org_metrics['total_reviews']),
                category_avg=category_metrics['avg_reviews'],
                percentile=reviews_percentile,
                diff_percent=_calculate_diff_percent(
                    float(org_metrics['total_reviews']),
                    category_metrics['avg_reviews']
                ),
            ),
            response_rate=MetricComparison(
                value=org_metrics['response_rate'],
                category_avg=category_metrics['avg_response_rate'],
                percentile=response_rate_percentile,
                diff_percent=_calculate_diff_percent(
                    org_metrics['response_rate'],
                    category_metrics['avg_response_rate']
                ),
            ),
            avg_response_time_hours=MetricComparison(
                value=org_metrics['avg_response_time_hours'],
                category_avg=category_metrics['avg_response_time_hours'],
                percentile=None,  # Not calculating percentile for response time
                diff_percent=_calculate_diff_percent(
                    org_metrics['avg_response_time_hours'],
                    category_metrics['avg_response_time_hours']
                ),
            ) if org_metrics['avg_response_time_hours'] else None,
        )

        # Calculate trends (current period vs previous period)
        current_metrics = _calculate_org_metrics(
            cur, organization_id, current_period_start, now
        )
        previous_metrics = _calculate_org_metrics(
            cur, organization_id, previous_period_start, current_period_start
        )

        trends = BenchmarkTrends(
            rating_trend=_calculate_trend(
                current_metrics['avg_rating'],
                previous_metrics['avg_rating']
            ),
            reviews_trend=_calculate_trend(
                float(current_metrics['total_reviews']),
                float(previous_metrics['total_reviews'])
            ),
            response_rate_trend=_calculate_trend(
                current_metrics['response_rate'],
                previous_metrics['response_rate']
            ),
        )

        # Build category info
        category_info = CategoryInfo(
            name=category,
            total_organizations=len(category_org_ids) + 1,  # +1 for the org itself
            total_reviews=category_metrics['total_reviews'] + org_metrics['total_reviews'],
        )

        return BenchmarkResponse(
            organization_id=organization_id,
            organization_name=org_info['name'],
            category=category_info,
            metrics=metrics,
            trends=trends,
            period_days=period_days,
        )
