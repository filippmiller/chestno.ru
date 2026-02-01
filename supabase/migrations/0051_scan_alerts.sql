-- Migration: Real-time Scan Alert System
-- Adds alert rules, scan statistics, Telegram integration, and escalation

SET client_encoding = 'UTF8';

-- ============================================
-- 1. Product Batches Table (for batch-level tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.product_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_code text NOT NULL,
    batch_name text,
    production_date date,
    expiry_date date,
    quantity integer,
    metadata jsonb DEFAULT '{}',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT product_batches_unique_code UNIQUE (organization_id, batch_code)
);

CREATE INDEX idx_product_batches_org ON public.product_batches(organization_id);
CREATE INDEX idx_product_batches_product ON public.product_batches(product_id);
CREATE INDEX idx_product_batches_code ON public.product_batches(batch_code);

-- ============================================
-- 2. Scan Events Extended (link to batches)
-- ============================================

ALTER TABLE public.qr_scan_events
    ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS country text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
    ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
    ADD COLUMN IF NOT EXISTS device_type text,
    ADD COLUMN IF NOT EXISTS is_suspicious boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS suspicious_reason text;

CREATE INDEX IF NOT EXISTS idx_qr_scan_events_batch ON public.qr_scan_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_product ON public.qr_scan_events(product_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_suspicious ON public.qr_scan_events(is_suspicious) WHERE is_suspicious = true;

-- ============================================
-- 3. Scan Alert Types (extends notification_types)
-- ============================================

INSERT INTO public.notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('scan.first_batch_scan', 'scan', 'info',
     'Первое сканирование партии {{batch_code}}',
     'Партия {{batch_code}} продукта "{{product_name}}" впервые отсканирована в {{location}}.',
     ARRAY['in_app', 'push']),

    ('scan.unusual_pattern', 'scan', 'warning',
     'Подозрительная активность сканирования',
     'Обнаружена необычная активность для {{batch_code}}: {{reason}}. Рекомендуем проверить.',
     ARRAY['in_app', 'push', 'email']),

    ('scan.potential_counterfeit', 'scan', 'critical',
     'Возможная подделка обнаружена!',
     'ВНИМАНИЕ: Партия {{batch_code}} показывает признаки подделки. {{details}}',
     ARRAY['in_app', 'push', 'email', 'telegram']),

    ('scan.viral_spike', 'scan', 'info',
     'Резкий рост сканирований!',
     'Партия {{batch_code}} набирает популярность: {{scan_count}} сканирований за {{time_period}}.',
     ARRAY['in_app', 'push']),

    ('scan.geographic_anomaly', 'scan', 'warning',
     'Географическая аномалия сканирования',
     'Партия {{batch_code}} сканируется из неожиданного региона: {{location}}.',
     ARRAY['in_app', 'push', 'email']),

    ('scan.milestone_reached', 'scan', 'info',
     'Достигнут рубеж сканирований!',
     'Поздравляем! Партия {{batch_code}} достигла {{milestone}} сканирований.',
     ARRAY['in_app', 'push']),

    ('review.negative_alert', 'review', 'warning',
     'Получен негативный отзыв',
     'Пользователь оставил отзыв с оценкой {{rating}}/5 о продукте "{{product_name}}". Рекомендуем ответить.',
     ARRAY['in_app', 'push', 'email'])
ON CONFLICT (key) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    default_channels = EXCLUDED.default_channels;

-- ============================================
-- 4. Alert Rules Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_alert_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_type text NOT NULL CHECK (rule_type IN (
        'first_scan',
        'scan_spike',
        'unusual_location',
        'time_anomaly',
        'counterfeit_pattern',
        'milestone',
        'negative_review'
    )),
    rule_name text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    priority smallint NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

    -- Rule configuration (varies by type)
    config jsonb NOT NULL DEFAULT '{}',

    -- Notification settings
    channels text[] NOT NULL DEFAULT ARRAY['in_app'],
    cooldown_minutes integer NOT NULL DEFAULT 60,

    -- Auto-escalation settings
    escalate_after_minutes integer,
    escalate_to_user_ids uuid[],

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_alert_rules_org ON public.scan_alert_rules(organization_id);
CREATE INDEX idx_scan_alert_rules_type ON public.scan_alert_rules(rule_type);
CREATE INDEX idx_scan_alert_rules_enabled ON public.scan_alert_rules(is_enabled) WHERE is_enabled = true;

-- ============================================
-- 5. Alert Events (fired alerts)
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_id uuid REFERENCES public.scan_alert_rules(id) ON DELETE SET NULL,
    alert_type text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),

    -- Alert context
    batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    scan_event_id uuid REFERENCES public.qr_scan_events(id) ON DELETE SET NULL,

    -- Alert content
    title text NOT NULL,
    body text NOT NULL,
    metadata jsonb DEFAULT '{}',

    -- Status tracking
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'investigating', 'resolved', 'dismissed')),
    acknowledged_at timestamptz,
    acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes text,

    -- Escalation tracking
    is_escalated boolean NOT NULL DEFAULT false,
    escalated_at timestamptz,
    escalation_level smallint DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_alerts_org ON public.scan_alerts(organization_id);
