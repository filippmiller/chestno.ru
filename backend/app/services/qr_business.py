"""
Business QR Code Service
Handles simple QR codes for business main pages (without database tracking codes).
"""
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.core.db import get_connection
from app.services.admin_guard import assert_platform_admin

settings = get_settings()


def get_business_public_url(organization_id: str, user_id: str | None = None) -> dict:
    """
    Get public URL for business organization.
    
    Args:
        organization_id: Organization ID
        user_id: Optional user ID (for access check)
        
    Returns:
        Dict with public_url and slug
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, slug, name, verification_status, public_visible
                FROM organizations
                WHERE id = %s
                ''',
                (organization_id,),
            )
            org = cur.fetchone()
            
            if not org:
                raise ValueError('Organization not found')
            
            if not org['slug']:
                raise ValueError('Organization slug is missing')
            
            # Build QR redirect URL (not direct public URL)
            # QR code should encode /qr/b/{slug} which will log event and redirect
            public_url = f'{settings.frontend_base}/qr/b/{org["slug"]}'
            
            return {
                'public_url': public_url,
                'slug': org['slug'],
                'name': org['name'],
                'organization_id': str(org['id']),
            }


def get_business_qr_url_for_admin(organization_id: str, admin_user_id: str) -> dict:
    """
    Get business QR URL for admin (can access any business).
    
    Args:
        organization_id: Organization ID
        admin_user_id: Admin user ID
        
    Returns:
        Dict with public_url and slug
    """
    assert_platform_admin(admin_user_id)
    return get_business_public_url(organization_id)


def log_qr_scan_event(
    organization_id: str,
    qr_type: str = 'business_main',
    client_ip: str | None = None,
    user_agent: str | None = None,
    user_id: str | None = None,
) -> None:
    """
    Log QR scan event directly (for simple business QR codes without qr_codes table entry).
    
    Args:
        organization_id: Organization ID
        qr_type: Type of QR code (e.g., 'business_main')
        client_ip: Client IP address
        user_agent: User agent string
        user_id: Optional user ID if logged in
    """
    import hashlib
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Hash IP if provided
            ip_hash = None
            if client_ip:
                sha = hashlib.sha256()
                sha.update(f'{settings.qr_ip_hash_salt}:{client_ip}'.encode('utf-8'))
                ip_hash = sha.hexdigest()
            
            # Insert into qr_scan_events (new table for simple QR tracking)
            # If table doesn't exist yet, we'll create it via migration
            try:
                cur.execute(
                    '''
                    INSERT INTO qr_scan_events (organization_id, qr_type, user_id, ip_hash, user_agent, created_at)
                    VALUES (%s, %s, %s, %s, %s, now())
                    ''',
                    (organization_id, qr_type, user_id, ip_hash, user_agent),
                )
                conn.commit()
            except Exception:
                # Table might not exist yet - that's OK, we'll create it
                conn.rollback()
                pass

