"""
Loyalty Points API Routes.

Endpoints for the reviewer loyalty/gamification system.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.loyalty import (
    AwardPointsRequest,
    LeaderboardResponse,
    PointsHistoryResponse,
    UserLoyaltyResponse,
)
from app.services.loyalty import (
    admin_adjust_points,
    get_leaderboard,
    get_points_history,
    get_user_loyalty,
    remove_helpful_vote,
    vote_review_helpful,
)

router = APIRouter(prefix='/api/v1/loyalty', tags=['loyalty'])
public_router = APIRouter(prefix='/api/v1/loyalty', tags=['loyalty'])


# ==================== Public Endpoints ====================

@public_router.get('/leaderboard', response_model=LeaderboardResponse)
async def get_public_leaderboard(
    period: str = Query(
        default="all_time",
        pattern="^(all_time|monthly|weekly)$",
        description="Период: all_time, monthly, weekly"
    ),
    limit: int = Query(default=20, ge=5, le=100),
) -> LeaderboardResponse:
    """
    Получить таблицу лидеров по баллам.

    Публичный эндпоинт для отображения лидерборда на главной странице.
    """
    return await run_in_threadpool(get_leaderboard, period, limit, None)


# ==================== Authenticated Endpoints ====================

@router.get('/me', response_model=UserLoyaltyResponse)
async def get_my_loyalty(
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> UserLoyaltyResponse:
    """
    Получить свой профиль лояльности.

    Возвращает:
    - Текущие баллы и уровень
    - Прогресс к следующему уровню
    - Статистику отзывов и стрики
    - Последние транзакции
    """
    return await run_in_threadpool(get_user_loyalty, current_user_id)


@router.get('/me/history', response_model=PointsHistoryResponse)
async def get_my_points_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> PointsHistoryResponse:
    """
    Получить историю транзакций баллов.

    Пагинированный список всех начислений и списаний баллов.
    """
    return await run_in_threadpool(get_points_history, current_user_id, limit, offset)


@router.get('/me/leaderboard', response_model=LeaderboardResponse)
async def get_leaderboard_with_rank(
    period: str = Query(
        default="all_time",
        pattern="^(all_time|monthly|weekly)$",
    ),
    limit: int = Query(default=20, ge=5, le=100),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> LeaderboardResponse:
    """
    Получить таблицу лидеров с вашим рангом.

    Включает позицию текущего пользователя в рейтинге.
    """
    return await run_in_threadpool(get_leaderboard, period, limit, current_user_id)


# ==================== Review Voting ====================

@router.post('/reviews/{review_id}/helpful')
async def mark_review_helpful(
    review_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Отметить отзыв как полезный.

    Автор отзыва получит баллы за каждую отметку "полезно".
    Нельзя голосовать за собственные отзывы.
    """
    result = await run_in_threadpool(vote_review_helpful, review_id, current_user_id)
    if result:
        return {"success": True, "message": "Отзыв отмечен как полезный"}
    return {"success": False, "message": "Вы уже отмечали этот отзыв"}


@router.delete('/reviews/{review_id}/helpful')
async def unmark_review_helpful(
    review_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Убрать отметку "полезно" с отзыва.
    """
    result = await run_in_threadpool(remove_helpful_vote, review_id, current_user_id)
    if result:
        return {"success": True, "message": "Отметка убрана"}
    return {"success": False, "message": "Вы не отмечали этот отзыв"}


# ==================== Admin Endpoints ====================

admin_router = APIRouter(prefix='/api/admin/loyalty', tags=['admin-loyalty'])


@admin_router.post('/adjust-points')
async def admin_award_points(
    request: AwardPointsRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    [Admin] Начислить или списать баллы пользователю.

    Используется для ручных корректировок (компенсации, штрафы и т.д.)
    """
    # TODO: Add admin role check here
    tx = await run_in_threadpool(
        admin_adjust_points,
        request.user_id,
        request.points,
        request.reason,
        current_user_id,
    )
    return {
        "success": True,
        "transaction_id": tx.id,
        "new_balance": tx.balance_after,
    }


@admin_router.get('/users/{user_id}', response_model=UserLoyaltyResponse)
async def admin_get_user_loyalty(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> UserLoyaltyResponse:
    """
    [Admin] Получить профиль лояльности пользователя.
    """
    # TODO: Add admin role check here
    return await run_in_threadpool(get_user_loyalty, user_id)
