"""
Service layer for Dynamic QR URL System

Handles:
- URL version management
- Campaign scheduling
- A/B test execution
- Redirect resolution with priority handling
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.core.db import get_connection
from app.schemas.qr_dynamic import (
    QRUrlVersion,
    QRUrlVersionCreate,
    QRUrlVersionUpdate,
    QRUrlVersionWithStats,
    QRCampaign,
    QRCampaignCreate,
    QRCampaignUpdate,
    QRCampaignWithStats,
    QRABTest,
    QRABTestCreate,
    QRABTestUpdate,
    QRABTestConclude,
    QRABTestWithVariants,
    QRABTestVariant,
    QRABTestResults,
    ResolvedQRUrl,
    QRDynamicOverview,
    QRUrlVersionHistoryItem,
)

settings = get_settings()

MANAGER_ROLES = ('owner', 'admin', 'manager')
VIEW_ROLES = ('owner', 'admin', 'manager', 'editor', 'analyst', 'viewer')
ANALYTICS_ROLES = ('owner', 'admin', 'manager', 'analyst')


def _ensure_role(cur, organization_id: str, user_id: str, allowed_roles: tuple) -> str:
    """Verify user has required role in organization."""
    cur.execute(
        '''
        SELECT role FROM organization_members
        WHERE organization_id = %s AND user_id = %s
        ''',
        (organization_id, user_id),
    )
    row = cur.fetchone()
    if not row or row['role'] not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    return row['role']


def _get_qr_code_org(cur, qr_code_id: str) -> str:
    """Get organization_id for a QR code."""
    cur.execute('SELECT organization_id FROM qr_codes WHERE id = %s', (qr_code_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR code not found')
    return row['organization_id']


def _log_version_history(
    cur,
    url_version_id: str,
    action: str,
    performed_by: str,
    changes: dict | None = None,
    ip_address: str | None = None
):
    """Log a history entry for URL version changes."""
    cur.execute(
        '''
        INSERT INTO qr_url_version_history (url_version_id, action, changes, performed_by, ip_address)
        VALUES (%s, %s, %s, %s, %s)
        ''',
        (url_version_id, action, changes, performed_by, ip_address)
    )


# ============================================================================
# URL VERSIONS
# ============================================================================

def list_url_versions(qr_code_id: str, user_id: str, include_archived: bool = False) -> list[QRUrlVersionWithStats]:
    """List all URL versions for a QR code."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, VIEW_ROLES)

            now = datetime.now(timezone.utc)
            last7 = now - timedelta(days=7)
            last30 = now - timedelta(days=30)

            archived_clause = "" if include_archived else "AND uv.archived_at IS NULL"

            cur.execute(
                f'''
                SELECT
                    uv.*,
                    COALESCE(stats.total_clicks, 0) as total_clicks,
                    COALESCE(stats.clicks_7d, 0) as clicks_7d,
                    COALESCE(stats.clicks_30d, 0) as clicks_30d,
                    COALESCE(stats.unique_visitors, 0) as unique_visitors
                FROM qr_url_versions uv
                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*) as total_clicks,
                        COUNT(*) FILTER (WHERE occurred_at >= %s) as clicks_7d,
                        COUNT(*) FILTER (WHERE occurred_at >= %s) as clicks_30d,
                        COUNT(DISTINCT ip_hash) as unique_visitors
                    FROM qr_events
                    WHERE url_version_id = uv.id
                ) stats ON true
                WHERE uv.qr_code_id = %s
                {archived_clause}
                ORDER BY uv.version_number DESC
                ''',
                (last7, last30, qr_code_id)
            )
            rows = cur.fetchall()
            return [QRUrlVersionWithStats(**row) for row in rows]


