"""
Payment Service

Business logic for payment processing, subscription management, and status level integration.
Handles trial initiations, subscription charges, payment success/failure processing.
"""

import logging
from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services.payment_provider import YukassaProvider
from app.services import status_levels

logger = logging.getLogger(__name__)


class PaymentService:
    """
    Core payment processing service.

    Methods:
    - initiate_trial_with_preauth: Start trial with 1₽ pre-auth
    - charge_subscription: Charge recurring subscription payment
    - process_payment_success: Handle successful payment
    - process_payment_failure: Handle failed payment
    - get_organization_transactions: Get payment history
    """

    @staticmethod
    def initiate_trial_with_preauth(
        organization_id: str,
        plan_id: str,
        user_id: str
    ) -> dict:
        """
        Initiate trial subscription with 1₽ pre-authorization.

        Flow:
        1. Create payment transaction record
        2. Create YooKassa pre-auth payment (1₽, capture=False)
        3. Create subscription in 'trialing' status
        4. Return checkout URL for user

        Args:
            organization_id: Organization UUID
            plan_id: Subscription plan UUID
            user_id: User initiating the trial

        Returns:
            dict with:
            - checkout_url: URL to redirect user for payment
            - payment_id: YooKassa payment ID
            - subscription_id: Created subscription ID
            - trial_end: Trial end date

        Raises:
            HTTPException: If plan not found, org already has active subscription, or payment creation fails
        """
        try:
            with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                # Get plan details
                cur.execute(
                    'SELECT * FROM public.subscription_plans WHERE id = %s',
                    (plan_id,)
                )
                plan = cur.fetchone()

                if not plan:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Subscription plan not found"
                    )

                if plan['trial_days'] == 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This plan does not offer a trial period"
                    )

                # Check if org already has active subscription
                cur.execute(
                    '''
                    SELECT id FROM public.organization_subscriptions
                    WHERE organization_id = %s
                      AND status IN ('trialing', 'active')
                    LIMIT 1
                    ''',
                    (organization_id,)
                )
                existing = cur.fetchone()

                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Organization already has an active subscription"
                    )

                # Calculate trial dates
                trial_start = datetime.utcnow()
                trial_end = trial_start + timedelta(days=plan['trial_days'])

                # Create pre-auth payment via YooKassa
                payment_result = YukassaProvider.create_preauth(
                    description=f"Trial verification for {plan['name']}",
                    organization_id=organization_id,
                    metadata={
                        'organization_id': organization_id,
                        'plan_id': plan_id,
                        'user_id': user_id,
                        'type': 'trial_preauth'
                    }
                )

                # Create subscription record
                cur.execute(
                    '''
                    INSERT INTO public.organization_subscriptions (
                        organization_id,
                        plan_id,
                        status,
                        external_subscription_id,
                        trial_start,
                        trial_end
                    )
                    VALUES (%s, %s, 'trialing', %s, %s, %s)
                    RETURNING id
                    ''',
                    (
                        organization_id,
                        plan_id,
                        payment_result['id'],
                        trial_start,
                        trial_end
                    )
                )
                subscription_row = cur.fetchone()
                subscription_id = str(subscription_row['id'])

                # Create payment transaction record
                cur.execute(
                    '''
                    INSERT INTO public.payment_transactions (
                        organization_id,
                        subscription_id,
                        payment_provider,
                        external_transaction_id,
                        amount_cents,
                        currency,
                        transaction_type,
                        status,
                        description
                    )
                    VALUES (%s, %s, 'yukassa', %s, %s, %s, 'trial_preauth', 'pending', %s)
                    ''',
                    (
                        organization_id,
                        subscription_id,
                        payment_result['id'],
                        100,  # 1₽
                        'RUB',
                        f"Trial pre-authorization for {plan['name']}"
                    )
                )

                conn.commit()

                # Grant Level 0 status (trial status)
                # Level 0 is granted during trial, Level A after first payment
                try:
                    status_levels.ensure_level_a(
                        org_id=organization_id,
                        subscription_id=subscription_id,
                        granted_by=user_id
                    )
                    logger.info(f"[PaymentService] Granted Level A to org {organization_id} for trial")
                except Exception as e:
                    logger.warning(f"[PaymentService] Failed to grant Level A during trial: {e}")
                    # Don't fail the entire operation if status level grant fails

                logger.info(
                    f"[PaymentService] Initiated trial for org {organization_id}, "
                    f"subscription {subscription_id}, payment {payment_result['id']}"
                )

                return {
                    'checkout_url': payment_result['confirmation_url'],
                    'payment_id': payment_result['id'],
                    'subscription_id': subscription_id,
                    'trial_end': trial_end.isoformat(),
                    'amount_cents': 100,
                    'currency': 'RUB'
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PaymentService] Error initiating trial: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error initiating trial: {str(e)}"
            )

    @staticmethod
    def charge_subscription(
        subscription_id: str,
        is_first_payment: bool = False
    ) -> dict:
        """
        Charge subscription payment (monthly/yearly).

        Args:
            subscription_id: Subscription UUID
            is_first_payment: Whether this is the first payment after trial

        Returns:
            dict with payment details

        Raises:
            HTTPException: If subscription not found or payment creation fails
        """
        try:
            with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                # Get subscription and plan details
                cur.execute(
                    '''
                    SELECT
                        os.*,
                        sp.name as plan_name,
                        sp.price_monthly_cents,
                        sp.price_yearly_cents,
                        sp.one_time_fee_cents
                    FROM public.organization_subscriptions os
                    JOIN public.subscription_plans sp ON sp.id = os.plan_id
                    WHERE os.id = %s
                    ''',
                    (subscription_id,)
                )
                subscription = cur.fetchone()

                if not subscription:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Subscription not found"
                    )

                # Determine amount
                # For first payment: include one-time fee if applicable
                # For recurring: use monthly/yearly price based on billing period
                billing_period = subscription.get('billing_period', 'monthly')

                if billing_period == 'yearly':
                    base_amount = subscription['price_yearly_cents']
                else:
                    base_amount = subscription['price_monthly_cents']

                # Add one-time fee for first payment
                if is_first_payment and subscription['one_time_fee_cents']:
                    total_amount = base_amount + subscription['one_time_fee_cents']
                    description = f"First payment for {subscription['plan_name']} (includes one-time fee)"
                else:
                    total_amount = base_amount
                    description = f"Subscription payment for {subscription['plan_name']}"

                # Create payment via YooKassa
                payment_result = YukassaProvider.create_payment(
                    amount_cents=total_amount,
                    description=description,
                    organization_id=str(subscription['organization_id']),
                    metadata={
                        'organization_id': str(subscription['organization_id']),
                        'subscription_id': subscription_id,
                        'is_first_payment': is_first_payment,
                        'type': 'subscription_payment'
                    },
                    capture=True  # Auto-capture subscription payments
                )

                # Create transaction record
                cur.execute(
                    '''
                    INSERT INTO public.payment_transactions (
                        organization_id,
                        subscription_id,
                        payment_provider,
                        external_transaction_id,
                        amount_cents,
                        currency,
                        transaction_type,
                        status,
                        description
                    )
                    VALUES (%s, %s, 'yukassa', %s, %s, 'RUB', 'subscription_payment', 'pending', %s)
                    RETURNING id
                    ''',
                    (
                        subscription['organization_id'],
                        subscription_id,
                        payment_result['id'],
                        total_amount,
                        description
                    )
                )
                transaction_row = cur.fetchone()

                conn.commit()

                logger.info(
                    f"[PaymentService] Created subscription charge for subscription {subscription_id}, "
                    f"payment {payment_result['id']}, amount {total_amount}"
                )

                return {
                    'payment_id': payment_result['id'],
                    'transaction_id': str(transaction_row['id']),
                    'checkout_url': payment_result['confirmation_url'],
                    'amount_cents': total_amount,
                    'currency': 'RUB',
                    'is_first_payment': is_first_payment
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PaymentService] Error charging subscription: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error charging subscription: {str(e)}"
            )

    @staticmethod
    def process_payment_success(
        external_payment_id: str,
        payment_method_info: Optional[dict] = None
    ) -> dict:
        """
        Process successful payment.

        Updates transaction status, subscription status, and grants appropriate status level.

        Args:
            external_payment_id: YooKassa payment ID
            payment_method_info: Payment method details (last4, brand)

        Returns:
            dict with processing result

        Raises:
            HTTPException: If transaction not found or processing fails
        """
        try:
            with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                # Find transaction
                cur.execute(
                    '''
                    SELECT * FROM public.payment_transactions
                    WHERE external_transaction_id = %s
                    ''',
                    (external_payment_id,)
                )
                txn = cur.fetchone()

                if not txn:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Payment transaction not found"
                    )

                # Update transaction to succeeded
                cur.execute(
                    '''
                    UPDATE public.payment_transactions
                    SET status = 'succeeded',
                        succeeded_at = now(),
                        payment_method_last4 = %s,
                        payment_method_brand = %s,
                        updated_at = now()
                    WHERE id = %s
                    ''',
                    (
                        payment_method_info.get('last4') if payment_method_info else None,
                        payment_method_info.get('brand') if payment_method_info else None,
                        txn['id']
                    )
                )

                # Update subscription based on transaction type
                if txn['transaction_type'] == 'trial_preauth':
                    # Trial pre-auth succeeded - refund the 1₽
                    try:
                        YukassaProvider.refund_payment(
                            payment_id=external_payment_id,
                            amount_cents=100,
                            reason="Trial pre-authorization refund"
                        )
                        logger.info(f"[PaymentService] Refunded trial pre-auth {external_payment_id}")
                    except Exception as e:
                        logger.error(f"[PaymentService] Failed to refund trial pre-auth: {e}")

                    # Update subscription with payment method
                    if txn['subscription_id']:
                        cur.execute(
                            '''
                            UPDATE public.organization_subscriptions
                            SET payment_method_last4 = %s,
                                payment_method_brand = %s,
                                updated_at = now()
                            WHERE id = %s
                            ''',
                            (
                                payment_method_info.get('last4') if payment_method_info else None,
                                payment_method_info.get('brand') if payment_method_info else None,
                                txn['subscription_id']
                            )
                        )

                elif txn['transaction_type'] == 'subscription_payment':
                    # Subscription payment succeeded - activate subscription
                    if txn['subscription_id']:
                        cur.execute(
                            '''
                            UPDATE public.organization_subscriptions
                            SET status = 'active',
                                payment_method_last4 = %s,
                                payment_method_brand = %s,
                                grace_period_days = NULL,
                                grace_period_ends_at = NULL,
                                next_billing_date = now() + interval '1 month',
                                updated_at = now()
                            WHERE id = %s
                            ''',
                            (
                                payment_method_info.get('last4') if payment_method_info else None,
                                payment_method_info.get('brand') if payment_method_info else None,
                                txn['subscription_id']
                            )
                        )

                        # Grant Level A via status_levels service
                        try:
                            status_levels.ensure_level_a(
                                org_id=str(txn['organization_id']),
                                subscription_id=str(txn['subscription_id']),
                                granted_by=None  # Automatic grant
                            )
                            logger.info(f"[PaymentService] Granted Level A to org {txn['organization_id']}")
                        except Exception as e:
                            logger.error(f"[PaymentService] Failed to grant Level A: {e}")
                            # Don't fail the entire operation

                conn.commit()

                logger.info(f"[PaymentService] Processed payment success for {external_payment_id}")

                return {
                    'transaction_id': str(txn['id']),
                    'organization_id': str(txn['organization_id']),
                    'subscription_id': str(txn['subscription_id']) if txn['subscription_id'] else None,
                    'status': 'succeeded',
                    'transaction_type': txn['transaction_type']
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PaymentService] Error processing payment success: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing payment: {str(e)}"
            )

    @staticmethod
    def process_payment_failure(
        external_payment_id: str,
        failure_reason: str
    ) -> dict:
        """
        Process failed payment.

        Updates transaction status and starts grace period for subscription.

        Args:
            external_payment_id: YooKassa payment ID
            failure_reason: Reason for failure

        Returns:
            dict with processing result

        Raises:
            HTTPException: If transaction not found or processing fails
        """
        try:
            with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                # Find transaction
                cur.execute(
                    '''
                    SELECT * FROM public.payment_transactions
                    WHERE external_transaction_id = %s
                    ''',
                    (external_payment_id,)
                )
                txn = cur.fetchone()

                if not txn:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Payment transaction not found"
                    )

                # Update transaction to failed
                cur.execute(
                    '''
                    UPDATE public.payment_transactions
                    SET status = 'failed',
                        failed_at = now(),
                        failure_reason = %s,
                        updated_at = now()
                    WHERE id = %s
                    ''',
                    (failure_reason, txn['id'])
                )

                # If subscription payment failed, start grace period
                if txn['transaction_type'] == 'subscription_payment' and txn['subscription_id']:
                    # Update subscription to past_due
                    cur.execute(
                        '''
                        UPDATE public.organization_subscriptions
                        SET status = 'past_due',
                            updated_at = now()
                        WHERE id = %s
                        ''',
                        (txn['subscription_id'],)
                    )

                    conn.commit()

                    # Start grace period via status_levels service
                    try:
                        grace_result = status_levels.start_grace_period(
                            org_id=str(txn['organization_id']),
                            days=14  # 14 days for Level A
                        )
                        logger.info(
                            f"[PaymentService] Started grace period for org {txn['organization_id']}: "
                            f"{grace_result}"
                        )
                    except Exception as e:
                        logger.error(f"[PaymentService] Failed to start grace period: {e}")

                    # Schedule first retry
                    cur.execute(
                        '''
                        INSERT INTO public.subscription_retry_attempts (
                            subscription_id,
                            attempt_number,
                            next_retry_at,
                            result
                        )
                        VALUES (%s, 1, now() + interval '3 days', 'pending')
                        ''',
                        (txn['subscription_id'],)
                    )
                    conn.commit()

                logger.info(f"[PaymentService] Processed payment failure for {external_payment_id}")

                return {
                    'transaction_id': str(txn['id']),
                    'organization_id': str(txn['organization_id']),
                    'subscription_id': str(txn['subscription_id']) if txn['subscription_id'] else None,
                    'status': 'failed',
                    'failure_reason': failure_reason
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PaymentService] Error processing payment failure: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing payment failure: {str(e)}"
            )

    @staticmethod
    def get_organization_transactions(
        organization_id: str,
        page: int = 1,
        per_page: int = 20
    ) -> tuple[list[dict], int]:
        """
        Get payment transaction history for an organization.

        Args:
            organization_id: Organization UUID
            page: Page number (1-indexed)
            per_page: Items per page

        Returns:
            Tuple of (transactions list, total count)
        """
        try:
            per_page = min(per_page, 100)
            offset = (page - 1) * per_page

            with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
                # Get total count
                cur.execute(
                    'SELECT COUNT(*) as total FROM public.payment_transactions WHERE organization_id = %s',
                    (organization_id,)
                )
                total = cur.fetchone()['total']

                # Get transactions
                cur.execute(
                    '''
                    SELECT
                        id::text,
                        organization_id::text,
                        subscription_id::text,
                        payment_provider,
                        external_transaction_id,
                        amount_cents,
                        currency,
                        transaction_type,
                        status,
                        payment_method_last4,
                        payment_method_brand,
                        failure_reason,
                        description,
                        metadata,
                        created_at,
                        succeeded_at,
                        failed_at,
                        updated_at
                    FROM public.payment_transactions
                    WHERE organization_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    ''',
                    (organization_id, per_page, offset)
                )
                rows = cur.fetchall()

                return [dict(row) for row in rows], total

        except Exception as e:
            logger.error(f"[PaymentService] Error getting transactions: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error retrieving transactions: {str(e)}"
            )
