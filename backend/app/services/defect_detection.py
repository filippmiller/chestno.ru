"""
Defect Early Warning Service

Analyzes reviews to detect complaint patterns and alert manufacturers
when issues spike.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Tuple

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.notifications import NotificationEmitRequest
from app.services.notifications import emit_notification

logger = logging.getLogger(__name__)

# Default spike threshold (3x normal rate)
DEFAULT_SPIKE_THRESHOLD = 3.0
DEFAULT_BASELINE_DAYS = 30


def get_complaint_topics() -> List[dict]:
    """Get all active complaint topics."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT id, code, name_ru, name_en, keywords, icon, color
            FROM complaint_topics
            WHERE is_active = true
            ORDER BY display_order ASC
            '''
        )
        return [dict(row) for row in cur.fetchall()]


def classify_review(review_id: str) -> int:
    """
    Classify a review by matching it against complaint topics.

    Returns the number of topics matched.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get review text
        cur.execute(
            'SELECT title, body FROM reviews WHERE id = %s',
            (review_id,)
        )
        review = cur.fetchone()
        if not review:
            return 0

        review_text = f"{review['title'] or ''} {review['body'] or ''}".lower()
        if not review_text.strip():
            return 0

        # Get all topics
        cur.execute('SELECT id, keywords FROM complaint_topics WHERE is_active = true')
        topics = cur.fetchall()

        matched_count = 0
        for topic in topics:
            matched_keywords = []
            for keyword in topic['keywords']:
                if keyword.lower() in review_text:
                    matched_keywords.append(keyword)

            if matched_keywords:
                cur.execute(
                    '''
                    INSERT INTO review_topic_classifications (review_id, topic_id, matched_keywords)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (review_id, topic_id) DO UPDATE SET
                        matched_keywords = EXCLUDED.matched_keywords
                    ''',
                    (review_id, topic['id'], matched_keywords)
                )
                matched_count += 1

        conn.commit()
        return matched_count


def classify_all_organization_reviews(organization_id: str, days: int = 30) -> int:
    """Classify all recent reviews for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT id FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND created_at >= now() - %s * INTERVAL '1 day'
            ''',
            (organization_id, days)
        )
        review_ids = [row['id'] for row in cur.fetchall()]

    classified = 0
    for review_id in review_ids:
        try:
            classify_review(str(review_id))
            classified += 1
        except Exception as e:
            logger.warning(f"Failed to classify review {review_id}: {e}")

    return classified


