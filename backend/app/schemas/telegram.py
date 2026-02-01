"""
Pydantic schemas for Telegram bot functionality.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TelegramUser(BaseModel):
    """Telegram user model."""
    id: str
    telegram_id: int
    telegram_username: Optional[str] = None
    telegram_first_name: Optional[str] = None
    telegram_last_name: Optional[str] = None
    user_id: Optional[str] = None
    language_code: str = 'ru'
    is_blocked: bool = False
    blocked_reason: Optional[str] = None
    last_activity_at: datetime
    created_at: datetime


class TelegramSubscription(BaseModel):
    """Telegram subscription to organization."""
    id: str
    telegram_user_id: str
    organization_id: str
    organization_name: Optional[str] = None
    organization_inn: Optional[str] = None
    notify_on_reviews: bool = True
    notify_on_qr_scans: bool = True
    notify_on_posts: bool = False
    created_at: datetime


class TelegramLinkToken(BaseModel):
    """Token for linking Telegram to web account."""
    id: str
    telegram_user_id: str
    token: str
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime


class CompanyInfo(BaseModel):
    """Company information from INN lookup."""
    inn: str
    name: str
    full_name: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    address: Optional[str] = None
    director: Optional[str] = None
    status: Optional[str] = None
    registration_date: Optional[str] = None
    org_id: Optional[str] = None  # If registered on chestno.ru
    is_verified: bool = False
    trust_score: Optional[float] = None
    reviews_count: int = 0


class RateLimitResult(BaseModel):
    """Rate limit check result."""
    allowed: bool
    remaining: int
    reset_at: datetime
    retry_after_seconds: Optional[int] = None


class BotCommand(Enum):
    """Available bot commands."""
    START = 'start'
    VERIFY = 'verify'
    SCAN = 'scan'
    SUBSCRIBE = 'subscribe'
    UNSUBSCRIBE = 'unsubscribe'
    MY_SUBSCRIPTIONS = 'my'
    LINK = 'link'
    HELP = 'help'


class WebhookUpdate(BaseModel):
    """Telegram webhook update payload."""
    update_id: int
    message: Optional[dict] = None
    callback_query: Optional[dict] = None
    inline_query: Optional[dict] = None


class SendNotificationRequest(BaseModel):
    """Request to send notification via Telegram."""
    telegram_user_id: str
    title: str
    body: str
    url: Optional[str] = None
    notification_type: str = 'general'


class BotStats(BaseModel):
    """Bot usage statistics."""
    total_users: int
    active_users_24h: int
    active_users_7d: int
    total_subscriptions: int
    total_commands_24h: int
    linked_accounts: int
    blocked_users: int
