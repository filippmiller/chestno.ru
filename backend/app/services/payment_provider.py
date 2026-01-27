"""
YooKassa Payment Provider Service

Wraps the YooKassa SDK for payment operations.
Handles payment creation, status checks, refunds, and pre-authorizations.
"""

import logging
from typing import Literal, Optional
from uuid import uuid4

from yookassa import Configuration, Payment, Refund

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class YukassaProvider:
    """
    YooKassa payment provider wrapper.

    All amounts are in cents (kopecks for RUB).

    Methods:
    - create_payment: Create a payment
    - get_payment_status: Check payment status
    - refund_payment: Refund a payment
    - create_preauth: Create 1₽ pre-authorization for trial
    """

    @staticmethod
    def _configure():
        """Configure YooKassa SDK with credentials"""
        if not settings.yukassa_enabled:
            raise RuntimeError("YooKassa not configured. Set YUKASSA_SHOP_ID and YUKASSA_SECRET_KEY.")

        Configuration.configure(
            account_id=settings.yukassa_shop_id,
            secret_key=settings.yukassa_secret_key
        )

    @staticmethod
    def create_payment(
        amount_cents: int,
        description: str,
        organization_id: str,
        return_url: Optional[str] = None,
        metadata: Optional[dict] = None,
        capture: bool = True
    ) -> dict:
        """
        Create a payment in YooKassa.

        Args:
            amount_cents: Amount in cents (kopecks)
            description: Payment description
            organization_id: Organization UUID (for metadata)
            return_url: URL to redirect after payment
            metadata: Additional metadata to attach
            capture: Auto-capture payment (default True)

        Returns:
            dict with:
            - id: YooKassa payment ID
            - confirmation_url: URL to redirect user for payment
            - status: Payment status
            - amount: Amount object
            - metadata: Attached metadata

        Raises:
            Exception: If payment creation fails
        """
        YukassaProvider._configure()

        if metadata is None:
            metadata = {}

        # Add organization_id to metadata
        metadata['organization_id'] = organization_id

        # Convert amount to YooKassa format (string with 2 decimals)
        amount_rubles = f"{amount_cents / 100:.2f}"

        payment_data = {
            "amount": {
                "value": amount_rubles,
                "currency": settings.payment_currency
            },
            "confirmation": {
                "type": "redirect",
                "return_url": return_url or settings.payment_return_url_full
            },
            "capture": capture,
            "description": description,
            "metadata": metadata
        }

        try:
            payment = Payment.create(payment_data, uuid4())

            logger.info(f"[YukassaProvider] Created payment {payment.id} for org {organization_id}")

            return {
                'id': payment.id,
                'confirmation_url': payment.confirmation.confirmation_url if payment.confirmation else None,
                'status': payment.status,
                'amount': {
                    'value': payment.amount.value,
                    'currency': payment.amount.currency
                },
                'metadata': payment.metadata,
                'test': payment.test if hasattr(payment, 'test') else settings.yukassa_sandbox_mode
            }

        except Exception as e:
            logger.error(f"[YukassaProvider] Error creating payment: {e}")
            raise

    @staticmethod
    def get_payment_status(payment_id: str) -> dict:
        """
        Get payment status from YooKassa.

        Args:
            payment_id: YooKassa payment ID

        Returns:
            dict with payment details including status

        Raises:
            Exception: If status check fails
        """
        YukassaProvider._configure()

        try:
            payment = Payment.find_one(payment_id)

            return {
                'id': payment.id,
                'status': payment.status,
                'paid': payment.paid,
                'amount': {
                    'value': payment.amount.value,
                    'currency': payment.amount.currency
                },
                'payment_method': {
                    'type': payment.payment_method.type if payment.payment_method else None,
                    'card': {
                        'last4': payment.payment_method.card.last4 if payment.payment_method and hasattr(payment.payment_method, 'card') else None,
                        'card_type': payment.payment_method.card.card_type if payment.payment_method and hasattr(payment.payment_method, 'card') else None
                    } if payment.payment_method and hasattr(payment.payment_method, 'card') else None
                },
                'metadata': payment.metadata,
                'created_at': payment.created_at,
                'captured_at': payment.captured_at if hasattr(payment, 'captured_at') else None,
                'test': payment.test if hasattr(payment, 'test') else settings.yukassa_sandbox_mode
            }

        except Exception as e:
            logger.error(f"[YukassaProvider] Error getting payment status for {payment_id}: {e}")
            raise

    @staticmethod
    def refund_payment(
        payment_id: str,
        amount_cents: int,
        reason: Optional[str] = None
    ) -> dict:
        """
        Refund a payment.

        Args:
            payment_id: YooKassa payment ID to refund
            amount_cents: Amount to refund in cents (must be <= original amount)
            reason: Optional refund reason

        Returns:
            dict with refund details

        Raises:
            Exception: If refund fails
        """
        YukassaProvider._configure()

        amount_rubles = f"{amount_cents / 100:.2f}"

        refund_data = {
            "amount": {
                "value": amount_rubles,
                "currency": settings.payment_currency
            },
            "payment_id": payment_id
        }

        if reason:
            refund_data['description'] = reason

        try:
            refund = Refund.create(refund_data, uuid4())

            logger.info(f"[YukassaProvider] Created refund {refund.id} for payment {payment_id}")

            return {
                'id': refund.id,
                'payment_id': refund.payment_id,
                'status': refund.status,
                'amount': {
                    'value': refund.amount.value,
                    'currency': refund.amount.currency
                },
                'created_at': refund.created_at
            }

        except Exception as e:
            logger.error(f"[YukassaProvider] Error creating refund for {payment_id}: {e}")
            raise

    @staticmethod
    def create_preauth(
        description: str,
        organization_id: str,
        return_url: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> dict:
        """
        Create 1₽ pre-authorization payment for trial.

        This is a payment with capture=False and amount=1.00 RUB.
        Used to verify payment method without charging the full amount.

        Args:
            description: Payment description
            organization_id: Organization UUID
            return_url: URL to redirect after payment
            metadata: Additional metadata

        Returns:
            dict with payment details (same as create_payment)

        Raises:
            Exception: If pre-auth creation fails
        """
        return YukassaProvider.create_payment(
            amount_cents=100,  # 1₽ = 100 kopecks
            description=description,
            organization_id=organization_id,
            return_url=return_url,
            metadata=metadata,
            capture=False  # Don't capture - this is pre-auth
        )
