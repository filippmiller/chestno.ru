from __future__ import annotations

from datetime import datetime, timezone
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
from app.services import email as email_service
from app.services import telegram as telegram_service


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


def process_reminders() -> dict[str, int]:
    """
    Обрабатывает активные reminders, у которых next_run_at <= now().
    Создаёт уведомления и обновляет next_run_at или деактивирует reminder.
    Возвращает статистику: сколько обработано, сколько создано уведомлений.
    """
    from datetime import datetime, timedelta, timezone

    processed_count = 0
    notifications_created = 0

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        now = datetime.now(timezone.utc)
        # Находим активные reminders, которые нужно обработать
        cur.execute(
            '''
            SELECT r.id, r.key, r.user_id, r.org_id, r.notification_type_id, r.payload,
                   r.first_run_at, r.next_run_at, r.recurrence, r.is_active
            FROM reminders r
            WHERE r.is_active = true
              AND r.next_run_at <= %s
            ORDER BY r.next_run_at ASC
            ''',
            (now,),
        )
        reminders = cur.fetchall()

        for reminder in reminders:
            try:
                # Создаём уведомление на основе reminder
                cur.execute('SELECT key FROM notification_types WHERE id = %s', (reminder['notification_type_id'],))
                type_row = cur.fetchone()
                if not type_row:
                    # Если тип уведомления не найден, пропускаем
                    continue

                # Определяем recipient_scope
                recipient_scope = 'user'
                if reminder['org_id']:
                    recipient_scope = 'organization'
                elif reminder['key'] and 'platform' in reminder['key']:
                    recipient_scope = 'platform'

                # Создаём запрос на уведомление
                emit_request = NotificationEmitRequest(
                    type_key=type_row['key'],
                    org_id=reminder['org_id'],
                    recipient_user_id=reminder['user_id'],
                    recipient_scope=recipient_scope,
                    payload=reminder['payload'] or {},
                )

                # Используем существующую функцию emit_notification
                # Но нужно вызвать её в контексте текущей транзакции
                emit_notification_in_transaction(cur, emit_request, reminder['notification_type_id'])
                notifications_created += 1

                # Обновляем reminder
                if reminder['recurrence'] == 'once':
                    # Деактивируем после первого запуска
                    cur.execute(
                        'UPDATE reminders SET is_active = false, last_run_at = %s WHERE id = %s',
                        (now, reminder['id']),
                    )
                elif reminder['recurrence'] == 'daily':
                    # Устанавливаем next_run_at на завтра
                    next_run = now + timedelta(days=1)
                    cur.execute(
                        'UPDATE reminders SET next_run_at = %s, last_run_at = %s WHERE id = %s',
                        (next_run, now, reminder['id']),
                    )
                elif reminder['recurrence'] == 'weekly':
                    # Устанавливаем next_run_at на следующую неделю
                    next_run = now + timedelta(weeks=1)
                    cur.execute(
                        'UPDATE reminders SET next_run_at = %s, last_run_at = %s WHERE id = %s',
                        (next_run, now, reminder['id']),
                    )
                else:
                    # Для других типов просто обновляем last_run_at и деактивируем
                    cur.execute(
                        'UPDATE reminders SET is_active = false, last_run_at = %s WHERE id = %s',
                        (now, reminder['id']),
                    )

                processed_count += 1
            except Exception as e:
                # Логируем ошибку, но продолжаем обработку других reminders
                print(f'Error processing reminder {reminder["id"]}: {e}')
                continue

        conn.commit()

    return {'processed': processed_count, 'notifications_created': notifications_created}


def emit_notification_in_transaction(cur, request: NotificationEmitRequest, notification_type_id: str) -> None:
    """
    Внутренняя версия emit_notification для использования внутри транзакции.
    """
    cur.execute('SELECT * FROM notification_types WHERE id = %s', (notification_type_id,))
    type_row = cur.fetchone()
    if not type_row:
        return

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
            notification_type_id,
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
    if not notification:
        return
    notification_id = notification['id']

    recipient_user_ids = resolve_recipients_in_transaction(cur, request)
    channels = request.channels or type_row['default_channels']

    for uid in recipient_user_ids:
        allowed_channels = resolve_channels_for_user(cur, uid, notification_type_id, channels)
        for channel in allowed_channels:
            cur.execute(
                '''
                INSERT INTO notification_deliveries (notification_id, user_id, channel, status)
                VALUES (%s, %s, %s, 'pending')
                ''',
                (notification_id, uid, channel),
            )


def resolve_recipients_in_transaction(cur, request: NotificationEmitRequest) -> list[str]:
    """Версия resolve_recipients для использования внутри транзакции."""
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
    return []


