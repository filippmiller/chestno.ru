"""
Review Votes API Routes
Endpoints for the review helpfulness voting system
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from typing import Literal

from app.schemas.review_votes import (
    CastVoteRequest,
    CastVoteResponse,
    UserVoteResponse,
    BatchVotesRequest,
    BatchVotesResponse,
    ReviewWithVotes,
)
from app.services.review_votes import (
    cast_vote,
    get_user_vote,
    get_user_votes_batch,
    list_reviews_with_votes,
)
from .auth import get_current_user_id, get_optional_user_id

router = APIRouter(prefix='/api/reviews', tags=['review-votes'])


@router.post('/{review_id}/vote', response_model=CastVoteResponse)
async def vote_on_review(
    review_id: str,
    payload: CastVoteRequest,
    current_user_id: str = Depends(get_current_user_id),
) -> CastVoteResponse:
    """
    Cast or update a vote on a review.

    - `up`: Mark review as helpful
    - `down`: Mark review as not helpful
    - `none`: Remove your vote

    Anti-manipulation rules:
    - Cannot vote on your own reviews
    - Only approved reviews can be voted on
    - One vote per user per review

    Trust weighting:
    - Verified purchasers get +50% vote weight
    - Higher loyalty tiers get additional weight bonuses
    """
    try:
        result = await run_in_threadpool(
            cast_vote,
            review_id,
            current_user_id,
            payload.vote_type,
        )
        return CastVoteResponse(**result)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get('/{review_id}/vote', response_model=UserVoteResponse)
async def get_review_vote(
    review_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> UserVoteResponse:
    """
    Get the current user's vote on a review.

    Returns `vote_type` as 'up', 'down', or null if no vote.
    """
    vote_type = await run_in_threadpool(get_user_vote, review_id, current_user_id)
    return UserVoteResponse(review_id=review_id, vote_type=vote_type)


@router.post('/votes/batch', response_model=BatchVotesResponse)
async def get_batch_votes(
    payload: BatchVotesRequest,
    current_user_id: str = Depends(get_current_user_id),
) -> BatchVotesResponse:
    """
    Get current user's votes for multiple reviews.

    Useful for list pages to avoid N+1 queries.
    Maximum 100 review IDs per request.
    """
    votes = await run_in_threadpool(
        get_user_votes_batch,
        payload.review_ids,
        current_user_id,
    )
    return BatchVotesResponse(
        votes=[UserVoteResponse(review_id=v['review_id'], vote_type=v['vote_type']) for v in votes]
    )


@router.get('', response_model=dict)
async def list_reviews(
    organization_id: str | None = Query(default=None),
    product_id: str | None = Query(default=None),
    sort: Literal['most_helpful', 'most_recent', 'highest_rated', 'lowest_rated'] = Query(default='most_recent'),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str | None = Depends(get_optional_user_id),
) -> dict:
    """
    List reviews with vote counts and sorting options.

    Sorting options:
    - `most_helpful`: Wilson score ranking (best for "most helpful" filter)
    - `most_recent`: Newest first
    - `highest_rated`: 5-star reviews first
    - `lowest_rated`: 1-star reviews first

    The Wilson score algorithm accounts for:
    - Total number of votes (more votes = more confidence)
    - Vote weight from verified purchasers
    - Statistical confidence interval (prevents gaming by few votes)
    """
    offset = (page - 1) * limit

    reviews, total = await run_in_threadpool(
        list_reviews_with_votes,
        organization_id,
        product_id,
        sort,
        limit,
        offset,
        user_id,
    )

    total_pages = (total + limit - 1) // limit

    return {
        'reviews': reviews,
        'total': total,
        'page': page,
        'total_pages': total_pages,
    }
