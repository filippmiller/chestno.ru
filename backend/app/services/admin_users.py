"""
Admin Users Service
Handles user management for platform admins.
"""
from typing import Optional
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services.admin_guard import assert_platform_admin


def list_all_users(
    user_id: str,
    email_search: Optional[str] = None,
    role_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    List all users (admin only).
    
    Args:
        user_id: Admin user ID
        email_search: Optional email search string
        role_filter: Optional role filter ('admin', 'business_owner', 'user')
        limit: Max number of users to return
        offset: Pagination offset
        
    Returns:
        Tuple of (users list, total count)
    """
    assert_platform_admin(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Build count query
            count_query = '''
                SELECT COUNT(*) as total
                FROM app_profiles
                WHERE 1=1
            '''
            count_params = []
            
            if email_search:
                count_query += ' AND email ILIKE %s'
                count_params.append(f'%{email_search}%')
            
            if role_filter:
                count_query += ' AND role = %s'
                count_params.append(role_filter)
            
            cur.execute(count_query, count_params)
            total = cur.fetchone()['total']
            
            # Build main query
            query = '''
                SELECT id, email, role, display_name, avatar_url, created_at, updated_at
                FROM app_profiles
                WHERE 1=1
            '''
            params = []
            
            if email_search:
                query += ' AND email ILIKE %s'
                params.append(f'%{email_search}%')
            
            if role_filter:
                query += ' AND role = %s'
                params.append(role_filter)
            
            query += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
            params.extend([limit, offset])
            
            cur.execute(query, params)
            rows = cur.fetchall()
            
            users = []
            for row in rows:
                # Get platform roles from legacy table
                cur.execute('SELECT role FROM platform_roles WHERE user_id = %s', (row['id'],))
                platform_roles = [r['role'] for r in cur.fetchall()]
                
                users.append({
                    'id': str(row['id']),
                    'email': row['email'],
                    'role': row['role'],
                    'display_name': row.get('display_name'),
                    'avatar_url': row.get('avatar_url'),
                    'platform_roles': platform_roles,
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                    'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
                })
            
            return users, total


def update_user_role(
    target_user_id: str,
    admin_user_id: str,
    new_role: str,
) -> dict:
    """
    Update user role (admin only).
    
    Args:
        target_user_id: User ID to update
        admin_user_id: Admin user ID performing the action
        new_role: New role ('admin', 'business_owner', 'user')
        
    Returns:
        Updated user dict
    """
    assert_platform_admin(admin_user_id)
    
    if new_role not in ('admin', 'business_owner', 'user'):
        raise ValueError(f'Invalid role: {new_role}')
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Update role
            cur.execute(
                '''
                UPDATE app_profiles
                SET role = %s, updated_at = now()
                WHERE id = %s
                RETURNING id, email, role, display_name, avatar_url, created_at, updated_at
                ''',
                (new_role, target_user_id),
            )
            row = cur.fetchone()
            
            if not row:
                raise ValueError('User not found')
            
            # Get platform roles
            cur.execute('SELECT role FROM platform_roles WHERE user_id = %s', (target_user_id,))
            platform_roles = [r['role'] for r in cur.fetchall()]
            
            conn.commit()
            
            return {
                'id': str(row['id']),
                'email': row['email'],
                'role': row['role'],
                'display_name': row.get('display_name'),
                'avatar_url': row.get('avatar_url'),
                'platform_roles': platform_roles,
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
            }


def block_user(
    target_user_id: str,
    admin_user_id: str,
    blocked: bool,
) -> dict:
    """
    Block/unblock user (admin only).
    
    Note: This is a placeholder - actual blocking logic depends on your requirements.
    You might want to add a 'blocked' column to app_profiles or use a separate table.
    
    Args:
        target_user_id: User ID to block/unblock
        admin_user_id: Admin user ID performing the action
        blocked: True to block, False to unblock
        
    Returns:
        Updated user dict
    """
    assert_platform_admin(admin_user_id)
    
    # TODO: Implement actual blocking logic
    # For now, we'll just return the user info
    # You might want to add a 'blocked' column or use a separate 'blocked_users' table
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, email, role, display_name, avatar_url, created_at, updated_at
                FROM app_profiles
                WHERE id = %s
                ''',
                (target_user_id,),
            )
            row = cur.fetchone()
            
            if not row:
                raise ValueError('User not found')
            
            # Get platform roles
            cur.execute('SELECT role FROM platform_roles WHERE user_id = %s', (target_user_id,))
            platform_roles = [r['role'] for r in cur.fetchall()]
            
            return {
                'id': str(row['id']),
                'email': row['email'],
                'role': row['role'],
                'display_name': row.get('display_name'),
                'avatar_url': row.get('avatar_url'),
                'platform_roles': platform_roles,
                'blocked': blocked,  # Placeholder
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
            }