def get_url_version(qr_code_id: str, version_id: str, user_id: str) -> QRUrlVersionWithStats:
    """Get a specific URL version."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, VIEW_ROLES)

            now = datetime.now(timezone.utc)
            last7 = now - timedelta(days=7)
            last30 = now - timedelta(days=30)

            cur.execute(
                '''
                SELECT
                    uv.*,
                    COALESCE(stats.total_clicks, 0) as total_clicks,
                    COALESCE(stats.clicks_7d, 0) as clicks_7d,
                    COALESCE(stats.clicks_30d, 0) as clicks_30d,
                    COALESCE(stats.unique_visitors, 0) as unique_visitors
                FROM qr_url_versions uv
                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*) as total_clicks,
                        COUNT(*) FILTER (WHERE occurred_at >= %s) as clicks_7d,
                        COUNT(*) FILTER (WHERE occurred_at >= %s) as clicks_30d,
                        COUNT(DISTINCT ip_hash) as unique_visitors
                    FROM qr_events
                    WHERE url_version_id = uv.id
                ) stats ON true
                WHERE uv.qr_code_id = %s AND uv.id = %s
                ''',
                (last7, last30, qr_code_id, version_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='URL version not found')
            return QRUrlVersionWithStats(**row)


def create_url_version(qr_code_id: str, user_id: str, payload: QRUrlVersionCreate) -> QRUrlVersion:
    """Create a new URL version for a QR code."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            cur.execute(
                '''
                INSERT INTO qr_url_versions (
                    qr_code_id, name, description, target_url, target_type,
                    is_default, created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (
                    qr_code_id, payload.name, payload.description,
                    payload.target_url, payload.target_type,
                    payload.is_default, user_id
                )
            )
            row = cur.fetchone()

            _log_version_history(cur, row['id'], 'created', user_id)
            conn.commit()

            return QRUrlVersion(**row, total_clicks=0)


def update_url_version(
    qr_code_id: str,
    version_id: str,
    user_id: str,
    payload: QRUrlVersionUpdate
) -> QRUrlVersion:
    """Update a URL version."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            # Get existing
            cur.execute(
                'SELECT * FROM qr_url_versions WHERE qr_code_id = %s AND id = %s',
                (qr_code_id, version_id)
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='URL version not found')

            # Build update
            updates = []
            params = []
            changes = {}

            for field in ['name', 'description', 'target_url', 'target_type', 'is_default', 'is_active']:
                value = getattr(payload, field, None)
                if value is not None:
                    updates.append(f'{field} = %s')
                    params.append(value)
                    if existing.get(field) != value:
                        changes[field] = {'old': existing.get(field), 'new': value}

            if not updates:
                return QRUrlVersion(**existing, total_clicks=0)

            params.extend([qr_code_id, version_id])
            cur.execute(
                f'''
                UPDATE qr_url_versions
                SET {', '.join(updates)}, updated_at = NOW()
                WHERE qr_code_id = %s AND id = %s
                RETURNING *
                ''',
                params
            )
            row = cur.fetchone()

            # Log history
            action = 'updated'
            if 'is_active' in changes:
                action = 'activated' if changes['is_active']['new'] else 'deactivated'

            _log_version_history(cur, version_id, action, user_id, changes)
            conn.commit()

            return QRUrlVersion(**row, total_clicks=0)


def archive_url_version(qr_code_id: str, version_id: str, user_id: str) -> None:
    """Archive a URL version (soft delete)."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            # Check it's not the only default
            cur.execute(
                '''
                SELECT is_default FROM qr_url_versions
                WHERE qr_code_id = %s AND id = %s AND archived_at IS NULL
                ''',
                (qr_code_id, version_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='URL version not found')

            if row['is_default']:
                # Check if there are other versions to become default
                cur.execute(
                    '''
                    SELECT COUNT(*) as cnt FROM qr_url_versions
                    WHERE qr_code_id = %s AND id != %s AND archived_at IS NULL
                    ''',
                    (qr_code_id, version_id)
                )
                if cur.fetchone()['cnt'] == 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail='Cannot archive the only URL version'
                    )

            cur.execute(
                '''
                UPDATE qr_url_versions
                SET archived_at = NOW(), is_active = false, is_default = false
                WHERE qr_code_id = %s AND id = %s
                ''',
                (qr_code_id, version_id)
            )

            _log_version_history(cur, version_id, 'archived', user_id)
            conn.commit()


def get_version_history(
    qr_code_id: str,
    version_id: str,
    user_id: str,
    limit: int = 50
) -> list[QRUrlVersionHistoryItem]:
    """Get history for a URL version."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, ANALYTICS_ROLES)

            # Verify version belongs to QR code
            cur.execute(
                'SELECT id FROM qr_url_versions WHERE qr_code_id = %s AND id = %s',
                (qr_code_id, version_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='URL version not found')

            cur.execute(
                '''
                SELECT * FROM qr_url_version_history
                WHERE url_version_id = %s
                ORDER BY performed_at DESC
                LIMIT %s
                ''',
                (version_id, limit)
            )
            rows = cur.fetchall()
            return [QRUrlVersionHistoryItem(**row) for row in rows]


# ============================================================================
# CAMPAIGNS
# ============================================================================

def list_campaigns(
    qr_code_id: str,
    user_id: str,
    status_filter: str | None = None
) -> list[QRCampaignWithStats]:
    """List all campaigns for a QR code."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, VIEW_ROLES)

            status_clause = ""
            params = [qr_code_id]
            if status_filter:
                status_clause = "AND c.status = %s"
                params.append(status_filter)

            cur.execute(
                f'''
                SELECT
                    c.*,
                    uv.name as url_version_name,
                    COALESCE(stats.total_clicks, 0) as total_clicks,
                    COALESCE(stats.unique_visitors, 0) as unique_visitors
                FROM qr_campaigns c
                JOIN qr_url_versions uv ON uv.id = c.url_version_id
                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*) as total_clicks,
                        COUNT(DISTINCT ip_hash) as unique_visitors
                    FROM qr_events
                    WHERE campaign_id = c.id
                ) stats ON true
                WHERE c.qr_code_id = %s {status_clause}
                ORDER BY c.starts_at DESC
                ''',
                params
            )
            rows = cur.fetchall()
            return [QRCampaignWithStats(**row) for row in rows]


def create_campaign(qr_code_id: str, user_id: str, payload: QRCampaignCreate) -> QRCampaign:
    """Create a new campaign."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            # Verify URL version belongs to this QR code
            cur.execute(
                'SELECT id FROM qr_url_versions WHERE qr_code_id = %s AND id = %s',
                (qr_code_id, payload.url_version_id)
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='URL version not found or does not belong to this QR code'
                )

            # Determine initial status
            now = datetime.now(timezone.utc)
            initial_status = 'scheduled'
            if payload.starts_at <= now:
                if payload.ends_at is None or payload.ends_at > now:
                    initial_status = 'active'
                else:
                    initial_status = 'completed'

            cur.execute(
                '''
                INSERT INTO qr_campaigns (
                    qr_code_id, url_version_id, name, description,
                    starts_at, ends_at, timezone, priority, recurrence_rule,
                    status, created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (
                    qr_code_id, payload.url_version_id, payload.name, payload.description,
                    payload.starts_at, payload.ends_at, payload.timezone, payload.priority,
                    payload.recurrence_rule, initial_status, user_id
                )
            )
            row = cur.fetchone()
            conn.commit()

            return QRCampaign(**row)


