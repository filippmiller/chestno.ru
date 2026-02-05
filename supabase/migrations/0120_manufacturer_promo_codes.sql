-- Migration: Manufacturer Promo Codes System
-- Date: 2026-02-05
-- Description: Allow manufacturers to create discount codes and share with their subscribers

BEGIN;

-- ============================================================
-- TABLE: manufacturer_promotions
-- ============================================================
-- Campaigns/promotions created by manufacturers for their subscribers

CREATE TABLE IF NOT EXISTS public.manufacturer_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization that owns this promotion
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Promotion details
  title text NOT NULL,
  description text,

  -- Discount configuration
  discount_type text NOT NULL CHECK (discount_type IN (
    'percent',       -- e.g., 10% off
    'fixed',         -- e.g., 500 RUB off
    'free_shipping', -- Free delivery
    'custom'         -- Custom offer (text description)
  )),
  discount_value integer,  -- For percent: 10 = 10%, for fixed: amount in kopeks
  discount_description text,  -- Custom description for 'custom' type
  min_purchase_amount integer,  -- Minimum order in kopeks (optional)

  -- Platform targeting
  platform text NOT NULL CHECK (platform IN (
    'own_website',
    'ozon',
    'wildberries',
    'yandex_market',
    'other'
  )),
  platform_name text,  -- Custom name if platform = 'other'
  platform_url text,   -- Link to the platform/store

  -- Code generation settings
  code_prefix text NOT NULL DEFAULT 'PROMO',  -- Prefix for generated codes

  -- Validity period
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,  -- NULL = no end date

  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Not yet active
    'active',     -- Currently running
    'paused',     -- Temporarily paused
    'completed',  -- Ended naturally
    'cancelled'   -- Manually cancelled
  )),

  -- Distribution tracking
  distributed_at timestamptz,  -- When codes were sent to subscribers
  total_codes_generated integer DEFAULT 0,
  total_codes_used integer DEFAULT 0,

  -- Metadata
  created_by uuid REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manufacturer_promos_org ON public.manufacturer_promotions(organization_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_promos_status ON public.manufacturer_promotions(status, organization_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_promos_active ON public.manufacturer_promotions(organization_id, status, starts_at, ends_at)
  WHERE status = 'active';

-- ============================================================
-- TABLE: subscriber_promo_codes
-- ============================================================
-- Individual codes generated for each subscriber

CREATE TABLE IF NOT EXISTS public.subscriber_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  promotion_id uuid NOT NULL
    REFERENCES public.manufacturer_promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The actual code
  code text NOT NULL,

  -- Status tracking
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending',   -- Generated but not yet sent
    'active',    -- Sent and valid
    'used',      -- User marked as used
    'expired'    -- Past expiration date
  )),

  -- Timestamps
  sent_at timestamptz,       -- When notification was sent
  viewed_at timestamptz,     -- When user first viewed the code
  used_at timestamptz,       -- When user marked as used
  expires_at timestamptz,    -- Code expiration (copied from promotion.ends_at)

  -- Notification tracking
  notification_channel text, -- 'email', 'in_app', or 'both'
  email_sent boolean DEFAULT false,
  in_app_sent boolean DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one code per user per promotion
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_codes_unique ON public.subscriber_promo_codes(promotion_id, user_id);

-- Index for looking up by code
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_codes_code ON public.subscriber_promo_codes(code);

-- Index for user's codes
CREATE INDEX IF NOT EXISTS idx_subscriber_codes_user ON public.subscriber_promo_codes(user_id, status);

-- Index for promotion's codes
CREATE INDEX IF NOT EXISTS idx_subscriber_codes_promo ON public.subscriber_promo_codes(promotion_id, status);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.manufacturer_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_promo_codes ENABLE ROW LEVEL SECURITY;

-- Promotions: Organization members can view their org's promotions
DROP POLICY IF EXISTS "Org members view promotions" ON public.manufacturer_promotions;
CREATE POLICY "Org members view promotions"
ON public.manufacturer_promotions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = manufacturer_promotions.organization_id
      AND om.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.role IN ('platform_owner', 'platform_admin')
  )
);

-- Promotions: Org editors can create/update promotions
DROP POLICY IF EXISTS "Org editors manage promotions" ON public.manufacturer_promotions;
CREATE POLICY "Org editors manage promotions"
ON public.manufacturer_promotions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = manufacturer_promotions.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = manufacturer_promotions.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
  )
);

-- Promo codes: Users see their own codes
DROP POLICY IF EXISTS "Users view own codes" ON public.subscriber_promo_codes;
CREATE POLICY "Users view own codes"
ON public.subscriber_promo_codes FOR SELECT
USING (auth.uid() = user_id);

-- Promo codes: Users can update their own codes (mark as used)
DROP POLICY IF EXISTS "Users update own codes" ON public.subscriber_promo_codes;
CREATE POLICY "Users update own codes"
ON public.subscriber_promo_codes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Promo codes: Org members can view codes for their promotions
DROP POLICY IF EXISTS "Org members view promotion codes" ON public.subscriber_promo_codes;
CREATE POLICY "Org members view promotion codes"
ON public.subscriber_promo_codes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.manufacturer_promotions mp
    JOIN public.organization_members om ON om.organization_id = mp.organization_id
    WHERE mp.id = subscriber_promo_codes.promotion_id
      AND om.user_id = auth.uid()
  )
);

