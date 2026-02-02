-- Migration: Real-time Producer Scan Notifications
-- Enables producers to receive real-time notifications when their products are scanned

SET client_encoding = 'UTF8';

-- ============================================
-- 1. Scan Notification Preferences Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,

    -- Master switch
    enabled boolean NOT NULL DEFAULT true,

    -- Notification channels
    channels text[] NOT NULL DEFAULT ARRAY['in_app', 'push'],

    -- Region filter (null = all regions)
    regions_filter text[] DEFAULT NULL,

    -- Time filters
    notify_business_hours_only boolean NOT NULL DEFAULT false,
    business_hours_start time DEFAULT '09:00',
    business_hours_end time DEFAULT '18:00',
    timezone text NOT NULL DEFAULT 'Europe/Moscow',

    -- Frequency controls
    batch_notifications boolean NOT NULL DEFAULT false,
    batch_interval_minutes integer NOT NULL DEFAULT 15,
    min_scans_for_notification integer NOT NULL DEFAULT 1,

    -- Filter settings
    notify_new_regions_only boolean NOT NULL DEFAULT false,
    notify_first_scan_per_product boolean NOT NULL DEFAULT true,
    notify_on_suspicious_scans boolean NOT NULL DEFAULT true,

    -- Product/batch filters (null = all)
    product_ids_filter uuid[] DEFAULT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_notification_prefs_org ON public.scan_notification_preferences(organization_id);
CREATE INDEX idx_scan_notification_prefs_enabled ON public.scan_notification_preferences(enabled) WHERE enabled = true;

-- ============================================
-- 2. Scan Notification History Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_notification_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    scan_event_id uuid REFERENCES public.qr_scan_events(id) ON DELETE SET NULL,

    -- Notification details
    channel text NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'telegram', 'webhook')),
    notification_type text NOT NULL DEFAULT 'scan' CHECK (notification_type IN ('scan', 'batch_summary', 'first_scan', 'suspicious', 'milestone', 'new_region')),

    -- Delivery status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
    error_message text,

    -- Context
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,

    -- Location info at time of scan
    scan_country text,
    scan_city text,

    -- Aggregation for batched notifications
    scan_count integer NOT NULL DEFAULT 1,
    aggregated_scan_ids uuid[] DEFAULT NULL,

    -- Timestamps
    notified_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,

    -- Metadata for debugging/analytics
    metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_scan_notification_history_org ON public.scan_notification_history(organization_id);
CREATE INDEX idx_scan_notification_history_event ON public.scan_notification_history(scan_event_id);
CREATE INDEX idx_scan_notification_history_status ON public.scan_notification_history(status);
CREATE INDEX idx_scan_notification_history_created ON public.scan_notification_history(notified_at DESC);
CREATE INDEX idx_scan_notification_history_org_date ON public.scan_notification_history(organization_id, notified_at DESC);

-- ============================================
-- 3. Live Scan Feed Cache (for real-time display)
-- ============================================

CREATE TABLE IF NOT EXISTS public.live_scan_feed (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    scan_event_id uuid REFERENCES public.qr_scan_events(id) ON DELETE CASCADE,

    -- Denormalized data for fast display
    product_id uuid,
    product_name text,
    product_slug text,
    batch_code text,

    -- Location
    country text,
    city text,
    region text,

    -- Device info
    device_type text,
    user_agent_short text,

    -- Flags
    is_first_scan boolean DEFAULT false,
    is_suspicious boolean DEFAULT false,
    is_new_region boolean DEFAULT false,

    -- Timestamps
    scanned_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_live_scan_feed_org ON public.live_scan_feed(organization_id);
CREATE INDEX idx_live_scan_feed_org_time ON public.live_scan_feed(organization_id, scanned_at DESC);
CREATE INDEX idx_live_scan_feed_expires ON public.live_scan_feed(expires_at);

-- ============================================
-- 4. Add notification types to existing table
-- ============================================

INSERT INTO public.notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('scan.product_scanned', 'scan', 'info',
     'Продукт отсканирован',
     'Ваш продукт "{{product_name}}" был отсканирован в {{location}}.',
     ARRAY['in_app', 'push']),

    ('scan.batch_scanned', 'scan', 'info',
     'Сканирование партии',
     'Партия {{batch_code}} продукта "{{product_name}}" отсканирована {{scan_count}} раз за последние {{period}}.',
     ARRAY['in_app']),

    ('scan.new_region_detected', 'scan', 'info',
     'Новый регион сканирования',
     'Впервые обнаружено сканирование из региона {{region}}: продукт "{{product_name}}".',
     ARRAY['in_app', 'push', 'email']),

    ('scan.suspicious_activity', 'scan', 'warning',
     'Подозрительная активность',
     'Обнаружена подозрительная активность сканирования продукта "{{product_name}}": {{reason}}.',
     ARRAY['in_app', 'push', 'email', 'telegram'])
ON CONFLICT (key) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    default_channels = EXCLUDED.default_channels;

-- ============================================
-- 5. RLS Policies
-- ============================================

ALTER TABLE public.scan_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_scan_feed ENABLE ROW LEVEL SECURITY;

-- Scan Notification Preferences Policies
CREATE POLICY "Org members view notification preferences" ON public.scan_notification_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_notification_preferences.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage notification preferences" ON public.scan_notification_preferences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_notification_preferences.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- Scan Notification History Policies
CREATE POLICY "Org members view notification history" ON public.scan_notification_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_notification_history.organization_id
              AND om.user_id = auth.uid()
        )
    );

