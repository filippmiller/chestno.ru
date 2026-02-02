"""
Geographic Anomaly Detection Service

Detects when products appear outside authorized distribution regions (gray market detection).

Core Features:
- Configure authorized regions for products/organizations
- Check scan locations against authorized regions
- Create and track anomaly alerts
- Get anomaly statistics and trends
- Mark anomalies as investigated

Database tables:
- authorized_regions: Defines authorized distribution regions
- geographic_anomalies: Records detected anomalies
- anomaly_alert_rules: Configurable alerting rules
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection

logger = logging.getLogger(__name__)

# Severity levels for anomalies
SEVERITY_LEVELS = ('low', 'medium', 'high', 'critical')
ANOMALY_STATUSES = ('new', 'under_review', 'confirmed', 'false_positive', 'resolved')
ANOMALY_TYPES = ('region_mismatch', 'country_mismatch', 'suspicious_pattern', 'velocity_anomaly')


# ============================================================
# AUTHORIZED REGIONS MANAGEMENT
# ============================================================

def get_authorized_regions(
    organization_id: str,
    product_id: Optional[str] = None
) -> list[dict]:
    """
    Get authorized regions for an organization or specific product.

    Args:
        organization_id: Organization UUID
        product_id: Optional product UUID to filter by

    Returns:
        List of authorized region records
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            if product_id:
                cur.execute(
                    '''
                    SELECT
                        id::text,
                        organization_id::text,
                        product_id::text,
                        region_code,
                        region_name,
                        is_exclusive,
                        center_lat,
                        center_lng,
                        radius_km,
                        notes,
                        created_by::text,
                        created_at,
                        updated_at
                    FROM public.authorized_regions
                    WHERE organization_id = %s
                    AND (product_id = %s OR product_id IS NULL)
                    ORDER BY region_name
                    ''',
                    (organization_id, product_id)
                )
            else:
                cur.execute(
                    '''
                    SELECT
                        id::text,
                        organization_id::text,
                        product_id::text,
                        region_code,
                        region_name,
                        is_exclusive,
                        center_lat,
                        center_lng,
                        radius_km,
                        notes,
                        created_by::text,
                        created_at,
                        updated_at
                    FROM public.authorized_regions
                    WHERE organization_id = %s
                    ORDER BY product_id NULLS FIRST, region_name
                    ''',
                    (organization_id,)
                )

            rows = cur.fetchall()
            return [dict(row) for row in rows]

    except Exception as e:
        logger.error(f"[geo_anomaly] Error getting authorized regions for org {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving authorized regions: {str(e)}"
        )