def aggregate_daily_stats(organization_id: str, stat_date: date) -> dict:
    """
    Aggregate topic statistics for an organization for a specific day.

    This should be run daily for each active organization.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get total reviews for the day
        cur.execute(
            '''
            SELECT COUNT(*) as total
            FROM reviews
            WHERE organization_id = %s
            AND status = 'approved'
            AND DATE(created_at) = %s
            ''',
            (organization_id, stat_date)
        )
        total_reviews = cur.fetchone()['total']

        if total_reviews == 0:
            return {'date': stat_date.isoformat(), 'topics': {}}

        # Get topic counts for the day
        cur.execute(
            '''
            SELECT ct.id as topic_id, ct.code, COUNT(rtc.id) as mention_count
            FROM complaint_topics ct
            LEFT JOIN review_topic_classifications rtc ON rtc.topic_id = ct.id
            LEFT JOIN reviews r ON r.id = rtc.review_id
                AND r.organization_id = %s
                AND DATE(r.created_at) = %s
            WHERE ct.is_active = true
            GROUP BY ct.id, ct.code
            ''',
            (organization_id, stat_date)
        )
        topic_counts = cur.fetchall()

        # Upsert stats for each topic
        result = {'date': stat_date.isoformat(), 'topics': {}}
        for tc in topic_counts:
            mention_count = tc['mention_count'] or 0
            percentage = round(mention_count / total_reviews * 100, 2) if total_reviews > 0 else 0

            cur.execute(
                '''
                INSERT INTO daily_topic_stats (
                    organization_id, topic_id, stat_date,
                    mention_count, review_count, percentage
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (organization_id, topic_id, stat_date) DO UPDATE SET
                    mention_count = EXCLUDED.mention_count,
                    review_count = EXCLUDED.review_count,
                    percentage = EXCLUDED.percentage
                ''',
                (organization_id, tc['topic_id'], stat_date, mention_count, total_reviews, percentage)
            )

            result['topics'][tc['code']] = {
                'count': mention_count,
                'percentage': percentage
            }

        conn.commit()
        return result


def detect_spikes(
    organization_id: str,
    baseline_days: int = DEFAULT_BASELINE_DAYS,
    spike_threshold: float = DEFAULT_SPIKE_THRESHOLD
) -> List[dict]:
    """
    Detect topic spikes compared to baseline.

    Returns list of topics that have spiked.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        yesterday = date.today() - timedelta(days=1)
        baseline_start = yesterday - timedelta(days=baseline_days)

        # Get baseline averages
        cur.execute(
            '''
            SELECT
                topic_id,
                AVG(percentage) as avg_percentage
            FROM daily_topic_stats
            WHERE organization_id = %s
            AND stat_date >= %s
            AND stat_date < %s
            GROUP BY topic_id
            ''',
            (organization_id, baseline_start, yesterday)
        )
        baselines = {row['topic_id']: float(row['avg_percentage'] or 0) for row in cur.fetchall()}

        # Get yesterday's stats
        cur.execute(
            '''
            SELECT dts.topic_id, dts.percentage, ct.code, ct.name_ru
            FROM daily_topic_stats dts
            JOIN complaint_topics ct ON ct.id = dts.topic_id
            WHERE dts.organization_id = %s
            AND dts.stat_date = %s
            ''',
            (organization_id, yesterday)
        )
        current_stats = cur.fetchall()

        # Find spikes
        spikes = []
        for stat in current_stats:
            topic_id = stat['topic_id']
            current_pct = float(stat['percentage'])
            baseline_pct = baselines.get(topic_id, 0)

            # Calculate spike factor
            if baseline_pct > 0:
                spike_factor = current_pct / baseline_pct
            elif current_pct > 5:  # New issue appearing (>5% is significant)
                spike_factor = 10.0
            else:
                spike_factor = 1.0

            if spike_factor >= spike_threshold:
                spikes.append({
                    'topic_id': str(topic_id),
                    'topic_code': stat['code'],
                    'topic_name': stat['name_ru'],
                    'baseline_percentage': round(baseline_pct, 2),
                    'current_percentage': round(current_pct, 2),
                    'spike_factor': round(spike_factor, 2)
                })

        return spikes