def update_campaign(
    qr_code_id: str,
    campaign_id: str,
    user_id: str,
    payload: QRCampaignUpdate
) -> QRCampaign:
    """Update a campaign."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            # Verify campaign exists
            cur.execute(
                'SELECT * FROM qr_campaigns WHERE qr_code_id = %s AND id = %s',
                (qr_code_id, campaign_id)
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Campaign not found')

            # Build update
            updates = []
            params = []

            for field in ['name', 'description', 'url_version_id', 'starts_at', 'ends_at',
                          'timezone', 'priority', 'recurrence_rule', 'status']:
                value = getattr(payload, field, None)
                if value is not None:
                    updates.append(f'{field} = %s')
                    params.append(value)

            if not updates:
                return QRCampaign(**existing)

            params.extend([qr_code_id, campaign_id])
            cur.execute(
                f'''
                UPDATE qr_campaigns
                SET {', '.join(updates)}, updated_at = NOW()
                WHERE qr_code_id = %s AND id = %s
                RETURNING *
                ''',
                params
            )
            row = cur.fetchone()
            conn.commit()

            return QRCampaign(**row)


def delete_campaign(qr_code_id: str, campaign_id: str, user_id: str) -> None:
    """Delete a campaign."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            cur.execute(
                'DELETE FROM qr_campaigns WHERE qr_code_id = %s AND id = %s',
                (qr_code_id, campaign_id)
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Campaign not found')
            conn.commit()


# ============================================================================
# A/B TESTS
# ============================================================================

