"""
Unit tests for Status Levels Service

Tests cover:
- Organization status queries
- Level C eligibility checks
- Granting and revoking status levels
- Caching behavior
- Subscription integration
- Upgrade requests

Run with: pytest backend/tests/test_status_levels.py -v
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException

from app.services import status_levels


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_org_id():
    return "123e4567-e89b-12d3-a456-426614174000"


@pytest.fixture
def mock_user_id():
    return "987e6543-e21b-98d7-b654-321987654321"


@pytest.fixture
def mock_subscription_id():
    return "456e7890-e12b-34d5-c678-543210987654"


@pytest.fixture
def mock_db_connection():
    """Mock database connection and cursor"""
    with patch('app.services.status_levels.get_connection') as mock_conn:
        # Setup mock cursor
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)

        # Setup mock connection
        connection = MagicMock()
        connection.cursor.return_value = mock_cursor
        connection.__enter__ = Mock(return_value=connection)
        connection.__exit__ = Mock(return_value=False)

        mock_conn.return_value = connection

        yield {
            'connection': connection,
            'cursor': mock_cursor,
            'mock': mock_conn
        }


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear cache before each test"""
    status_levels._cache.clear()
    yield
    status_levels._cache.clear()


# ============================================================
# CACHE TESTS
# ============================================================

def test_cache_utilities():
    """Test cache get/set/invalidate functions"""
    # Test set and get
    status_levels._set_cache('test_key', {'data': 'value'}, ttl_seconds=10)
    cached = status_levels._get_cached('test_key')
    assert cached == {'data': 'value'}

    # Test expiration
    status_levels._set_cache('expire_key', {'data': 'value'}, ttl_seconds=0)
    expired = status_levels._get_cached('expire_key')
    assert expired is None

    # Test invalidation
    status_levels._set_cache('org:123:user1', {'data': '1'})
    status_levels._set_cache('org:123:user2', {'data': '2'})
    status_levels._set_cache('org:456:user1', {'data': '3'})

    status_levels._invalidate_cache('123')
    assert status_levels._get_cached('org:123:user1') is None
    assert status_levels._get_cached('org:123:user2') is None
    assert status_levels._get_cached('org:456:user1') == {'data': '3'}


# ============================================================
# ORGANIZATION STATUS TESTS
# ============================================================

