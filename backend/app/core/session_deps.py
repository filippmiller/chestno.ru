"""
Session-based authentication dependencies.
Uses httpOnly cookies instead of Bearer tokens.
"""
from fastapi import Cookie, HTTPException, Request, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services.sessions import get_session
from app.core.config import get_settings

settings = get_settings()
SESSION_COOKIE_NAME = settings.session_cookie_name


async def get_current_user_from_session(
    request: Request,
    session_id: str | None = Cookie(None, alias=SESSION_COOKIE_NAME),
) -> dict:
    """
    Get current user from session cookie.
    
    Args:
        request: FastAPI Request
        session_id: Session ID from cookie
        
    Returns:
        User dict with id, email, role from app_profiles
        
    Raises:
        HTTPException 401 if session invalid or expired
    """
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='No session cookie',
        )
    
    session = get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired session',
        )
    
    # Load user profile
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, email, role, display_name, avatar_url
                FROM public.app_profiles
                WHERE id = %s
                ''',
                (session['user_id'],)
            )
            user = cur.fetchone()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail='User profile not found',
                )
            
            return user


async def get_current_user_id_from_session(
    request: Request,
    session_id: str | None = Cookie(None, alias=SESSION_COOKIE_NAME),
) -> str:
    """
    Get current user ID from session cookie.

    Returns:
        User ID (UUID string)
    """
    user = await get_current_user_from_session(request, session_id)
    return str(user['id'])

