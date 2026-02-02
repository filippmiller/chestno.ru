"""
Product Stories Service

Comprehensive service for managing product stories - rich multimedia content
about products and their production process.

Core Features:
- CRUD for stories
- CRUD for chapters
- Track story views and interactions
- Get story analytics
- Publish/unpublish workflow

Database tables:
- product_stories: Main story records
- story_chapters: Individual chapters within stories
- story_interactions: User interaction tracking
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection

logger = logging.getLogger(__name__)

# Simple in-memory cache with expiration
_cache: dict[str, tuple[any, datetime]] = {}
CACHE_TTL_SECONDS = 60


# ============================================================
# CACHE UTILITIES
# ============================================================

def _get_cached(key: str) -> Optional[any]:
    """Get value from cache if not expired"""
    if key in _cache:
        value, expires_at = _cache[key]
        if datetime.utcnow() < expires_at:
            return value
        del _cache[key]
    return None


def _set_cache(key: str, value: any, ttl_seconds: int = CACHE_TTL_SECONDS) -> None:
    """Set value in cache with expiration"""
    expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
    _cache[key] = (value, expires_at)


def _invalidate_cache(pattern: str) -> None:
    """Invalidate all cache entries matching pattern"""
    keys_to_delete = [k for k in _cache.keys() if pattern in k]
    for key in keys_to_delete:
        del _cache[key]


# ============================================================
# STORY CRUD
# ============================================================

def get_story_for_product(product_id: str, include_drafts: bool = False) -> Optional[dict]:
    """
    Get the story for a specific product.

    Args:
        product_id: Product UUID
        include_drafts: Whether to include draft stories (for org members)

    Returns:
        Story record with chapters, or None if not found
    """
    cache_key = f"story:product:{product_id}:{include_drafts}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build status filter
            if include_drafts:
                status_filter = "status IN ('published', 'draft')"
            else:
                status_filter = "status = 'published'"

            cur.execute(
                f'''
                SELECT
                    ps.id::text,
                    ps.product_id::text,
                    ps.organization_id::text,
                    ps.created_by::text,
                    ps.title,
                    ps.description,
                    ps.cover_image,
                    ps.status,
                    ps.published_at,
                    ps.view_count,
                    ps.completion_count,
                    ps.avg_time_spent_seconds,
                    ps.metadata,
                    ps.created_at,
                    ps.updated_at,
                    p.name as product_name,
                    p.slug as product_slug,
                    p.main_image_url as product_image
                FROM public.product_stories ps
                JOIN public.products p ON p.id = ps.product_id
                WHERE ps.product_id = %s AND {status_filter}
                ORDER BY
                    CASE ps.status WHEN 'published' THEN 0 ELSE 1 END,
                    ps.updated_at DESC
                LIMIT 1
                ''',
                (product_id,)
            )
            story = cur.fetchone()

            if not story:
                return None

            story_dict = dict(story)

            # Get chapters
            cur.execute(
                '''
                SELECT
                    id::text,
                    story_id::text,
                    order_index,
                    title,
                    content_type,
                    content,
                    media_url,
                    media_urls,
                    duration_seconds,
                    quiz_question,
                    quiz_options,
                    quiz_explanation,
                    background_color,
                    text_color,
                    metadata,
                    created_at,
                    updated_at
                FROM public.story_chapters
                WHERE story_id = %s
                ORDER BY order_index
                ''',
                (story_dict['id'],)
            )
            chapters = cur.fetchall()
            story_dict['chapters'] = [dict(ch) for ch in chapters]

            _set_cache(cache_key, story_dict)
            return story_dict

    except Exception as e:
        logger.error(f"[product_stories] Error getting story for product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving story: {str(e)}"
        )


def get_story_by_id(story_id: str) -> Optional[dict]:
    """
    Get a story by its ID with chapters.

    Args:
        story_id: Story UUID

    Returns:
        Story record with chapters, or None if not found
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    ps.id::text,
                    ps.product_id::text,
                    ps.organization_id::text,
                    ps.created_by::text,
                    ps.title,
                    ps.description,
                    ps.cover_image,
                    ps.status,
                    ps.published_at,
                    ps.view_count,
                    ps.completion_count,
                    ps.avg_time_spent_seconds,
                    ps.metadata,
                    ps.created_at,
                    ps.updated_at,
                    p.name as product_name,
                    p.slug as product_slug,
                    p.main_image_url as product_image
                FROM public.product_stories ps
                JOIN public.products p ON p.id = ps.product_id
                WHERE ps.id = %s
                ''',
                (story_id,)
            )
            story = cur.fetchone()

            if not story:
                return None

            story_dict = dict(story)

            # Get chapters
            cur.execute(
                '''
                SELECT
                    id::text,
                    story_id::text,
                    order_index,
                    title,
                    content_type,
                    content,
                    media_url,
                    media_urls,
                    duration_seconds,
                    quiz_question,
                    quiz_options,
                    quiz_explanation,
                    background_color,
                    text_color,
                    metadata,
                    created_at,
                    updated_at
                FROM public.story_chapters
                WHERE story_id = %s
                ORDER BY order_index
                ''',
                (story_id,)
            )
            chapters = cur.fetchall()
            story_dict['chapters'] = [dict(ch) for ch in chapters]

            return story_dict

    except Exception as e:
        logger.error(f"[product_stories] Error getting story {story_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving story: {str(e)}"
        )


def list_stories_for_organization(
    organization_id: str,
    page: int = 1,
    per_page: int = 20,
    status_filter: Optional[str] = None
) -> tuple[list[dict], int]:
    """
    List all stories for an organization.

    Args:
        organization_id: Organization UUID
        page: Page number (1-indexed)
        per_page: Items per page (max 100)
        status_filter: Optional status filter ('draft', 'published', 'archived')

    Returns:
        Tuple of (stories list, total count)
    """
    try:
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build WHERE clause
            where_clauses = ["ps.organization_id = %s"]
            params = [organization_id]

            if status_filter:
                where_clauses.append("ps.status = %s")
                params.append(status_filter)

            where_sql = " AND ".join(where_clauses)

            # Get total count
            cur.execute(
                f'SELECT COUNT(*) as total FROM public.product_stories ps WHERE {where_sql}',
                params
            )
            total = cur.fetchone()['total']

            # Get stories
            cur.execute(
                f'''
                SELECT
                    ps.id::text,
                    ps.product_id::text,
                    ps.organization_id::text,
                    ps.created_by::text,
                    ps.title,
                    ps.description,
                    ps.cover_image,
                    ps.status,
                    ps.published_at,
                    ps.view_count,
                    ps.completion_count,
                    ps.avg_time_spent_seconds,
                    ps.created_at,
                    ps.updated_at,
                    p.name as product_name,
                    p.slug as product_slug,
                    p.main_image_url as product_image,
                    (SELECT COUNT(*) FROM public.story_chapters WHERE story_id = ps.id) as chapter_count
                FROM public.product_stories ps
                JOIN public.products p ON p.id = ps.product_id
                WHERE {where_sql}
                ORDER BY ps.updated_at DESC
                LIMIT %s OFFSET %s
                ''',
                params + [per_page, offset]
            )
            stories = cur.fetchall()

            return [dict(s) for s in stories], total

    except Exception as e:
        logger.error(f"[product_stories] Error listing stories for org {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing stories: {str(e)}"
        )


def create_story(
    product_id: str,
    organization_id: str,
    title: str,
    description: Optional[str] = None,
    cover_image: Optional[str] = None,
    created_by: Optional[str] = None,
    chapters: Optional[list[dict]] = None
) -> dict:
    """
    Create a new product story.

    Args:
        product_id: Product UUID
        organization_id: Organization UUID
        title: Story title
        description: Story description
        cover_image: Cover image URL
        created_by: User UUID who created the story
        chapters: Optional list of chapter data

    Returns:
        Created story record
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Verify product belongs to organization
            cur.execute(
                'SELECT id FROM public.products WHERE id = %s AND organization_id = %s',
                (product_id, organization_id)
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Product not found or does not belong to organization"
                )

            # Create story
            cur.execute(
                '''
                INSERT INTO public.product_stories (
                    product_id,
                    organization_id,
                    created_by,
                    title,
                    description,
                    cover_image,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'draft')
                RETURNING
                    id::text,
                    product_id::text,
                    organization_id::text,
                    created_by::text,
                    title,
                    description,
                    cover_image,
                    status,
                    published_at,
                    view_count,
                    completion_count,
                    avg_time_spent_seconds,
                    metadata,
                    created_at,
                    updated_at
                ''',
                (product_id, organization_id, created_by, title, description, cover_image)
            )
            story = dict(cur.fetchone())

            # Create chapters if provided
            if chapters:
                for idx, chapter_data in enumerate(chapters):
                    create_chapter(
                        story_id=story['id'],
                        order_index=chapter_data.get('order_index', idx),
                        title=chapter_data.get('title'),
                        content_type=chapter_data.get('content_type', 'TEXT'),
                        content=chapter_data.get('content'),
                        media_url=chapter_data.get('media_url'),
                        media_urls=chapter_data.get('media_urls'),
                        duration_seconds=chapter_data.get('duration_seconds', 5),
                        quiz_question=chapter_data.get('quiz_question'),
                        quiz_options=chapter_data.get('quiz_options'),
                        quiz_explanation=chapter_data.get('quiz_explanation'),
                        background_color=chapter_data.get('background_color'),
                        text_color=chapter_data.get('text_color'),
                        _conn=conn
                    )

            conn.commit()

            _invalidate_cache(f"story:product:{product_id}")

            logger.info(f"[product_stories] Created story {story['id']} for product {product_id}")

            # Fetch full story with chapters
            return get_story_by_id(story['id'])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[product_stories] Error creating story for product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating story: {str(e)}"
        )


def update_story(
    story_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    cover_image: Optional[str] = None,
    status: Optional[str] = None
) -> dict:
    """
    Update a product story.

    Args:
        story_id: Story UUID
        title: New title (optional)
        description: New description (optional)
        cover_image: New cover image URL (optional)
        status: New status (optional)

    Returns:
        Updated story record
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build SET clause dynamically
            updates = []
            params = []

            if title is not None:
                updates.append("title = %s")
                params.append(title)

            if description is not None:
                updates.append("description = %s")
                params.append(description)

            if cover_image is not None:
                updates.append("cover_image = %s")
                params.append(cover_image)

            if status is not None:
                updates.append("status = %s")
                params.append(status)
                if status == 'published':
                    updates.append("published_at = now()")

            if not updates:
                # Nothing to update, just return current story
                return get_story_by_id(story_id)

            params.append(story_id)

            cur.execute(
                f'''
                UPDATE public.product_stories
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING product_id::text
                ''',
                params
            )
            result = cur.fetchone()

            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Story not found"
                )

            conn.commit()

            _invalidate_cache(f"story:product:{result['product_id']}")
            _invalidate_cache(f"story:{story_id}")

            logger.info(f"[product_stories] Updated story {story_id}")

            return get_story_by_id(story_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[product_stories] Error updating story {story_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating story: {str(e)}"
        )


def delete_story(story_id: str) -> bool:
    """
    Delete a product story and all its chapters.

    Args:
        story_id: Story UUID

    Returns:
        True if deleted, False if not found
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get product_id for cache invalidation
            cur.execute(
                'SELECT product_id::text FROM public.product_stories WHERE id = %s',
                (story_id,)
            )
            result = cur.fetchone()

            if not result:
                return False

            product_id = result['product_id']

            # Delete (chapters cascade automatically)
            cur.execute('DELETE FROM public.product_stories WHERE id = %s', (story_id,))
            conn.commit()

            _invalidate_cache(f"story:product:{product_id}")
            _invalidate_cache(f"story:{story_id}")

            logger.info(f"[product_stories] Deleted story {story_id}")

            return True

    except Exception as e:
        logger.error(f"[product_stories] Error deleting story {story_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting story: {str(e)}"
        )


# ============================================================
# CHAPTER CRUD
# ============================================================

def create_chapter(
    story_id: str,
    order_index: int = 0,
    title: Optional[str] = None,
    content_type: str = 'TEXT',
    content: Optional[str] = None,
    media_url: Optional[str] = None,
    media_urls: Optional[list[str]] = None,
    duration_seconds: int = 5,
    quiz_question: Optional[str] = None,
    quiz_options: Optional[list[dict]] = None,
    quiz_explanation: Optional[str] = None,
    background_color: Optional[str] = None,
    text_color: Optional[str] = None,
    _conn=None
) -> dict:
    """
    Create a new story chapter.

    Args:
        story_id: Story UUID
        order_index: Position in story
        title: Chapter title
        content_type: Type of content
        content: Main content
        media_url: URL for images/videos
        media_urls: URLs for gallery type
        duration_seconds: Auto-advance time
        quiz_question: Quiz question (for QUIZ type)
        quiz_options: Quiz options (for QUIZ type)
        quiz_explanation: Quiz explanation (for QUIZ type)
        background_color: Background color
        text_color: Text color
        _conn: Optional connection (for transaction use)

    Returns:
        Created chapter record
    """
    import json

    def execute(conn):
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                INSERT INTO public.story_chapters (
                    story_id,
                    order_index,
                    title,
                    content_type,
                    content,
                    media_url,
                    media_urls,
                    duration_seconds,
                    quiz_question,
                    quiz_options,
                    quiz_explanation,
                    background_color,
                    text_color
                )
                VALUES (%s, %s, %s, %s::story_content_type, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                    id::text,
                    story_id::text,
                    order_index,
                    title,
                    content_type,
                    content,
                    media_url,
                    media_urls,
                    duration_seconds,
                    quiz_question,
                    quiz_options,
                    quiz_explanation,
                    background_color,
                    text_color,
                    metadata,
                    created_at,
                    updated_at
                ''',
                (
                    story_id,
                    order_index,
                    title,
                    content_type,
                    content,
                    media_url,
                    media_urls,
                    duration_seconds,
                    quiz_question,
                    json.dumps(quiz_options) if quiz_options else None,
                    quiz_explanation,
                    background_color,
                    text_color
                )
            )
            return dict(cur.fetchone())

    try:
        if _conn:
            return execute(_conn)
        else:
            with get_connection() as conn:
                result = execute(conn)
                conn.commit()

                _invalidate_cache(f"story:{story_id}")

                logger.info(f"[product_stories] Created chapter for story {story_id}")

                return result

    except Exception as e:
        logger.error(f"[product_stories] Error creating chapter for story {story_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating chapter: {str(e)}"
        )


