"""
Review Intelligence Dashboard Service

Provides analytics and insights from review data for business improvement.
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.db import get_connection

logger = logging.getLogger(__name__)

# Russian stop words to exclude from keyword extraction
RUSSIAN_STOP_WORDS = {
    'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все',
    'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по',
    'только', 'её', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из',
    'ему', 'теперь', 'когда', 'уже', 'вам', 'ни', 'быть', 'был', 'была', 'были',
    'есть', 'для', 'это', 'этот', 'эта', 'эти', 'этих', 'при', 'очень', 'просто',
    'хорошо', 'плохо', 'товар', 'продукт', 'заказ', 'качество', 'доставка',
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with',
    'to', 'for', 'of', 'this', 'that', 'it', 'be', 'are', 'was', 'were', 'been'
}

# Minimum word length for keywords
MIN_KEYWORD_LENGTH = 3


def extract_keywords(text: str, top_n: int = 20) -> List[dict]:
    """Extract top keywords from text."""
    if not text:
        return []

    # Tokenize and clean
    words = re.findall(r'[a-zA-Zа-яА-ЯёЁ]+', text.lower())

    # Filter stop words and short words
    filtered = [
        w for w in words
        if w not in RUSSIAN_STOP_WORDS and len(w) >= MIN_KEYWORD_LENGTH
    ]

    # Count frequencies
    counts = Counter(filtered)

    # Return top N
    return [
        {'keyword': kw, 'count': count}
        for kw, count in counts.most_common(top_n)
    ]


def generate_intelligence_report(organization_id: str, period_days: int = 30) -> dict:
    """Generate a comprehensive review intelligence report."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        period_start = date.today() - timedelta(days=period_days)

        # Overall stats
        cur.execute(
            '''
            SELECT
                COUNT(*) as total_reviews,
                AVG(rating) as avg_rating,
                COUNT(*) FILTER (WHERE rating >= 4) as positive_count,
                COUNT(*) FILTER (WHERE rating <= 2) as negative_count,
                COUNT(*) FILTER (WHERE rating = 3) as neutral_count,
                COUNT(*) FILTER (WHERE response IS NOT NULL) as responded_count
            FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= %s
            ''',
            (organization_id, period_start)
        )
        stats = dict(cur.fetchone())

        total = stats['total_reviews'] or 0
        stats['avg_rating'] = round(float(stats['avg_rating'] or 0), 2)
        stats['response_rate'] = round(
            (stats['responded_count'] / total * 100) if total > 0 else 0, 1
        )
        stats['positive_rate'] = round(
            (stats['positive_count'] / total * 100) if total > 0 else 0, 1
        )
        stats['negative_rate'] = round(
            (stats['negative_count'] / total * 100) if total > 0 else 0, 1
        )

        # Rating distribution
        cur.execute(
            '''
            SELECT rating, COUNT(*) as count
            FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= %s
            GROUP BY rating
            ORDER BY rating
            ''',
            (organization_id, period_start)
        )
        rating_distribution = {row['rating']: row['count'] for row in cur.fetchall()}

        # Daily trend
        cur.execute(
            '''
            SELECT DATE(created_at) as review_date,
                   COUNT(*) as count,
                   AVG(rating) as avg_rating
            FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= %s
            GROUP BY DATE(created_at)
            ORDER BY review_date
            ''',
            (organization_id, period_start)
        )
        daily_trend = [
            {
                'date': row['review_date'].isoformat(),
                'count': row['count'],
                'avg_rating': round(float(row['avg_rating']), 2)
            }
            for row in cur.fetchall()
        ]

        # Extract all review text for keyword analysis
        cur.execute(
            '''
            SELECT title, body FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= %s
            ''',
            (organization_id, period_start)
        )
        reviews = cur.fetchall()
        all_text = ' '.join(
            f"{r['title'] or ''} {r['body'] or ''}"
            for r in reviews
        )

        # Positive and negative keyword analysis
        cur.execute(
            '''
            SELECT title, body FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= %s
            AND rating >= 4
            ''',
            (organization_id, period_start)
        )
        positive_text = ' '.join(
            f"{r['title'] or ''} {r['body'] or ''}"
            for r in cur.fetchall()
        )

        cur.execute(
            '''
            SELECT title, body FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= %s
            AND rating <= 2
            ''',
            (organization_id, period_start)
        )
        negative_text = ' '.join(
            f"{r['title'] or ''} {r['body'] or ''}"
            for r in cur.fetchall()
        )

        keywords = {
            'overall': extract_keywords(all_text, 20),
            'positive': extract_keywords(positive_text, 15),
            'negative': extract_keywords(negative_text, 15)
        }

        # Top products by review count
        cur.execute(
            '''
            SELECT p.id, p.name, COUNT(*) as review_count, AVG(r.rating) as avg_rating
            FROM reviews r
            JOIN products p ON p.id = r.product_id
            WHERE r.organization_id = %s
            AND r.status = 'approved'
            AND r.created_at >= %s
            GROUP BY p.id, p.name
            ORDER BY review_count DESC
            LIMIT 10
            ''',
            (organization_id, period_start)
        )
        top_products = [
            {
                'product_id': str(row['id']),
                'name': row['name'],
                'review_count': row['review_count'],
                'avg_rating': round(float(row['avg_rating']), 2)
            }
            for row in cur.fetchall()
        ]

        # Compare to previous period
        prev_start = period_start - timedelta(days=period_days)
        cur.execute(
            '''
            SELECT COUNT(*) as total, AVG(rating) as avg_rating
            FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= %s
            AND created_at < %s
            ''',
            (organization_id, prev_start, period_start)
        )
        prev_stats = cur.fetchone()
        prev_total = prev_stats['total'] or 0
        prev_avg = float(prev_stats['avg_rating'] or 0)

        comparison = {
            'review_count_change': total - prev_total,
            'review_count_change_pct': round(
                ((total - prev_total) / prev_total * 100) if prev_total > 0 else 0, 1
            ),
            'rating_change': round(stats['avg_rating'] - prev_avg, 2)
        }

        # Store report
        report_data = {
            'period_start': period_start.isoformat(),
            'period_end': date.today().isoformat(),
            'period_days': period_days,
            'stats': stats,
            'rating_distribution': rating_distribution,
            'daily_trend': daily_trend,
            'keywords': keywords,
            'top_products': top_products,
            'comparison': comparison
        }

        cur.execute(
            '''
            INSERT INTO review_intelligence_reports (
                organization_id, period_start, period_end, report_data
            )
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (organization_id, period_start, period_end) DO UPDATE SET
                report_data = EXCLUDED.report_data,
                generated_at = now()
            RETURNING id
            ''',
            (organization_id, period_start, date.today(), Jsonb(report_data))
        )
        report_id = cur.fetchone()['id']

        # Store keywords
        for kw_type, kw_list in keywords.items():
            for kw in kw_list:
                cur.execute(
                    '''
                    INSERT INTO review_keywords (
                        organization_id, keyword, keyword_type, occurrence_count, period_start
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (organization_id, keyword, period_start) DO UPDATE SET
                        occurrence_count = EXCLUDED.occurrence_count,
                        keyword_type = EXCLUDED.keyword_type
                    ''',
                    (organization_id, kw['keyword'], kw_type, kw['count'], period_start)
                )

        conn.commit()

        logger.info(f"[intelligence] Generated report {report_id} for org {organization_id}")
        return {'report_id': str(report_id), **report_data}