def create_defect_alert(
    organization_id: str,
    topic_id: str,
    spike_data: dict
) -> dict:
    """Create a defect alert for a detected spike."""
    # Determine severity based on spike factor
    spike_factor = spike_data.get('spike_factor', 1)
    if spike_factor >= 5:
        severity = 'critical'
    elif spike_factor >= 4:
        severity = 'high'
    elif spike_factor >= 3:
        severity = 'medium'
    else:
        severity = 'low'

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        yesterday = date.today() - timedelta(days=1)
        week_ago = yesterday - timedelta(days=7)

        # Get affected reviews
        cur.execute(
            '''
            SELECT r.id
            FROM reviews r
            JOIN review_topic_classifications rtc ON rtc.review_id = r.id
            WHERE r.organization_id = %s
            AND rtc.topic_id = %s
            AND r.created_at >= %s
            LIMIT 20
            ''',
            (organization_id, topic_id, week_ago)
        )
        affected_reviews = [str(row['id']) for row in cur.fetchall()]

        # Get affected products
        cur.execute(
            '''
            SELECT DISTINCT r.product_id
            FROM reviews r
            JOIN review_topic_classifications rtc ON rtc.review_id = r.id
            WHERE r.organization_id = %s
            AND rtc.topic_id = %s
            AND r.created_at >= %s
            AND r.product_id IS NOT NULL
            LIMIT 10
            ''',
            (organization_id, topic_id, week_ago)
        )
        affected_products = [str(row['product_id']) for row in cur.fetchall()]

        # Create alert
        cur.execute(
            '''
            INSERT INTO defect_alerts (
                organization_id, topic_id, alert_type, severity,
                baseline_percentage, current_percentage, spike_factor,
                detection_window_start, detection_window_end,
                affected_review_ids, affected_product_ids
            )
            VALUES (%s, %s, 'spike', %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (
                organization_id, topic_id, severity,
                spike_data['baseline_percentage'],
                spike_data['current_percentage'],
                spike_data['spike_factor'],
                week_ago, yesterday,
                affected_reviews, affected_products
            )
        )
        alert = dict(cur.fetchone())

        # Send notification
        try:
            emit_notification(NotificationEmitRequest(
                type_key='business.defect_alert',
                org_id=organization_id,
                recipient_scope='organization',
                payload={
                    'alert_id': str(alert['id']),
                    'topic_name': spike_data['topic_name'],
                    'spike_factor': f"{spike_data['spike_factor']:.1f}",
                    'review_count': len(affected_reviews)
                }
            ))
        except Exception as e:
            logger.warning(f"Failed to send defect alert notification: {e}")

        conn.commit()
        logger.info(f"[defect] Created alert {alert['id']} for org {organization_id}, topic {spike_data['topic_code']}")
        return alert


def get_organization_alerts(
    organization_id: str,
    status_filter: Optional[str] = None,
    limit: int = 20
) -> List[dict]:
    """Get defect alerts for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        query = '''
            SELECT da.*, ct.code as topic_code, ct.name_ru as topic_name, ct.icon, ct.color
            FROM defect_alerts da
            JOIN complaint_topics ct ON ct.id = da.topic_id
            WHERE da.organization_id = %s
        '''
        params = [organization_id]

        if status_filter:
            query += ' AND da.status = %s'
            params.append(status_filter)

        query += ' ORDER BY da.created_at DESC LIMIT %s'
        params.append(limit)

        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]


def update_alert_status(
    alert_id: str,
    user_id: str,
    new_status: str,
    notes: Optional[str] = None
) -> dict:
    """Update the status of a defect alert."""
    valid_statuses = ['new', 'acknowledged', 'investigating', 'resolved', 'dismissed']
    if new_status not in valid_statuses:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Invalid status. Must be one of: {valid_statuses}'
        )

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        updates = ['status = %s']
        params = [new_status]

        if new_status == 'acknowledged':
            updates.append('acknowledged_by = %s')
            updates.append('acknowledged_at = now()')
            params.append(user_id)
        elif new_status in ('resolved', 'dismissed'):
            updates.append('resolved_at = now()')

        if notes:
            updates.append('resolution_notes = %s')
            params.append(notes)

        params.append(alert_id)

        cur.execute(
            f'''
            UPDATE defect_alerts
            SET {', '.join(updates)}, updated_at = now()
            WHERE id = %s
            RETURNING *
            ''',
            params
        )
        alert = cur.fetchone()
        if not alert:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Alert not found')

        conn.commit()
        return dict(alert)


def get_topic_trends(organization_id: str, days: int = 30) -> List[dict]:
    """Get topic trend data for visualization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                ct.code,
                ct.name_ru,
                ct.color,
                json_agg(
                    json_build_object(
                        'date', dts.stat_date,
                        'percentage', dts.percentage
                    ) ORDER BY dts.stat_date
                ) as trend_data
            FROM complaint_topics ct
            LEFT JOIN daily_topic_stats dts ON dts.topic_id = ct.id
                AND dts.organization_id = %s
                AND dts.stat_date >= CURRENT_DATE - %s
            WHERE ct.is_active = true
            GROUP BY ct.id, ct.code, ct.name_ru, ct.color
            ORDER BY ct.display_order
            ''',
            (organization_id, days)
        )
        return [dict(row) for row in cur.fetchall()]


def run_daily_detection(organization_id: str) -> dict:
    """
    Run the full daily detection pipeline for an organization.

    This should be called by a cron job for each active organization.
    """
    yesterday = date.today() - timedelta(days=1)

    # 1. Classify any unclassified reviews
    classified = classify_all_organization_reviews(organization_id, days=2)

    # 2. Aggregate daily stats
    stats = aggregate_daily_stats(organization_id, yesterday)

    # 3. Detect spikes
    spikes = detect_spikes(organization_id)

    # 4. Create alerts for spikes
    alerts_created = 0
    for spike in spikes:
        try:
            create_defect_alert(organization_id, spike['topic_id'], spike)
            alerts_created += 1
        except Exception as e:
            logger.error(f"Failed to create alert for spike: {e}")

    result = {
        'organization_id': organization_id,
        'date': yesterday.isoformat(),
        'reviews_classified': classified,
        'spikes_detected': len(spikes),
        'alerts_created': alerts_created
    }

    logger.info(f"[defect] Daily detection for {organization_id}: {result}")
    return result
