import logging

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection

logger = logging.getLogger(__name__)

ALLOWED_ADMIN_ROLES = ('platform_admin',)
ALLOWED_MODERATOR_ROLES = ('platform_admin', 'moderator')


def assert_platform_admin(user_id: str) -> None:
    """
    Assert that user has platform admin role.
    Checks both app_profiles.role (Auth V2) and platform_roles table (legacy).
    """
    try:
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Check app_profiles.role (Auth V2)
                cur.execute(
                    '''
                    SELECT 1 FROM app_profiles
                    WHERE id = %s AND role = 'admin'
                    ''',
                    (user_id,),
                )
                if cur.fetchone():
                    return  # User is admin in app_profiles

                # Check platform_roles table (legacy)
                cur.execute(
                    '''
                    SELECT 1 FROM platform_roles
                    WHERE user_id = %s AND role = ANY(%s)
                    ''',
                    (user_id, list(ALLOWED_ADMIN_ROLES)),
                )
                if cur.fetchone():
                    return  # User has platform role

                # No admin access found
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin access required')
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'[admin_guard] Error checking admin status for user {user_id}: {e}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Error checking admin permissions: {str(e)}'
        )


def assert_moderator(user_id: str) -> None:
    """
    Assert that user has moderator or admin role.
    Checks both app_profiles.role (Auth V2) and platform_roles table (legacy).
    """
    try:
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Check app_profiles.role (Auth V2) - admins and moderators
                cur.execute(
                    '''
                    SELECT 1 FROM app_profiles
                    WHERE id = %s AND role IN ('admin', 'moderator')
                    ''',
                    (user_id,),
                )
                if cur.fetchone():
                    return  # User is admin or moderator in app_profiles

                # Check platform_roles table (legacy)
                cur.execute(
                    '''
                    SELECT 1 FROM platform_roles
                    WHERE user_id = %s AND role = ANY(%s)
                    ''',
                    (user_id, list(ALLOWED_MODERATOR_ROLES)),
                )
                if cur.fetchone():
                    return  # User has moderator platform role

                # No moderator access found
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Moderator access required')
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'[admin_guard] Error checking moderator status for user {user_id}: {e}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Error checking moderator permissions: {str(e)}'
        )

