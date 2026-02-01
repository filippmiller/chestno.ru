-- Anti-Counterfeiting System
-- Scan fingerprinting, anomaly detection, and counterfeit investigation workflow

-- ============================================================================
-- PART 1: Scan Fingerprinting
-- ============================================================================

-- Extended fingerprint data for each QR scan (linked to qr_events)
CREATE TABLE IF NOT EXISTS public.scan_fingerprints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_event_id bigint REFERENCES public.qr_events(id) ON DELETE CASCADE,
    qr_code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,

    -- Device fingerprint components
    device_id_hash text,                    -- Hashed device identifier
    screen_resolution text,                 -- "1920x1080"
    color_depth int,                        -- 24
    timezone_offset int,                    -- -180 (minutes from UTC)
    language text,                          -- "ru-RU"
    platform text,                          -- "MacIntel", "Win32", "Linux armv8l"
    touch_support boolean DEFAULT false,    -- Has touch capability
    device_memory int,                      -- GB of device memory (if available)
    hardware_concurrency int,               -- Number of CPU cores

    -- Browser/app fingerprint
    canvas_hash text,                       -- Canvas fingerprint hash
    webgl_hash text,                        -- WebGL renderer hash
    audio_hash text,                        -- AudioContext fingerprint
    fonts_hash text,                        -- Installed fonts hash

    -- Network fingerprint
    connection_type text,                   -- "wifi", "cellular", "ethernet"
    ip_asn text,                           -- Autonomous System Number
    ip_org text,                           -- ISP organization name
    is_vpn boolean DEFAULT false,          -- VPN/proxy detection
    is_datacenter boolean DEFAULT false,   -- Datacenter IP detection
    is_tor boolean DEFAULT false,          -- Tor exit node detection

    -- Location data
    latitude decimal(10, 8),
    longitude decimal(11, 8),
    accuracy_meters int,                   -- GPS accuracy in meters
    altitude_meters int,
    country_code char(2),
    region_code text,
    city text,
    postal_code text,

    -- Behavioral signals
    scan_duration_ms int,                  -- Time between QR detection and page load
    interaction_pattern text,              -- JSON: scroll, click, tap patterns
    gyroscope_data text,                   -- JSON: device orientation during scan

    -- Computed risk signals
    fingerprint_hash text NOT NULL,        -- Combined hash of all fingerprint data
    risk_score int DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors jsonb DEFAULT '[]',       -- Array of triggered risk factors

    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient anomaly queries
CREATE INDEX idx_scan_fingerprints_qr_code ON public.scan_fingerprints(qr_code_id);
CREATE INDEX idx_scan_fingerprints_created_at ON public.scan_fingerprints(created_at);
CREATE INDEX idx_scan_fingerprints_fingerprint_hash ON public.scan_fingerprints(fingerprint_hash);
CREATE INDEX idx_scan_fingerprints_device_hash ON public.scan_fingerprints(device_id_hash);
CREATE INDEX idx_scan_fingerprints_country ON public.scan_fingerprints(country_code);
CREATE INDEX idx_scan_fingerprints_risk_score ON public.scan_fingerprints(risk_score DESC);
CREATE INDEX idx_scan_fingerprints_location ON public.scan_fingerprints(latitude, longitude) WHERE latitude IS NOT NULL;

-- ============================================================================
-- PART 2: Anomaly Detection Rules
-- ============================================================================

