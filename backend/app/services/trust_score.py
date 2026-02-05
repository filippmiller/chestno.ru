"""
Open Trust Score Service

Transparent, computed trust score from multiple verifiable signals.
Formula is public and documented.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from psycopg.rows import dict_row

from app.core.db import get_connection

logger = logging.getLogger(__name__)

# Trust score signal weights (public formula)
SIGNAL_WEIGHTS = {
    'review_rating': 1.5,        # Average rating (1-5 → 0-100)
    'review_count': 1.0,         # Number of reviews (capped at 1000)
    'response_rate': 1.2,        # % of reviews with business response
    'challenge_resolution': 1.3, # % of challenges successfully resolved
    'supply_chain_docs': 1.0,    # % of supply chain nodes verified
    'platform_tenure': 0.8,      # Months on platform (capped at 50)
    'content_freshness': 0.7,    # Days since last update (inverse)
    'verification_level': 1.0,   # Status level (A=50, B=75, C=100)
}


def get_trust_score_formula() -> dict:
    """
    Return the public trust score formula documentation.

    This is what makes the platform transparent - anyone can verify how scores are calculated.
    """
    return {
        'version': '1.0',
        'description': 'Trust score is calculated from 8 verifiable signals, each weighted and combined into a 0-100 score.',
        'total_weight': sum(SIGNAL_WEIGHTS.values()),
        'signals': [
            {
                'code': 'review_rating',
                'name': 'Средний рейтинг',
                'weight': SIGNAL_WEIGHTS['review_rating'],
                'max_points': 100,
                'formula': 'average_rating * 20 (5 stars = 100 points)',
                'description': 'Average star rating across all approved reviews'
            },
            {
                'code': 'review_count',
                'name': 'Количество отзывов',
                'weight': SIGNAL_WEIGHTS['review_count'],
                'max_points': 100,
                'formula': 'min(review_count / 10, 100)',
                'description': 'Total approved reviews (1000+ reviews = max points)'
            },
            {
                'code': 'response_rate',
                'name': 'Скорость ответа',
                'weight': SIGNAL_WEIGHTS['response_rate'],
                'max_points': 100,
                'formula': 'reviews_with_response / total_reviews * 100',
                'description': 'Percentage of reviews with business response'
            },
            {
                'code': 'challenge_resolution',
                'name': 'Разрешение вызовов',
                'weight': SIGNAL_WEIGHTS['challenge_resolution'],
                'max_points': 100,
                'formula': 'responded_challenges / (responded + expired) * 100',
                'description': 'Percentage of verification challenges answered (100 if no challenges)'
            },
            {
                'code': 'supply_chain_docs',
                'name': 'Документация цепочки',
                'weight': SIGNAL_WEIGHTS['supply_chain_docs'],
                'max_points': 100,
                'formula': 'verified_nodes / total_nodes * 100',
                'description': 'Percentage of supply chain nodes with verification'
            },
            {
                'code': 'platform_tenure',
                'name': 'Время на платформе',
                'weight': SIGNAL_WEIGHTS['platform_tenure'],
                'max_points': 100,
                'formula': 'min(months_active * 2, 100)',
                'description': 'How long the organization has been on the platform'
            },
            {
                'code': 'content_freshness',
                'name': 'Свежесть контента',
                'weight': SIGNAL_WEIGHTS['content_freshness'],
                'max_points': 100,
                'formula': '100 - min(days_since_last_update, 100)',
                'description': 'How recently the organization updated their content'
            },
            {
                'code': 'verification_level',
                'name': 'Уровень верификации',
                'weight': SIGNAL_WEIGHTS['verification_level'],
                'max_points': 100,
                'formula': 'level_a=50, level_b=75, level_c=100, else=25',
                'description': 'Current verification status level'
            },
        ],
        'grade_thresholds': {
            'A': 90,
            'B': 80,
            'C': 70,
            'D': 60,
            'F': 0
        },
        'final_formula': 'sum(signal_score * signal_weight) / sum(weights)'
    }


def calculate_organization_trust_score(organization_id: str) -> dict:
    """
    Calculate the trust score for an organization based on all signals.

    Returns the score breakdown and final grade.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get organization info
        cur.execute(
            '''
            SELECT id, name, created_at, updated_at, verification_status
            FROM organizations WHERE id = %s
            ''',
            (organization_id,)
        )
        org = cur.fetchone()
        if not org:
            return None

        # Calculate each signal

        # 1. Review rating (1-5 → 0-100)
        cur.execute(
            '''
            SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews,
                   COUNT(*) FILTER (WHERE response IS NOT NULL) as with_response
            FROM reviews
            WHERE organization_id = %s AND status = 'approved'
            ''',
            (organization_id,)
        )
        review_stats = cur.fetchone()
        avg_rating = float(review_stats['avg_rating']) if review_stats['avg_rating'] else 0
        total_reviews = review_stats['total_reviews'] or 0
        with_response = review_stats['with_response'] or 0

        review_rating_score = min(avg_rating * 20, 100)
        review_count_score = min(total_reviews / 10, 100)
        response_rate_score = (with_response / total_reviews * 100) if total_reviews > 0 else 0

        # 2. Challenge resolution
        cur.execute(
            '''
            SELECT
                COUNT(*) FILTER (WHERE status = 'responded') as responded,
                COUNT(*) FILTER (WHERE status IN ('responded', 'expired')) as total
            FROM verification_challenges
            WHERE organization_id = %s
            ''',
            (organization_id,)
        )
        challenge_stats = cur.fetchone()
        challenge_total = challenge_stats['total'] or 0
        challenge_responded = challenge_stats['responded'] or 0
        # No challenges = perfect score
        challenge_resolution_score = (
            (challenge_responded / challenge_total * 100)
            if challenge_total > 0 else 100
        )

        # 3. Supply chain documentation
        cur.execute(
            '''
            SELECT
                COUNT(*) as total_nodes,
                COUNT(*) FILTER (WHERE is_verified = true) as verified_nodes
            FROM supply_chain_nodes
            WHERE organization_id = %s
            ''',
            (organization_id,)
        )
        supply_chain_stats = cur.fetchone()
        total_nodes = supply_chain_stats['total_nodes'] or 0
        verified_nodes = supply_chain_stats['verified_nodes'] or 0
        supply_chain_docs_score = (
            (verified_nodes / total_nodes * 100)
            if total_nodes > 0 else 0
        )

        # 4. Platform tenure
        months_active = (datetime.now(timezone.utc) - org['created_at']).days / 30
        platform_tenure_score = min(months_active * 2, 100)

        # 5. Content freshness
        days_since_update = (datetime.now(timezone.utc) - org['updated_at']).days
        content_freshness_score = max(100 - days_since_update, 0)

        # 6. Verification level
        verification_levels = {
            'level_c': 100,
            'level_b': 75,
            'level_a': 50,
            'verified': 40,
            'pending': 25,
            'unverified': 25
        }
        verification_level_score = verification_levels.get(org['verification_status'], 25)

        # Calculate weighted total
        signal_scores = {
            'review_rating': {'raw': round(review_rating_score, 2), 'weight': SIGNAL_WEIGHTS['review_rating']},
            'review_count': {'raw': round(review_count_score, 2), 'weight': SIGNAL_WEIGHTS['review_count']},
            'response_rate': {'raw': round(response_rate_score, 2), 'weight': SIGNAL_WEIGHTS['response_rate']},
            'challenge_resolution': {'raw': round(challenge_resolution_score, 2), 'weight': SIGNAL_WEIGHTS['challenge_resolution']},
            'supply_chain_docs': {'raw': round(supply_chain_docs_score, 2), 'weight': SIGNAL_WEIGHTS['supply_chain_docs']},
            'platform_tenure': {'raw': round(platform_tenure_score, 2), 'weight': SIGNAL_WEIGHTS['platform_tenure']},
            'content_freshness': {'raw': round(content_freshness_score, 2), 'weight': SIGNAL_WEIGHTS['content_freshness']},
            'verification_level': {'raw': round(verification_level_score, 2), 'weight': SIGNAL_WEIGHTS['verification_level']},
        }

        total_weighted = sum(s['raw'] * s['weight'] for s in signal_scores.values())
        total_weight = sum(SIGNAL_WEIGHTS.values())
        final_score = round(total_weighted / total_weight, 2)

        # Determine grade
        if final_score >= 90:
            grade = 'A'
        elif final_score >= 80:
            grade = 'B'
        elif final_score >= 70:
            grade = 'C'
        elif final_score >= 60:
            grade = 'D'
        else:
            grade = 'F'

        # Store/update the score
        cur.execute(
            '''
            INSERT INTO organization_trust_scores (
                organization_id, total_score, score_grade, signal_scores,
                review_rating_score, review_count_score, response_rate_score,
                challenge_resolution_score, supply_chain_docs_score,
                platform_tenure_score, content_freshness_score, verification_level_score,
                last_calculated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (organization_id) DO UPDATE SET
                total_score = EXCLUDED.total_score,
                score_grade = EXCLUDED.score_grade,
                signal_scores = EXCLUDED.signal_scores,
                review_rating_score = EXCLUDED.review_rating_score,
                review_count_score = EXCLUDED.review_count_score,
                response_rate_score = EXCLUDED.response_rate_score,
                challenge_resolution_score = EXCLUDED.challenge_resolution_score,
                supply_chain_docs_score = EXCLUDED.supply_chain_docs_score,
                platform_tenure_score = EXCLUDED.platform_tenure_score,
                content_freshness_score = EXCLUDED.content_freshness_score,
                verification_level_score = EXCLUDED.verification_level_score,
                last_calculated_at = now()
            RETURNING id
            ''',
            (
                organization_id, final_score, grade, signal_scores,
                round(review_rating_score, 2), round(review_count_score, 2),
                round(response_rate_score, 2), round(challenge_resolution_score, 2),
                round(supply_chain_docs_score, 2), round(platform_tenure_score, 2),
                round(content_freshness_score, 2), round(verification_level_score, 2)
            )
        )

        # Record in history
        cur.execute(
            '''
            INSERT INTO trust_score_history (organization_id, total_score, signal_scores, recorded_at)
            VALUES (%s, %s, %s, CURRENT_DATE)
            ON CONFLICT (organization_id, recorded_at) DO UPDATE SET
                total_score = EXCLUDED.total_score,
                signal_scores = EXCLUDED.signal_scores
            ''',
            (organization_id, final_score, signal_scores)
        )

        conn.commit()

        return {
            'organization_id': organization_id,
            'organization_name': org['name'],
            'total_score': final_score,
            'grade': grade,
            'signal_scores': signal_scores,
            'calculated_at': datetime.now(timezone.utc).isoformat()
        }


