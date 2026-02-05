"""
Telegram Bot Service for chestno.ru business verification.

Provides:
- User registration and account linking
- Company verification by INN
- Organization subscriptions
- Notification delivery
- Rate limiting and abuse prevention
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import httpx
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.config import get_settings
from app.core.db import get_connection
from app.schemas.telegram import (
    BotStats,
    CompanyInfo,
    RateLimitResult,
    TelegramLinkToken,
    TelegramSubscription,
    TelegramUser,
)

logger = logging.getLogger(__name__)

# Rate limit settings
RATE_LIMITS = {
    'command': {'max_requests': 30, 'window_seconds': 60},      # 30 commands per minute
    'verify': {'max_requests': 10, 'window_seconds': 60},       # 10 verifications per minute
    'subscribe': {'max_requests': 20, 'window_seconds': 300},   # 20 subscriptions per 5 min
    'link': {'max_requests': 5, 'window_seconds': 300},         # 5 link attempts per 5 min
}


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------

def get_or_create_telegram_user(
    telegram_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    language_code: str = 'ru',
) -> TelegramUser:
    """Get existing user or create a new one."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Try to get existing user
        cur.execute(
            'SELECT * FROM telegram_users WHERE telegram_id = %s',
            (telegram_id,)
        )
        row = cur.fetchone()

        if row:
            # Update last activity and user info
            cur.execute(
                '''
                UPDATE telegram_users
                SET telegram_username = COALESCE(%s, telegram_username),
                    telegram_first_name = COALESCE(%s, telegram_first_name),
                    telegram_last_name = COALESCE(%s, telegram_last_name),
                    language_code = COALESCE(%s, language_code),
                    last_activity_at = NOW()
                WHERE id = %s
                RETURNING *
                ''',
                (username, first_name, last_name, language_code, row['id'])
            )
            row = cur.fetchone()
            conn.commit()
            return _row_to_telegram_user(row)

        # Create new user
        cur.execute(
            '''
            INSERT INTO telegram_users (
                telegram_id, telegram_username, telegram_first_name,
                telegram_last_name, language_code
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (telegram_id, username, first_name, last_name, language_code)
        )
        row = cur.fetchone()
        conn.commit()

        logger.info(f'New Telegram user registered: {telegram_id} (@{username})')
        return _row_to_telegram_user(row)


def get_telegram_user_by_id(telegram_user_id: str) -> Optional[TelegramUser]:
    """Get Telegram user by internal ID."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT * FROM telegram_users WHERE id = %s', (telegram_user_id,))
        row = cur.fetchone()
        return _row_to_telegram_user(row) if row else None


def get_telegram_user_by_telegram_id(telegram_id: int) -> Optional[TelegramUser]:
    """Get Telegram user by Telegram ID."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT * FROM telegram_users WHERE telegram_id = %s', (telegram_id,))
        row = cur.fetchone()
        return _row_to_telegram_user(row) if row else None


def is_user_blocked(telegram_id: int) -> Tuple[bool, Optional[str]]:
    """Check if user is blocked and return reason."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT is_blocked, blocked_reason FROM telegram_users WHERE telegram_id = %s',
            (telegram_id,)
        )
        row = cur.fetchone()
        if row and row['is_blocked']:
            return True, row['blocked_reason']
        return False, None


def block_user(telegram_id: int, reason: str) -> bool:
    """Block a user from using the bot."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE telegram_users
            SET is_blocked = TRUE, blocked_reason = %s, blocked_at = NOW()
            WHERE telegram_id = %s
            RETURNING id
            ''',
            (reason, telegram_id)
        )
        result = cur.fetchone()
        conn.commit()
        return result is not None


