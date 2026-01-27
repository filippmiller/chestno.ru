from fastapi import APIRouter, Depends, Request, Query, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse, Response, StreamingResponse
import zipfile
import io

from app.core.session_deps import get_current_user_id_from_session
from app.core.config import get_settings
from app.schemas.qr import QRCode, QRCodeCreate, QRCodeStats, QRCodeDetailedStats, QRCodeTimeline, QRCustomizationSettings, QRCustomizationUpdate, QRBulkCreateRequest
from app.services import qr as qr_service
from app.services.qr_generator import generate_qr_image, generate_etag

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


@router.get('/organizations/{organization_id}/qr-codes/{qr_code_id}/timeline', response_model=QRCodeTimeline)
async def qr_code_timeline(
    request: Request,
    organization_id: str,
    qr_code_id: str,
    period: str = Query(default="7d", regex="^(7d|30d|90d|1y)$"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCodeTimeline:
    """
    Get timeline data for QR code scans aggregated by date.

    Returns time-series data showing scan counts per day over the specified period.
    Gaps in data (days with no scans) are filled with zero counts.

    Query Parameters:
    - period: Time period to analyze
        - 7d: Last 7 days (default)
        - 30d: Last 30 days
        - 90d: Last 90 days
        - 1y: Last 365 days

    Requires: analyst+ role
    """
    return await run_in_threadpool(qr_service.get_qr_timeline, organization_id, qr_code_id, current_user_id, period)


@router.get('/organizations/{organization_id}/qr-codes/{qr_code_id}/customization', response_model=QRCustomizationSettings | None)
async def get_qr_customization(
    request: Request,
    organization_id: str,
    qr_code_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCustomizationSettings | None:
    """
    Get customization settings for a QR code.
    Returns None if no customization exists (using defaults).
    """
    return await run_in_threadpool(qr_service.get_qr_customization, organization_id, qr_code_id, current_user_id)


@router.put('/organizations/{organization_id}/qr-codes/{qr_code_id}/customization', response_model=QRCustomizationSettings)
async def update_qr_customization(
    request: Request,
    organization_id: str,
    qr_code_id: str,
    payload: QRCustomizationUpdate,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> QRCustomizationSettings:
    """
    Create or update customization settings for a QR code.

    Validates:
    - Hex color format (#RRGGBB)
    - Logo size (10-30%)
    - Contrast ratio (minimum 3.0 for WCAG AA)

    Requires: manager+ role
    """
    return await run_in_threadpool(qr_service.update_qr_customization, organization_id, qr_code_id, current_user_id, payload)


@router.delete('/organizations/{organization_id}/qr-codes/{qr_code_id}/customization', status_code=204)
async def delete_qr_customization(
    request: Request,
    organization_id: str,
    qr_code_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Delete customization settings for a QR code (revert to defaults).

    Requires: manager+ role
    """
    await run_in_threadpool(qr_service.delete_qr_customization, organization_id, qr_code_id, current_user_id)
    return None


@router.post('/organizations/{organization_id}/qr-codes/bulk', response_model=list[QRCode], status_code=201)
async def bulk_create_qr_codes(
    request: Request,
    organization_id: str,
    payload: QRBulkCreateRequest,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> list[QRCode]:
    """
    Create multiple QR codes at once.

    Accepts a list of labels and creates QR codes for each.
    Maximum 50 QR codes per batch.
    Checks subscription quota for each QR code.

    Requires: manager+ role
    """
    return await run_in_threadpool(qr_service.bulk_create_qr_codes, organization_id, current_user_id, payload.labels)


@router.get('/organizations/{organization_id}/qr-codes/export')
async def export_qr_codes(
    request: Request,
    organization_id: str,
    qr_ids: str = Query(..., description="Comma-separated QR code IDs"),
    current_user_id: str = Depends(get_current_user_id_from_session),
):
    """
    Export multiple QR codes as a ZIP file containing PNG images.

    Query Parameters:
    - qr_ids: Comma-separated list of QR code UUIDs (max 100)

    Returns:
    - ZIP file with QR code images named by label

    Requires: viewer+ role
    """
    settings = get_settings()

    # Parse QR IDs
    qr_id_list = [qr_id.strip() for qr_id in qr_ids.split(',') if qr_id.strip()]

    if not qr_id_list:
        raise HTTPException(status_code=400, detail="No QR code IDs provided")

    if len(qr_id_list) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 QR codes per export")

    # Get QR codes (validates ownership)
    qr_codes = await run_in_threadpool(qr_service.get_multiple_qr_codes, organization_id, current_user_id, qr_id_list)

    # Create ZIP in memory
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for qr_code in qr_codes:
            # Build target URL
            target_url = f"{settings.frontend_base}/q/{qr_code.code}"

            # Generate QR image
            image_data = await run_in_threadpool(generate_qr_image, target_url, 'png', 500, 'M')

            # Create filename from label or code
            filename = (qr_code.label or qr_code.code).replace(' ', '-').replace('/', '-')
            filename = f"{filename}.png"

            # Add to ZIP
            zip_file.writestr(filename, image_data)

    # Rewind buffer
    zip_buffer.seek(0)

    # Return as streaming response
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=qr-codes-export.zip"
        }
    )


@router.get('/organizations/{organization_id}/qr-codes/{qr_code_id}/image')
async def generate_qr_code_image(
    request: Request,
    organization_id: str,
    qr_code_id: str,
    format: str = Query(default="png", regex="^(png|svg)$"),
    size: int = Query(default=300, ge=100, le=2000),
    error_correction: str = Query(default="M", regex="^(L|M|Q|H)$"),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> Response:
    """
    Generate QR code image for a tracked QR code.
    Returns PNG or SVG image with caching headers.

    Query Parameters:
    - format: "png" or "svg" (default: png)
    - size: Image size in pixels, 100-2000 (default: 300)
    - error_correction: "L", "M", "Q", or "H" (default: M)
        - L (Low - 7%): Smallest codes, minimal damage tolerance
        - M (Medium - 15%): Balanced size and reliability
        - Q (Quartile - 25%): High reliability, recommended for print
        - H (High - 30%): Maximum reliability, outdoor use
    """
    settings = get_settings()

    # Get QR code from database (validates access and org membership)
    qr_codes = await run_in_threadpool(qr_service.list_qr_codes, organization_id, current_user_id)
    qr_code = next((qr for qr in qr_codes if str(qr.id) == qr_code_id), None)

    if not qr_code:
        raise HTTPException(status_code=404, detail="QR-код не найден")

    # Build target URL
    target_url = f"{settings.frontend_base}/q/{qr_code.code}"

    # Generate ETag for caching
    etag = generate_etag(qr_code.code, format, size, error_correction)

    # Check If-None-Match header for cache validation
    if_none_match = request.headers.get("if-none-match")
    if if_none_match == etag:
        return Response(status_code=304)  # Not Modified

    # Generate QR image
    try:
        image_data = await run_in_threadpool(
            generate_qr_image, target_url, format, size, error_correction
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Determine content type
    content_type = "image/png" if format == "png" else "image/svg+xml; charset=utf-8"

    # Sanitize label for filename
    label_safe = qr_code.label.replace(" ", "-") if qr_code.label else qr_code.code
    filename = f"qr-{label_safe}.{format}"

    # Return image with caching headers
    return Response(
        content=image_data,
        media_type=content_type,
        headers={
            "ETag": etag,
            "Cache-Control": "public, max-age=86400",  # 24 hours
            "Content-Disposition": f'inline; filename="{filename}"',
        }
    )


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