def update_chapter(
    chapter_id: str,
    **kwargs
) -> dict:
    """
    Update a story chapter.

    Args:
        chapter_id: Chapter UUID
        **kwargs: Fields to update

    Returns:
        Updated chapter record
    """
    import json

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build SET clause dynamically
            updates = []
            params = []

            for key, value in kwargs.items():
                if value is not None and key in [
                    'order_index', 'title', 'content_type', 'content',
                    'media_url', 'media_urls', 'duration_seconds',
                    'quiz_question', 'quiz_options', 'quiz_explanation',
                    'background_color', 'text_color'
                ]:
                    if key == 'content_type':
                        updates.append(f"{key} = %s::story_content_type")
                    elif key == 'quiz_options':
                        updates.append(f"{key} = %s::jsonb")
                        value = json.dumps(value) if value else None
                    else:
                        updates.append(f"{key} = %s")
                    params.append(value)

            if not updates:
                # Nothing to update
                cur.execute(
                    '''
                    SELECT
                        id::text, story_id::text, order_index, title,
                        content_type, content, media_url, media_urls,
                        duration_seconds, quiz_question, quiz_options,
                        quiz_explanation, background_color, text_color,
                        metadata, created_at, updated_at
                    FROM public.story_chapters
                    WHERE id = %s
                    ''',
                    (chapter_id,)
                )
                return dict(cur.fetchone())

            params.append(chapter_id)

            cur.execute(
                f'''
                UPDATE public.story_chapters
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING
                    id::text, story_id::text, order_index, title,
                    content_type, content, media_url, media_urls,
                    duration_seconds, quiz_question, quiz_options,
                    quiz_explanation, background_color, text_color,
                    metadata, created_at, updated_at
                ''',
                params
            )
            result = cur.fetchone()

            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Chapter not found"
                )

            result_dict = dict(result)
            conn.commit()

            _invalidate_cache(f"story:{result_dict['story_id']}")

            logger.info(f"[product_stories] Updated chapter {chapter_id}")

            return result_dict

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[product_stories] Error updating chapter {chapter_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating chapter: {str(e)}"
        )


