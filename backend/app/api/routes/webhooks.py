"""
Webhook endpoints for external integrations.
Handles subscription status changes and payment webhooks from YooKassa.
"""
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.core.session_deps import get_current_user_id_from_session
from app.services import subscriptions as subscriptions_service
from app.services.admin_guard import assert_platform_admin
from app.services.webhooks import WebhookService

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/webhooks', tags=['webhooks'])


class SubscriptionStatusChangePayload(BaseModel):
    """Payload for subscription status change webhook."""
    subscription_id: str
    new_status: str
    organization_id: str
    grace_period_days: int | None = None


@router.post('/subscription-status-changed')
async def subscription_status_changed(
    request: Request,
    payload: SubscriptionStatusChangePayload,
    current_user_id: str = Depends(get_current_user_id_from_session)
) -> dict:
    """
    Webhook endpoint for subscription status changes.
    Automatically updates status levels (grants/revokes level A).

    Requires admin privileges.

    **Status transitions:**
    - `active` → Grants level A
    - `past_due` → Starts grace period (level A retained)
    - `cancelled` → Revokes level A if grace period expired
    """
    # Only platform admins can trigger webhooks
    assert_platform_admin(current_user_id)

    try:
        result = subscriptions_service.update_subscription_status(
            subscription_id=payload.subscription_id,
            new_status=payload.new_status,
            grace_period_days=payload.grace_period_days,
            actor_user_id=current_user_id
        )

        return {
            'success': True,
            'message': f'Subscription status updated to {payload.new_status}',
            'data': result
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f'[webhook.subscription_status_changed] Error: {e}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to process webhook: {str(e)}'
        )


@router.post('/yukassa')
async def yukassa_webhook(
    request: Request,
    x_yookassa_signature: str | None = Header(None, alias='X-YooKassa-Signature')
) -> dict:
    """
    Webhook endpoint for YooKassa payment events.

    Handles:
    - payment.succeeded
    - payment.failed
    - payment.canceled
    - refund.succeeded

    Security:
    - Signature verification via HMAC SHA256
    - Idempotency checks to prevent duplicate processing

    Returns:
    - Always returns 200 OK (per YooKassa requirements)
    - Processing errors are logged but not returned as failures
    """
    try:
        # Get raw body for signature verification
        body_bytes = await request.body()

        # Parse JSON payload
        payload = await request.json()

        # Extract event type
        event_type = payload.get('event')
        if not event_type:
            logger.error("[webhooks.yukassa] Missing event type in payload")
            # Return 200 to prevent YooKassa retries
            return {'success': False, 'error': 'Missing event type'}

        # Verify signature
        if x_yookassa_signature:
            is_valid = WebhookService.verify_yukassa_signature(
                payload=body_bytes,
                signature=x_yookassa_signature
            )

            if not is_valid:
                logger.error("[webhooks.yukassa] Invalid signature")
                # Return 401 for invalid signature (security issue)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )
        else:
            logger.warning("[webhooks.yukassa] No signature provided")

        # Process webhook
        result = WebhookService.process_webhook(
            provider='yukassa',
            event_type=event_type,
            payload=payload,
            signature=x_yookassa_signature
        )

        # Always return 200 OK to YooKassa
        # Errors are logged and stored in webhook log
        return {
            'success': result.get('success', False),
            'message': result.get('message', 'Webhook processed'),
            'duplicate': result.get('duplicate', False)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[webhooks.yukassa] Unexpected error: {e}", exc_info=True)
        # Return 200 to prevent YooKassa retries (error is logged)
        return {
            'success': False,
            'error': str(e)
        }
