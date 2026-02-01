"""
Yandex Business Integration API Routes.

Endpoints for linking Yandex Business profiles and importing reviews.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.yandex_business import (
    LinkYandexBusinessRequest,
    UpdateYandexRatingRequest,
    YandexBusinessProfileLink,
    YandexBusinessProfileResponse,
    YandexReviewImportRequest,
    YandexReviewImportResult,
)
from app.services.yandex_business import (
    get_imported_reviews,
    get_yandex_profile,
    import_yandex_reviews,
    link_yandex_profile,
    unlink_yandex_profile,
    update_yandex_rating,
    verify_yandex_profile,
)

router = APIRouter(prefix='/api/v1/organizations', tags=['yandex-business'])
admin_router = APIRouter(prefix='/api/admin/yandex-business', tags=['admin-yandex'])


# ==================== Organization Endpoints ====================

@router.get('/{organization_id}/yandex', response_model=YandexBusinessProfileResponse)
async def get_org_yandex_profile(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> YandexBusinessProfileResponse:
    """
    Получить информацию о привязке Яндекс Бизнеса.

    Возвращает:
    - Информацию о привязанном профиле (если есть)
    - Статус верификации
    - Возможность отображения бейджа
    """
    return await run_in_threadpool(
        get_yandex_profile,
        organization_id,
        current_user_id,
    )


@router.post('/{organization_id}/yandex/link', response_model=YandexBusinessProfileLink)
async def link_yandex(
    organization_id: str,
    request: LinkYandexBusinessRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> YandexBusinessProfileLink:
    """
    Привязать профиль Яндекс Бизнеса к организации.

    **Как получить ссылку:**
    1. Откройте Яндекс Карты
    2. Найдите свою организацию
    3. Скопируйте URL из адресной строки

    После привязки добавьте код верификации в описание профиля
    на Яндекс Бизнесе для подтверждения владения.
    """
    return await run_in_threadpool(
        link_yandex_profile,
        organization_id,
        request.yandex_url,
        current_user_id,
    )


@router.put('/{organization_id}/yandex/rating', response_model=YandexBusinessProfileLink)
async def update_org_yandex_rating(
    organization_id: str,
    request: UpdateYandexRatingRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> YandexBusinessProfileLink:
    """
    Обновить рейтинг с Яндекса вручную.

    Поскольку Яндекс не предоставляет API для автоматического получения
    рейтинга, вы можете обновить его вручную.

    1. Откройте свой профиль на Яндекс Картах
    2. Посмотрите текущий рейтинг и количество отзывов
    3. Введите данные сюда
    """
    return await run_in_threadpool(
        update_yandex_rating,
        organization_id,
        request.rating,
        request.review_count,
        current_user_id,
    )


@router.post('/{organization_id}/yandex/import', response_model=YandexReviewImportResult)
async def import_reviews(
    organization_id: str,
    request: YandexReviewImportRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> YandexReviewImportResult:
    """
    Импортировать отзывы из Яндекс Бизнеса.

    **Как экспортировать отзывы из Яндекс Бизнеса:**
    1. Войдите в личный кабинет Яндекс Бизнеса
    2. Перейдите в раздел "Отзывы"
    3. Нажмите "Экспорт" и скачайте файл
    4. Загрузите данные через этот endpoint

    Дубликаты автоматически пропускаются.
    """
    return await run_in_threadpool(
        import_yandex_reviews,
        organization_id,
        request.reviews,
        current_user_id,
    )


@router.get('/{organization_id}/yandex/reviews')
async def get_org_yandex_reviews(
    organization_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Получить импортированные отзывы с Яндекса.

    Возвращает отзывы, которые были импортированы из Яндекс Бизнеса.
    """
    reviews, total = await run_in_threadpool(
        get_imported_reviews,
        organization_id,
        current_user_id,
        limit,
        offset,
    )
    return {
        "reviews": reviews,
        "total": total,
        "has_more": (offset + limit) < total,
    }


@router.delete('/{organization_id}/yandex/link')
async def unlink_yandex(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Отвязать профиль Яндекс Бизнеса.

    **Внимание:** Это удалит привязку и все импортированные отзывы.
    Только владелец может выполнить это действие.
    """
    result = await run_in_threadpool(
        unlink_yandex_profile,
        organization_id,
        current_user_id,
    )
    return {"success": result}


# ==================== Admin Endpoints ====================

@admin_router.post('/organizations/{organization_id}/verify')
async def admin_verify_yandex(
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> YandexBusinessProfileLink:
    """
    [Admin] Подтвердить владение профилем Яндекс Бизнеса.

    Вызывается после проверки, что код верификации присутствует
    в описании профиля на Яндекс Бизнесе.
    """
    # TODO: Add admin role check
    return await run_in_threadpool(
        verify_yandex_profile,
        organization_id,
        current_user_id,
    )


@admin_router.get('/pending')
async def admin_get_pending_verifications(
    limit: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    [Admin] Получить список организаций, ожидающих верификации Яндекс профиля.
    """
    # TODO: Add admin role check and implement
    from app.core.db import get_connection
    from psycopg.rows import dict_row

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT ybl.*, o.name as organization_name
            FROM yandex_business_links ybl
            JOIN organizations o ON o.id = ybl.organization_id
            WHERE ybl.status = 'pending'
            ORDER BY ybl.created_at DESC
            LIMIT %s
            """,
            (limit,)
        )
        pending = [dict(r) for r in cur.fetchall()]

    return {"pending": pending, "count": len(pending)}
