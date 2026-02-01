-- Migration 0037: Consumer Subscriptions (Follow System)
-- Date: 2026-02-01
-- Description: Allow consumers to follow/subscribe to organizations, products, and categories

BEGIN;

-- ============================================================
-- TABLE: consumer_subscriptions
-- ============================================================
-- Allows users to follow organizations, products, or categories
-- to receive updates and notifications

CREATE TABLE IF NOT EXISTS public.consumer_subscriptions (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key: the user subscribing
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Polymorphic target: what they're subscribing to
  target_type text NOT NULL
    CHECK (target_type IN ('organization', 'product', 'category')),

  target_id uuid NOT NULL,
    -- References organization_id, product_id, or category slug hash
    -- We use uuid for consistency; for categories, generate from slug

  -- Notification preferences (JSONB for flexibility)
  notification_preferences jsonb NOT NULL DEFAULT '{
    "email": true,
    "push": true,
    "in_app": true,
    "frequency": "immediate",
    "types": ["new_product", "price_change", "status_update", "review"]
  }'::jsonb,

  -- Status
  is_active boolean NOT NULL DEFAULT true,

  -- Metadata
  source text,
    -- Where the subscription came from: 'qr_scan', 'website', 'app', 'referral'
  metadata jsonb,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- User's subscriptions (for profile page)
CREATE INDEX idx_consumer_subs_user_active
ON public.consumer_subscriptions(user_id, is_active, target_type)
WHERE is_active = true;

-- Subscribers for a target (for sending notifications)
CREATE INDEX idx_consumer_subs_target_active
ON public.consumer_subscriptions(target_type, target_id, is_active)
WHERE is_active = true;

-- Unique constraint: one subscription per user per target
CREATE UNIQUE INDEX idx_consumer_subs_unique
ON public.consumer_subscriptions(user_id, target_type, target_id);

-- For notification queries
CREATE INDEX idx_consumer_subs_notifications
ON public.consumer_subscriptions(target_type, target_id)
WHERE is_active = true
  AND notification_preferences->>'email' = 'true';

-- Created at for ordering
CREATE INDEX idx_consumer_subs_created_at
ON public.consumer_subscriptions(created_at DESC);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.consumer_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
DROP POLICY IF EXISTS "Users view own subscriptions" ON public.consumer_subscriptions;
CREATE POLICY "Users view own subscriptions"
ON public.consumer_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own subscriptions
DROP POLICY IF EXISTS "Users create own subscriptions" ON public.consumer_subscriptions;
CREATE POLICY "Users create own subscriptions"
ON public.consumer_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
DROP POLICY IF EXISTS "Users update own subscriptions" ON public.consumer_subscriptions;
CREATE POLICY "Users update own subscriptions"
ON public.consumer_subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own subscriptions
DROP POLICY IF EXISTS "Users delete own subscriptions" ON public.consumer_subscriptions;
CREATE POLICY "Users delete own subscriptions"
ON public.consumer_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Organization owners/admins can view subscribers to their org/products
DROP POLICY IF EXISTS "Org admins view their subscribers" ON public.consumer_subscriptions;
CREATE POLICY "Org admins view their subscribers"
ON public.consumer_subscriptions
FOR SELECT
USING (
  -- For organization subscriptions
  (target_type = 'organization' AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = consumer_subscriptions.target_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ))
  OR
  -- For product subscriptions
  (target_type = 'product' AND EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = consumer_subscriptions.target_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ))
);

-- Platform admins can view all subscriptions (for analytics)
DROP POLICY IF EXISTS "Platform admins view all subscriptions" ON public.consumer_subscriptions;
CREATE POLICY "Platform admins view all subscriptions"
ON public.consumer_subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.role IN ('platform_owner', 'platform_admin')
  )
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get subscriber count for a target
CREATE OR REPLACE FUNCTION public.get_subscriber_count(
  p_target_type text,
  p_target_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::integer
  FROM public.consumer_subscriptions
  WHERE target_type = p_target_type
    AND target_id = p_target_id
    AND is_active = true;
$$;

-- Toggle subscription (subscribe/unsubscribe)
CREATE OR REPLACE FUNCTION public.toggle_subscription(
  p_target_type text,
  p_target_id uuid,
  p_source text DEFAULT 'website'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing record;
  v_result jsonb;
BEGIN
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check for existing subscription
  SELECT * INTO v_existing
  FROM public.consumer_subscriptions
  WHERE user_id = v_user_id
    AND target_type = p_target_type
    AND target_id = p_target_id;

  IF v_existing IS NULL THEN
    -- Create new subscription
    INSERT INTO public.consumer_subscriptions (user_id, target_type, target_id, source)
    VALUES (v_user_id, p_target_type, p_target_id, p_source);

    v_result := jsonb_build_object(
      'subscribed', true,
      'message', 'Successfully subscribed'
    );
  ELSE
    -- Toggle is_active
    UPDATE public.consumer_subscriptions
    SET is_active = NOT is_active,
        updated_at = now()
    WHERE id = v_existing.id;

    v_result := jsonb_build_object(
      'subscribed', NOT v_existing.is_active,
      'message', CASE
        WHEN v_existing.is_active THEN 'Successfully unsubscribed'
        ELSE 'Successfully resubscribed'
      END
    );
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- TRIGGER: Updated at
-- ============================================================

CREATE OR REPLACE FUNCTION public.consumer_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consumer_subscriptions_updated_at_trigger ON public.consumer_subscriptions;
CREATE TRIGGER consumer_subscriptions_updated_at_trigger
BEFORE UPDATE ON public.consumer_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.consumer_subscriptions_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.consumer_subscriptions IS
  'Consumer subscriptions to organizations, products, or categories for receiving updates and notifications.';

COMMENT ON COLUMN public.consumer_subscriptions.target_type IS
  'Type of entity being followed: organization, product, or category';

COMMENT ON COLUMN public.consumer_subscriptions.target_id IS
  'UUID of the target entity. For categories, use a generated UUID from the category slug.';

COMMENT ON COLUMN public.consumer_subscriptions.notification_preferences IS
  'JSONB object containing notification settings: email, push, in_app, frequency, types';

COMMENT ON FUNCTION public.toggle_subscription IS
  'Toggle subscription for the current user. Creates new subscription or toggles is_active on existing.';

COMMIT;
