from __future__ import annotations

from math import floor

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.onboarding import OnboardingSummary, OnboardingStep

STEPS = [
    ('profile', 'Заполните профиль производства'),
    ('products', 'Добавьте хотя бы один товар'),
    ('qr_codes', 'Создайте активный QR-код'),
    ('verification', 'Пройдите верификацию'),
    ('invites', 'Пригласите коллег'),
]


def _ensure_member(cur, organization_id: str, user_id: str) -> None:
    cur.execute(
        'SELECT 1 FROM organization_members WHERE organization_id = %s AND user_id = %s',
        (organization_id, user_id),
    )
    if cur.fetchone() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Нет доступа к организации')


def get_onboarding_summary(organization_id: str, user_id: str) -> OnboardingSummary:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        _ensure_member(cur, organization_id, user_id)

        cur.execute(
            '''
            SELECT short_description, long_description
            FROM organization_profiles
            WHERE organization_id = %s
            ''',
            (organization_id,),
        )
        profile = cur.fetchone()
        profile_complete = bool(profile and (profile['short_description'] or profile['long_description']))

        cur.execute('SELECT COUNT(*) FROM products WHERE organization_id = %s AND status != %s', (organization_id, 'archived'))
        products_count = cur.fetchone()['count']

        cur.execute('SELECT COUNT(*) FROM qr_codes WHERE organization_id = %s AND is_active = true', (organization_id,))
        qr_count = cur.fetchone()['count']

        cur.execute(
            'SELECT verification_status FROM organizations WHERE id = %s',
            (organization_id,),
        )
        org = cur.fetchone()
        verification_complete = org and org.get('verification_status') == 'verified'

        cur.execute('SELECT COUNT(*) FROM organization_invites WHERE organization_id = %s', (organization_id,))
        invites_count = cur.fetchone()['count']

    steps = [
        OnboardingStep(key='profile', label=STEPS[0][1], completed=profile_complete),
        OnboardingStep(key='products', label=STEPS[1][1], completed=products_count > 0),
        OnboardingStep(key='qr_codes', label=STEPS[2][1], completed=qr_count > 0),
        OnboardingStep(key='verification', label=STEPS[3][1], completed=bool(verification_complete)),
        OnboardingStep(key='invites', label=STEPS[4][1], completed=invites_count > 0),
    ]
    completed = sum(1 for step in steps if step.completed)
    percent = int(round(100 * completed / len(steps)))
    return OnboardingSummary(organization_id=organization_id, completion_percent=percent, steps=steps)