def unblock_user(telegram_id: int) -> bool:
    """Unblock a user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE telegram_users
            SET is_blocked = FALSE, blocked_reason = NULL, blocked_at = NULL
            WHERE telegram_id = %s
            RETURNING id
            ''',
            (telegram_id,)
        )
        result = cur.fetchone()
        conn.commit()
        return result is not None


# ---------------------------------------------------------------------------
# Account Linking
# ---------------------------------------------------------------------------

def create_link_token(telegram_user_id: str) -> TelegramLinkToken:
    """Create a token for linking Telegram to web account."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Invalidate old tokens
        cur.execute(
            'DELETE FROM telegram_link_tokens WHERE telegram_user_id = %s AND used_at IS NULL',
            (telegram_user_id,)
        )

        cur.execute(
            '''
            INSERT INTO telegram_link_tokens (telegram_user_id, token, expires_at)
            VALUES (%s, %s, %s)
            RETURNING *
            ''',
            (telegram_user_id, token, expires_at)
        )
        row = cur.fetchone()
        conn.commit()

        return TelegramLinkToken(
            id=str(row['id']),
            telegram_user_id=str(row['telegram_user_id']),
            token=row['token'],
            expires_at=row['expires_at'],
            used_at=row['used_at'],
            created_at=row['created_at'],
        )


def verify_and_use_link_token(token: str, user_id: str) -> Optional[str]:
    """
    Verify link token and link accounts.
    Returns telegram_user_id if successful, None otherwise.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT * FROM telegram_link_tokens
            WHERE token = %s AND expires_at > NOW() AND used_at IS NULL
            ''',
            (token,)
        )
        row = cur.fetchone()

        if not row:
            return None

        telegram_user_id = str(row['telegram_user_id'])

        # Mark token as used
        cur.execute(
            '''
            UPDATE telegram_link_tokens
            SET used_at = NOW(), linked_user_id = %s
            WHERE id = %s
            ''',
            (user_id, row['id'])
        )

        # Link accounts
        cur.execute(
            '''
            UPDATE telegram_users
            SET user_id = %s
            WHERE id = %s
            RETURNING id
            ''',
            (user_id, telegram_user_id)
        )

        conn.commit()
        logger.info(f'Linked Telegram user {telegram_user_id} to account {user_id}')
        return telegram_user_id


def get_linked_user_id(telegram_id: int) -> Optional[str]:
    """Get chestno.ru user ID linked to Telegram account."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT user_id FROM telegram_users WHERE telegram_id = %s',
            (telegram_id,)
        )
        row = cur.fetchone()
        return str(row['user_id']) if row and row['user_id'] else None


# ---------------------------------------------------------------------------
# Company Verification
# ---------------------------------------------------------------------------

