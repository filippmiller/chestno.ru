from uuid import uuid4

from fastapi import HTTPException, status
from psycopg.rows import dict_row
from slugify import slugify

from app.core.db import get_connection
from app.schemas.auth import AfterSignupRequest, SessionResponse


def _generate_unique_slug(cur, company_name: str) -> str:
    base_slug = slugify(company_name, lowercase=True) or f'organization-{uuid4().hex[:6]}'
    slug = base_slug
    suffix = 1
    while True:
        cur.execute('SELECT 1 FROM organizations WHERE slug = %s', (slug,))
        if cur.fetchone() is None:
            return slug
        slug = f'{base_slug}-{suffix}'
        suffix += 1


def _fetch_session(cur, user_id: str) -> SessionResponse:
    cur.execute(
        '''
        SELECT id, email, full_name, locale
        FROM app_users
        WHERE id = %s
        ''',
        (user_id,),
    )
    user_row = cur.fetchone()
    if user_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User profile not found. Please complete registration.',
        )

    cur.execute(
        '''
        SELECT o.id, o.name, o.slug, o.city, o.country, o.website_url, o.verification_status, o.phone
        FROM organizations o
        INNER JOIN organization_members om ON om.organization_id = o.id
        WHERE om.user_id = %s
        ''',
        (user_id,),
    )
    organizations = cur.fetchall()

    cur.execute('SELECT * FROM organization_members WHERE user_id = %s', (user_id,))
    memberships = cur.fetchall()

    cur.execute('SELECT role FROM platform_roles WHERE user_id = %s', (user_id,))
    platform_roles_rows = cur.fetchall()
    platform_roles = [row['role'] for row in platform_roles_rows]

    return SessionResponse(
        user=user_row,
        organizations=organizations,
        memberships=memberships,
        platform_roles=platform_roles,
    )


def handle_after_signup(payload: AfterSignupRequest) -> SessionResponse:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            try:
                cur.execute(
                    '''
                    INSERT INTO app_users (id, email, full_name)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        email = EXCLUDED.email,
                        full_name = COALESCE(EXCLUDED.full_name, app_users.full_name)
                    RETURNING id, email, full_name, locale
                    ''',
                    (payload.auth_user_id, payload.email, payload.contact_name),
                )
                user_row = cur.fetchone()
                if not user_row:
                    raise ValueError('Failed to create user profile')

                if payload.account_type == 'producer':
                    if not all([payload.company_name, payload.country, payload.city]):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail='Missing required organization details for producer account',
                        )
                    slug = _generate_unique_slug(cur, payload.company_name or f'org-{uuid4().hex[:6]}')
                    cur.execute(
                        '''
                        INSERT INTO organizations (
                            id, name, slug, country, city, website_url, phone
                        )
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
                        RETURNING id, name, slug, city, country, website_url, verification_status, phone
                        ''',
                        (
                            payload.company_name,
                            slug,
                            payload.country,
                            payload.city,
                            payload.website_url,
                            payload.phone,
                        ),
                    )
                    organization = cur.fetchone()
                    if not organization:
                        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to create organization')

                    cur.execute(
                        '''
                        INSERT INTO organization_members (
                            id, organization_id, user_id, role
                        )
                        VALUES (gen_random_uuid(), %s, %s, 'owner')
                        RETURNING id, organization_id, user_id, role
                        ''',
                        (organization['id'], payload.auth_user_id),
                    )
                    membership = cur.fetchone()
                    if not membership:
                        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to create membership')

                session = _fetch_session(cur, payload.auth_user_id)
                conn.commit()
                return session
            except HTTPException:
                conn.rollback()
                raise
            except Exception:
                conn.rollback()
                raise


def get_session_data(user_id: str) -> SessionResponse:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверяем, существует ли пользователь в app_users
            cur.execute(
                '''
                SELECT id FROM app_users WHERE id = %s
                ''',
                (user_id,),
            )
            if not cur.fetchone():
                # Пользователь не найден, пытаемся получить email из Supabase
                from app.core.supabase import supabase_admin
                try:
                    supabase_user = supabase_admin.get_user(user_id)
                    email = supabase_user.get('email') or supabase_user.get('user_metadata', {}).get('email')
                    if email:
                        # Создаем запись пользователя
                        cur.execute(
                            '''
                            INSERT INTO app_users (id, email, full_name)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (id) DO NOTHING
                            RETURNING id
                            ''',
                            (user_id, email, supabase_user.get('user_metadata', {}).get('full_name')),
                        )
                        conn.commit()
                except Exception:
                    # Если не удалось получить данные из Supabase, пропускаем
                    pass
            return _fetch_session(cur, user_id)

