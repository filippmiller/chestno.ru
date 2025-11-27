from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection

ALLOWED_ADMIN_ROLES = ('platform_owner', 'platform_admin')


def assert_platform_admin(user_id: str) -> None:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT 1 FROM platform_roles
                WHERE user_id = %s AND role = ANY(%s)
                ''',
                (user_id, list(ALLOWED_ADMIN_ROLES)),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin access required')

