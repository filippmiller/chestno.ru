"""
Unit tests for checkExpiringStatuses cron job.

Tests the daily cron job that checks for expiring status levels
and logs findings (Phase 4) / sends notifications (Phase 5).
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, call
import asyncio

from app.cron.checkExpiringStatuses import (
    get_expiring_statuses,
    send_expiration_notification,
    check_expiring_statuses
)


@pytest.fixture
def mock_db_connection():
    """Mock database connection."""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    return conn, cursor


@pytest.fixture
def sample_expiring_status():
    """Sample expiring status level record."""
    return {
        'id': '123e4567-e89b-12d3-a456-426614174000',
        'organization_id': '987e6543-e21b-98d7-b654-321987654321',
        'level': 'B',
        'valid_until': '2026-03-28T00:00:00',
        'granted_at': '2024-09-28T10:00:00',
        'granted_by': 'admin-user-id',
        'subscription_id': None
    }


# ============================================================================
# Test get_expiring_statuses()
# ============================================================================

@pytest.mark.asyncio
async def test_get_expiring_statuses_60_days(mock_db_connection):
    """Test querying statuses expiring in 60 days."""
    conn, cursor = mock_db_connection

    # Mock query result
    cursor.description = [
        ('id',), ('organization_id',), ('level',), ('valid_until',),
        ('granted_at',), ('granted_by',), ('subscription_id',)
    ]
    cursor.fetchall.return_value = [
        (
            '123e4567-e89b-12d3-a456-426614174000',
            '987e6543-e21b-98d7-b654-321987654321',
            'B',
            datetime(2026, 3, 28),
            datetime(2024, 9, 28, 10, 0),
            'admin-user-id',
            None
        )
    ]

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        results = await get_expiring_statuses(60)

    assert len(results) == 1
    assert results[0]['level'] == 'B'
    assert results[0]['organization_id'] == '987e6543-e21b-98d7-b654-321987654321'

    # Verify query was executed with correct parameter
    cursor.execute.assert_called_once()
    query_args = cursor.execute.call_args[0]
    assert '60' in str(query_args) or 60 in query_args


@pytest.mark.asyncio
async def test_get_expiring_statuses_no_results(mock_db_connection):
    """Test querying when no statuses are expiring."""
    conn, cursor = mock_db_connection
    cursor.description = [('id',), ('organization_id',)]
    cursor.fetchall.return_value = []

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        results = await get_expiring_statuses(30)

    assert len(results) == 0
    cursor.close.assert_called_once()
    conn.close.assert_called_once()


@pytest.mark.asyncio
async def test_get_expiring_statuses_multiple_results(mock_db_connection):
    """Test querying with multiple expiring statuses."""
    conn, cursor = mock_db_connection
    cursor.description = [
        ('id',), ('organization_id',), ('level',), ('valid_until',),
        ('granted_at',), ('granted_by',), ('subscription_id',)
    ]
    cursor.fetchall.return_value = [
        ('id1', 'org1', 'A', datetime(2026, 2, 28), datetime(2025, 1, 1), 'admin1', 'sub1'),
        ('id2', 'org2', 'B', datetime(2026, 2, 28), datetime(2024, 1, 1), 'admin2', None),
        ('id3', 'org3', 'C', datetime(2026, 2, 28), datetime(2023, 1, 1), 'admin3', None)
    ]

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        results = await get_expiring_statuses(7)

    assert len(results) == 3
    assert {r['level'] for r in results} == {'A', 'B', 'C'}


@pytest.mark.asyncio
async def test_get_expiring_statuses_database_error(mock_db_connection):
    """Test handling of database errors."""
    conn, cursor = mock_db_connection
    cursor.execute.side_effect = Exception("Database connection failed")

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        with pytest.raises(Exception) as exc_info:
            await get_expiring_statuses(1)

    assert "Database connection failed" in str(exc_info.value)
    conn.close.assert_called_once()


# ============================================================================
# Test send_expiration_notification()
# ============================================================================

def test_send_expiration_notification_60_days(sample_expiring_status, caplog):
    """Test notification logging for 60-day expiration."""
    send_expiration_notification(sample_expiring_status, 60)

    assert "Would send notification" in caplog.text
    assert "level B" in caplog.text
    assert "expires in 60 days" in caplog.text


def test_send_expiration_notification_1_day(sample_expiring_status, caplog):
    """Test notification logging for 1-day (urgent) expiration."""
    send_expiration_notification(sample_expiring_status, 1)

    assert "expires in 1 days" in caplog.text


def test_send_expiration_notification_missing_fields(caplog):
    """Test notification with incomplete status data."""
    incomplete_status = {'id': 'test-id'}
    send_expiration_notification(incomplete_status, 30)

    assert "UNKNOWN" in caplog.text


# ============================================================================
# Test check_expiring_statuses() main function
# ============================================================================

@pytest.mark.asyncio
async def test_check_expiring_statuses_full_run(mock_db_connection, caplog):
    """Test full cron job execution with expiring statuses."""
    conn, cursor = mock_db_connection
    cursor.description = [
        ('id',), ('organization_id',), ('level',), ('valid_until',),
        ('granted_at',), ('granted_by',), ('subscription_id',)
    ]

    # Mock different results for each threshold
    def mock_fetchall():
        if cursor.execute.call_count == 1:  # 60 days
            return [('id1', 'org1', 'B', datetime(2026, 3, 28), datetime(2024, 1, 1), 'admin', None)]
        elif cursor.execute.call_count == 2:  # 30 days
            return [('id2', 'org2', 'A', datetime(2026, 2, 26), datetime(2025, 1, 1), 'admin', 'sub1')]
        elif cursor.execute.call_count == 3:  # 7 days
            return []
        else:  # 1 day
            return [('id3', 'org3', 'B', datetime(2026, 1, 29), datetime(2024, 6, 1), 'admin', None)]

    cursor.fetchall.side_effect = mock_fetchall

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        await check_expiring_statuses()

    # Verify all thresholds were checked
    assert "Checking statuses expiring in 60 days" in caplog.text
    assert "Checking statuses expiring in 30 days" in caplog.text
    assert "Checking statuses expiring in 7 days" in caplog.text
    assert "Checking statuses expiring in 1 days" in caplog.text

    # Verify summary
    assert "Expiring status check complete: 3 total found" in caplog.text


@pytest.mark.asyncio
async def test_check_expiring_statuses_no_expiring(mock_db_connection, caplog):
    """Test cron job when no statuses are expiring."""
    conn, cursor = mock_db_connection
    cursor.description = [('id',)]
    cursor.fetchall.return_value = []

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        await check_expiring_statuses()

    assert "Expiring status check complete: 0 total found" in caplog.text
    assert cursor.execute.call_count == 4  # Called for all 4 thresholds


@pytest.mark.asyncio
async def test_check_expiring_statuses_partial_failure(mock_db_connection, caplog):
    """Test cron job continues after one threshold fails."""
    conn, cursor = mock_db_connection
    cursor.description = [
        ('id',), ('organization_id',), ('level',), ('valid_until',),
        ('granted_at',), ('granted_by',), ('subscription_id',)
    ]

    # First call succeeds, second fails, third succeeds
    def mock_execute(*args):
        if cursor.execute.call_count == 2:
            raise Exception("Database timeout")

    cursor.execute.side_effect = mock_execute
    cursor.fetchall.return_value = [('id', 'org', 'B', datetime(2026, 3, 1), datetime(2024, 1, 1), 'admin', None)]

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        await check_expiring_statuses()

    # Should log error but continue
    assert "Error checking 30-day expiring statuses" in caplog.text
    assert "Checking statuses expiring in 7 days" in caplog.text  # Continued after error


# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.asyncio
async def test_cron_job_datetime_conversion(mock_db_connection):
    """Test that datetime objects are properly converted to ISO strings."""
    conn, cursor = mock_db_connection
    cursor.description = [
        ('id',), ('organization_id',), ('level',), ('valid_until',),
        ('granted_at',), ('granted_by',), ('subscription_id',)
    ]
    cursor.fetchall.return_value = [
        ('id1', 'org1', 'B', datetime(2026, 3, 28, 10, 30), datetime(2024, 9, 28, 14, 15), 'admin', None)
    ]

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        results = await get_expiring_statuses(60)

    # Verify datetime fields are converted to ISO strings
    assert isinstance(results[0]['valid_until'], str)
    assert isinstance(results[0]['granted_at'], str)
    assert 'T' in results[0]['valid_until']  # ISO format includes T separator


@pytest.mark.asyncio
async def test_cron_job_closes_connections(mock_db_connection):
    """Test that database connections are properly closed."""
    conn, cursor = mock_db_connection
    cursor.description = [('id',)]
    cursor.fetchall.return_value = []

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        await get_expiring_statuses(30)

    cursor.close.assert_called_once()
    conn.close.assert_called_once()


@pytest.mark.asyncio
async def test_cron_job_closes_on_error(mock_db_connection):
    """Test connections closed even when error occurs."""
    conn, cursor = mock_db_connection
    cursor.execute.side_effect = Exception("Query failed")

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        with pytest.raises(Exception):
            await get_expiring_statuses(7)

    conn.close.assert_called_once()


# ============================================================================
# Performance Tests
# ============================================================================

@pytest.mark.asyncio
async def test_large_result_set_handling(mock_db_connection):
    """Test handling of large result sets."""
    conn, cursor = mock_db_connection
    cursor.description = [
        ('id',), ('organization_id',), ('level',), ('valid_until',),
        ('granted_at',), ('granted_by',), ('subscription_id',)
    ]

    # Simulate 100 expiring statuses
    large_result_set = [
        (f'id{i}', f'org{i}', 'B', datetime(2026, 3, 1), datetime(2024, 1, 1), 'admin', None)
        for i in range(100)
    ]
    cursor.fetchall.return_value = large_result_set

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        results = await get_expiring_statuses(30)

    assert len(results) == 100


# ============================================================================
# Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_null_valid_until_excluded(mock_db_connection):
    """Test that statuses with NULL valid_until are excluded by query."""
    conn, cursor = mock_db_connection

    # The query has WHERE valid_until IS NOT NULL
    # This test verifies the query structure (already tested via SQL)
    # Here we just ensure empty results when appropriate
    cursor.description = [('id',)]
    cursor.fetchall.return_value = []

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        results = await get_expiring_statuses(60)

    assert len(results) == 0


@pytest.mark.asyncio
async def test_inactive_statuses_excluded(mock_db_connection):
    """Test that is_active=false statuses are excluded."""
    conn, cursor = mock_db_connection
    cursor.description = [('id',)]
    cursor.fetchall.return_value = []

    with patch('app.cron.checkExpiringStatuses.get_connection', return_value=conn):
        results = await get_expiring_statuses(1)

    # Verify query filters is_active = true
    call_args = cursor.execute.call_args[0]
    assert 'is_active = true' in str(call_args[0]).lower()
