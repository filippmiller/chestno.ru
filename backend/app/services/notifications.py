from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.notifications import (
    NotificationDelivery,
    NotificationEmitRequest,
    NotificationListResponse,
    NotificationPayload,
    NotificationSetting,
    NotificationSettingUpdate,
    NotificationType,
)


def list_notifications(user_id: str, cursor: Optional[int], limit: int) -> NotificationListResponse:
    offset = cursor or 0
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                d.id AS delivery_id,
                d.notification_id,
                d.channel,
                d.status,
                d.read_at,
                d.dismissed_at,
                d.created_at AS delivery_created_at,
                n.id AS notification_id,
                n.notification_type_id,
                n.org_id,
                n.title,
                n.body,
                n.payload,
                n.severity,
                n.category,
                n.created_at AS notification_created_at
            FROM notification_deliveries d
            JOIN notifications n ON n.id = d.notification_id
            WHERE d.user_id = %s
            ORDER BY d.created_at DESC, d.id DESC
            LIMIT %s OFFSET %s
            ''',
            (user_id, limit, offset),
        )
        rows = cur.fetchall()

    items: list[NotificationDelivery] = []
    for row in rows:
        payload = NotificationPayload(
            id=row['notification_id'],
            notification_type_id=row['notification_type_id'],
            org_id=row['org_id'],
            title=row['title'],
            body=row['body'],
            payload=row['payload'],
            severity=row['severity'],
            category=row['category'],
            created_at=row['notification_created_at'],
        )
        items.append(
            NotificationDelivery(
                id=row['delivery_id'],
                notification_id=row['notification_id'],
                channel=row['channel'],
                status=row['status'],
                read_at=row['read_at'],
                dismissed_at=row['dismissed_at'],
                created_at=row['delivery_created_at'],
                notification=payload,
            )
        )

    next_cursor = offset + len(items) if len(items) == limit else None
    return NotificationListResponse(items=items, next_cursor=str(next_cursor) if next_cursor is not None else None)


def get_unread_count(user_id: str) -> int:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            '''
            SELECT count(*)
            FROM notification_deliveries
            WHERE user_id = %s AND status IN ('pending','sent')
            ''',
            (user_id,),
        )
        return cur.fetchone()[0]


def mark_notification_read(user_id: str, delivery_id: str) -> None:
    _update_delivery(user_id, delivery_id, set_read=True, set_dismissed=False)


def dismiss_notification(user_id: str, delivery_id: str) -> None:
    _update_delivery(user_id, delivery_id, set_read=True, set_dismissed=True)


def _update_delivery(user_id: str, delivery_id: str, *, set_read: bool, set_dismissed: bool) -> None:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE notification_deliveries
            SET status = CASE
                    WHEN %s THEN 'read'
                    WHEN %s THEN 'dismissed'
                    ELSE status
                END,
                read_at = CASE WHEN %s THEN now() ELSE read_at END,
                dismissed_at = CASE WHEN %s THEN now() ELSE dismissed_at END
            WHERE id = %s AND user_id = %s
            RETURNING id
            ''',
            (set_dismissed, set_dismissed, set_read, set_dismissed, delivery_id, user_id),
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Notification not found')
        conn.commit()


