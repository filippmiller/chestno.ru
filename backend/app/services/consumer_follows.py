"""
Service layer for consumer follow/subscription functionality.
Uses consumer_subscriptions table from migration 0037.
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.db import get_connection
from app.schemas.consumer_follows import (
    ConsumerFollow,
    ConsumerFollowCreate,
    ConsumerFollowUpdate,
    ConsumerFollowWithTarget,
    ConsumerFollowsList,
    FollowedOrganization,
    FollowedProduct,
    NotificationPreferences,
)


DEFAULT_PREFERENCES = {
    "email": True,
    "push": True,
    "in_app": True,
    "frequency": "immediate",
    "types": ["new_product", "price_change", "status_update", "review"]
}


def create_follow(user_id: str, payload: ConsumerFollowCreate) -> ConsumerFollow:
    """Create a new follow relationship."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Validate target exists
        if payload.target_type == 'organization':
            cur.execute('SELECT id FROM organizations WHERE id = %s', (payload.target_id,))
        else:
            cur.execute('SELECT id FROM products WHERE id = %s AND status = %s', (payload.target_id, 'published'))

        if not cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'{payload.target_type.capitalize()} not found'
            )

        # Check for existing active subscription
        cur.execute(
            '''
            SELECT id, is_active FROM consumer_subscriptions
            WHERE user_id = %s AND target_type = %s AND target_id = %s::uuid
            ''',
            (user_id, payload.target_type.value, payload.target_id)
        )
        existing = cur.fetchone()

        if existing:
            if existing['is_active']:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail='Already following this entity'
                )
            # Reactivate existing subscription
            cur.execute(
                '''
                UPDATE consumer_subscriptions
                SET is_active = true, updated_at = now()
                WHERE id = %s
                RETURNING *
                ''',
                (existing['id'],)
            )
            row = cur.fetchone()
            conn.commit()
            return _row_to_follow(row)

        # Build notification preferences from payload
        prefs = DEFAULT_PREFERENCES.copy()
        if payload.preferences:
            prefs['email'] = payload.preferences.email_enabled
            prefs['push'] = payload.preferences.push_enabled
            prefs['types'] = []
            if payload.preferences.notify_on_new_products:
                prefs['types'].append('new_product')
            if payload.preferences.notify_on_journey_updates:
                prefs['types'].append('status_update')
            if payload.preferences.notify_on_price_changes:
                prefs['types'].append('price_change')
            if payload.preferences.notify_on_posts:
                prefs['types'].append('review')

        cur.execute(
            '''
            INSERT INTO consumer_subscriptions (
                id, user_id, target_type, target_id, notification_preferences, source
            )
            VALUES (gen_random_uuid(), %s, %s, %s::uuid, %s, 'api')
            RETURNING *
            ''',
            (user_id, payload.target_type.value, payload.target_id, Jsonb(prefs))
        )
        row = cur.fetchone()
        conn.commit()

        return _row_to_follow(row)


def delete_follow(user_id: str, follow_id: str) -> None:
    """Delete/unfollow an entity by setting is_active to false."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE consumer_subscriptions
            SET is_active = false, updated_at = now()
            WHERE id = %s AND user_id = %s
            ''',
            (follow_id, user_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Subscription not found'
            )
        conn.commit()


def update_follow_preferences(
    user_id: str,
    follow_id: str,
    payload: ConsumerFollowUpdate
) -> ConsumerFollow:
    """Update notification preferences for a follow."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Build notification preferences from payload
        prefs = {
            'email': payload.preferences.email_enabled,
            'push': payload.preferences.push_enabled,
            'in_app': True,
            'frequency': 'immediate',
            'types': []
        }
        if payload.preferences.notify_on_new_products:
            prefs['types'].append('new_product')
        if payload.preferences.notify_on_journey_updates:
            prefs['types'].append('status_update')
        if payload.preferences.notify_on_price_changes:
            prefs['types'].append('price_change')
        if payload.preferences.notify_on_posts:
            prefs['types'].append('review')

        cur.execute(
            '''
            UPDATE consumer_subscriptions
            SET notification_preferences = %s, updated_at = now()
            WHERE id = %s AND user_id = %s AND is_active = true
            RETURNING *
            ''',
            (Jsonb(prefs), follow_id, user_id)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Subscription not found'
            )
        conn.commit()
        return _row_to_follow(row)