def delete_chapter(chapter_id: str) -> bool:
    """
    Delete a story chapter.

    Args:
        chapter_id: Chapter UUID

    Returns:
        True if deleted, False if not found
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT story_id::text FROM public.story_chapters WHERE id = %s',
                (chapter_id,)
            )
            result = cur.fetchone()

            if not result:
                return False

            story_id = result['story_id']

            cur.execute('DELETE FROM public.story_chapters WHERE id = %s', (chapter_id,))
            conn.commit()

            _invalidate_cache(f"story:{story_id}")

            logger.info(f"[product_stories] Deleted chapter {chapter_id}")

            return True

    except Exception as e:
        logger.error(f"[product_stories] Error deleting chapter {chapter_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting chapter: {str(e)}"
        )


def reorder_chapters(story_id: str, chapter_ids: list[str]) -> list[dict]:
    """
    Reorder chapters in a story.

    Args:
        story_id: Story UUID
        chapter_ids: Ordered list of chapter IDs

    Returns:
        List of updated chapters
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            for idx, chapter_id in enumerate(chapter_ids):
                cur.execute(
                    '''
                    UPDATE public.story_chapters
                    SET order_index = %s
                    WHERE id = %s AND story_id = %s
                    ''',
                    (idx, chapter_id, story_id)
                )

            conn.commit()

            _invalidate_cache(f"story:{story_id}")

            # Return updated chapters
            cur.execute(
                '''
                SELECT
                    id::text, story_id::text, order_index, title,
                    content_type, content, media_url, media_urls,
                    duration_seconds, quiz_question, quiz_options,
                    quiz_explanation, background_color, text_color,
                    metadata, created_at, updated_at
                FROM public.story_chapters
                WHERE story_id = %s
                ORDER BY order_index
                ''',
                (story_id,)
            )
            return [dict(ch) for ch in cur.fetchall()]

    except Exception as e:
        logger.error(f"[product_stories] Error reordering chapters for story {story_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reordering chapters: {str(e)}"
        )


