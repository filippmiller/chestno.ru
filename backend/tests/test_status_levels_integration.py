"""
Unit tests for Status Levels and Subscription Integration

Tests all state transitions:
- active → grants level A
- past_due → starts grace period
- cancelled (within grace) → retains level A
- cancelled (after grace) → revokes level A
"""
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import sys
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


class TestStatusLevelsIntegration(unittest.TestCase):
    """Test status levels integration with subscriptions."""

    def setUp(self):
        """Set up test fixtures."""
        self.org_id = str(uuid4())
        self.subscription_id = str(uuid4())
        self.user_id = str(uuid4())

    @patch('app.services.status_levels.get_connection')
    def test_ensure_level_a_grants_new(self, mock_get_conn):
        """Test granting level A when not exists."""
        from app.services.status_levels import ensure_level_a

        # Mock database - no existing level A
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        # First query: check existing (none found)
        # Second query: grant new level
        new_id = str(uuid4())
        mock_cursor.fetchone.side_effect = [
            None,  # No existing level A
            {'new_id': new_id}  # Grant result
        ]

        mock_get_conn.return_value = mock_conn

        result = ensure_level_a(self.org_id, self.subscription_id, self.user_id)

        self.assertEqual(result['action'], 'granted')
        self.assertEqual(result['status_level_id'], new_id)
        mock_conn.commit.assert_called_once()

    @patch('app.services.status_levels.get_connection')
    def test_ensure_level_a_already_active(self, mock_get_conn):
        """Test ensuring level A when already active."""
        from app.services.status_levels import ensure_level_a

        existing_id = str(uuid4())
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        # Existing active level A
        mock_cursor.fetchone.return_value = {
            'id': existing_id,
            'valid_until': None
        }

        mock_get_conn.return_value = mock_conn

        result = ensure_level_a(self.org_id, self.subscription_id)

        self.assertEqual(result['action'], 'already_active')
        self.assertEqual(result['status_level_id'], existing_id)
        mock_conn.commit.assert_called_once()

    @patch('app.services.status_levels.get_connection')
    def test_start_grace_period(self, mock_get_conn):
        """Test starting grace period."""
        from app.services.status_levels import start_grace_period

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        sub_id = str(uuid4())
        mock_cursor.fetchone.return_value = {'id': sub_id}

        mock_get_conn.return_value = mock_conn

        result = start_grace_period(self.org_id, days=14)

        self.assertEqual(result['action'], 'grace_period_started')
        self.assertIn('grace_period_ends_at', result)
        mock_conn.commit.assert_called_once()

    @patch('app.services.status_levels.get_connection')
    def test_is_grace_period_ended_false(self, mock_get_conn):
        """Test grace period not ended."""
        from app.services.status_levels import is_grace_period_ended

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        # Grace period ends in future
        future_date = datetime.utcnow() + timedelta(days=7)
        mock_cursor.fetchone.return_value = {
            'grace_period_ends_at': future_date
        }

        mock_get_conn.return_value = mock_conn

        result = is_grace_period_ended(self.org_id)

        self.assertFalse(result)

    @patch('app.services.status_levels.get_connection')
    def test_is_grace_period_ended_true(self, mock_get_conn):
        """Test grace period has ended."""
        from app.services.status_levels import is_grace_period_ended

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        # Grace period ended in past
        past_date = datetime.utcnow() - timedelta(days=1)
        mock_cursor.fetchone.return_value = {
            'grace_period_ends_at': past_date
        }

        mock_get_conn.return_value = mock_conn

        result = is_grace_period_ended(self.org_id)

        self.assertTrue(result)

    @patch('app.services.status_levels.get_connection')
    def test_revoke_level_a(self, mock_get_conn):
        """Test revoking level A."""
        from app.services.status_levels import revoke_level_a_for_subscription

        level_id = str(uuid4())
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        # Mock finding level A and revoking
        mock_cursor.fetchone.side_effect = [
            {'id': level_id},  # Find level A
            {'success': True}   # Revoke result
        ]

        mock_get_conn.return_value = mock_conn

        result = revoke_level_a_for_subscription(
            self.org_id,
            self.subscription_id,
            'test_revocation'
        )

        self.assertEqual(result['action'], 'revoked')
        self.assertEqual(result['level_id'], level_id)
        mock_conn.commit.assert_called_once()

    @patch('app.services.status_levels.get_connection')
    @patch('app.services.status_levels.ensure_level_a')
    def test_handle_active_status(self, mock_ensure_a, mock_get_conn):
        """Test handling active subscription status."""
        from app.services.status_levels import handle_subscription_status_change

        mock_ensure_a.return_value = {
            'status_level_id': str(uuid4()),
            'action': 'granted'
        }

        result = handle_subscription_status_change(
            subscription_id=self.subscription_id,
            new_status='active',
            organization_id=self.org_id,
            actor_user_id=self.user_id
        )

        self.assertEqual(result['new_status'], 'active')
        self.assertIn('level_a_action', result)
        mock_ensure_a.assert_called_once()

    @patch('app.services.status_levels.get_connection')
    @patch('app.services.status_levels.start_grace_period')
    def test_handle_past_due_status(self, mock_start_grace, mock_get_conn):
        """Test handling past_due subscription status."""
        from app.services.status_levels import handle_subscription_status_change

        mock_start_grace.return_value = {
            'action': 'grace_period_started',
            'grace_period_ends_at': (datetime.utcnow() + timedelta(days=14)).isoformat()
        }

        result = handle_subscription_status_change(
            subscription_id=self.subscription_id,
            new_status='past_due',
            organization_id=self.org_id
        )

        self.assertEqual(result['new_status'], 'past_due')
        self.assertIn('grace_period_action', result)
        mock_start_grace.assert_called_once_with(org_id=self.org_id, days=14)

    @patch('app.services.status_levels.get_connection')
    @patch('app.services.status_levels.is_grace_period_ended')
    @patch('app.services.status_levels.revoke_level_a_for_subscription')
    def test_handle_cancelled_after_grace(self, mock_revoke, mock_grace_ended, mock_get_conn):
        """Test handling cancelled status after grace period."""
        from app.services.status_levels import handle_subscription_status_change

        mock_grace_ended.return_value = True
        mock_revoke.return_value = {
            'action': 'revoked',
            'level_id': str(uuid4())
        }

        result = handle_subscription_status_change(
            subscription_id=self.subscription_id,
            new_status='cancelled',
            organization_id=self.org_id
        )

        self.assertEqual(result['new_status'], 'cancelled')
        self.assertTrue(result['grace_period_ended'])
        self.assertEqual(result['level_a_action']['action'], 'revoked')
        mock_revoke.assert_called_once()

    @patch('app.services.status_levels.get_connection')
    @patch('app.services.status_levels.is_grace_period_ended')
    def test_handle_cancelled_during_grace(self, mock_grace_ended, mock_get_conn):
        """Test handling cancelled status during grace period."""
        from app.services.status_levels import handle_subscription_status_change

        mock_grace_ended.return_value = False

        result = handle_subscription_status_change(
            subscription_id=self.subscription_id,
            new_status='cancelled',
            organization_id=self.org_id
        )

        self.assertEqual(result['new_status'], 'cancelled')
        self.assertFalse(result['grace_period_ended'])
        self.assertEqual(result['level_a_action']['action'], 'retained')

    @patch('app.services.status_levels.get_connection')
    def test_get_organization_status_summary(self, mock_get_conn):
        """Test getting organization status summary."""
        from app.services.status_levels import get_organization_status_summary

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        # Mock responses
        mock_cursor.fetchall.return_value = [
            {
                'level': 'A',
                'is_active': True,
                'can_use_badge': True,
                'granted_at': datetime.utcnow(),
                'valid_until': None,
                'last_verified_at': None,
                'subscription_id': self.subscription_id
            }
        ]
        mock_cursor.fetchone.side_effect = [
            {
                'status': 'active',
                'grace_period_days': None,
                'grace_period_ends_at': None
            },
            {'current_level': 'A'}
        ]

        mock_get_conn.return_value = mock_conn

        result = get_organization_status_summary(self.org_id)

        self.assertEqual(result['organization_id'], self.org_id)
        self.assertEqual(result['current_level'], 'A')
        self.assertEqual(len(result['active_levels']), 1)
        self.assertIsNotNone(result['subscription'])


