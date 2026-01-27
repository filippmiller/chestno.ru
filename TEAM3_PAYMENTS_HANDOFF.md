# TEAM 3: PAYMENTS INTEGRATION HANDOFF

**Start Date:** When Team 1 complete (Day 5+) OR Day 3 if semi-parallel
**Duration:** 3 days (20-24 hours)
**Team Size:** 1 developer
**Status:** BLOCKED - Needs Status Levels Phase 4 complete

---

## 🚨 CRITICAL PREREQUISITES

**DO NOT START until these are complete:**

- [ ] ✅ Status Levels Phase 4 deployed
- [ ] ✅ `grant_status_level(org_id, level, subscription_id)` function available
- [ ] ✅ `revoke_status_level(org_id, level, reason)` function available
- [ ] ✅ Database functions `calculate_grace_period_end()` and `is_in_grace_period()` available

**Verify before starting:**
```python
# Test in Python shell
from backend.app.services.status_levels import grant_status_level, revoke_status_level

# Should not error
print("Status Levels integration points ready ✅")
```

---

## 🏦 ЮKASSA SETUP (DO THIS FIRST)

**Before writing any code:**

1. **Create ЮKassa Merchant Account**
   - Go to: https://yookassa.ru
   - Register account
   - Complete business verification (sandbox mode for testing)

2. **Get Credentials**
   - Navigate to: Settings → API Keys
   - Copy **Shop ID** (shopId)
   - Copy **Secret Key** (test key for sandbox)
   - Generate **Webhook Secret**

3. **Add to Environment**
   ```bash
   # File: backend/.env.local
   YUKASSA_SHOP_ID=your_shop_id_here
   YUKASSA_SECRET_KEY=your_secret_key_here
   YUKASSA_WEBHOOK_SECRET=your_webhook_secret_here
   YUKASSA_SANDBOX_MODE=true
   PAYMENT_CURRENCY=RUB
   PAYMENT_RETURN_URL=http://localhost:5173/subscription/success
   PAYMENT_CANCEL_URL=http://localhost:5173/subscription/canceled
   ```

4. **Install ЮKassa SDK**
   ```bash
   cd backend
   pip install yookassa
   pip freeze | grep yookassa >> requirements.txt
   ```

5. **Test Connection**
   ```python
   from yookassa import Configuration, Payment

   Configuration.account_id = 'your_shop_id'
   Configuration.secret_key = 'your_secret_key'

   # Should not error
   print("ЮKassa configured ✅")
   ```

---

## 🎯 YOUR TASKS (5 PHASES, 3 DAYS)

### **PHASE 1: Database (2 hours)**

**Goal:** Extend database for payments tracking

**Tasks:**

1. Create migration file:
   ```bash
   # File: supabase/migrations/0031_payments_integration.sql
   ```

2. **Extend subscription_plans table:**
   ```sql
   ALTER TABLE subscription_plans
   ADD COLUMN trial_days INT DEFAULT 0,
   ADD COLUMN one_time_fee_cents INT DEFAULT 0,
   ADD COLUMN payment_provider TEXT DEFAULT 'yukassa',
   ADD COLUMN requires_payment_method BOOLEAN DEFAULT false;

   -- Update seed data
   UPDATE subscription_plans SET trial_days = 14 WHERE slug = 'level-a';
   UPDATE subscription_plans SET trial_days = 14, one_time_fee_cents = 650000 WHERE slug = 'level-b';
   ```

3. **Extend organization_subscriptions table:**
   ```sql
   ALTER TABLE organization_subscriptions
   ADD COLUMN external_subscription_id TEXT,
   ADD COLUMN payment_method_last4 TEXT,
   ADD COLUMN payment_method_brand TEXT,
   ADD COLUMN payment_method_exp_month INT,
   ADD COLUMN payment_method_exp_year INT,
   ADD COLUMN trial_start TIMESTAMPTZ,
   ADD COLUMN trial_end TIMESTAMPTZ,
   ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT false,
   ADD COLUMN canceled_at TIMESTAMPTZ,
   ADD COLUMN canceled_reason TEXT;
   ```

