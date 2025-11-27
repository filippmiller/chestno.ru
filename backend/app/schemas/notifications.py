from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel


class NotificationType(BaseModel):
    id: str
    key: str
    category: str
    severity: str
    title_template: str
    body_template: str
    default_channels: list[str]
    created_at: datetime


class NotificationPayload(BaseModel):
    id: str
    notification_type_id: str
    org_id: Optional[str] = None
    title: str
    body: str
    payload: Optional[dict[str, Any]] = None
    severity: str
    category: str
    created_at: datetime


class NotificationDelivery(BaseModel):
    id: str
    notification_id: str
    channel: str
    status: str
    read_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None
    created_at: datetime
    notification: NotificationPayload


class NotificationListResponse(BaseModel):
    items: list[NotificationDelivery]
    next_cursor: Optional[str] = None


class NotificationStatusUpdate(BaseModel):
    read: Optional[bool] = None
    dismissed: Optional[bool] = None


class NotificationSetting(BaseModel):
    id: Optional[str] = None
    notification_type_id: str
    notification_type: NotificationType
    channels: list[str]
    muted: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class NotificationSettingUpdate(BaseModel):
    notification_type_id: str
    channels: Optional[list[str]] = None
    muted: Optional[bool] = None


class NotificationEmitRequest(BaseModel):
    type_key: str
    org_id: Optional[str] = None
    recipient_user_id: Optional[str] = None
    recipient_scope: Literal['user', 'organization', 'platform'] = 'user'
    payload: Optional[dict[str, Any]] = None
    channels: Optional[list[str]] = None

