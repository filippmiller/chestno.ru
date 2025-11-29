"""
New Auth API v2 - Cookie-based sessions
Implements secure cookie-based authentication with 24-hour sessions.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.supabase import supabase_admin
from app.core.session_deps import get_current_user_from_session
from app.schemas.auth import LoginRequest, SessionResponse
from app.services import app_profiles
from app.services import auth_events
from app.services.sessions import SESSION_COOKIE_NAME, create_session, delete_session
from app.services.session_data import get_session_data_v2

router = APIRouter(prefix='/api/auth/v2', tags=['auth-v2'])
logger = logging.getLogger(__name__)
settings = get_settings()

# Cookie settings
SESSION_MAX_AGE = settings.session_max_age


def get_role_based_redirect_url(role: str) -> str:
    """Get redirect URL based on user role."""
    if role == 'admin':
        return '/admin/dashboard'
    elif role == 'business_owner':
        return '/dashboard'
    else:
        return '/dashboard'


@router.post('/login')
async def login_v2(
    payload: LoginRequest,
    request: Request,
    response: Response,
) -> dict:
    """
    Login with email/password.
    Creates cookie-based session.
    """
    logger.info('Login attempt for %s', payload.email)
    
    # Rate limiting check
    client_ip = auth_events.get_client_ip(request)
    is_blocked, retry_after = auth_events.check_rate_limit(email=payload.email, ip=client_ip)
    if is_blocked:
        auth_events.log_auth_event('login_attempt', email=payload.email, request=request)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                'message': 'Слишком много попыток. Попробуйте позже.',
                'retry_after_seconds': retry_after,
            },
        )
    
    # Log login attempt
    auth_events.log_auth_event('login_attempt', email=payload.email, request=request)
    
    try:
        # Authenticate with Supabase
        auth_response = supabase_admin.password_sign_in(payload.email, payload.password)
        
        # Extract user info
        supabase_user = auth_response.get('user') or {}
        user_id = supabase_user.get('id')
        refresh_token = auth_response.get('refresh_token')
        
        if not user_id or not refresh_token:
            auth_events.log_auth_event('login_failure', email=payload.email, request=request)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='Authentication failed',
            )
        
        # Ensure app_profiles exists
        display_name = supabase_user.get('user_metadata', {}).get('full_name') or supabase_user.get('user_metadata', {}).get('name')
        profile = app_profiles.ensure_app_profile(
            user_id=user_id,
            email=payload.email,
            display_name=display_name,
        )
        
        # Create session
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
            email=payload.email,
            user_id=user_id,
            request=request,
        )
        
        # Get session data
        session_data = await run_in_threadpool(get_session_data_v2, user_id)
        
        return {
            'success': True,
            'user': session_data.user,
            'role': profile['role'],
            'redirect_url': get_role_based_redirect_url(profile['role']),
        }
        
    except HTTPException:
        auth_events.log_auth_event('login_failure', email=payload.email, request=request)
        raise
    except Exception as e:
        logger.error(f'Login failed: {e}', exc_info=True)
        auth_events.log_auth_event('login_failure', email=payload.email, request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Неверный email или пароль',
        )


@router.post('/oauth-callback')
async def oauth_callback_v2(
    request: Request,
    response: Response,
    authorization: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
) -> dict:
    """
    Handle OAuth callback (Google/Yandex).
    Creates cookie-based session from Supabase token.
    """
    token = authorization.credentials
    
    try:
        # Verify token and get user from Supabase
        supabase_user = supabase_admin.get_user_by_access_token(token)
        user_id = supabase_user.get('id')
        email = supabase_user.get('email')
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Invalid token',
            )
        
        # Ensure app_profiles exists
        display_name = supabase_user.get('user_metadata', {}).get('full_name') or supabase_user.get('user_metadata', {}).get('name')
        profile = app_profiles.ensure_app_profile(
            user_id=user_id,
            email=email,
            display_name=display_name,
        )
        
        # For OAuth, use access_token as temporary refresh token identifier
        refresh_token = f'oauth_refresh_{user_id}_{token[:20]}'
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
        
        # Get session data
        session_data = await run_in_threadpool(get_session_data_v2, user_id)
        
        return {
            'success': True,
            'user': session_data.user,
            'role': profile['role'],
            'redirect_url': get_role_based_redirect_url(profile['role']),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'OAuth callback failed: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='OAuth authentication failed',
        )


@router.post('/logout')
async def logout_v2(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user_from_session),
) -> dict:
    """Logout and clear session cookie."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    
    if session_id:
        delete_session(session_id)
    
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path='/',
        samesite='lax',
    )
    
    return {'success': True, 'message': 'Logged out'}


@router.get('/me')
async def get_me_v2(
    current_user: dict = Depends(get_current_user_from_session),
) -> SessionResponse:
    """Get current user session data."""
    user_id = current_user['id']
    session_data = await run_in_threadpool(get_session_data_v2, user_id)
    return session_data


@router.get('/session')
async def get_session_v2(
    current_user: dict = Depends(get_current_user_from_session),
) -> dict:
    """Get current session info."""
    return {
        'user': {
            'id': current_user['id'],
            'email': current_user['email'],
            'role': current_user['role'],
            'display_name': current_user.get('display_name'),
        },
    }