def test_get_organization_status_basic(mock_db_connection, mock_org_id):
    """Test basic organization status retrieval"""
    cursor = mock_db_connection['cursor']

    # Mock SQL function response
    cursor.fetchone.side_effect = [
        {'current_level': 'B'},  # get_current_status_level
        [  # active_levels query
            {
                'id': 'level-id',
                'organization_id': mock_org_id,
                'granted_by': None,
                'subscription_id': None,
                'level': 'B',
                'is_active': True,
                'can_use_badge': True,
                'granted_at': datetime.utcnow(),
                'valid_until': datetime.utcnow() + timedelta(days=365),
                'last_verified_at': datetime.utcnow(),
                'notes': None,
                'metadata': None,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
        ]
    ]
    cursor.fetchall.return_value = [
        {
            'id': 'level-id',
            'organization_id': mock_org_id,
            'granted_by': None,
            'subscription_id': None,
            'level': 'B',
            'is_active': True,
            'can_use_badge': True,
            'granted_at': datetime.utcnow(),
            'valid_until': datetime.utcnow() + timedelta(days=365),
            'last_verified_at': datetime.utcnow(),
            'notes': None,
            'metadata': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    ]

    result = status_levels.get_organization_status(mock_org_id)

    assert result['organization_id'] == mock_org_id
    assert result['current_level'] == 'B'
    assert len(result['active_levels']) == 1
    assert result['active_levels'][0]['level'] == 'B'
    assert result['can_manage'] == False


def test_get_organization_status_with_user(mock_db_connection, mock_org_id, mock_user_id):
    """Test organization status with user context"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.side_effect = [
        {'current_level': 'A'},
        {'exists': True},  # User is member
    ]
    cursor.fetchall.return_value = [
        {
            'id': 'level-id',
            'organization_id': mock_org_id,
            'granted_by': None,
            'subscription_id': 'sub-id',
            'level': 'A',
            'is_active': True,
            'can_use_badge': True,
            'granted_at': datetime.utcnow(),
            'valid_until': None,
            'last_verified_at': None,
            'notes': None,
            'metadata': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    ]

    result = status_levels.get_organization_status(mock_org_id, mock_user_id)

    assert result['can_manage'] == True


def test_get_organization_status_caching(mock_db_connection, mock_org_id):
    """Test that organization status is properly cached"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {'current_level': '0'}
    cursor.fetchall.return_value = []

    # First call - should query database
    result1 = status_levels.get_organization_status(mock_org_id)

    # Second call - should use cache
    result2 = status_levels.get_organization_status(mock_org_id)

    # Database should only be queried once
    assert cursor.execute.call_count <= 3  # At most initial queries
    assert result1 == result2


# ============================================================
# LEVEL C ELIGIBILITY TESTS
# ============================================================

def test_check_level_c_eligibility_meets_criteria(mock_db_connection, mock_org_id):
    """Test level C eligibility when all criteria are met"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {
        'result': {
            'meets_criteria': True,
            'criteria': {
                'has_active_b': True,
                'review_count': 20,
                'review_count_needed': 15,
                'response_rate': 90.5,
                'response_rate_needed': 85.0,
                'avg_response_hours': 24.5,
                'avg_response_hours_max': 48.0,
                'public_cases': 2,
                'public_cases_needed': 1
            }
        }
    }

    result = status_levels.check_level_c_eligibility(mock_org_id)

    assert result['meets_criteria'] == True
    assert result['criteria']['has_active_b'] == True
    assert result['criteria']['review_count'] >= 15
    assert result['criteria']['response_rate'] >= 85


def test_check_level_c_eligibility_missing_b(mock_db_connection, mock_org_id):
    """Test level C eligibility when level B is missing"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {
        'result': {
            'meets_criteria': False,
            'criteria': {
                'has_active_b': False,
                'review_count': 20,
                'review_count_needed': 15,
                'response_rate': 90.5,
                'response_rate_needed': 85.0,
                'avg_response_hours': 24.5,
                'avg_response_hours_max': 48.0,
                'public_cases': 2,
                'public_cases_needed': 1
            }
        }
    }

    result = status_levels.check_level_c_eligibility(mock_org_id)

    assert result['meets_criteria'] == False
    assert result['criteria']['has_active_b'] == False


def test_get_level_c_progress(mock_db_connection, mock_org_id):
    """Test getting level C progress details"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {
        'result': {
            'meets_criteria': False,
            'criteria': {
                'has_active_b': True,
                'review_count': 10,
                'review_count_needed': 15,
                'response_rate': 80.0,
                'response_rate_needed': 85.0,
                'avg_response_hours': 30.0,
                'avg_response_hours_max': 48.0,
                'public_cases': 0,
                'public_cases_needed': 1
            }
        }
    }

    progress = status_levels.get_level_c_progress(mock_org_id)

    assert progress['review_count'] == 10
    assert progress['review_count_needed'] == 15
    assert progress['public_cases'] == 0


# ============================================================
# GRANT/REVOKE TESTS
# ============================================================

def test_grant_status_level_b(mock_db_connection, mock_org_id, mock_user_id):
    """Test granting level B status"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.side_effect = [
        {'status_id': 'new-status-id'},
        {
            'id': 'new-status-id',
            'organization_id': mock_org_id,
            'granted_by': mock_user_id,
            'subscription_id': None,
            'level': 'B',
            'is_active': True,
            'can_use_badge': True,
            'granted_at': datetime.utcnow(),
            'valid_until': datetime.utcnow() + timedelta(days=18*30),
            'last_verified_at': datetime.utcnow(),
            'notes': 'Manual grant',
            'metadata': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    ]

    result = status_levels.grant_status_level(
        organization_id=mock_org_id,
        level='B',
        granted_by=mock_user_id,
        notes='Manual grant'
    )

    assert result['level'] == 'B'
    assert result['organization_id'] == mock_org_id
    assert result['granted_by'] == mock_user_id


def test_grant_status_level_c_without_b(mock_db_connection, mock_org_id, mock_user_id):
    """Test that granting level C without B raises error"""
    cursor = mock_db_connection['cursor']

    # Mock eligibility check to return False
    cursor.fetchone.return_value = {
        'result': {
            'meets_criteria': False,
            'criteria': {'has_active_b': False}
        }
    }

    with pytest.raises(HTTPException) as exc_info:
        status_levels.grant_status_level(
            organization_id=mock_org_id,
            level='C',
            granted_by=mock_user_id
        )

    assert exc_info.value.status_code == 400
    assert 'does not meet level C criteria' in exc_info.value.detail


def test_revoke_status_level(mock_db_connection, mock_org_id, mock_user_id):
    """Test revoking a status level"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {'success': True}

    result = status_levels.revoke_status_level(
        organization_id=mock_org_id,
        level='A',
        revoked_by=mock_user_id,
        reason='Subscription cancelled'
    )

    assert result == True


def test_revoke_inactive_level(mock_db_connection, mock_org_id, mock_user_id):
    """Test revoking an already inactive level"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {'success': False}

    result = status_levels.revoke_status_level(
        organization_id=mock_org_id,
        level='B',
        revoked_by=mock_user_id
    )

    assert result == False


# ============================================================
# SUBSCRIPTION INTEGRATION TESTS
# ============================================================

def test_ensure_level_a_new_grant(mock_db_connection, mock_org_id, mock_subscription_id):
    """Test ensuring level A when not exists"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.side_effect = [
        None,  # No existing level A
        {'new_id': 'new-status-id'}
    ]

    result = status_levels.ensure_level_a(
        org_id=mock_org_id,
        subscription_id=mock_subscription_id
    )

    assert result['action'] == 'granted'
    assert 'status_level_id' in result


def test_ensure_level_a_already_exists(mock_db_connection, mock_org_id, mock_subscription_id):
    """Test ensuring level A when already exists"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {
        'id': 'existing-id',
        'valid_until': None
    }

    result = status_levels.ensure_level_a(
        org_id=mock_org_id,
        subscription_id=mock_subscription_id
    )

    assert result['action'] == 'already_active'
    assert result['status_level_id'] == 'existing-id'