-- Configurable anomaly detection rules per organization
CREATE TABLE IF NOT EXISTS public.anomaly_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    rule_name text NOT NULL,
    rule_type text NOT NULL CHECK (rule_type IN (
        'velocity',              -- Too many scans in time window
        'geographic_spread',     -- Scans from impossibly distant locations
        'geographic_cluster',    -- Suspicious clustering in new location
        'device_diversity',      -- Same QR scanned by many unique devices
        'device_repetition',     -- Same device scanning repeatedly
        'network_anomaly',       -- VPN/datacenter/Tor patterns
        'temporal_pattern',      -- Unusual time-of-day patterns
        'behavioral',            -- Unusual interaction patterns
        'fingerprint_collision', -- Multiple locations, same fingerprint
        'product_lifecycle'      -- Scans after product expiry/recall
    )),

    -- Rule parameters (JSON for flexibility)
    parameters jsonb NOT NULL DEFAULT '{}',
    -- Examples:
    -- velocity: {"max_scans": 100, "window_hours": 24}
    -- geographic_spread: {"max_distance_km": 500, "window_hours": 1}
    -- device_diversity: {"unique_devices_threshold": 50, "window_hours": 24}

    -- Severity and actions
    severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    auto_actions jsonb DEFAULT '[]',       -- ["notify_admin", "block_qr", "flag_for_review"]

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(organization_id, rule_name)
);

CREATE INDEX idx_anomaly_rules_org ON public.anomaly_rules(organization_id);
CREATE INDEX idx_anomaly_rules_active ON public.anomaly_rules(is_active) WHERE is_active = true;

-- ============================================================================
-- PART 3: Counterfeit Alerts
-- ============================================================================

-- Alerts generated by anomaly detection
CREATE TABLE IF NOT EXISTS public.counterfeit_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
    rule_id uuid REFERENCES public.anomaly_rules(id) ON DELETE SET NULL,

    alert_type text NOT NULL CHECK (alert_type IN (
        'anomaly_detected',     -- Automated detection
        'consumer_report',      -- User submitted report
        'pattern_match',        -- Matches known counterfeit pattern
        'manual_flag'           -- Admin flagged
    )),

    severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- Alert details
    title text NOT NULL,
    description text,
    evidence jsonb NOT NULL DEFAULT '{}',  -- Scan data, patterns, etc.

    -- Location cluster (if applicable)
    cluster_center_lat decimal(10, 8),
    cluster_center_lng decimal(11, 8),
    cluster_radius_km decimal(10, 2),

    -- Status tracking
    status text NOT NULL DEFAULT 'new' CHECK (status IN (
        'new',
        'investigating',
        'confirmed_counterfeit',
        'false_positive',
        'resolved',
        'dismissed'
    )),

    -- Assignment
    assigned_to uuid REFERENCES public.app_users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    acknowledged_at timestamptz,
    resolved_at timestamptz,

    -- Resolution
    resolution_notes text,
    resolution_action text  -- What action was taken
);

CREATE INDEX idx_counterfeit_alerts_org ON public.counterfeit_alerts(organization_id);
CREATE INDEX idx_counterfeit_alerts_qr ON public.counterfeit_alerts(qr_code_id);
CREATE INDEX idx_counterfeit_alerts_status ON public.counterfeit_alerts(status);
CREATE INDEX idx_counterfeit_alerts_severity ON public.counterfeit_alerts(severity);
CREATE INDEX idx_counterfeit_alerts_created ON public.counterfeit_alerts(created_at DESC);
CREATE INDEX idx_counterfeit_alerts_location ON public.counterfeit_alerts(cluster_center_lat, cluster_center_lng)
    WHERE cluster_center_lat IS NOT NULL;

-- ============================================================================
-- PART 4: Consumer Reports
-- ============================================================================

