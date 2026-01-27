"""
Unit tests for PaymentService

These tests verify the core payment processing logic.
Uses mocks for database and YooKassa SDK calls.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from app.services.payments import PaymentService


class TestPaymentService:
    """Test suite for PaymentService"""

    @pytest.fixture
    def mock_db_connection(self):
        """Mock database connection"""
        with patch('app.services.payments.get_connection') as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cursor
            yield mock_cursor

    @pytest.fixture
    def mock_yukassa(self):
        """Mock YukassaProvider"""
        with patch('app.services.payments.YukassaProvider') as mock_provider:
            yield mock_provider

    @pytest.fixture
    def mock_status_levels(self):
        """Mock status_levels service"""
        with patch('app.services.payments.status_levels') as mock_sl:
            yield mock_sl

    def test_initiate_trial_with_preauth_success(self, mock_db_connection, mock_yukassa, mock_status_levels):
        """Test successful trial initiation with pre-auth"""
        # Arrange
        org_id = str(uuid4())
        plan_id = str(uuid4())
        user_id = str(uuid4())
        subscription_id = str(uuid4())

        # Mock plan lookup
        mock_db_connection.fetchone.side_effect = [
            {'id': plan_id, 'name': 'Level A', 'trial_days': 14},  # Plan
            None,  # No existing subscription
            {'id': subscription_id}  # Created subscription
        ]

        # Mock YooKassa payment creation
        mock_yukassa.create_preauth.return_value = {
            'id': 'yukassa_payment_123',
            'confirmation_url': 'https://payment.yukassa.ru/...',
            'amount': {'value': '1.00', 'currency': 'RUB'}
        }

        # Mock status level grant
        mock_status_levels.ensure_level_a.return_value = {
            'status_level_id': str(uuid4()),
            'action': 'granted'
        }

        # Act
        result = PaymentService.initiate_trial_with_preauth(
            organization_id=org_id,
            plan_id=plan_id,
            user_id=user_id
        )

        # Assert
        assert result['checkout_url'] == 'https://payment.yukassa.ru/...'
        assert result['payment_id'] == 'yukassa_payment_123'
        assert result['amount_cents'] == 100
        assert result['currency'] == 'RUB'
        assert 'trial_end' in result

        # Verify YooKassa was called
        mock_yukassa.create_preauth.assert_called_once()

        # Verify status level was granted
        mock_status_levels.ensure_level_a.assert_called_once_with(
            org_id=org_id,
            subscription_id=subscription_id,
            granted_by=user_id
        )

    def test_initiate_trial_plan_not_found(self, mock_db_connection):
        """Test trial initiation fails when plan not found"""
        # Arrange
        mock_db_connection.fetchone.return_value = None

        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            PaymentService.initiate_trial_with_preauth(
                organization_id=str(uuid4()),
                plan_id=str(uuid4()),
                user_id=str(uuid4())
            )

        assert '404' in str(exc_info.value) or 'not found' in str(exc_info.value).lower()

    def test_initiate_trial_existing_subscription(self, mock_db_connection):
        """Test trial initiation fails when org already has active subscription"""
        # Arrange
        plan_id = str(uuid4())

        mock_db_connection.fetchone.side_effect = [
            {'id': plan_id, 'name': 'Level A', 'trial_days': 14},  # Plan
            {'id': str(uuid4())}  # Existing subscription
        ]

        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            PaymentService.initiate_trial_with_preauth(
                organization_id=str(uuid4()),
                plan_id=plan_id,
                user_id=str(uuid4())
            )

        assert '409' in str(exc_info.value) or 'already has' in str(exc_info.value).lower()

    def test_process_payment_success_trial_preauth(self, mock_db_connection, mock_yukassa):
        """Test processing successful trial pre-auth payment"""
        # Arrange
        payment_id = 'yukassa_payment_123'
        transaction_id = str(uuid4())
        subscription_id = str(uuid4())
        org_id = str(uuid4())

        mock_db_connection.fetchone.return_value = {
            'id': transaction_id,
            'organization_id': org_id,
            'subscription_id': subscription_id,
            'transaction_type': 'trial_preauth'
        }

        # Mock refund
        mock_yukassa.refund_payment.return_value = {
            'id': 'refund_123',
            'status': 'succeeded'
        }

        payment_method_info = {
            'last4': '1026',
            'brand': 'Visa'
        }

        # Act
        result = PaymentService.process_payment_success(
            external_payment_id=payment_id,
            payment_method_info=payment_method_info
        )

        # Assert
        assert result['transaction_id'] == transaction_id
        assert result['status'] == 'succeeded'

        # Verify refund was called
        mock_yukassa.refund_payment.assert_called_once_with(
            payment_id=payment_id,
            amount_cents=100,
            reason="Trial pre-authorization refund"
        )

    def test_process_payment_success_subscription_payment(
        self, mock_db_connection, mock_status_levels
    ):
        """Test processing successful subscription payment"""
        # Arrange
        payment_id = 'yukassa_payment_123'
        transaction_id = str(uuid4())
        subscription_id = str(uuid4())
        org_id = str(uuid4())

        mock_db_connection.fetchone.return_value = {
            'id': transaction_id,
            'organization_id': org_id,
            'subscription_id': subscription_id,
            'transaction_type': 'subscription_payment'
        }

        # Mock status level grant
        mock_status_levels.ensure_level_a.return_value = {
            'status_level_id': str(uuid4()),
            'action': 'granted'
        }

        payment_method_info = {
            'last4': '1026',
            'brand': 'Visa'
        }

        # Act
        result = PaymentService.process_payment_success(
            external_payment_id=payment_id,
            payment_method_info=payment_method_info
        )

        # Assert
        assert result['transaction_id'] == transaction_id
        assert result['status'] == 'succeeded'

        # Verify Level A was granted
        mock_status_levels.ensure_level_a.assert_called_once_with(
            org_id=str(org_id),
            subscription_id=str(subscription_id),
            granted_by=None
        )

    def test_process_payment_failure_starts_grace_period(
        self, mock_db_connection, mock_status_levels
    ):
        """Test failed payment starts grace period"""
        # Arrange
        payment_id = 'yukassa_payment_123'
        transaction_id = str(uuid4())
        subscription_id = str(uuid4())
        org_id = str(uuid4())

        mock_db_connection.fetchone.return_value = {
            'id': transaction_id,
            'organization_id': org_id,
            'subscription_id': subscription_id,
            'transaction_type': 'subscription_payment'
        }

        # Mock grace period start
        mock_status_levels.start_grace_period.return_value = {
            'grace_period_ends_at': (datetime.utcnow() + timedelta(days=14)).isoformat(),
            'action': 'grace_period_started'
        }

        failure_reason = 'insufficient_funds'

        # Act
        result = PaymentService.process_payment_failure(
            external_payment_id=payment_id,
            failure_reason=failure_reason
        )

        # Assert
        assert result['transaction_id'] == transaction_id
        assert result['status'] == 'failed'
        assert result['failure_reason'] == failure_reason

        # Verify grace period was started
        mock_status_levels.start_grace_period.assert_called_once_with(
            org_id=str(org_id),
            days=14
        )


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