def test_revoke_level_a_for_subscription(mock_db_connection, mock_org_id, mock_subscription_id):
    """Test revoking level A tied to a subscription"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.side_effect = [
        {'id': 'level-a-id'},
        {'success': True}
    ]

    result = status_levels.revoke_level_a_for_subscription(
        org_id=mock_org_id,
        subscription_id=mock_subscription_id,
        reason='Subscription expired'
    )

    assert result['action'] == 'revoked'
    assert result['level_id'] == 'level-a-id'


def test_start_grace_period(mock_db_connection, mock_org_id):
    """Test starting grace period for subscription"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {'id': 'sub-id'}

    result = status_levels.start_grace_period(
        org_id=mock_org_id,
        days=14
    )

    assert result['action'] == 'grace_period_started'
    assert 'grace_period_ends_at' in result


def test_is_grace_period_ended_true(mock_db_connection, mock_org_id):
    """Test checking if grace period has ended"""
    cursor = mock_db_connection['cursor']

    # Grace period ended yesterday
    cursor.fetchone.return_value = {
        'grace_period_ends_at': datetime.utcnow() - timedelta(days=1)
    }

    result = status_levels.is_grace_period_ended(mock_org_id)

    assert result == True


def test_is_grace_period_ended_false(mock_db_connection, mock_org_id):
    """Test checking if grace period is still active"""
    cursor = mock_db_connection['cursor']

    # Grace period ends tomorrow
    cursor.fetchone.return_value = {
        'grace_period_ends_at': datetime.utcnow() + timedelta(days=1)
    }

    result = status_levels.is_grace_period_ended(mock_org_id)

    assert result == False


