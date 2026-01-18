from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.qr import QRCode, QRCodeCreate, QRCodeStats, QRCodeDetailedStats
from app.services import qr as qr_service

router = APIRouter(prefix='/api', tags=['qr'])
redirect_router = APIRouter(tags=['qr'])


@router.post('/organizations/{organization_id}/qr-codes', response_model=QRCode, status_code=201)
async def create_qr_code(
    request: Request,
    organization_id: str,
    payload: QRCodeCreate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCode:
    return await run_in_threadpool(qr_service.create_qr_code, organization_id, current_user_id, payload)


@router.get('/organizations/{organization_id}/qr-codes', response_model=list[QRCode])
async def list_qr_codes(
    request: Request,
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[QRCode]:
    return await run_in_threadpool(qr_service.list_qr_codes, organization_id, current_user_id)


@router.get('/organizations/{organization_id}/qr-codes/{qr_code_id}/stats', response_model=QRCodeStats)
async def qr_code_stats(
    request: Request,
    organization_id: str,
    qr_code_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCodeStats:
    return await run_in_threadpool(qr_service.get_qr_stats, organization_id, qr_code_id, current_user_id)


@router.get('/organizations/{organization_id}/qr-codes/{qr_code_id}/detailed-stats', response_model=QRCodeDetailedStats)
async def qr_code_detailed_stats(
    request: Request,
    organization_id: str,
    qr_code_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCodeDetailedStats:
    """Get detailed QR code statistics including geo and UTM breakdowns."""
    return await run_in_threadpool(qr_service.get_qr_detailed_stats, organization_id, qr_code_id, current_user_id)


@redirect_router.get('/q/{code}')
async def qr_redirect(request: Request, code: str):
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get('user-agent')
    referer = request.headers.get('referer')
    raw_query = request.url.query or None
    target = await run_in_threadpool(
        qr_service.log_event_and_get_redirect,
        code,
        client_ip,
        user_agent,
        referer,
        raw_query,
    )
    return RedirectResponse(target, status_code=302)
