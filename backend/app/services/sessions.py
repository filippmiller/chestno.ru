"""
Session Management Service
Handles cookie-based sessions with 24-hour expiry.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.core.config import get_settings

settings = get_settings()

# Session cookie name
SESSION_COOKIE_NAME = getattr(settings, 'session_cookie_name', 'session_id')
SESSION_EXPIRY_HOURS = 24


def hash_refresh_token(refresh_token: str) -> str:
    """Hash refresh token for storage."""
    return hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()


def create_session(user_id: str, refresh_token: str) -> str:
    """
    Create a new session for a user.
    
    Args:
        user_id: User UUID from app_profiles
        refresh_token: Supabase refresh token
        
    Returns:
        Session ID (to be stored in cookie)
    """
    session_id = secrets.token_urlsafe(32)
    refresh_token_hash = hash_refresh_token(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO public.sessions (id, user_id, refresh_token_hash, expires_at)
                VALUES (%s, %s, %s, %s)
                ''',
                (session_id, user_id, refresh_token_hash, expires_at)
            )
            conn.commit()
    
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """
    Get session by session ID.
    
    Args:
        session_id: Session ID from cookie
        
    Returns:
        Session dict with user_id, expires_at, etc. or None if not found/expired
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, user_id, refresh_token_hash, expires_at, created_at, last_used_at
                FROM public.sessions
                WHERE id = %s AND expires_at > now()
                ''',
                (session_id,)
            )
            session = cur.fetchone()
            
            if session:
                # Update last_used_at
                cur.execute(
                    'UPDATE public.sessions SET last_used_at = now() WHERE id = %s',
                    (session_id,)
                )
                conn.commit()
            
            return session


def delete_session(session_id: str) -> None:
    """Delete a session."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM public.sessions WHERE id = %s', (session_id,))
            conn.commit()


def delete_user_sessions(user_id: str) -> None:
    """Delete all sessions for a user (e.g., on logout or password change)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM public.sessions WHERE user_id = %s', (user_id,))
            conn.commit()


def cleanup_expired_sessions() -> int:
    """Delete expired sessions. Returns count of deleted sessions."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM public.sessions WHERE expires_at < now()')
            deleted_count = cur.rowcount
            conn.commit()
            return deleted_count


def verify_session_refresh_token(session_id: str, refresh_token: str) -> bool:
    """
    Verify that the refresh token matches the session.
    
    Args:
        session_id: Session ID from cookie
        refresh_token: Refresh token from Supabase
        
    Returns:
        True if token matches, False otherwise
    """
    refresh_token_hash = hash_refresh_token(refresh_token)
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                SELECT 1 FROM public.sessions
                WHERE id = %s AND refresh_token_hash = %s AND expires_at > now()
                ''',
                (session_id, refresh_token_hash)
            )
            return cur.fetchone() is not None

