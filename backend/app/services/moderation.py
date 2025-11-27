from __future__ import annotations

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.moderation import ModerationAction, ModerationOrganization

MODERATOR_ROLES = ('platform_admin', 'moderator')


def _ensure_moderator(cur, user_id: str) -> None:
    cur.execute(
        '''
        SELECT role FROM platform_roles
        WHERE user_id = %s AND role = ANY(%s)
        ''',
        (user_id, list(MODERATOR_ROLES)),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Доступ разрешён только модераторам платформы')


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
            return [ModerationOrganization(**row) for row in rows]


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
            return ModerationOrganization(**row)

