from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.notifications import NotificationEmitRequest
from app.services import notifications as notifications_service
from app.services.admin_guard import assert_platform_admin

router = APIRouter(prefix='/api/admin/notifications', tags=['notifications'])


@router.post('/')
async def send_notification(
    request: Request,
    payload: NotificationEmitRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> None:
    assert_platform_admin(current_user_id)
    await run_in_threadpool(notifications_service.emit_notification, payload, current_user_id)


@router.post('/reminders/process', status_code=200)
async def process_reminders(
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Обрабатывает активные reminders (для запуска вручную или по cron).
    Требует platform_admin роль.
    """
    assert_platform_admin(current_user_id)
    result = await run_in_threadpool(notifications_service.process_reminders)
    return {
        'message': 'Reminders processed successfully',
        'processed': result['processed'],
        'notifications_created': result['notifications_created'],
    }


@router.post('/email/process', status_code=200)
async def process_email_deliveries(
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Обрабатывает pending email deliveries и отправляет их через SMTP.
    Требует platform_admin роль.
    """
    assert_platform_admin(current_user_id)
    result = await notifications_service.process_email_deliveries()
    return {
        'message': 'Email deliveries processed successfully',
        'processed': result['processed'],
        'sent': result['sent'],
    }


@router.post('/telegram/process', status_code=200)
async def process_telegram_deliveries(
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Обрабатывает pending telegram deliveries и отправляет их через Telegram Bot API.
    Требует platform_admin роль.
    """
    assert_platform_admin(current_user_id)
    result = await notifications_service.process_telegram_deliveries()
    return {
        'message': 'Telegram deliveries processed successfully',
        'processed': result['processed'],
        'sent': result['sent'],
    }


@router.post('/push/process', status_code=200)
async def process_push_deliveries(
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Обрабатывает pending push deliveries (помечает как ready для отправки на клиенте).
    Требует platform_admin роль.
    """
    assert_platform_admin(current_user_id)
    result = await notifications_service.process_push_deliveries()
    return {
        'message': 'Push deliveries processed successfully',
        'processed': result['processed'],
        'ready': result['ready'],
    }