def test_handle_subscription_status_change_active(mock_db_connection, mock_org_id, mock_subscription_id):
    """Test subscription status change to active"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.side_effect = [
        None,  # No existing level A
        {'new_id': 'new-status-id'}
    ]

    result = status_levels.handle_subscription_status_change(
        subscription_id=mock_subscription_id,
        new_status='active',
        organization_id=mock_org_id
    )

    assert result['new_status'] == 'active'
    assert 'level_a_action' in result
    assert result['level_a_action']['action'] == 'granted'


def test_handle_subscription_status_change_past_due(mock_db_connection, mock_org_id, mock_subscription_id):
    """Test subscription status change to past_due"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {'id': 'sub-id'}

    result = status_levels.handle_subscription_status_change(
        subscription_id=mock_subscription_id,
        new_status='past_due',
        organization_id=mock_org_id
    )

    assert result['new_status'] == 'past_due'
    assert 'grace_period_action' in result


# ============================================================
# UPGRADE REQUEST TESTS
# ============================================================

def test_create_upgrade_request(mock_db_connection, mock_org_id, mock_user_id):
    """Test creating an upgrade request"""
    cursor = mock_db_connection['cursor']

    cursor.fetchone.return_value = {
        'id': 'request-id',
        'organization_id': mock_org_id,
        'target_level': 'B',
        'status': 'pending',
        'message': 'We have quality content',
        'evidence_urls': ['https://example.com/proof'],
        'review_notes': None,
        'rejection_reason': None,
        'requested_by': mock_user_id,
        'reviewed_by': None,
        'requested_at': datetime.utcnow(),
        'reviewed_at': None,
        'metadata': None
    }

    result = status_levels.create_upgrade_request(
        organization_id=mock_org_id,
        target_level='B',
        requested_by=mock_user_id,
        message='We have quality content',
        evidence_urls=['https://example.com/proof']
    )

    assert result['target_level'] == 'B'
    assert result['status'] == 'pending'
    assert result['requested_by'] == mock_user_id


def test_create_duplicate_upgrade_request(mock_db_connection, mock_org_id, mock_user_id):
    """Test that duplicate pending request raises error"""
    cursor = mock_db_connection['cursor']

    # Simulate constraint violation
    cursor.execute.side_effect = Exception('idx_one_pending_per_org')

    with pytest.raises(HTTPException) as exc_info:
        status_levels.create_upgrade_request(
            organization_id=mock_org_id,
            target_level='C',
            requested_by=mock_user_id
        )

    assert exc_info.value.status_code == 409
    assert 'already has a pending' in exc_info.value.detail


def test_get_upgrade_requests_for_org(mock_db_connection, mock_org_id):
    """Test getting upgrade requests for organization"""
    cursor = mock_db_connection['cursor']

    cursor.fetchall.return_value = [
        {
            'id': 'request-1',
            'organization_id': mock_org_id,
            'target_level': 'B',
            'status': 'approved',
            'message': None,
            'evidence_urls': None,
            'review_notes': 'Approved',
            'rejection_reason': None,
            'requested_by': 'user-1',
            'reviewed_by': 'admin-1',
            'requested_at': datetime.utcnow() - timedelta(days=1),
            'reviewed_at': datetime.utcnow(),
            'metadata': None
        }
    ]

    results = status_levels.get_upgrade_requests_for_org(mock_org_id)

    assert len(results) == 1
    assert results[0]['target_level'] == 'B'
    assert results[0]['status'] == 'approved'


# ============================================================
# HISTORY TESTS
# ============================================================

def test_get_status_history(mock_db_connection, mock_org_id):
    """Test getting status change history"""
    cursor = mock_db_connection['cursor']

    cursor.fetchall.return_value = [
        {
            'id': 'history-1',
            'organization_id': mock_org_id,
            'level': 'B',
            'action': 'granted',
            'reason': 'Quality content',
            'performed_by': 'admin-id',
            'metadata': None,
            'ip_address': '127.0.0.1',
            'user_agent': 'Mozilla/5.0',
            'created_at': datetime.utcnow()
        }
    ]

    results = status_levels.get_status_history(mock_org_id, limit=10)

    assert len(results) == 1
    assert results[0]['level'] == 'B'
    assert results[0]['action'] == 'granted'
