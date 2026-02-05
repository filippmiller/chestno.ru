"""
Verification Challenges Service

Allows consumers to challenge manufacturer claims and demand proof.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.db import get_connection
from app.schemas.notifications import NotificationEmitRequest
from app.services.notifications import emit_notification

logger = logging.getLogger(__name__)

CHALLENGE_CATEGORIES = [
    'organic', 'local', 'certified', 'ingredients',
    'origin', 'sustainability', 'health', 'freshness', 'other'
]


def create_challenge(
    organization_id: str,
    user_id: str,
    category: str,
    claim_text: str,
    challenge_question: str,
    product_id: Optional[str] = None,
) -> dict:
    """Create a new verification challenge (starts in pending_moderation)."""
    if category not in CHALLENGE_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Invalid category. Must be one of: {CHALLENGE_CATEGORIES}'
        )

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify organization exists
        cur.execute('SELECT id, name FROM organizations WHERE id = %s', (organization_id,))
        org = cur.fetchone()
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Organization not found')

        # Verify product if provided
        if product_id:
            cur.execute(
                'SELECT id FROM products WHERE id = %s AND organization_id = %s',
                (product_id, organization_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Product not found')

        # Create challenge
        cur.execute(
            '''
            INSERT INTO verification_challenges (
                organization_id, product_id, challenger_user_id,
                category, claim_text, challenge_question, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'pending_moderation')
            RETURNING *
            ''',
            (organization_id, product_id, user_id, category, claim_text, challenge_question)
        )
        challenge = dict(cur.fetchone())
        conn.commit()

        logger.info(f"[challenges] Created challenge {challenge['id']} for org {organization_id}")
        return challenge


def list_organization_challenges(
    organization_id: str,
    user_id: str,
    status_filter: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> tuple[List[dict], int]:
    """List challenges for an organization (for org dashboard)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Build query
        query = '''
            SELECT vc.*, u.email as challenger_email,
                   p.name as product_name
            FROM verification_challenges vc
            LEFT JOIN app_users u ON u.id = vc.challenger_user_id
            LEFT JOIN products p ON p.id = vc.product_id
            WHERE vc.organization_id = %s
        '''
        params = [organization_id]

        if status_filter:
            query += ' AND vc.status = %s'
            params.append(status_filter)

        # Count
        count_query = query.replace('SELECT vc.*, u.email as challenger_email, p.name as product_name', 'SELECT COUNT(*)')
        cur.execute(count_query, params)
        total = cur.fetchone()['count']

        # Fetch with pagination
        query += ' ORDER BY vc.created_at DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])
        cur.execute(query, params)
        challenges = [dict(row) for row in cur.fetchall()]

        return challenges, total


def list_public_challenges(
    organization_id: str,
    limit: int = 20,
    offset: int = 0
) -> tuple[List[dict], int]:
    """List public challenges (active, responded, expired) for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        query = '''
            SELECT vc.id, vc.category, vc.claim_text, vc.challenge_question,
                   vc.status, vc.created_at, vc.expires_at,
                   p.name as product_name,
                   cr.response_text, cr.evidence_urls, cr.created_at as response_at
            FROM verification_challenges vc
            LEFT JOIN products p ON p.id = vc.product_id
            LEFT JOIN challenge_responses cr ON cr.challenge_id = vc.id
            WHERE vc.organization_id = %s
            AND vc.status IN ('active', 'responded', 'expired')
            ORDER BY vc.created_at DESC
            LIMIT %s OFFSET %s
        '''
        cur.execute(query, (organization_id, limit, offset))
        challenges = [dict(row) for row in cur.fetchall()]

        # Count
        cur.execute(
            '''
            SELECT COUNT(*) FROM verification_challenges
            WHERE organization_id = %s AND status IN ('active', 'responded', 'expired')
            ''',
            (organization_id,)
        )
        total = cur.fetchone()['count']

        return challenges, total


def approve_challenge(challenge_id: str, moderator_id: str) -> dict:
    """Approve a challenge and make it active (7-day countdown starts)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE verification_challenges
            SET status = 'active',
                expires_at = now() + INTERVAL '7 days',
                moderated_by = %s,
                moderated_at = now()
            WHERE id = %s AND status = 'pending_moderation'
            RETURNING *
            ''',
            (moderator_id, challenge_id)
        )
        challenge = cur.fetchone()
        if not challenge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found or not pending')

        # Notify organization
        try:
            emit_notification(NotificationEmitRequest(
                type_key='business.new_challenge',
                org_id=str(challenge['organization_id']),
                recipient_scope='organization',
                payload={
                    'challenge_id': str(challenge['id']),
                    'claim_text': challenge['claim_text'][:100],
                    'category': challenge['category'],
                }
            ))
        except Exception as e:
            logger.warning(f"Failed to send challenge notification: {e}")

        conn.commit()
        logger.info(f"[challenges] Approved challenge {challenge_id}")
        return dict(challenge)


def reject_challenge(challenge_id: str, moderator_id: str, reason: str) -> dict:
    """Reject a challenge (spam/abuse)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE verification_challenges
            SET status = 'rejected',
                moderated_by = %s,
                moderated_at = now(),
                moderation_notes = %s
            WHERE id = %s AND status = 'pending_moderation'
            RETURNING *
            ''',
            (moderator_id, reason, challenge_id)
        )
        challenge = cur.fetchone()
        if not challenge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found or not pending')

        conn.commit()
        logger.info(f"[challenges] Rejected challenge {challenge_id}")
        return dict(challenge)