# ============================================================
# INTERACTIONS
# ============================================================

def track_interaction(
    story_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    chapter_index: Optional[int] = None,
    time_spent: Optional[int] = None,
    quiz_answer: Optional[dict] = None,
    completed: bool = False,
    device_type: Optional[str] = None,
    referrer: Optional[str] = None
) -> dict:
    """
    Track user interaction with a story.

    Args:
        story_id: Story UUID
        user_id: User UUID (for authenticated users)
        session_id: Session ID (for anonymous users)
        chapter_index: Current chapter index
        time_spent: Time spent on current chapter (seconds)
        quiz_answer: Quiz answer data
        completed: Whether story was completed
        device_type: Device type
        referrer: Referrer URL

    Returns:
        Updated interaction record
    """
    import json

    if not user_id and not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either user_id or session_id is required"
        )

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Try to find existing interaction
            if user_id:
                cur.execute(
                    '''
                    SELECT id, completed_chapters, total_time_spent, quiz_answers
                    FROM public.story_interactions
                    WHERE story_id = %s AND user_id = %s
                    ''',
                    (story_id, user_id)
                )
            else:
                cur.execute(
                    '''
                    SELECT id, completed_chapters, total_time_spent, quiz_answers
                    FROM public.story_interactions
                    WHERE story_id = %s AND session_id = %s AND user_id IS NULL
                    ''',
                    (story_id, session_id)
                )

            existing = cur.fetchone()

            if existing:
                # Update existing interaction
                completed_chapters = existing['completed_chapters'] or []
                if chapter_index is not None and chapter_index not in completed_chapters:
                    completed_chapters.append(chapter_index)

                total_time = (existing['total_time_spent'] or 0) + (time_spent or 0)

                quiz_answers = existing['quiz_answers'] or {}
                if quiz_answer:
                    quiz_answers[quiz_answer['chapter_id']] = quiz_answer['selected_option_id']

                cur.execute(
                    '''
                    UPDATE public.story_interactions
                    SET
                        completed_chapters = %s,
                        last_chapter_index = COALESCE(%s, last_chapter_index),
                        total_time_spent = %s,
                        quiz_answers = %s,
                        completed_at = CASE WHEN %s THEN now() ELSE completed_at END,
                        last_activity_at = now()
                    WHERE id = %s
                    RETURNING
                        id::text, story_id::text, user_id::text, session_id,
                        completed_chapters, last_chapter_index, total_time_spent,
                        completed_at, quiz_answers, quiz_score, device_type,
                        referrer, started_at, last_activity_at
                    ''',
                    (
                        completed_chapters,
                        chapter_index,
                        total_time,
                        json.dumps(quiz_answers),
                        completed,
                        existing['id']
                    )
                )
            else:
                # Create new interaction
                completed_chapters = [chapter_index] if chapter_index is not None else []
                quiz_answers = {}
                if quiz_answer:
                    quiz_answers[quiz_answer['chapter_id']] = quiz_answer['selected_option_id']

                cur.execute(
                    '''
                    INSERT INTO public.story_interactions (
                        story_id, user_id, session_id, completed_chapters,
                        last_chapter_index, total_time_spent, completed_at,
                        quiz_answers, device_type, referrer
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING
                        id::text, story_id::text, user_id::text, session_id,
                        completed_chapters, last_chapter_index, total_time_spent,
                        completed_at, quiz_answers, quiz_score, device_type,
                        referrer, started_at, last_activity_at
                    ''',
                    (
                        story_id,
                        user_id,
                        session_id,
                        completed_chapters,
                        chapter_index or 0,
                        time_spent or 0,
                        datetime.utcnow() if completed else None,
                        json.dumps(quiz_answers) if quiz_answers else None,
                        device_type,
                        referrer
                    )
                )

            result = dict(cur.fetchone())
            conn.commit()

            return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[product_stories] Error tracking interaction for story {story_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error tracking interaction: {str(e)}"
        )