def get_latest_report(organization_id: str) -> Optional[dict]:
    """Get the most recent intelligence report."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM review_intelligence_reports
            WHERE organization_id = %s
            ORDER BY generated_at DESC
            LIMIT 1
            ''',
            (organization_id,)
        )
        row = cur.fetchone()
        if row:
            return {
                'report_id': str(row['id']),
                'generated_at': row['generated_at'].isoformat(),
                **row['report_data']
            }
        return None


def get_keyword_trends(organization_id: str, keyword: str, periods: int = 6) -> List[dict]:
    """Get trend data for a specific keyword over multiple periods."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT period_start, occurrence_count, keyword_type
            FROM review_keywords
            WHERE organization_id = %s AND keyword = %s
            ORDER BY period_start DESC
            LIMIT %s
            ''',
            (organization_id, keyword.lower(), periods)
        )
        return [
            {
                'period_start': row['period_start'].isoformat(),
                'count': row['occurrence_count'],
                'type': row['keyword_type']
            }
            for row in cur.fetchall()
        ]


def get_category_benchmarks(category: str) -> Optional[dict]:
    """Get industry benchmarks for comparison."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM category_benchmarks
            WHERE category = %s
            ORDER BY period_end DESC
            LIMIT 1
            ''',
            (category,)
        )
        row = cur.fetchone()
        if row:
            return dict(row)
        return None