-- Consumer-submitted counterfeit reports
CREATE TABLE IF NOT EXISTS public.counterfeit_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Reporter info (optional for anonymous reports)
    reporter_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
    reporter_email text,
    reporter_phone text,
    is_anonymous boolean NOT NULL DEFAULT false,

    -- Report details
    reason text NOT NULL CHECK (reason IN (
        'product_quality',       -- Product quality doesn't match expectations
        'packaging_different',   -- Packaging looks different
        'qr_not_working',       -- QR code doesn't scan properly
        'suspicious_seller',    -- Purchased from suspicious source
        'price_too_low',        -- Price significantly below retail
        'missing_features',     -- Missing expected features/marks
        'other'
    )),
    description text,

    -- Purchase info
    purchase_location text,
    purchase_date date,
    purchase_price decimal(12, 2),
    purchase_currency char(3) DEFAULT 'RUB',
    seller_name text,
    seller_url text,

    -- Evidence
    photo_urls jsonb DEFAULT '[]',          -- Array of uploaded photo URLs
    receipt_url text,                       -- Receipt/invoice photo

    -- Scan context (from the report submission)
    scan_fingerprint_id uuid REFERENCES public.scan_fingerprints(id) ON DELETE SET NULL,
    device_info jsonb,
    location_lat decimal(10, 8),
    location_lng decimal(11, 8),

    -- Processing
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'under_review',
        'verified_counterfeit',
        'verified_authentic',
        'insufficient_evidence',
        'duplicate'
    )),

    -- Link to alert/investigation
    alert_id uuid REFERENCES public.counterfeit_alerts(id) ON DELETE SET NULL,

    -- Admin notes
    internal_notes text,
    reviewed_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_counterfeit_reports_org ON public.counterfeit_reports(organization_id);
CREATE INDEX idx_counterfeit_reports_qr ON public.counterfeit_reports(qr_code_id);
CREATE INDEX idx_counterfeit_reports_status ON public.counterfeit_reports(status);
CREATE INDEX idx_counterfeit_reports_created ON public.counterfeit_reports(created_at DESC);
CREATE INDEX idx_counterfeit_reports_location ON public.counterfeit_reports(location_lat, location_lng)
    WHERE location_lat IS NOT NULL;

-- ============================================================================
-- PART 5: Investigation Cases
-- ============================================================================

-- Investigation workflow for suspected counterfeits
CREATE TABLE IF NOT EXISTS public.investigation_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_number text NOT NULL UNIQUE,       -- Human-readable case ID

    -- Case classification
    case_type text NOT NULL CHECK (case_type IN (
        'single_incident',      -- One-off suspicious activity
        'pattern',              -- Recurring pattern
        'organized',            -- Evidence of organized counterfeiting
        'supply_chain',         -- Supply chain compromise
        'regional'              -- Regional distribution issue
    )),
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Case details
    title text NOT NULL,
    summary text,

    -- Linked entities
    affected_qr_codes jsonb DEFAULT '[]',   -- Array of QR code IDs
    related_alerts jsonb DEFAULT '[]',      -- Array of alert IDs
    related_reports jsonb DEFAULT '[]',     -- Array of report IDs

    -- Geographic scope
    affected_regions jsonb DEFAULT '[]',    -- Array of region codes
    primary_location_lat decimal(10, 8),
    primary_location_lng decimal(11, 8),

    -- Estimated impact
    estimated_counterfeit_volume int,
    estimated_financial_impact decimal(15, 2),
    impact_currency char(3) DEFAULT 'RUB',

    -- Investigation status
    status text NOT NULL DEFAULT 'open' CHECK (status IN (
        'open',
        'investigating',
        'evidence_gathering',
        'escalated',            -- Escalated to legal/authorities
        'closed_confirmed',     -- Closed - counterfeit confirmed
        'closed_false_alarm',   -- Closed - false positive
        'closed_inconclusive'   -- Closed - insufficient evidence
    )),

    -- Assignment
    lead_investigator uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
    team_members jsonb DEFAULT '[]',        -- Array of user IDs

    -- External parties
    law_enforcement_notified boolean DEFAULT false,
    law_enforcement_case_number text,
    legal_action_initiated boolean DEFAULT false,

    -- Timeline
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    escalated_at timestamptz,
    closed_at timestamptz,

    -- Resolution
    resolution_summary text,
    lessons_learned text,
    preventive_actions jsonb DEFAULT '[]'   -- Actions taken to prevent recurrence
);

