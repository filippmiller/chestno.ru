"""
Review Votes Service
Business logic for the review helpfulness voting system
"""

import json
from typing import Literal

from app.core.db import get_connection
from psycopg.rows import dict_row


def cast_vote(
    review_id: str,
    voter_user_id: str,
    vote_type: Literal['up', 'down', 'none'],
) -> dict:
    """
    Cast or update a vote on a review.

    Uses the database function cast_review_vote which handles:
    - Anti-manipulation (no self-voting)
    - Vote weight calculation
    - Automatic count updates via trigger

    Args:
        review_id: The review to vote on
        voter_user_id: The user casting the vote
        vote_type: 'up', 'down', or 'none' to remove vote

    Returns:
        Dict with success, action, vote_type, vote_weight, previous_vote

    Raises:
        ValueError: If review not found or invalid vote type
        PermissionError: If trying to vote on own review
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Set the current user for RLS
            cur.execute('SELECT set_config(%s, %s, true)', ('request.jwt.claim.sub', voter_user_id))

            try:
                cur.execute(
                    'SELECT cast_review_vote(%s, %s) as result',
                    (review_id, vote_type)
                )
                row = cur.fetchone()
                if row and row['result']:
                    result = row['result']
                    if isinstance(result, str):
                        result = json.loads(result)
                    return result
                raise ValueError('No result from vote function')
            except Exception as e:
                error_msg = str(e)
                if 'Cannot vote on your own review' in error_msg:
                    raise PermissionError('Cannot vote on your own review')
                if 'Authentication required' in error_msg:
                    raise PermissionError('Authentication required')
                if 'Review not found' in error_msg:
                    raise ValueError('Review not found')
                if 'Can only vote on approved reviews' in error_msg:
                    raise ValueError('Can only vote on approved reviews')
                raise


def get_user_vote(review_id: str, user_id: str) -> str | None:
    """
    Get the user's current vote on a review.

    Args:
        review_id: The review ID
        user_id: The user ID

    Returns:
        'up', 'down', or None if no vote
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT set_config(%s, %s, true)', ('request.jwt.claim.sub', user_id))
            cur.execute('SELECT get_user_review_vote(%s) as vote_type', (review_id,))
            row = cur.fetchone()
            return row['vote_type'] if row else None


def get_user_votes_batch(review_ids: list[str], user_id: str) -> list[dict]:
    """
    Get user's votes for multiple reviews (batch).

    Args:
        review_ids: List of review IDs
        user_id: The user ID

    Returns:
        List of {review_id, vote_type} dicts
    """
    if not review_ids:
        return []

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT set_config(%s, %s, true)', ('request.jwt.claim.sub', user_id))
            cur.execute(
                'SELECT * FROM get_user_review_votes(%s::uuid[])',
                (review_ids,)
            )
            return [dict(row) for row in cur.fetchall()]


