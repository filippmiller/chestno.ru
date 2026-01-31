from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from app.schemas.reviews import (
    Review,
    ReviewCreate,
    ReviewModeration,
    ReviewResponse,
    ReviewsResponse,
    PublicReviewsResponse,
    ReviewStats,
    AIResponseResult,
)
from app.services.reviews import (
    create_review,
    list_organization_reviews,
    list_public_organization_reviews,
    moderate_review,
    get_review_stats,
    respond_to_review,
    delete_review,
)
from app.services.ai_response import get_ai_response_for_review

from .auth import get_current_user_id

router = APIRouter(prefix='/api/organizations', tags=['reviews'])
public_router = APIRouter(prefix='/api/public/organizations', tags=['reviews'])


@router.get('/{organization_id}/reviews', response_model=ReviewsResponse)
async def list_reviews(
    organization_id: str,
    status: str | None = Query(default=None, pattern='^(pending|approved|rejected)$'),
    product_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
) -> ReviewsResponse:
    """Список отзывов организации (для кабинета)."""
    items, total = await run_in_threadpool(
        list_organization_reviews,
        organization_id,
        current_user_id,
        status,
        product_id,
        limit,
        offset,
    )
    return ReviewsResponse(items=items, total=total)


@router.get('/{organization_id}/reviews/stats', response_model=ReviewStats)
async def get_stats(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> ReviewStats:
    """Статистика отзывов организации."""
    return await run_in_threadpool(get_review_stats, organization_id)


@router.patch('/{organization_id}/reviews/{review_id}/moderate', response_model=Review)
async def moderate(
    organization_id: str,
    review_id: str,
    payload: ReviewModeration,
    current_user_id: str = Depends(get_current_user_id),
) -> Review:
    """Модерировать отзыв."""
    try:
        return await run_in_threadpool(
            moderate_review,
            organization_id,
            review_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post('/{organization_id}/reviews/{review_id}/respond', response_model=Review)
async def respond(
    organization_id: str,
    review_id: str,
    payload: ReviewResponse,
    current_user_id: str = Depends(get_current_user_id),
) -> Review:
    """Ответить на отзыв от имени организации."""
    try:
        return await run_in_threadpool(
            respond_to_review,
            organization_id,
            review_id,
            current_user_id,
            payload.response,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete('/{organization_id}/reviews/{review_id}', status_code=204)
async def delete(
    organization_id: str,
    review_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """
    Удалить отзыв.

    - Менеджеры организации (owner/admin/manager) могут удалить любой отзыв
    - Авторы могут удалить только свои pending отзывы
    """
    try:
        await run_in_threadpool(
            delete_review,
            organization_id,
            review_id,
            current_user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post('/{organization_id}/reviews/{review_id}/ai-response', response_model=AIResponseResult)
async def generate_ai_response(
    organization_id: str,
    review_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> AIResponseResult:
    """
    Генерация AI-ответа на отзыв.

    Анализирует отзыв и генерирует 2-3 варианта ответа с разными тонами:
    - professional (профессиональный)
    - friendly (дружелюбный)
    - apologetic (извинительный, только для негативных отзывов)

    Также определяет:
    - sentiment (тональность отзыва): positive/neutral/negative
    - topics (темы, упомянутые в отзыве)
    """
    from app.core.db import get_connection
    from app.services.organization_profiles import _require_role
    from psycopg.rows import dict_row

    # Проверка доступа пользователя к организации
    _require_role(None, organization_id, current_user_id, {'owner', 'admin', 'manager'})

    # Получение отзыва из БД
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, rating, title, body
                FROM reviews
                WHERE id = %s AND organization_id = %s
                ''',
                (review_id, organization_id),
            )
            review = cur.fetchone()

            if not review:
                raise HTTPException(status_code=404, detail='Review not found')

            # Генерация AI-ответов
            result = await run_in_threadpool(get_ai_response_for_review, dict(review))

            return AIResponseResult(**result)


# ============================================
# Public routes
# ============================================


@public_router.get('/by-slug/{slug}/reviews', response_model=PublicReviewsResponse)
async def public_list_reviews(
    slug: str,
    product_slug: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    order: str = Query(default='newest', pattern='^(newest|highest_rating)$'),
) -> PublicReviewsResponse:
    """Список опубликованных отзывов организации (публичный API)."""
    items, total, avg_rating = await run_in_threadpool(
        list_public_organization_reviews,
        slug,
        product_slug,
        limit,
        offset,
        order,
    )
    return PublicReviewsResponse(items=items, total=total, average_rating=avg_rating)


@public_router.get('/{organization_id}/reviews', response_model=PublicReviewsResponse)
async def public_list_reviews_by_id(
    organization_id: str,
    product_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    order: str = Query(default='newest', pattern='^(newest|highest_rating)$'),
) -> PublicReviewsResponse:
    """Список опубликованных отзывов организации по ID (публичный API)."""
    from app.services.reviews import list_public_organization_reviews_by_id
    items, total, avg_rating = await run_in_threadpool(
        list_public_organization_reviews_by_id,
        organization_id,
        product_id,
        limit,
        offset,
        order,
    )
    return PublicReviewsResponse(items=items, total=total, average_rating=avg_rating)


@public_router.post('/by-slug/{slug}/reviews', response_model=Review, status_code=201)
async def public_create_review(
    slug: str,
    payload: ReviewCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> Review:
    """Создать отзыв (публичный API, требует авторизации)."""
    from app.core.db import get_connection
    from psycopg.rows import dict_row

    # Получить organization_id по slug
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT id FROM organizations WHERE slug = %s', (slug,))
            org = cur.fetchone()
            if not org:
                raise HTTPException(status_code=404, detail='Organization not found')

            organization_id = str(org['id'])

    try:
        return await run_in_threadpool(
            create_review,
            organization_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@public_router.post('/{organization_id}/reviews', response_model=Review, status_code=201)
async def public_create_review_by_id(
    organization_id: str,
    payload: ReviewCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> Review:
    """Создать отзыв по ID организации (публичный API, требует авторизации)."""
    try:
        return await run_in_threadpool(
            create_review,
            organization_id,
            current_user_id,
            payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