CREATE INDEX idx_investigation_cases_org ON public.investigation_cases(organization_id);
CREATE INDEX idx_investigation_cases_status ON public.investigation_cases(status);
CREATE INDEX idx_investigation_cases_priority ON public.investigation_cases(priority);
CREATE INDEX idx_investigation_cases_created ON public.investigation_cases(created_at DESC);

-- Investigation activity log
CREATE TABLE IF NOT EXISTS public.investigation_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,

    activity_type text NOT NULL CHECK (activity_type IN (
        'created',
        'status_change',
        'assignment_change',
        'evidence_added',
        'note_added',
        'alert_linked',
        'report_linked',
        'escalated',
        'external_contact',     -- Contact with authorities/legal
        'resolution'
    )),

    description text NOT NULL,
    metadata jsonb DEFAULT '{}',

    performed_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_investigation_activities_case ON public.investigation_activities(case_id);
CREATE INDEX idx_investigation_activities_created ON public.investigation_activities(created_at DESC);

-- ============================================================================
-- PART 6: Authenticity Verification Cache
-- ============================================================================

-- Cache authenticity scores for quick consumer lookup
CREATE TABLE IF NOT EXISTS public.authenticity_scores (
    qr_code_id uuid PRIMARY KEY REFERENCES public.qr_codes(id) ON DELETE CASCADE,

    -- Overall authenticity score (0-100)
    score int NOT NULL DEFAULT 100 CHECK (score >= 0 AND score <= 100),
    confidence text NOT NULL DEFAULT 'high' CHECK (confidence IN ('low', 'medium', 'high')),

    -- Score components
    scan_pattern_score int DEFAULT 100,     -- Based on scan patterns
    geographic_score int DEFAULT 100,       -- Based on geographic distribution
    temporal_score int DEFAULT 100,         -- Based on timing patterns
    report_score int DEFAULT 100,           -- Based on consumer reports

    -- Status indicators
    has_active_alerts boolean DEFAULT false,
    has_pending_reports boolean DEFAULT false,
    is_under_investigation boolean DEFAULT false,

    -- Verification history
    total_scans bigint DEFAULT 0,
    verified_scans bigint DEFAULT 0,        -- Scans with no anomalies
    suspicious_scans bigint DEFAULT 0,

    -- Last verification
    last_scan_at timestamptz,
    last_verified_at timestamptz,

    -- Display info
    verification_message text,              -- Message to show consumers
    verification_badge text DEFAULT 'verified',  -- 'verified', 'caution', 'warning', 'blocked'

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PART 7: Known Counterfeit Patterns
-- ============================================================================

-- Database of known counterfeit fingerprint patterns
CREATE TABLE IF NOT EXISTS public.known_counterfeit_patterns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    pattern_type text NOT NULL CHECK (pattern_type IN (
        'device_fingerprint',
        'network_signature',
        'geographic_cluster',
        'behavioral_pattern',
        'scan_sequence'
    )),

    pattern_hash text NOT NULL,             -- Hash of the pattern
    pattern_data jsonb NOT NULL,            -- Full pattern details

    -- Origin
    source_case_id uuid REFERENCES public.investigation_cases(id) ON DELETE SET NULL,
    discovered_at timestamptz NOT NULL DEFAULT now(),

    -- Effectiveness
    match_count bigint DEFAULT 0,           -- How many times matched
    false_positive_rate decimal(5, 4),      -- False positive rate (0.0000-1.0000)

    is_active boolean NOT NULL DEFAULT true,
    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_known_patterns_hash ON public.known_counterfeit_patterns(pattern_hash);
CREATE INDEX idx_known_patterns_type ON public.known_counterfeit_patterns(pattern_type);
CREATE INDEX idx_known_patterns_active ON public.known_counterfeit_patterns(is_active) WHERE is_active = true;

-- ============================================================================
-- PART 8: Row Level Security Policies
-- ============================================================================

ALTER TABLE public.scan_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterfeit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterfeit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authenticity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.known_counterfeit_patterns ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user has security role in organization
CREATE OR REPLACE FUNCTION public.has_security_role(org_id uuid, user_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = org_id
          AND om.user_id = user_id
          AND om.role IN ('owner', 'admin', 'manager')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Check if user has analyst role in organization
CREATE OR REPLACE FUNCTION public.has_analyst_role(org_id uuid, user_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = org_id
          AND om.user_id = user_id
          AND om.role IN ('owner', 'admin', 'manager', 'analyst')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Scan fingerprints: analysts can view their org's fingerprints
CREATE POLICY "Analysts view org scan fingerprints" ON public.scan_fingerprints
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.qr_codes qc
            WHERE qc.id = scan_fingerprints.qr_code_id
              AND public.has_analyst_role(qc.organization_id, auth.uid())
        )
    );

-- Anomaly rules: security roles manage, analysts view
CREATE POLICY "Security roles manage anomaly rules" ON public.anomaly_rules
    FOR ALL USING (public.has_security_role(organization_id, auth.uid()))
    WITH CHECK (public.has_security_role(organization_id, auth.uid()));

CREATE POLICY "Analysts view anomaly rules" ON public.anomaly_rules
    FOR SELECT USING (public.has_analyst_role(organization_id, auth.uid()));

-- Counterfeit alerts: security roles manage, analysts view
CREATE POLICY "Security roles manage alerts" ON public.counterfeit_alerts
    FOR ALL USING (public.has_security_role(organization_id, auth.uid()))
    WITH CHECK (public.has_security_role(organization_id, auth.uid()));

CREATE POLICY "Analysts view alerts" ON public.counterfeit_alerts
    FOR SELECT USING (public.has_analyst_role(organization_id, auth.uid()));

-- Counterfeit reports: anyone can insert, org members can view their org's reports
CREATE POLICY "Anyone can submit reports" ON public.counterfeit_reports
    FOR INSERT WITH CHECK (true);  -- Public submission allowed

CREATE POLICY "Org members view reports" ON public.counterfeit_reports
    FOR SELECT USING (public.has_analyst_role(organization_id, auth.uid()));

CREATE POLICY "Security roles manage reports" ON public.counterfeit_reports
    FOR UPDATE USING (public.has_security_role(organization_id, auth.uid()))
    WITH CHECK (public.has_security_role(organization_id, auth.uid()));

-- Investigation cases: security roles only
CREATE POLICY "Security roles manage investigations" ON public.investigation_cases
    FOR ALL USING (public.has_security_role(organization_id, auth.uid()))
    WITH CHECK (public.has_security_role(organization_id, auth.uid()));

CREATE POLICY "Security roles view investigation activities" ON public.investigation_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.investigation_cases ic
            WHERE ic.id = investigation_activities.case_id
              AND public.has_security_role(ic.organization_id, auth.uid())
        )
    );

