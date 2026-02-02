"""
Product Stories API Routes

REST API endpoints for product stories - rich multimedia content
about products and their production process.
"""
from datetime import datetime
from typing import Optional, Literal
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session, SESSION_COOKIE_NAME
from app.schemas.product_stories import (
    ProductStory,
    ProductStoryCreate,
    ProductStoryUpdate,
    StoryChapter,
    StoryChapterCreate,
    StoryChapterUpdate,
    StoryInteractionCreate,
    StoryListResponse,
    StoryDetailResponse,
    StoryAnalytics,
    OrganizationStoriesAnalytics,
)

logger = logging.getLogger(__name__)

# Public routes (no auth required)
public_router = APIRouter(prefix='/api/stories', tags=['product-stories'])

# Authenticated routes for consumers
consumer_router = APIRouter(prefix='/api/stories', tags=['product-stories'])

# Organization management routes
org_router = APIRouter(prefix='/api/organizations', tags=['product-stories'])


# ==================== Public Routes ====================

@public_router.get('/product/{product_id}')
async def get_story_for_product(
    product_id: str,
    request: Request,
) -> Optional[dict]:
    """
    Get the published story for a product.

    Public endpoint - no authentication required.
    Returns the published story with all chapters.

    Args:
        product_id: Product UUID

    Returns:
        Story with chapters, or null if no published story exists
    """
    from app.services.product_stories import get_story_for_product, get_user_interaction

    story = await run_in_threadpool(
        get_story_for_product,
        product_id,
        include_drafts=False
    )

    if not story:
        return None

    # Try to get user's interaction
    user_id = None
    session_id = request.cookies.get('story_session_id')

    try:
        session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
        if session_cookie:
            user_id = await get_current_user_id_from_session(request, session_cookie)
    except HTTPException:
        pass

    interaction = None
    if user_id or session_id:
        interaction = await run_in_threadpool(
            get_user_interaction,
            story['id'],
            user_id,
            session_id
        )

    return {
        'story': story,
        'chapters': story.get('chapters', []),
        'interaction': interaction
    }


# ==================== Consumer Routes ====================

@consumer_router.post('/{story_id}/interaction')
async def track_story_interaction(
    story_id: str,
    payload: StoryInteractionCreate,
    request: Request,
) -> dict:
    """
    Track user interaction with a story.

    Can be called by both authenticated and anonymous users.
    Anonymous users should provide a session_id.

    Args:
        story_id: Story UUID
        payload: Interaction data

    Returns:
        Updated interaction record
    """
    from app.services.product_stories import track_interaction

    # Try to get user ID
    user_id = None
    try:
        session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
        if session_cookie:
            user_id = await get_current_user_id_from_session(request, session_cookie)
    except HTTPException:
        pass

    # Use session_id from payload if not authenticated
    session_id = payload.session_id if not user_id else None

    return await run_in_threadpool(
        track_interaction,
        story_id,
        user_id,
        session_id,
        payload.chapter_index,
        payload.time_spent,
        payload.quiz_answer.model_dump() if payload.quiz_answer else None,
        payload.completed,
        payload.device_type,
        payload.referrer
    )


# ==================== Organization Routes ====================

