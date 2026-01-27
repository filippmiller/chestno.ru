-- =====================================================
-- Migration 0031: Payments Integration
-- =====================================================
-- Description: Add tables and functions for YooKassa payment integration
-- Tables: payment_transactions, payment_webhooks_log, subscription_retry_attempts
-- Extends: subscription_plans, organization_subscriptions
-- Date: 2026-01-27
-- =====================================================

-- =====================================================
-- 1. EXTEND EXISTING TABLES
-- =====================================================

-- Extend subscription_plans with payment-related fields
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS one_time_fee_cents integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'yukassa',
ADD COLUMN IF NOT EXISTS requires_payment_method boolean DEFAULT false;

COMMENT ON COLUMN public.subscription_plans.trial_days IS 'Number of trial days (0 = no trial)';
COMMENT ON COLUMN public.subscription_plans.one_time_fee_cents IS 'One-time activation fee in cents (Level B uses this)';
COMMENT ON COLUMN public.subscription_plans.payment_provider IS 'Payment provider (yukassa, stripe, etc)';
COMMENT ON COLUMN public.subscription_plans.requires_payment_method IS 'Whether plan requires payment method during signup';

-- Extend organization_subscriptions with payment tracking
ALTER TABLE public.organization_subscriptions
ADD COLUMN IF NOT EXISTS external_subscription_id text,
ADD COLUMN IF NOT EXISTS payment_method_last4 text,
ADD COLUMN IF NOT EXISTS payment_method_brand text,
ADD COLUMN IF NOT EXISTS trial_start timestamptz,
ADD COLUMN IF NOT EXISTS trial_end timestamptz,
ADD COLUMN IF NOT EXISTS grace_period_days integer,
ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS canceled_reason text,
ADD COLUMN IF NOT EXISTS next_billing_date timestamptz;

COMMENT ON COLUMN public.organization_subscriptions.external_subscription_id IS 'External payment provider subscription ID';
COMMENT ON COLUMN public.organization_subscriptions.payment_method_last4 IS 'Last 4 digits of payment card';
COMMENT ON COLUMN public.organization_subscriptions.payment_method_brand IS 'Card brand (Visa, Mastercard, etc)';
COMMENT ON COLUMN public.organization_subscriptions.trial_start IS 'Trial period start date';
COMMENT ON COLUMN public.organization_subscriptions.trial_end IS 'Trial period end date';
COMMENT ON COLUMN public.organization_subscriptions.grace_period_days IS 'Grace period duration in days';
COMMENT ON COLUMN public.organization_subscriptions.grace_period_ends_at IS 'When grace period expires';
COMMENT ON COLUMN public.organization_subscriptions.canceled_reason IS 'Reason for cancellation';
COMMENT ON COLUMN public.organization_subscriptions.next_billing_date IS 'Next scheduled billing date';

-- =====================================================
-- 2. CREATE NEW TABLES
-- =====================================================

