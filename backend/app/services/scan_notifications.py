"""
Scan Notifications Service

Handles real-time notifications for producers when their products are scanned.

Core Features:
- Check if organization has notifications enabled
- Send notification on scan event
- Manage notification preferences
- Query notification history
- Live scan feed management

Database tables:
- scan_notification_preferences: Per-org notification settings
- scan_notification_history: Audit log of notifications
- live_scan_feed: Real-time feed for dashboard

Integration:
- Called from qr.py when a scan event occurs
- Sends notifications via push, email, telegram, webhook
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.scan_notifications import (
    ScanNotificationPreferences,
    ScanNotificationPreferencesUpdate,
    ScanNotificationHistory,
    ScanNotificationHistoryListResponse,
    LiveScanFeedItem,
    LiveScanFeedResponse,
    ScanNotificationStats,
    LiveScanStats,
)

logger = logging.getLogger(__name__)

# Role permissions
MANAGER_ROLES = ('owner', 'admin', 'manager')
VIEW_ROLES = ('owner', 'admin', 'manager', 'editor', 'analyst', 'viewer')


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _ensure_role(cur, organization_id: str, user_id: str, allowed_roles: tuple) -> str:
    """Verify user has required role in organization"""
    cur.execute(
        '''
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        ''',
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row or row['role'] not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав')
    return row['role']


def _ensure_preferences_exist(cur, organization_id: str) -> None:
    """Ensure notification preferences exist for organization"""
    cur.execute(
        '''
        INSERT INTO scan_notification_preferences (organization_id)
        VALUES (%s)
        ON CONFLICT (organization_id) DO NOTHING
        ''',
        (organization_id,)
    )


# ============================================================
# PREFERENCES MANAGEMENT
# ============================================================

def get_notification_preferences(
    organization_id: str,
    user_id: str
) -> ScanNotificationPreferences:
    """
    Get scan notification preferences for an organization.

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth check)

    Returns:
        ScanNotificationPreferences object
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)
            _ensure_preferences_exist(cur, organization_id)
            conn.commit()

            cur.execute(
                '''
                SELECT
                    id::text,
                    organization_id::text,
                    enabled,
                    channels,
                    regions_filter,
                    notify_business_hours_only,
                    business_hours_start::text,
                    business_hours_end::text,
                    timezone,
                    batch_notifications,
                    batch_interval_minutes,
                    min_scans_for_notification,
                    notify_new_regions_only,
                    notify_first_scan_per_product,
                    notify_on_suspicious_scans,
                    product_ids_filter::text[],
                    created_at,
                    updated_at
                FROM scan_notification_preferences
                WHERE organization_id = %s
                ''',
                (organization_id,)
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='Настройки уведомлений не найдены'
                )

            return ScanNotificationPreferences(**row)