async def verify_company_by_inn(inn: str) -> Optional[CompanyInfo]:
    """
    Verify company by INN using external API or internal database.
    First checks if organization exists in our database.
    """
    # Clean INN
    inn = inn.strip().replace(' ', '')

    if not inn.isdigit() or len(inn) not in (10, 12):
        return None

    # Check our database first
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT o.id, o.name, o.inn, o.kpp, o.ogrn, o.legal_address,
                   o.is_verified, o.trust_score,
                   (SELECT COUNT(*) FROM reviews r WHERE r.organization_id = o.id) as reviews_count
            FROM organizations o
            WHERE o.inn = %s
            ''',
            (inn,)
        )
        row = cur.fetchone()

        if row:
            return CompanyInfo(
                inn=inn,
                name=row['name'],
                kpp=row['kpp'],
                ogrn=row['ogrn'],
                address=row['legal_address'],
                org_id=str(row['id']),
                is_verified=row['is_verified'] or False,
                trust_score=row['trust_score'],
                reviews_count=row['reviews_count'] or 0,
            )

    # Try external API (DaData or similar)
    company = await _fetch_company_from_api(inn)
    return company


async def _fetch_company_from_api(inn: str) -> Optional[CompanyInfo]:
    """
    Fetch company info from external API.
    This is a placeholder - implement with actual API (DaData, Kontur, etc.)
    """
    # Placeholder implementation using DaData-like response structure
    # In production, use actual DaData API or similar service
    settings = get_settings()

    # For now, return None if not in our database
    # TODO: Implement actual API call to DaData or similar service
    # Example with DaData:
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(
    #         'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',
    #         headers={'Authorization': f'Token {settings.dadata_api_key}'},
    #         json={'query': inn}
    #     )
    #     if response.status_code == 200:
    #         data = response.json()
    #         if data.get('suggestions'):
    #             ...

    logger.info(f'Company with INN {inn} not found in database')
    return None


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------

def subscribe_to_organization(
    telegram_user_id: str,
    organization_id: str,
    notify_reviews: bool = True,
    notify_qr_scans: bool = True,
    notify_posts: bool = False,
) -> Optional[TelegramSubscription]:
    """Subscribe to organization updates."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify organization exists
        cur.execute(
            'SELECT id, name, inn FROM organizations WHERE id = %s',
            (organization_id,)
        )
        org = cur.fetchone()
        if not org:
            return None

        # Upsert subscription
        cur.execute(
            '''
            INSERT INTO telegram_subscriptions (
                telegram_user_id, organization_id,
                notify_on_reviews, notify_on_qr_scans, notify_on_posts
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (telegram_user_id, organization_id)
            DO UPDATE SET
                notify_on_reviews = EXCLUDED.notify_on_reviews,
                notify_on_qr_scans = EXCLUDED.notify_on_qr_scans,
                notify_on_posts = EXCLUDED.notify_on_posts
            RETURNING *
            ''',
            (telegram_user_id, organization_id, notify_reviews, notify_qr_scans, notify_posts)
        )
        row = cur.fetchone()
        conn.commit()

        return TelegramSubscription(
            id=str(row['id']),
            telegram_user_id=str(row['telegram_user_id']),
            organization_id=str(row['organization_id']),
            organization_name=org['name'],
            organization_inn=org['inn'],
            notify_on_reviews=row['notify_on_reviews'],
            notify_on_qr_scans=row['notify_on_qr_scans'],
            notify_on_posts=row['notify_on_posts'],
            created_at=row['created_at'],
        )


def subscribe_by_inn(
    telegram_user_id: str,
    inn: str,
) -> Tuple[Optional[TelegramSubscription], Optional[str]]:
    """
    Subscribe to organization by INN.
    Returns (subscription, error_message).
    """
    inn = inn.strip().replace(' ', '')

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT id, name, inn FROM organizations WHERE inn = %s',
            (inn,)
        )
        org = cur.fetchone()

        if not org:
            return None, f'Организация с ИНН {inn} не найдена на chestno.ru'

        subscription = subscribe_to_organization(
            telegram_user_id=telegram_user_id,
            organization_id=str(org['id']),
        )
        return subscription, None


def unsubscribe_from_organization(telegram_user_id: str, organization_id: str) -> bool:
    """Unsubscribe from organization."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            DELETE FROM telegram_subscriptions
            WHERE telegram_user_id = %s AND organization_id = %s
            RETURNING id
            ''',
            (telegram_user_id, organization_id)
        )
        result = cur.fetchone()
        conn.commit()
        return result is not None


