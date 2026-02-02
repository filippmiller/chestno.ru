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
    QRCodeTimeline,
    TimelineDataPoint,
    QRCustomizationSettings,
    QRCustomizationUpdate,
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
    """
    Log QR scan event and return redirect URL.

    Uses dynamic URL resolution with priority:
    1. Running A/B test (with traffic splitting)
    2. Active campaign (highest priority wins)
    3. Default URL version
    4. Legacy behavior (from qr_codes table)
    """
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

            qr_code_id = row['id']

            # Calculate IP hash for geo lookup and consistent A/B test assignment
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

            # Resolve dynamic URL (A/B test > Campaign > Default > Legacy)
            url_version_id = None
            campaign_id = None
            ab_test_id = None
            ab_variant_id = None
            redirect_url = None

            # Try dynamic URL resolution
            cur.execute(
                'SELECT * FROM get_active_qr_url(%s, %s)',
                (qr_code_id, ip_hash)
            )
            dynamic_url = cur.fetchone()

            if dynamic_url and dynamic_url['target_url']:
                target_url = dynamic_url['target_url']
                url_version_id = dynamic_url['url_version_id']
                campaign_id = dynamic_url['campaign_id']
                ab_test_id = dynamic_url['ab_test_id']
                ab_variant_id = dynamic_url['ab_variant_id']

                # Build full URL
                if target_url.startswith('http://') or target_url.startswith('https://'):
                    redirect_url = target_url
                else:
                    redirect_url = f'{settings.frontend_base}{target_url}'
            else:
                # Fallback to legacy behavior
                target_slug = row['target_slug'] or row['organization_slug']
                redirect_url = f'{settings.frontend_base}/org/{target_slug}'

            # Log event with enhanced tracking
            cur.execute(
                '''
                INSERT INTO qr_events (
                    qr_code_id, ip_hash, user_agent, referer, raw_query,
                    country, city, utm_source, utm_medium, utm_campaign,
                    url_version_id, campaign_id, ab_test_id, ab_variant_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                ''',
                (
                    qr_code_id, ip_hash, user_agent, referer, raw_query,
                    geo.country if geo else None,
                    geo.city if geo else None,
                    utm['utm_source'],
                    utm['utm_medium'],
                    utm['utm_campaign'],
                    url_version_id,
                    campaign_id,
                    ab_test_id,
                    ab_variant_id,
                ),
            )
            event_row = cur.fetchone()
            scan_event_id = event_row['id'] if event_row else None
            conn.commit()

            # Trigger real-time scan notification (async, non-blocking)
            try:
                from app.services import scan_notifications
                if scan_notifications.check_notifications_enabled(str(row['organization_id'])):
                    scan_notifications.send_scan_notification(
                        organization_id=str(row['organization_id']),
                        scan_event_id=str(scan_event_id) if scan_event_id else None,
                        country=geo.country if geo else None,
                        city=geo.city if geo else None,
                    )
            except Exception as notif_err:
                # Log but don't fail the scan
                import logging
                logging.getLogger(__name__).warning(f"Failed to send scan notification: {notif_err}")

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


