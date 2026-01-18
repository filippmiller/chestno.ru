from fastapi import APIRouter, Depends, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.analytics import QROverviewResponse
from app.services.analytics import get_qr_overview, export_qr_data

router = APIRouter(prefix='/api/analytics', tags=['analytics'])


@router.get('/organizations/{organization_id}/qr-overview', response_model=QROverviewResponse)
async def qr_overview(
    request: Request,
    organization_id: str,
    days: int = Query(default=30, ge=1, le=180),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QROverviewResponse:
    return await run_in_threadpool(get_qr_overview, organization_id, current_user_id, days)


@router.get('/organizations/{organization_id}/qr-export')
async def qr_export(
    request: Request,
    organization_id: str,
    days: int = Query(default=30, ge=1, le=180),
    format: str = Query(default='csv', regex='^(csv|json)$'),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Response:
    """
    Экспортирует данные QR-аналитики в CSV или JSON формате.
    """
    data = await run_in_threadpool(get_qr_overview, organization_id, current_user_id, days)
    exported = await run_in_threadpool(export_qr_data, data, format)

    if format == 'csv':
        return Response(
            content=exported,
            media_type='text/csv',
            headers={'Content-Disposition': f'attachment; filename="qr-analytics-{organization_id[:8]}.csv"'},
        )
    else:
        return Response(
            content=exported,
            media_type='application/json',
            headers={'Content-Disposition': f'attachment; filename="qr-analytics-{organization_id[:8]}.json"'},
        )
