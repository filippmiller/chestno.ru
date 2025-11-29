"""
Authentication API routes.

This module provides minimal backend auth endpoints.
Primary authentication is handled by Supabase on the frontend.
Backend only validates tokens and provides application data.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.concurrency import run_in_threadpool
from jose import jwt

from app.core.auth_deps import get_current_user_id
from app.core.config import get_settings
from app.schemas.auth import SessionResponse
from app.services.accounts import get_session_data

router = APIRouter(prefix='/api/auth', tags=['auth'])
logger = logging.getLogger(__name__)
security = HTTPBearer()


@router.get('/debug-token')
async def debug_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Debug endpoint to check why JWT validation is failing.
    """
    token = credentials.credentials
    settings = get_settings()
    
    results = {
        "token_snippet": token[:10] + "...",
        "settings_jwt_secret_len": len(settings.supabase_jwt_secret),
        "settings_service_role_key_len": len(settings.supabase_service_role_key),
        "attempts": []
    }
    
    # Attempt 1: Using configured JWT Secret
    try:
        jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
        results["attempts"].append({"key": "supabase_jwt_secret", "success": True})
    except Exception as e:
        results["attempts"].append({"key": "supabase_jwt_secret", "success": False, "error": str(e)})
        
    # Attempt 2: Using Service Role Key
    try:
        jwt.decode(token, settings.supabase_service_role_key, algorithms=["HS256"], audience="authenticated")
        results["attempts"].append({"key": "supabase_service_role_key", "success": True})
    except Exception as e:
        results["attempts"].append({"key": "supabase_service_role_key", "success": False, "error": str(e)})

    return results


@router.get('/me', response_model=SessionResponse)
async def get_me(user_id: str = Depends(get_current_user_id)) -> SessionResponse:
    """
    Get current authenticated user's application data.
    
    This endpoint requires a valid Supabase JWT in the Authorization header.
    It returns the user's AppUser profile, organizations, memberships, and platform roles.
    
    If the user doesn't exist in app_users table yet (e.g., first login after OAuth),
    it will be created automatically.
    
    Args:
        user_id: Extracted from JWT by get_current_user_id dependency
        
    Returns:
        SessionResponse containing user data
        
    Raises:
        HTTPException: 401 if token invalid, 500 if database error
    """
    logger.info(f'Fetching session data for user_id: {user_id}')
    
    try:
        session = await run_in_threadpool(get_session_data, user_id)
        logger.info(f'Successfully retrieved session for user: {session.user.email}')
        return session
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404 if user doesn't exist)
        raise
        
    except Exception as e:
        logger.error(f'Error fetching session data for user {user_id}: {e}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to fetch user data'
        )