def add_authorized_region(
    organization_id: str,
    user_id: str,
    region_code: str,
    region_name: str,
    product_id: Optional[str] = None,
    is_exclusive: bool = False,
    center_lat: Optional[float] = None,
    center_lng: Optional[float] = None,
    radius_km: int = 100,
    notes: Optional[str] = None
) -> dict:
    """
    Add an authorized region for an organization or product.

    Args:
        organization_id: Organization UUID
        user_id: User UUID adding the region
        region_code: ISO 3166-2 region code (e.g., 'RU-MOW')
        region_name: Human-readable region name
        product_id: Optional product UUID (None for org-wide)
        is_exclusive: If true, ONLY this region is authorized
        center_lat: Center latitude for boundary checking
        center_lng: Center longitude for boundary checking
        radius_km: Radius in km for circle-based detection
        notes: Internal notes

    Returns:
        Created region record

    Raises:
        HTTPException: If duplicate region or database error
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                INSERT INTO public.authorized_regions (
                    organization_id,
                    product_id,
                    region_code,
                    region_name,
                    is_exclusive,
                    center_lat,
                    center_lng,
                    radius_km,
                    notes,
                    created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                    id::text,
                    organization_id::text,
                    product_id::text,
                    region_code,
                    region_name,
                    is_exclusive,
                    center_lat,
                    center_lng,
                    radius_km,
                    notes,
                    created_by::text,
                    created_at,
                    updated_at
                ''',
                (
                    organization_id,
                    product_id,
                    region_code,
                    region_name,
                    is_exclusive,
                    center_lat,
                    center_lng,
                    radius_km,
                    notes,
                    user_id
                )
            )
            row = cur.fetchone()
            conn.commit()

            logger.info(f"[geo_anomaly] Added authorized region {region_code} for org {organization_id}")
            return dict(row)

    except Exception as e:
        if 'unique' in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This region is already configured"
            )
        logger.error(f"[geo_anomaly] Error adding authorized region: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding authorized region: {str(e)}"
        )


def update_authorized_region(
    region_id: str,
    organization_id: str,
    user_id: str,
    region_name: Optional[str] = None,
    is_exclusive: Optional[bool] = None,
    center_lat: Optional[float] = None,
    center_lng: Optional[float] = None,
    radius_km: Optional[int] = None,
    notes: Optional[str] = None
) -> dict:
    """
    Update an authorized region.

    Args:
        region_id: Region UUID to update
        organization_id: Organization UUID (for validation)
        user_id: User UUID making the update
        Other args: Fields to update (None = no change)

    Returns:
        Updated region record
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build dynamic update query
            updates = []
            params = []

            if region_name is not None:
                updates.append("region_name = %s")
                params.append(region_name)
            if is_exclusive is not None:
                updates.append("is_exclusive = %s")
                params.append(is_exclusive)
            if center_lat is not None:
                updates.append("center_lat = %s")
                params.append(center_lat)
            if center_lng is not None:
                updates.append("center_lng = %s")
                params.append(center_lng)
            if radius_km is not None:
                updates.append("radius_km = %s")
                params.append(radius_km)
            if notes is not None:
                updates.append("notes = %s")
                params.append(notes)

            if not updates:
                # No updates, just return current
                cur.execute(
                    '''
                    SELECT
                        id::text, organization_id::text, product_id::text,
                        region_code, region_name, is_exclusive,
                        center_lat, center_lng, radius_km, notes,
                        created_by::text, created_at, updated_at
                    FROM public.authorized_regions
                    WHERE id = %s AND organization_id = %s
                    ''',
                    (region_id, organization_id)
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Region not found")
                return dict(row)

            updates.append("updated_at = now()")
            params.extend([region_id, organization_id])

            cur.execute(
                f'''
                UPDATE public.authorized_regions
                SET {", ".join(updates)}
                WHERE id = %s AND organization_id = %s
                RETURNING
                    id::text, organization_id::text, product_id::text,
                    region_code, region_name, is_exclusive,
                    center_lat, center_lng, radius_km, notes,
                    created_by::text, created_at, updated_at
                ''',
                params
            )
            row = cur.fetchone()
            conn.commit()

            if not row:
                raise HTTPException(status_code=404, detail="Region not found")

            logger.info(f"[geo_anomaly] Updated authorized region {region_id}")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[geo_anomaly] Error updating authorized region: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating authorized region: {str(e)}"
        )


def delete_authorized_region(
    region_id: str,
    organization_id: str
) -> bool:
    """
    Delete an authorized region.

    Args:
        region_id: Region UUID to delete
        organization_id: Organization UUID (for validation)

    Returns:
        True if deleted, False if not found
    """
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                DELETE FROM public.authorized_regions
                WHERE id = %s AND organization_id = %s
                RETURNING id
                ''',
                (region_id, organization_id)
            )
            deleted = cur.fetchone() is not None
            conn.commit()

            if deleted:
                logger.info(f"[geo_anomaly] Deleted authorized region {region_id}")

            return deleted

    except Exception as e:
        logger.error(f"[geo_anomaly] Error deleting authorized region: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting authorized region: {str(e)}"
        )


# ============================================================
# SCAN LOCATION CHECKING
# ============================================================

def check_scan_location(
    organization_id: str,
    product_id: Optional[str],
    scan_lat: float,
    scan_lng: float
) -> dict:
    """
    Check if a scan location is within authorized regions.

    Args:
        organization_id: Organization UUID
        product_id: Product UUID (optional)
        scan_lat: Scan latitude
        scan_lng: Scan longitude

    Returns:
        dict with:
        - is_authorized: bool
        - nearest_region_code: str
        - nearest_region_name: str
        - distance_km: int
        - severity: str ('none', 'low', 'medium', 'high', 'critical')
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT * FROM public.check_scan_in_authorized_region(
                    %s::uuid,
                    %s::uuid,
                    %s::numeric,
                    %s::numeric
                )
                ''',
                (organization_id, product_id, scan_lat, scan_lng)
            )
            row = cur.fetchone()

            if row:
                return dict(row)

            # Fallback if function returns nothing
            return {
                'is_authorized': True,
                'nearest_region_code': 'UNKNOWN',
                'nearest_region_name': 'Unknown',
                'distance_km': 0,
                'severity': 'none'
            }

    except Exception as e:
        logger.error(f"[geo_anomaly] Error checking scan location: {e}")
        # Don't block scans on error - return authorized
        return {
            'is_authorized': True,
            'nearest_region_code': 'ERROR',
            'nearest_region_name': 'Check failed',
            'distance_km': 0,
            'severity': 'none'
        }


