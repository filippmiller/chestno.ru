from fastapi import APIRouter, Depends

from app.api.routes.auth import get_current_user_id
from app.schemas.notifications import NotificationEmitRequest
from app.services import notifications as notifications_service
from app.services.admin_guard import assert_platform_admin

router = APIRouter(prefix='/api/admin/notifications', tags=['notifications'])


@router.post('/')
async def send_notification(
    payload: NotificationEmitRequest,
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    assert_platform_admin(current_user_id)
    notifications_service.emit_notification(payload, actor_user_id=current_user_id)