def list_user_subscriptions(telegram_user_id: str) -> list[TelegramSubscription]:
    """List all subscriptions for a user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT ts.*, o.name as org_name, o.inn as org_inn
            FROM telegram_subscriptions ts
            JOIN organizations o ON o.id = ts.organization_id
            WHERE ts.telegram_user_id = %s
            ORDER BY ts.created_at DESC
            ''',
            (telegram_user_id,)
        )
        rows = cur.fetchall()

        return [
            TelegramSubscription(
                id=str(row['id']),
                telegram_user_id=str(row['telegram_user_id']),
                organization_id=str(row['organization_id']),
                organization_name=row['org_name'],
                organization_inn=row['org_inn'],
                notify_on_reviews=row['notify_on_reviews'],
                notify_on_qr_scans=row['notify_on_qr_scans'],
                notify_on_posts=row['notify_on_posts'],
                created_at=row['created_at'],
            )
            for row in rows
        ]


def get_subscribers_for_organization(
    organization_id: str,
    notification_type: str = 'review',
) -> list[int]:
    """
    Get Telegram IDs of users subscribed to organization for specific notification type.
    """
    notify_column = {
        'review': 'notify_on_reviews',
        'qr_scan': 'notify_on_qr_scans',
        'post': 'notify_on_posts',
    }.get(notification_type, 'notify_on_reviews')

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f'''
            SELECT tu.telegram_id
            FROM telegram_subscriptions ts
            JOIN telegram_users tu ON tu.id = ts.telegram_user_id
            WHERE ts.organization_id = %s
              AND ts.{notify_column} = TRUE
              AND tu.is_blocked = FALSE
            ''',
            (organization_id,)
        )
        return [row['telegram_id'] for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------

def check_rate_limit(telegram_id: int, action_type: str) -> RateLimitResult:
    """
    Check if action is allowed under rate limits.
    Uses sliding window algorithm.
    """
    limits = RATE_LIMITS.get(action_type, RATE_LIMITS['command'])
    window_seconds = limits['window_seconds']
    max_requests = limits['max_requests']

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=window_seconds)

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Count requests in current window
        cur.execute(
            '''
            SELECT SUM(request_count) as total
            FROM telegram_rate_limits
            WHERE telegram_id = %s AND action_type = %s AND window_start > %s
            ''',
            (telegram_id, action_type, window_start)
        )
        row = cur.fetchone()
        current_count = row['total'] or 0

        if current_count >= max_requests:
            # Find when the window resets
            cur.execute(
                '''
                SELECT MIN(window_start) as oldest
                FROM telegram_rate_limits
                WHERE telegram_id = %s AND action_type = %s AND window_start > %s
                ''',
                (telegram_id, action_type, window_start)
            )
            oldest = cur.fetchone()
            reset_at = oldest['oldest'] + timedelta(seconds=window_seconds) if oldest['oldest'] else now
            retry_after = int((reset_at - now).total_seconds())

            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=reset_at,
                retry_after_seconds=max(1, retry_after),
            )

        # Record this request
        # Use minute-level bucketing for efficiency
        bucket_start = now.replace(second=0, microsecond=0)
        cur.execute(
            '''
            INSERT INTO telegram_rate_limits (telegram_id, action_type, window_start, request_count)
            VALUES (%s, %s, %s, 1)
            ON CONFLICT (telegram_id, action_type, window_start)
            DO UPDATE SET request_count = telegram_rate_limits.request_count + 1
            ''',
            (telegram_id, action_type, bucket_start)
        )
        conn.commit()

        return RateLimitResult(
            allowed=True,
            remaining=max_requests - current_count - 1,
            reset_at=window_start + timedelta(seconds=window_seconds),
        )


# ---------------------------------------------------------------------------
# Command Logging
# ---------------------------------------------------------------------------

def log_command(
    telegram_id: int,
    command: str,
    arguments: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None,
    processing_time_ms: Optional[int] = None,
    telegram_user_id: Optional[str] = None,
) -> None:
    """Log bot command for analytics."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            '''
            INSERT INTO telegram_bot_commands (
                telegram_user_id, telegram_id, command, arguments,
                success, error_message, processing_time_ms
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''',
            (telegram_user_id, telegram_id, command, arguments, success, error_message, processing_time_ms)
        )
        conn.commit()


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

async def send_notification_to_subscribers(
    organization_id: str,
    notification_type: str,
    title: str,
    body: str,
    url: Optional[str] = None,
) -> int:
    """
    Send notification to all subscribers of an organization.
    Returns number of messages sent.
    """
    telegram_ids = get_subscribers_for_organization(organization_id, notification_type)

    if not telegram_ids:
        return 0

    settings = get_settings()
    if not settings.telegram_bot_token:
        logger.warning('Telegram bot token not configured')
        return 0

    sent_count = 0
    message = f'<b>{_escape_html(title)}</b>\n\n{_escape_html(body)}'

    if url:
        message += f'\n\n<a href="{url}">Подробнее</a>'

    async with httpx.AsyncClient() as client:
        for telegram_id in telegram_ids:
            try:
                response = await client.post(
                    f'https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage',
                    json={
                        'chat_id': telegram_id,
                        'text': message,
                        'parse_mode': 'HTML',
                        'disable_web_page_preview': False,
                    },
                    timeout=10.0,
                )
                if response.status_code == 200:
                    sent_count += 1
                else:
                    logger.warning(f'Failed to send to {telegram_id}: {response.text}')
            except Exception as e:
                logger.error(f'Error sending to {telegram_id}: {e}')

    return sent_count


async def send_direct_message(telegram_id: int, text: str, parse_mode: str = 'HTML') -> bool:
    """Send a direct message to a Telegram user."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        return False

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f'https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage',
                json={
                    'chat_id': telegram_id,
                    'text': text,
                    'parse_mode': parse_mode,
                },
                timeout=10.0,
            )
            return response.status_code == 200
    except Exception as e:
        logger.error(f'Error sending message to {telegram_id}: {e}')
        return False


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

def get_bot_stats() -> BotStats:
    """Get bot usage statistics."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Total users
        cur.execute('SELECT COUNT(*) as cnt FROM telegram_users')
        total_users = cur.fetchone()['cnt']

        # Active users 24h
        cur.execute(
            "SELECT COUNT(*) as cnt FROM telegram_users WHERE last_activity_at > NOW() - INTERVAL '24 hours'"
        )
        active_24h = cur.fetchone()['cnt']

        # Active users 7d
        cur.execute(
            "SELECT COUNT(*) as cnt FROM telegram_users WHERE last_activity_at > NOW() - INTERVAL '7 days'"
        )
        active_7d = cur.fetchone()['cnt']

        # Total subscriptions
        cur.execute('SELECT COUNT(*) as cnt FROM telegram_subscriptions')
        total_subs = cur.fetchone()['cnt']

        # Commands 24h
        cur.execute(
            "SELECT COUNT(*) as cnt FROM telegram_bot_commands WHERE created_at > NOW() - INTERVAL '24 hours'"
        )
        commands_24h = cur.fetchone()['cnt']

        # Linked accounts
        cur.execute('SELECT COUNT(*) as cnt FROM telegram_users WHERE user_id IS NOT NULL')
        linked = cur.fetchone()['cnt']

        # Blocked users
        cur.execute('SELECT COUNT(*) as cnt FROM telegram_users WHERE is_blocked = TRUE')
        blocked = cur.fetchone()['cnt']

        return BotStats(
            total_users=total_users,
            active_users_24h=active_24h,
            active_users_7d=active_7d,
            total_subscriptions=total_subs,
            total_commands_24h=commands_24h,
            linked_accounts=linked,
            blocked_users=blocked,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_telegram_user(row: dict) -> TelegramUser:
    """Convert database row to TelegramUser model."""
    return TelegramUser(
        id=str(row['id']),
        telegram_id=row['telegram_id'],
        telegram_username=row['telegram_username'],
        telegram_first_name=row['telegram_first_name'],
        telegram_last_name=row['telegram_last_name'],
        user_id=str(row['user_id']) if row['user_id'] else None,
        language_code=row['language_code'] or 'ru',
        is_blocked=row['is_blocked'] or False,
        blocked_reason=row['blocked_reason'],
        last_activity_at=row['last_activity_at'],
        created_at=row['created_at'],
    )


def _escape_html(text: str) -> str:
    """Escape HTML special characters for Telegram."""
    return (
        text
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
    )


# ---------------------------------------------------------------------------
# Product Scanning & Verification
# ---------------------------------------------------------------------------

def handle_product_scan(telegram_id: int, qr_code: str) -> dict:
    """
    Handle a product scan from Telegram.
    Returns product info for the bot to respond with.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Find QR code
        cur.execute(
            '''
            SELECT qc.*, p.name as product_name, p.slug as product_slug,
                   o.name as org_name, o.slug as org_slug, o.verification_status,
                   ots.total_score as trust_score
            FROM qr_codes qc
            LEFT JOIN products p ON p.id = qc.product_id
            LEFT JOIN organizations o ON o.id = qc.organization_id
            LEFT JOIN organization_trust_scores ots ON ots.organization_id = o.id
            WHERE qc.code = %s OR qc.short_code = %s
            ''',
            (qr_code, qr_code)
        )
        qr = cur.fetchone()

        if not qr:
            return {
                'found': False,
                'message': 'Код не найден в системе'
            }

        # Log scan
        cur.execute(
            '''
            INSERT INTO telegram_scan_logs (telegram_id, qr_code_id, scanned_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT DO NOTHING
            ''',
            (telegram_id, qr['id'])
        )

        # Increment QR scan count
        cur.execute(
            'UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = %s',
            (qr['id'],)
        )

        conn.commit()

        settings = get_settings()
        base_url = settings.frontend_url if hasattr(settings, 'frontend_url') else 'https://chestno.ru'
        product_url = f"{base_url}/products/{qr['product_slug']}" if qr['product_slug'] else f"{base_url}/org/{qr['org_slug']}"

        return {
            'found': True,
            'product_name': qr['product_name'] or 'Неизвестный продукт',
            'organization_name': qr['org_name'] or 'Неизвестная организация',
            'verification_status': qr['verification_status'],
            'trust_score': float(qr['trust_score']) if qr['trust_score'] else None,
            'product_url': product_url,
            'qr_id': str(qr['id'])
        }


async def send_product_verification_result(
    telegram_id: int,
    product_name: str,
    organization_name: str,
    trust_score: Optional[float],
    verification_status: str,
    product_url: str
) -> bool:
    """Send product verification result to Telegram user."""
    # Build status emoji
    if verification_status in ('level_c', 'level_b'):
        status_emoji = '✅'
        status_text = 'Верифицирован'
    elif verification_status == 'level_a':
        status_emoji = '☑️'
        status_text = 'Базовая верификация'
    elif verification_status == 'pending':
        status_emoji = '⏳'
        status_text = 'На проверке'
    else:
        status_emoji = '❓'
        status_text = 'Не верифицирован'

    # Trust score badge
    if trust_score is not None:
        if trust_score >= 90:
            score_badge = '🏆'
        elif trust_score >= 80:
            score_badge = '⭐'
        elif trust_score >= 70:
            score_badge = '👍'
        else:
            score_badge = '⚠️'
        score_text = f"{score_badge} Рейтинг доверия: <b>{trust_score:.0f}/100</b>"
    else:
        score_text = "Рейтинг не рассчитан"

    message = f"""
🔍 <b>Результат проверки</b>

📦 <b>{_escape_html(product_name)}</b>
🏭 {_escape_html(organization_name)}

{status_emoji} Статус: <b>{status_text}</b>
{score_text}

<a href="{product_url}">Подробнее на Честно.ру</a>
"""

    return await send_direct_message(telegram_id, message.strip())


def add_product_to_portfolio_from_telegram(telegram_id: int, product_id: str) -> Optional[dict]:
    """Add a product to user's portfolio from Telegram scan."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get linked user
        cur.execute(
            'SELECT user_id FROM telegram_users WHERE telegram_id = %s',
            (telegram_id,)
        )
        row = cur.fetchone()
        if not row or not row['user_id']:
            return None

        user_id = str(row['user_id'])

        # Get product info
        cur.execute(
            '''
            SELECT p.id, p.name, p.image_url, o.id as org_id, o.name as org_name
            FROM products p
            JOIN organizations o ON o.id = p.organization_id
            WHERE p.id = %s
            ''',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            return None

        # Upsert portfolio item
        cur.execute(
            '''
            INSERT INTO consumer_product_portfolio (
                user_id, product_id, organization_id,
                product_name, product_image_url, organization_name,
                first_scanned_at, last_scanned_at, scan_count
            )
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW(), 1)
            ON CONFLICT (user_id, product_id) DO UPDATE SET
                last_scanned_at = NOW(),
                scan_count = consumer_product_portfolio.scan_count + 1,
                updated_at = NOW()
            RETURNING *
            ''',
            (user_id, product_id, product['org_id'],
             product['name'], product['image_url'], product['org_name'])
        )
        item = dict(cur.fetchone())
        conn.commit()

        logger.info(f"[telegram] Added product {product_id} to user {user_id} portfolio via Telegram")
        return item


def get_scan_history(telegram_id: int, limit: int = 10) -> list[dict]:
    """Get user's recent product scans from Telegram."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT tsl.scanned_at, qc.code, p.name as product_name, o.name as org_name
            FROM telegram_scan_logs tsl
            JOIN qr_codes qc ON qc.id = tsl.qr_code_id
            LEFT JOIN products p ON p.id = qc.product_id
            LEFT JOIN organizations o ON o.id = qc.organization_id
            WHERE tsl.telegram_id = %s
            ORDER BY tsl.scanned_at DESC
            LIMIT %s
            ''',
            (telegram_id, limit)
        )
        return [dict(row) for row in cur.fetchall()]