def create_anomaly(
    organization_id: str,
    product_id: Optional[str],
    expected_region: str,
    actual_region: str,
    actual_region_name: str,
    scan_lat: float,
    scan_lng: float,
    distance_km: int,
    severity: str,
    anomaly_type: str = 'region_mismatch',
    qr_code_id: Optional[str] = None,
    scan_event_id: Optional[str] = None,
    scan_metadata: Optional[dict] = None
) -> dict:
    """
    Create a geographic anomaly alert.

    Args:
        organization_id: Organization UUID
        product_id: Product UUID (optional)
        expected_region: Expected region code(s)
        actual_region: Actual detected region code
        actual_region_name: Human-readable region name
        scan_lat: Scan latitude (reduced precision)
        scan_lng: Scan longitude (reduced precision)
        distance_km: Distance from nearest authorized region
        severity: 'low', 'medium', 'high', 'critical'
        anomaly_type: Type of anomaly detected
        qr_code_id: Related QR code ID (optional)
        scan_event_id: Related scan event ID (optional)
        scan_metadata: Additional scan context (optional)

    Returns:
        Created anomaly record
    """
    try:
        # Reduce coordinate precision for privacy
        privacy_lat = round(scan_lat, 4) if scan_lat else None
        privacy_lng = round(scan_lng, 4) if scan_lng else None

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                INSERT INTO public.geographic_anomalies (
                    organization_id,
                    product_id,
                    qr_code_id,
                    scan_event_id,
                    expected_region,
                    actual_region,
                    actual_region_name,
                    scan_lat,
                    scan_lng,
                    distance_from_authorized_km,
                    severity,
                    anomaly_type,
                    scan_metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                    id::text,
                    organization_id::text,
                    product_id::text,
                    qr_code_id::text,
                    scan_event_id::text,
                    expected_region,
                    actual_region,
                    actual_region_name,
                    scan_lat,
                    scan_lng,
                    distance_from_authorized_km,
                    severity,
                    anomaly_type,
                    status,
                    scan_metadata,
                    created_at
                ''',
                (
                    organization_id,
                    product_id,
                    qr_code_id,
                    scan_event_id,
                    expected_region,
                    actual_region,
                    actual_region_name,
                    privacy_lat,
                    privacy_lng,
                    distance_km,
                    severity,
                    anomaly_type,
                    scan_metadata
                )
            )
            row = cur.fetchone()
            conn.commit()

            logger.info(
                f"[geo_anomaly] Created anomaly for org {organization_id}: "
                f"{actual_region} (expected {expected_region}), severity={severity}"
            )

            return dict(row)

    except Exception as e:
        logger.error(f"[geo_anomaly] Error creating anomaly: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating anomaly: {str(e)}"
        )


# ============================================================
# ANOMALY QUERIES
# ============================================================

def get_anomalies(
    organization_id: str,
    status_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
    product_id: Optional[str] = None,
    days: int = 30,
    page: int = 1,
    per_page: int = 20
) -> tuple[list[dict], int]:
    """
    Get anomalies for an organization with filtering and pagination.

    Args:
        organization_id: Organization UUID
        status_filter: Filter by status (optional)
        severity_filter: Filter by severity (optional)
        product_id: Filter by product (optional)
        days: Look back period in days
        page: Page number (1-indexed)
        per_page: Items per page

    Returns:
        Tuple of (anomaly list, total count)
    """
    try:
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Build WHERE clause
            conditions = ["organization_id = %s", "created_at >= now() - (%s || ' days')::INTERVAL"]
            params = [organization_id, days]

            if status_filter:
                conditions.append("status = %s")
                params.append(status_filter)
            if severity_filter:
                conditions.append("severity = %s")
                params.append(severity_filter)
            if product_id:
                conditions.append("product_id = %s")
                params.append(product_id)

            where_clause = " AND ".join(conditions)

            # Get total count
            cur.execute(
                f'''
                SELECT COUNT(*) as total
                FROM public.geographic_anomalies
                WHERE {where_clause}
                ''',
                params
            )
            total = cur.fetchone()['total']

            # Get anomalies
            cur.execute(
                f'''
                SELECT
                    ga.id::text,
                    ga.organization_id::text,
                    ga.product_id::text,
                    ga.qr_code_id::text,
                    ga.scan_event_id::text,
                    ga.expected_region,
                    ga.actual_region,
                    ga.actual_region_name,
                    ga.scan_lat,
                    ga.scan_lng,
                    ga.distance_from_authorized_km,
                    ga.severity,
                    ga.anomaly_type,
                    ga.status,
                    ga.investigated_at,
                    ga.investigated_by::text,
                    ga.investigation_notes,
                    ga.resolution,
                    ga.scan_metadata,
                    ga.created_at,
                    ga.updated_at,
                    p.name as product_name,
                    p.sku as product_sku
                FROM public.geographic_anomalies ga
                LEFT JOIN public.products p ON p.id = ga.product_id
                WHERE {where_clause}
                ORDER BY ga.created_at DESC
                LIMIT %s OFFSET %s
                ''',
                params + [per_page, offset]
            )
            rows = cur.fetchall()

            return [dict(row) for row in rows], total

    except Exception as e:
        logger.error(f"[geo_anomaly] Error getting anomalies for org {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving anomalies: {str(e)}"
        )


def get_anomaly_by_id(
    anomaly_id: str,
    organization_id: str
) -> Optional[dict]:
    """
    Get a single anomaly by ID.

    Args:
        anomaly_id: Anomaly UUID
        organization_id: Organization UUID (for validation)

    Returns:
        Anomaly record or None
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT
                    ga.id::text,
                    ga.organization_id::text,
                    ga.product_id::text,
                    ga.qr_code_id::text,
                    ga.scan_event_id::text,
                    ga.expected_region,
                    ga.actual_region,
                    ga.actual_region_name,
                    ga.scan_lat,
                    ga.scan_lng,
                    ga.distance_from_authorized_km,
                    ga.severity,
                    ga.anomaly_type,
                    ga.status,
                    ga.investigated_at,
                    ga.investigated_by::text,
                    ga.investigation_notes,
                    ga.resolution,
                    ga.scan_metadata,
                    ga.created_at,
                    ga.updated_at,
                    p.name as product_name,
                    p.sku as product_sku
                FROM public.geographic_anomalies ga
                LEFT JOIN public.products p ON p.id = ga.product_id
                WHERE ga.id = %s AND ga.organization_id = %s
                ''',
                (anomaly_id, organization_id)
            )
            row = cur.fetchone()
            return dict(row) if row else None

    except Exception as e:
        logger.error(f"[geo_anomaly] Error getting anomaly {anomaly_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving anomaly: {str(e)}"
        )


