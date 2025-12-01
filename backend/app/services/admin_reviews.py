"""
Admin Reviews Service
Handles global review moderation for platform admins.
"""
from typing import Optional
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.reviews import Review, ReviewModeration
from app.services.admin_guard import assert_platform_admin
from app.services.reviews import _serialize_media


def list_all_reviews(
    user_id: str,
    organization_id: Optional[str] = None,
    status: Optional[str] = None,
    rating: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Review], int]:
    """
    List all reviews across all organizations (admin only).
    
    Args:
        user_id: Admin user ID
        organization_id: Optional filter by organization
        status: Optional filter by status (pending/approved/rejected)
        rating: Optional filter by rating (1-5)
        limit: Max number of reviews to return
        offset: Pagination offset
        
    Returns:
        Tuple of (reviews list, total count)
    """
    assert_platform_admin(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Build count query
            count_query = 'SELECT COUNT(*) as total FROM reviews WHERE 1=1'
            count_params = []
            
            if organization_id:
                count_query += ' AND organization_id = %s'
                count_params.append(organization_id)
            
            if status:
                count_query += ' AND status = %s'
                count_params.append(status)
            
            if rating:
                count_query += ' AND rating = %s'
                count_params.append(rating)
            
            cur.execute(count_query, count_params)
            total = cur.fetchone()['total']
            
            # Build main query
            query = '''
                SELECT id, organization_id, product_id, author_user_id, rating, title, body,
                       media, status, moderated_by, moderated_at, moderation_comment,
                       response, response_by, response_at,
                       created_at, updated_at
                FROM reviews
                WHERE 1=1
            '''
            params = []
            
            if organization_id:
                query += ' AND organization_id = %s'
                params.append(organization_id)
            
            if status:
                query += ' AND status = %s'
                params.append(status)
            
            if rating:
                query += ' AND rating = %s'
                params.append(rating)
            
            query += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
            params.extend([limit, offset])
            
            cur.execute(query, params)
            rows = cur.fetchall()
            
            reviews = []
            for row in rows:
                reviews.append(Review(
                    id=str(row['id']),
                    organization_id=str(row['organization_id']),
                    product_id=str(row['product_id']) if row['product_id'] else None,
                    author_user_id=str(row['author_user_id']),
                    rating=row['rating'],
                    title=row['title'],
                    body=row['body'],
                    media=_serialize_media(row['media']),
                    status=row['status'],
                    moderated_by=str(row['moderated_by']) if row['moderated_by'] else None,
                    moderated_at=row['moderated_at'],
                    moderation_comment=row['moderation_comment'],
                    response=row.get('response'),
                    response_by=str(row['response_by']) if row.get('response_by') else None,
                    response_at=row.get('response_at'),
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                ))
            
            return reviews, total


def admin_moderate_review(
    review_id: str,
    user_id: str,
    payload: ReviewModeration,
) -> Review:
    """
    Moderate any review as platform admin (can moderate reviews from any organization).
    
    Args:
        review_id: Review ID
        user_id: Admin user ID
        payload: Moderation action (status, comment)
        
    Returns:
        Updated Review
    """
    assert_platform_admin(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check review exists
            cur.execute('SELECT id, organization_id FROM reviews WHERE id = %s', (review_id,))
            review_row = cur.fetchone()
            if not review_row:
                raise ValueError('Review not found')
            
            # Update review
            cur.execute(
                '''
                UPDATE reviews
                SET status = %s,
                    moderation_comment = %s,
                    moderated_by = %s,
                    moderated_at = now(),
                    updated_at = now()
                WHERE id = %s
                RETURNING id, organization_id, product_id, author_user_id, rating, title, body,
                          media, status, moderated_by, moderated_at, moderation_comment,
                          response, response_by, response_at,
                          created_at, updated_at
                ''',
                (
                    payload.status,
                    payload.moderation_comment,
                    user_id,
                    review_id,
                ),
            )
            row = cur.fetchone()
            conn.commit()
            
            return Review(
                id=str(row['id']),
                organization_id=str(row['organization_id']),
                product_id=str(row['product_id']) if row['product_id'] else None,
                author_user_id=str(row['author_user_id']),
                rating=row['rating'],
                title=row['title'],
                body=row['body'],
                media=_serialize_media(row['media']),
                status=row['status'],
                moderated_by=str(row['moderated_by']) if row['moderated_by'] else None,
                moderated_at=row['moderated_at'],
                moderation_comment=row['moderation_comment'],
                response=row.get('response'),
                response_by=str(row['response_by']) if row.get('response_by') else None,
                response_at=row.get('response_at'),
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )


