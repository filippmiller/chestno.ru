from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.auth import (
    OrganizationInvite,
    OrganizationInviteCreate,
    OrganizationInvitePreview,
    SessionResponse,
)
from app.services.accounts import get_session_data

MANAGER_ROLES = ('owner', 'admin', 'manager')
DEFAULT_EXPIRES_DAYS = 30


def _ensure_role(cur, organization_id: str, user_id: str, allowed_roles: Iterable[str]) -> str:
    cur.execute(
        '''
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        ''',
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row or row['role'] not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав для управления приглашениями')
    return row['role']


def _default_expiration(expires_at: Optional[datetime]) -> Optional[datetime]:
    if expires_at:
        return expires_at
    return datetime.now(timezone.utc) + timedelta(days=DEFAULT_EXPIRES_DAYS)


def create_invite(organization_id: str, user_id: str, payload: OrganizationInviteCreate) -> OrganizationInvite:
    expires_at = _default_expiration(payload.expires_at)
    code = secrets.token_urlsafe(16)
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)
            cur.execute(
                '''
                INSERT INTO organization_invites (
                    organization_id, email, role, code, expires_at, created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (organization_id, payload.email.lower(), payload.role, code, expires_at, user_id),
            )
            row = cur.fetchone()
            conn.commit()
            return OrganizationInvite(**row)


def list_invites(organization_id: str, user_id: str, status_filter: Optional[str] = None) -> list[OrganizationInvite]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)
            if status_filter:
                cur.execute(
                    '''
                    SELECT * FROM organization_invites
                    WHERE organization_id = %s AND status = %s
                    ORDER BY created_at DESC
                    ''',
                    (organization_id, status_filter),
                )
            else:
                cur.execute(
                    '''
                    SELECT * FROM organization_invites
                    WHERE organization_id = %s
                    ORDER BY created_at DESC
                    ''',
                    (organization_id,),
                )
            rows = cur.fetchall()
            return [OrganizationInvite(**row) for row in rows]


def _fetch_invite_by_code(cur, code: str):
    cur.execute(
        '''
        SELECT oi.*, o.name AS organization_name, o.slug AS organization_slug
        FROM organization_invites oi
        JOIN organizations o ON o.id = oi.organization_id
        WHERE oi.code = %s
        ''',
        (code,),
    )
    return cur.fetchone()


def get_invite_preview(code: str) -> OrganizationInvitePreview:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            row = _fetch_invite_by_code(cur, code)
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Приглашение не найдено')
            return OrganizationInvitePreview(
                organization_name=row['organization_name'],
                organization_slug=row['organization_slug'],
                role=row['role'],
                status=row['status'],
                requires_auth=True,
            )


def accept_invite(code: str, user_id: Optional[str]) -> tuple[str, SessionResponse | OrganizationInvitePreview]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            row = _fetch_invite_by_code(cur, code)
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Приглашение не найдено')

            if row['status'] != 'pending':
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Приглашение уже использовано или отозвано')

            if row['expires_at'] and row['expires_at'] < datetime.now(timezone.utc):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Срок действия приглашения истёк')

            if not user_id:
                preview = OrganizationInvitePreview(
                    organization_name=row['organization_name'],
                    organization_slug=row['organization_slug'],
                    role=row['role'],
                    status=row['status'],
                    requires_auth=True,
                )
                return 'preview', preview

            organization_id = row['organization_id']
            cur.execute(
                '''
                INSERT INTO organization_members (id, organization_id, user_id, role, invited_by)
                VALUES (gen_random_uuid(), %s, %s, %s, %s)
                ON CONFLICT (organization_id, user_id)
                DO UPDATE SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by
                RETURNING id, organization_id, user_id, role
                ''',
                (organization_id, user_id, row['role'], row['created_by']),
            )
            membership = cur.fetchone()
            if not membership:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Не удалось применить приглашение')

            cur.execute(
                '''
                UPDATE organization_invites
                SET status = 'accepted',
                    accepted_by = %s,
                    accepted_at = now()
                WHERE id = %s
                ''',
                (user_id, row['id']),
            )

            conn.commit()

    session = get_session_data(user_id)
    return 'session', session

