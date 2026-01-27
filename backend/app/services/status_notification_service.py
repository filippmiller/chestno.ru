"""
Status Levels Notification Service
Handles all notification events for organization status levels (A/B/C).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services import email as email_service


# Status level display names and colors
STATUS_LEVEL_CONFIG = {
    'A': {
        'name': 'Партнёр',
        'color': '#10B981',  # Green
        'emoji': '🌟',
    },
    'B': {
        'name': 'Проверенный',
        'color': '#3B82F6',  # Blue
        'emoji': '✓',
    },
    'C': {
        'name': 'Честный Выбор',
        'color': '#8B5CF6',  # Purple
        'emoji': '👑',
    },
}


async def notify_status_granted(
    org_id: str | UUID,
    level: Literal['A', 'B', 'C'],
    granted_by: Optional[str | UUID] = None,
    valid_until: Optional[datetime] = None,
) -> bool:
    """
    Send celebration email when status level is granted to organization.

    Args:
        org_id: Organization UUID
        level: Status level granted ('A', 'B', or 'C')
        granted_by: User ID who granted the status (optional)
        valid_until: Expiration date (optional, None means permanent)

    Returns:
        True if notification sent successfully, False otherwise
    """
    try:
        # Get organization and owner details
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    o.id,
                    o.name as org_name,
                    o.slug,
                    om.user_id,
                    au.email,
                    au.display_name
                FROM organizations o
                JOIN organization_members om ON om.organization_id = o.id
                JOIN app_users au ON au.id = om.user_id
                WHERE o.id = %s
                  AND om.role IN ('owner', 'admin')
                LIMIT 1
                ''',
                (str(org_id),)
            )
            org_data = cur.fetchone()

        if not org_data or not org_data['email']:
            print(f'[StatusNotification] No email found for org {org_id}')
            return False

        # Build template context
        config = STATUS_LEVEL_CONFIG[level]
        context = {
            'org_name': org_data['org_name'],
            'recipient_name': org_data['display_name'] or org_data['org_name'],
            'level': level,
            'level_name': config['name'],
            'level_color': config['color'],
            'level_emoji': config['emoji'],
            'valid_until': valid_until.strftime('%d.%m.%Y') if valid_until else None,
            'org_slug': org_data['slug'],
        }

        # Render email
        subject = f"🎉 Поздравляем! Присвоен статус «{config['name']}»"
        html_body = _render_template('status_granted', context)
        text_body = _render_text_version('status_granted', context)

        # Send email
        success = await email_service.send_email(
            to_email=org_data['email'],
            subject=subject,
            body_text=text_body,
            body_html=html_body,
        )

        if success:
            print(f'[StatusNotification] Granted notification sent to {org_data["email"]} for level {level}')
            # Log notification in history
            _log_notification(org_id, 'status_granted', {'level': level, 'email': org_data['email']})

        return success

    except Exception as e:
        print(f'[StatusNotification] Error sending granted notification: {e}')
        return False


async def notify_status_expiring(
    org_id: str | UUID,
    level: Literal['A', 'B', 'C'],
    days_left: int,
) -> bool:
    """
    Send warning email when status level is about to expire.

    Args:
        org_id: Organization UUID
        level: Status level expiring ('A', 'B', or 'C')
        days_left: Number of days until expiration

    Returns:
        True if notification sent successfully, False otherwise
    """
    try:
        # Get organization and status details
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    o.id,
                    o.name as org_name,
                    o.slug,
                    osl.valid_until,
                    om.user_id,
                    au.email,
                    au.display_name
                FROM organizations o
                JOIN organization_status_levels osl ON osl.organization_id = o.id
                JOIN organization_members om ON om.organization_id = o.id
                JOIN app_users au ON au.id = om.user_id
                WHERE o.id = %s
                  AND osl.level = %s
                  AND osl.is_active = true
                  AND om.role IN ('owner', 'admin')
                LIMIT 1
                ''',
                (str(org_id), level)
            )
            org_data = cur.fetchone()

        if not org_data or not org_data['email']:
            print(f'[StatusNotification] No email found for org {org_id}')
            return False

        # Build template context
        config = STATUS_LEVEL_CONFIG[level]
        context = {
            'org_name': org_data['org_name'],
            'recipient_name': org_data['display_name'] or org_data['org_name'],
            'level': level,
            'level_name': config['name'],
            'level_color': config['color'],
            'level_emoji': config['emoji'],
            'days_left': days_left,
            'expiry_date': org_data['valid_until'].strftime('%d.%m.%Y') if org_data['valid_until'] else 'скоро',
            'org_slug': org_data['slug'],
            'urgency': 'высокий' if days_left <= 7 else 'средний',
        }

        # Render email
        subject = f"⚠️ Статус «{config['name']}» истекает через {days_left} {_pluralize_days(days_left)}"
        html_body = _render_template('status_expiring', context)
        text_body = _render_text_version('status_expiring', context)

        # Send email
        success = await email_service.send_email(
            to_email=org_data['email'],
            subject=subject,
            body_text=text_body,
            body_html=html_body,
        )

        if success:
            print(f'[StatusNotification] Expiring notification sent to {org_data["email"]} for level {level}')
            _log_notification(org_id, 'status_expiring', {'level': level, 'days_left': days_left})

        return success

    except Exception as e:
        print(f'[StatusNotification] Error sending expiring notification: {e}')
        return False


async def notify_status_revoked(
    org_id: str | UUID,
    level: Literal['A', 'B', 'C'],
    reason: Optional[str] = None,
) -> bool:
    """
    Send notification when status level is revoked from organization.

    Args:
        org_id: Organization UUID
        level: Status level revoked ('A', 'B', or 'C')
        reason: Reason for revocation (optional)

    Returns:
        True if notification sent successfully, False otherwise
    """
    try:
        # Get organization details
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    o.id,
                    o.name as org_name,
                    o.slug,
                    om.user_id,
                    au.email,
                    au.display_name
                FROM organizations o
                JOIN organization_members om ON om.organization_id = o.id
                JOIN app_users au ON au.id = om.user_id
                WHERE o.id = %s
                  AND om.role IN ('owner', 'admin')
                LIMIT 1
                ''',
                (str(org_id),)
            )
            org_data = cur.fetchone()

        if not org_data or not org_data['email']:
            print(f'[StatusNotification] No email found for org {org_id}')
            return False

        # Build template context
        config = STATUS_LEVEL_CONFIG[level]
        context = {
            'org_name': org_data['org_name'],
            'recipient_name': org_data['display_name'] or org_data['org_name'],
            'level': level,
            'level_name': config['name'],
            'level_color': config['color'],
            'level_emoji': config['emoji'],
            'reason': reason or 'Статус был отозван администрацией платформы.',
            'org_slug': org_data['slug'],
        }

        # Render email
        subject = f"⚠️ Статус «{config['name']}» отозван"
        html_body = _render_template('status_revoked', context)
        text_body = _render_text_version('status_revoked', context)

        # Send email
        success = await email_service.send_email(
            to_email=org_data['email'],
            subject=subject,
            body_text=text_body,
            body_html=html_body,
        )

        if success:
            print(f'[StatusNotification] Revoked notification sent to {org_data["email"]} for level {level}')
            _log_notification(org_id, 'status_revoked', {'level': level, 'reason': reason})

        return success

    except Exception as e:
        print(f'[StatusNotification] Error sending revoked notification: {e}')
        return False


async def notify_upgrade_request_reviewed(
    request_id: str | UUID,
    status: Literal['approved', 'rejected'],
) -> bool:
    """
    Send notification when upgrade request has been reviewed.

    Args:
        request_id: Upgrade request UUID
        status: Review result ('approved' or 'rejected')

    Returns:
        True if notification sent successfully, False otherwise
    """
    try:
        # Get request details
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    sur.id,
                    sur.target_level,
                    sur.status,
                    sur.review_notes,
                    sur.rejection_reason,
                    sur.reviewed_at,
                    o.id as org_id,
                    o.name as org_name,
                    o.slug,
                    au.email,
                    au.display_name
                FROM status_upgrade_requests sur
                JOIN organizations o ON o.id = sur.organization_id
                JOIN app_users au ON au.id = sur.requested_by
                WHERE sur.id = %s
                ''',
                (str(request_id),)
            )
            request_data = cur.fetchone()

        if not request_data or not request_data['email']:
            print(f'[StatusNotification] No email found for request {request_id}')
            return False

        # Build template context
        config = STATUS_LEVEL_CONFIG[request_data['target_level']]
        is_approved = status == 'approved'

        context = {
            'org_name': request_data['org_name'],
            'recipient_name': request_data['display_name'] or request_data['org_name'],
            'target_level': request_data['target_level'],
            'level_name': config['name'],
            'level_color': config['color'],
            'level_emoji': config['emoji'],
            'is_approved': is_approved,
            'review_notes': request_data['review_notes'] or '',
            'rejection_reason': request_data['rejection_reason'] or '',
            'org_slug': request_data['org_slug'],
            'reviewed_at': request_data['reviewed_at'].strftime('%d.%m.%Y %H:%M') if request_data['reviewed_at'] else '',
        }

        # Render email
        if is_approved:
            subject = f"✅ Запрос на статус «{config['name']}» одобрен!"
        else:
            subject = f"❌ Запрос на статус «{config['name']}» отклонён"

        html_body = _render_template('upgrade_request_reviewed', context)
        text_body = _render_text_version('upgrade_request_reviewed', context)

        # Send email
        success = await email_service.send_email(
            to_email=request_data['email'],
            subject=subject,
            body_text=text_body,
            body_html=html_body,
        )

        if success:
            print(f'[StatusNotification] Review notification sent to {request_data["email"]} - {status}')
            _log_notification(
                request_data['org_id'],
                'upgrade_request_reviewed',
                {'request_id': str(request_id), 'status': status}
            )

        return success

    except Exception as e:
        print(f'[StatusNotification] Error sending review notification: {e}')
        return False


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _render_template(template_name: str, context: dict) -> str:
    """
    Render HTML email template with context variables.

    Template files are located in backend/app/templates/email/
    """
    import os
    from pathlib import Path

    # Get template path
    template_path = Path(__file__).parent.parent / 'templates' / 'email' / f'{template_name}.html'

    if not template_path.exists():
        print(f'[StatusNotification] Template not found: {template_path}')
        return _render_fallback_html(template_name, context)

    # Read template
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    # Replace variables
    for key, value in context.items():
        placeholder = '{{' + key + '}}'
        template = template.replace(placeholder, str(value) if value is not None else '')

    return template


def _render_text_version(template_name: str, context: dict) -> str:
    """
    Generate plain text version of email for email clients that don't support HTML.
    """
    org_name = context.get('org_name', '')
    recipient_name = context.get('recipient_name', '')
    level_name = context.get('level_name', '')

    if template_name == 'status_granted':
        return f'''
Здравствуйте, {recipient_name}!

Поздравляем! Вашей организации «{org_name}» присвоен статус «{level_name}».

Это означает, что ваша компания прошла проверку и теперь отмечена специальным знаком качества на платформе Работаем Честно!

Перейдите в личный кабинет, чтобы узнать больше о преимуществах вашего нового статуса.

С уважением,
Команда Работаем Честно!
https://chestno.ru
        '''.strip()

    elif template_name == 'status_expiring':
        days_left = context.get('days_left', 0)
        return f'''
Здравствуйте, {recipient_name}!

Статус «{level_name}» вашей организации «{org_name}» истекает через {days_left} {_pluralize_days(days_left)}.

Пожалуйста, продлите статус, чтобы продолжить пользоваться всеми преимуществами.

Перейдите в личный кабинет для продления.

С уважением,
Команда Работаем Честно!
https://chestno.ru
        '''.strip()

    elif template_name == 'status_revoked':
        reason = context.get('reason', '')
        return f'''
Здравствуйте, {recipient_name}!

К сожалению, статус «{level_name}» вашей организации «{org_name}» был отозван.

Причина: {reason}

Вы можете подать новый запрос на получение статуса через личный кабинет.

С уважением,
Команда Работаем Честно!
https://chestno.ru
        '''.strip()

    elif template_name == 'upgrade_request_reviewed':
        is_approved = context.get('is_approved', False)
        review_notes = context.get('review_notes', '')
        rejection_reason = context.get('rejection_reason', '')

        if is_approved:
            return f'''
Здравствуйте, {recipient_name}!

Отличные новости! Ваш запрос на получение статуса «{level_name}» для организации «{org_name}» одобрен!

{review_notes}

Перейдите в личный кабинет, чтобы увидеть новый статус.

С уважением,
Команда Работаем Честно!
https://chestno.ru
            '''.strip()
        else:
            return f'''
Здравствуйте, {recipient_name}!

К сожалению, ваш запрос на получение статуса «{level_name}» для организации «{org_name}» был отклонён.

Причина: {rejection_reason}

{review_notes}

Вы можете подать новый запрос после устранения указанных замечаний.

С уважением,
Команда Работаем Честно!
https://chestno.ru
            '''.strip()

    return 'Уведомление от платформы Работаем Честно!'


def _render_fallback_html(template_name: str, context: dict) -> str:
    """
    Generate basic HTML email if template file is not found.
    """
    text = _render_text_version(template_name, context)
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background-color: #f9fafb; }}
            .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Работаем Честно!</h1>
            </div>
            <div class="content">
                <pre style="white-space: pre-wrap; font-family: Arial;">{text}</pre>
            </div>
            <div class="footer">
                <p>Это автоматическое уведомление от платформы Chestno.ru</p>
            </div>
        </div>
    </body>
    </html>
    '''


def _pluralize_days(days: int) -> str:
    """Return proper Russian plural form for 'days'."""
    if days % 10 == 1 and days % 100 != 11:
        return 'день'
    elif days % 10 in [2, 3, 4] and days % 100 not in [12, 13, 14]:
        return 'дня'
    else:
        return 'дней'


def _log_notification(org_id: str | UUID, event_type: str, metadata: dict) -> None:
    """
    Log notification event to database for audit trail.
    """
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO organization_status_history (
                    organization_id,
                    level,
                    action,
                    reason,
                    metadata
                ) VALUES (%s, %s, %s, %s, %s)
                ''',
                (
                    str(org_id),
                    metadata.get('level', ''),
                    event_type,
                    f"Notification sent: {event_type}",
                    metadata,
                )
            )
            conn.commit()
    except Exception as e:
        print(f'[StatusNotification] Failed to log notification: {e}')


# ============================================================
# BACKGROUND WORKER FUNCTIONS
# ============================================================

async def process_expiring_statuses() -> dict[str, int]:
    """
    Background job to check for expiring statuses and send notifications.
    Should be run daily.

    Returns:
        Dict with counts of processed and notified statuses
    """
    processed = 0
    notified = 0

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Find statuses expiring in 30, 14, 7, 3, or 1 days
            cur.execute(
                '''
                SELECT
                    organization_id,
                    level,
                    valid_until,
                    EXTRACT(DAY FROM (valid_until - now()))::int as days_left
                FROM organization_status_levels
                WHERE is_active = true
                  AND valid_until IS NOT NULL
                  AND valid_until > now()
                  AND EXTRACT(DAY FROM (valid_until - now())) IN (30, 14, 7, 3, 1)
                ORDER BY valid_until ASC
                '''
            )
            expiring = cur.fetchall()

        for record in expiring:
            processed += 1
            success = await notify_status_expiring(
                org_id=record['organization_id'],
                level=record['level'],
                days_left=record['days_left'],
            )
            if success:
                notified += 1

            # Small delay to avoid overwhelming email server
            await asyncio.sleep(0.5)

        print(f'[StatusNotification] Processed {processed} expiring statuses, sent {notified} notifications')

    except Exception as e:
        print(f'[StatusNotification] Error in process_expiring_statuses: {e}')

    return {'processed': processed, 'notified': notified}