def list_reviews_with_votes(
    organization_id: str | None = None,
    product_id: str | None = None,
    sort: Literal['most_helpful', 'most_recent', 'highest_rated', 'lowest_rated'] = 'most_recent',
    limit: int = 20,
    offset: int = 0,
    user_id: str | None = None,
) -> tuple[list[dict], int]:
    """
    List reviews with vote counts and optional user vote.

    Args:
        organization_id: Filter by organization
        product_id: Filter by product
        sort: Sort option
        limit: Max results
        offset: Pagination offset
        user_id: Current user for fetching their votes

    Returns:
        Tuple of (reviews list, total count)
    """
    # Build ORDER BY clause
    order_map = {
        'most_helpful': 'wilson_score DESC, upvote_count DESC',
        'most_recent': 'created_at DESC',
        'highest_rated': 'rating DESC, wilson_score DESC',
        'lowest_rated': 'rating ASC, wilson_score DESC',
    }
    order_by = order_map.get(sort, 'created_at DESC')

    # Build WHERE conditions
    conditions = ['status = %s']
    params: list = ['approved']

    if organization_id:
        conditions.append('organization_id = %s')
        params.append(organization_id)

    if product_id:
        conditions.append('product_id = %s')
        params.append(product_id)

    where_clause = ' AND '.join(conditions)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Set user context if provided
            if user_id:
                cur.execute('SELECT set_config(%s, %s, true)', ('request.jwt.claim.sub', user_id))

            # Get total count
            cur.execute(f'SELECT COUNT(*) as total FROM reviews WHERE {where_clause}', params)
            total = cur.fetchone()['total']

            # Get reviews
            cur.execute(
                f'''
                SELECT
                    id, organization_id, product_id, author_user_id,
                    rating, title, body, status,
                    upvote_count, downvote_count, helpful_count, wilson_score,
                    is_verified_purchase,
                    created_at, updated_at
                FROM reviews
                WHERE {where_clause}
                ORDER BY {order_by}
                LIMIT %s OFFSET %s
                ''',
                params + [limit, offset]
            )
            reviews = [dict(row) for row in cur.fetchall()]

            # Fetch user votes if authenticated
            if user_id and reviews:
                review_ids = [r['id'] for r in reviews]
                user_votes = get_user_votes_batch(review_ids, user_id)
                votes_map = {v['review_id']: v['vote_type'] for v in user_votes}

                for review in reviews:
                    review['user_vote'] = votes_map.get(review['id'])

            return reviews, total


def check_verified_purchase(
    user_id: str,
    organization_id: str,
    product_id: str | None = None,
) -> bool:
    """
    Check if user has a verified purchase for an organization/product.

    Args:
        user_id: The user ID
        organization_id: The organization ID
        product_id: Optional product ID for specific product check

    Returns:
        True if verified purchase exists
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            if product_id:
                cur.execute(
                    '''
                    SELECT EXISTS (
                        SELECT 1 FROM verified_purchases
                        WHERE user_id = %s
                          AND organization_id = %s
                          AND (product_id IS NULL OR product_id = %s)
                    ) as exists
                    ''',
                    (user_id, organization_id, product_id)
                )
            else:
                cur.execute(
                    '''
                    SELECT EXISTS (
                        SELECT 1 FROM verified_purchases
                        WHERE user_id = %s
                          AND organization_id = %s
                    ) as exists
                    ''',
                    (user_id, organization_id)
                )
            row = cur.fetchone()
            return row['exists'] if row else False


def create_verified_purchase(
    user_id: str,
    organization_id: str,
    product_id: str | None = None,
    verification_method: Literal['qr_scan', 'receipt_upload', 'order_integration', 'manual_approval'] = 'qr_scan',
    evidence_data: dict | None = None,
    purchase_date: str | None = None,
    verified_by: str | None = None,
) -> dict:
    """
    Create a verified purchase record.

    Args:
        user_id: The user ID
        organization_id: The organization ID
        product_id: Optional product ID
        verification_method: How the purchase was verified
        evidence_data: Method-specific evidence
        purchase_date: Date of purchase
        verified_by: Admin who verified (for manual_approval)

    Returns:
        The created verified purchase record
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                INSERT INTO verified_purchases (
                    user_id, organization_id, product_id,
                    verification_method, evidence_data, purchase_date, verified_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, organization_id, product_id)
                DO UPDATE SET
                    verification_method = EXCLUDED.verification_method,
                    evidence_data = EXCLUDED.evidence_data,
                    verified_at = now()
                RETURNING *
                ''',
                (
                    user_id,
                    organization_id,
                    product_id,
                    verification_method,
                    json.dumps(evidence_data) if evidence_data else None,
                    purchase_date,
                    verified_by,
                )
            )
            return dict(cur.fetchone())


def mark_review_verified(review_id: str) -> None:
    """
    Mark a review as from a verified purchaser.

    Called when a review is created by a user with a verified purchase.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE reviews SET is_verified_purchase = true WHERE id = %s',
                (review_id,)
            )
