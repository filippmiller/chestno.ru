-- Migration 0039: Social Sharing and Referrals
-- Date: 2026-02-01
-- Description: Track social shares and implement referral system

BEGIN;

-- ============================================================
-- ALTER: app_users - Add referral code
-- ============================================================

-- Add referral_code to app_users table
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS referral_code text;

-- Create unique index for referral codes
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_referral_code
ON public.app_users(referral_code)
WHERE referral_code IS NOT NULL;

-- ============================================================
-- ALTER: app_profiles - Add referral code (for v2 auth)
-- ============================================================

ALTER TABLE public.app_profiles
ADD COLUMN IF NOT EXISTS referral_code text,
ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_profiles_referral_code
ON public.app_profiles(referral_code)
WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_profiles_referred_by
ON public.app_profiles(referred_by)
WHERE referred_by IS NOT NULL;

-- ============================================================
-- TABLE: share_events
-- ============================================================
-- Tracks all sharing activity for analytics and referral tracking

CREATE TABLE IF NOT EXISTS public.share_events (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who shared (optional - anonymous shares allowed)
  user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What was shared (polymorphic)
  shared_type text NOT NULL
    CHECK (shared_type IN ('product', 'organization', 'review', 'qr_code', 'badge')),
  shared_id uuid NOT NULL,
    -- References product_id, organization_id, review_id, qr_code_id

  -- Share details
  platform text NOT NULL
    CHECK (platform IN (
      'whatsapp',
      'telegram',
      'vk',
      'facebook',
      'twitter',
      'linkedin',
      'email',
      'sms',
      'copy_link',
      'native_share',
      'qr_scan',
      'other'
    )),

  -- Tracking
  referral_code text,
    -- If shared via referral link
  share_url text,
    -- The URL that was shared
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- Device/session info
  device_type text,
    -- mobile, tablet, desktop
  user_agent text,
  ip_address inet,

  -- Outcome tracking
  clicks_count integer NOT NULL DEFAULT 0,
  conversions_count integer NOT NULL DEFAULT 0,
    -- Conversion = someone who clicked and then performed action (signup, follow, etc.)

  -- Metadata
  metadata jsonb,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- By user (for user analytics)
CREATE INDEX idx_share_events_user
ON public.share_events(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- By shared content (for content analytics)
CREATE INDEX idx_share_events_content
ON public.share_events(shared_type, shared_id, created_at DESC);

-- By platform (for platform analytics)
CREATE INDEX idx_share_events_platform
ON public.share_events(platform, created_at DESC);

-- By referral code (for referral tracking)
CREATE INDEX idx_share_events_referral
ON public.share_events(referral_code, created_at DESC)
WHERE referral_code IS NOT NULL;

-- For date-based analytics
CREATE INDEX idx_share_events_created_at
ON public.share_events(created_at DESC);

-- Composite for dashboard queries
CREATE INDEX idx_share_events_analytics
ON public.share_events(shared_type, platform, created_at DESC);

-- ============================================================
-- TABLE: share_clicks
-- ============================================================
-- Tracks clicks on shared links (for attribution)

CREATE TABLE IF NOT EXISTS public.share_clicks (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to share event
  share_event_id uuid
    REFERENCES public.share_events(id) ON DELETE SET NULL,

  -- Or via referral code if share_event unknown
  referral_code text,

  -- Who clicked (if known)
  user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Session tracking
  session_id text,
    -- Anonymous session identifier

  -- Device info
  device_type text,
  user_agent text,
  ip_address inet,
  referer_url text,

  -- Conversion tracking
  converted boolean NOT NULL DEFAULT false,
  conversion_type text,
    -- signup, follow, purchase, etc.
  conversion_at timestamptz,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES for share_clicks
-- ============================================================

CREATE INDEX idx_share_clicks_event
ON public.share_clicks(share_event_id, created_at DESC)
WHERE share_event_id IS NOT NULL;

CREATE INDEX idx_share_clicks_referral
ON public.share_clicks(referral_code, created_at DESC)
WHERE referral_code IS NOT NULL;

CREATE INDEX idx_share_clicks_user
ON public.share_clicks(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX idx_share_clicks_conversions
ON public.share_clicks(converted, conversion_type)
WHERE converted = true;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_clicks ENABLE ROW LEVEL SECURITY;

-- Share events: users can view their own
DROP POLICY IF EXISTS "Users view own shares" ON public.share_events;
CREATE POLICY "Users view own shares"
ON public.share_events
FOR SELECT
USING (auth.uid() = user_id);

-- Share events: anyone can create (for anonymous shares)
DROP POLICY IF EXISTS "Anyone can create share events" ON public.share_events;
CREATE POLICY "Anyone can create share events"
ON public.share_events
FOR INSERT
WITH CHECK (true);

-- Share events: org admins can view shares of their content
DROP POLICY IF EXISTS "Org admins view content shares" ON public.share_events;
CREATE POLICY "Org admins view content shares"
ON public.share_events
FOR SELECT
USING (
  -- Product shares
  (shared_type = 'product' AND EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = share_events.shared_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ))
  OR
  -- Organization shares
  (shared_type = 'organization' AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = share_events.shared_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ))
);

-- Share events: platform admins can view all
DROP POLICY IF EXISTS "Platform admins view all shares" ON public.share_events;
CREATE POLICY "Platform admins view all shares"
ON public.share_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.role IN ('platform_owner', 'platform_admin')
  )
);

-- Share clicks: similar policies
DROP POLICY IF EXISTS "Users view own clicks" ON public.share_clicks;
CREATE POLICY "Users view own clicks"
ON public.share_clicks
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can create clicks" ON public.share_clicks;
CREATE POLICY "Anyone can create clicks"
ON public.share_clicks
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins view all clicks" ON public.share_clicks;
CREATE POLICY "Platform admins view all clicks"
ON public.share_clicks
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

