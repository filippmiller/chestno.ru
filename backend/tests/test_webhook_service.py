"""
Unit tests for WebhookService

Tests webhook signature verification, idempotency, and event processing.
"""

import hashlib
import hmac
import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from app.services.webhooks import WebhookService


class TestWebhookService:
    """Test suite for WebhookService"""

    @pytest.fixture
    def mock_db_connection(self):
        """Mock database connection"""
        with patch('app.services.webhooks.get_connection') as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cursor
            yield mock_cursor

    @pytest.fixture
    def mock_settings(self):
        """Mock settings"""
        with patch('app.services.webhooks.settings') as mock_settings:
            mock_settings.yukassa_webhook_secret = 'test_secret_key'
            yield mock_settings

    @pytest.fixture
    def sample_webhook_payload(self):
        """Sample YooKassa webhook payload"""
        return {
            'type': 'notification',
            'event': 'payment.succeeded',
            'object': {
                'id': 'yukassa_payment_123',
                'status': 'succeeded',
                'amount': {
                    'value': '100.00',
                    'currency': 'RUB'
                },
                'payment_method': {
                    'type': 'bank_card',
                    'card': {
                        'last4': '1026',
                        'card_type': 'Visa'
                    }
                }
            }
        }

    def test_verify_yukassa_signature_valid(self, mock_settings):
        """Test signature verification with valid signature"""
        # Arrange
        payload = b'{"event": "payment.succeeded"}'
        secret = 'test_secret_key'

        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        # Act
        is_valid = WebhookService.verify_yukassa_signature(
            payload=payload,
            signature=expected_signature
        )

        # Assert
        assert is_valid is True

    def test_verify_yukassa_signature_invalid(self, mock_settings):
        """Test signature verification with invalid signature"""
        # Arrange
        payload = b'{"event": "payment.succeeded"}'
        invalid_signature = 'invalid_signature_here'

        # Act
        is_valid = WebhookService.verify_yukassa_signature(
            payload=payload,
            signature=invalid_signature
        )

        # Assert
        assert is_valid is False

    def test_check_idempotency_new_webhook(self, mock_db_connection):
        """Test idempotency check for new webhook"""
        # Arrange
        mock_db_connection.fetchone.return_value = None

        # Act
        is_duplicate = WebhookService.check_idempotency(
            provider='yukassa',
            event_type='payment.succeeded',
            external_transaction_id='yukassa_payment_123'
        )

        # Assert
        assert is_duplicate is False

    def test_check_idempotency_duplicate_webhook(self, mock_db_connection):
        """Test idempotency check for duplicate webhook"""
        # Arrange
        mock_db_connection.fetchone.return_value = {
            'id': str(uuid4()),
            'processed': True
        }

        # Act
        is_duplicate = WebhookService.check_idempotency(
            provider='yukassa',
            event_type='payment.succeeded',
            external_transaction_id='yukassa_payment_123'
        )

        # Assert
        assert is_duplicate is True

    def test_log_webhook_success(self, mock_db_connection):
        """Test webhook logging"""
        # Arrange
        webhook_id = str(uuid4())
        mock_db_connection.fetchone.return_value = {'id': webhook_id}

        payload = {'event': 'payment.succeeded', 'object': {'id': 'test_123'}}

        # Act
        log_id = WebhookService.log_webhook(
            provider='yukassa',
            event_type='payment.succeeded',
            external_transaction_id='test_123',
            payload=payload,
            signature='test_signature',
            processed=True
        )

        # Assert
        assert log_id == webhook_id

    @patch('app.services.webhooks.PaymentService')
    def test_process_webhook_payment_succeeded(
        self, mock_payment_service, mock_db_connection, sample_webhook_payload
    ):
        """Test processing payment.succeeded webhook"""
        # Arrange
        webhook_id = str(uuid4())

        # Mock idempotency check (not duplicate)
        mock_db_connection.fetchone.side_effect = [
            None,  # Idempotency check
            {'id': webhook_id}  # Log webhook
        ]

        # Mock payment service
        mock_payment_service.process_payment_success.return_value = {
            'transaction_id': str(uuid4()),
            'status': 'succeeded'
        }

        # Act
        result = WebhookService.process_webhook(
            provider='yukassa',
            event_type='payment.succeeded',
            payload=sample_webhook_payload
        )

        # Assert
        assert result['success'] is True
        assert result['duplicate'] is False
        mock_payment_service.process_payment_success.assert_called_once()

    @patch('app.services.webhooks.PaymentService')
    def test_process_webhook_payment_failed(
        self, mock_payment_service, mock_db_connection
    ):
        """Test processing payment.failed webhook"""
        # Arrange
        webhook_id = str(uuid4())
        payload = {
            'event': 'payment.failed',
            'object': {
                'id': 'yukassa_payment_123',
                'status': 'failed',
                'cancellation_details': {
                    'reason': 'insufficient_funds'
                }
            }
        }

        # Mock idempotency check
        mock_db_connection.fetchone.side_effect = [
            None,  # Not duplicate
            {'id': webhook_id}  # Log webhook
        ]

        # Mock payment service
        mock_payment_service.process_payment_failure.return_value = {
            'transaction_id': str(uuid4()),
            'status': 'failed'
        }

        # Act
        result = WebhookService.process_webhook(
            provider='yukassa',
            event_type='payment.failed',
            payload=payload
        )

        # Assert
        assert result['success'] is True
        mock_payment_service.process_payment_failure.assert_called_once_with(
            external_payment_id='yukassa_payment_123',
            failure_reason='insufficient_funds'
        )

    def test_process_webhook_duplicate(self, mock_db_connection):
        """Test processing duplicate webhook"""
        # Arrange
        mock_db_connection.fetchone.return_value = {
            'id': str(uuid4()),
            'processed': True
        }

        payload = {
            'event': 'payment.succeeded',
            'object': {'id': 'yukassa_payment_123'}
        }

        # Act
        result = WebhookService.process_webhook(
            provider='yukassa',
            event_type='payment.succeeded',
            payload=payload
        )

        # Assert
        assert result['success'] is True
        assert result['duplicate'] is True

    @patch('app.services.webhooks.PaymentService')
    def test_process_webhook_error_handling(
        self, mock_payment_service, mock_db_connection
    ):
        """Test webhook processing handles errors gracefully"""
        # Arrange
        webhook_id = str(uuid4())
        mock_db_connection.fetchone.side_effect = [
            None,  # Not duplicate
            {'id': webhook_id}  # Log webhook
        ]

        # Mock payment service to raise exception
        mock_payment_service.process_payment_success.side_effect = Exception('Database error')

        payload = {
            'event': 'payment.succeeded',
            'object': {'id': 'yukassa_payment_123'}
        }

        # Act
        result = WebhookService.process_webhook(
            provider='yukassa',
            event_type='payment.succeeded',
            payload=payload
        )

        # Assert
        assert result['success'] is False
        assert 'error' in result


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