CREATE INDEX idx_scan_alerts_status ON public.scan_alerts(status);
CREATE INDEX idx_scan_alerts_severity ON public.scan_alerts(severity);
CREATE INDEX idx_scan_alerts_created ON public.scan_alerts(created_at DESC);
CREATE INDEX idx_scan_alerts_batch ON public.scan_alerts(batch_id);
CREATE INDEX idx_scan_alerts_unresolved ON public.scan_alerts(organization_id, status)
    WHERE status NOT IN ('resolved', 'dismissed');

-- ============================================
-- 6. Telegram Integration
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_telegram_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id text NOT NULL,
    telegram_username text,
    is_verified boolean NOT NULL DEFAULT false,
    verification_code text,
    verification_expires_at timestamptz,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id),
    UNIQUE (telegram_chat_id)
);

CREATE INDEX idx_user_telegram_verified ON public.user_telegram_links(is_verified) WHERE is_verified = true;

-- ============================================
-- 7. Organization Alert Preferences
-- ============================================

CREATE TABLE IF NOT EXISTS public.organization_alert_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,

    -- Global settings
    alerts_enabled boolean NOT NULL DEFAULT true,
    quiet_hours_start time,
    quiet_hours_end time,
    quiet_hours_timezone text DEFAULT 'Europe/Moscow',

    -- Default channels
    default_channels text[] NOT NULL DEFAULT ARRAY['in_app', 'email'],

    -- Escalation defaults
    auto_escalate_critical boolean NOT NULL DEFAULT true,
    escalation_delay_minutes integer NOT NULL DEFAULT 30,

    -- Digest preferences
    send_daily_digest boolean NOT NULL DEFAULT true,
    digest_time time DEFAULT '09:00',

    -- Thresholds
    scan_spike_threshold integer NOT NULL DEFAULT 100,
    scan_spike_window_minutes integer NOT NULL DEFAULT 60,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 8. Scan Statistics (for anomaly detection)
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_statistics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    batch_id uuid REFERENCES public.product_batches(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,

    -- Time bucket
    bucket_start timestamptz NOT NULL,
    bucket_type text NOT NULL CHECK (bucket_type IN ('hour', 'day', 'week')),

    -- Metrics
    scan_count integer NOT NULL DEFAULT 0,
    unique_users integer NOT NULL DEFAULT 0,
    unique_locations integer NOT NULL DEFAULT 0,
    suspicious_count integer NOT NULL DEFAULT 0,

    -- Geographic distribution
    top_countries jsonb DEFAULT '[]',
    top_cities jsonb DEFAULT '[]',

    -- Computed metrics
    avg_scans_per_hour numeric(10, 2),
    deviation_from_normal numeric(10, 2),

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT scan_stats_unique_bucket UNIQUE (organization_id, batch_id, product_id, bucket_start, bucket_type)
);

