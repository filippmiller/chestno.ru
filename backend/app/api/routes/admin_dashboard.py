from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.admin_dashboard import AdminDashboardSummary
from app.services.admin_dashboard import get_admin_dashboard_summary

router = APIRouter(prefix='/api/admin/dashboard', tags=['admin'])


@router.get('/summary', response_model=AdminDashboardSummary)
async def admin_summary(request: Request, current_user_id: str = Depends(get_current_user_id_from_session)) -> AdminDashboardSummary:
    return await run_in_threadpool(get_admin_dashboard_summary, current_user_id)