class TestSubscriptionStatusUpdate(unittest.TestCase):
    """Test subscription status update with status levels integration."""

    def setUp(self):
        """Set up test fixtures."""
        self.org_id = str(uuid4())
        self.subscription_id = str(uuid4())
        self.user_id = str(uuid4())

    @patch('app.services.subscriptions.get_connection')
    @patch('app.services.status_levels.handle_subscription_status_change')
    def test_update_subscription_status(self, mock_handle_status, mock_get_conn):
        """Test updating subscription status."""
        from app.services.subscriptions import update_subscription_status

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.fetchone.return_value = {
            'organization_id': self.org_id,
            'status': 'active'
        }

        mock_handle_status.return_value = {
            'level_a_action': {'action': 'granted'}
        }

        mock_get_conn.return_value = mock_conn

        result = update_subscription_status(
            subscription_id=self.subscription_id,
            new_status='past_due',
            actor_user_id=self.user_id
        )

        self.assertEqual(result['new_status'], 'past_due')
        self.assertEqual(result['old_status'], 'active')
        mock_handle_status.assert_called_once()
        mock_conn.commit.assert_called_once()


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and error conditions."""

    @patch('app.services.status_levels.get_connection')
    def test_ensure_level_a_no_subscription(self, mock_get_conn):
        """Test ensuring level A with no subscription reference."""
        from app.services.status_levels import ensure_level_a

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        new_id = str(uuid4())
        mock_cursor.fetchone.side_effect = [
            None,  # No existing level
            {'new_id': new_id}
        ]

        mock_get_conn.return_value = mock_conn

        result = ensure_level_a(
            org_id=str(uuid4()),
            subscription_id=str(uuid4())
        )

        self.assertEqual(result['action'], 'granted')

    @patch('app.services.status_levels.get_connection')
    def test_revoke_level_a_not_found(self, mock_get_conn):
        """Test revoking level A that doesn't exist."""
        from app.services.status_levels import revoke_level_a_for_subscription

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor
        mock_cursor.__exit__.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.fetchone.return_value = None

        mock_get_conn.return_value = mock_conn

        result = revoke_level_a_for_subscription(
            org_id=str(uuid4()),
            subscription_id=str(uuid4())
        )

        self.assertEqual(result['action'], 'not_found')


if __name__ == '__main__':
    unittest.main()