def list_user_follows(
    user_id: str,
    target_type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> ConsumerFollowsList:
    """List all active follows for a user with resolved targets."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Build query with optional filter
        where_clause = 'user_id = %s AND is_active = true'
        params = [user_id]

        if target_type:
            where_clause += ' AND target_type = %s'
            params.append(target_type)

        # Get total count
        cur.execute(f'SELECT COUNT(*) as cnt FROM consumer_subscriptions WHERE {where_clause}', params)
        total = cur.fetchone()['cnt']

        # Get paginated follows
        params.extend([limit + 1, offset])  # +1 to check has_more
        cur.execute(
            f'''
            SELECT * FROM consumer_subscriptions
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            ''',
            params
        )
        rows = cur.fetchall()

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        # Resolve targets
        items = []
        for row in rows:
            follow = _row_to_follow_with_target(row)

            if row['target_type'] == 'organization':
                cur.execute(
                    'SELECT id, name, slug, logo_url FROM organizations WHERE id = %s',
                    (row['target_id'],)
                )
                org = cur.fetchone()
                if org:
                    follow.organization = FollowedOrganization(**org)
            else:
                cur.execute(
                    '''
                    SELECT p.id, p.name, p.slug, p.main_image_url, o.name as organization_name
                    FROM products p
                    LEFT JOIN organizations o ON o.id = p.organization_id
                    WHERE p.id = %s
                    ''',
                    (row['target_id'],)
                )
                prod = cur.fetchone()
                if prod:
                    follow.product = FollowedProduct(**prod)

            items.append(follow)

        return ConsumerFollowsList(items=items, total=total, has_more=has_more)


def get_followers_count(target_type: str, target_id: str) -> int:
    """Get follower count for an entity."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT COUNT(*) as cnt FROM consumer_subscriptions
            WHERE target_type = %s AND target_id = %s::uuid AND is_active = true
            ''',
            (target_type, target_id)
        )
        return cur.fetchone()['cnt']


def is_following(user_id: str, target_type: str, target_id: str) -> bool:
    """Check if a user is following an entity."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT 1 FROM consumer_subscriptions
            WHERE user_id = %s AND target_type = %s AND target_id = %s::uuid AND is_active = true
            ''',
            (user_id, target_type, target_id)
        )
        return cur.fetchone() is not None


def _prefs_from_db(db_prefs: dict) -> NotificationPreferences:
    """Convert database notification_preferences to NotificationPreferences model."""
    types = db_prefs.get('types', [])
    return NotificationPreferences(
        email_enabled=db_prefs.get('email', True),
        push_enabled=db_prefs.get('push', False),
        telegram_enabled=False,
        notify_on_new_products='new_product' in types,
        notify_on_journey_updates='status_update' in types,
        notify_on_price_changes='price_change' in types,
        notify_on_posts='review' in types,
    )


def _row_to_follow(row: dict) -> ConsumerFollow:
    """Convert database row to ConsumerFollow model."""
    prefs = row.get('notification_preferences') or {}
    return ConsumerFollow(
        id=str(row['id']),
        user_id=str(row['user_id']),
        target_type=row['target_type'],
        target_id=str(row['target_id']),
        preferences=_prefs_from_db(prefs),
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


def _row_to_follow_with_target(row: dict) -> ConsumerFollowWithTarget:
    """Convert database row to ConsumerFollowWithTarget model."""
    prefs = row.get('notification_preferences') or {}
    return ConsumerFollowWithTarget(
        id=str(row['id']),
        user_id=str(row['user_id']),
        target_type=row['target_type'],
        target_id=str(row['target_id']),
        preferences=_prefs_from_db(prefs),
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )
