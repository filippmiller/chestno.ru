from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.notifications import NotificationListResponse, NotificationSetting, NotificationSettingUpdate
from app.services import notifications as notifications_service
from app.services import push as push_service

router = APIRouter(prefix='/api', tags=['notifications'])


@router.get('/notifications', response_model=NotificationListResponse)
async def list_notifications(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = None,
    status_filter: str | None = Query(default=None, pattern='^(unread|all)$'),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> NotificationListResponse:
    offset = int(cursor) if cursor else 0
    response = notifications_service.list_notifications(current_user_id, offset, limit)
    if status_filter == 'unread':
        response.items = [item for item in response.items if item.status in {'pending', 'sent'}]
    return response


@router.get('/notifications/unread-count')
async def unread_count(request: Request, current_user_id: str = Depends(get_current_user_id_from_session)) -> dict[str, int]:
    count = notifications_service.get_unread_count(current_user_id)
    return {'count': count}


@router.post('/notifications/{delivery_id}/read')
async def mark_notification_read(request: Request, delivery_id: str, current_user_id: str = Depends(get_current_user_id_from_session)) -> None:
    notifications_service.mark_notification_read(current_user_id, delivery_id)


@router.post('/notifications/{delivery_id}/dismiss')
async def dismiss_notification(request: Request, delivery_id: str, current_user_id: str = Depends(get_current_user_id_from_session)) -> None:
    notifications_service.dismiss_notification(current_user_id, delivery_id)


@router.get('/notification-settings', response_model=list[NotificationSetting])
async def list_settings(request: Request, current_user_id: str = Depends(get_current_user_id_from_session)) -> list[NotificationSetting]:
    return notifications_service.list_notification_settings(current_user_id)


@router.patch('/notification-settings', response_model=list[NotificationSetting])
async def update_settings(
    request: Request,
    updates: list[NotificationSettingUpdate],
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[NotificationSetting]:
    if not updates:
        raise HTTPException(status_code=400, detail='No updates provided')
    return notifications_service.update_notification_settings(current_user_id, updates)


@router.post('/notification-settings/push-subscription')
async def save_push_subscription(
    request: Request,
    payload: dict,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Сохраняет push subscription для пользователя.
    """
    subscription = payload.get('subscription', {})
    push_service.save_push_subscription(
        current_user_id,
        subscription.get('endpoint'),
        subscription.get('keys', {}).get('p256dh'),
        subscription.get('keys', {}).get('auth'),
    )
    return {'message': 'Push subscription saved'}


@router.delete('/notification-settings/push-subscription')
async def delete_push_subscription(
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Удаляет push subscription пользователя.
    """
    push_service.delete_push_subscription(current_user_id)
    return {'message': 'Push subscription deleted'}
