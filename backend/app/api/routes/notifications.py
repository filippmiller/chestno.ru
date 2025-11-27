from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.routes.auth import get_current_user_id
from app.schemas.notifications import NotificationListResponse, NotificationSetting, NotificationSettingUpdate
from app.services import notifications as notifications_service

router = APIRouter(prefix='/api', tags=['notifications'])


@router.get('/notifications', response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = None,
    status_filter: str | None = Query(default=None, pattern='^(unread|all)$'),
    current_user_id: str = Depends(get_current_user_id),
) -> NotificationListResponse:
    offset = int(cursor) if cursor else 0
    response = notifications_service.list_notifications(current_user_id, offset, limit)
    if status_filter == 'unread':
        response.items = [item for item in response.items if item.status in {'pending', 'sent'}]
    return response


@router.get('/notifications/unread-count')
async def unread_count(current_user_id: str = Depends(get_current_user_id)) -> dict[str, int]:
    count = notifications_service.get_unread_count(current_user_id)
    return {'count': count}


@router.post('/notifications/{delivery_id}/read')
async def mark_notification_read(delivery_id: str, current_user_id: str = Depends(get_current_user_id)) -> None:
    notifications_service.mark_notification_read(current_user_id, delivery_id)


@router.post('/notifications/{delivery_id}/dismiss')
async def dismiss_notification(delivery_id: str, current_user_id: str = Depends(get_current_user_id)) -> None:
    notifications_service.dismiss_notification(current_user_id, delivery_id)


@router.get('/notification-settings', response_model=list[NotificationSetting])
async def list_settings(current_user_id: str = Depends(get_current_user_id)) -> list[NotificationSetting]:
    return notifications_service.list_notification_settings(current_user_id)


@router.patch('/notification-settings', response_model=list[NotificationSetting])
async def update_settings(
    updates: list[NotificationSettingUpdate],
    current_user_id: str = Depends(get_current_user_id),
) -> list[NotificationSetting]:
    if not updates:
        raise HTTPException(status_code=400, detail='No updates provided')
    return notifications_service.update_notification_settings(current_user_id, updates)