def respond_to_challenge(
    challenge_id: str,
    user_id: str,
    response_text: str,
    evidence_urls: Optional[List[dict]] = None
) -> dict:
    """Submit a response to a challenge from the organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get challenge and verify user has permission
        cur.execute(
            '''
            SELECT vc.*, om.role
            FROM verification_challenges vc
            JOIN organization_members om ON om.organization_id = vc.organization_id
            WHERE vc.id = %s AND om.user_id = %s
            ''',
            (challenge_id, user_id)
        )
        challenge = cur.fetchone()
        if not challenge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')

        if challenge['role'] not in ('owner', 'admin', 'manager'):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')

        if challenge['status'] != 'active':
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Challenge is not active')

        # Create response
        cur.execute(
            '''
            INSERT INTO challenge_responses (challenge_id, responder_user_id, response_text, evidence_urls)
            VALUES (%s, %s, %s, %s)
            RETURNING *
            ''',
            (challenge_id, user_id, response_text, Jsonb(evidence_urls or []))
        )
        response = dict(cur.fetchone())

        # Update challenge status
        cur.execute(
            '''
            UPDATE verification_challenges
            SET status = 'responded'
            WHERE id = %s
            RETURNING challenger_user_id, claim_text
            ''',
            (challenge_id,)
        )
        updated = cur.fetchone()

        # Notify challenger
        try:
            emit_notification(NotificationEmitRequest(
                type_key='consumer.challenge_response',
                recipient_user_id=str(updated['challenger_user_id']),
                recipient_scope='user',
                payload={
                    'challenge_id': challenge_id,
                    'claim_text': updated['claim_text'][:100],
                }
            ))
        except Exception as e:
            logger.warning(f"Failed to send response notification: {e}")

        conn.commit()
        logger.info(f"[challenges] Responded to challenge {challenge_id}")
        return response


def vote_on_challenge(challenge_id: str, user_id: str, vote_type: str) -> dict:
    """Vote on whether a challenge response was satisfactory."""
    if vote_type not in ('satisfied', 'unsatisfied'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid vote type')

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify challenge exists and has response
        cur.execute(
            'SELECT status FROM verification_challenges WHERE id = %s',
            (challenge_id,)
        )
        challenge = cur.fetchone()
        if not challenge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')

        if challenge['status'] != 'responded':
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Challenge has no response yet')

        # Upsert vote
        cur.execute(
            '''
            INSERT INTO challenge_votes (challenge_id, user_id, vote_type)
            VALUES (%s, %s, %s)
            ON CONFLICT (challenge_id, user_id) DO UPDATE SET
                vote_type = EXCLUDED.vote_type
            RETURNING *
            ''',
            (challenge_id, user_id, vote_type)
        )
        vote = dict(cur.fetchone())
        conn.commit()

        return vote


def get_challenge_stats(organization_id: str) -> dict:
    """Get challenge statistics for an organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending_moderation') as pending,
                COUNT(*) FILTER (WHERE status = 'active') as active,
                COUNT(*) FILTER (WHERE status = 'responded') as responded,
                COUNT(*) FILTER (WHERE status = 'expired') as expired
            FROM verification_challenges
            WHERE organization_id = %s
            ''',
            (organization_id,)
        )
        stats = dict(cur.fetchone())

        # Calculate response rate
        total_needing_response = stats['responded'] + stats['expired']
        stats['response_rate'] = (
            round(stats['responded'] / total_needing_response * 100, 1)
            if total_needing_response > 0 else 100
        )

        return stats


def expire_old_challenges() -> int:
    """Expire challenges that have passed their deadline (run by cron)."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            '''
            UPDATE verification_challenges
            SET status = 'expired'
            WHERE status = 'active' AND expires_at < now()
            '''
        )
        expired_count = cur.rowcount
        conn.commit()

        if expired_count > 0:
            logger.info(f"[challenges] Expired {expired_count} challenges")

        return expired_count
