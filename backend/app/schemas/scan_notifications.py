"""
Scan Notifications Schemas

Pydantic models for the real-time producer scan notifications feature.
"""

from __future__ import annotations

from datetime import datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ============================================================
# NOTIFICATION CHANNELS
# ============================================================

NotificationChannel = Literal['in_app', 'push', 'email', 'telegram', 'webhook']
NotificationType = Literal['scan', 'batch_summary', 'first_scan', 'suspicious', 'milestone', 'new_region']
NotificationStatus = Literal['pending', 'sent', 'delivered', 'failed', 'skipped']


# ============================================================
# PREFERENCES SCHEMAS
# ============================================================

class ScanNotificationPreferencesBase(BaseModel):
    """Base schema for scan notification preferences"""
    enabled: bool = True
    channels: list[NotificationChannel] = ['in_app', 'push']
    regions_filter: Optional[list[str]] = None

    # Time filters
    notify_business_hours_only: bool = False
    business_hours_start: Optional[str] = '09:00'
    business_hours_end: Optional[str] = '18:00'
    timezone: str = 'Europe/Moscow'

    # Frequency controls
    batch_notifications: bool = False
    batch_interval_minutes: int = Field(default=15, ge=1, le=60)
    min_scans_for_notification: int = Field(default=1, ge=1, le=100)

    # Filter settings
    notify_new_regions_only: bool = False
    notify_first_scan_per_product: bool = True
    notify_on_suspicious_scans: bool = True

    # Product filters
    product_ids_filter: Optional[list[str]] = None


class ScanNotificationPreferences(ScanNotificationPreferencesBase):
    """Full scan notification preferences record"""
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime


class ScanNotificationPreferencesUpdate(BaseModel):
    """Schema for updating preferences"""
    enabled: Optional[bool] = None
    channels: Optional[list[NotificationChannel]] = None
    regions_filter: Optional[list[str]] = None
    notify_business_hours_only: Optional[bool] = None
    business_hours_start: Optional[str] = None
    business_hours_end: Optional[str] = None
    timezone: Optional[str] = None
    batch_notifications: Optional[bool] = None
    batch_interval_minutes: Optional[int] = Field(default=None, ge=1, le=60)
    min_scans_for_notification: Optional[int] = Field(default=None, ge=1, le=100)
    notify_new_regions_only: Optional[bool] = None
    notify_first_scan_per_product: Optional[bool] = None
    notify_on_suspicious_scans: Optional[bool] = None
    product_ids_filter: Optional[list[str]] = None


# ============================================================
# NOTIFICATION HISTORY SCHEMAS
# ============================================================

class ScanNotificationHistoryBase(BaseModel):
    """Base schema for notification history"""
    channel: NotificationChannel
    notification_type: NotificationType
    status: NotificationStatus
    scan_country: Optional[str] = None
    scan_city: Optional[str] = None
    scan_count: int = 1


class ScanNotificationHistory(ScanNotificationHistoryBase):
    """Full notification history record"""
    id: str
    organization_id: str
    scan_event_id: Optional[str] = None
    product_id: Optional[str] = None
    batch_id: Optional[str] = None
    error_message: Optional[str] = None
    aggregated_scan_ids: Optional[list[str]] = None
    notified_at: datetime
    delivered_at: Optional[datetime] = None
    metadata: Optional[dict] = None


class ScanNotificationHistoryListResponse(BaseModel):
    """Paginated list of notification history"""
    items: list[ScanNotificationHistory]
    total: int
    page: int
    per_page: int
    total_pages: int


# ============================================================
# LIVE SCAN FEED SCHEMAS
# ============================================================

class LiveScanFeedItem(BaseModel):
    """Single item in the live scan feed"""
    id: str
    organization_id: str
    scan_event_id: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    product_slug: Optional[str] = None
    batch_code: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    device_type: Optional[str] = None
    is_first_scan: bool = False
    is_suspicious: bool = False
    is_new_region: bool = False
    scanned_at: datetime


class LiveScanFeedResponse(BaseModel):
    """Response with live scan feed items"""
    items: list[LiveScanFeedItem]
    total: int
    has_more: bool


# ============================================================
# STATS SCHEMAS
# ============================================================

class ScanNotificationStats(BaseModel):
    """Statistics for scan notifications"""
    total_notifications_sent: int
    notifications_today: int
    notifications_this_week: int
    by_channel: dict[str, int]
    by_type: dict[str, int]
    by_status: dict[str, int]
    avg_delivery_time_seconds: Optional[float] = None


class LiveScanStats(BaseModel):
    """Statistics for live scan feed"""
    total_scans_today: int
    total_scans_week: int
    unique_products_scanned: int
    unique_regions: int
    suspicious_scans_count: int
    first_scans_count: int
    top_countries: list[dict]
    top_products: list[dict]


# ============================================================
# WEBSOCKET SCHEMAS
# ============================================================

class WebSocketScanEvent(BaseModel):
    """Real-time scan event sent via WebSocket"""
    event_type: Literal['new_scan', 'scan_update', 'notification']
    data: LiveScanFeedItem
    timestamp: datetime


class WebSocketConnectionMessage(BaseModel):
    """WebSocket connection status message"""
    type: Literal['connected', 'disconnected', 'error', 'heartbeat']
    message: Optional[str] = None
    organization_id: Optional[str] = None
    timestamp: datetime