def update_notification_preferences(
    organization_id: str,
    user_id: str,
    updates: ScanNotificationPreferencesUpdate
) -> ScanNotificationPreferences:
    """
    Update scan notification preferences for an organization.

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth check)
        updates: Fields to update

    Returns:
        Updated ScanNotificationPreferences object
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)
            _ensure_preferences_exist(cur, organization_id)

            # Build dynamic update query
            update_fields = []
            values = []

            update_data = updates.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if value is not None:
                    update_fields.append(f"{field} = %s")
                    values.append(value)

            if not update_fields:
                # No updates, just return current
                conn.commit()
                return get_notification_preferences(organization_id, user_id)

            update_fields.append("updated_at = now()")
            values.append(organization_id)

            query = f'''
                UPDATE scan_notification_preferences
                SET {', '.join(update_fields)}
                WHERE organization_id = %s
                RETURNING
                    id::text,
                    organization_id::text,
                    enabled,
                    channels,
                    regions_filter,
                    notify_business_hours_only,
                    business_hours_start::text,
                    business_hours_end::text,
                    timezone,
                    batch_notifications,
                    batch_interval_minutes,
                    min_scans_for_notification,
                    notify_new_regions_only,
                    notify_first_scan_per_product,
                    notify_on_suspicious_scans,
                    product_ids_filter::text[],
                    created_at,
                    updated_at
            '''

            cur.execute(query, values)
            row = cur.fetchone()
            conn.commit()

            logger.info(f"[scan_notifications] Updated preferences for org {organization_id}")

            return ScanNotificationPreferences(**row)


def check_notifications_enabled(organization_id: str) -> bool:
    """
    Quick check if notifications are enabled for an organization.
    Used by scan event handler to skip notification logic early.

    Args:
        organization_id: Organization UUID

    Returns:
        True if notifications are enabled
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT enabled
                FROM scan_notification_preferences
                WHERE organization_id = %s
                ''',
                (organization_id,)
            )
            row = cur.fetchone()
            return row['enabled'] if row else False


# ============================================================
# NOTIFICATION SENDING
# ============================================================

def send_scan_notification(
    organization_id: str,
    scan_event_id: str,
    product_id: Optional[str] = None,
    product_name: Optional[str] = None,
    batch_id: Optional[str] = None,
    batch_code: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    is_suspicious: bool = False,
    is_first_scan: bool = False,
    is_new_region: bool = False
) -> Optional[str]:
    """
    Send a scan notification based on organization preferences.

    This is the main entry point called when a scan event occurs.
    It checks preferences, applies filters, and dispatches notifications.

    Args:
        organization_id: Organization UUID
        scan_event_id: Scan event UUID
        product_id: Optional product UUID
        product_name: Optional product name for display
        batch_id: Optional batch UUID
        batch_code: Optional batch code for display
        country: Country where scan occurred
        city: City where scan occurred
        is_suspicious: Whether scan is flagged as suspicious
        is_first_scan: Whether this is first scan of this product
        is_new_region: Whether this is a new region for this org

    Returns:
        Notification history ID if sent, None if skipped
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get preferences
            cur.execute(
                '''
                SELECT *
                FROM scan_notification_preferences
                WHERE organization_id = %s
                ''',
                (organization_id,)
            )
            prefs = cur.fetchone()

            if not prefs or not prefs['enabled']:
                return None

            # Apply filters
            channels = prefs['channels'] or ['in_app']

            # Region filter
            if prefs['regions_filter'] and country:
                if country not in prefs['regions_filter']:
                    if not prefs['notify_new_regions_only'] or not is_new_region:
                        return None

            # Product filter
            if prefs['product_ids_filter'] and product_id:
                if product_id not in prefs['product_ids_filter']:
                    return None

            # Business hours filter
            if prefs['notify_business_hours_only']:
                # TODO: Implement timezone-aware business hours check
                pass

            # Determine notification type
            notification_type = 'scan'
            if is_suspicious and prefs['notify_on_suspicious_scans']:
                notification_type = 'suspicious'
            elif is_first_scan and prefs['notify_first_scan_per_product']:
                notification_type = 'first_scan'
            elif is_new_region:
                notification_type = 'new_region'

            # Record to live feed
            cur.execute(
                '''
                SELECT public.record_scan_for_live_feed(
                    %s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, NULL, %s
                )
                ''',
                (
                    scan_event_id, organization_id, product_id,
                    product_name, None, batch_code,
                    country, city, is_suspicious
                )
            )

            # Create notification history entry
            notification_id = None
            for channel in channels:
                cur.execute(
                    '''
                    INSERT INTO scan_notification_history (
                        organization_id,
                        scan_event_id,
                        channel,
                        notification_type,
                        status,
                        product_id,
                        batch_id,
                        scan_country,
                        scan_city,
                        metadata
                    ) VALUES (
                        %s, %s, %s, %s, 'pending', %s, %s, %s, %s, %s
                    )
                    RETURNING id::text
                    ''',
                    (
                        organization_id,
                        scan_event_id,
                        channel,
                        notification_type,
                        product_id,
                        batch_id,
                        country,
                        city,
                        {
                            'product_name': product_name,
                            'batch_code': batch_code,
                            'is_first_scan': is_first_scan,
                            'is_new_region': is_new_region,
                            'is_suspicious': is_suspicious
                        }
                    )
                )
                result = cur.fetchone()
                if notification_id is None:
                    notification_id = result['id']

                # Dispatch notification based on channel
                try:
                    _dispatch_notification(
                        cur, organization_id, channel, notification_type,
                        product_name, batch_code, country, city, is_suspicious
                    )
                    # Update status to sent
                    cur.execute(
                        '''
                        UPDATE scan_notification_history
                        SET status = 'sent'
                        WHERE id = %s
                        ''',
                        (result['id'],)
                    )
                except Exception as e:
                    logger.error(f"[scan_notifications] Failed to dispatch {channel}: {e}")
                    cur.execute(
                        '''
                        UPDATE scan_notification_history
                        SET status = 'failed', error_message = %s
                        WHERE id = %s
                        ''',
                        (str(e), result['id'])
                    )

            conn.commit()
            return notification_id


def _dispatch_notification(
    cur,
    organization_id: str,
    channel: str,
    notification_type: str,
    product_name: Optional[str],
    batch_code: Optional[str],
    country: Optional[str],
    city: Optional[str],
    is_suspicious: bool
) -> None:
    """
    Dispatch notification to the appropriate channel.

    This is a placeholder that would integrate with:
    - push.py for push notifications
    - email.py for email notifications
    - telegram_bot.py for Telegram
    - webhooks.py for webhook delivery
    """
    location = f"{city}, {country}" if city and country else country or "неизвестно"

    if channel == 'in_app':
        # Insert into notifications table
        cur.execute(
            '''
            INSERT INTO notifications (
                organization_id,
                type,
                title,
                body,
                data,
                created_at
            )
            SELECT
                %s,
                %s,
                COALESCE(nt.title_template, 'Сканирование продукта'),
                COALESCE(nt.body_template, 'Ваш продукт был отсканирован'),
                %s,
                now()
            FROM notification_types nt
            WHERE nt.key = %s
            ''',
            (
                organization_id,
                f'scan.{notification_type}',
                {
                    'product_name': product_name,
                    'batch_code': batch_code,
                    'location': location,
                    'is_suspicious': is_suspicious
                },
                f'scan.{"suspicious_activity" if is_suspicious else "product_scanned"}'
            )
        )

    elif channel == 'push':
        # TODO: Call push service
        logger.info(f"[scan_notifications] Would send push to org {organization_id}")

    elif channel == 'email':
        # TODO: Call email service
        logger.info(f"[scan_notifications] Would send email to org {organization_id}")

    elif channel == 'telegram':
        # TODO: Call telegram bot service
        logger.info(f"[scan_notifications] Would send telegram to org {organization_id}")

    elif channel == 'webhook':
        # TODO: Call webhook service
        logger.info(f"[scan_notifications] Would call webhook for org {organization_id}")


# ============================================================
# NOTIFICATION HISTORY
# ============================================================

def get_notification_history(
    organization_id: str,
    user_id: str,
    page: int = 1,
    per_page: int = 20,
    channel: Optional[str] = None,
    notification_type: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> ScanNotificationHistoryListResponse:
    """
    Get paginated notification history for an organization.

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth check)
        page: Page number (1-indexed)
        per_page: Items per page (max 100)
        channel: Filter by channel
        notification_type: Filter by type
        status: Filter by status
        date_from: Filter from date
        date_to: Filter to date

    Returns:
        Paginated list of notification history
    """
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)

            # Build filters
            filters = ['organization_id = %s']
            values = [organization_id]

            if channel:
                filters.append('channel = %s')
                values.append(channel)

            if notification_type:
                filters.append('notification_type = %s')
                values.append(notification_type)

            if status:
                filters.append('status = %s')
                values.append(status)

            if date_from:
                filters.append('notified_at >= %s')
                values.append(date_from)

            if date_to:
                filters.append('notified_at <= %s')
                values.append(date_to)

            where_clause = ' AND '.join(filters)

            # Get total count
            cur.execute(
                f'SELECT COUNT(*) as total FROM scan_notification_history WHERE {where_clause}',
                values
            )
            total = cur.fetchone()['total']

            # Get items
            cur.execute(
                f'''
                SELECT
                    id::text,
                    organization_id::text,
                    scan_event_id::text,
                    channel,
                    notification_type,
                    status,
                    product_id::text,
                    batch_id::text,
                    scan_country,
                    scan_city,
                    scan_count,
                    aggregated_scan_ids::text[],
                    error_message,
                    notified_at,
                    delivered_at,
                    metadata
                FROM scan_notification_history
                WHERE {where_clause}
                ORDER BY notified_at DESC
                LIMIT %s OFFSET %s
                ''',
                values + [per_page, offset]
            )
            rows = cur.fetchall()

            items = [ScanNotificationHistory(**row) for row in rows]
            total_pages = (total + per_page - 1) // per_page

            return ScanNotificationHistoryListResponse(
                items=items,
                total=total,
                page=page,
                per_page=per_page,
                total_pages=total_pages
            )


# ============================================================
# LIVE SCAN FEED
# ============================================================

def get_live_scan_feed(
    organization_id: str,
    user_id: str,
    limit: int = 50,
    since: Optional[datetime] = None
) -> LiveScanFeedResponse:
    """
    Get live scan feed for real-time dashboard display.

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth check)
        limit: Maximum items to return (max 100)
        since: Only return scans after this timestamp

    Returns:
        LiveScanFeedResponse with recent scan items
    """
    limit = min(limit, 100)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)

            filters = ['organization_id = %s', 'expires_at > now()']
            values = [organization_id]

            if since:
                filters.append('scanned_at > %s')
                values.append(since)

            where_clause = ' AND '.join(filters)

            # Get total count
            cur.execute(
                f'SELECT COUNT(*) as total FROM live_scan_feed WHERE {where_clause}',
                values
            )
            total = cur.fetchone()['total']

            # Get items
            cur.execute(
                f'''
                SELECT
                    id::text,
                    organization_id::text,
                    scan_event_id::text,
                    product_id::text,
                    product_name,
                    product_slug,
                    batch_code,
                    country,
                    city,
                    region,
                    device_type,
                    is_first_scan,
                    is_suspicious,
                    is_new_region,
                    scanned_at
                FROM live_scan_feed
                WHERE {where_clause}
                ORDER BY scanned_at DESC
                LIMIT %s
                ''',
                values + [limit + 1]  # Get one extra to check has_more
            )
            rows = cur.fetchall()

            has_more = len(rows) > limit
            items = [LiveScanFeedItem(**row) for row in rows[:limit]]

            return LiveScanFeedResponse(
                items=items,
                total=total,
                has_more=has_more
            )


# ============================================================
# STATISTICS
# ============================================================

def get_notification_stats(
    organization_id: str,
    user_id: str
) -> ScanNotificationStats:
    """
    Get notification statistics for an organization.

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth check)

    Returns:
        ScanNotificationStats object
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)

            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = today_start - timedelta(days=7)

            # Total sent
            cur.execute(
                '''
                SELECT COUNT(*) as total
                FROM scan_notification_history
                WHERE organization_id = %s AND status IN ('sent', 'delivered')
                ''',
                (organization_id,)
            )
            total = cur.fetchone()['total']

            # Today
            cur.execute(
                '''
                SELECT COUNT(*) as count
                FROM scan_notification_history
                WHERE organization_id = %s
                  AND status IN ('sent', 'delivered')
                  AND notified_at >= %s
                ''',
                (organization_id, today_start)
            )
            today = cur.fetchone()['count']

            # This week
            cur.execute(
                '''
                SELECT COUNT(*) as count
                FROM scan_notification_history
                WHERE organization_id = %s
                  AND status IN ('sent', 'delivered')
                  AND notified_at >= %s
                ''',
                (organization_id, week_start)
            )
            this_week = cur.fetchone()['count']

            # By channel
            cur.execute(
                '''
                SELECT channel, COUNT(*) as count
                FROM scan_notification_history
                WHERE organization_id = %s
                GROUP BY channel
                ''',
                (organization_id,)
            )
            by_channel = {row['channel']: row['count'] for row in cur.fetchall()}

            # By type
            cur.execute(
                '''
                SELECT notification_type, COUNT(*) as count
                FROM scan_notification_history
                WHERE organization_id = %s
                GROUP BY notification_type
                ''',
                (organization_id,)
            )
            by_type = {row['notification_type']: row['count'] for row in cur.fetchall()}

            # By status
            cur.execute(
                '''
                SELECT status, COUNT(*) as count
                FROM scan_notification_history
                WHERE organization_id = %s
                GROUP BY status
                ''',
                (organization_id,)
            )
            by_status = {row['status']: row['count'] for row in cur.fetchall()}

            return ScanNotificationStats(
                total_notifications_sent=total,
                notifications_today=today,
                notifications_this_week=this_week,
                by_channel=by_channel,
                by_type=by_type,
                by_status=by_status
            )


def get_live_scan_stats(
    organization_id: str,
    user_id: str
) -> LiveScanStats:
    """
    Get live scan statistics for an organization.

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth check)

    Returns:
        LiveScanStats object
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)

            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = today_start - timedelta(days=7)

            # Scans today
            cur.execute(
                '''
                SELECT COUNT(*) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND scanned_at >= %s
                ''',
                (organization_id, today_start)
            )
            today = cur.fetchone()['count']

            # Scans this week
            cur.execute(
                '''
                SELECT COUNT(*) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND scanned_at >= %s
                ''',
                (organization_id, week_start)
            )
            this_week = cur.fetchone()['count']

            # Unique products
            cur.execute(
                '''
                SELECT COUNT(DISTINCT product_id) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND product_id IS NOT NULL
                ''',
                (organization_id,)
            )
            unique_products = cur.fetchone()['count']

            # Unique regions
            cur.execute(
                '''
                SELECT COUNT(DISTINCT country) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND country IS NOT NULL
                ''',
                (organization_id,)
            )
            unique_regions = cur.fetchone()['count']

            # Suspicious count
            cur.execute(
                '''
                SELECT COUNT(*) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND is_suspicious = true
                ''',
                (organization_id,)
            )
            suspicious = cur.fetchone()['count']

            # First scans count
            cur.execute(
                '''
                SELECT COUNT(*) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND is_first_scan = true
                ''',
                (organization_id,)
            )
            first_scans = cur.fetchone()['count']

            # Top countries
            cur.execute(
                '''
                SELECT country, COUNT(*) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND country IS NOT NULL
                GROUP BY country
                ORDER BY count DESC
                LIMIT 10
                ''',
                (organization_id,)
            )
            top_countries = [dict(row) for row in cur.fetchall()]

            # Top products
            cur.execute(
                '''
                SELECT product_name, product_id::text, COUNT(*) as count
                FROM live_scan_feed
                WHERE organization_id = %s AND product_id IS NOT NULL
                GROUP BY product_name, product_id
                ORDER BY count DESC
                LIMIT 10
                ''',
                (organization_id,)
            )
            top_products = [dict(row) for row in cur.fetchall()]

            return LiveScanStats(
                total_scans_today=today,
                total_scans_week=this_week,
                unique_products_scanned=unique_products,
                unique_regions=unique_regions,
                suspicious_scans_count=suspicious,
                first_scans_count=first_scans,
                top_countries=top_countries,
                top_products=top_products
            )
