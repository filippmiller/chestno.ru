from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from app.api.routes.auth import get_current_user_id
from app.schemas.admin_dashboard import AdminDashboardSummary
from app.services.admin_dashboard import get_admin_dashboard_summary

router = APIRouter(prefix='/api/admin/dashboard', tags=['admin'])


@router.get('/summary', response_model=AdminDashboardSummary)
async def admin_summary(current_user_id: str = Depends(get_current_user_id)) -> AdminDashboardSummary:
    return await run_in_threadpool(get_admin_dashboard_summary, current_user_id)

