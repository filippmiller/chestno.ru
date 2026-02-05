"""
Trust Circles Service

Enables private groups where users share product discoveries and recommendations.
"""
from __future__ import annotations

import logging
import secrets
import string
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.notifications import NotificationEmitRequest
from app.services.notifications import emit_notification

logger = logging.getLogger(__name__)

MAX_CIRCLE_MEMBERS = 30
INVITE_CODE_LENGTH = 8


def _generate_invite_code() -> str:
    """Generate a random invite code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(INVITE_CODE_LENGTH))


def create_circle(
    user_id: str,
    name: str,
    description: Optional[str] = None,
    is_private: bool = True,
    icon: Optional[str] = None,
    color: Optional[str] = None
) -> dict:
    """Create a new trust circle."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Generate unique invite code
        invite_code = _generate_invite_code()

        # Create circle
        cur.execute(
            '''
            INSERT INTO trust_circles (name, description, is_private, icon, color, invite_code, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            ''',
            (name, description, is_private, icon, color, invite_code, user_id)
        )
        circle = dict(cur.fetchone())

        # Add creator as owner
        cur.execute(
            '''
            INSERT INTO trust_circle_members (circle_id, user_id, role, invited_by, joined_at)
            VALUES (%s, %s, 'owner', %s, now())
            ''',
            (circle['id'], user_id, user_id)
        )

        conn.commit()
        logger.info(f"[circles] Created circle {circle['id']} by user {user_id}")
        return circle


