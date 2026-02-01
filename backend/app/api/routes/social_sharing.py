"""
API routes for social sharing functionality.
"""
from typing import Optional

from fastapi import APIRouter, Cookie, Request

from app.core.config import get_settings
from app.core.session_deps import SESSION_COOKIE_NAME
from app.services.sessions import get_session
from app.schemas.social_sharing import (
    ShareCardData,
    ShareEvent,
    ShareEventCreate,
    ShareStats,
    ShareTargetType,
)
from app.services import social_sharing as sharing_service


settings = get_settings()

router = APIRouter(prefix='/api/v1/share', tags=['social-sharing'])


@router.post('', response_model=ShareEvent)
async def log_share_event(
    request: Request,
    payload: ShareEventCreate,
    session_id: str | None = Cookie(None, alias=SESSION_COOKIE_NAME),
) -> ShareEvent:
    """
    Log a share event.

    Tracks when users share content to social platforms.
    Works for both authenticated and anonymous users.
    User-Agent and IP are logged for analytics (IP is hashed for privacy).
    """
    # Get user ID if authenticated (but don't require it)
    user_id = None
    if session_id:
        session = get_session(session_id)
        if session:
            user_id = session.get('user_id')

    # Get IP address from request
    ip_address = request.client.host if request.client else None

    return sharing_service.log_share_event(
        payload=payload,
        user_id=user_id,
        ip_address=ip_address,
    )


@router.get('/card/{target_type}/{target_id}', response_model=ShareCardData)
async def get_share_card(
    target_type: ShareTargetType,
    target_id: str,
) -> ShareCardData:
    """
    Generate share card/preview data for an entity.

    Returns Open Graph metadata for rich social media previews.
    Used by frontend to construct share links and preview cards.
    No authentication required.
    """
    return sharing_service.get_share_card_data(target_type, target_id)


@router.get('/stats/{target_type}/{target_id}', response_model=ShareStats)
async def get_share_stats(
    target_type: ShareTargetType,
    target_id: str,
) -> ShareStats:
    """
    Get sharing statistics for an entity.

    Returns total shares, breakdown by platform, and last shared time.
    Useful for displaying social proof on product/organization pages.
    No authentication required.
    """
    return sharing_service.get_share_stats(target_type, target_id)
