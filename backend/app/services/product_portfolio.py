"""
Product Portfolio Service

Manages consumer's personal product history and recall alerts.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.notifications import NotificationEmitRequest
from app.services.notifications import emit_notification

logger = logging.getLogger(__name__)


def add_to_portfolio(user_id: str, product_id: str) -> dict:
    """Add a product to user's portfolio (or update if exists)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get product info for snapshot
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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Product not found')

        # Upsert portfolio item
        cur.execute(
            '''
            INSERT INTO consumer_product_portfolio (
                user_id, product_id, organization_id,
                product_name, product_image_url, organization_name,
                first_scanned_at, last_scanned_at, scan_count
            )
            VALUES (%s, %s, %s, %s, %s, %s, now(), now(), 1)
            ON CONFLICT (user_id, product_id) DO UPDATE SET
                last_scanned_at = now(),
                scan_count = consumer_product_portfolio.scan_count + 1,
                updated_at = now()
            RETURNING *
            ''',
            (user_id, product_id, product['org_id'],
             product['name'], product['image_url'], product['org_name'])
        )
        item = dict(cur.fetchone())
        conn.commit()

        logger.info(f"[portfolio] Added product {product_id} to user {user_id} portfolio")
        return item


def get_portfolio(
    user_id: str,
    favorites_only: bool = False,
    limit: int = 50,
    offset: int = 0
) -> tuple[List[dict], int]:
    """Get user's product portfolio."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        base_query = '''
            FROM consumer_product_portfolio cpp
            LEFT JOIN products p ON p.id = cpp.product_id
            LEFT JOIN organizations o ON o.id = cpp.organization_id
            WHERE cpp.user_id = %s
        '''
        params = [user_id]

        if favorites_only:
            base_query += ' AND cpp.is_favorite = true'

        # Count
        cur.execute(f'SELECT COUNT(*) as total {base_query}', params)
        total = cur.fetchone()['total']

        # Fetch items
        cur.execute(
            f'''
            SELECT cpp.*,
                   p.slug as product_slug,
                   o.slug as organization_slug
            {base_query}
            ORDER BY cpp.last_scanned_at DESC
            LIMIT %s OFFSET %s
            ''',
            params + [limit, offset]
        )
        items = [dict(row) for row in cur.fetchall()]

        return items, total


def update_portfolio_item(
    user_id: str,
    item_id: str,
    is_favorite: Optional[bool] = None,
    user_notes: Optional[str] = None,
    purchase_date: Optional[str] = None,
    purchase_location: Optional[str] = None
) -> dict:
    """Update a portfolio item."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Build update
        updates = []
        params = []

        if is_favorite is not None:
            updates.append('is_favorite = %s')
            params.append(is_favorite)
        if user_notes is not None:
            updates.append('user_notes = %s')
            params.append(user_notes)
        if purchase_date is not None:
            updates.append('purchase_date = %s')
            params.append(purchase_date)
        if purchase_location is not None:
            updates.append('purchase_location = %s')
            params.append(purchase_location)

        if not updates:
            # Nothing to update, fetch current
            cur.execute(
                'SELECT * FROM consumer_product_portfolio WHERE id = %s AND user_id = %s',
                (item_id, user_id)
            )
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Item not found')
            return dict(item)

        updates.append('updated_at = now()')
        params.extend([item_id, user_id])

        cur.execute(
            f'''
            UPDATE consumer_product_portfolio
            SET {', '.join(updates)}
            WHERE id = %s AND user_id = %s
            RETURNING *
            ''',
            params
        )
        item = cur.fetchone()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Item not found')

        conn.commit()
        return dict(item)


def remove_from_portfolio(user_id: str, item_id: str) -> bool:
    """Remove a product from user's portfolio."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            'DELETE FROM consumer_product_portfolio WHERE id = %s AND user_id = %s',
            (item_id, user_id)
        )
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted


# ============================================================================
# Recall Management
# ============================================================================

def create_recall(
    title: str,
    description: str,
    severity: str = 'warning',
    product_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    recall_reason: Optional[str] = None,
    affected_product_names: Optional[List[str]] = None,
    affected_batch_numbers: Optional[List[str]] = None,
    source: str = 'admin',
    source_url: Optional[str] = None,
    created_by: Optional[str] = None
) -> dict:
    """Create a new product recall (admin function)."""
    if severity not in ('info', 'warning', 'critical'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid severity')

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            INSERT INTO product_recalls (
                product_id, organization_id, title, description, severity,
                recall_reason, affected_product_names, affected_batch_numbers,
                source, source_url, created_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (
                product_id, organization_id, title, description, severity,
                recall_reason, affected_product_names or [], affected_batch_numbers or [],
                source, source_url, created_by
            )
        )
        recall = dict(cur.fetchone())
        conn.commit()

        logger.info(f"[portfolio] Created recall {recall['id']}: {title}")
        return recall


def list_active_recalls(limit: int = 20) -> List[dict]:
    """List all active recalls."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT pr.*, p.name as product_name, o.name as organization_name
            FROM product_recalls pr
            LEFT JOIN products p ON p.id = pr.product_id
            LEFT JOIN organizations o ON o.id = pr.organization_id
            WHERE pr.is_active = true
            AND (pr.expires_at IS NULL OR pr.expires_at > now())
            ORDER BY pr.published_at DESC
            LIMIT %s
            ''',
            (limit,)
        )
        return [dict(row) for row in cur.fetchall()]


def check_recalls_for_user(user_id: str) -> List[dict]:
    """Check if any of user's portfolio products have active recalls."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT
                pr.id as recall_id,
                pr.title as recall_title,
                pr.description as recall_description,
                pr.severity,
                cpp.id as portfolio_item_id,
                cpp.product_name,
                cpp.organization_name
            FROM consumer_product_portfolio cpp
            JOIN product_recalls pr ON (
                pr.product_id = cpp.product_id
                OR cpp.product_name = ANY(pr.affected_product_names)
            )
            LEFT JOIN consumer_recall_alerts cra ON (
                cra.recall_id = pr.id AND cra.user_id = %s
            )
            WHERE cpp.user_id = %s
            AND pr.is_active = true
            AND cra.id IS NULL
            ''',
            (user_id, user_id)
        )
        return [dict(row) for row in cur.fetchall()]


