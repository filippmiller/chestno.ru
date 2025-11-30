"""
Health check endpoint for monitoring database and Supabase connections
"""
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import get_connection
from app.core.supabase import supabase_admin

router = APIRouter(prefix='/api/health', tags=['health'])


@router.get('/')
async def health_check():
    """
    Comprehensive health check endpoint.
    Checks:
    - Database connection (PostgreSQL)
    - Supabase Auth API connection
    - Configuration validity
    """
    settings = get_settings()
    health_status = {
        'status': 'healthy',
        'checks': {},
    }

    # Check database connection
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT version();')
                version = cur.fetchone()[0]
                cur.execute('SELECT NOW();')
                db_time = cur.fetchone()[0]
                health_status['checks']['database'] = {
                    'status': 'healthy',
                    'version': version.split(',')[0] if version else 'unknown',
                    'server_time': str(db_time),
                }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'error': str(e),
        }

    # Check Supabase Auth API
    try:
        # Try to make a simple request to Supabase Auth API
        # We'll use the admin client to check connectivity
        test_response = supabase_admin._client.get(
            f'{supabase_admin.base_auth_url}/health',
            headers=supabase_admin.public_headers,
            timeout=5.0,
        )
        health_status['checks']['supabase_auth'] = {
            'status': 'healthy',
            'url': settings.supabase_url,
            'response_status': test_response.status_code,
        }
    except Exception as e:
        # If health endpoint doesn't exist, try a different approach
        # Check if we can at least reach the base URL
        try:
            test_response = supabase_admin._client.get(
                settings.supabase_url,
                headers=supabase_admin.public_headers,
                timeout=5.0,
            )
            health_status['checks']['supabase_auth'] = {
                'status': 'healthy',
                'url': settings.supabase_url,
                'response_status': test_response.status_code,
            }
        except Exception as e2:
            health_status['status'] = 'unhealthy'
            health_status['checks']['supabase_auth'] = {
                'status': 'unhealthy',
                'error': str(e2),
            }

    # Check configuration
    config_issues = []
    if not settings.database_url:
        config_issues.append('DATABASE_URL not set')
    if not settings.supabase_url:
        config_issues.append('SUPABASE_URL not set')
    if not settings.supabase_service_role_key:
        config_issues.append('SUPABASE_SERVICE_ROLE_KEY not set')

    if config_issues:
        health_status['status'] = 'unhealthy'
        health_status['checks']['configuration'] = {
            'status': 'unhealthy',
            'issues': config_issues,
        }
    else:
        health_status['checks']['configuration'] = {
            'status': 'healthy',
        }

    # Return appropriate status code
    if health_status['status'] == 'unhealthy':
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status,
        )

    return health_status


@router.get('/db')
async def database_health():
    """
    Quick database health check
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1;')
                result = cur.fetchone()
                if result and result[0] == 1:
                    return {'status': 'healthy', 'database': 'connected'}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f'Database connection failed: {str(e)}',
        )


@router.get('/supabase')
async def supabase_health():
    """
    Quick Supabase Auth API health check
    """
    settings = get_settings()
    try:
        # Try to reach Supabase base URL
        response = supabase_admin._client.get(
            settings.supabase_url,
            headers=supabase_admin.public_headers,
            timeout=5.0,
        )
        return {
            'status': 'healthy',
            'supabase_url': settings.supabase_url,
            'response_status': response.status_code,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f'Supabase connection failed: {str(e)}',
        )


