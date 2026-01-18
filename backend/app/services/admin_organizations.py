"""
Admin Organizations Service
Handles organization management for platform admins.
"""
from typing import Optional
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services.admin_guard import assert_platform_admin


def list_all_organizations(
    user_id: str,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    city_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    List all organizations (admin only).
    
    Args:
        user_id: Admin user ID
        search: Optional search string (searches name, slug, email)
        status_filter: Optional filter by verification_status
        city_filter: Optional filter by city
        category_filter: Optional filter by category
        limit: Max number of organizations to return
        offset: Pagination offset
        
    Returns:
        Tuple of (organizations list, total count)
    """
    assert_platform_admin(user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Build count query
            count_query = '''
                SELECT COUNT(*) as total
                FROM organizations o
                LEFT JOIN organization_profiles p ON p.organization_id = o.id
                WHERE 1=1
            '''
            count_params = []
            
            if search:
                count_query += ' AND (o.name ILIKE %s OR o.slug ILIKE %s OR p.contact_email ILIKE %s)'
                search_pattern = f'%{search}%'
                count_params.extend([search_pattern, search_pattern, search_pattern])
            
            if status_filter:
                count_query += ' AND o.verification_status = %s'
                count_params.append(status_filter)
            
            if city_filter:
                count_query += ' AND o.city ILIKE %s'
                count_params.append(f'%{city_filter}%')
            
            if category_filter:
                count_query += ' AND p.category = %s'
                count_params.append(category_filter)
            
            cur.execute(count_query, count_params)
            total = cur.fetchone()['total']
            
            # Build main query
            query = '''
                SELECT 
                    o.id, o.name, o.slug, o.country, o.city, o.website_url, o.phone,
                    o.verification_status, o.is_verified, o.public_visible,
                    o.verification_comment, o.created_at, o.updated_at,
                    p.category, p.short_description
                FROM organizations o
                LEFT JOIN organization_profiles p ON p.organization_id = o.id
                WHERE 1=1
            '''
            params = []
            
            if search:
                query += ' AND (o.name ILIKE %s OR o.slug ILIKE %s OR p.contact_email ILIKE %s)'
                search_pattern = f'%{search}%'
                params.extend([search_pattern, search_pattern, search_pattern])
            
            if status_filter:
                query += ' AND o.verification_status = %s'
                params.append(status_filter)
            
            if city_filter:
                query += ' AND o.city ILIKE %s'
                params.append(f'%{city_filter}%')
            
            if category_filter:
                query += ' AND p.category = %s'
                params.append(category_filter)
            
            query += ' ORDER BY o.created_at DESC LIMIT %s OFFSET %s'
            params.extend([limit, offset])
            
            cur.execute(query, params)
            rows = cur.fetchall()
            
            organizations = []
            for row in rows:
                organizations.append({
                    'id': str(row['id']),
                    'name': row['name'],
                    'slug': row.get('slug'),
                    'country': row.get('country'),
                    'city': row.get('city'),
                    'website_url': row.get('website_url'),
                    'phone': row.get('phone'),
                    'verification_status': row.get('verification_status'),
                    'is_verified': row.get('is_verified', False),
                    'public_visible': row.get('public_visible', False),
                    'verification_comment': row.get('verification_comment'),
                    'category': row.get('category'),
                    'short_description': row.get('short_description'),
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                    'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
                })
            
            return organizations, total


def update_organization_status(
    organization_id: str,
    admin_user_id: str,
    verification_status: Optional[str] = None,
    verification_comment: Optional[str] = None,
    public_visible: Optional[bool] = None,
) -> dict:
    """
    Update organization verification status and visibility (admin only).
    
    Args:
        organization_id: Organization ID
        admin_user_id: Admin user ID
        verification_status: New status ('pending', 'verified', 'rejected')
        verification_comment: Optional comment
        public_visible: Optional public visibility flag
        
    Returns:
        Updated organization dict
    """
    assert_platform_admin(admin_user_id)
    
    if verification_status and verification_status not in ('pending', 'verified', 'rejected'):
        raise ValueError(f'Invalid verification_status: {verification_status}')
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Build update query dynamically
            update_fields = ['updated_at = now()']
            update_params = []
            
            if verification_status is not None:
                update_fields.append('verification_status = %s')
                update_fields.append('is_verified = %s')
                update_params.extend([verification_status, verification_status == 'verified'])
            
            if verification_comment is not None:
                update_fields.append('verification_comment = %s')
                update_params.append(verification_comment)
            
            if public_visible is not None:
                update_fields.append('public_visible = %s')
                update_params.append(public_visible)
            
            update_params.append(organization_id)
            
            query = f'''
                UPDATE organizations
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id, name, slug, country, city, website_url, phone,
                          verification_status, is_verified, public_visible,
                          verification_comment, created_at, updated_at
            '''
            
            cur.execute(query, update_params)
            row = cur.fetchone()
            
            if not row:
                raise ValueError('Organization not found')
            
            conn.commit()
            
            return {
                'id': str(row['id']),
                'name': row['name'],
                'slug': row.get('slug'),
                'country': row.get('country'),
                'city': row.get('city'),
                'website_url': row.get('website_url'),
                'phone': row.get('phone'),
                'verification_status': row.get('verification_status'),
                'is_verified': row.get('is_verified', False),
                'public_visible': row.get('public_visible', False),
                'verification_comment': row.get('verification_comment'),
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
            }


def block_organization(
    organization_id: str,
    admin_user_id: str,
    blocked: bool,
) -> dict:
    """
    Block/unblock organization (admin only).
    Blocking sets public_visible = false.
    
    Args:
        organization_id: Organization ID
        admin_user_id: Admin user ID
        blocked: True to block, False to unblock
        
    Returns:
        Updated organization dict
    """
    assert_platform_admin(admin_user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get current status
            cur.execute('SELECT verification_status FROM organizations WHERE id = %s', (organization_id,))
            org = cur.fetchone()
            if not org:
                raise ValueError('Organization not found')
            
            current_status = org['verification_status']
            
            # Update only public_visible
            cur.execute(
                '''
                UPDATE organizations
                SET public_visible = %s, updated_at = now()
                WHERE id = %s
                RETURNING id, name, slug, country, city, website_url, phone,
                          verification_status, is_verified, public_visible,
                          verification_comment, created_at, updated_at
                ''',
                (not blocked, organization_id),
            )
            row = cur.fetchone()
            conn.commit()
            
            return {
                'id': str(row['id']),
                'name': row['name'],
                'slug': row.get('slug'),
                'country': row.get('country'),
                'city': row.get('city'),
                'website_url': row.get('website_url'),
                'phone': row.get('phone'),
                'verification_status': row.get('verification_status'),
                'is_verified': row.get('is_verified', False),
                'public_visible': row.get('public_visible', False),
                'verification_comment': row.get('verification_comment'),
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
            }


def get_organization_details(organization_id: str, admin_user_id: str) -> dict:
    """
    Get full organization details including owners (admin only).
    """
    assert_platform_admin(admin_user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Get organization and profile data
            cur.execute(
                '''
                SELECT 
                    o.id, o.name, o.slug, o.country, o.city, o.website_url, o.phone,
                    o.verification_status, o.is_verified, o.public_visible,
                    o.verification_comment, o.created_at, o.updated_at,
                    p.short_description, p.long_description, p.production_description,
                    p.safety_and_quality, p.video_url, p.tags,
                    p.contact_email, p.contact_phone, p.contact_website, p.contact_address,
                    p.contact_telegram, p.contact_whatsapp
                FROM organizations o
                LEFT JOIN organization_profiles p ON p.organization_id = o.id
                WHERE o.id = %s
                ''',
                (organization_id,),
            )
            org = cur.fetchone()
            if not org:
                raise ValueError('Organization not found')
            
            # Get owners/members
            cur.execute(
                '''
                SELECT 
                    u.id, u.email, u.full_name, om.role
                FROM organization_members om
                JOIN app_users u ON u.id = om.user_id
                WHERE om.organization_id = %s
                ''',
                (organization_id,),
            )
            members = cur.fetchall()
            
            return {
                'organization': {
                    'id': str(org['id']),
                    'name': org['name'],
                    'slug': org.get('slug'),
                    'country': org.get('country'),
                    'city': org.get('city'),
                    'website_url': org.get('website_url'),
                    'phone': org.get('phone'),
                    'verification_status': org.get('verification_status'),
                    'is_verified': org.get('is_verified', False),
                    'public_visible': org.get('public_visible', False),
                    'verification_comment': org.get('verification_comment'),
                    'created_at': org['created_at'].isoformat() if org['created_at'] else None,
                    'updated_at': org['updated_at'].isoformat() if org['updated_at'] else None,
                },
                'profile': {
                    'short_description': org.get('short_description'),
                    'long_description': org.get('long_description'),
                    'production_description': org.get('production_description'),
                    'safety_and_quality': org.get('safety_and_quality'),
                    'video_url': org.get('video_url'),
                    'tags': org.get('tags'),
                    'contact_email': org.get('contact_email'),
                    'contact_phone': org.get('contact_phone'),
                    'contact_website': org.get('contact_website'),
                    'contact_address': org.get('contact_address'),
                    'contact_telegram': org.get('contact_telegram'),
                    'contact_whatsapp': org.get('contact_whatsapp'),
                },
                'members': [
                    {
                        'id': str(m['id']),
                        'email': m['email'],
                        'full_name': m['full_name'],
                        'role': m['role'],
                    }
                    for m in members
                ],
            }


def update_organization_details(
    organization_id: str,
    admin_user_id: str,
    payload: dict,
) -> dict:
    """
    Update organization details (admin only).
    Payload can contain fields for 'organization' and 'profile'.
    """
    assert_platform_admin(admin_user_id)
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Update organization table
            org_fields = []
            org_params = []
            
            allowed_org_fields = ['name', 'slug', 'country', 'city', 'website_url', 'phone']
            for field in allowed_org_fields:
                if field in payload:
                    org_fields.append(f'{field} = %s')
                    org_params.append(payload[field])
            
            if org_fields:
                org_fields.append('updated_at = now()')
                org_params.append(organization_id)
                cur.execute(
                    f'''
                    UPDATE organizations
                    SET {', '.join(org_fields)}
                    WHERE id = %s
                    ''',
                    org_params,
                )
            
            # Update profile table
            # First check if profile exists, if not create it
            cur.execute('SELECT 1 FROM organization_profiles WHERE organization_id = %s', (organization_id,))
            if not cur.fetchone():
                cur.execute(
                    'INSERT INTO organization_profiles (organization_id) VALUES (%s)',
                    (organization_id,),
                )
            
            profile_fields = []
            profile_params = []
            
            allowed_profile_fields = [
                'short_description', 'long_description', 'production_description',
                'safety_and_quality', 'video_url', 'tags',
                'contact_email', 'contact_phone', 'contact_website', 'contact_address',
                'contact_telegram', 'contact_whatsapp'
            ]
            
            for field in allowed_profile_fields:
                if field in payload:
                    profile_fields.append(f'{field} = %s')
                    profile_params.append(payload[field])
            
            if profile_fields:
                profile_fields.append('updated_at = now()')
                profile_params.append(organization_id)
                cur.execute(
                    f'''
                    UPDATE organization_profiles
                    SET {', '.join(profile_fields)}
                    WHERE organization_id = %s
                    ''',
                    profile_params,
                )
            
            conn.commit()
            
            return get_organization_details(organization_id, admin_user_id)