def update_anomaly_status(
    anomaly_id: str,
    organization_id: str,
    user_id: str,
    new_status: str,
    investigation_notes: Optional[str] = None,
    resolution: Optional[str] = None
) -> dict:
    """
    Update anomaly status (mark as investigated).

    Args:
        anomaly_id: Anomaly UUID
        organization_id: Organization UUID
        user_id: User UUID making the update
        new_status: New status
        investigation_notes: Notes from investigation (optional)
        resolution: Resolution description (optional)

    Returns:
        Updated anomaly record
    """
    if new_status not in ANOMALY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(ANOMALY_STATUSES)}"
        )

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                UPDATE public.geographic_anomalies
                SET
                    status = %s,
                    investigated_at = CASE WHEN %s IN ('confirmed', 'false_positive', 'resolved') THEN now() ELSE investigated_at END,
                    investigated_by = CASE WHEN %s IN ('confirmed', 'false_positive', 'resolved') THEN %s ELSE investigated_by END,
                    investigation_notes = COALESCE(%s, investigation_notes),
                    resolution = COALESCE(%s, resolution),
                    updated_at = now()
                WHERE id = %s AND organization_id = %s
                RETURNING
                    id::text,
                    organization_id::text,
                    product_id::text,
                    expected_region,
                    actual_region,
                    actual_region_name,
                    severity,
                    anomaly_type,
                    status,
                    investigated_at,
                    investigated_by::text,
                    investigation_notes,
                    resolution,
                    created_at,
                    updated_at
                ''',
                (
                    new_status,
                    new_status,
                    new_status,
                    user_id,
                    investigation_notes,
                    resolution,
                    anomaly_id,
                    organization_id
                )
            )
            row = cur.fetchone()
            conn.commit()

            if not row:
                raise HTTPException(status_code=404, detail="Anomaly not found")

            logger.info(f"[geo_anomaly] Updated anomaly {anomaly_id} status to {new_status}")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[geo_anomaly] Error updating anomaly status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating anomaly: {str(e)}"
        )


# ============================================================
# STATISTICS
# ============================================================

def get_anomaly_statistics(
    organization_id: str,
    days: int = 30
) -> dict:
    """
    Get anomaly statistics for an organization.

    Args:
        organization_id: Organization UUID
        days: Look back period in days

    Returns:
        Statistics dictionary with counts and trends
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT * FROM public.get_anomaly_stats(%s::uuid, %s)',
                (organization_id, days)
            )
            row = cur.fetchone()

            if row:
                return {
                    'period_days': days,
                    'total_anomalies': row['total_anomalies'] or 0,
                    'by_status': {
                        'new': row['new_count'] or 0,
                        'under_review': row['under_review_count'] or 0,
                        'confirmed': row['confirmed_count'] or 0,
                        'false_positive': row['false_positive_count'] or 0,
                        'resolved': row['resolved_count'] or 0,
                    },
                    'by_severity': {
                        'low': row['low_severity'] or 0,
                        'medium': row['medium_severity'] or 0,
                        'high': row['high_severity'] or 0,
                        'critical': row['critical_severity'] or 0,
                    },
                    'top_anomaly_regions': row['top_anomaly_regions'] or []
                }

            return {
                'period_days': days,
                'total_anomalies': 0,
                'by_status': {s: 0 for s in ANOMALY_STATUSES},
                'by_severity': {s: 0 for s in SEVERITY_LEVELS},
                'top_anomaly_regions': []
            }

    except Exception as e:
        logger.error(f"[geo_anomaly] Error getting statistics for org {organization_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving statistics: {str(e)}"
        )


def get_anomaly_trend(
    organization_id: str,
    days: int = 30
) -> list[dict]:
    """
    Get daily anomaly trend for visualization.

    Args:
        organization_id: Organization UUID
        days: Look back period in days

    Returns:
        List of daily counts for charting
    """
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                WITH date_series AS (
                    SELECT generate_series(
                        CURRENT_DATE - %s + 1,
                        CURRENT_DATE,
                        '1 day'::INTERVAL
                    )::DATE as day
                )
                SELECT
                    ds.day::text as date,
                    COALESCE(COUNT(ga.id), 0)::INTEGER as total,
                    COALESCE(COUNT(ga.id) FILTER (WHERE ga.severity = 'critical'), 0)::INTEGER as critical,
                    COALESCE(COUNT(ga.id) FILTER (WHERE ga.severity = 'high'), 0)::INTEGER as high,
                    COALESCE(COUNT(ga.id) FILTER (WHERE ga.severity = 'medium'), 0)::INTEGER as medium,
                    COALESCE(COUNT(ga.id) FILTER (WHERE ga.severity = 'low'), 0)::INTEGER as low
                FROM date_series ds
                LEFT JOIN public.geographic_anomalies ga
                    ON DATE(ga.created_at) = ds.day
                    AND ga.organization_id = %s
                GROUP BY ds.day
                ORDER BY ds.day
                ''',
                (days, organization_id)
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows]

    except Exception as e:
        logger.error(f"[geo_anomaly] Error getting anomaly trend: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving trend data: {str(e)}"
        )


