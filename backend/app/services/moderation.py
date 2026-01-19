from __future__ import annotations

import logging

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.moderation import ModerationAction, ModerationOrganization

logger = logging.getLogger(__name__)

MODERATOR_ROLES = ('platform_admin', 'moderator')


def _ensure_moderator(cur, user_id: str) -> None:
    """
    Check if user has moderator access.
    Checks both app_profiles.role (Auth V2) and platform_roles table (legacy).
    """
    try:
        # Check app_profiles.role (Auth V2) - admins have moderator access
        cur.execute(
            '''
            SELECT 1 FROM app_profiles
            WHERE id = %s AND role = 'admin'
            ''',
            (user_id,),
        )
        if cur.fetchone():
            return  # User is admin in app_profiles

        # Check platform_roles table (legacy)
        cur.execute(
            '''
            SELECT role FROM platform_roles
            WHERE user_id = %s AND role = ANY(%s)
            ''',
            (user_id, list(MODERATOR_ROLES)),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Доступ разрешён только модераторам платформы')
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'[moderation] Error checking moderator status for user {user_id}: {e}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Error checking moderator permissions: {str(e)}'
        )


def list_organizations(user_id: str, status_filter: str | None = 'pending', limit: int = 20, offset: int = 0) -> list[ModerationOrganization]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_moderator(cur, user_id)
            if status_filter:
                cur.execute(
                    '''
                    SELECT id, name, slug, country, city, website_url, verification_status, verification_comment, is_verified, created_at
                    FROM organizations
                    WHERE verification_status = %s
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    ''',
                    (status_filter, limit, offset),
                )
            else:
                cur.execute(
                    '''
                    SELECT id, name, slug, country, city, website_url, verification_status, verification_comment, is_verified, created_at
                    FROM organizations
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    ''',
                    (limit, offset),
                )
            rows = cur.fetchall()
            # Convert UUID to string for Pydantic
            return [ModerationOrganization(**{**row, 'id': str(row['id'])}) for row in rows]


def verify_organization(org_id: str, user_id: str, action: ModerationAction) -> ModerationOrganization:
    new_status = 'verified' if action.action == 'verify' else 'rejected'
    is_verified = action.action == 'verify'

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_moderator(cur, user_id)
            cur.execute(
                '''
                UPDATE organizations
                SET verification_status = %s,
                    verification_comment = %s,
                    is_verified = %s,
                    updated_at = now()
                WHERE id = %s
                RETURNING id, name, slug, country, city, website_url, verification_status, verification_comment, is_verified, created_at
                ''',
                (new_status, action.comment, is_verified, org_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Организация не найдена')
            conn.commit()
            # Convert UUID to string for Pydantic
            return ModerationOrganization(**{**row, 'id': str(row['id'])})