def get_user_interaction(
    story_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None
) -> Optional[dict]:
    """
    Get user's interaction with a story.

    Args:
        story_id: Story UUID
        user_id: User UUID
        session_id: Session ID

    Returns:
        Interaction record or None
    """
    if not user_id and not session_id:
        return None

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            if user_id:
                cur.execute(
                    '''
                    SELECT
                        id::text, story_id::text, user_id::text, session_id,
                        completed_chapters, last_chapter_index, total_time_spent,
                        completed_at, quiz_answers, quiz_score, device_type,
                        referrer, started_at, last_activity_at
                    FROM public.story_interactions
                    WHERE story_id = %s AND user_id = %s
                    ''',
                    (story_id, user_id)
                )
            else:
                cur.execute(
                    '''
                    SELECT
                        id::text, story_id::text, user_id::text, session_id,
                        completed_chapters, last_chapter_index, total_time_spent,
                        completed_at, quiz_answers, quiz_score, device_type,
                        referrer, started_at, last_activity_at
                    FROM public.story_interactions
                    WHERE story_id = %s AND session_id = %s AND user_id IS NULL
                    ''',
                    (story_id, session_id)
                )

            result = cur.fetchone()
            return dict(result) if result else None

    except Exception as e:
        logger.error(f"[product_stories] Error getting interaction: {e}")
        return None