4. **Create payment_transactions table:**
   ```sql
   CREATE TABLE payment_transactions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
     subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
     payment_provider TEXT NOT NULL DEFAULT 'yukassa',
     external_transaction_id TEXT NOT NULL UNIQUE,
     amount_cents INT NOT NULL CHECK (amount_cents >= 0),
     currency TEXT NOT NULL DEFAULT 'RUB',
     transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription_payment', 'one_time_fee', 'trial_preauth', 'refund')),
     status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'canceled')),
     payment_method_last4 TEXT,
     payment_method_brand TEXT,
     failure_reason TEXT,
     description TEXT,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT now(),
     succeeded_at TIMESTAMPTZ,
     failed_at TIMESTAMPTZ,
     refunded_at TIMESTAMPTZ
   );

   CREATE INDEX idx_payment_transactions_org ON payment_transactions(organization_id);
   CREATE INDEX idx_payment_transactions_subscription ON payment_transactions(subscription_id);
   CREATE INDEX idx_payment_transactions_external ON payment_transactions(external_transaction_id);
   CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
   ```

5. **Create payment_webhooks_log table:**
   ```sql
   CREATE TABLE payment_webhooks_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     payment_provider TEXT NOT NULL,
     event_type TEXT NOT NULL,
     external_transaction_id TEXT,
     payload JSONB NOT NULL,
     processed BOOLEAN DEFAULT false,
     processing_error TEXT,
     retry_count INT DEFAULT 0,
     received_at TIMESTAMPTZ DEFAULT now(),
     processed_at TIMESTAMPTZ
   );

   CREATE INDEX idx_payment_webhooks_provider ON payment_webhooks_log(payment_provider);
   CREATE INDEX idx_payment_webhooks_processed ON payment_webhooks_log(processed);
   CREATE INDEX idx_payment_webhooks_external ON payment_webhooks_log(external_transaction_id);
   ```

6. **Create subscription_retry_attempts table:**
   ```sql
   CREATE TABLE subscription_retry_attempts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
     attempt_number INT NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
     attempted_at TIMESTAMPTZ DEFAULT now(),
     next_retry_at TIMESTAMPTZ,
     success BOOLEAN DEFAULT false,
     failure_reason TEXT
   );

   CREATE INDEX idx_retry_attempts_subscription ON subscription_retry_attempts(subscription_id);
   ```

7. **Create helper functions:**
   ```sql
   CREATE OR REPLACE FUNCTION calculate_grace_period_end(
     started_at TIMESTAMPTZ,
     grace_days INT
   ) RETURNS TIMESTAMPTZ AS $$
   BEGIN
     RETURN started_at + (grace_days || ' days')::INTERVAL;
   END;
   $$ LANGUAGE plpgsql IMMUTABLE;

   CREATE OR REPLACE FUNCTION is_in_grace_period(
     subscription_status TEXT,
     updated_at TIMESTAMPTZ,
     grace_days INT
   ) RETURNS BOOLEAN AS $$
   BEGIN
     RETURN subscription_status = 'past_due'
       AND updated_at + (grace_days || ' days')::INTERVAL > now();
   END;
   $$ LANGUAGE plpgsql IMMUTABLE;
   ```

8. **Add RLS policies** (for all new tables)

9. **Test migration locally:**
   ```bash
   npx supabase db reset
   npx supabase db push
   ```

**Deliverables:**
- Migration file created and tested
- All tables exist with correct columns
- Functions work correctly
- RLS policies applied

---

### **PHASE 2: Backend Services (6 hours)**

**Goal:** Implement payment provider and business logic

**Tasks:**

