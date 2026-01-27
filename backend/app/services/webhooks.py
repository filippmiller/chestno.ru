"""
Webhook Service

Handles incoming webhooks from payment providers (YooKassa).
Implements signature verification, idempotency checks, and event processing.
"""

import hashlib
import hmac
import json
import logging
from typing import Literal, Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.core.db import get_connection
from app.services.payments import PaymentService

logger = logging.getLogger(__name__)
settings = get_settings()


class WebhookService:
    """
    Payment webhook processing service.

    Handles:
    - Signature verification
    - Idempotency checks
    - Event routing
    - Transaction updates
    """

    @staticmethod
    def verify_yukassa_signature(payload: bytes, signature: str) -> bool:
        """
        Verify YooKassa webhook signature using HMAC SHA256.

        Args:
            payload: Raw webhook payload bytes
            signature: Signature from X-YooKassa-Signature header

        Returns:
            True if signature is valid, False otherwise
        """
        if not settings.yukassa_webhook_secret:
            logger.warning("[WebhookService] YooKassa webhook secret not configured - skipping verification")
            return True  # Allow in development, but log warning

        expected_signature = hmac.new(
            settings.yukassa_webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        is_valid = hmac.compare_digest(signature, expected_signature)

        if not is_valid:
            logger.error(
                f"[WebhookService] Invalid webhook signature. "
                f"Expected: {expected_signature[:10]}..., Got: {signature[:10]}..."
            )

        return is_valid

    @staticmethod
    def check_idempotency(
        provider: str,
        event_type: str,
        external_transaction_id: str
    ) -> bool:
        """
        Check if webhook has already been processed (idempotency).

        Args:
            provider: Payment provider (yukassa)
            event_type: Event type (payment.succeeded, etc)
            external_transaction_id: External payment ID

        Returns:
            True if webhook is a duplicate, False if new
        """
        try:
            with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    '''
                    SELECT id, processed FROM public.payment_webhooks_log
                    WHERE payment_provider = %s
                      AND event_type = %s
                      AND external_transaction_id = %s
                    LIMIT 1
                    ''',
                    (provider, event_type, external_transaction_id)
                )
                existing = cur.fetchone()

                if existing:
                    logger.info(
                        f"[WebhookService] Duplicate webhook detected: "
                        f"{provider}/{event_type}/{external_transaction_id} "
                        f"(log_id: {existing['id']}, processed: {existing['processed']})"
                    )
                    return True

                return False

        except Exception as e:
            logger.error(f"[WebhookService] Error checking idempotency: {e}")
            # On error, assume duplicate to prevent double-processing
            return True

    @staticmethod
    def log_webhook(
        provider: str,
        event_type: str,
        external_transaction_id: str,
        payload: dict,
        signature: Optional[str] = None,
        processed: bool = False,
        processing_error: Optional[str] = None
    ) -> str:
        """
        Log webhook to database for audit trail.

        Args:
            provider: Payment provider
            event_type: Event type
            external_transaction_id: External payment ID
            payload: Webhook payload
            signature: Webhook signature
            processed: Whether webhook was processed successfully
            processing_error: Error message if processing failed

        Returns:
            Webhook log ID
        """
        try:
            with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    '''
                    INSERT INTO public.payment_webhooks_log (
                        payment_provider,
                        event_type,
                        external_transaction_id,
                        payload,
                        signature,
                        processed,
                        processing_error,
                        processed_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    ''',
                    (
                        provider,
                        event_type,
                        external_transaction_id,
                        json.dumps(payload),
                        signature,
                        processed,
                        processing_error,
                        None if not processed else 'now()'
                    )
                )
                row = cur.fetchone()
                conn.commit()

                return str(row['id'])

        except Exception as e:
            logger.error(f"[WebhookService] Error logging webhook: {e}")
            raise

    @staticmethod
    def update_webhook_log(
        log_id: str,
        processed: bool,
        processing_error: Optional[str] = None
    ):
        """
        Update webhook log entry after processing.

        Args:
            log_id: Webhook log ID
            processed: Whether processing succeeded
            processing_error: Error message if processing failed
        """
        try:
            with get_connection() as conn, conn.cursor() as cur:
                cur.execute(
                    '''
                    UPDATE public.payment_webhooks_log
                    SET processed = %s,
                        processing_error = %s,
                        processed_at = now(),
                        retry_count = retry_count + 1
                    WHERE id = %s
                    ''',
                    (processed, processing_error, log_id)
                )
                conn.commit()

        except Exception as e:
            logger.error(f"[WebhookService] Error updating webhook log: {e}")

    @staticmethod
    def process_webhook(
        provider: Literal['yukassa'],
        event_type: str,
        payload: dict,
        signature: Optional[str] = None
    ) -> dict:
        """
        Main webhook processing handler.

        Coordinates:
        1. Idempotency check
        2. Webhook logging
        3. Event routing
        4. Transaction updates

        Args:
            provider: Payment provider (yukassa)
            event_type: Event type (payment.succeeded, payment.failed, etc)
            payload: Webhook payload
            signature: Webhook signature for verification

        Returns:
            dict with processing result

        Note:
            This method always returns a dict, never raises exceptions.
            Errors are logged and returned in the result.
        """
        external_transaction_id = None
        log_id = None

        try:
            # Extract payment ID from payload
            if provider == 'yukassa':
                payment_object = payload.get('object', {})
                external_transaction_id = payment_object.get('id')

                if not external_transaction_id:
                    logger.error("[WebhookService] No payment ID in YooKassa webhook payload")
                    return {
                        'success': False,
                        'error': 'Missing payment ID in payload'
                    }

            # Check idempotency
            if WebhookService.check_idempotency(provider, event_type, external_transaction_id):
                logger.info(f"[WebhookService] Skipping duplicate webhook: {event_type}/{external_transaction_id}")
                return {
                    'success': True,
                    'duplicate': True,
                    'message': 'Webhook already processed'
                }

            # Log webhook
            log_id = WebhookService.log_webhook(
                provider=provider,
                event_type=event_type,
                external_transaction_id=external_transaction_id,
                payload=payload,
                signature=signature,
                processed=False
            )

            # Route event to appropriate handler
            result = WebhookService._route_event(provider, event_type, payload)

            # Update log as processed
            WebhookService.update_webhook_log(
                log_id=log_id,
                processed=True,
                processing_error=None
            )

            logger.info(f"[WebhookService] Processed webhook: {event_type}/{external_transaction_id}")

            return {
                'success': True,
                'duplicate': False,
                'log_id': log_id,
                'result': result
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[WebhookService] Error processing webhook: {e}", exc_info=True)

            # Update log with error
            if log_id:
                WebhookService.update_webhook_log(
                    log_id=log_id,
                    processed=False,
                    processing_error=error_msg
                )

            # Return error but don't raise exception (YooKassa expects 200 OK)
            return {
                'success': False,
                'error': error_msg,
                'log_id': log_id
            }

    @staticmethod
    def _route_event(provider: str, event_type: str, payload: dict) -> dict:
        """
        Route webhook event to appropriate handler.

        Args:
            provider: Payment provider
            event_type: Event type
            payload: Webhook payload

        Returns:
            Processing result from handler

        Raises:
            Exception: If event handling fails
        """
        payment_object = payload.get('object', {})
        payment_id = payment_object.get('id')

        # Extract payment method info if available
        payment_method_info = None
        if payment_object.get('payment_method'):
            pm = payment_object['payment_method']
            payment_method_info = {
                'last4': pm.get('card', {}).get('last4') if pm.get('card') else None,
                'brand': pm.get('card', {}).get('card_type') if pm.get('card') else None
            }

        # Route based on event type
        if event_type in ['payment.succeeded']:
            return PaymentService.process_payment_success(
                external_payment_id=payment_id,
                payment_method_info=payment_method_info
            )

        elif event_type in ['payment.failed', 'payment.canceled']:
            failure_reason = payment_object.get('cancellation_details', {}).get('reason', 'unknown')
            return PaymentService.process_payment_failure(
                external_payment_id=payment_id,
                failure_reason=failure_reason
            )

        elif event_type == 'refund.succeeded':
            # Refund succeeded - log but no action needed (already processed during refund creation)
            logger.info(f"[WebhookService] Refund succeeded: {payment_id}")
            return {'message': 'Refund acknowledged'}

        else:
            logger.warning(f"[WebhookService] Unhandled event type: {event_type}")
            return {'message': f'Unhandled event type: {event_type}'}
