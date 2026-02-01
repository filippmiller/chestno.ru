"""
Telegram Bot Data Models (Pydantic schemas)
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ConversationState(str, Enum):
    """FSM states for multi-step conversations."""
    IDLE = 'idle'
    AWAITING_INN = 'awaiting_inn'
    AWAITING_OGRN = 'awaiting_ogrn'
    AWAITING_REVIEW_TARGET = 'awaiting_review_target'
    AWAITING_REVIEW_RATING = 'awaiting_review_rating'
    AWAITING_REVIEW_TEXT = 'awaiting_review_text'
    AWAITING_LINK_CONFIRMATION = 'awaiting_link_confirmation'
    AWAITING_UNLINK_CONFIRMATION = 'awaiting_unlink_confirmation'


class InteractionType(str, Enum):
    """Types of bot interactions for logging."""
    COMMAND = 'command'
    INN_LOOKUP = 'inn_lookup'
    OGRN_LOOKUP = 'ogrn_lookup'
    QR_SCAN = 'qr_scan'
    REVIEW_SUBMIT = 'review_submit'
    FOLLOW_PRODUCER = 'follow_producer'
    UNFOLLOW_PRODUCER = 'unfollow_producer'
    ACCOUNT_LINK = 'account_link'
    ACCOUNT_UNLINK = 'account_unlink'
    SETTINGS_CHANGE = 'settings_change'
    ERROR = 'error'


class TelegramUser(BaseModel):
    """Telegram user info from update."""
    id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None


class TelegramUserLink(BaseModel):
    """Database model for telegram_user_links."""
    id: str
    telegram_user_id: int
    telegram_username: Optional[str] = None
    telegram_first_name: Optional[str] = None
    telegram_last_name: Optional[str] = None
    telegram_language_code: Optional[str] = None
    user_id: Optional[str] = None
    link_token: Optional[str] = None
    link_token_expires_at: Optional[datetime] = None
    linked_at: Optional[datetime] = None
    current_state: str = 'idle'
    state_data: dict = Field(default_factory=dict)
    notifications_enabled: bool = True
    notify_producer_updates: bool = True
    notify_review_replies: bool = True
    notify_new_reviews: bool = False
    request_count_today: int = 0
    created_at: datetime
    updated_at: datetime


class CompanyInfo(BaseModel):
    """Company information for display."""
    id: str
    name: str
    legal_name: Optional[str] = None
    inn: Optional[str] = None
    ogrn: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    is_verified: bool = False
    verification_status: str = 'pending'
    rating: Optional[float] = None
    review_count: int = 0
    product_count: int = 0
    profile_url: str
    short_description: Optional[str] = None


class ProducerFollow(BaseModel):
    """Producer follow subscription."""
    id: str
    telegram_user_id: int
    organization_id: str
    organization_name: str
    notify_new_products: bool = True
    notify_certifications: bool = True
    notify_news: bool = True
    created_at: datetime


class PendingReview(BaseModel):
    """Review started in Telegram."""
    id: str
    telegram_user_id: int
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    product_id: Optional[str] = None
    rating: Optional[int] = None
    review_text: Optional[str] = None
    completion_token: str
    completion_url: str
    expires_at: datetime


class RateLimitResult(BaseModel):
    """Result of rate limit check."""
    allowed: bool
    remaining: int
    reset_at: datetime


class BotInteractionLog(BaseModel):
    """Log entry for bot interaction."""
    telegram_user_id: int
    interaction_type: InteractionType
    input_text: Optional[str] = None
    input_data: Optional[dict] = None
    response_type: Optional[str] = None
    response_data: Optional[dict] = None
    processing_time_ms: Optional[int] = None
    was_rate_limited: bool = False


class NotificationPayload(BaseModel):
    """Payload for sending notifications to Telegram users."""
    telegram_user_id: int
    notification_type: str  # 'producer_update', 'review_reply', etc.
    title: str
    body: str
    link: Optional[str] = None
    extra_data: Optional[dict] = None
