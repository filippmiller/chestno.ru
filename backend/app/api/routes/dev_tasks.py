from fastapi import APIRouter, Depends, Query, Request

from app.core.session_deps import get_current_user_id_from_session
from app.services import dev_tasks

router = APIRouter(prefix='/api/admin/dev-tasks', tags=['admin-dev'])


@router.get('/')
async def list_tasks(
    request: Request,
    status_filter: str | None = Query(default=None, alias='status'),
    category: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    filters = {
        'status': status_filter,
        'category': category,
        'provider': provider,
    }
    return dev_tasks.list_tasks(current_user_id, filters, limit, offset)


@router.post('/')
async def create_task(request: Request, payload: dict, current_user_id: str = Depends(get_current_user_id_from_session)):
    return dev_tasks.create_task(current_user_id, payload)


@router.patch('/{task_id}')
async def update_task(request: Request, task_id: str, payload: dict, current_user_id: str = Depends(get_current_user_id_from_session)):
    return dev_tasks.update_task(current_user_id, task_id, payload)


@router.delete('/{task_id}')
async def delete_task(request: Request, task_id: str, current_user_id: str = Depends(get_current_user_id_from_session)):
    return dev_tasks.delete_task(current_user_id, task_id)
