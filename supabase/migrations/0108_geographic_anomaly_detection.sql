-- Migration 0108: Geographic Anomaly Detection (Gray Market Detection)
-- Date: 2026-02-03
-- Description: Tables for detecting products appearing outside authorized distribution regions

BEGIN;

-- =============================================================================
-- TABLE: authorized_regions
-- =============================================================================
-- Defines authorized distribution regions for products
-- Producers can specify which regions their products should appear in

CREATE TABLE IF NOT EXISTS public.authorized_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    organization_id UUID NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID
        REFERENCES public.products(id) ON DELETE CASCADE,
        -- NULL means applies to all org products

    -- Region information
    region_code TEXT NOT NULL,  -- ISO 3166-2 code e.g., 'RU-MOW', 'RU-SPE'
    region_name TEXT NOT NULL,  -- Human-readable name e.g., 'Москва'

    -- Distribution type
    is_exclusive BOOLEAN DEFAULT false,
        -- true = ONLY this region is authorized
        -- false = this region is authorized (among others)

    -- Coordinates for boundary checking (optional, for polygon-based detection)
    center_lat NUMERIC(10, 7),
    center_lng NUMERIC(10, 7),
    radius_km INTEGER DEFAULT 100,  -- Approximate radius for simple circle-based detection

    -- Metadata
    notes TEXT,  -- Internal notes about this region
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_authorized_regions_org ON public.authorized_regions(organization_id);
CREATE INDEX idx_authorized_regions_product ON public.authorized_regions(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_authorized_regions_code ON public.authorized_regions(region_code);
CREATE UNIQUE INDEX idx_unique_region_per_product ON public.authorized_regions(organization_id, product_id, region_code)
    WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX idx_unique_region_per_org ON public.authorized_regions(organization_id, region_code)
    WHERE product_id IS NULL;

-- =============================================================================
-- TABLE: geographic_anomalies
-- =============================================================================
-- Records detected anomalies when products are scanned outside authorized regions

CREATE TABLE IF NOT EXISTS public.geographic_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    organization_id UUID NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID
        REFERENCES public.products(id) ON DELETE SET NULL,
    qr_code_id UUID,  -- Reference to qr_codes table if applicable
    scan_event_id UUID,  -- Reference to qr_scan_events table

    -- Location data
    expected_region TEXT NOT NULL,  -- The authorized region code(s), comma-separated if multiple
    actual_region TEXT NOT NULL,  -- The detected region code where scan occurred
    actual_region_name TEXT,  -- Human-readable name

    -- Coordinates (privacy-preserved - grid-level precision)
    scan_lat NUMERIC(8, 4),  -- ~11m precision, reduced for privacy
    scan_lng NUMERIC(8, 4),

    -- Distance from nearest authorized region (km)
    distance_from_authorized_km INTEGER,

    -- Anomaly classification
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        -- low: Within 50km of authorized region (could be border case)
        -- medium: 50-200km from authorized region
        -- high: 200-500km from authorized region
        -- critical: >500km or different country

    anomaly_type TEXT NOT NULL DEFAULT 'region_mismatch'
        CHECK (anomaly_type IN (
            'region_mismatch',       -- Scan in unauthorized region
            'country_mismatch',      -- Scan in different country
            'suspicious_pattern',    -- Multiple scans from unexpected location
            'velocity_anomaly'       -- Product moved too fast between scans
        )),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'under_review', 'confirmed', 'false_positive', 'resolved')),

    -- Investigation
    investigated_at TIMESTAMPTZ,
    investigated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    investigation_notes TEXT,
    resolution TEXT,  -- What action was taken

    -- Additional context
    scan_metadata JSONB,  -- User agent, device type, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX idx_geo_anomaly_org ON public.geographic_anomalies(organization_id);
