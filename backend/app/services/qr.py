from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.core.db import get_connection
from app.schemas.qr import (
    QRCode,
    QRCodeCreate,
    QRCodeStats,
    QRCodeDetailedStats,
    GeoBreakdownItem,
    UTMBreakdownItem,
)
from app.services import subscriptions as subscription_service
from app.utils.geoip import lookup_ip, parse_utm_params

settings = get_settings()

MANAGER_ROLES = ('owner', 'admin', 'manager')
VIEW_ROLES = ('owner', 'admin', 'manager', 'editor', 'analyst', 'viewer')
ANALYTICS_ROLES = ('owner', 'admin', 'manager', 'analyst')


def _ensure_role(cur, organization_id: str, user_id: str, allowed_roles) -> str:
    cur.execute(
        '''
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        ''',
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row or row['role'] not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав')
    return row['role']


def _generate_code() -> str:
    return secrets.token_urlsafe(8)


def create_qr_code(organization_id: str, user_id: str, payload: QRCodeCreate) -> QRCode:
    code = _generate_code()
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)
            subscription_service.check_org_limit(organization_id, 'qr_codes')
            cur.execute('SELECT slug FROM organizations WHERE id = %s', (organization_id,))
            org = cur.fetchone()
            if not org:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Организация не найдена')

            cur.execute(
                '''
                INSERT INTO qr_codes (organization_id, code, label, target_type, target_slug, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (organization_id, code, payload.label, payload.target_type, org['slug'], user_id),
            )
            row = cur.fetchone()
            conn.commit()
            return QRCode(**row)


def list_qr_codes(organization_id: str, user_id: str) -> list[QRCode]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)
            cur.execute(
                '''
                SELECT * FROM qr_codes
                WHERE organization_id = %s
                ORDER BY created_at DESC
                ''',
                (organization_id,),
            )
            rows = cur.fetchall()
            return [QRCode(**row) for row in rows]


def get_qr_stats(organization_id: str, qr_code_id: str, user_id: str) -> QRCodeStats:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYTICS_ROLES)
            cur.execute('SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s', (qr_code_id, organization_id))
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR-код не найден')

            now = datetime.now(timezone.utc)
            last7 = now - timedelta(days=7)
            last30 = now - timedelta(days=30)
            cur.execute(
                '''
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE occurred_at >= %s) AS last_7_days,
                    COUNT(*) FILTER (WHERE occurred_at >= %s) AS last_30_days
                FROM qr_events
                WHERE qr_code_id = %s
                ''',
                (last7, last30, qr_code_id),
            )
            row = cur.fetchone()
            return QRCodeStats(
                total=row['total'] or 0,
                last_7_days=row['last_7_days'] or 0,
                last_30_days=row['last_30_days'] or 0,
            )


def log_event_and_get_redirect(code: str, client_ip: str | None, user_agent: str | None, referer: str | None, raw_query: str | None) -> str:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT qc.id, qc.organization_id, qc.target_slug, qc.is_active, o.slug AS organization_slug
                FROM qr_codes qc
                JOIN organizations o ON o.id = qc.organization_id
                WHERE qc.code = %s
                ''',
                (code,),
            )
            row = cur.fetchone()
            if not row or not row['is_active']:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR-код не найден')

            ip_hash = None
            geo = None
            if client_ip:
                sha = hashlib.sha256()
                sha.update(f'{settings.qr_ip_hash_salt}:{client_ip}'.encode('utf-8'))
                ip_hash = sha.hexdigest()
                # Lookup geographic location
                geo = lookup_ip(client_ip)

            # Parse UTM parameters from query string
            utm = parse_utm_params(raw_query)

            cur.execute(
                '''
                INSERT INTO qr_events (
                    qr_code_id, ip_hash, user_agent, referer, raw_query,
                    country, city, utm_source, utm_medium, utm_campaign
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''',
                (
                    row['id'], ip_hash, user_agent, referer, raw_query,
                    geo.country if geo else None,
                    geo.city if geo else None,
                    utm['utm_source'],
                    utm['utm_medium'],
                    utm['utm_campaign'],
                ),
            )
            conn.commit()

            target_slug = row['target_slug'] or row['organization_slug']
            redirect_url = f'{settings.frontend_base}/org/{target_slug}'
            return redirect_url


def get_qr_detailed_stats(organization_id: str, qr_code_id: str, user_id: str) -> QRCodeDetailedStats:
    """Get detailed QR code statistics including geo and UTM breakdowns."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, ANALYTICS_ROLES)
            cur.execute('SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s', (qr_code_id, organization_id))
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR-код не найден')

            now = datetime.now(timezone.utc)
            last7 = now - timedelta(days=7)
            last30 = now - timedelta(days=30)

            # Basic counts
            cur.execute(
                '''
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE occurred_at >= %s) AS last_7_days,
                    COUNT(*) FILTER (WHERE occurred_at >= %s) AS last_30_days
                FROM qr_events
                WHERE qr_code_id = %s
                ''',
                (last7, last30, qr_code_id),
            )
            counts = cur.fetchone()

            # Geo breakdown (top 20)
            cur.execute(
                '''
                SELECT country, city, COUNT(*) as count
                FROM qr_events
                WHERE qr_code_id = %s AND country IS NOT NULL
                GROUP BY country, city
                ORDER BY count DESC
                LIMIT 20
                ''',
                (qr_code_id,),
            )
            geo_rows = cur.fetchall()
            geo_breakdown = [
                GeoBreakdownItem(country=r['country'], city=r['city'], count=r['count'])
                for r in geo_rows
            ]

            # UTM breakdown (top 20)
            cur.execute(
                '''
                SELECT utm_source, utm_medium, utm_campaign, COUNT(*) as count
                FROM qr_events
                WHERE qr_code_id = %s AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
                GROUP BY utm_source, utm_medium, utm_campaign
                ORDER BY count DESC
                LIMIT 20
                ''',
                (qr_code_id,),
            )
            utm_rows = cur.fetchall()
            utm_breakdown = [
                UTMBreakdownItem(
                    utm_source=r['utm_source'],
                    utm_medium=r['utm_medium'],
                    utm_campaign=r['utm_campaign'],
                    count=r['count'],
                )
                for r in utm_rows
            ]

            return QRCodeDetailedStats(
                total=counts['total'] or 0,
                last_7_days=counts['last_7_days'] or 0,
                last_30_days=counts['last_30_days'] or 0,
                geo_breakdown=geo_breakdown,
                utm_breakdown=utm_breakdown,
            )

