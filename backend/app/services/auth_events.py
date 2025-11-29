"""
Auth Events Service
Logs authentication events for rate limiting and audit.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request
from psycopg.rows import dict_row

from app.core.db import get_connection

EVENT_TYPES = {
    'login_attempt': 'login_attempt',
    'login_success': 'login_success',
    'login_failure': 'login_failure',
    'registration': 'registration',
    'password_reset': 'password_reset',
}


def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    # Check for forwarded IP (Railway/proxy)
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    
    # Check for real IP header
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip
    
    # Fallback to direct client
    if request.client:
        return request.client.host
    
    return 'unknown'


def get_user_agent(request: Request) -> str:
    """Extract user agent from request."""
    return request.headers.get('User-Agent', 'unknown')


def log_auth_event(
    event_type: str,
    email: Optional[str] = None,
    user_id: Optional[str] = None,
    request: Optional[Request] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """
    Log an authentication event.
    
    Args:
        event_type: One of EVENT_TYPES
        email: User email (if available)
        user_id: User ID (if authenticated)
        request: FastAPI Request object (for IP/UA extraction)
        ip: Override IP (if request not available)
        user_agent: Override UA (if request not available)
    """
    if event_type not in EVENT_TYPES.values():
        raise ValueError(f'Invalid event_type: {event_type}')
    
    if request:
        ip = ip or get_client_ip(request)
        user_agent = user_agent or get_user_agent(request)
    else:
        ip = ip or 'unknown'
        user_agent = user_agent or 'unknown'
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO public.auth_events (user_id, event_type, email, ip, user_agent)
                VALUES (%s, %s, %s, %s, %s)
                ''',
                (user_id, event_type, email, ip, user_agent)
            )
            conn.commit()


def check_rate_limit(email: Optional[str] = None, ip: Optional[str] = None) -> tuple[bool, Optional[int]]:
    """
    Check if rate limit is exceeded.
    
    Args:
        email: User email
        ip: Client IP
        
    Returns:
        (is_blocked, retry_after_seconds)
        is_blocked: True if rate limit exceeded
        retry_after_seconds: Seconds to wait before retry (if blocked)
    """
    now = datetime.now(timezone.utc)
    minute_ago = now - timedelta(minutes=1)
    hour_ago = now - timedelta(hours=1)
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Per-email limits: 5 per minute, 20 per hour
            if email:
                cur.execute(
                    '''
                    SELECT COUNT(*) as count
                    FROM public.auth_events
                    WHERE email = %s 
                      AND event_type IN ('login_attempt', 'login_failure')
                      AND created_at > %s
                    ''',
                    (email, minute_ago)
                )
                minute_count = cur.fetchone()[0]
                
                if minute_count >= 5:
                    return True, 60  # Wait 1 minute
                
                cur.execute(
                    '''
                    SELECT COUNT(*) as count
                    FROM public.auth_events
                    WHERE email = %s 
                      AND event_type IN ('login_attempt', 'login_failure')
                      AND created_at > %s
                    ''',
                    (email, hour_ago)
                )
                hour_count = cur.fetchone()[0]
                
                if hour_count >= 20:
                    return True, 3600  # Wait 1 hour
            
            # Per-IP limits: 10 per minute
            if ip:
                cur.execute(
                    '''
                    SELECT COUNT(*) as count
                    FROM public.auth_events
                    WHERE ip = %s 
                      AND event_type IN ('login_attempt', 'login_failure')
                      AND created_at > %s
                    ''',
                    (ip, minute_ago)
                )
                minute_count = cur.fetchone()[0]
                
                if minute_count >= 10:
                    return True, 60  # Wait 1 minute
    
    return False, None