def get_circle(circle_id: str, user_id: str) -> dict:
    """Get circle details (must be a member)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT tc.*, tcm.role as member_role,
                   (SELECT COUNT(*) FROM trust_circle_members WHERE circle_id = tc.id) as member_count
            FROM trust_circles tc
            JOIN trust_circle_members tcm ON tcm.circle_id = tc.id AND tcm.user_id = %s
            WHERE tc.id = %s
            ''',
            (user_id, circle_id)
        )
        circle = cur.fetchone()
        if not circle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Circle not found or access denied')
        return dict(circle)


def list_user_circles(user_id: str) -> List[dict]:
    """List all circles a user belongs to."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT tc.*, tcm.role as member_role,
                   (SELECT COUNT(*) FROM trust_circle_members WHERE circle_id = tc.id) as member_count,
                   tc.product_count
            FROM trust_circles tc
            JOIN trust_circle_members tcm ON tcm.circle_id = tc.id
            WHERE tcm.user_id = %s
            ORDER BY tcm.joined_at DESC
            ''',
            (user_id,)
        )
        return [dict(row) for row in cur.fetchall()]


def get_circle_members(circle_id: str, user_id: str) -> List[dict]:
    """Get all members of a circle."""
    # Verify membership
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT id FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not a member of this circle')

        cur.execute(
            '''
            SELECT tcm.*, u.email, u.display_name
            FROM trust_circle_members tcm
            LEFT JOIN app_users u ON u.id = tcm.user_id
            WHERE tcm.circle_id = %s
            ORDER BY tcm.role DESC, tcm.joined_at ASC
            ''',
            (circle_id,)
        )
        return [dict(row) for row in cur.fetchall()]


def join_by_invite_code(user_id: str, invite_code: str) -> dict:
    """Join a circle using an invite code."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Find circle by invite code
        cur.execute(
            'SELECT id, name, member_count FROM trust_circles WHERE invite_code = %s',
            (invite_code.upper(),)
        )
        circle = cur.fetchone()
        if not circle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Invalid invite code')

        # Check member limit
        if circle['member_count'] >= MAX_CIRCLE_MEMBERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Circle is full')

        # Check if already a member
        cur.execute(
            'SELECT id FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle['id'], user_id)
        )
        if cur.fetchone():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Already a member')

        # Join
        cur.execute(
            '''
            INSERT INTO trust_circle_members (circle_id, user_id, role, joined_at)
            VALUES (%s, %s, 'member', now())
            RETURNING *
            ''',
            (circle['id'], user_id)
        )
        membership = dict(cur.fetchone())

        # Update member count
        cur.execute(
            'UPDATE trust_circles SET member_count = member_count + 1 WHERE id = %s',
            (circle['id'],)
        )

        # Log activity
        cur.execute(
            '''
            INSERT INTO circle_activity (circle_id, user_id, activity_type, metadata)
            VALUES (%s, %s, 'member_joined', '{}')
            ''',
            (circle['id'], user_id)
        )

        conn.commit()
        logger.info(f"[circles] User {user_id} joined circle {circle['id']}")
        return {'circle_id': str(circle['id']), 'circle_name': circle['name'], 'membership': membership}


def create_invite(circle_id: str, user_id: str, invitee_email: str) -> dict:
    """Create an invitation for someone to join the circle."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify user can invite (owner, admin, or moderator)
        cur.execute(
            'SELECT role FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle_id, user_id)
        )
        member = cur.fetchone()
        if not member or member['role'] not in ('owner', 'admin', 'moderator'):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Cannot invite members')

        # Check member limit
        cur.execute('SELECT member_count, name FROM trust_circles WHERE id = %s', (circle_id,))
        circle = cur.fetchone()
        if circle['member_count'] >= MAX_CIRCLE_MEMBERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Circle is full')

        # Create invite
        invite_token = secrets.token_urlsafe(32)
        cur.execute(
            '''
            INSERT INTO trust_circle_invites (circle_id, invited_by, invitee_email, invite_token, expires_at)
            VALUES (%s, %s, %s, %s, now() + INTERVAL '7 days')
            RETURNING *
            ''',
            (circle_id, user_id, invitee_email, invite_token)
        )
        invite = dict(cur.fetchone())

        # Send notification/email
        try:
            emit_notification(NotificationEmitRequest(
                type_key='consumer.circle_invite',
                recipient_email=invitee_email,
                recipient_scope='email',
                payload={
                    'circle_name': circle['name'],
                    'invite_token': invite_token
                }
            ))
        except Exception as e:
            logger.warning(f"Failed to send invite notification: {e}")

        conn.commit()
        return invite


def accept_invite(invite_token: str, user_id: str) -> dict:
    """Accept an invitation to join a circle."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT tci.*, tc.name as circle_name, tc.member_count
            FROM trust_circle_invites tci
            JOIN trust_circles tc ON tc.id = tci.circle_id
            WHERE tci.invite_token = %s
            AND tci.status = 'pending'
            AND tci.expires_at > now()
            ''',
            (invite_token,)
        )
        invite = cur.fetchone()
        if not invite:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Invalid or expired invite')

        if invite['member_count'] >= MAX_CIRCLE_MEMBERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Circle is full')

        # Check if already member
        cur.execute(
            'SELECT id FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (invite['circle_id'], user_id)
        )
        if cur.fetchone():
            # Already a member, just mark invite as accepted
            cur.execute(
                "UPDATE trust_circle_invites SET status = 'accepted' WHERE id = %s",
                (invite['id'],)
            )
            conn.commit()
            return {'message': 'Already a member', 'circle_id': str(invite['circle_id'])}

        # Join circle
        cur.execute(
            '''
            INSERT INTO trust_circle_members (circle_id, user_id, role, invited_by, joined_at)
            VALUES (%s, %s, 'member', %s, now())
            RETURNING *
            ''',
            (invite['circle_id'], user_id, invite['invited_by'])
        )
        membership = dict(cur.fetchone())

        # Update invite status
        cur.execute(
            "UPDATE trust_circle_invites SET status = 'accepted', accepted_by = %s WHERE id = %s",
            (user_id, invite['id'])
        )

        # Update member count
        cur.execute(
            'UPDATE trust_circles SET member_count = member_count + 1 WHERE id = %s',
            (invite['circle_id'],)
        )

        conn.commit()
        logger.info(f"[circles] User {user_id} accepted invite to circle {invite['circle_id']}")
        return {'circle_id': str(invite['circle_id']), 'circle_name': invite['circle_name']}