def list_ab_tests(
    qr_code_id: str,
    user_id: str,
    status_filter: str | None = None
) -> list[QRABTestWithVariants]:
    """List all A/B tests for a QR code."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, VIEW_ROLES)

            status_clause = ""
            params = [qr_code_id]
            if status_filter:
                status_clause = "AND status = %s"
                params.append(status_filter)

            cur.execute(
                f'''
                SELECT * FROM qr_ab_tests
                WHERE qr_code_id = %s {status_clause}
                ORDER BY created_at DESC
                ''',
                params
            )
            tests = cur.fetchall()

            result = []
            for test in tests:
                # Get variants
                cur.execute(
                    '''
                    SELECT atv.*, uv.name as url_version_name
                    FROM qr_ab_test_variants atv
                    JOIN qr_url_versions uv ON uv.id = atv.url_version_id
                    WHERE atv.ab_test_id = %s
                    ORDER BY atv.weight DESC
                    ''',
                    (test['id'],)
                )
                variants = cur.fetchall()
                total_clicks = sum(v['total_clicks'] for v in variants)

                result.append(QRABTestWithVariants(
                    **test,
                    variants=[QRABTestVariant(**v) for v in variants],
                    total_clicks=total_clicks
                ))

            return result


def create_ab_test(qr_code_id: str, user_id: str, payload: QRABTestCreate) -> QRABTestWithVariants:
    """Create a new A/B test."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            # Check no other running test
            cur.execute(
                '''
                SELECT id FROM qr_ab_tests
                WHERE qr_code_id = %s AND status = 'running'
                ''',
                (qr_code_id,)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='Another A/B test is already running for this QR code'
                )

            # Verify all URL versions belong to this QR code
            version_ids = [v.url_version_id for v in payload.variants]
            cur.execute(
                '''
                SELECT id FROM qr_url_versions
                WHERE qr_code_id = %s AND id = ANY(%s)
                ''',
                (qr_code_id, version_ids)
            )
            found_ids = {row['id'] for row in cur.fetchall()}
            missing = set(version_ids) - found_ids
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'URL versions not found: {missing}'
                )

            # Create test
            starts_at = payload.starts_at or datetime.now(timezone.utc)
            cur.execute(
                '''
                INSERT INTO qr_ab_tests (
                    qr_code_id, name, description, hypothesis,
                    starts_at, ends_at, status,
                    min_sample_size, confidence_level, created_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                ''',
                (
                    qr_code_id, payload.name, payload.description, payload.hypothesis,
                    starts_at, payload.ends_at, 'draft',
                    payload.min_sample_size, payload.confidence_level, user_id
                )
            )
            test = cur.fetchone()

            # Create variants
            variants = []
            for v in payload.variants:
                cur.execute(
                    '''
                    INSERT INTO qr_ab_test_variants (
                        ab_test_id, url_version_id, variant_name, weight
                    )
                    VALUES (%s, %s, %s, %s)
                    RETURNING *
                    ''',
                    (test['id'], v.url_version_id, v.variant_name, v.weight)
                )
                variants.append(cur.fetchone())

            conn.commit()

            return QRABTestWithVariants(
                **test,
                variants=[QRABTestVariant(**v) for v in variants],
                total_clicks=0
            )


def start_ab_test(qr_code_id: str, test_id: str, user_id: str) -> QRABTestWithVariants:
    """Start an A/B test."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            # Verify test exists and is in draft/paused status
            cur.execute(
                '''
                SELECT * FROM qr_ab_tests
                WHERE qr_code_id = %s AND id = %s
                ''',
                (qr_code_id, test_id)
            )
            test = cur.fetchone()
            if not test:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='A/B test not found')

            if test['status'] not in ('draft', 'paused'):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'Cannot start test in {test["status"]} status'
                )

            # Check no other running test
            cur.execute(
                '''
                SELECT id FROM qr_ab_tests
                WHERE qr_code_id = %s AND status = 'running' AND id != %s
                ''',
                (qr_code_id, test_id)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='Another A/B test is already running'
                )

            # Start test
            cur.execute(
                '''
                UPDATE qr_ab_tests
                SET status = 'running', starts_at = COALESCE(starts_at, NOW()), updated_at = NOW()
                WHERE id = %s
                RETURNING *
                ''',
                (test_id,)
            )
            test = cur.fetchone()

            # Get variants
            cur.execute(
                'SELECT * FROM qr_ab_test_variants WHERE ab_test_id = %s',
                (test_id,)
            )
            variants = cur.fetchall()

            conn.commit()

            return QRABTestWithVariants(
                **test,
                variants=[QRABTestVariant(**v) for v in variants],
                total_clicks=sum(v['total_clicks'] for v in variants)
            )


def pause_ab_test(qr_code_id: str, test_id: str, user_id: str) -> QRABTestWithVariants:
    """Pause a running A/B test."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            cur.execute(
                '''
                UPDATE qr_ab_tests
                SET status = 'paused', updated_at = NOW()
                WHERE qr_code_id = %s AND id = %s AND status = 'running'
                RETURNING *
                ''',
                (qr_code_id, test_id)
            )
            test = cur.fetchone()
            if not test:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='A/B test not found or not running'
                )

            cur.execute(
                'SELECT * FROM qr_ab_test_variants WHERE ab_test_id = %s',
                (test_id,)
            )
            variants = cur.fetchall()

            conn.commit()

            return QRABTestWithVariants(
                **test,
                variants=[QRABTestVariant(**v) for v in variants],
                total_clicks=sum(v['total_clicks'] for v in variants)
            )


