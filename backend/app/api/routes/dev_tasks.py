from fastapi import APIRouter, Depends, Query

from app.api.routes.auth import get_current_user_id
from app.services import dev_tasks

router = APIRouter(prefix='/api/admin/dev-tasks', tags=['admin-dev'])


@router.get('/')
async def list_tasks(
    status_filter: str | None = Query(default=None, alias='status'),
    category: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
):
    filters = {
        'status': status_filter,
        'category': category,
        'provider': provider,
    }
    return dev_tasks.list_tasks(current_user_id, filters, limit, offset)


@router.post('/')
async def create_task(payload: dict, current_user_id: str = Depends(get_current_user_id)):
    return dev_tasks.create_task(current_user_id, payload)


@router.patch('/{task_id}')
async def update_task(task_id: str, payload: dict, current_user_id: str = Depends(get_current_user_id)):
    return dev_tasks.update_task(current_user_id, task_id, payload)


@router.delete('/{task_id}')
async def delete_task(task_id: str, current_user_id: str = Depends(get_current_user_id)):
    return dev_tasks.delete_task(current_user_id, task_id)