def list_notification_settings(user_id: str) -> list[NotificationSetting]:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                nt.id AS notification_type_id,
                nt.key,
                nt.category,
                nt.severity,
                nt.title_template,
                nt.body_template,
                nt.default_channels,
                nt.created_at,
                uns.id AS user_setting_id,
                uns.channels,
                uns.muted,
                uns.created_at AS user_created_at,
                uns.updated_at AS user_updated_at
            FROM notification_types nt
            LEFT JOIN user_notification_settings uns
              ON uns.notification_type_id = nt.id AND uns.user_id = %s
            ORDER BY nt.key
            ''',
            (user_id,),
        )
        rows = cur.fetchall()

    settings: list[NotificationSetting] = []
    for row in rows:
        nt = NotificationType(
            id=row['notification_type_id'],
            key=row['key'],
            category=row['category'],
            severity=row['severity'],
            title_template=row['title_template'],
            body_template=row['body_template'],
            default_channels=row['default_channels'],
            created_at=row['created_at'],
        )
        channels = row['channels'] or row['default_channels']
        settings.append(
            NotificationSetting(
                id=row['user_setting_id'],
                notification_type_id=nt.id,
                notification_type=nt,
                channels=channels,
                muted=row['muted'] if row['muted'] is not None else False,
                created_at=row['user_created_at'],
                updated_at=row['user_updated_at'],
            )
        )
    return settings


def update_notification_settings(user_id: str, updates: list[NotificationSettingUpdate]) -> list[NotificationSetting]:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        for update in updates:
            if update.channels is None and update.muted is None:
                continue
            cur.execute(
                '''
                INSERT INTO user_notification_settings (user_id, notification_type_id, channels, muted)
                VALUES (%s, %s, COALESCE(%s, ARRAY['in_app']), COALESCE(%s, false))
                ON CONFLICT (user_id, notification_type_id)
                DO UPDATE SET
                    channels = COALESCE(EXCLUDED.channels, user_notification_settings.channels),
                    muted = COALESCE(EXCLUDED.muted, user_notification_settings.muted),
                    updated_at = now()
                ''',
                (user_id, update.notification_type_id, update.channels, update.muted),
            )
        conn.commit()

    return list_notification_settings(user_id)


def emit_notification(request: NotificationEmitRequest, actor_user_id: Optional[str] = None) -> None:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT * FROM notification_types WHERE key = %s', (request.type_key,))
        type_row = cur.fetchone()
        if not type_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Unknown notification type')

        title = render_template(type_row['title_template'], request.payload)
        body = render_template(type_row['body_template'], request.payload)

        cur.execute(
            '''
            INSERT INTO notifications (
                notification_type_id, org_id, recipient_user_id, recipient_scope,
                title, body, payload, severity, category
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            ''',
            (
                type_row['id'],
                request.org_id,
                request.recipient_user_id,
                request.recipient_scope,
                title,
                body,
                request.payload,
                type_row['severity'],
                type_row['category'],
            ),
        )
        notification = cur.fetchone()
        notification_id = notification['id']

        recipient_user_ids = resolve_recipients(cur, request, actor_user_id)
        channels = request.channels or type_row['default_channels']

        for uid in recipient_user_ids:
            allowed_channels = resolve_channels_for_user(cur, uid, type_row['id'], channels)
            for channel in allowed_channels:
                cur.execute(
                    '''
                    INSERT INTO notification_deliveries (notification_id, user_id, channel, status)
                    VALUES (%s, %s, %s, 'pending')
                    ''',
                    (notification_id, uid, channel),
                )
        conn.commit()


def resolve_recipients(cur, request: NotificationEmitRequest, actor_user_id: Optional[str]) -> list[str]:
    if request.recipient_user_id:
        return [request.recipient_user_id]
    if request.recipient_scope == 'platform':
        cur.execute(
            '''
            SELECT user_id FROM platform_roles
            WHERE role IN ('platform_owner','platform_admin')
            ''',
        )
        return [row['user_id'] for row in cur.fetchall()]
    if request.recipient_scope == 'organization' and request.org_id:
        cur.execute(
            '''
            SELECT user_id FROM organization_members
            WHERE organization_id = %s
            ''',
            (request.org_id,),
        )
        return [row['user_id'] for row in cur.fetchall()]
    if actor_user_id:
        return [actor_user_id]
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unable to resolve recipients')


def resolve_channels_for_user(cur, user_id: str, notification_type_id: str, preferred_channels: Iterable[str]) -> list[str]:
    cur.execute(
        '''
        SELECT channels, muted FROM user_notification_settings
        WHERE user_id = %s AND notification_type_id = %s
        ''',
        (user_id, notification_type_id),
    )
    row = cur.fetchone()
    if row and row['muted']:
        return []
    if row and row['channels']:
        return row['channels']
    return list(preferred_channels)


def render_template(template: str, payload: Optional[dict[str, Any]]) -> str:
    if not payload:
        return template
    result = template
    for key, value in payload.items():
        placeholder = '{{' + key + '}}'
        result = result.replace(placeholder, str(value))
    return result