CREATE INDEX idx_geo_anomaly_product ON public.geographic_anomalies(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_geo_anomaly_status ON public.geographic_anomalies(status, created_at DESC);
CREATE INDEX idx_geo_anomaly_severity ON public.geographic_anomalies(severity, created_at DESC);
CREATE INDEX idx_geo_anomaly_created ON public.geographic_anomalies(created_at DESC);
CREATE INDEX idx_geo_anomaly_org_status ON public.geographic_anomalies(organization_id, status, created_at DESC);
CREATE INDEX idx_geo_anomaly_type ON public.geographic_anomalies(anomaly_type);

-- Composite index for dashboard queries
CREATE INDEX idx_geo_anomaly_dashboard ON public.geographic_anomalies(
    organization_id,
    status,
    severity,
    created_at DESC
);

-- =============================================================================
-- TABLE: anomaly_alert_rules
-- =============================================================================
-- Configurable rules for anomaly alerting per organization

CREATE TABLE IF NOT EXISTS public.anomaly_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Rule configuration
    rule_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,

    -- Threshold settings
    severity_threshold TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity_threshold IN ('low', 'medium', 'high', 'critical')),
    min_anomalies_for_alert INTEGER DEFAULT 1,  -- Number of anomalies before alerting
    time_window_hours INTEGER DEFAULT 24,  -- Time window for counting anomalies

    -- Notification settings
    notify_email BOOLEAN DEFAULT true,
    notify_telegram BOOLEAN DEFAULT false,
    notify_webhook BOOLEAN DEFAULT false,
    webhook_url TEXT,

    -- Recipients (JSON array of user IDs)
    notify_user_ids JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_rule_per_org UNIQUE (organization_id, rule_name)
);

CREATE INDEX idx_alert_rules_org ON public.anomaly_alert_rules(organization_id);
CREATE INDEX idx_alert_rules_active ON public.anomaly_alert_rules(is_active) WHERE is_active = true;

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.authorized_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geographic_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_alert_rules ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES: authorized_regions
-- =============================================================================

-- Org members can view their authorized regions
CREATE POLICY "Org members view authorized regions"
    ON public.authorized_regions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = authorized_regions.organization_id
            AND om.user_id = auth.uid()
        )
    );

-- Org admins can manage authorized regions
CREATE POLICY "Org admins manage authorized regions"
    ON public.authorized_regions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = authorized_regions.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- Service role has full access
CREATE POLICY "Service role manages authorized regions"
    ON public.authorized_regions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- RLS POLICIES: geographic_anomalies
-- =============================================================================

-- Org members can view anomalies
CREATE POLICY "Org members view anomalies"
    ON public.geographic_anomalies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = geographic_anomalies.organization_id
            AND om.user_id = auth.uid()
        )
    );

-- Org admins can update anomalies (investigation)
CREATE POLICY "Org admins update anomalies"
    ON public.geographic_anomalies FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = geographic_anomalies.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- Service role has full access (for automated detection)
CREATE POLICY "Service role manages anomalies"
    ON public.geographic_anomalies FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Platform admins can view all
CREATE POLICY "Platform admins view all anomalies"
    ON public.geographic_anomalies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.app_profiles ap
            WHERE ap.id = auth.uid()
            AND ap.role = 'admin'
        )
    );

-- =============================================================================
-- RLS POLICIES: anomaly_alert_rules
-- =============================================================================

-- Org members can view alert rules
CREATE POLICY "Org members view alert rules"
    ON public.anomaly_alert_rules FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = anomaly_alert_rules.organization_id
            AND om.user_id = auth.uid()
        )
    );

-- Org admins can manage alert rules
CREATE POLICY "Org admins manage alert rules"
    ON public.anomaly_alert_rules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = anomaly_alert_rules.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- Service role has full access
CREATE POLICY "Service role manages alert rules"
    ON public.anomaly_alert_rules FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to check if a scan location is within authorized regions
CREATE OR REPLACE FUNCTION public.check_scan_in_authorized_region(
    p_organization_id UUID,
    p_product_id UUID,
    p_scan_lat NUMERIC,
    p_scan_lng NUMERIC
)
RETURNS TABLE (
    is_authorized BOOLEAN,
    nearest_region_code TEXT,
    nearest_region_name TEXT,
    distance_km INTEGER,
    severity TEXT
) AS $$
DECLARE
    v_authorized_regions RECORD;
    v_min_distance NUMERIC := 999999;
    v_nearest_code TEXT;
    v_nearest_name TEXT;
    v_has_regions BOOLEAN := false;