# ============================================================
# INTEGRATION HELPER
# ============================================================

def process_scan_for_anomaly(
    organization_id: str,
    product_id: Optional[str],
    scan_lat: Optional[float],
    scan_lng: Optional[float],
    detected_region: str,
    detected_region_name: str,
    qr_code_id: Optional[str] = None,
    scan_event_id: Optional[str] = None,
    scan_metadata: Optional[dict] = None
) -> Optional[dict]:
    """
    Process a scan event and create an anomaly if needed.
    This is the main integration point for QR scan processing.

    Args:
        organization_id: Organization UUID
        product_id: Product UUID (optional)
        scan_lat: Scan latitude (optional)
        scan_lng: Scan longitude (optional)
        detected_region: Detected region code
        detected_region_name: Detected region name
        qr_code_id: Related QR code ID (optional)
        scan_event_id: Related scan event ID (optional)
        scan_metadata: Additional context (optional)

    Returns:
        Created anomaly record if anomaly detected, None otherwise
    """
    # Skip if no location data
    if scan_lat is None or scan_lng is None:
        return None

    try:
        # Check if location is authorized
        check_result = check_scan_location(
            organization_id,
            product_id,
            scan_lat,
            scan_lng
        )

        if check_result['is_authorized']:
            return None

        # Create anomaly
        return create_anomaly(
            organization_id=organization_id,
            product_id=product_id,
            expected_region=check_result['nearest_region_code'],
            actual_region=detected_region,
            actual_region_name=detected_region_name,
            scan_lat=scan_lat,
            scan_lng=scan_lng,
            distance_km=check_result['distance_km'],
            severity=check_result['severity'],
            anomaly_type='region_mismatch',
            qr_code_id=qr_code_id,
            scan_event_id=scan_event_id,
            scan_metadata=scan_metadata
        )

    except Exception as e:
        logger.error(f"[geo_anomaly] Error processing scan for anomaly: {e}")
        # Don't block the scan on error
        return None
