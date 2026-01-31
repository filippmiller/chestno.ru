"""API routes for Competitor Benchmarking feature."""
from fastapi import APIRouter, Depends, Query

from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.benchmarks import BenchmarkResponse
from app.services.benchmarks import get_organization_benchmarks

router = APIRouter(prefix='/api/v1/organizations', tags=['benchmarks'])


@router.get('/{org_id}/benchmarks', response_model=BenchmarkResponse)
async def get_benchmarks(
    org_id: str,
    days: int = Query(default=30, ge=7, le=90, description="Период для анализа трендов (7-90 дней)"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> BenchmarkResponse:
    """
    Получить сравнительный анализ организации с конкурентами в категории.

    Возвращает:
    - Сравнение метрик (рейтинг, отзывы, отклик) со средними по категории
    - Процентильный рейтинг среди конкурентов
    - Тренды за указанный период vs предыдущий период
    """
    return await run_in_threadpool(
        get_organization_benchmarks,
        org_id,
        current_user_id,
        days,
    )