CREATE INDEX idx_scan_stats_org ON public.scan_statistics(organization_id);
CREATE INDEX idx_scan_stats_batch ON public.scan_statistics(batch_id);
CREATE INDEX idx_scan_stats_bucket ON public.scan_statistics(bucket_start, bucket_type);

-- ============================================
-- 9. RLS Policies
-- ============================================

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_statistics ENABLE ROW LEVEL SECURITY;

-- Product Batches Policies
CREATE POLICY "Org members view batches" ON public.product_batches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = product_batches.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org editors manage batches" ON public.product_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = product_batches.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Scan Alert Rules Policies
CREATE POLICY "Org members view alert rules" ON public.scan_alert_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alert_rules.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage alert rules" ON public.scan_alert_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alert_rules.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

-- Scan Alerts Policies
CREATE POLICY "Org members view alerts" ON public.scan_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alerts.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org members update alerts" ON public.scan_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alerts.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- Telegram Links Policies
CREATE POLICY "Users manage own telegram" ON public.user_telegram_links
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Alert Preferences Policies
CREATE POLICY "Org members view alert preferences" ON public.organization_alert_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_alert_preferences.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage alert preferences" ON public.organization_alert_preferences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_alert_preferences.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

-- Scan Statistics Policies
CREATE POLICY "Org members view scan stats" ON public.scan_statistics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_statistics.organization_id
              AND om.user_id = auth.uid()
        )
    );

-- ============================================
-- 10. Default Alert Rules Function
-- ============================================

CREATE OR REPLACE FUNCTION public.create_default_alert_rules(org_id uuid)
RETURNS void AS $$
BEGIN
    -- First scan alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'first_scan', 'Первое сканирование партии',
            '{"notify_for_each_batch": true}'::jsonb,
            ARRAY['in_app', 'push'], 3);

    -- Scan spike alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'scan_spike', 'Всплеск сканирований',
            '{"threshold_multiplier": 3, "min_scans": 50, "window_minutes": 60}'::jsonb,
            ARRAY['in_app', 'push', 'email'], 5);

    -- Unusual location alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'unusual_location', 'Неожиданный регион',
            '{"expected_countries": ["RU"], "alert_on_new_country": true}'::jsonb,
            ARRAY['in_app', 'email'], 4);

    -- Counterfeit pattern alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority,
                                         escalate_after_minutes)
    VALUES (org_id, 'counterfeit_pattern', 'Признаки подделки',
            '{"max_scans_per_hour": 10, "geographic_spread_threshold": 3}'::jsonb,
            ARRAY['in_app', 'push', 'email', 'telegram'], 10,
            15);

    -- Milestone alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'milestone', 'Достижение рубежей',
            '{"milestones": [100, 500, 1000, 5000, 10000]}'::jsonb,
            ARRAY['in_app'], 2);

    -- Negative review alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'negative_review', 'Негативные отзывы',
            '{"min_rating_threshold": 3, "include_no_text": false}'::jsonb,
            ARRAY['in_app', 'push', 'email'], 6);

    -- Create default preferences
    INSERT INTO public.organization_alert_preferences (organization_id)
    VALUES (org_id)
    ON CONFLICT (organization_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Trigger: Auto-create alert rules for new orgs
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_create_org_alert_rules()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_default_alert_rules(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created_alert_rules ON public.organizations;
CREATE TRIGGER on_organization_created_alert_rules
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_create_org_alert_rules();

-- ============================================
-- 12. Comments
-- ============================================

COMMENT ON TABLE public.product_batches IS 'Product batches for tracking individual production runs';
COMMENT ON TABLE public.scan_alert_rules IS 'Configurable alert rules per organization';
COMMENT ON TABLE public.scan_alerts IS 'Fired alerts with status tracking and escalation';
COMMENT ON TABLE public.user_telegram_links IS 'Telegram bot integration for user notifications';
COMMENT ON TABLE public.organization_alert_preferences IS 'Organization-wide alert settings';
COMMENT ON TABLE public.scan_statistics IS 'Aggregated scan metrics for anomaly detection';
