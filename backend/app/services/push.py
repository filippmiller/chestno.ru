"""Web Push notification service."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from psycopg.rows import dict_row
from pywebpush import webpush, WebPushException

from app.core.config import get_settings
from app.core.db import get_connection

logger = logging.getLogger(__name__)
settings = get_settings()


def save_push_subscription(user_id: str, endpoint: str, p256dh: str, auth: str) -> dict:
    """Save or update a push subscription for a user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, endpoint)
            DO UPDATE SET
                p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth,
                updated_at = now()
            RETURNING id, user_id, endpoint, created_at, updated_at
            ''',
            (user_id, endpoint, p256dh, auth),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)


def delete_push_subscription(user_id: str, endpoint: Optional[str] = None) -> int:
    """Delete push subscription(s) for a user."""
    with get_connection() as conn, conn.cursor() as cur:
        if endpoint:
            cur.execute(
                'DELETE FROM user_push_subscriptions WHERE user_id = %s AND endpoint = %s',
                (user_id, endpoint),
            )
        else:
            cur.execute(
                'DELETE FROM user_push_subscriptions WHERE user_id = %s',
                (user_id,),
            )
        deleted = cur.rowcount
        conn.commit()
        return deleted


def get_user_push_subscriptions(user_id: str) -> list[dict]:
    """Get all push subscriptions for a user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT id, user_id, endpoint, p256dh, auth, created_at, updated_at
            FROM user_push_subscriptions
            WHERE user_id = %s
            ''',
            (user_id,),
        )
        return [dict(row) for row in cur.fetchall()]


def _send_web_push(subscription_info: dict, payload: dict) -> bool:
    """Send a single web push notification."""
    if not settings.vapid_private_key or not settings.vapid_public_key:
        logger.warning('VAPID keys not configured, skipping push notification')
        return False

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={
                'sub': settings.vapid_subject,
            },
        )
        return True
    except WebPushException as e:
        logger.error(f'Web push failed: {e}')
        # If subscription is invalid (410 Gone), we should remove it
        if e.response and e.response.status_code == 410:
            logger.info('Subscription expired, should be removed')
            return False
        return False
    except Exception as e:
        logger.error(f'Unexpected error sending web push: {e}')
        return False


async def process_push_deliveries() -> dict:
    """Process pending push deliveries and send them via Web Push."""
    processed_count = 0
    sent_count = 0
    failed_count = 0

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Find pending push deliveries
        cur.execute(
            '''
            SELECT d.id, d.notification_id, d.user_id, d.channel,
                   n.title, n.body, n.payload, n.severity, n.category
            FROM notification_deliveries d
            JOIN notifications n ON n.id = d.notification_id
            WHERE d.channel = 'push'
              AND d.status = 'pending'
            ORDER BY d.created_at ASC
            LIMIT 50
            ''',
        )
        deliveries = cur.fetchall()

        for delivery in deliveries:
            try:
                # Get user's push subscriptions
                cur.execute(
                    '''
                    SELECT endpoint, p256dh, auth
                    FROM user_push_subscriptions
                    WHERE user_id = %s
                    ''',
                    (delivery['user_id'],),
                )
                subscriptions = cur.fetchall()

                if not subscriptions:
                    # No push subscriptions for this user
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                        ('failed', 'No push subscriptions found for user', delivery['id']),
                    )
                    processed_count += 1
                    failed_count += 1
                    continue

                # Prepare push payload
                push_payload = {
                    'title': delivery['title'],
                    'body': delivery['body'],
                    'icon': '/icon-192.png',  # Default icon
                    'badge': '/badge-72.png',  # Default badge
                    'data': {
                        'notification_id': str(delivery['notification_id']),
                        'delivery_id': str(delivery['id']),
                        'category': delivery['category'],
                        'severity': delivery['severity'],
                        **(delivery['payload'] or {}),
                    },
                }

                # Send to all subscriptions
                success_count = 0
                failed_endpoints = []

                for sub in subscriptions:
                    subscription_info = {
                        'endpoint': sub['endpoint'],
                        'keys': {
                            'p256dh': sub['p256dh'],
                            'auth': sub['auth'],
                        },
                    }

                    if _send_web_push(subscription_info, push_payload):
                        success_count += 1
                    else:
                        failed_endpoints.append(sub['endpoint'][:50])

                # Update delivery status
                if success_count > 0:
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, sent_at = %s WHERE id = %s',
                        ('sent', datetime.now(timezone.utc), delivery['id']),
                    )
                    sent_count += 1
                else:
                    error_msg = f'Failed to send to {len(failed_endpoints)} endpoints'
                    cur.execute(
                        'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                        ('failed', error_msg[:200], delivery['id']),
                    )
                    failed_count += 1

                processed_count += 1

            except Exception as e:
                logger.error(f'Error processing push delivery {delivery["id"]}: {e}')
                cur.execute(
                    'UPDATE notification_deliveries SET status = %s, error_message = %s WHERE id = %s',
                    ('failed', str(e)[:200], delivery['id']),
                )
                processed_count += 1
                failed_count += 1

        conn.commit()

    return {'processed': processed_count, 'sent': sent_count, 'failed': failed_count}