1. **Create config updates:**
   ```python
   # File: backend/app/core/config.py (extend Settings class)

   class Settings(BaseSettings):
       # ... existing settings

       # ЮKassa
       YUKASSA_SHOP_ID: str
       YUKASSA_SECRET_KEY: str
       YUKASSA_WEBHOOK_SECRET: str
       YUKASSA_SANDBOX_MODE: bool = True

       # Payments
       PAYMENT_CURRENCY: str = "RUB"
       PAYMENT_RETURN_URL: str
       PAYMENT_CANCEL_URL: str
   ```

2. **Create payment provider wrapper:**
   ```python
   # File: backend/app/services/payment_provider.py

   from yookassa import Configuration, Payment
   import uuid

   class YukassaProvider:
       def __init__(self):
           Configuration.account_id = settings.YUKASSA_SHOP_ID
           Configuration.secret_key = settings.YUKASSA_SECRET_KEY

       def create_payment(
           self,
           amount_cents: int,
           description: str,
           organization_id: str,
           return_url: str = None,
           metadata: dict = None
       ) -> dict:
           """
           Create payment in ЮKassa.

           Returns: {
               'id': 'external_payment_id',
               'confirmation_url': 'https://yookassa.ru/...',
               'status': 'pending'
           }
           """
           payment = Payment.create({
               "amount": {
                   "value": f"{amount_cents / 100:.2f}",
                   "currency": settings.PAYMENT_CURRENCY
               },
               "confirmation": {
                   "type": "redirect",
                   "return_url": return_url or settings.PAYMENT_RETURN_URL
               },
               "capture": True,
               "description": description,
               "metadata": metadata or {}
           }, uuid.uuid4())

           return {
               'id': payment.id,
               'confirmation_url': payment.confirmation.confirmation_url,
               'status': payment.status
           }

       def get_payment_status(self, payment_id: str) -> dict:
           """Fallback: poll payment status if webhook fails."""
           payment = Payment.find_one(payment_id)
           return {
               'id': payment.id,
               'status': payment.status,
               'paid': payment.paid,
               'amount_cents': int(float(payment.amount.value) * 100)
           }

       def refund_payment(
           self,
           payment_id: str,
           amount_cents: int,
           reason: str = None
       ) -> dict:
           """Issue refund."""
           from yookassa import Refund

           refund = Refund.create({
               "amount": {
                   "value": f"{amount_cents / 100:.2f}",
                   "currency": settings.PAYMENT_CURRENCY
               },
               "payment_id": payment_id,
               "description": reason
           }, uuid.uuid4())

           return {
               'id': refund.id,
               'status': refund.status
           }

       def create_preauth(self, description: str) -> dict:
           """Create 1₽ pre-authorization for trial."""
           return self.create_payment(
               amount_cents=100,  # 1₽
               description=description,
               organization_id=None,
               metadata={'type': 'trial_preauth'}
           )
   ```