CREATE POLICY "Security roles create investigation activities" ON public.investigation_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.investigation_cases ic
            WHERE ic.id = investigation_activities.case_id
              AND public.has_security_role(ic.organization_id, auth.uid())
        )
    );

-- Authenticity scores: public read for consumers
CREATE POLICY "Public read authenticity scores" ON public.authenticity_scores
    FOR SELECT USING (true);

-- Known patterns: platform admins only (no org-level access)
CREATE POLICY "Platform admins manage patterns" ON public.known_counterfeit_patterns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.app_profiles ap
            WHERE ap.id = auth.uid() AND ap.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_profiles ap
            WHERE ap.id = auth.uid() AND ap.role = 'admin'
        )
    );

-- ============================================================================
-- PART 9: Database Functions for Anomaly Detection
-- ============================================================================

-- Function: Calculate geographic distance (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
    lat1 decimal, lng1 decimal,
    lat2 decimal, lng2 decimal
) RETURNS decimal AS $$
DECLARE
    R constant decimal := 6371; -- Earth's radius in km
    dlat decimal;
    dlng decimal;
    a decimal;
    c decimal;
BEGIN
    IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
        RETURN NULL;
    END IF;

    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);

    a := sin(dlat/2) * sin(dlat/2) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(dlng/2) * sin(dlng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));

    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Detect velocity anomaly