# ============================================================
# ANALYTICS
# ============================================================

def get_story_analytics(story_id: str) -> dict:
    """
    Get analytics for a single story.

    Args:
        story_id: Story UUID

    Returns:
        Analytics data
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get story info
            cur.execute(
                '''
                SELECT id::text, title, view_count, completion_count, avg_time_spent_seconds
                FROM public.product_stories
                WHERE id = %s
                ''',
                (story_id,)
            )
            story = cur.fetchone()

            if not story:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Story not found"
                )

            story_dict = dict(story)

            # Calculate completion rate
            completion_rate = 0.0
            if story_dict['view_count'] > 0:
                completion_rate = (story_dict['completion_count'] / story_dict['view_count']) * 100

            # Get chapter drop-off data
            cur.execute(
                '''
                SELECT
                    unnest(completed_chapters) as chapter_index,
                    COUNT(*) as view_count
                FROM public.story_interactions
                WHERE story_id = %s
                GROUP BY chapter_index
                ORDER BY chapter_index
                ''',
                (story_id,)
            )
            chapter_drop_off = [dict(row) for row in cur.fetchall()]

            # Get device breakdown
            cur.execute(
                '''
                SELECT device_type, COUNT(*) as count
                FROM public.story_interactions
                WHERE story_id = %s AND device_type IS NOT NULL
                GROUP BY device_type
                ''',
                (story_id,)
            )
            device_breakdown = {row['device_type']: row['count'] for row in cur.fetchall()}

            # Get top referrers
            cur.execute(
                '''
                SELECT referrer, COUNT(*) as count
                FROM public.story_interactions
                WHERE story_id = %s AND referrer IS NOT NULL
                GROUP BY referrer
                ORDER BY count DESC
                LIMIT 10
                ''',
                (story_id,)
            )
            top_referrers = [dict(row) for row in cur.fetchall()]

            return {
                'story_id': story_dict['id'],
                'story_title': story_dict['title'],
                'view_count': story_dict['view_count'],
                'completion_count': story_dict['completion_count'],
                'completion_rate': round(completion_rate, 2),
                'avg_time_spent_seconds': story_dict['avg_time_spent_seconds'],
                'chapter_drop_off': chapter_drop_off,
                'device_breakdown': device_breakdown,
                'top_referrers': top_referrers,
                'quiz_performance': None  # TODO: Implement quiz analytics
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[product_stories] Error getting analytics for story {story_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting analytics: {str(e)}"
        )


def get_organization_stories_analytics(organization_id: str) -> dict:
    """
    Get aggregate analytics for all stories in an organization.

    Args:
        organization_id: Organization UUID

    Returns:
        Aggregate analytics data
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get aggregate stats
            cur.execute(
                '''
                SELECT
                    COUNT(*) as total_stories,
                    COUNT(*) FILTER (WHERE status = 'published') as published_stories,
                    COALESCE(SUM(view_count), 0) as total_views,
                    COALESCE(SUM(completion_count), 0) as total_completions,
                    COALESCE(AVG(avg_time_spent_seconds), 0)::integer as avg_time_spent_seconds
                FROM public.product_stories
                WHERE organization_id = %s
                ''',
                (organization_id,)
            )
            stats = dict(cur.fetchone())

            # Calculate avg completion rate
            avg_completion_rate = 0.0
            if stats['total_views'] > 0:
                avg_completion_rate = (stats['total_completions'] / stats['total_views']) * 100

            # Get top stories
            cur.execute(
                '''
                SELECT
                    id::text as story_id,
                    title as story_title,
                    view_count,
                    completion_count,
                    avg_time_spent_seconds,
                    CASE WHEN view_count > 0
                        THEN (completion_count::float / view_count) * 100
                        ELSE 0
                    END as completion_rate
                FROM public.product_stories
                WHERE organization_id = %s AND status = 'published'
                ORDER BY view_count DESC
                LIMIT 5
                ''',
                (organization_id,)
            )
            top_stories = [dict(row) for row in cur.fetchall()]

            # Get views over time (last 30 days)
            cur.execute(
                '''
                SELECT
                    DATE(si.started_at) as date,
                    COUNT(*) as views
                FROM public.story_interactions si
                JOIN public.product_stories ps ON ps.id = si.story_id
                WHERE ps.organization_id = %s
                AND si.started_at >= now() - interval '30 days'
                GROUP BY DATE(si.started_at)
                ORDER BY date
                ''',
                (organization_id,)
            )
            views_over_time = [
                {'date': str(row['date']), 'views': row['views']}
                for row in cur.fetchall()
            ]

            return {
                'organization_id': organization_id,
                'total_stories': stats['total_stories'],
                'published_stories': stats['published_stories'],
                'total_views': stats['total_views'],
                'total_completions': stats['total_completions'],
                'avg_completion_rate': round(avg_completion_rate, 2),
                'avg_time_spent_seconds': stats['avg_time_spent_seconds'],
                'top_stories': top_stories,
                'views_over_time': views_over_time
            }

    except Exception as e:
        logger.error(f"[product_stories] Error getting org analytics for {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting analytics: {str(e)}"
        )
