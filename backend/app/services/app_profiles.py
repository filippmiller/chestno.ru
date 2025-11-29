"""
App Profiles Service
Handles app_profiles table operations.
"""
from uuid import UUID
from typing import Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection


def ensure_app_profile(user_id: str, email: str, display_name: Optional[str] = None) -> dict:
    """
    Ensure app_profiles row exists for a user.
    Creates it if missing, updates email if changed.
    
    Args:
        user_id: User UUID from auth.users
        email: User email
        display_name: Optional display name
        
    Returns:
        Profile dict
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check if profile exists
            cur.execute(
                'SELECT id, email, role, display_name FROM public.app_profiles WHERE id = %s',
                (user_id,)
            )
            profile = cur.fetchone()
            
            if profile:
                # Update email if changed
                if profile['email'] != email:
                    cur.execute(
                        'UPDATE public.app_profiles SET email = %s, updated_at = now() WHERE id = %s',
                        (email, user_id)
                    )
                    conn.commit()
                    profile['email'] = email
                
                # Update display_name if provided and different
                if display_name and profile['display_name'] != display_name:
                    cur.execute(
                        'UPDATE public.app_profiles SET display_name = %s, updated_at = now() WHERE id = %s',
                        (display_name, user_id)
                    )
                    conn.commit()
                    profile['display_name'] = display_name
                
                return dict(profile)
            else:
                # Create new profile with default role 'user'
                cur.execute(
                    '''
                    INSERT INTO public.app_profiles (id, email, role, display_name)
                    VALUES (%s, %s, 'user', %s)
                    RETURNING id, email, role, display_name, avatar_url
                    ''',
                    (user_id, email, display_name)
                )
                conn.commit()
                return dict(cur.fetchone())


def get_profile_by_id(user_id: str) -> Optional[dict]:
    """Get profile by user ID."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT id, email, role, display_name, avatar_url FROM public.app_profiles WHERE id = %s',
                (user_id,)
            )
            profile = cur.fetchone()
            return dict(profile) if profile else None


def update_profile_role(user_id: str, role: str) -> None:
    """
    Update user role (admin only operation).
    
    Args:
        user_id: User UUID
        role: New role ('admin', 'business_owner', 'user')
    """
    if role not in ('admin', 'business_owner', 'user'):
        raise ValueError(f'Invalid role: {role}')
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE public.app_profiles SET role = %s, updated_at = now() WHERE id = %s',
                (role, user_id)
            )
            conn.commit()