-- Live Scan Feed Policies
CREATE POLICY "Org members view live scan feed" ON public.live_scan_feed
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = live_scan_feed.organization_id
              AND om.user_id = auth.uid()
        )
    );

-- ============================================
-- 6. Function: Create default preferences for new orgs
-- ============================================

CREATE OR REPLACE FUNCTION public.create_default_scan_notification_preferences(org_id uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO public.scan_notification_preferences (organization_id)
    VALUES (org_id)
    ON CONFLICT (organization_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Function: Record scan for live feed
-- ============================================

CREATE OR REPLACE FUNCTION public.record_scan_for_live_feed(
    p_scan_event_id uuid,
    p_organization_id uuid,
    p_product_id uuid DEFAULT NULL,
    p_product_name text DEFAULT NULL,
    p_product_slug text DEFAULT NULL,
    p_batch_code text DEFAULT NULL,
    p_country text DEFAULT NULL,
    p_city text DEFAULT NULL,
    p_device_type text DEFAULT NULL,
    p_is_suspicious boolean DEFAULT false
)
RETURNS uuid AS $$
DECLARE
    v_is_first_scan boolean := false;
    v_is_new_region boolean := false;
    v_feed_id uuid;
BEGIN
    -- Check if this is first scan for this product in this org
    IF p_product_id IS NOT NULL THEN
        SELECT NOT EXISTS (
            SELECT 1 FROM public.live_scan_feed
            WHERE organization_id = p_organization_id
              AND product_id = p_product_id
              AND scanned_at < now()
            LIMIT 1
        ) INTO v_is_first_scan;
    END IF;

    -- Check if this is a new region
    IF p_country IS NOT NULL THEN
        SELECT NOT EXISTS (
            SELECT 1 FROM public.live_scan_feed
            WHERE organization_id = p_organization_id
              AND country = p_country
              AND scanned_at < now()
            LIMIT 1
        ) INTO v_is_new_region;
    END IF;

    -- Insert into live feed
    INSERT INTO public.live_scan_feed (
        organization_id,
        scan_event_id,
        product_id,
        product_name,
        product_slug,
        batch_code,
        country,
        city,
        device_type,
        is_first_scan,
        is_suspicious,
        is_new_region
    ) VALUES (
        p_organization_id,
        p_scan_event_id,
        p_product_id,
        p_product_name,
        p_product_slug,
        p_batch_code,
        p_country,
        p_city,
        p_device_type,
        v_is_first_scan,
        p_is_suspicious,
        v_is_new_region
    )
    RETURNING id INTO v_feed_id;

    RETURN v_feed_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Function: Cleanup old feed entries
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_old_scan_feed()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.live_scan_feed
    WHERE expires_at < now();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Trigger: Auto-create preferences for new orgs
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_create_scan_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_default_scan_notification_preferences(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created_scan_prefs ON public.organizations;
CREATE TRIGGER on_organization_created_scan_prefs
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_create_scan_notification_preferences();

-- ============================================
-- 10. Enable Realtime for live feed
-- ============================================

-- Enable realtime for the live_scan_feed table
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_scan_feed;

-- ============================================
-- 11. Comments
-- ============================================

COMMENT ON TABLE public.scan_notification_preferences IS 'Per-organization settings for scan notification delivery';
COMMENT ON TABLE public.scan_notification_history IS 'Audit log of all scan notifications sent';
COMMENT ON TABLE public.live_scan_feed IS 'Real-time feed of recent scans for live dashboard display';
COMMENT ON FUNCTION public.record_scan_for_live_feed IS 'Records a scan event to the live feed with automatic first-scan and new-region detection';