3. **Create payment service:**
   ```python
   # File: backend/app/services/payments.py

   from app.services.payment_provider import YukassaProvider
   from app.services.status_levels import grant_status_level, revoke_status_level

   class PaymentService:

       @staticmethod
       async def initiate_trial_with_preauth(
           organization_id: str,
           plan_id: str,
           user_id: str
       ) -> dict:
           """
           Start trial subscription with 1₽ card pre-auth.

           Flow:
           1. Create subscription record (status: trial)
           2. Create 1₽ pre-auth payment via ЮKassa
           3. Return checkout URL
           4. Webhook will refund 1₽ on success

           Returns: {
               'checkout_url': 'https://...',
               'payment_id': 'xxx',
               'subscription_id': 'uuid'
           }
           """
           # Get plan from database
           plan = get_plan(plan_id)

           # Create subscription record
           subscription = create_subscription(
               organization_id=organization_id,
               plan_id=plan_id,
               status='trialing',
               trial_start=now(),
               trial_end=now() + timedelta(days=plan.trial_days)
           )

           # Create 1₽ pre-auth payment
           payment = YukassaProvider().create_preauth(
               description=f"Trial pre-auth for {plan.name}"
           )

           # Create transaction record
           create_transaction(
               organization_id=organization_id,
               subscription_id=subscription.id,
               external_transaction_id=payment['id'],
               amount_cents=100,
               transaction_type='trial_preauth',
               status='pending'
           )

           return {
               'checkout_url': payment['confirmation_url'],
               'payment_id': payment['id'],
               'subscription_id': subscription.id
           }

       @staticmethod
       async def charge_subscription(
           subscription_id: str,
           is_first_payment: bool = False
       ) -> dict:
           """
           Charge recurring subscription payment.

           If first payment: charge monthly fee + one-time fee (if applicable)
           If recurring: charge monthly fee only
           """
           subscription = get_subscription(subscription_id)
           plan = get_plan(subscription.plan_id)

           # Calculate amount
           amount_cents = plan.price_cents
           if is_first_payment and plan.one_time_fee_cents > 0:
               amount_cents += plan.one_time_fee_cents

           # Create payment
           payment = YukassaProvider().create_payment(
               amount_cents=amount_cents,
               description=f"Subscription payment: {plan.name}",
               organization_id=subscription.organization_id,
               metadata={
                   'subscription_id': str(subscription.id),
                   'is_first_payment': is_first_payment
               }
           )

           # Create transaction record
           create_transaction(
               organization_id=subscription.organization_id,
               subscription_id=subscription.id,
               external_transaction_id=payment['id'],
               amount_cents=amount_cents,
               transaction_type='subscription_payment',
               status='pending'
           )

           return payment

       @staticmethod
       async def process_payment_success(
           external_payment_id: str,
           payment_method_info: dict
       ):
           """
           Process successful payment (called by webhook).

           Actions:
           1. Update transaction status
           2. Update subscription status
           3. Grant status level
           4. Refund pre-auth if trial
           5. Send confirmation email
           """
           # Find transaction
           txn = get_transaction_by_external_id(external_payment_id)

           # Update transaction
           update_transaction(txn.id, {
               'status': 'succeeded',
               'succeeded_at': now(),
               'payment_method_last4': payment_method_info.get('last4'),
               'payment_method_brand': payment_method_info.get('brand')
           })

           # Update subscription
           subscription = get_subscription(txn.subscription_id)

           if txn.transaction_type == 'trial_preauth':
               # Refund 1₽
               YukassaProvider().refund_payment(
                   payment_id=external_payment_id,
                   amount_cents=100,
                   reason="Trial pre-authorization refund"
               )
               # Subscription stays in 'trialing' status

           elif txn.transaction_type == 'subscription_payment':
               # Activate subscription
               update_subscription(subscription.id, {
                   'status': 'active',
                   'current_period_start': now(),
                   'current_period_end': now() + timedelta(days=30)
               })

               # Grant status level
               plan = get_plan(subscription.plan_id)
               if plan.slug == 'level-a':
                   grant_status_level(
                       organization_id=subscription.organization_id,
                       level='A',
                       subscription_id=subscription.id
                   )
               elif plan.slug == 'level-b':
                   grant_status_level(
                       organization_id=subscription.organization_id,
                       level='B',
                       subscription_id=subscription.id
                   )

           # Send email
           send_payment_confirmation_email(subscription.organization_id, txn.id)

       @staticmethod
       async def process_payment_failure(
           external_payment_id: str,
           failure_reason: str
       ):
           """
           Process failed payment (called by webhook).

           Actions:
           1. Update transaction status
           2. Set subscription to past_due
           3. Start grace period with retries
           4. Send failure notification
           """
           # Find transaction
           txn = get_transaction_by_external_id(external_payment_id)

           # Update transaction
           update_transaction(txn.id, {
               'status': 'failed',
               'failed_at': now(),
               'failure_reason': failure_reason
           })

           # Update subscription
           subscription = get_subscription(txn.subscription_id)
           update_subscription(subscription.id, {
               'status': 'past_due'
           })

           # Schedule first retry (Day 1, 3, 7)
           create_retry_attempt(
               subscription_id=subscription.id,
               attempt_number=1,
               next_retry_at=now() + timedelta(days=1)
           )

           # Send failure notification
           send_payment_failure_email(subscription.organization_id, failure_reason)
   ```

