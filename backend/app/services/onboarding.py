from __future__ import annotations

from math import floor

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.onboarding import OnboardingSummary, OnboardingStep

STEPS = {
    'profile_basic': ('Заполните основной профиль', 'Укажите название, описание и категорию', '/dashboard/organization/profile'),
    'contacts': ('Добавьте контакты', 'Email, телефон, сайт и соцсети', '/dashboard/organization/profile'),
    'story_and_photos': ('Расскажите историю и загрузите фото', 'Добавьте описание производства и фотогалерею', '/dashboard/organization/profile'),
    'video_presentation': ('Загрузите видеопрезентацию', 'Видео о вашем производстве (до 40 минут)', '/dashboard/organization/profile'),
    'products': ('Добавьте хотя бы один товар', 'Создайте карточку товара', '/dashboard/organization/products'),
    'qr_codes': ('Создайте активный QR-код', 'QR-код для отслеживания', '/dashboard/organization/qr'),
    'verification': ('Пройдите верификацию', 'Ожидайте проверки модератором', '/dashboard/organization/profile'),
    'invites': ('Пригласите коллег', 'Добавьте членов команды', '/dashboard/organization/invites'),
    'first_post': ('Опубликуйте первую новость', 'Расскажите о себе в новостях', '/dashboard/organization/posts'),
}


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
            SELECT short_description, long_description, production_description,
                   contact_email, contact_phone, contact_website,
                   gallery, video_url
            FROM organization_profiles
            WHERE organization_id = %s
            ''',
            (organization_id,),
        )
        profile = cur.fetchone()
        profile_basic_complete = bool(profile and profile.get('short_description'))
        contacts_complete = bool(
            profile and (
                profile.get('contact_email') or
                profile.get('contact_phone') or
                profile.get('contact_website')
            )
        )
        story_and_photos_complete = bool(
            profile and (
                (profile.get('long_description') or profile.get('production_description')) and
                profile.get('gallery') and
                len(profile.get('gallery', [])) > 0
            )
        )
        video_complete = bool(profile and profile.get('video_url'))

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

        cur.execute(
            'SELECT COUNT(*) FROM organization_posts WHERE organization_id = %s AND status = %s',
            (organization_id, 'published'),
        )
        posts_count = cur.fetchone()['count']

    steps = [
        OnboardingStep(
            key='profile_basic',
            label=STEPS['profile_basic'][0],
            completed=profile_basic_complete,
            description=STEPS['profile_basic'][1],
            link=STEPS['profile_basic'][2],
        ),
        OnboardingStep(
            key='contacts',
            label=STEPS['contacts'][0],
            completed=contacts_complete,
            description=STEPS['contacts'][1],
            link=STEPS['contacts'][2],
        ),
        OnboardingStep(
            key='story_and_photos',
            label=STEPS['story_and_photos'][0],
            completed=story_and_photos_complete,
            description=STEPS['story_and_photos'][1],
            link=STEPS['story_and_photos'][2],
        ),
        OnboardingStep(
            key='video_presentation',
            label=STEPS['video_presentation'][0],
            completed=video_complete,
            description=STEPS['video_presentation'][1],
            link=STEPS['video_presentation'][2],
        ),
        OnboardingStep(
            key='products',
            label=STEPS['products'][0],
            completed=products_count > 0,
            description=STEPS['products'][1],
            link=STEPS['products'][2],
        ),
        OnboardingStep(
            key='qr_codes',
            label=STEPS['qr_codes'][0],
            completed=qr_count > 0,
            description=STEPS['qr_codes'][1],
            link=STEPS['qr_codes'][2],
        ),
        OnboardingStep(
            key='verification',
            label=STEPS['verification'][0],
            completed=bool(verification_complete),
            description=STEPS['verification'][1],
            link=STEPS['verification'][2],
        ),
        OnboardingStep(
            key='invites',
            label=STEPS['invites'][0],
            completed=invites_count > 0,
            description=STEPS['invites'][1],
            link=STEPS['invites'][2],
        ),
        OnboardingStep(
            key='first_post',
            label=STEPS['first_post'][0],
            completed=posts_count > 0,
            description=STEPS['first_post'][1],
            link=STEPS['first_post'][2],
        ),
    ]
    completed = sum(1 for step in steps if step.completed)
    percent = int(round(100 * completed / len(steps)))
    return OnboardingSummary(organization_id=organization_id, completion_percent=percent, steps=steps)

