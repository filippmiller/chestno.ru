"""
Payment API Routes

Endpoints for payment checkout and subscription management.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.payments import (
    CheckoutResponse,
    CheckoutSubscriptionRequest,
    CheckoutTrialRequest,
    PaymentTransactionList,
)
from app.services.payments import PaymentService
from app.services.subscriptions import ensure_org_member

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/payments', tags=['payments'])


@router.post('/checkout/trial', response_model=CheckoutResponse)
async def checkout_trial(
    request: CheckoutTrialRequest,
    current_user_id: str = Depends(get_current_user_id_from_session)
):
    """
    Initiate trial subscription with 1₽ pre-authorization.

    Requires:
    - User must be member of organization
    - Organization must not have active subscription
    - Plan must offer trial period

    Returns:
    - checkout_url: URL to redirect user for payment
    - payment_id: YooKassa payment ID
    - subscription_id: Created subscription ID
    - trial_end: Trial end date
    """
    try:
        # Verify user is member of organization
        ensure_org_member(current_user_id, request.organization_id)

        # Initiate trial
        result = PaymentService.initiate_trial_with_preauth(
            organization_id=request.organization_id,
            plan_id=request.plan_id,
            user_id=current_user_id
        )

        return CheckoutResponse(
            checkout_url=result['checkout_url'],
            payment_id=result['payment_id'],
            subscription_id=result['subscription_id'],
            amount_cents=result['amount_cents'],
            currency=result['currency']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[payments] Error in checkout_trial: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating trial: {str(e)}"
        )


@router.post('/checkout/subscription', response_model=CheckoutResponse)
async def checkout_subscription(
    request: CheckoutSubscriptionRequest,
    current_user_id: str = Depends(get_current_user_id_from_session)
):
    """
    Checkout subscription payment (after trial or for upgrade).

    Requires:
    - User must be member of organization
    - Organization must have active subscription in trialing or past_due status

    Returns:
    - checkout_url: URL to redirect user for payment
    - payment_id: YooKassa payment ID
    - subscription_id: Subscription ID
    - amount_cents: Total amount to charge
    """
    try:
        # Verify user is member of organization
        ensure_org_member(current_user_id, request.organization_id)

        # Get subscription ID from organization
        from app.core.db import get_connection
        from psycopg.rows import dict_row

        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT id, status FROM public.organization_subscriptions
                WHERE organization_id = %s
                  AND status IN ('trialing', 'past_due', 'active')
                ORDER BY created_at DESC
                LIMIT 1
                ''',
                (request.organization_id,)
            )
            subscription = cur.fetchone()

            if not subscription:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No active subscription found for organization"
                )

        # Charge subscription (first payment after trial or retry)
        is_first_payment = subscription['status'] == 'trialing'

        result = PaymentService.charge_subscription(
            subscription_id=str(subscription['id']),
            is_first_payment=is_first_payment
        )

        return CheckoutResponse(
            checkout_url=result['checkout_url'],
            payment_id=result['payment_id'],
            subscription_id=result.get('subscription_id', str(subscription['id'])),
            amount_cents=result['amount_cents'],
            currency=result['currency']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[payments] Error in checkout_subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing subscription checkout: {str(e)}"
        )


@router.get('/transactions/{organization_id}', response_model=PaymentTransactionList)
async def get_transactions(
    organization_id: str,
    page: int = 1,
    per_page: int = 20,
    current_user_id: str = Depends(get_current_user_id_from_session)
):
    """
    Get payment transaction history for an organization.

    Requires:
    - User must be member of organization

    Returns:
    - List of payment transactions with pagination
    """
    try:
        # Verify user is member of organization
        ensure_org_member(current_user_id, organization_id)

        # Get transactions
        transactions, total = PaymentService.get_organization_transactions(
            organization_id=organization_id,
            page=page,
            per_page=per_page
        )

        return PaymentTransactionList(
            transactions=transactions,
            total=total,
            page=page,
            per_page=per_page
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[payments] Error getting transactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving transactions: {str(e)}"
        )
