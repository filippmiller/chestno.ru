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
from app.schemas.auth import LoginRequest, SessionResponse, SignupRequest
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
        logger.info('Attempting Supabase password sign-in for %s', payload.email)
        try:
            auth_response = supabase_admin.password_sign_in(payload.email, payload.password)
            logger.info('Supabase password sign-in successful')
        except HTTPException as supabase_exc:
            logger.error('Supabase authentication failed: status=%d, detail=%s', 
                       supabase_exc.status_code, supabase_exc.detail)
            # Re-raise with proper error message
            auth_events.log_auth_event('login_failure', email=payload.email, request=request)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Неверный email или пароль',
            ) from supabase_exc
        
        # Extract user info
        supabase_user = auth_response.get('user') or {}
        user_id = supabase_user.get('id')
        refresh_token = auth_response.get('refresh_token')
        
        logger.info('Auth response: has_user=%s, has_refresh_token=%s', 
                   bool(supabase_user), bool(refresh_token))
        
        if not user_id or not refresh_token:
            logger.error('Missing user_id or refresh_token: user_id=%s, refresh_token=%s',
                        user_id, 'present' if refresh_token else 'missing')
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
        
    except HTTPException as http_exc:
        # If it's already an HTTPException from Supabase, log and re-raise
        logger.error('Login HTTPException: status=%d, detail=%s', 
                    http_exc.status_code, http_exc.detail)
        auth_events.log_auth_event('login_failure', email=payload.email, request=request)
        # If it's a 401 from Supabase, return our error message
        if http_exc.status_code == status.HTTP_401_UNAUTHORIZED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Неверный email или пароль',
            )
        raise
    except Exception as e:
        logger.error(f'Login failed with exception: {e}', exc_info=True)
        logger.error(f'Exception type: {type(e).__name__}')
        auth_events.log_auth_event('login_failure', email=payload.email, request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Неверный email или пароль',
        )


@router.post('/signup')
async def signup_v2(
    payload: SignupRequest,
    request: Request,
    response: Response,
) -> dict:
    """
    Signup with email/password.
    Creates user in Supabase, app_profiles, and session.
    """
    logger.info('Signup attempt for %s', payload.email)
    
    # Rate limiting check
    client_ip = auth_events.get_client_ip(request)
    is_blocked, retry_after = auth_events.check_rate_limit(email=payload.email, ip=client_ip)
    if is_blocked:
        auth_events.log_auth_event('registration', email=payload.email, request=request)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                'message': 'Слишком много попыток. Попробуйте позже.',
                'retry_after_seconds': retry_after,
            },
        )
    
    # Log registration attempt
    auth_events.log_auth_event('registration', email=payload.email, request=request)
    
    try:
        # Check if user already exists
        existing_user = None
        user_id = None
        try:
            existing_user = supabase_admin.get_user_by_email(payload.email)
            if existing_user:
                user_id = existing_user.get('id')
                # Check if user has a password set
                has_password = existing_user.get('encrypted_password') is not None
                logger.info('User already exists: %s, has_password=%s', payload.email, has_password)
                
                if has_password:
                    # User exists with password - they should login instead
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail='User already registered. Please login instead.',
                    )
                else:
                    # User exists but has no password (likely OAuth user) - set password
                    logger.info('User exists without password, setting password for: %s', payload.email)
                    user_metadata = existing_user.get('user_metadata', {})
                    if payload.full_name:
                        user_metadata['full_name'] = payload.full_name
                    
                    # Update user with password
                    update_response = supabase_admin._client.put(
                        f'{supabase_admin.base_auth_url}/admin/users/{user_id}',
                        headers=supabase_admin.admin_headers,
                        json={
                            'password': payload.password,
                            'user_metadata': user_metadata,
                        }
                    )
                    supabase_admin._raise_for_status(update_response)
                    logger.info('Password set for existing user: %s', user_id)
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            # If get_user_by_email fails for other reasons, continue with signup
            logger.info('Could not check existing user, proceeding with signup: %s', e)
        
        # Create new user if doesn't exist
        if not user_id:
            logger.info('Creating new Supabase user for %s', payload.email)
            user_metadata = {}
            if payload.full_name:
                user_metadata['full_name'] = payload.full_name
            
            supabase_user = supabase_admin.create_user(
                email=payload.email,
                password=payload.password,
                user_metadata=user_metadata,
            )
            
            user_id = supabase_user.get('id')
            if not user_id:
                logger.error('Failed to create user: no user_id returned')
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail='Failed to create user',
                )
            
            logger.info('Supabase user created: %s', user_id)
        
        # Ensure app_profiles exists
        profile = app_profiles.ensure_app_profile(
            user_id=user_id,
            email=payload.email,
            display_name=payload.full_name,
        )
        
        # Sign in the user immediately after signup
        logger.info('Signing in newly created/updated user...')
        try:
            auth_response = supabase_admin.password_sign_in(payload.email, payload.password)
            refresh_token = auth_response.get('refresh_token')
            
            if not refresh_token:
                logger.error('Failed to sign in after signup: no refresh_token')
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail='Failed to sign in after registration',
                )
        except HTTPException as signin_exc:
            # If password was just set, it might take a moment to propagate
            # Try once more after a brief delay
            logger.warning('First sign-in attempt failed, retrying after password update...')
            import time
            time.sleep(0.5)  # Brief delay for password propagation
            
            try:
                auth_response = supabase_admin.password_sign_in(payload.email, payload.password)
                refresh_token = auth_response.get('refresh_token')
                
                if not refresh_token:
                    logger.error('Failed to sign in after retry: no refresh_token')
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail='Failed to sign in after registration. Please try logging in manually.',
                    )
            except Exception as retry_exc:
                logger.error('Sign-in retry also failed: %s', retry_exc)
                # If user was updated (password set), tell them to login manually
                if existing_user and not has_password:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail='Password was set successfully. Please login with your email and password.',
                    )
                raise
        
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
        raise
    except Exception as e:
        logger.error(f'Signup failed with exception: {e}', exc_info=True)
        logger.error(f'Exception type: {type(e).__name__}')
        auth_events.log_auth_event('login_failure', email=payload.email, request=request)
        
        # Parse common Supabase errors
        error_str = str(e)
        if 'already registered' in error_str or 'already exists' in error_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='User already registered',
            )
        elif 'Password should be at least' in error_str or 'password' in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Password should be at least 6 characters',
            )
        elif 'Invalid email' in error_str or 'email' in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Invalid email format',
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f'Registration failed: {error_str}',
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