def conclude_ab_test(
    qr_code_id: str,
    test_id: str,
    user_id: str,
    payload: QRABTestConclude
) -> QRABTestWithVariants:
    """Conclude an A/B test with a winner."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, MANAGER_ROLES)

            # Verify test exists
            cur.execute(
                '''
                SELECT * FROM qr_ab_tests
                WHERE qr_code_id = %s AND id = %s
                ''',
                (qr_code_id, test_id)
            )
            test = cur.fetchone()
            if not test:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='A/B test not found')

            if test['status'] == 'concluded':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='Test is already concluded'
                )

            # Verify winning variant belongs to this test
            cur.execute(
                '''
                SELECT url_version_id FROM qr_ab_test_variants
                WHERE ab_test_id = %s AND id = %s
                ''',
                (test_id, payload.winning_variant_id)
            )
            variant = cur.fetchone()
            if not variant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='Winning variant not found in this test'
                )

            # Conclude test
            cur.execute(
                '''
                UPDATE qr_ab_tests
                SET status = 'concluded',
                    winning_variant_id = %s,
                    concluded_at = NOW(),
                    concluded_by = %s,
                    conclusion_notes = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
                ''',
                (payload.winning_variant_id, user_id, payload.conclusion_notes, test_id)
            )
            test = cur.fetchone()

            # Optionally apply winner as default
            if payload.apply_winner:
                cur.execute(
                    '''
                    UPDATE qr_url_versions
                    SET is_default = true
                    WHERE id = %s
                    ''',
                    (variant['url_version_id'],)
                )

            # Get variants
            cur.execute(
                'SELECT * FROM qr_ab_test_variants WHERE ab_test_id = %s',
                (test_id,)
            )
            variants = cur.fetchall()

            conn.commit()

            return QRABTestWithVariants(
                **test,
                variants=[QRABTestVariant(**v) for v in variants],
                total_clicks=sum(v['total_clicks'] for v in variants)
            )


def get_ab_test_results(qr_code_id: str, test_id: str, user_id: str) -> QRABTestResults:
    """Get statistical results for an A/B test."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, ANALYTICS_ROLES)

            cur.execute(
                '''
                SELECT * FROM qr_ab_tests
                WHERE qr_code_id = %s AND id = %s
                ''',
                (qr_code_id, test_id)
            )
            test = cur.fetchone()
            if not test:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='A/B test not found')

            cur.execute(
                'SELECT * FROM qr_ab_test_variants WHERE ab_test_id = %s ORDER BY total_clicks DESC',
                (test_id,)
            )
            variants = cur.fetchall()

            total_clicks = sum(v['total_clicks'] for v in variants)
            has_enough_data = total_clicks >= test['min_sample_size']

            # Simple statistical analysis
            recommended_winner = None
            confidence = 0.0
            improvement_percent = 0.0

            if len(variants) >= 2 and has_enough_data:
                # Sort by clicks
                sorted_variants = sorted(variants, key=lambda x: x['total_clicks'], reverse=True)
                best = sorted_variants[0]
                second = sorted_variants[1]

                if second['total_clicks'] > 0:
                    improvement_percent = ((best['total_clicks'] - second['total_clicks']) / second['total_clicks']) * 100

                # Simplified confidence (would use proper statistical test in production)
                if best['total_clicks'] > second['total_clicks'] * 1.1:  # 10% better
                    confidence = 0.95
                    recommended_winner = best['id']
                elif best['total_clicks'] > second['total_clicks']:
                    confidence = 0.75
                    recommended_winner = best['id']

            days_running = 0
            if test['starts_at']:
                days_running = (datetime.now(timezone.utc) - test['starts_at']).days

            return QRABTestResults(
                test_id=test_id,
                status=test['status'],
                total_clicks=total_clicks,
                variants=[QRABTestVariant(**v) for v in variants],
                has_enough_data=has_enough_data,
                recommended_winner=recommended_winner,
                confidence=confidence,
                improvement_percent=improvement_percent,
                days_running=days_running
            )