CREATE OR REPLACE FUNCTION public.detect_velocity_anomaly(
    p_qr_code_id uuid,
    p_max_scans int DEFAULT 100,
    p_window_hours int DEFAULT 24
) RETURNS boolean AS $$
DECLARE
    scan_count int;
BEGIN
    SELECT COUNT(*) INTO scan_count
    FROM public.scan_fingerprints
    WHERE qr_code_id = p_qr_code_id
      AND created_at >= NOW() - (p_window_hours || ' hours')::interval;

    RETURN scan_count > p_max_scans;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Detect geographic impossibility
CREATE OR REPLACE FUNCTION public.detect_geographic_impossibility(
    p_qr_code_id uuid,
    p_max_distance_km decimal DEFAULT 500,
    p_window_hours int DEFAULT 1
) RETURNS TABLE(
    is_anomaly boolean,
    max_distance decimal,
    scan_pairs int
) AS $$
DECLARE
    pair_count int := 0;
    max_dist decimal := 0;
    rec record;
    prev_lat decimal;
    prev_lng decimal;
    prev_time timestamptz;
    dist decimal;
BEGIN
    FOR rec IN
        SELECT latitude, longitude, created_at
        FROM public.scan_fingerprints
        WHERE qr_code_id = p_qr_code_id
          AND latitude IS NOT NULL
          AND created_at >= NOW() - (p_window_hours || ' hours')::interval
        ORDER BY created_at
    LOOP
        IF prev_lat IS NOT NULL THEN
            dist := public.calculate_distance_km(prev_lat, prev_lng, rec.latitude, rec.longitude);
            IF dist > max_dist THEN
                max_dist := dist;
            END IF;
            IF dist > p_max_distance_km THEN
                pair_count := pair_count + 1;
            END IF;
        END IF;

        prev_lat := rec.latitude;
        prev_lng := rec.longitude;
        prev_time := rec.created_at;
    END LOOP;

    is_anomaly := pair_count > 0;
    max_distance := max_dist;
    scan_pairs := pair_count;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get device diversity for a QR code
CREATE OR REPLACE FUNCTION public.get_device_diversity(
    p_qr_code_id uuid,
    p_window_hours int DEFAULT 24
) RETURNS TABLE(
    unique_devices bigint,
    unique_fingerprints bigint,
    avg_scans_per_device decimal
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT device_id_hash)::bigint as unique_devices,
        COUNT(DISTINCT fingerprint_hash)::bigint as unique_fingerprints,
        CASE
            WHEN COUNT(DISTINCT device_id_hash) > 0
            THEN COUNT(*)::decimal / COUNT(DISTINCT device_id_hash)
            ELSE 0
        END as avg_scans_per_device
    FROM public.scan_fingerprints
    WHERE qr_code_id = p_qr_code_id
      AND created_at >= NOW() - (p_window_hours || ' hours')::interval;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Calculate authenticity score
CREATE OR REPLACE FUNCTION public.calculate_authenticity_score(
    p_qr_code_id uuid
) RETURNS int AS $$
DECLARE
    base_score int := 100;
    alert_penalty int := 0;
    report_penalty int := 0;
    pattern_penalty int := 0;
    final_score int;
