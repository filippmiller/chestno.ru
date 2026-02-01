"""
Telegram Bot Database Services

Handles all database operations for the Telegram bot.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.telegram_bot.models import (
    BotInteractionLog,
    CompanyInfo,
    ConversationState,
    InteractionType,
    PendingReview,
    ProducerFollow,
    RateLimitResult,
    TelegramUser,
    TelegramUserLink,
)


class TelegramBotService:
    """Database service for Telegram bot operations."""

    # ==========================================================================
    # USER LINK MANAGEMENT
    # ==========================================================================

    def get_or_create_user_link(self, tg_user: TelegramUser) -> TelegramUserLink:
        """Get existing link or create new one for Telegram user."""
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Try to get existing
            cur.execute(
                'SELECT * FROM telegram_user_links WHERE telegram_user_id = %s',
                (tg_user.id,)
            )
            row = cur.fetchone()

            if row:
                # Update user info if changed
                cur.execute(
                    '''
                    UPDATE telegram_user_links
                    SET telegram_username = %s,
                        telegram_first_name = %s,
                        telegram_last_name = %s,
                        telegram_language_code = %s,
                        updated_at = now()
                    WHERE telegram_user_id = %s
                    RETURNING *
                    ''',
                    (
                        tg_user.username,
                        tg_user.first_name,
                        tg_user.last_name,
                        tg_user.language_code,
                        tg_user.id,
                    )
                )
                row = cur.fetchone()
                conn.commit()
            else:
                # Create new
                cur.execute(
                    '''
                    INSERT INTO telegram_user_links (
                        telegram_user_id, telegram_username, telegram_first_name,
                        telegram_last_name, telegram_language_code
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING *
                    ''',
                    (
                        tg_user.id,
                        tg_user.username,
                        tg_user.first_name,
                        tg_user.last_name,
                        tg_user.language_code,
                    )
                )
                row = cur.fetchone()
                conn.commit()

            return TelegramUserLink(**row)

    def get_user_link(self, telegram_user_id: int) -> Optional[TelegramUserLink]:
        """Get user link by Telegram ID."""
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT * FROM telegram_user_links WHERE telegram_user_id = %s',
                (telegram_user_id,)
            )
            row = cur.fetchone()
            return TelegramUserLink(**row) if row else None

    def get_user_link_by_token(self, token: str) -> Optional[TelegramUserLink]:
        """Get user link by link token."""
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT * FROM telegram_user_links
                WHERE link_token = %s AND link_token_expires_at > now()
                ''',
                (token,)
            )
            row = cur.fetchone()
            return TelegramUserLink(**row) if row else None

    def create_link_token(self, telegram_user_id: int) -> str:
        """Create a new account linking token."""
        import secrets
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                UPDATE telegram_user_links
                SET link_token = %s,
                    link_token_expires_at = %s,
                    updated_at = now()
                WHERE telegram_user_id = %s
                ''',
                (token, expires_at, telegram_user_id)
            )
            conn.commit()

        return token

    def complete_account_link(self, token: str, user_id: str) -> bool:
        """Complete the account linking process."""
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                UPDATE telegram_user_links
                SET user_id = %s,
                    linked_at = now(),
                    link_token = NULL,
                    link_token_expires_at = NULL,
                    updated_at = now()
                WHERE link_token = %s
                  AND link_token_expires_at > now()
                RETURNING id
                ''',
                (user_id, token)
            )
            result = cur.fetchone()
            conn.commit()
            return result is not None

    def unlink_account(self, telegram_user_id: int) -> bool:
        """Unlink chestno.ru account from Telegram."""
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                UPDATE telegram_user_links
                SET user_id = NULL,
                    linked_at = NULL,
                    updated_at = now()
                WHERE telegram_user_id = %s AND user_id IS NOT NULL
                RETURNING id
                ''',
                (telegram_user_id,)
            )
            result = cur.fetchone()
            conn.commit()
            return result is not None

    # ==========================================================================
    # CONVERSATION STATE MANAGEMENT
    # ==========================================================================

    def set_state(
        self,
        telegram_user_id: int,
        state: ConversationState,
        state_data: Optional[dict] = None
    ) -> None:
        """Set conversation state for user."""
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                UPDATE telegram_user_links
                SET current_state = %s,
                    state_data = COALESCE(%s, '{}'),
                    updated_at = now()
                WHERE telegram_user_id = %s
                ''',
                (state.value, state_data, telegram_user_id)
            )
            conn.commit()

    def clear_state(self, telegram_user_id: int) -> None:
        """Clear conversation state."""
        self.set_state(telegram_user_id, ConversationState.IDLE, {})

    # ==========================================================================
    # RATE LIMITING
    # ==========================================================================

    def check_rate_limit(
        self,
        telegram_user_id: int,
        daily_limit: int = 100
    ) -> RateLimitResult:
        """Check if user is within rate limits."""
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT * FROM check_telegram_rate_limit(%s, %s)',
                (telegram_user_id, daily_limit)
            )
            row = cur.fetchone()
            conn.commit()

            return RateLimitResult(
                allowed=row['allowed'],
                remaining=row['remaining'],
                reset_at=row['reset_at']
            )

    # ==========================================================================
    # COMPANY LOOKUPS
    # ==========================================================================

    def lookup_company_by_inn(self, inn: str) -> Optional[CompanyInfo]:
        """Look up company by INN."""
        return self._lookup_company('inn', inn)

    def lookup_company_by_ogrn(self, ogrn: str) -> Optional[CompanyInfo]:
        """Look up company by OGRN."""
        return self._lookup_company('ogrn', ogrn)

    def _lookup_company(self, field: str, value: str) -> Optional[CompanyInfo]:
        """Internal company lookup."""
        from app.core.config import get_settings
        settings = get_settings()

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Look up in organizations table
            cur.execute(
                f'''
                SELECT o.*, op.short_description,
                       COUNT(DISTINCT r.id) as review_count,
                       AVG(r.rating) as avg_rating,
                       COUNT(DISTINCT p.id) as product_count
                FROM organizations o
                LEFT JOIN organization_profiles op ON op.organization_id = o.id
                LEFT JOIN reviews r ON r.organization_id = o.id AND r.status = 'approved'
                LEFT JOIN products p ON p.organization_id = o.id AND p.is_active = true
                WHERE o.{field} = %s
                GROUP BY o.id, op.short_description
                ''',
                (value,)
            )
            row = cur.fetchone()

            if not row:
                return None

            return CompanyInfo(
                id=str(row['id']),
                name=row['name'],
                legal_name=row.get('legal_name'),
                inn=row.get('inn'),
                ogrn=row.get('ogrn'),
                address=f"{row.get('city', '')}, {row.get('country', '')}".strip(', '),
                phone=row.get('phone'),
                website=row.get('website_url'),
                is_verified=row['is_verified'],
                verification_status=row['verification_status'],
                rating=float(row['avg_rating']) if row['avg_rating'] else None,
                review_count=row['review_count'] or 0,
                product_count=row['product_count'] or 0,
                profile_url=f"{settings.frontend_url}/producer/{row['slug']}",
                short_description=row.get('short_description'),
            )

    # ==========================================================================
    # PRODUCER FOLLOWS
    # ==========================================================================

    def follow_producer(
        self,
        telegram_user_id: int,
        organization_id: str
    ) -> bool:
        """Follow a producer."""
        with get_connection() as conn, conn.cursor() as cur:
            try:
                cur.execute(
                    '''
                    INSERT INTO telegram_producer_follows (telegram_user_id, organization_id)
                    VALUES (%s, %s)
                    ON CONFLICT (telegram_user_id, organization_id) DO NOTHING
                    RETURNING id
                    ''',
                    (telegram_user_id, organization_id)
                )
                result = cur.fetchone()
                conn.commit()
                return result is not None
            except Exception:
                conn.rollback()
                return False

    def unfollow_producer(
        self,
        telegram_user_id: int,
        organization_id: str
    ) -> bool:
        """Unfollow a producer."""
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                DELETE FROM telegram_producer_follows
                WHERE telegram_user_id = %s AND organization_id = %s
                RETURNING id
                ''',
                (telegram_user_id, organization_id)
            )
            result = cur.fetchone()
            conn.commit()
            return result is not None

    def get_follows(self, telegram_user_id: int) -> list[ProducerFollow]:
        """Get all producer follows for user."""
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT f.*, o.name as organization_name
                FROM telegram_producer_follows f
                JOIN organizations o ON o.id = f.organization_id
                WHERE f.telegram_user_id = %s
                ORDER BY f.created_at DESC
                ''',
                (telegram_user_id,)
            )
            rows = cur.fetchall()
            return [ProducerFollow(**row) for row in rows]

    def is_following(self, telegram_user_id: int, organization_id: str) -> bool:
        """Check if user is following a producer."""
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                SELECT 1 FROM telegram_producer_follows
                WHERE telegram_user_id = %s AND organization_id = %s
                ''',
                (telegram_user_id, organization_id)
            )
            return cur.fetchone() is not None

    # ==========================================================================
    # PENDING REVIEWS
    # ==========================================================================

    def create_pending_review(
        self,
        telegram_user_id: int,
        organization_id: str,
        rating: int,
        review_text: Optional[str] = None
    ) -> PendingReview:
        """Create a pending review that needs web completion."""
        import secrets
        from app.core.config import get_settings
        settings = get_settings()

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Get organization name
            cur.execute(
                'SELECT name FROM organizations WHERE id = %s',
                (organization_id,)
            )
            org_row = cur.fetchone()
            org_name = org_row['name'] if org_row else None

            cur.execute(
                '''
                INSERT INTO telegram_pending_reviews (
                    telegram_user_id, organization_id, rating,
                    review_text, completion_token, expires_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (
                    telegram_user_id,
                    organization_id,
                    rating,
                    review_text,
                    token,
                    expires_at,
                )
            )
            row = cur.fetchone()
            conn.commit()

            return PendingReview(
                id=str(row['id']),
                telegram_user_id=row['telegram_user_id'],
                organization_id=str(row['organization_id']) if row['organization_id'] else None,
                organization_name=org_name,
                rating=row['rating'],
                review_text=row['review_text'],
                completion_token=row['completion_token'],
                completion_url=f"{settings.frontend_url}/review/complete/{token}",
                expires_at=row['expires_at'],
            )

    # ==========================================================================
    # NOTIFICATION SETTINGS
    # ==========================================================================

    def update_notification_settings(
        self,
        telegram_user_id: int,
        notifications_enabled: Optional[bool] = None,
        notify_producer_updates: Optional[bool] = None,
        notify_review_replies: Optional[bool] = None,
        notify_new_reviews: Optional[bool] = None,
    ) -> TelegramUserLink:
        """Update notification settings."""
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            updates = []
            values = []

            if notifications_enabled is not None:
                updates.append('notifications_enabled = %s')
                values.append(notifications_enabled)
            if notify_producer_updates is not None:
                updates.append('notify_producer_updates = %s')
                values.append(notify_producer_updates)
            if notify_review_replies is not None:
                updates.append('notify_review_replies = %s')
                values.append(notify_review_replies)
            if notify_new_reviews is not None:
                updates.append('notify_new_reviews = %s')
                values.append(notify_new_reviews)

            if not updates:
                # No changes, just return current
                return self.get_user_link(telegram_user_id)

            updates.append('updated_at = now()')
            values.append(telegram_user_id)

            cur.execute(
                f'''
                UPDATE telegram_user_links
                SET {', '.join(updates)}
                WHERE telegram_user_id = %s
                RETURNING *
                ''',
                values
            )
            row = cur.fetchone()
            conn.commit()
            return TelegramUserLink(**row)

    # ==========================================================================
    # INTERACTION LOGGING
    # ==========================================================================

    def log_interaction(self, log: BotInteractionLog) -> None:
        """Log a bot interaction for analytics."""
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO telegram_bot_interactions (
                    telegram_user_id, interaction_type, input_text,
                    input_data, response_type, response_data,
                    processing_time_ms, was_rate_limited
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ''',
                (
                    log.telegram_user_id,
                    log.interaction_type.value,
                    log.input_text,
                    log.input_data,
                    log.response_type,
                    log.response_data,
                    log.processing_time_ms,
                    log.was_rate_limited,
                )
            )
            conn.commit()

    # ==========================================================================
    # NOTIFICATION DELIVERY
    # ==========================================================================

    def get_followers_for_notification(
        self,
        organization_id: str,
        notification_type: str
    ) -> list[int]:
        """Get Telegram user IDs to notify about organization update."""
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build condition based on notification type
            type_condition = ''
            if notification_type == 'new_product':
                type_condition = 'AND f.notify_new_products = true'
            elif notification_type == 'certification':
                type_condition = 'AND f.notify_certifications = true'
            elif notification_type == 'news':
                type_condition = 'AND f.notify_news = true'

            cur.execute(
                f'''
                SELECT f.telegram_user_id
                FROM telegram_producer_follows f
                JOIN telegram_user_links l ON l.telegram_user_id = f.telegram_user_id
                WHERE f.organization_id = %s
                  AND l.notifications_enabled = true
                  AND l.notify_producer_updates = true
                  {type_condition}
                ''',
                (organization_id,)
            )
            rows = cur.fetchall()
            return [row['telegram_user_id'] for row in rows]


# Singleton instance
_service: Optional[TelegramBotService] = None


def get_bot_service() -> TelegramBotService:
    """Get the bot service singleton."""
    global _service
    if _service is None:
        _service = TelegramBotService()
    return _service