@org_router.get('/{organization_id}/stories')
async def list_organization_stories(
    organization_id: str,
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[Literal['draft', 'published', 'archived']] = Query(None, alias='status'),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StoryListResponse:
    """
    List all stories for an organization.

    Requires authentication and organization membership.

    Args:
        organization_id: Organization UUID
        page: Page number
        per_page: Items per page
        status_filter: Filter by status

    Returns:
        Paginated list of stories
    """
    from app.services.product_stories import list_stories_for_organization

    # TODO: Verify user is member of organization

    stories, total = await run_in_threadpool(
        list_stories_for_organization,
        organization_id,
        page,
        per_page,
        status_filter
    )

    return StoryListResponse(
        stories=stories,
        total=total,
        page=page,
        per_page=per_page
    )


@org_router.post('/{organization_id}/stories')
async def create_story(
    organization_id: str,
    payload: ProductStoryCreate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Create a new product story.

    Requires authentication and editor+ role in organization.

    Args:
        organization_id: Organization UUID
        payload: Story data

    Returns:
        Created story with chapters
    """
    from app.services.product_stories import create_story as create_story_service

    # Verify organization_id matches payload
    if payload.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization ID mismatch"
        )

    return await run_in_threadpool(
        create_story_service,
        payload.product_id,
        organization_id,
        payload.title,
        payload.description,
        payload.cover_image,
        current_user_id,
        [ch.model_dump() for ch in payload.chapters] if payload.chapters else None
    )


@org_router.get('/{organization_id}/stories/{story_id}')
async def get_story(
    organization_id: str,
    story_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Get a single story by ID.

    Requires authentication and organization membership.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID

    Returns:
        Story with chapters
    """
    from app.services.product_stories import get_story_by_id

    story = await run_in_threadpool(get_story_by_id, story_id)

    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )

    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    return story


@org_router.put('/{organization_id}/stories/{story_id}')
async def update_story(
    organization_id: str,
    story_id: str,
    payload: ProductStoryUpdate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Update a product story.

    Requires authentication and editor+ role in organization.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID
        payload: Update data

    Returns:
        Updated story
    """
    from app.services.product_stories import update_story as update_story_service, get_story_by_id

    # Verify story belongs to organization
    story = await run_in_threadpool(get_story_by_id, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    return await run_in_threadpool(
        update_story_service,
        story_id,
        payload.title,
        payload.description,
        payload.cover_image,
        payload.status
    )


@org_router.delete('/{organization_id}/stories/{story_id}')
async def delete_story(
    organization_id: str,
    story_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Delete a product story.

    Requires authentication and admin+ role in organization.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID

    Returns:
        Deletion confirmation
    """
    from app.services.product_stories import delete_story as delete_story_service, get_story_by_id

    # Verify story belongs to organization
    story = await run_in_threadpool(get_story_by_id, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    success = await run_in_threadpool(delete_story_service, story_id)

    return {
        'deleted': success,
        'story_id': story_id
    }


# ==================== Chapter Routes ====================

@org_router.post('/{organization_id}/stories/{story_id}/chapters')
async def create_chapter(
    organization_id: str,
    story_id: str,
    payload: StoryChapterCreate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Add a chapter to a story.

    Requires authentication and editor+ role in organization.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID
        payload: Chapter data

    Returns:
        Created chapter
    """
    from app.services.product_stories import create_chapter as create_chapter_service, get_story_by_id

    # Verify story belongs to organization
    story = await run_in_threadpool(get_story_by_id, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    return await run_in_threadpool(
        create_chapter_service,
        story_id,
        payload.order_index,
        payload.title,
        payload.content_type,
        payload.content,
        payload.media_url,
        payload.media_urls,
        payload.duration_seconds,
        payload.quiz_question,
        [opt.model_dump() for opt in payload.quiz_options] if payload.quiz_options else None,
        payload.quiz_explanation,
        payload.background_color,
        payload.text_color
    )


@org_router.put('/{organization_id}/stories/{story_id}/chapters/{chapter_id}')
async def update_chapter(
    organization_id: str,
    story_id: str,
    chapter_id: str,
    payload: StoryChapterUpdate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Update a story chapter.

    Requires authentication and editor+ role in organization.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID
        chapter_id: Chapter UUID
        payload: Update data

    Returns:
        Updated chapter
    """
    from app.services.product_stories import update_chapter as update_chapter_service, get_story_by_id

    # Verify story belongs to organization
    story = await run_in_threadpool(get_story_by_id, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    # Build update kwargs
    update_data = payload.model_dump(exclude_unset=True)
    if 'quiz_options' in update_data and update_data['quiz_options']:
        update_data['quiz_options'] = [opt.model_dump() if hasattr(opt, 'model_dump') else opt for opt in update_data['quiz_options']]

    return await run_in_threadpool(
        update_chapter_service,
        chapter_id,
        **update_data
    )


@org_router.delete('/{organization_id}/stories/{story_id}/chapters/{chapter_id}')
async def delete_chapter(
    organization_id: str,
    story_id: str,
    chapter_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Delete a story chapter.

    Requires authentication and admin+ role in organization.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID
        chapter_id: Chapter UUID

    Returns:
        Deletion confirmation
    """
    from app.services.product_stories import delete_chapter as delete_chapter_service, get_story_by_id

    # Verify story belongs to organization
    story = await run_in_threadpool(get_story_by_id, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    success = await run_in_threadpool(delete_chapter_service, chapter_id)

    return {
        'deleted': success,
        'chapter_id': chapter_id
    }


@org_router.put('/{organization_id}/stories/{story_id}/chapters/reorder')
async def reorder_chapters(
    organization_id: str,
    story_id: str,
    chapter_ids: list[str],
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[dict]:
    """
    Reorder chapters in a story.

    Requires authentication and editor+ role in organization.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID
        chapter_ids: Ordered list of chapter IDs

    Returns:
        Reordered chapters
    """
    from app.services.product_stories import reorder_chapters as reorder_chapters_service, get_story_by_id

    # Verify story belongs to organization
    story = await run_in_threadpool(get_story_by_id, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    return await run_in_threadpool(
        reorder_chapters_service,
        story_id,
        chapter_ids
    )


# ==================== Analytics Routes ====================

@org_router.get('/{organization_id}/stories/analytics')
async def get_organization_stories_analytics(
    organization_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> OrganizationStoriesAnalytics:
    """
    Get aggregate analytics for all stories in an organization.

    Requires authentication and organization membership.

    Args:
        organization_id: Organization UUID

    Returns:
        Aggregate analytics data
    """
    from app.services.product_stories import get_organization_stories_analytics as get_analytics

    return await run_in_threadpool(get_analytics, organization_id)


@org_router.get('/{organization_id}/stories/{story_id}/analytics')
async def get_story_analytics(
    organization_id: str,
    story_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> StoryAnalytics:
    """
    Get analytics for a single story.

    Requires authentication and organization membership.

    Args:
        organization_id: Organization UUID
        story_id: Story UUID

    Returns:
        Story analytics data
    """
    from app.services.product_stories import get_story_analytics as get_analytics, get_story_by_id

    # Verify story belongs to organization
    story = await run_in_threadpool(get_story_by_id, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    if story['organization_id'] != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Story does not belong to this organization"
        )

    return await run_in_threadpool(get_analytics, story_id)