BEGIN
    -- Deduct for active alerts
    SELECT COALESCE(
        CASE
            WHEN COUNT(*) FILTER (WHERE severity = 'critical') > 0 THEN 40
            WHEN COUNT(*) FILTER (WHERE severity = 'high') > 0 THEN 25
            WHEN COUNT(*) FILTER (WHERE severity = 'medium') > 0 THEN 15
            WHEN COUNT(*) FILTER (WHERE severity = 'low') > 0 THEN 5
            ELSE 0
        END, 0
    ) INTO alert_penalty
    FROM public.counterfeit_alerts
    WHERE qr_code_id = p_qr_code_id
      AND status NOT IN ('false_positive', 'dismissed', 'resolved');

    -- Deduct for pending reports
    SELECT COALESCE(
        LEAST(COUNT(*) * 10, 30), 0
    ) INTO report_penalty
    FROM public.counterfeit_reports
    WHERE qr_code_id = p_qr_code_id
      AND status IN ('pending', 'under_review');

    -- Deduct for matching known patterns
    SELECT COALESCE(
        CASE
            WHEN COUNT(*) > 3 THEN 30
            WHEN COUNT(*) > 1 THEN 20
            WHEN COUNT(*) > 0 THEN 10
            ELSE 0
        END, 0
    ) INTO pattern_penalty
    FROM public.scan_fingerprints sf
    JOIN public.known_counterfeit_patterns kcp
        ON sf.fingerprint_hash = kcp.pattern_hash
    WHERE sf.qr_code_id = p_qr_code_id
      AND kcp.is_active = true;

    final_score := GREATEST(0, base_score - alert_penalty - report_penalty - pattern_penalty);

    RETURN final_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Update authenticity score (called after scans/alerts/reports)
CREATE OR REPLACE FUNCTION public.update_authenticity_score(p_qr_code_id uuid)
RETURNS void AS $$
DECLARE
    new_score int;
    new_badge text;
    new_message text;
    has_alerts boolean;
    has_reports boolean;
    is_investigation boolean;
BEGIN
    new_score := public.calculate_authenticity_score(p_qr_code_id);

    -- Check flags
    SELECT EXISTS(
        SELECT 1 FROM public.counterfeit_alerts
        WHERE qr_code_id = p_qr_code_id
          AND status NOT IN ('false_positive', 'dismissed', 'resolved')
    ) INTO has_alerts;

    SELECT EXISTS(
        SELECT 1 FROM public.counterfeit_reports
        WHERE qr_code_id = p_qr_code_id
          AND status IN ('pending', 'under_review')
    ) INTO has_reports;

    SELECT EXISTS(
        SELECT 1 FROM public.investigation_cases
        WHERE p_qr_code_id = ANY(
            SELECT jsonb_array_elements_text(affected_qr_codes)::uuid
        )
        AND status NOT IN ('closed_confirmed', 'closed_false_alarm', 'closed_inconclusive')
    ) INTO is_investigation;

    -- Determine badge
    new_badge := CASE
        WHEN new_score >= 90 THEN 'verified'
        WHEN new_score >= 70 THEN 'caution'
        WHEN new_score >= 40 THEN 'warning'
        ELSE 'blocked'
    END;

    -- Determine message
    new_message := CASE new_badge
        WHEN 'verified' THEN 'Product verified as authentic'
        WHEN 'caution' THEN 'Minor authenticity concerns detected'
        WHEN 'warning' THEN 'Authenticity cannot be confirmed - proceed with caution'
        ELSE 'This product may not be authentic - contact support'
    END;

    -- Upsert authenticity score
    INSERT INTO public.authenticity_scores (
        qr_code_id, score, has_active_alerts, has_pending_reports,
        is_under_investigation, verification_badge, verification_message,
        last_verified_at, updated_at
    )
    VALUES (
        p_qr_code_id, new_score, has_alerts, has_reports,
        is_investigation, new_badge, new_message,
        NOW(), NOW()
    )
    ON CONFLICT (qr_code_id) DO UPDATE SET
        score = EXCLUDED.score,
        has_active_alerts = EXCLUDED.has_active_alerts,
        has_pending_reports = EXCLUDED.has_pending_reports,
        is_under_investigation = EXCLUDED.is_under_investigation,
        verification_badge = EXCLUDED.verification_badge,
        verification_message = EXCLUDED.verification_message,
        last_verified_at = EXCLUDED.last_verified_at,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 10: Default Anomaly Rules (created per organization on demand)
