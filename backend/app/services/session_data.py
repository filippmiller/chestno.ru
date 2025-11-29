"""
Session Data Service
Fetches user session data for app_profiles-based auth.
"""
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.schemas.auth import SessionResponse


def get_session_data_v2(user_id: str) -> SessionResponse:
    """
    Get session data for user (using app_profiles).
    
    Args:
        user_id: User UUID from app_profiles
        
    Returns:
        SessionResponse with user, organizations, memberships, platform_roles
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get user profile from app_profiles
            cur.execute(
                '''
                SELECT id, email, role, display_name, avatar_url
                FROM public.app_profiles
                WHERE id = %s
                ''',
                (user_id,)
            )
            profile = cur.fetchone()
            
            if not profile:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='User profile not found',
                )
            
            # Convert UUID to string
            user_row = {k: str(v) if isinstance(v, UUID) else v for k, v in profile.items()}
            # Map app_profiles fields to AppUser format
            user_row['full_name'] = user_row.get('display_name')
            user_row['locale'] = 'ru'  # Default locale
            
            # Get organizations
            cur.execute(
                '''
                SELECT o.id, o.name, o.slug, o.city, o.country, o.website_url, o.verification_status, o.phone
                FROM public.organizations o
                INNER JOIN public.organization_members om ON om.organization_id = o.id
                WHERE om.user_id = %s
                ''',
                (user_id,)
            )
            organizations = cur.fetchall()
            organizations = [{k: str(v) if isinstance(v, UUID) else v for k, v in org.items()} for org in organizations]
            
            # Get memberships
            cur.execute(
                'SELECT * FROM public.organization_members WHERE user_id = %s',
                (user_id,)
            )
            memberships = cur.fetchall()
            memberships = [{k: str(v) if isinstance(v, UUID) else v for k, v in mem.items()} for mem in memberships]
            
            # Get platform roles (convert app_profiles.role to platform_roles format)
            platform_roles = []
            if profile['role'] == 'admin':
                platform_roles.append('platform_admin')
            elif profile['role'] == 'business_owner':
                # Business owners don't have platform roles, but we can add custom logic
                pass
            
            # Also check legacy platform_roles table for backward compatibility
            cur.execute('SELECT role FROM public.platform_roles WHERE user_id = %s', (user_id,))
            legacy_roles = cur.fetchall()
            for row in legacy_roles:
                if row['role'] not in platform_roles:
                    platform_roles.append(row['role'])
            
            return SessionResponse(
                user=user_row,
                organizations=organizations,
                memberships=memberships,
                platform_roles=platform_roles,
            )