def leave_circle(circle_id: str, user_id: str) -> bool:
    """Leave a circle (owners cannot leave, must transfer ownership first)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT role FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle_id, user_id)
        )
        member = cur.fetchone()
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Not a member')

        if member['role'] == 'owner':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Owner cannot leave. Transfer ownership first or delete the circle.'
            )

        cur.execute(
            'DELETE FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle_id, user_id)
        )

        cur.execute(
            'UPDATE trust_circles SET member_count = member_count - 1 WHERE id = %s',
            (circle_id,)
        )

        conn.commit()
        return True


# ============================================================================
# Shared Products
# ============================================================================

def share_product(
    circle_id: str,
    user_id: str,
    product_id: str,
    recommendation: Optional[str] = None,
    rating: Optional[int] = None
) -> dict:
    """Share a product with the circle."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify membership
        cur.execute(
            'SELECT id FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not a member')

        # Get product info
        cur.execute(
            'SELECT id, name, image_url FROM products WHERE id = %s',
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Product not found')

        # Share product
        cur.execute(
            '''
            INSERT INTO circle_shared_products (
                circle_id, product_id, shared_by, recommendation, rating,
                product_name_snapshot, product_image_snapshot
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (circle_id, product_id) DO UPDATE SET
                recommendation = EXCLUDED.recommendation,
                rating = EXCLUDED.rating,
                updated_at = now()
            RETURNING *
            ''',
            (circle_id, product_id, user_id, recommendation, rating,
             product['name'], product['image_url'])
        )
        shared = dict(cur.fetchone())

        # Log activity
        cur.execute(
            '''
            INSERT INTO circle_activity (circle_id, user_id, activity_type, product_id, metadata)
            VALUES (%s, %s, 'product_shared', %s, %s)
            ''',
            (circle_id, user_id, product_id, {'product_name': product['name']})
        )

        conn.commit()
        logger.info(f"[circles] User {user_id} shared product {product_id} in circle {circle_id}")
        return shared


def get_circle_products(
    circle_id: str,
    user_id: str,
    limit: int = 20,
    offset: int = 0
) -> tuple[List[dict], int]:
    """Get products shared in a circle."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify membership
        cur.execute(
            'SELECT id FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not a member')

        # Count
        cur.execute(
            'SELECT COUNT(*) as total FROM circle_shared_products WHERE circle_id = %s',
            (circle_id,)
        )
        total = cur.fetchone()['total']

        # Fetch
        cur.execute(
            '''
            SELECT csp.*, u.display_name as shared_by_name,
                   (SELECT COUNT(*) FROM circle_product_likes WHERE shared_product_id = csp.id) as like_count,
                   (SELECT COUNT(*) FROM circle_product_comments WHERE shared_product_id = csp.id) as comment_count,
                   EXISTS(SELECT 1 FROM circle_product_likes WHERE shared_product_id = csp.id AND user_id = %s) as liked_by_me
            FROM circle_shared_products csp
            LEFT JOIN app_users u ON u.id = csp.shared_by
            WHERE csp.circle_id = %s
            ORDER BY csp.created_at DESC
            LIMIT %s OFFSET %s
            ''',
            (user_id, circle_id, limit, offset)
        )
        products = [dict(row) for row in cur.fetchall()]

        return products, total


def like_shared_product(shared_product_id: str, user_id: str) -> bool:
    """Like a shared product."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            '''
            INSERT INTO circle_product_likes (shared_product_id, user_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            ''',
            (shared_product_id, user_id)
        )
        conn.commit()
        return True


def unlike_shared_product(shared_product_id: str, user_id: str) -> bool:
    """Unlike a shared product."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            'DELETE FROM circle_product_likes WHERE shared_product_id = %s AND user_id = %s',
            (shared_product_id, user_id)
        )
        conn.commit()
        return True


def add_comment(shared_product_id: str, user_id: str, content: str) -> dict:
    """Add a comment to a shared product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            INSERT INTO circle_product_comments (shared_product_id, user_id, content)
            VALUES (%s, %s, %s)
            RETURNING *
            ''',
            (shared_product_id, user_id, content)
        )
        comment = dict(cur.fetchone())
        conn.commit()
        return comment


def get_product_comments(shared_product_id: str, user_id: str) -> List[dict]:
    """Get comments for a shared product."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify access through membership
        cur.execute(
            '''
            SELECT tcm.id FROM trust_circle_members tcm
            JOIN circle_shared_products csp ON csp.circle_id = tcm.circle_id
            WHERE csp.id = %s AND tcm.user_id = %s
            ''',
            (shared_product_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Access denied')

        cur.execute(
            '''
            SELECT cpc.*, u.display_name as author_name
            FROM circle_product_comments cpc
            LEFT JOIN app_users u ON u.id = cpc.user_id
            WHERE cpc.shared_product_id = %s
            ORDER BY cpc.created_at ASC
            ''',
            (shared_product_id,)
        )
        return [dict(row) for row in cur.fetchall()]


def get_circle_activity(circle_id: str, user_id: str, limit: int = 20) -> List[dict]:
    """Get recent activity in a circle."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Verify membership
        cur.execute(
            'SELECT id FROM trust_circle_members WHERE circle_id = %s AND user_id = %s',
            (circle_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not a member')

        cur.execute(
            '''
            SELECT ca.*, u.display_name as user_name
            FROM circle_activity ca
            LEFT JOIN app_users u ON u.id = ca.user_id
            WHERE ca.circle_id = %s
            ORDER BY ca.created_at DESC
            LIMIT %s
            ''',
            (circle_id, limit)
        )
        return [dict(row) for row in cur.fetchall()]