4. **Create webhook service:**
   ```python
   # File: backend/app/services/webhooks.py

   class WebhookService:

       @staticmethod
       async def process_webhook(
           provider: str,
           event_type: str,
           payload: dict
       ):
           """
           Process payment webhook with idempotency.

           Supported events:
           - payment.succeeded
           - payment.failed
           - payment.canceled
           - refund.succeeded
           """
           external_transaction_id = payload.get('object', {}).get('id')

           # Check for duplicate (idempotency)
           existing = get_webhook_log(external_transaction_id)
           if existing and existing.processed:
               logger.info(f"Webhook already processed: {external_transaction_id}")
               return  # No-op

           # Log webhook
           webhook_log_id = create_webhook_log(
               payment_provider=provider,
               event_type=event_type,
               external_transaction_id=external_transaction_id,
               payload=payload
           )

           try:
               # Process based on event type
               if event_type == 'payment.succeeded':
                   payment_method = payload.get('object', {}).get('payment_method', {})
                   await PaymentService.process_payment_success(
                       external_payment_id=external_transaction_id,
                       payment_method_info={
                           'last4': payment_method.get('card', {}).get('last4'),
                           'brand': payment_method.get('card', {}).get('card_type')
                       }
                   )

               elif event_type == 'payment.failed':
                   failure_reason = payload.get('object', {}).get('cancellation_details', {}).get('reason')
                   await PaymentService.process_payment_failure(
                       external_payment_id=external_transaction_id,
                       failure_reason=failure_reason
                   )

               elif event_type == 'payment.canceled':
                   # Similar to failed
                   pass

               elif event_type == 'refund.succeeded':
                   # Mark transaction as refunded
                   pass

               # Mark webhook as processed
               update_webhook_log(webhook_log_id, {
                   'processed': True,
                   'processed_at': now()
               })

           except Exception as e:
               # Log error
               update_webhook_log(webhook_log_id, {
                   'processing_error': str(e),
                   'retry_count': existing.retry_count + 1 if existing else 1
               })
               raise
   ```

**Deliverables:**
- YukassaProvider service implemented
- PaymentService with trial and charge logic
- WebhookService with idempotency
- Integration with Status Levels (grant/revoke)

---

### **PHASE 3-4: API Endpoints & Webhooks (6 hours)**

**Goal:** Expose payment APIs and webhook handler

**Tasks:**

1. **Create payment schemas:**
   ```python
   # File: backend/app/schemas/payments.py

   from pydantic import BaseModel
   from typing import Optional, Literal
   from datetime import datetime

   class CheckoutRequest(BaseModel):
       organization_id: str
       plan_id: str

   class CheckoutResponse(BaseModel):
       checkout_url: str
       payment_id: str
       subscription_id: str

   class PaymentTransaction(BaseModel):
       id: str
       organization_id: str
       subscription_id: str
       payment_provider: str
       external_transaction_id: str
       amount_cents: int
       currency: str
       transaction_type: str
       status: str
       payment_method_last4: Optional[str] = None
       payment_method_brand: Optional[str] = None
       failure_reason: Optional[str] = None
       description: Optional[str] = None
       created_at: datetime
       succeeded_at: Optional[datetime] = None
   ```