-- ============================================================================

-- Function to create default rules for a new organization
CREATE OR REPLACE FUNCTION public.create_default_anomaly_rules(p_org_id uuid)
RETURNS void AS $$
BEGIN
    -- Velocity rule: max 100 scans per 24 hours
    INSERT INTO public.anomaly_rules (organization_id, rule_name, rule_type, parameters, severity)
    VALUES (
        p_org_id,
        'High scan velocity',
        'velocity',
        '{"max_scans": 100, "window_hours": 24}'::jsonb,
        'medium'
    )
    ON CONFLICT (organization_id, rule_name) DO NOTHING;

    -- Geographic spread: max 500km in 1 hour
    INSERT INTO public.anomaly_rules (organization_id, rule_name, rule_type, parameters, severity)
    VALUES (
        p_org_id,
        'Geographic impossibility',
        'geographic_spread',
        '{"max_distance_km": 500, "window_hours": 1}'::jsonb,
        'high'
    )
    ON CONFLICT (organization_id, rule_name) DO NOTHING;

    -- Device diversity: 50+ unique devices in 24 hours
    INSERT INTO public.anomaly_rules (organization_id, rule_name, rule_type, parameters, severity)
    VALUES (
        p_org_id,
        'Unusual device diversity',
        'device_diversity',
        '{"unique_devices_threshold": 50, "window_hours": 24}'::jsonb,
        'medium'
    )
    ON CONFLICT (organization_id, rule_name) DO NOTHING;

    -- Network anomaly: VPN/datacenter/Tor
    INSERT INTO public.anomaly_rules (organization_id, rule_name, rule_type, parameters, severity)
    VALUES (
        p_org_id,
        'Suspicious network',
        'network_anomaly',
        '{"detect_vpn": true, "detect_datacenter": true, "detect_tor": true, "threshold_percent": 20}'::jsonb,
        'low'
    )
    ON CONFLICT (organization_id, rule_name) DO NOTHING;

    -- Device repetition: same device > 10 scans in 1 hour
    INSERT INTO public.anomaly_rules (organization_id, rule_name, rule_type, parameters, severity)
    VALUES (
        p_org_id,
        'Repeated device scanning',
        'device_repetition',
        '{"max_scans_per_device": 10, "window_hours": 1}'::jsonb,
        'low'
    )
    ON CONFLICT (organization_id, rule_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Generate unique case number
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS text AS $$
DECLARE
    year_part text;
    seq_part text;
BEGIN
    year_part := to_char(NOW(), 'YYYY');
    seq_part := lpad(nextval('investigation_case_seq')::text, 6, '0');
    RETURN 'CASE-' || year_part || '-' || seq_part;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for case numbers
CREATE SEQUENCE IF NOT EXISTS investigation_case_seq START 1;

-- Trigger to auto-generate case number
CREATE OR REPLACE FUNCTION public.set_case_number()
RETURNS trigger AS $$
BEGIN
    IF NEW.case_number IS NULL THEN
        NEW.case_number := public.generate_case_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_investigation_case_number
    BEFORE INSERT ON public.investigation_cases
    FOR EACH ROW
    EXECUTE FUNCTION public.set_case_number();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_anomaly_rules_updated_at
    BEFORE UPDATE ON public.anomaly_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_counterfeit_alerts_updated_at
    BEFORE UPDATE ON public.counterfeit_alerts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_counterfeit_reports_updated_at
    BEFORE UPDATE ON public.counterfeit_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_investigation_cases_updated_at
    BEFORE UPDATE ON public.investigation_cases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_authenticity_scores_updated_at
    BEFORE UPDATE ON public.authenticity_scores
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_known_patterns_updated_at
    BEFORE UPDATE ON public.known_counterfeit_patterns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