def get_qr_timeline(organization_id: str, qr_code_id: str, user_id: str, period: str = "7d") -> QRCodeTimeline:
    """
    Get timeline data for QR code scans aggregated by date.

    Args:
        organization_id: Organization UUID
        qr_code_id: QR code UUID
        user_id: User UUID (for auth check)
        period: Time period - "7d", "30d", "90d", or "1y"

    Returns:
        QRCodeTimeline with date-aggregated scan counts
    """
    # Parse period into days
    period_days = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
    }

    if period not in period_days:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid period. Use 7d, 30d, 90d, or 1y')

    days = period_days[period]

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check permissions (analyst+ role required)
            _ensure_role(cur, organization_id, user_id, ANALYTICS_ROLES)

            # Verify QR code exists and belongs to org
            cur.execute(
                'SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s',
                (qr_code_id, organization_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR-код не найден')

            # Calculate date range
            now = datetime.now(timezone.utc)
            start_date = now - timedelta(days=days)

            # Query aggregated by date
            # Using DATE(occurred_at) to aggregate by calendar day
            cur.execute(
                '''
                SELECT
                    DATE(occurred_at) as scan_date,
                    COUNT(*) as count
                FROM qr_events
                WHERE qr_code_id = %s
                  AND occurred_at >= %s
                GROUP BY DATE(occurred_at)
                ORDER BY scan_date ASC
                ''',
                (qr_code_id, start_date)
            )
            rows = cur.fetchall()

            # Build lookup dict for existing data
            data_by_date = {row['scan_date'].isoformat(): row['count'] for row in rows}

            # Fill in gaps with zero counts
            data_points = []
            total_scans = 0
            current_date = start_date.date()
            end_date = now.date()

            while current_date <= end_date:
                date_str = current_date.isoformat()
                count = data_by_date.get(date_str, 0)
                data_points.append(TimelineDataPoint(date=date_str, count=count))
                total_scans += count
                current_date += timedelta(days=1)

            return QRCodeTimeline(
                period=period,
                data_points=data_points,
                total_scans=total_scans
            )


def calculate_contrast_ratio(foreground_hex: str, background_hex: str) -> float:
    """
    Calculate WCAG contrast ratio between two colors.

    Args:
        foreground_hex: Foreground color in hex format (e.g., '#000000')
        background_hex: Background color in hex format (e.g., '#FFFFFF')

    Returns:
        Contrast ratio between 1.0 and 21.0

    WCAG AA standards:
        - Normal text: minimum 4.5:1
        - Large text: minimum 3.0:1
        - QR codes are graphical objects: minimum 3.0:1
    """
    def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
        """Convert hex color to RGB tuple."""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def relative_luminance(rgb: tuple[int, int, int]) -> float:
        """Calculate relative luminance according to WCAG formula."""
        r, g, b = rgb
        # Normalize to 0-1
        r, g, b = r / 255.0, g / 255.0, b / 255.0

        # Apply sRGB gamma correction
        def gamma(channel: float) -> float:
            if channel <= 0.03928:
                return channel / 12.92
            else:
                return ((channel + 0.055) / 1.055) ** 2.4

        r, g, b = gamma(r), gamma(g), gamma(b)

        # Calculate luminance
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    fg_rgb = hex_to_rgb(foreground_hex)
    bg_rgb = hex_to_rgb(background_hex)

    l1 = relative_luminance(fg_rgb)
    l2 = relative_luminance(bg_rgb)

    # Ensure l1 is the lighter color
    lighter = max(l1, l2)
    darker = min(l1, l2)

    # WCAG contrast formula
    contrast = (lighter + 0.05) / (darker + 0.05)

    return round(contrast, 2)


def get_qr_customization(organization_id: str, qr_code_id: str, user_id: str) -> QRCustomizationSettings | None:
    """Get customization settings for a QR code."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)

            # Verify QR code exists and belongs to organization
            cur.execute(
                'SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s',
                (qr_code_id, organization_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR-код не найден')

            # Get customization settings
            cur.execute(
                'SELECT * FROM qr_customization_settings WHERE qr_code_id = %s',
                (qr_code_id,)
            )
            row = cur.fetchone()

            if row:
                return QRCustomizationSettings(**row)
            return None


def update_qr_customization(
    organization_id: str,
    qr_code_id: str,
    user_id: str,
    payload: QRCustomizationUpdate
) -> QRCustomizationSettings:
    """Create or update customization settings for a QR code."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            # Verify QR code exists and belongs to organization
            cur.execute(
                'SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s',
                (qr_code_id, organization_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR-код не найден')

            # Get existing settings or use defaults
            cur.execute(
                'SELECT * FROM qr_customization_settings WHERE qr_code_id = %s',
                (qr_code_id,)
            )
            existing = cur.fetchone()

            # Merge with payload
            fg_color = payload.foreground_color or (existing['foreground_color'] if existing else '#000000')
            bg_color = payload.background_color or (existing['background_color'] if existing else '#FFFFFF')
            logo_url = payload.logo_url if payload.logo_url is not None else (existing['logo_url'] if existing else None)
            logo_size = payload.logo_size_percent or (existing['logo_size_percent'] if existing else 20)
            style = payload.style or (existing['style'] if existing else 'squares')

            # Calculate contrast ratio
            contrast = calculate_contrast_ratio(fg_color, bg_color)
            is_valid = contrast >= 3.0  # WCAG AA for graphical objects

            # Upsert customization settings
            cur.execute(
                '''
                INSERT INTO qr_customization_settings (
                    qr_code_id, foreground_color, background_color,
                    logo_url, logo_size_percent, style,
                    contrast_ratio, is_valid
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (qr_code_id) DO UPDATE SET
                    foreground_color = EXCLUDED.foreground_color,
                    background_color = EXCLUDED.background_color,
                    logo_url = EXCLUDED.logo_url,
                    logo_size_percent = EXCLUDED.logo_size_percent,
                    style = EXCLUDED.style,
                    contrast_ratio = EXCLUDED.contrast_ratio,
                    is_valid = EXCLUDED.is_valid,
                    updated_at = NOW()
                RETURNING *
                ''',
                (qr_code_id, fg_color, bg_color, logo_url, logo_size, style, contrast, is_valid)
            )
            row = cur.fetchone()
            conn.commit()

            return QRCustomizationSettings(**row)


def delete_qr_customization(organization_id: str, qr_code_id: str, user_id: str) -> None:
    """Delete customization settings for a QR code (revert to default)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            # Verify QR code exists and belongs to organization
            cur.execute(
                'SELECT id FROM qr_codes WHERE id = %s AND organization_id = %s',
                (qr_code_id, organization_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR-код не найден')

            # Delete customization
            cur.execute(
                'DELETE FROM qr_customization_settings WHERE qr_code_id = %s',
                (qr_code_id,)
            )
            conn.commit()


def bulk_create_qr_codes(organization_id: str, user_id: str, labels: list[str]) -> list[QRCode]:
    """
    Create multiple QR codes at once.

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth)
        labels: List of labels for QR codes (max 50)

    Returns:
        List of created QR codes

    Raises:
        HTTPException: If batch size > 50 or quota exceeded
    """
    if len(labels) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Список меток пуст')

    if len(labels) > 50:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Максимум 50 QR-кодов за раз')

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, MANAGER_ROLES)

            # Get organization slug
            cur.execute('SELECT slug FROM organizations WHERE id = %s', (organization_id,))
            org = cur.fetchone()
            if not org:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Организация не найдена')

            # Check quota for all QR codes at once
            for _ in labels:
                subscription_service.check_org_limit(organization_id, 'qr_codes')

            # Create all QR codes
            created_qr_codes = []
            for label in labels:
                code = _generate_code()
                cur.execute(
                    '''
                    INSERT INTO qr_codes (organization_id, code, label, target_type, target_slug, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING *
                    ''',
                    (organization_id, code, label.strip(), 'organization', org['slug'], user_id),
                )
                row = cur.fetchone()
                created_qr_codes.append(QRCode(**row))

            conn.commit()
            return created_qr_codes


def get_multiple_qr_codes(organization_id: str, user_id: str, qr_code_ids: list[str]) -> list[QRCode]:
    """
    Get multiple QR codes by IDs (for bulk operations).

    Args:
        organization_id: Organization UUID
        user_id: User UUID (for auth)
        qr_code_ids: List of QR code UUIDs

    Returns:
        List of QR codes

    Raises:
        HTTPException: If any QR code doesn't belong to the organization
    """
    if not qr_code_ids:
        return []

    if len(qr_code_ids) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Максимум 100 QR-кодов за раз')

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _ensure_role(cur, organization_id, user_id, VIEW_ROLES)

            # Fetch QR codes
            placeholders = ','.join(['%s'] * len(qr_code_ids))
            cur.execute(
                f'''
                SELECT * FROM qr_codes
                WHERE id IN ({placeholders}) AND organization_id = %s
                ORDER BY created_at DESC
                ''',
                (*qr_code_ids, organization_id)
            )
            rows = cur.fetchall()

            # Verify all requested QR codes were found and belong to org
            if len(rows) != len(qr_code_ids):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Некоторые QR-коды не найдены')

            return [QRCode(**row) for row in rows]