2. **Create payment routes:**
   ```python
   # File: backend/app/api/routes/payments.py

   from fastapi import APIRouter, Depends, HTTPException
   from app.core.session_deps import get_current_user_id_from_session
   from app.services.payments import PaymentService
   from app.schemas.payments import CheckoutRequest, CheckoutResponse

   router = APIRouter(prefix="/payments", tags=["payments"])

   @router.post('/checkout/trial', response_model=CheckoutResponse)
   async def checkout_trial(
       request: CheckoutRequest,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """
       Initiate trial subscription with 1₽ pre-auth.

       Returns checkout URL to redirect user.
       """
       # Verify user is org member
       ensure_org_member(current_user_id, request.organization_id)

       result = await PaymentService.initiate_trial_with_preauth(
           organization_id=request.organization_id,
           plan_id=request.plan_id,
           user_id=current_user_id
       )

       return CheckoutResponse(**result)

   @router.post('/checkout/subscription', response_model=CheckoutResponse)
   async def checkout_subscription(
       request: CheckoutRequest,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """
       Charge first payment or recurring payment.
       """
       # Verify user is org member
       ensure_org_member(current_user_id, request.organization_id)

       # Get subscription
       subscription = get_org_subscription(request.organization_id)

       # Determine if first payment
       is_first_payment = subscription.status == 'trialing'

       # Charge subscription
       result = await PaymentService.charge_subscription(
           subscription_id=subscription.id,
           is_first_payment=is_first_payment
       )

       return CheckoutResponse(
           checkout_url=result['confirmation_url'],
           payment_id=result['id'],
           subscription_id=subscription.id
       )
   ```

3. **Create webhook routes:**
   ```python
   # File: backend/app/api/routes/webhooks.py

   from fastapi import APIRouter, Request, HTTPException
   import hmac
   import hashlib

   router = APIRouter(prefix="/webhooks", tags=["webhooks"])

   @router.post('/yukassa')
   async def yukassa_webhook(request: Request):
       """
       Handle ЮKassa webhooks.

       Events:
       - payment.succeeded
       - payment.failed
       - payment.canceled
       - refund.succeeded
       """
       # Get signature from header
       signature = request.headers.get('X-YooKassa-Signature')
       if not signature:
           raise HTTPException(401, "Missing signature")

       # Get body
       body_bytes = await request.body()

       # Verify signature
       expected = hmac.new(
           settings.YUKASSA_WEBHOOK_SECRET.encode(),
           body_bytes,
           hashlib.sha256
       ).hexdigest()

       if not hmac.compare_digest(signature, expected):
           raise HTTPException(401, "Invalid signature")

       # Parse payload
       payload = await request.json()
       event_type = payload.get('event')

       # Process webhook (async)
       await WebhookService.process_webhook(
           provider='yukassa',
           event_type=event_type,
           payload=payload
       )

       # Always return 200 OK (even on processing errors)
       # ЮKassa will retry if we return non-200
       return {"status": "ok"}
   ```

4. **Create subscription management routes:**
   ```python
   # File: backend/app/api/routes/subscriptions.py (extend existing)

   @router.post('/subscriptions/{subscription_id}/cancel')
   async def cancel_subscription(
       subscription_id: str,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Cancel subscription at end of period."""
       subscription = get_subscription(subscription_id)
       ensure_org_member(current_user_id, subscription.organization_id)

       update_subscription(subscription_id, {
           'cancel_at_period_end': True,
           'canceled_reason': 'user_requested'
       })

       return {"status": "canceled_at_period_end"}

   @router.post('/subscriptions/{subscription_id}/reactivate')
   async def reactivate_subscription(
       subscription_id: str,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Reactivate canceled subscription."""
       subscription = get_subscription(subscription_id)
       ensure_org_member(current_user_id, subscription.organization_id)

       update_subscription(subscription_id, {
           'cancel_at_period_end': False,
           'canceled_reason': None
       })

       return {"status": "reactivated"}

   @router.get('/subscriptions/{subscription_id}/transactions')
   async def get_subscription_transactions(
       subscription_id: str,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Get payment history."""
       subscription = get_subscription(subscription_id)
       ensure_org_member(current_user_id, subscription.organization_id)

       transactions = get_transactions(subscription_id)
       return {"transactions": transactions}
   ```

5. **Register routers:**
   ```python
   # File: backend/app/main.py

   from app.api.routes import payments, webhooks

   app.include_router(payments.router, prefix="/api")
   app.include_router(webhooks.router, prefix="/api")
   ```

