"""
Business QR Code API Routes
Simple QR codes for business main pages.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse

from app.core.session_deps import get_current_user_id_from_session
from app.core.config import get_settings
from app.services.qr_business import get_business_public_url, get_business_qr_url_for_admin, log_qr_scan_event

settings = get_settings()

router = APIRouter(prefix='/api/organizations', tags=['qr-business'])
public_router = APIRouter(tags=['qr-business'])


@router.get('/{organization_id}/public-url')
async def get_public_url(
    request: Request,
    organization_id: str,
    current_user_id: str | None = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Get public URL for business organization (for QR code generation).

    Returns URL with QR source parameter: /org/{slug}?src=qr_business_main
    """
    try:
        return await run_in_threadpool(get_business_public_url, organization_id, current_user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to get public URL: {str(e)}')


@public_router.get('/qr/b/{slug}')
async def qr_business_redirect(
    request: Request,
    slug: str,
    user_id: str | None = Query(default=None),
):
    """
    Redirect endpoint for business QR codes.
    Logs scan event and redirects to public business page.

    URL format: /qr/b/{slug}
    Redirects to: /org/{slug}?src=qr_business_main
    """
    from app.core.db import get_connection
    from psycopg.rows import dict_row

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get('user-agent')

    # Get organization ID by slug
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id FROM organizations
                WHERE slug = %s AND public_visible = true
                ''',
                (slug,),
            )
            org = cur.fetchone()

            if not org:
                raise HTTPException(status_code=404, detail='Organization not found')

            organization_id = str(org['id'])

    # Log scan event
    try:
        await run_in_threadpool(
            log_qr_scan_event,
            organization_id,
            'business_main',
            client_ip,
            user_agent,
            user_id,
        )
    except Exception:
        # Logging failure shouldn't break redirect
        pass

    # Redirect to public page with QR source parameter
    redirect_url = f'{settings.frontend_base}/org/{slug}?src=qr_business_main'
    return RedirectResponse(redirect_url, status_code=302)


@router.get('/{organization_id}/public-url/admin')
async def admin_get_public_url(
    request: Request,
    organization_id: str,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Get public URL for any business (admin only).
    """
    try:
        return await run_in_threadpool(get_business_qr_url_for_admin, organization_id, current_user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to get public URL: {str(e)}')
