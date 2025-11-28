from datetime import datetime
from typing import Dict, Any
from uuid import UUID

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.posts import (
    OrganizationPost,
    OrganizationPostCreate,
    OrganizationPostUpdate,
    PublicOrganizationPost,
)
from app.services.organization_profiles import _require_role


def _serialize_gallery(gallery: Any) -> list[Dict[str, Any]]:
    """Сериализует gallery из БД в список словарей."""
    if not gallery:
        return []
    if isinstance(gallery, list):
        return gallery
    return []


def list_organization_posts(
    organization_id: str,
    user_id: str,
    status: str | None = None,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[OrganizationPost], int]:
    """Список постов организации (для кабинета)."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Подсчет общего количества
            count_query = '''
                SELECT COUNT(*) as total
                FROM organization_posts
                WHERE organization_id = %s
            '''
            count_params = [organization_id]

            if status:
                count_query += ' AND status = %s'
                count_params.append(status)

            if search:
                count_query += ' AND (title ILIKE %s OR body ILIKE %s)'
                search_pattern = f'%{search}%'
                count_params.extend([search_pattern, search_pattern])

            cur.execute(count_query, count_params)
            total = cur.fetchone()['total']

            # Получение постов
            query = '''
                SELECT id, organization_id, author_user_id, slug, title, excerpt, body,
                       status, main_image_url, gallery, video_url, published_at,
                       is_pinned, created_at, updated_at
                FROM organization_posts
                WHERE organization_id = %s
            '''
            params = [organization_id]

            if status:
                query += ' AND status = %s'
                params.append(status)

            if search:
                query += ' AND (title ILIKE %s OR body ILIKE %s)'
                search_pattern = f'%{search}%'
                params.extend([search_pattern, search_pattern])

            query += ' ORDER BY is_pinned DESC, COALESCE(published_at, created_at) DESC LIMIT %s OFFSET %s'
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()

            posts = []
            for row in rows:
                posts.append(OrganizationPost(
                    id=str(row['id']),
                    organization_id=str(row['organization_id']),
                    author_user_id=str(row['author_user_id']),
                    slug=row['slug'],
                    title=row['title'],
                    excerpt=row['excerpt'],
                    body=row['body'],
                    status=row['status'],
                    main_image_url=row['main_image_url'],
                    gallery=_serialize_gallery(row['gallery']),
                    video_url=row['video_url'],
                    published_at=row['published_at'],
                    is_pinned=row['is_pinned'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                ))

            return posts, total


def get_organization_post(organization_id: str, post_id: str, user_id: str) -> OrganizationPost | None:
    """Получить пост по ID."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, organization_id, author_user_id, slug, title, excerpt, body,
                       status, main_image_url, gallery, video_url, published_at,
                       is_pinned, created_at, updated_at
                FROM organization_posts
                WHERE id = %s AND organization_id = %s
                ''',
                (post_id, organization_id),
            )
            row = cur.fetchone()
            if not row:
                return None

            return OrganizationPost(
                id=str(row['id']),
                organization_id=str(row['organization_id']),
                author_user_id=str(row['author_user_id']),
                slug=row['slug'],
                title=row['title'],
                excerpt=row['excerpt'],
                body=row['body'],
                status=row['status'],
                main_image_url=row['main_image_url'],
                gallery=_serialize_gallery(row['gallery']),
                video_url=row['video_url'],
                published_at=row['published_at'],
                is_pinned=row['is_pinned'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )


def create_organization_post(
    organization_id: str,
    user_id: str,
    payload: OrganizationPostCreate,
) -> OrganizationPost:
    """Создать новый пост."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка уникальности slug
            cur.execute(
                'SELECT id FROM organization_posts WHERE organization_id = %s AND slug = %s',
                (organization_id, payload.slug),
            )
            if cur.fetchone():
                raise ValueError(f'Post with slug "{payload.slug}" already exists')

            # Определение published_at
            published_at = None
            if payload.status == 'published':
                published_at = datetime.now()

            # Вставка
            cur.execute(
                '''
                INSERT INTO organization_posts
                    (organization_id, author_user_id, slug, title, excerpt, body,
                     status, main_image_url, gallery, video_url, published_at, is_pinned)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, organization_id, author_user_id, slug, title, excerpt, body,
                          status, main_image_url, gallery, video_url, published_at,
                          is_pinned, created_at, updated_at
                ''',
                (
                    organization_id,
                    user_id,
                    payload.slug,
                    payload.title,
                    payload.excerpt,
                    payload.body,
                    payload.status,
                    payload.main_image_url,
                    [item.model_dump() for item in payload.gallery] if payload.gallery else [],
                    payload.video_url,
                    published_at,
                    payload.is_pinned,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return OrganizationPost(
                id=str(row['id']),
                organization_id=str(row['organization_id']),
                author_user_id=str(row['author_user_id']),
                slug=row['slug'],
                title=row['title'],
                excerpt=row['excerpt'],
                body=row['body'],
                status=row['status'],
                main_image_url=row['main_image_url'],
                gallery=_serialize_gallery(row['gallery']),
                video_url=row['video_url'],
                published_at=row['published_at'],
                is_pinned=row['is_pinned'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )


def update_organization_post(
    organization_id: str,
    post_id: str,
    user_id: str,
    payload: OrganizationPostUpdate,
) -> OrganizationPost:
    """Обновить пост."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка существования поста
            cur.execute(
                'SELECT id, slug FROM organization_posts WHERE id = %s AND organization_id = %s',
                (post_id, organization_id),
            )
            existing = cur.fetchone()
            if not existing:
                raise ValueError('Post not found')

            # Проверка уникальности slug (если меняется)
            if payload.slug and payload.slug != existing['slug']:
                cur.execute(
                    'SELECT id FROM organization_posts WHERE organization_id = %s AND slug = %s AND id != %s',
                    (organization_id, payload.slug, post_id),
                )
                if cur.fetchone():
                    raise ValueError(f'Post with slug "{payload.slug}" already exists')

            # Подготовка обновлений
            updates = []
            params = []

            if payload.slug is not None:
                updates.append('slug = %s')
                params.append(payload.slug)
            if payload.title is not None:
                updates.append('title = %s')
                params.append(payload.title)
            if payload.excerpt is not None:
                updates.append('excerpt = %s')
                params.append(payload.excerpt)
            if payload.body is not None:
                updates.append('body = %s')
                params.append(payload.body)
            if payload.status is not None:
                updates.append('status = %s')
                params.append(payload.status)
                # Если переходим в published и published_at еще не установлен
                if payload.status == 'published':
                    updates.append('published_at = COALESCE(published_at, now())')
            if payload.main_image_url is not None:
                updates.append('main_image_url = %s')
                params.append(payload.main_image_url)
            if payload.gallery is not None:
                updates.append('gallery = %s')
                params.append([item.model_dump() for item in payload.gallery] if payload.gallery else [])
            if payload.video_url is not None:
                updates.append('video_url = %s')
                params.append(payload.video_url)
            if payload.is_pinned is not None:
                updates.append('is_pinned = %s')
                params.append(payload.is_pinned)
            if payload.published_at is not None:
                updates.append('published_at = %s')
                params.append(payload.published_at)

            if not updates:
                # Ничего не обновляется, просто возвращаем существующий пост
                return get_organization_post(organization_id, post_id, user_id)

            updates.append('updated_at = now()')
            params.extend([post_id, organization_id])

            query = f'''
                UPDATE organization_posts
                SET {', '.join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING id, organization_id, author_user_id, slug, title, excerpt, body,
                          status, main_image_url, gallery, video_url, published_at,
                          is_pinned, created_at, updated_at
            '''

            cur.execute(query, params)
            row = cur.fetchone()
            conn.commit()

            return OrganizationPost(
                id=str(row['id']),
                organization_id=str(row['organization_id']),
                author_user_id=str(row['author_user_id']),
                slug=row['slug'],
                title=row['title'],
                excerpt=row['excerpt'],
                body=row['body'],
                status=row['status'],
                main_image_url=row['main_image_url'],
                gallery=_serialize_gallery(row['gallery']),
                video_url=row['video_url'],
                published_at=row['published_at'],
                is_pinned=row['is_pinned'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )


def list_public_organization_posts_by_id(
    organization_id: str,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[PublicOrganizationPost], int]:
    """Список опубликованных постов организации по ID (публичный API)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка, что организация публична
            cur.execute(
                '''
                SELECT id FROM organizations
                WHERE id = %s AND public_visible = true AND verification_status = 'verified'
                ''',
                (organization_id,),
            )
            org = cur.fetchone()
            if not org:
                return [], 0

            # Подсчет
            cur.execute(
                '''
                SELECT COUNT(*) as total
                FROM organization_posts
                WHERE organization_id = %s AND status = 'published'
                ''',
                (organization_id,),
            )
            total = cur.fetchone()['total']

            # Получение постов
            cur.execute(
                '''
                SELECT id, slug, title, excerpt, body, main_image_url, gallery,
                       video_url, published_at, is_pinned
                FROM organization_posts
                WHERE organization_id = %s AND status = 'published'
                ORDER BY is_pinned DESC, published_at DESC
                LIMIT %s OFFSET %s
                ''',
                (organization_id, limit, offset),
            )
            rows = cur.fetchall()

            posts = []
            for row in rows:
                posts.append(PublicOrganizationPost(
                    id=str(row['id']),
                    slug=row['slug'],
                    title=row['title'],
                    excerpt=row['excerpt'],
                    body=row['body'],
                    main_image_url=row['main_image_url'],
                    gallery=_serialize_gallery(row['gallery']),
                    video_url=row['video_url'],
                    published_at=row['published_at'],
                    is_pinned=row['is_pinned'],
                ))

            return posts, total


def list_public_organization_posts(
    organization_slug: str,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[PublicOrganizationPost], int]:
    """Список опубликованных постов организации (публичный API)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка, что организация публична
            cur.execute(
                '''
                SELECT id FROM organizations
                WHERE slug = %s AND public_visible = true
                ''',
                (organization_slug,),
            )
            org = cur.fetchone()
            if not org:
                return [], 0

            organization_id = org['id']

            # Подсчет
            cur.execute(
                '''
                SELECT COUNT(*) as total
                FROM organization_posts
                WHERE organization_id = %s AND status = 'published'
                ''',
                (organization_id,),
            )
            total = cur.fetchone()['total']

            # Получение постов
            cur.execute(
                '''
                SELECT id, slug, title, excerpt, body, main_image_url, gallery,
                       video_url, published_at, is_pinned
                FROM organization_posts
                WHERE organization_id = %s AND status = 'published'
                ORDER BY is_pinned DESC, published_at DESC
                LIMIT %s OFFSET %s
                ''',
                (organization_id, limit, offset),
            )
            rows = cur.fetchall()

            posts = []
            for row in rows:
                posts.append(PublicOrganizationPost(
                    id=str(row['id']),
                    slug=row['slug'],
                    title=row['title'],
                    excerpt=row['excerpt'],
                    body=row['body'],
                    main_image_url=row['main_image_url'],
                    gallery=_serialize_gallery(row['gallery']),
                    video_url=row['video_url'],
                    published_at=row['published_at'],
                    is_pinned=row['is_pinned'],
                ))

            return posts, total


def get_public_organization_post(organization_slug: str, post_slug: str) -> PublicOrganizationPost | None:
    """Получить опубликованный пост по slug (публичный API)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT op.id, op.slug, op.title, op.excerpt, op.body, op.main_image_url,
                       op.gallery, op.video_url, op.published_at, op.is_pinned
                FROM organization_posts op
                JOIN organizations o ON o.id = op.organization_id
                WHERE o.slug = %s AND op.slug = %s
                  AND op.status = 'published' AND o.public_visible = true
                ''',
                (organization_slug, post_slug),
            )
            row = cur.fetchone()
            if not row:
                return None

            return PublicOrganizationPost(
                id=str(row['id']),
                slug=row['slug'],
                title=row['title'],
                excerpt=row['excerpt'],
                body=row['body'],
                main_image_url=row['main_image_url'],
                gallery=_serialize_gallery(row['gallery']),
                video_url=row['video_url'],
                published_at=row['published_at'],
                is_pinned=row['is_pinned'],
            )

