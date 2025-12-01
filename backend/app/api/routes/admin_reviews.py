"""
Admin Reviews API Routes
Global review moderation for platform admins.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from app.api.routes.auth import get_current_user_id
from app.schemas.reviews import Review, ReviewModeration, ReviewsResponse
from app.services.admin_reviews import list_all_reviews, admin_moderate_review

router = APIRouter(prefix='/api/admin/reviews', tags=['admin-reviews'])


@router.get('', response_model=ReviewsResponse)
async def admin_list_reviews(
    organization_id: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern='^(pending|approved|rejected)$'),
    rating: int | None = Query(default=None, ge=1, le=5),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> ReviewsResponse:
    """
    List all reviews across all organizations (admin only).
    
    Supports filtering by:
    - organization_id: Filter by specific organization
    - status: Filter by moderation status (pending/approved/rejected)
    - rating: Filter by rating (1-5)
    """
    try:
        items, total = await run_in_threadpool(
            list_all_reviews,
            current_user_id,
            organization_id,
            status,
            rating,
            limit,
            offset,
        )
        return ReviewsResponse(items=items, total=total)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to list reviews: {str(e)}')


@router.patch('/{review_id}/moderate', response_model=Review)
async def admin_moderate(
    review_id: str,
    payload: ReviewModeration,
    current_user_id: str = Depends(get_current_user_id),
) -> Review:
    """
    Moderate any review as platform admin.
    
    Can moderate reviews from any organization, not just those the admin owns.
    """
    try:
        return await run_in_threadpool(
            admin_moderate_review,
            review_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to moderate review: {str(e)}')