**Deliverables:**
- Payment checkout endpoints working
- Webhook endpoint processing events
- Signature verification working
- Subscription management endpoints

---

### **PHASE 5: Testing & Deployment (8 hours)**

**Goal:** Comprehensive testing and production deployment

**Tasks:**

1. **Unit Tests** (4 hours)
   ```python
   # File: backend/tests/test_payment_service.py

   @pytest.mark.asyncio
   async def test_initiate_trial_with_preauth():
       result = await PaymentService.initiate_trial_with_preauth(
           organization_id=test_org_id,
           plan_id=level_a_plan_id,
           user_id=test_user_id
       )

       assert 'checkout_url' in result
       assert 'payment_id' in result
       assert 'subscription_id' in result

   @pytest.mark.asyncio
   async def test_payment_success():
       txn = create_test_transaction(status='pending')

       await PaymentService.process_payment_success(
           external_payment_id=txn.external_transaction_id,
           payment_method_info={'last4': '1026', 'brand': 'Visa'}
       )

       txn = get_transaction(txn.id)
       assert txn.status == 'succeeded'

       subscription = get_subscription(txn.subscription_id)
       assert subscription.status == 'active'

   @pytest.mark.asyncio
   async def test_payment_failure_triggers_grace_period():
       txn = create_test_transaction(status='pending')

       await PaymentService.process_payment_failure(
           external_payment_id=txn.external_transaction_id,
           failure_reason='insufficient_funds'
       )

       subscription = get_subscription(txn.subscription_id)
       assert subscription.status == 'past_due'

       retries = get_retry_attempts(subscription.id)
       assert len(retries) == 1
       assert retries[0].next_retry_at is not None
   ```

2. **Integration Tests - Sandbox Mode** (3 hours)
   - Trial → Paid success flow
   - Failed payment → Grace period → Recovery
   - Upgrade A → B
   - Webhook idempotency

3. **Load Testing** (1 hour)
   ```bash
   # Test webhook endpoint with 10 req/s
   artillery run webhook_load_test.yml
   ```

4. **Security Testing** (1 hour)
   - Invalid signature rejected
   - SQL injection prevented
   - Rate limiting works

5. **Production Deployment** (2 hours)
   ```bash
   # Add secrets to Railway
   railway variables set YUKASSA_SHOP_ID=<prod>
   railway variables set YUKASSA_SECRET_KEY=<prod>
   railway variables set YUKASSA_WEBHOOK_SECRET=<prod>
   railway variables set YUKASSA_SANDBOX_MODE=false

   # Apply migration
   npx supabase db push --project-ref production

   # Deploy backend
   git push origin main

   # Register webhook with ЮKassa production
   # URL: https://api.chestno.ru/api/webhooks/yukassa
   ```

6. **Smoke Tests** (1 hour)
   - Trial signup works end-to-end
   - First payment processes
   - Webhook received and processed
   - Status level granted

**Deliverables:**
- All tests passing
- Payments live in production
- Webhooks processing correctly
- Monitoring operational

---

## 📁 FILES YOU'LL CREATE/MODIFY

**New Files:**
```
supabase/migrations/0031_payments_integration.sql
backend/app/services/payment_provider.py
backend/app/services/payments.py
backend/app/services/webhooks.py
backend/app/schemas/payments.py
backend/app/api/routes/payments.py
backend/app/api/routes/webhooks.py
backend/tests/test_payment_service.py
backend/tests/test_webhook_service.py
```

**Modified Files:**
```
backend/app/core/config.py
backend/app/api/routes/subscriptions.py
backend/app/main.py
backend/requirements.txt
```

---

## 🧪 TESTING CHECKLIST

**Unit Tests:**
- [ ] initiate_trial_with_preauth creates subscription and payment
- [ ] charge_subscription calculates amount correctly (first vs recurring)
- [ ] process_payment_success updates transaction and grants status level
- [ ] process_payment_failure triggers grace period
- [ ] Webhook idempotency prevents duplicate processing