def send_recall_alerts_for_user(user_id: str) -> int:
    """Send recall alerts for user's affected products."""
    recalls = check_recalls_for_user(user_id)

    if not recalls:
        return 0

    sent_count = 0
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        for recall in recalls:
            try:
                # Record the alert
                cur.execute(
                    '''
                    INSERT INTO consumer_recall_alerts (
                        user_id, recall_id, portfolio_item_id,
                        notification_sent, notification_sent_at
                    )
                    VALUES (%s, %s, %s, true, now())
                    ON CONFLICT (user_id, recall_id) DO NOTHING
                    RETURNING id
                    ''',
                    (user_id, recall['recall_id'], recall['portfolio_item_id'])
                )
                alert = cur.fetchone()

                if alert:
                    # Send notification
                    emit_notification(NotificationEmitRequest(
                        type_key='consumer.recall_alert',
                        recipient_user_id=user_id,
                        recipient_scope='user',
                        payload={
                            'recall_id': str(recall['recall_id']),
                            'product_name': recall['product_name'],
                            'recall_title': recall['recall_title'],
                            'severity': recall['severity']
                        }
                    ))
                    sent_count += 1
            except Exception as e:
                logger.warning(f"Failed to send recall alert: {e}")

        conn.commit()

    logger.info(f"[portfolio] Sent {sent_count} recall alerts to user {user_id}")
    return sent_count


def acknowledge_recall_alert(user_id: str, alert_id: str) -> dict:
    """Mark a recall alert as acknowledged by user."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE consumer_recall_alerts
            SET acknowledged = true, acknowledged_at = now()
            WHERE id = %s AND user_id = %s
            RETURNING *
            ''',
            (alert_id, user_id)
        )
        alert = cur.fetchone()
        if not alert:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Alert not found')

        conn.commit()
        return dict(alert)


def get_user_recall_alerts(user_id: str, unacknowledged_only: bool = True) -> List[dict]:
    """Get user's recall alerts."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        query = '''
            SELECT cra.*, pr.title as recall_title, pr.description as recall_description,
                   pr.severity, cpp.product_name
            FROM consumer_recall_alerts cra
            JOIN product_recalls pr ON pr.id = cra.recall_id
            LEFT JOIN consumer_product_portfolio cpp ON cpp.id = cra.portfolio_item_id
            WHERE cra.user_id = %s
        '''
        params = [user_id]

        if unacknowledged_only:
            query += ' AND cra.acknowledged = false'

        query += ' ORDER BY cra.created_at DESC'

        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]


# ============================================================================
# Portfolio Categories
# ============================================================================

def create_category(user_id: str, name: str, color: Optional[str] = None, icon: Optional[str] = None) -> dict:
    """Create a portfolio category."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            INSERT INTO portfolio_categories (user_id, name, color, icon)
            VALUES (%s, %s, %s, %s)
            RETURNING *
            ''',
            (user_id, name, color, icon)
        )
        category = dict(cur.fetchone())
        conn.commit()
        return category


def get_user_categories(user_id: str) -> List[dict]:
    """Get user's portfolio categories."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT pc.*,
                   COUNT(pic.portfolio_item_id) as item_count
            FROM portfolio_categories pc
            LEFT JOIN portfolio_item_categories pic ON pic.category_id = pc.id
            WHERE pc.user_id = %s
            GROUP BY pc.id
            ORDER BY pc.display_order ASC
            ''',
            (user_id,)
        )
        return [dict(row) for row in cur.fetchall()]


def add_item_to_category(user_id: str, item_id: str, category_id: str) -> bool:
    """Add a portfolio item to a category."""
    with get_connection() as conn, conn.cursor() as cur:
        # Verify ownership
        cur.execute(
            'SELECT id FROM consumer_product_portfolio WHERE id = %s AND user_id = %s',
            (item_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Portfolio item not found')

        cur.execute(
            'SELECT id FROM portfolio_categories WHERE id = %s AND user_id = %s',
            (category_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Category not found')

        cur.execute(
            '''
            INSERT INTO portfolio_item_categories (portfolio_item_id, category_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            ''',
            (item_id, category_id)
        )
        conn.commit()
        return True
