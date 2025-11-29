"""
Social Login Routes V2 - Cookie-based sessions
Handles Yandex OAuth with cookie-based sessions.
"""
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse

from app.core.config import get_settings
from app.services import app_profiles
from app.services import auth_events
from app.services.sessions import SESSION_COOKIE_NAME, create_session
from app.services.session_data import get_session_data_v2
from app.services.social_login import handle_yandex_callback, start_yandex_login
from app.core.supabase import supabase_admin
from fastapi.concurrency import run_in_threadpool

router = APIRouter(prefix='/api/auth/v2', tags=['auth-v2'])
settings = get_settings()

SESSION_MAX_AGE = settings.session_max_age


@router.get('/yandex/start')
async def yandex_start_v2(redirect_to: str | None = Query(default=None)):
    """Start Yandex OAuth flow."""
    url = start_yandex_login(redirect_to)
    return JSONResponse({'redirect_url': url})


@router.get('/yandex/callback')
async def yandex_callback_v2(
    code: str,
    state: str,
    request: Request,
    response: Response,
):
    """
    Handle Yandex OAuth callback.
    Creates cookie-based session.
    """
    try:
        # Get Supabase session from Yandex callback
        session, redirect_to = handle_yandex_callback(code, state)
        access_token = session.get('access_token')
        refresh_token = session.get('refresh_token')
        
        # Get user from Supabase using access token
        supabase_user = supabase_admin.get_user_by_access_token(access_token)
        user_id = supabase_user.get('id')
        email = supabase_user.get('email')
        
        if not user_id or not email or not refresh_token:
            raise HTTPException(status_code=500, detail='Supabase session missing required data')
        
        # Ensure app_profiles exists
        display_name = supabase_user.get('user_metadata', {}).get('full_name') or supabase_user.get('user_metadata', {}).get('name')
        profile = app_profiles.ensure_app_profile(
            user_id=user_id,
            email=email,
            display_name=display_name,
        )
        
        # Create backend session
        session_id = create_session(user_id, refresh_token)
        
        # Set httpOnly cookie
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_id,
            max_age=SESSION_MAX_AGE,
            httponly=True,
            secure=settings.environment == 'production',
            samesite='lax',
            path='/',
        )
        
        # Log success
        auth_events.log_auth_event(
            'login_success',
            email=email,
            user_id=user_id,
            request=request,
        )
        
        # Redirect to frontend callback page with success
        params = urlencode({
            'provider': 'yandex',
            'success': 'true',
        })
        separator = '&' if '?' in redirect_to else '?'
        return RedirectResponse(f'{redirect_to}{separator}{params}')
        
    except Exception as e:
        # Redirect to frontend with error
        redirect_to = f"{settings.frontend_base}/auth/callback?provider=yandex&error={str(e)}"
        return RedirectResponse(redirect_to)