def get_organization_trust_score(organization_id: str) -> Optional[dict]:
    """Get the cached trust score for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT ots.*, o.name as organization_name
            FROM organization_trust_scores ots
            JOIN organizations o ON o.id = ots.organization_id
            WHERE ots.organization_id = %s
            ''',
            (organization_id,)
        )
        row = cur.fetchone()
        if row:
            return dict(row)
        return None


def get_trust_score_history(
    organization_id: str,
    days: int = 30
) -> List[dict]:
    """Get trust score history for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT recorded_at, total_score, signal_scores
            FROM trust_score_history
            WHERE organization_id = %s
            AND recorded_at >= CURRENT_DATE - %s
            ORDER BY recorded_at ASC
            ''',
            (organization_id, days)
        )
        return [dict(row) for row in cur.fetchall()]


def get_trust_score_leaderboard(limit: int = 20) -> List[dict]:
    """Get top organizations by trust score."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT ots.organization_id, o.name, o.slug, ots.total_score, ots.score_grade
            FROM organization_trust_scores ots
            JOIN organizations o ON o.id = ots.organization_id
            WHERE o.public_visible = true
            ORDER BY ots.total_score DESC
            LIMIT %s
            ''',
            (limit,)
        )
        return [dict(row) for row in cur.fetchall()]


def recalculate_all_trust_scores() -> int:
    """Recalculate trust scores for all active organizations (for cron job)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT id FROM organizations
            WHERE verification_status NOT IN ('rejected', 'suspended')
            '''
        )
        org_ids = [row['id'] for row in cur.fetchall()]

    count = 0
    for org_id in org_ids:
        try:
            calculate_organization_trust_score(str(org_id))
            count += 1
        except Exception as e:
            logger.error(f"Failed to calculate trust score for {org_id}: {e}")

    logger.info(f"[trust_score] Recalculated trust scores for {count} organizations")
    return count