BEGIN
    -- Check authorized regions for this product or organization-wide
    FOR v_authorized_regions IN
        SELECT
            ar.region_code,
            ar.region_name,
            ar.center_lat,
            ar.center_lng,
            ar.radius_km
        FROM public.authorized_regions ar
        WHERE ar.organization_id = p_organization_id
        AND (ar.product_id = p_product_id OR ar.product_id IS NULL)
    LOOP
        v_has_regions := true;

        -- Simple distance calculation (Haversine approximation)
        DECLARE
            v_distance NUMERIC;
        BEGIN
            v_distance := 111.0 * SQRT(
                POWER(v_authorized_regions.center_lat - p_scan_lat, 2) +
                POWER((v_authorized_regions.center_lng - p_scan_lng) * COS(RADIANS(p_scan_lat)), 2)
            );

            IF v_distance < v_min_distance THEN
                v_min_distance := v_distance;
                v_nearest_code := v_authorized_regions.region_code;
                v_nearest_name := v_authorized_regions.region_name;
            END IF;

            -- Check if within authorized radius
            IF v_distance <= v_authorized_regions.radius_km THEN
                RETURN QUERY SELECT
                    true,
                    v_authorized_regions.region_code,
                    v_authorized_regions.region_name,
                    v_distance::INTEGER,
                    'none'::TEXT;
                RETURN;
            END IF;
        END;
    END LOOP;

    -- No authorized regions defined - allow by default
    IF NOT v_has_regions THEN
        RETURN QUERY SELECT
            true,
            'NONE_DEFINED'::TEXT,
            'No regions defined'::TEXT,
            0,
            'none'::TEXT;
        RETURN;
    END IF;

    -- Outside all authorized regions - determine severity
    RETURN QUERY SELECT
        false,
        v_nearest_code,
        v_nearest_name,
        v_min_distance::INTEGER,
        CASE
            WHEN v_min_distance < 50 THEN 'low'
            WHEN v_min_distance < 200 THEN 'medium'
            WHEN v_min_distance < 500 THEN 'high'
            ELSE 'critical'
        END::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get anomaly statistics for an organization
CREATE OR REPLACE FUNCTION public.get_anomaly_stats(
    p_organization_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_anomalies BIGINT,
    new_count BIGINT,
    under_review_count BIGINT,
    confirmed_count BIGINT,
    false_positive_count BIGINT,
    resolved_count BIGINT,
    low_severity BIGINT,
    medium_severity BIGINT,
    high_severity BIGINT,
    critical_severity BIGINT,
    top_anomaly_regions JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'new') AS new_c,
            COUNT(*) FILTER (WHERE status = 'under_review') AS review_c,
            COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_c,
            COUNT(*) FILTER (WHERE status = 'false_positive') AS fp_c,
            COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_c,
            COUNT(*) FILTER (WHERE severity = 'low') AS low_c,
            COUNT(*) FILTER (WHERE severity = 'medium') AS medium_c,
            COUNT(*) FILTER (WHERE severity = 'high') AS high_c,
            COUNT(*) FILTER (WHERE severity = 'critical') AS critical_c
        FROM public.geographic_anomalies ga
        WHERE ga.organization_id = p_organization_id
        AND ga.created_at >= now() - (p_days || ' days')::INTERVAL
    ),
    top_regions AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'region', actual_region,
                'region_name', actual_region_name,
                'count', cnt
            )
        ) AS regions
        FROM (
            SELECT
                actual_region,
                actual_region_name,
                COUNT(*) AS cnt
            FROM public.geographic_anomalies
            WHERE organization_id = p_organization_id
            AND created_at >= now() - (p_days || ' days')::INTERVAL
            GROUP BY actual_region, actual_region_name
            ORDER BY cnt DESC
            LIMIT 5
        ) sub
    )
    SELECT
        s.total,
        s.new_c,
        s.review_c,
        s.confirmed_c,
        s.fp_c,
        s.resolved_c,
        s.low_c,
        s.medium_c,
        s.high_c,
        s.critical_c,
        COALESCE(tr.regions, '[]'::JSONB)
    FROM stats s, top_regions tr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_geo_anomaly_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_authorized_regions_updated
    BEFORE UPDATE ON public.authorized_regions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_geo_anomaly_timestamp();

CREATE TRIGGER trg_geographic_anomalies_updated
    BEFORE UPDATE ON public.geographic_anomalies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_geo_anomaly_timestamp();

CREATE TRIGGER trg_anomaly_alert_rules_updated
    BEFORE UPDATE ON public.anomaly_alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_geo_anomaly_timestamp();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.authorized_regions IS 'Defines authorized distribution regions for products to detect gray market activity';
COMMENT ON TABLE public.geographic_anomalies IS 'Records detected anomalies when products are scanned outside authorized regions';
COMMENT ON TABLE public.anomaly_alert_rules IS 'Configurable rules for geographic anomaly alerting';
COMMENT ON FUNCTION public.check_scan_in_authorized_region IS 'Checks if a scan location is within authorized distribution regions';
COMMENT ON FUNCTION public.get_anomaly_stats IS 'Returns aggregated statistics about geographic anomalies for an organization';

COMMIT;