-- Payment transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
    payment_provider text NOT NULL DEFAULT 'yukassa',
    external_transaction_id text NOT NULL,
    amount_cents integer NOT NULL,
    currency text NOT NULL DEFAULT 'RUB',
    transaction_type text NOT NULL CHECK (transaction_type IN (
        'trial_preauth',
        'subscription_payment',
        'one_time_fee',
        'refund',
        'upgrade_charge'
    )),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'processing',
        'succeeded',
        'failed',
        'canceled',
        'refunded'
    )),
    payment_method_last4 text,
    payment_method_brand text,
    failure_reason text,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    succeeded_at timestamptz,
    failed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_org ON public.payment_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription ON public.payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON public.payment_transactions(external_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON public.payment_transactions(created_at DESC);

COMMENT ON TABLE public.payment_transactions IS 'All payment transactions processed through payment providers';
COMMENT ON COLUMN public.payment_transactions.external_transaction_id IS 'Payment provider transaction ID';
COMMENT ON COLUMN public.payment_transactions.transaction_type IS 'Type of transaction';
COMMENT ON COLUMN public.payment_transactions.metadata IS 'Additional transaction data from payment provider';

-- Payment webhooks log (for audit and idempotency)
CREATE TABLE IF NOT EXISTS public.payment_webhooks_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_provider text NOT NULL DEFAULT 'yukassa',
    event_type text NOT NULL,
    external_transaction_id text NOT NULL,
    payload jsonb NOT NULL,
    signature text,
    processed boolean NOT NULL DEFAULT false,
    processing_error text,
    retry_count integer NOT NULL DEFAULT 0,
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_idempotency ON public.payment_webhooks_log(
    payment_provider,
    external_transaction_id,
    event_type
);

CREATE INDEX IF NOT EXISTS idx_webhooks_processed ON public.payment_webhooks_log(processed, received_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_external_id ON public.payment_webhooks_log(external_transaction_id);

COMMENT ON TABLE public.payment_webhooks_log IS 'Audit log of all payment webhooks received (idempotency)';
COMMENT ON INDEX idx_webhooks_idempotency IS 'Ensures each webhook is processed only once';

-- Subscription retry attempts (for grace period management)
CREATE TABLE IF NOT EXISTS public.subscription_retry_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
    attempt_number integer NOT NULL,
    next_retry_at timestamptz NOT NULL,
    attempted_at timestamptz,
    transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
    result text CHECK (result IN ('pending', 'success', 'failed', 'skipped')),
    failure_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retry_attempts_subscription ON public.subscription_retry_attempts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_retry_attempts_next_retry ON public.subscription_retry_attempts(next_retry_at)
    WHERE result = 'pending';

COMMENT ON TABLE public.subscription_retry_attempts IS 'Tracks retry attempts for failed subscription payments';
COMMENT ON COLUMN public.subscription_retry_attempts.attempt_number IS 'Retry attempt number (1, 2, 3)';

-- =====================================================
-- 3. DATABASE FUNCTIONS
-- =====================================================

-- Function to calculate grace period end date
CREATE OR REPLACE FUNCTION public.calculate_grace_period_end(
    start_date timestamptz,
    grace_days integer
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN start_date + (grace_days || ' days')::interval;
END;
$$;

COMMENT ON FUNCTION public.calculate_grace_period_end IS 'Calculate when grace period ends';

-- Function to check if subscription is in grace period
CREATE OR REPLACE FUNCTION public.is_in_grace_period(
    subscription_status text,
    grace_end_date timestamptz,
    grace_days integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF subscription_status != 'past_due' THEN
        RETURN false;
    END IF;

    IF grace_end_date IS NULL THEN
        RETURN false;
    END IF;

    RETURN now() < grace_end_date;
END;
$$;

COMMENT ON FUNCTION public.is_in_grace_period IS 'Check if subscription is currently in grace period';

-- Function to log webhook (for use in webhook processing)
CREATE OR REPLACE FUNCTION public.log_webhook(
    p_provider text,
    p_event_type text,
    p_external_id text,
    p_payload jsonb,
    p_signature text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_webhook_id uuid;
BEGIN
    INSERT INTO public.payment_webhooks_log (
        payment_provider,
        event_type,
        external_transaction_id,
        payload,
        signature
    )
    VALUES (
        p_provider,
        p_event_type,
        p_external_id,
        p_payload,
        p_signature
    )
    RETURNING id INTO v_webhook_id;

    RETURN v_webhook_id;
END;
$$;

COMMENT ON FUNCTION public.log_webhook IS 'Log incoming webhook for idempotency and audit trail';

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhooks_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_retry_attempts ENABLE ROW LEVEL SECURITY;

-- Payment transactions: Admins can see all, org members can see their org's transactions
CREATE POLICY payment_transactions_admin_all
    ON public.payment_transactions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.platform_role = 'platform_admin'
        )
    );

CREATE POLICY payment_transactions_org_view
    ON public.payment_transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_memberships.organization_id = payment_transactions.organization_id
            AND organization_memberships.user_id = auth.uid()
            AND organization_memberships.status = 'active'
        )
    );

-- Webhooks: Admin only
CREATE POLICY payment_webhooks_admin_only
    ON public.payment_webhooks_log
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.platform_role = 'platform_admin'
        )
    );

-- Retry attempts: Admins can see all, org members can see their org's retries
CREATE POLICY retry_attempts_admin_all
    ON public.subscription_retry_attempts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.platform_role = 'platform_admin'
        )
    );

CREATE POLICY retry_attempts_org_view
    ON public.subscription_retry_attempts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_subscriptions os
            JOIN public.organization_memberships om
                ON om.organization_id = os.organization_id
            WHERE os.id = subscription_retry_attempts.subscription_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
        )
    );

-- =====================================================
-- 5. SEED DATA (Update existing plans)
-- =====================================================

-- Update Level A plan with trial and payment settings
UPDATE public.subscription_plans
SET
    trial_days = 14,
    one_time_fee_cents = 0,
    payment_provider = 'yukassa',
    requires_payment_method = true
WHERE code = 'level_a';

-- Update Level B plan with one-time fee
UPDATE public.subscription_plans
SET
    trial_days = 0,
    one_time_fee_cents = 650000,  -- 6,500 RUB
    payment_provider = 'yukassa',
    requires_payment_method = true
WHERE code = 'level_b';

-- =====================================================
-- 6. GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.subscription_retry_attempts TO authenticated;

-- Grant service role full access (for backend operations)
GRANT ALL ON public.payment_transactions TO service_role;
GRANT ALL ON public.payment_webhooks_log TO service_role;
GRANT ALL ON public.subscription_retry_attempts TO service_role;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