# ============================================================================
# REDIRECT RESOLUTION
# ============================================================================

def resolve_redirect_url(
    qr_code_id: str,
    visitor_hash: str | None = None
) -> ResolvedQRUrl:
    """
    Resolve the target URL for a QR code redirect.

    Priority order:
    1. Running A/B test (with traffic splitting)
    2. Active campaign (highest priority wins)
    3. Default URL version
    4. Legacy behavior (from qr_codes table)
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Use the database function for resolution
            cur.execute(
                'SELECT * FROM get_active_qr_url(%s, %s)',
                (qr_code_id, visitor_hash)
            )
            row = cur.fetchone()

            if row and row['target_url']:
                resolution_type = 'default'
                if row['ab_test_id']:
                    resolution_type = 'ab_test'
                elif row['campaign_id']:
                    resolution_type = 'campaign'

                return ResolvedQRUrl(
                    target_url=row['target_url'],
                    url_version_id=row['url_version_id'],
                    campaign_id=row['campaign_id'],
                    ab_test_id=row['ab_test_id'],
                    ab_variant_id=row['ab_variant_id'],
                    resolution_type=resolution_type
                )

            # Fallback to legacy behavior
            cur.execute(
                '''
                SELECT qc.target_slug, o.slug as org_slug
                FROM qr_codes qc
                JOIN organizations o ON o.id = qc.organization_id
                WHERE qc.id = %s
                ''',
                (qr_code_id,)
            )
            legacy = cur.fetchone()
            if legacy:
                target_slug = legacy['target_slug'] or legacy['org_slug']
                return ResolvedQRUrl(
                    target_url=f'/org/{target_slug}',
                    resolution_type='legacy'
                )

            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='QR code not found')


# ============================================================================
# OVERVIEW & ANALYTICS
# ============================================================================

def get_dynamic_overview(qr_code_id: str, user_id: str) -> QRDynamicOverview:
    """Get overview of dynamic QR features for a QR code."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_id = _get_qr_code_org(cur, qr_code_id)
            _ensure_role(cur, org_id, user_id, VIEW_ROLES)

            now = datetime.now(timezone.utc)
            last30 = now - timedelta(days=30)

            # Count versions
            cur.execute(
                '''
                SELECT COUNT(*) as cnt FROM qr_url_versions
                WHERE qr_code_id = %s AND archived_at IS NULL
                ''',
                (qr_code_id,)
            )
            total_versions = cur.fetchone()['cnt']

            # Get active/default version
            cur.execute(
                '''
                SELECT * FROM qr_url_versions
                WHERE qr_code_id = %s AND is_default = true AND archived_at IS NULL
                LIMIT 1
                ''',
                (qr_code_id,)
            )
            active_version = cur.fetchone()

            # Get active campaign
            cur.execute(
                '''
                SELECT c.*, uv.name as url_version_name
                FROM qr_campaigns c
                JOIN qr_url_versions uv ON uv.id = c.url_version_id
                WHERE c.qr_code_id = %s
                  AND c.status IN ('scheduled', 'active')
                  AND c.starts_at <= %s
                  AND (c.ends_at IS NULL OR c.ends_at > %s)
                ORDER BY c.priority DESC
                LIMIT 1
                ''',
                (qr_code_id, now, now)
            )
            active_campaign = cur.fetchone()

            # Get running A/B test
            cur.execute(
                '''
                SELECT * FROM qr_ab_tests
                WHERE qr_code_id = %s AND status = 'running'
                LIMIT 1
                ''',
                (qr_code_id,)
            )
            running_test = cur.fetchone()

            # Get click stats
            cur.execute(
                '''
                SELECT
                    COUNT(*) as total_all_time,
                    COUNT(*) FILTER (WHERE occurred_at >= %s) as total_30d
                FROM qr_events
                WHERE qr_code_id = %s
                ''',
                (last30, qr_code_id)
            )
            stats = cur.fetchone()

            return QRDynamicOverview(
                qr_code_id=qr_code_id,
                total_versions=total_versions,
                active_version=QRUrlVersion(**active_version, total_clicks=0) if active_version else None,
                active_campaign=QRCampaign(**active_campaign) if active_campaign else None,
                running_ab_test=QRABTest(**running_test) if running_test else None,
                total_clicks_all_time=stats['total_all_time'] or 0,
                total_clicks_30d=stats['total_30d'] or 0
            )
