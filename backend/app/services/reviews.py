from datetime import datetime
from typing import Dict, Any
from uuid import UUID

from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.reviews import (
    Review,
    ReviewCreate,
    ReviewUpdate,
    ReviewModeration,
    PublicReview,
    ReviewStats,
)
from app.schemas.notifications import NotificationEmitRequest
from app.services.organization_profiles import _require_role
from app.services.notifications import emit_notification_in_transaction


def _serialize_media(media: Any) -> list[Dict[str, Any]]:
    """Сериализует media из БД в список словарей."""
    if not media:
        return []
    if isinstance(media, list):
        return media
    return []


def list_organization_reviews(
    organization_id: str,
    user_id: str,
    status: str | None = None,
    product_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Review], int]:
    """Список отзывов организации (для кабинета)."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Подсчет
            count_query = '''
                SELECT COUNT(*) as total
                FROM reviews
                WHERE organization_id = %s
            '''
            count_params = [organization_id]

            if status:
                count_query += ' AND status = %s'
                count_params.append(status)

            if product_id:
                count_query += ' AND product_id = %s'
                count_params.append(product_id)

            cur.execute(count_query, count_params)
            total = cur.fetchone()['total']

            # Получение отзывов
            query = '''
                SELECT id, organization_id, product_id, author_user_id, rating, title, body,
                       media, status, moderated_by, moderated_at, moderation_comment,
                       created_at, updated_at
                FROM reviews
                WHERE organization_id = %s
            '''
            params = [organization_id]

            if status:
                query += ' AND status = %s'
                params.append(status)

            if product_id:
                query += ' AND product_id = %s'
                params.append(product_id)

            query += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()

            reviews = []
            for row in rows:
                reviews.append(Review(
                    id=str(row['id']),
                    organization_id=str(row['organization_id']),
                    product_id=str(row['product_id']) if row['product_id'] else None,
                    author_user_id=str(row['author_user_id']),
                    rating=row['rating'],
                    title=row['title'],
                    body=row['body'],
                    media=_serialize_media(row['media']),
                    status=row['status'],
                    moderated_by=str(row['moderated_by']) if row['moderated_by'] else None,
                    moderated_at=row['moderated_at'],
                    moderation_comment=row['moderation_comment'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                ))

            return reviews, total


def get_review_stats(organization_id: str) -> ReviewStats:
    """Получить статистику отзывов организации."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    COUNT(*) as total_reviews,
                    AVG(rating)::numeric(3,2) as avg_rating,
                    COUNT(*) FILTER (WHERE rating = 1) as rating_1,
                    COUNT(*) FILTER (WHERE rating = 2) as rating_2,
                    COUNT(*) FILTER (WHERE rating = 3) as rating_3,
                    COUNT(*) FILTER (WHERE rating = 4) as rating_4,
                    COUNT(*) FILTER (WHERE rating = 5) as rating_5
                FROM reviews
                WHERE organization_id = %s AND status = 'approved'
                ''',
                (organization_id,),
            )
            row = cur.fetchone()

            total = row['total_reviews'] or 0
            avg_rating = float(row['avg_rating']) if row['avg_rating'] else None

            return ReviewStats(
                total_reviews=total,
                average_rating=avg_rating,
                rating_distribution={
                    1: row['rating_1'] or 0,
                    2: row['rating_2'] or 0,
                    3: row['rating_3'] or 0,
                    4: row['rating_4'] or 0,
                    5: row['rating_5'] or 0,
                },
            )


def create_review(
    organization_id: str,
    user_id: str,
    payload: ReviewCreate,
) -> Review:
    """Создать новый отзыв."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка существования организации
            cur.execute('SELECT id FROM organizations WHERE id = %s', (organization_id,))
            if not cur.fetchone():
                raise ValueError('Organization not found')

            # Проверка существования товара (если указан)
            if payload.product_id:
                cur.execute(
                    'SELECT id FROM products WHERE id = %s AND organization_id = %s',
                    (payload.product_id, organization_id),
                )
                if not cur.fetchone():
                    raise ValueError('Product not found')

            # TODO: Можно добавить ограничение на количество отзывов от одного пользователя

            # Вставка
            cur.execute(
                '''
                INSERT INTO reviews
                    (organization_id, product_id, author_user_id, rating, title, body, media, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                RETURNING id, organization_id, product_id, author_user_id, rating, title, body,
                          media, status, moderated_by, moderated_at, moderation_comment,
                          created_at, updated_at
                ''',
                (
                    organization_id,
                    payload.product_id,
                    user_id,
                    payload.rating,
                    payload.title,
                    payload.body,
                    [item.model_dump() for item in payload.media] if payload.media else [],
                ),
            )
            row = cur.fetchone()
            review_id = str(row['id'])

            # Отправка уведомлений членам организации с ролями owner/admin/manager
            cur.execute(
                '''
                SELECT id FROM notification_types WHERE key = 'business.new_review'
                ''',
            )
            notification_type = cur.fetchone()
            if notification_type:
                # Получаем членов организации с нужными ролями
                cur.execute(
                    '''
                    SELECT user_id FROM organization_members
                    WHERE organization_id = %s AND role IN ('owner', 'admin', 'manager')
                    ''',
                    (organization_id,),
                )
                members = cur.fetchall()
                
                # Отправляем уведомление каждому члену
                notification_type_id = str(notification_type['id'])
                for member in members:
                    emit_request = NotificationEmitRequest(
                        type_key='business.new_review',
                        org_id=organization_id,
                        recipient_user_id=str(member['user_id']),
                        recipient_scope='user',
                        payload={
                            'review_id': review_id,
                            'rating': payload.rating,
                            'product_id': str(payload.product_id) if payload.product_id else None,
                            'organization_id': organization_id,
                        },
                    )
                    emit_notification_in_transaction(cur, emit_request, notification_type_id)

            conn.commit()

            return Review(
                id=str(row['id']),
                organization_id=str(row['organization_id']),
                product_id=str(row['product_id']) if row['product_id'] else None,
                author_user_id=str(row['author_user_id']),
                rating=row['rating'],
                title=row['title'],
                body=row['body'],
                media=_serialize_media(row['media']),
                status=row['status'],
                moderated_by=str(row['moderated_by']) if row['moderated_by'] else None,
                moderated_at=row['moderated_at'],
                moderation_comment=row['moderation_comment'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )


def moderate_review(
    organization_id: str,
    review_id: str,
    user_id: str,
    payload: ReviewModeration,
) -> Review:
    """Модерировать отзыв (изменить статус)."""
    _require_role(None, organization_id, user_id, {'owner', 'admin', 'manager'})

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка существования отзыва
            cur.execute(
                'SELECT id FROM reviews WHERE id = %s AND organization_id = %s',
                (review_id, organization_id),
            )
            if not cur.fetchone():
                raise ValueError('Review not found')

            # Обновление
            cur.execute(
                '''
                UPDATE reviews
                SET status = %s,
                    moderation_comment = %s,
                    moderated_by = %s,
                    moderated_at = now(),
                    updated_at = now()
                WHERE id = %s AND organization_id = %s
                RETURNING id, organization_id, product_id, author_user_id, rating, title, body,
                          media, status, moderated_by, moderated_at, moderation_comment,
                          created_at, updated_at
                ''',
                (
                    payload.status,
                    payload.moderation_comment,
                    user_id,
                    review_id,
                    organization_id,
                ),
            )
            row = cur.fetchone()
            conn.commit()

            return Review(
                id=str(row['id']),
                organization_id=str(row['organization_id']),
                product_id=str(row['product_id']) if row['product_id'] else None,
                author_user_id=str(row['author_user_id']),
                rating=row['rating'],
                title=row['title'],
                body=row['body'],
                media=_serialize_media(row['media']),
                status=row['status'],
                moderated_by=str(row['moderated_by']) if row['moderated_by'] else None,
                moderated_at=row['moderated_at'],
                moderation_comment=row['moderation_comment'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
            )


def list_public_organization_reviews_by_id(
    organization_id: str,
    product_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
    order: str = 'newest',
) -> tuple[list[PublicReview], int, float | None]:
    """Список опубликованных отзывов организации по ID (публичный API)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка организации
            cur.execute(
                '''
                SELECT id FROM organizations
                WHERE id = %s AND public_visible = true AND verification_status = 'verified'
                ''',
                (organization_id,),
            )
            org = cur.fetchone()
            if not org:
                return [], 0, None

            # Подсчет и средний рейтинг
            count_query = '''
                SELECT COUNT(*) as total, AVG(rating)::numeric(3,2) as avg_rating
                FROM reviews
                WHERE organization_id = %s AND status = 'approved'
            '''
            count_params = [organization_id]

            if product_id:
                count_query += ' AND product_id = %s'
                count_params.append(product_id)

            cur.execute(count_query, count_params)
            count_row = cur.fetchone()
            total = count_row['total'] or 0
            avg_rating = float(count_row['avg_rating']) if count_row['avg_rating'] else None

            # Получение отзывов
            query = '''
                SELECT id, product_id, author_user_id, rating, title, body, media, created_at
                FROM reviews
                WHERE organization_id = %s AND status = 'approved'
            '''
            params = [organization_id]

            if product_id:
                query += ' AND product_id = %s'
                params.append(product_id)

            # Сортировка
            if order == 'highest_rating':
                query += ' ORDER BY rating DESC, created_at DESC'
            else:  # newest
                query += ' ORDER BY created_at DESC'

            query += ' LIMIT %s OFFSET %s'
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()

            reviews = []
            for row in rows:
                reviews.append(PublicReview(
                    id=str(row['id']),
                    product_id=str(row['product_id']) if row['product_id'] else None,
                    author_user_id=str(row['author_user_id']),
                    rating=row['rating'],
                    title=row['title'],
                    body=row['body'],
                    media=_serialize_media(row['media']),
                    created_at=row['created_at'],
                ))

            return reviews, total, avg_rating


def list_public_organization_reviews(
    organization_slug: str,
    product_slug: str | None = None,
    limit: int = 20,
    offset: int = 0,
    order: str = 'newest',
) -> tuple[list[PublicReview], int, float | None]:
    """Список опубликованных отзывов организации (публичный API)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Проверка организации
            cur.execute(
                '''
                SELECT id FROM organizations
                WHERE slug = %s AND public_visible = true
                ''',
                (organization_slug,),
            )
            org = cur.fetchone()
            if not org:
                return [], 0, None

            organization_id = org['id']
            product_id = None

            if product_slug:
                cur.execute(
                    'SELECT id FROM products WHERE slug = %s AND organization_id = %s',
                    (product_slug, organization_id),
                )
                product = cur.fetchone()
                if product:
                    product_id = product['id']

            # Подсчет и средний рейтинг
            count_query = '''
                SELECT COUNT(*) as total, AVG(rating)::numeric(3,2) as avg_rating
                FROM reviews
                WHERE organization_id = %s AND status = 'approved'
            '''
            count_params = [organization_id]

            if product_id:
                count_query += ' AND product_id = %s'
                count_params.append(product_id)
            elif product_slug:
                # Если product_slug указан, но товар не найден, возвращаем пустой список
                return [], 0, None

            cur.execute(count_query, count_params)
            count_row = cur.fetchone()
            total = count_row['total'] or 0
            avg_rating = float(count_row['avg_rating']) if count_row['avg_rating'] else None

            # Получение отзывов
            query = '''
                SELECT id, product_id, author_user_id, rating, title, body, media, created_at
                FROM reviews
                WHERE organization_id = %s AND status = 'approved'
            '''
            params = [organization_id]

            if product_id:
                query += ' AND product_id = %s'
                params.append(product_id)

            # Сортировка
            if order == 'highest_rating':
                query += ' ORDER BY rating DESC, created_at DESC'
            else:  # newest
                query += ' ORDER BY created_at DESC'

            query += ' LIMIT %s OFFSET %s'
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()

            reviews = []
            for row in rows:
                reviews.append(PublicReview(
                    id=str(row['id']),
                    product_id=str(row['product_id']) if row['product_id'] else None,
                    author_user_id=str(row['author_user_id']),
                    rating=row['rating'],
                    title=row['title'],
                    body=row['body'],
                    media=_serialize_media(row['media']),
                    created_at=row['created_at'],
                ))

            return reviews, total, avg_rating