-- Promo codes: Service role can manage all codes
DROP POLICY IF EXISTS "Service role manages codes" ON public.subscriber_promo_codes;
CREATE POLICY "Service role manages codes"
ON public.subscriber_promo_codes FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Generate unique promo code
CREATE OR REPLACE FUNCTION public.generate_promo_code(p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  part1 text := '';
  part2 text := '';
  i integer;
BEGIN
  -- Generate two 4-character parts
  FOR i IN 1..4 LOOP
    part1 := part1 || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    part2 := part2 || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;

  -- Format: PREFIX-XXXX-XXXX
  code := upper(p_prefix) || '-' || part1 || '-' || part2;

  RETURN code;
END;
$$;

-- Get subscriber count for promotion distribution
CREATE OR REPLACE FUNCTION public.get_promotion_subscriber_count(p_organization_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::integer
  FROM public.consumer_subscriptions
  WHERE target_type = 'organization'
    AND target_id = p_organization_id
    AND is_active = true;
$$;

-- Distribute promo codes to all subscribers
CREATE OR REPLACE FUNCTION public.distribute_promotion_codes(
  p_promotion_id uuid,
  p_notify_email boolean DEFAULT true,
  p_notify_in_app boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion record;
  v_subscriber record;
  v_code text;
  v_codes_created integer := 0;
  v_channel text;
BEGIN
  -- Get promotion details
  SELECT * INTO v_promotion
  FROM public.manufacturer_promotions
  WHERE id = p_promotion_id;

  IF v_promotion IS NULL THEN
    RAISE EXCEPTION 'Promotion not found';
  END IF;

  IF v_promotion.status != 'active' THEN
    RAISE EXCEPTION 'Promotion must be active to distribute codes';
  END IF;

  -- Determine notification channel
  IF p_notify_email AND p_notify_in_app THEN
    v_channel := 'both';
  ELSIF p_notify_email THEN
    v_channel := 'email';
  ELSE
    v_channel := 'in_app';
  END IF;

  -- Loop through all active subscribers
  FOR v_subscriber IN
    SELECT cs.user_id, cs.notification_preferences
    FROM public.consumer_subscriptions cs
    WHERE cs.target_type = 'organization'
      AND cs.target_id = v_promotion.organization_id
      AND cs.is_active = true
  LOOP
    -- Check if code already exists for this user
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriber_promo_codes
      WHERE promotion_id = p_promotion_id AND user_id = v_subscriber.user_id
    ) THEN
      -- Generate unique code
      LOOP
        v_code := public.generate_promo_code(v_promotion.code_prefix);
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.subscriber_promo_codes WHERE code = v_code
        );
      END LOOP;

      -- Create the code
      INSERT INTO public.subscriber_promo_codes (
        promotion_id, user_id, code, status,
        expires_at, notification_channel, sent_at
      )
      VALUES (
        p_promotion_id, v_subscriber.user_id, v_code, 'active',
        v_promotion.ends_at, v_channel, now()
      );

      v_codes_created := v_codes_created + 1;
    END IF;
  END LOOP;

  -- Update promotion stats
  UPDATE public.manufacturer_promotions
  SET distributed_at = now(),
      total_codes_generated = total_codes_generated + v_codes_created,
      updated_at = now()
  WHERE id = p_promotion_id;

  RETURN jsonb_build_object(
    'success', true,
    'codes_created', v_codes_created,
    'distributed_at', now()
  );
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.manufacturer_promotions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manufacturer_promotions_updated_at_trigger ON public.manufacturer_promotions;
CREATE TRIGGER manufacturer_promotions_updated_at_trigger
BEFORE UPDATE ON public.manufacturer_promotions
FOR EACH ROW
EXECUTE FUNCTION public.manufacturer_promotions_updated_at();

-- ============================================================
-- NOTIFICATION TYPE for promo codes
-- ============================================================

INSERT INTO public.notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES (
  'subscriber.promo_code',
  'promotion',
  'info',
  'Специальное предложение от {{organization_name}}',
  '{{organization_name}} поделились с вами эксклюзивным промокодом! {{discount_description}}. Код: {{promo_code}}',
  ARRAY['in_app', 'email']
)
ON CONFLICT (key) DO UPDATE
SET title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.manufacturer_promotions IS
  'Promotional campaigns created by manufacturers to share discount codes with their subscribers';

COMMENT ON TABLE public.subscriber_promo_codes IS
  'Individual promo codes generated for each subscriber of a promotion';

COMMENT ON FUNCTION public.generate_promo_code IS
  'Generate a unique promo code with format PREFIX-XXXX-XXXX';

COMMENT ON FUNCTION public.distribute_promotion_codes IS
  'Generate and distribute promo codes to all active subscribers of an organization';

COMMIT;