def generate_improvement_suggestions(organization_id: str) -> List[dict]:
    """Generate actionable improvement suggestions based on review analysis."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        suggestions = []

        # Get recent stats
        cur.execute(
            '''
            SELECT
                AVG(rating) as avg_rating,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE response IS NULL) as unresponded,
                COUNT(*) FILTER (WHERE rating <= 2) as negative
            FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= CURRENT_DATE - 30
            ''',
            (organization_id,)
        )
        stats = cur.fetchone()

        total = stats['total'] or 0
        if total == 0:
            return []

        avg_rating = float(stats['avg_rating'] or 0)
        unresponded = stats['unresponded'] or 0
        negative = stats['negative'] or 0

        # Response rate suggestion
        response_rate = (total - unresponded) / total * 100
        if response_rate < 50:
            suggestions.append({
                'type': 'response_rate',
                'priority': 'high',
                'title': 'Увеличьте скорость ответов на отзывы',
                'description': f'Текущий показатель ответов: {response_rate:.0f}%. Рекомендуется отвечать на 80%+ отзывов.',
                'metric': f'{response_rate:.0f}%',
                'target': '80%+'
            })

        # Negative review handling
        if negative > 0 and (negative / total * 100) > 15:
            suggestions.append({
                'type': 'negative_reviews',
                'priority': 'high',
                'title': 'Обратите внимание на негативные отзывы',
                'description': f'{negative} негативных отзывов за последний месяц ({negative/total*100:.0f}%). Проанализируйте причины.',
                'metric': f'{negative}',
                'target': '<15%'
            })

        # Rating improvement
        if avg_rating < 4.0:
            suggestions.append({
                'type': 'rating',
                'priority': 'medium',
                'title': 'Улучшите средний рейтинг',
                'description': f'Текущий рейтинг: {avg_rating:.1f}. Целевой показатель: 4.0+',
                'metric': f'{avg_rating:.1f}',
                'target': '4.0+'
            })

        # Get common negative keywords
        cur.execute(
            '''
            SELECT keyword, occurrence_count
            FROM review_keywords
            WHERE organization_id = %s
            AND keyword_type = 'negative'
            AND period_start >= CURRENT_DATE - 30
            ORDER BY occurrence_count DESC
            LIMIT 3
            ''',
            (organization_id,)
        )
        neg_keywords = cur.fetchall()

        for kw in neg_keywords:
            suggestions.append({
                'type': 'keyword_issue',
                'priority': 'medium',
                'title': f'Частая жалоба: "{kw["keyword"]}"',
                'description': f'Упоминается в {kw["occurrence_count"]} негативных отзывах. Рассмотрите улучшения.',
                'metric': f'{kw["occurrence_count"]}',
                'keyword': kw['keyword']
            })

        # Store suggestions
        for idx, suggestion in enumerate(suggestions):
            cur.execute(
                '''
                INSERT INTO improvement_suggestions (
                    organization_id, suggestion_type, priority,
                    title, description, metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (organization_id, suggestion_type, title)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    metadata = EXCLUDED.metadata,
                    updated_at = now()
                ''',
                (
                    organization_id, suggestion['type'], suggestion['priority'],
                    suggestion['title'], suggestion['description'],
                    Jsonb({'metric': suggestion.get('metric'), 'target': suggestion.get('target')})
                )
            )

        conn.commit()

        logger.info(f"[intelligence] Generated {len(suggestions)} suggestions for org {organization_id}")
        return suggestions


def get_active_suggestions(organization_id: str) -> List[dict]:
    """Get active improvement suggestions."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM improvement_suggestions
            WHERE organization_id = %s
            AND is_dismissed = false
            ORDER BY
                CASE priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                created_at DESC
            ''',
            (organization_id,)
        )
        return [dict(row) for row in cur.fetchall()]


def dismiss_suggestion(suggestion_id: str, user_id: str) -> bool:
    """Dismiss a suggestion."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            '''
            UPDATE improvement_suggestions
            SET is_dismissed = true, dismissed_by = %s, dismissed_at = now()
            WHERE id = %s
            ''',
            (user_id, suggestion_id)
        )
        conn.commit()
        return cur.rowcount > 0


def get_sentiment_timeline(organization_id: str, days: int = 30) -> List[dict]:
    """Get daily sentiment breakdown."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                DATE(created_at) as review_date,
                COUNT(*) FILTER (WHERE rating >= 4) as positive,
                COUNT(*) FILTER (WHERE rating = 3) as neutral,
                COUNT(*) FILTER (WHERE rating <= 2) as negative
            FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= CURRENT_DATE - %s
            GROUP BY DATE(created_at)
            ORDER BY review_date
            ''',
            (organization_id, days)
        )
        return [
            {
                'date': row['review_date'].isoformat(),
                'positive': row['positive'],
                'neutral': row['neutral'],
                'negative': row['negative']
            }
            for row in cur.fetchall()
        ]


def run_daily_intelligence(organization_id: str) -> dict:
    """Run daily intelligence generation (for cron job)."""
    report = generate_intelligence_report(organization_id, 30)
    suggestions = generate_improvement_suggestions(organization_id)

    return {
        'organization_id': organization_id,
        'report_generated': True,
        'suggestions_count': len(suggestions)
    }