**Integration Tests (Sandbox):**
- [ ] Trial → Paid success: User completes trial pre-auth, trial activates, first payment charges, status level granted
- [ ] Failed payment → Grace period → Recovery: Payment fails, grace period starts, retry scheduled, user updates card, retry succeeds
- [ ] Upgrade A → B: Prorated credit calculated, new payment charged, status level upgraded
- [ ] Webhook idempotency: Same webhook sent twice, only processed once

**Security Tests:**
- [ ] Invalid webhook signature rejected (401)
- [ ] SQL injection prevented (parameterized queries)
- [ ] Rate limiting on webhook endpoint (429 after threshold)

**Load Tests:**
- [ ] Webhook endpoint handles 10 req/s without errors
- [ ] No duplicate processing under load

---

## 🚀 READY TO START PROMPT

**Copy this into PowerShell when ready to start Team 3:**

```powershell
Payments integration complete (Phase 1-5). PREREQUISITES: Verify Status Levels Phase 4 complete, grant_status_level function available. Tasks: ЮKassa setup (create merchant account, get sandbox credentials Shop ID/Secret Key/Webhook Secret, add to .env, pip install yookassa), Phase 1 (create migration 0031_payments_integration.sql: extend subscription_plans with trial_days/one_time_fee_cents, extend organization_subscriptions with external_subscription_id/payment_method fields/trial dates, create payment_transactions table, create payment_webhooks_log table for audit, create subscription_retry_attempts table, add database functions calculate_grace_period_end and is_in_grace_period, RLS policies), Phase 2 (implement YukassaProvider service with create_payment/get_payment_status/refund_payment/create_preauth, implement PaymentService with initiate_trial_with_preauth 1₽ pre-auth flow/charge_subscription with first payment vs recurring logic/process_payment_success with grant_status_level integration/process_payment_failure with grace period 3-day retry logic, implement WebhookService with process_webhook and idempotency checking via payment_webhooks_log), Phase 3-4 (create payment routes POST /payments/checkout/trial and /payments/checkout/subscription, create webhook route POST /webhooks/yukassa with HMAC signature verification, extend subscriptions routes with /subscriptions/:id/cancel, /subscriptions/:id/reactivate, /subscriptions/:id/transactions), Phase 5 (unit tests: test_initiate_trial, test_payment_success, test_payment_failure_triggers_grace_period, integration tests sandbox mode: trial→paid success, failed payment→grace period→recovery, upgrade A→B, webhook idempotency, load test 10 req/s webhooks with artillery, security tests: invalid signature rejected, SQL injection prevented, rate limiting, production deployment: Railway secrets, Supabase migration, ЮKassa webhook registration production URL https://api.chestno.ru/api/webhooks/yukassa, smoke tests: trial signup, first payment, webhook processing, status level granted, monitoring: failed webhooks alerts, grace period tracking, revenue metrics). CRITICAL: Integrate with Status Levels grant_status_level after successful payment. Read IMPL_Payments_v1.md and TEAM3_PAYMENTS_HANDOFF.md. Duration: 20-24 hours (3 days).
```

---

## 📞 SUPPORT

**If blocked:**
1. Check `IMPL_Payments_v1.md` for detailed specs
2. Review ЮKassa API docs: https://yookassa.ru/developers
3. Test ЮKassa connection before building services
4. Coordinate with Team 1 for Status Levels integration

**Integration with Team 1 (Status Levels):**
```python
# After successful payment, call:
from app.services.status_levels import grant_status_level

grant_status_level(
    organization_id=subscription.organization_id,
    level='A' or 'B',
    granted_by=None,  # System
    subscription_id=subscription.id
)
```

---

**Status:** READY TO START (after Team 1 Phase 4 complete)
**Expected Completion:** 3 days after start
**Estimated Hours:** 20-24 hours
