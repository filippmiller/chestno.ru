"""
API routes for consumer follow/subscription functionality.
Allows users to follow organizations and products.
"""
from fastapi import APIRouter, Depends, Query, Request

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.consumer_follows import (
    ConsumerFollow,
    ConsumerFollowCreate,
    ConsumerFollowsList,
    ConsumerFollowUpdate,
)
from app.services import consumer_follows as follows_service


router = APIRouter(prefix='/api/v1/subscriptions', tags=['consumer-subscriptions'])


@router.post('', response_model=ConsumerFollow)
async def create_subscription(
    request: Request,
    payload: ConsumerFollowCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ConsumerFollow:
    """
    Follow an organization or product.

    Creates a subscription that enables notifications for updates.
    """
    return follows_service.create_follow(current_user_id, payload)


@router.delete('/{subscription_id}')
async def delete_subscription(
    request: Request,
    subscription_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Unfollow an organization or product.

    Removes the subscription and stops all related notifications.
    """
    follows_service.delete_follow(current_user_id, subscription_id)
    return {'success': True}


@router.get('/my', response_model=ConsumerFollowsList)
async def list_my_subscriptions(
    request: Request,
    target_type: str | None = Query(default=None, description='Filter by type: organization or product'),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ConsumerFollowsList:
    """
    List current user's subscriptions.

    Returns all organizations and products the user is following,
    with resolved entity details.
    """
    return follows_service.list_user_follows(
        user_id=current_user_id,
        target_type=target_type,
        limit=limit,
        offset=offset,
    )


@router.put('/{subscription_id}/preferences', response_model=ConsumerFollow)
async def update_subscription_preferences(
    request: Request,
    subscription_id: str,
    payload: ConsumerFollowUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> ConsumerFollow:
    """
    Update notification preferences for a subscription.

    Allows configuring which types of updates trigger notifications
    and through which channels (email, push, telegram).
    """
    return follows_service.update_follow_preferences(
        user_id=current_user_id,
        follow_id=subscription_id,
        payload=payload,
    )