-- Generate unique referral code for user
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    -- Check if exists in either table
    SELECT EXISTS (
      SELECT 1 FROM public.app_users WHERE referral_code = v_code
      UNION
      SELECT 1 FROM public.app_profiles WHERE referral_code = v_code
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- Ensure user has referral code
CREATE OR REPLACE FUNCTION public.ensure_user_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  -- Check app_profiles first (v2 auth)
  SELECT referral_code INTO v_code
  FROM public.app_profiles
  WHERE id = p_user_id;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Check app_users
  SELECT referral_code INTO v_code
  FROM public.app_users
  WHERE id = p_user_id;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate new code
  v_code := public.generate_referral_code();

  -- Try to update app_profiles first
  UPDATE public.app_profiles
  SET referral_code = v_code
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    -- Update app_users
    UPDATE public.app_users
    SET referral_code = v_code
    WHERE id = p_user_id;
  END IF;

  RETURN v_code;
END;
$$;

-- Record share event
CREATE OR REPLACE FUNCTION public.record_share_event(
  p_shared_type text,
  p_shared_id uuid,
  p_platform text,
  p_share_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referral_code text;
  v_share_id uuid;
BEGIN
  -- Get user's referral code if authenticated
  IF v_user_id IS NOT NULL THEN
    v_referral_code := public.ensure_user_referral_code(v_user_id);
  END IF;

  -- Insert share event
  INSERT INTO public.share_events (
    user_id,
    shared_type,
    shared_id,
    platform,
    referral_code,
    share_url,
    metadata
  ) VALUES (
    v_user_id,
    p_shared_type,
    p_shared_id,
    p_platform,
    v_referral_code,
    p_share_url,
    p_metadata
  )
  RETURNING id INTO v_share_id;

  RETURN v_share_id;
END;
$$;

-- Record click and update share event counter
CREATE OR REPLACE FUNCTION public.record_share_click(
  p_referral_code text DEFAULT NULL,
  p_share_event_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_click_id uuid;
BEGIN
  -- Insert click
  INSERT INTO public.share_clicks (
    share_event_id,
    referral_code,
    user_id,
    session_id
  ) VALUES (
    p_share_event_id,
    p_referral_code,
    auth.uid(),
    p_session_id
  )
  RETURNING id INTO v_click_id;

  -- Update share event counter if we have the event
  IF p_share_event_id IS NOT NULL THEN
    UPDATE public.share_events
    SET clicks_count = clicks_count + 1
    WHERE id = p_share_event_id;
  END IF;

  RETURN v_click_id;
END;
$$;

-- Get sharing analytics for content
CREATE OR REPLACE FUNCTION public.get_share_analytics(
  p_shared_type text,
  p_shared_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  total_shares bigint,
  total_clicks bigint,
  total_conversions bigint,
  shares_by_platform jsonb,
  shares_over_time jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH share_stats AS (
    SELECT
      count(*) as total_shares,
      sum(clicks_count) as total_clicks,
      sum(conversions_count) as total_conversions
    FROM public.share_events
    WHERE shared_type = p_shared_type
      AND shared_id = p_shared_id
      AND created_at >= now() - (p_days || ' days')::interval
  ),
  platform_stats AS (
    SELECT jsonb_object_agg(platform, cnt) as by_platform
    FROM (
      SELECT platform, count(*) as cnt
      FROM public.share_events
      WHERE shared_type = p_shared_type
        AND shared_id = p_shared_id
        AND created_at >= now() - (p_days || ' days')::interval
      GROUP BY platform
    ) p
  ),
  time_stats AS (
    SELECT jsonb_agg(jsonb_build_object('date', day, 'shares', cnt) ORDER BY day) as over_time
    FROM (
      SELECT date_trunc('day', created_at)::date as day, count(*) as cnt
      FROM public.share_events
      WHERE shared_type = p_shared_type
        AND shared_id = p_shared_id
        AND created_at >= now() - (p_days || ' days')::interval
      GROUP BY date_trunc('day', created_at)::date
    ) t
  )
  SELECT
    s.total_shares,
    s.total_clicks,
    s.total_conversions,
    p.by_platform,
    t.over_time
  FROM share_stats s, platform_stats p, time_stats t;
$$;

-- ============================================================
-- TRIGGER: Auto-generate referral code on user creation
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

-- For app_profiles
DROP TRIGGER IF EXISTS app_profiles_auto_referral_trigger ON public.app_profiles;
CREATE TRIGGER app_profiles_auto_referral_trigger
BEFORE INSERT ON public.app_profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_referral_code();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.share_events IS
  'Tracks all social sharing activity for analytics and referral attribution.';

COMMENT ON TABLE public.share_clicks IS
  'Tracks clicks on shared links for conversion tracking and attribution.';

COMMENT ON COLUMN public.app_users.referral_code IS
  'Unique referral code for the user, used in share links for attribution.';

COMMENT ON COLUMN public.app_profiles.referral_code IS
  'Unique referral code for v2 auth users.';

COMMENT ON COLUMN public.app_profiles.referred_by IS
  'UUID of the user who referred this user via their referral code.';

COMMENT ON FUNCTION public.record_share_event IS
  'Records a new share event and returns the share_event_id.';

COMMENT ON FUNCTION public.record_share_click IS
  'Records a click on a shared link and increments the share event counter.';

COMMENT ON FUNCTION public.get_share_analytics IS
  'Returns sharing analytics for a specific piece of content over a time period.';

COMMIT;