async def process_email_deliveries() -> dict[str, int]:
    """
    Обрабатывает pending email deliveries и отправляет их через SMTP.
    Возвращает статистику: сколько обработано, сколько успешно отправлено.
    """
    processed_count = 0
    sent_count = 0
    
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Находим pending email deliveries
        cur.execute(
            '''
            SELECT d.id, d.notification_id, d.user_id, d.channel,
                   n.title, n.body, n.severity, n.category
            FROM notification_deliveries d
            JOIN notifications n ON n.id = d.notification_id
            WHERE d.channel = 'email'
              AND d.status = 'pending'
            ORDER BY d.created_at ASC
            LIMIT 50
            ''',
        )
        deliveries = cur.fetchall()
        
        # Получаем email адреса пользователей
        for delivery in deliveries:
            try:
                cur.execute('SELECT email FROM app_users WHERE id = %s', (delivery['user_id'],))
                user_row = cur.fetchone()
                if not user_row or not user_row['email']:
                    # Пользователь не найден или нет email, помечаем как failed
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                        ('failed', 'User email not found', delivery['id']),
                    )
                    processed_count += 1
                    continue
                
                to_email = user_row['email']
                subject = delivery['title']
                body = delivery['body']
                
                # Форматируем email
                text, html = email_service.format_notification_email(subject, body)
                
                # Отправляем email
                success = await email_service.send_email(to_email, subject, text, html)
                
                if success:
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, sent_at = %s WHERE id = %s',
                        ('sent', datetime.now(timezone.utc), delivery['id']),
                    )
                    sent_count += 1
                else:
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                        ('failed', 'SMTP send failed', delivery['id']),
                    )
                
                processed_count += 1
            except Exception as e:
                # Логируем ошибку и помечаем как failed
                print(f'[Email Worker] Error processing delivery {delivery["id"]}: {e}')
                cur.execute(
                    'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                    ('failed', str(e)[:200], delivery['id']),
                )
                processed_count += 1
        
        conn.commit()
    
    return {'processed': processed_count, 'sent': sent_count}


async def process_telegram_deliveries() -> dict[str, int]:
    """
    Обрабатывает pending telegram deliveries и отправляет их через Telegram Bot API.
    Возвращает статистику: сколько обработано, сколько успешно отправлено.
    """
    processed_count = 0
    sent_count = 0
    
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Находим pending telegram deliveries
        cur.execute(
            '''
            SELECT d.id, d.notification_id, d.user_id, d.channel,
                   n.title, n.body, n.severity, n.category
            FROM notification_deliveries d
            JOIN notifications n ON n.id = d.notification_id
            WHERE d.channel = 'telegram'
              AND d.status = 'pending'
            ORDER BY d.created_at ASC
            LIMIT 50
            ''',
        )
        deliveries = cur.fetchall()
        
        # Получаем Telegram chat_id пользователей (нужно будет добавить в user_notification_settings или отдельную таблицу)
        for delivery in deliveries:
            try:
                # Пока используем дефолтный chat_id из настроек, если есть
                # В будущем можно добавить поле telegram_chat_id в user_notification_settings
                from app.core.config import get_settings
                settings = get_settings()
                chat_id = settings.telegram_default_chat_id
                
                if not chat_id:
                    # Нет настроенного chat_id, помечаем как failed
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                        ('failed', 'Telegram chat_id not configured', delivery['id']),
                    )
                    processed_count += 1
                    continue
                
                subject = delivery['title']
                body = delivery['body']
                
                # Форматируем для Telegram
                text = telegram_service.format_notification_telegram(subject, body)
                
                # Отправляем в Telegram
                success = await telegram_service.send_telegram_message(chat_id, text)
                
                if success:
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, sent_at = %s WHERE id = %s',
                        ('sent', datetime.now(timezone.utc), delivery['id']),
                    )
                    sent_count += 1
                else:
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                        ('failed', 'Telegram send failed', delivery['id']),
                    )
                
                processed_count += 1
            except Exception as e:
                # Логируем ошибку и помечаем как failed
                print(f'[Telegram Worker] Error processing delivery {delivery["id"]}: {e}')
                cur.execute(
                    'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                    ('failed', str(e)[:200], delivery['id']),
                )
                processed_count += 1
        
        conn.commit()
    
    return {'processed': processed_count, 'sent': sent_count}


async def process_push_deliveries() -> dict[str, int]:
    """
    Обрабатывает pending push deliveries.
    Push уведомления отправляются через Web Push API на клиенте.
    Здесь мы только помечаем их как готовые к отправке, реальная отправка происходит на фронтенде.
    """
    processed_count = 0
    ready_count = 0
    
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Находим pending push deliveries
        cur.execute(
            '''
            SELECT d.id, d.notification_id, d.user_id, d.channel
            FROM notification_deliveries d
            WHERE d.channel = 'push'
              AND d.status = 'pending'
            ORDER BY d.created_at ASC
            LIMIT 100
            ''',
        )
        deliveries = cur.fetchall()
        
        # Для push уведомлений мы просто помечаем их как ready
        # Фронтенд будет периодически запрашивать ready push notifications и отправлять их через Service Worker
        for delivery in deliveries:
            try:
                cur.execute(
                    'UPDATE notification_deliveries SET status = %s WHERE id = %s',
                    ('ready', delivery['id']),
                )
                ready_count += 1
                processed_count += 1
            except Exception as e:
                print(f'[Push Worker] Error processing delivery {delivery["id"]}: {e}')
                cur.execute(
                    'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                    ('failed', str(e)[:200], delivery['id']),
                )
                processed_count += 1
        
        conn.commit()
    
    return {'processed': processed_count, 'ready': ready_count}


def save_push_subscription(user_id: str, endpoint: str, p256dh: str, auth: str) -> None:
    """
    Сохраняет push subscription пользователя в БД.
    Можно хранить в отдельной таблице или в user_notification_settings.
    Для простоты используем отдельную таблицу (нужно создать миграцию) или храним в JSONB.
    """
    # TODO: Создать таблицу user_push_subscriptions или добавить поле в user_notification_settings
    # Пока просто логируем
    print(f'[Push] Saving subscription for user {user_id}: {endpoint[:50]}...')


def delete_push_subscription(user_id: str) -> None:
    """
    Удаляет push subscription пользователя.
    """
    # TODO: Удалить из БД
    print(f'[Push] Deleting subscription for user {user_id}')

