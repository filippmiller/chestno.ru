-- Migration: Interactive Scanner Kiosk Mode
-- Session 17 Feature 2: Kiosk devices for in-store product verification
-- Provides dedicated interface for tablets/displays without mobile app

-- =============================================================================
-- RETAIL KIOSKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.retail_kiosks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,

    -- Device identification
    device_code TEXT NOT NULL UNIQUE,  -- Unique identifier for the kiosk
    device_name TEXT,  -- Friendly name like "Entrance Kiosk 1"
    location_in_store TEXT,  -- "Entrance", "Dairy Aisle", "Checkout Area"

    -- Authentication
    api_key_hash TEXT NOT NULL,  -- Hashed API key for device authentication
    last_authenticated_at TIMESTAMPTZ,
    last_authenticated_ip TEXT,

    -- Configuration
    config JSONB NOT NULL DEFAULT '{
        "language": "ru",
        "idle_timeout_seconds": 30,
        "features": {
            "price_comparison": true,
            "reviews": true,
            "loyalty_signup": true,
            "print_receipt": false
        },
        "branding": {
            "include_chestno_logo": true
        }
    }'::jsonb,

    -- Health monitoring
    last_heartbeat TIMESTAMPTZ,
    is_online BOOLEAN NOT NULL DEFAULT false,
    firmware_version TEXT,
    hardware_info JSONB,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    deactivated_at TIMESTAMPTZ,
    deactivated_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for retail kiosks
CREATE INDEX idx_retail_kiosks_store ON public.retail_kiosks(store_id);
CREATE INDEX idx_retail_kiosks_device_code ON public.retail_kiosks(device_code);
CREATE INDEX idx_retail_kiosks_active ON public.retail_kiosks(is_active) WHERE is_active = true;
CREATE INDEX idx_retail_kiosks_online ON public.retail_kiosks(is_online, last_heartbeat) WHERE is_online = true;

-- =============================================================================
-- KIOSK SESSIONS TABLE
-- Tracks each user interaction session with a kiosk
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.kiosk_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id UUID NOT NULL REFERENCES public.retail_kiosks(id) ON DELETE CASCADE,

    -- Session identification
    session_token TEXT NOT NULL UNIQUE,

    -- Session timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Metrics
    products_scanned INTEGER NOT NULL DEFAULT 0,
    reviews_submitted INTEGER NOT NULL DEFAULT 0,
    loyalty_signups INTEGER NOT NULL DEFAULT 0,
    print_requests INTEGER NOT NULL DEFAULT 0,

    -- Optional user linkage (if user signed in or linked loyalty)
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,

    -- Session data
    session_data JSONB DEFAULT '{}'::jsonb  -- Store any additional session metadata
);

-- Indexes for kiosk sessions
CREATE INDEX idx_kiosk_sessions_kiosk ON public.kiosk_sessions(kiosk_id);
CREATE INDEX idx_kiosk_sessions_token ON public.kiosk_sessions(session_token);
CREATE INDEX idx_kiosk_sessions_started ON public.kiosk_sessions(started_at DESC);
CREATE INDEX idx_kiosk_sessions_active ON public.kiosk_sessions(kiosk_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_kiosk_sessions_user ON public.kiosk_sessions(user_id) WHERE user_id IS NOT NULL;

-- =============================================================================
-- KIOSK SCAN LOGS TABLE
-- Detailed log of each scan performed on a kiosk
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.kiosk_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.kiosk_sessions(id) ON DELETE CASCADE,
    kiosk_id UUID NOT NULL REFERENCES public.retail_kiosks(id) ON DELETE CASCADE,

    -- Scan details
    scan_type TEXT NOT NULL DEFAULT 'qr' CHECK (scan_type IN ('qr', 'barcode', 'nfc')),
    scan_data TEXT NOT NULL,  -- Raw scanned data

    -- Result
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_found BOOLEAN NOT NULL DEFAULT false,
    response_time_ms INTEGER,

    -- Actions taken
    details_viewed BOOLEAN NOT NULL DEFAULT false,
    review_submitted BOOLEAN NOT NULL DEFAULT false,
    added_to_favorites BOOLEAN NOT NULL DEFAULT false,
    print_requested BOOLEAN NOT NULL DEFAULT false,

    -- Timestamp
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for kiosk scan logs
CREATE INDEX idx_kiosk_scan_logs_session ON public.kiosk_scan_logs(session_id);
CREATE INDEX idx_kiosk_scan_logs_kiosk ON public.kiosk_scan_logs(kiosk_id);
CREATE INDEX idx_kiosk_scan_logs_product ON public.kiosk_scan_logs(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_kiosk_scan_logs_time ON public.kiosk_scan_logs(scanned_at DESC);

-- =============================================================================
-- TRIGGERS: Updated At
-- =============================================================================
DROP TRIGGER IF EXISTS trg_retail_kiosks_updated_at ON public.retail_kiosks;
CREATE TRIGGER trg_retail_kiosks_updated_at
    BEFORE UPDATE ON public.retail_kiosks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTION: Authenticate Kiosk
-- Validates API key and updates authentication tracking
-- =============================================================================
CREATE OR REPLACE FUNCTION authenticate_kiosk(
    p_device_code TEXT,
    p_api_key TEXT,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    kiosk_id UUID,
    store_id UUID,
    config JSONB,
    authenticated BOOLEAN
) AS $$
DECLARE
    v_kiosk RECORD;
    v_key_hash TEXT;
BEGIN
    -- Hash the provided API key
    v_key_hash := encode(digest(p_api_key, 'sha256'), 'hex');

    -- Find matching kiosk
    SELECT k.id, k.store_id, k.config, k.api_key_hash, k.is_active
    INTO v_kiosk
    FROM public.retail_kiosks k
    WHERE k.device_code = p_device_code
      AND k.is_active = true;

    IF v_kiosk IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::JSONB, false;
        RETURN;
    END IF;

    -- Verify API key
    IF v_kiosk.api_key_hash != v_key_hash THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::JSONB, false;
        RETURN;
    END IF;

    -- Update authentication tracking
    UPDATE public.retail_kiosks
    SET last_authenticated_at = now(),
        last_authenticated_ip = p_ip_address
    WHERE id = v_kiosk.id;

    RETURN QUERY SELECT v_kiosk.id, v_kiosk.store_id, v_kiosk.config, true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Start Kiosk Session
-- Creates a new session and returns the session token
-- =============================================================================
CREATE OR REPLACE FUNCTION start_kiosk_session(
    p_kiosk_id UUID
)
RETURNS TABLE (
    session_id UUID,
    session_token TEXT
) AS $$
DECLARE
    v_session_id UUID;
    v_token TEXT;
BEGIN
    -- Generate session token
    v_token := encode(gen_random_bytes(32), 'hex');
    v_session_id := gen_random_uuid();

    -- Create session
    INSERT INTO public.kiosk_sessions (id, kiosk_id, session_token)
    VALUES (v_session_id, p_kiosk_id, v_token);

    RETURN QUERY SELECT v_session_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Record Kiosk Heartbeat
-- Updates kiosk online status
-- =============================================================================
CREATE OR REPLACE FUNCTION record_kiosk_heartbeat(
    p_kiosk_id UUID,
    p_firmware_version TEXT DEFAULT NULL,
    p_hardware_info JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.retail_kiosks
    SET last_heartbeat = now(),
        is_online = true,
        firmware_version = COALESCE(p_firmware_version, firmware_version),
        hardware_info = COALESCE(p_hardware_info, hardware_info)
    WHERE id = p_kiosk_id
      AND is_active = true;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Mark Offline Kiosks
-- Called periodically to mark kiosks without recent heartbeat as offline
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_offline_kiosks(
    p_threshold_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.retail_kiosks
    SET is_online = false
    WHERE is_online = true
      AND last_heartbeat < now() - (p_threshold_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Get Kiosk Analytics
-- Returns usage metrics for a kiosk
-- =============================================================================
CREATE OR REPLACE FUNCTION get_kiosk_analytics(
    p_kiosk_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_sessions BIGINT,
    total_scans BIGINT,
    avg_scans_per_session NUMERIC,
    total_reviews BIGINT,
    total_loyalty_signups BIGINT,
    avg_session_duration_seconds NUMERIC,
    daily_usage JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH session_stats AS (
        SELECT
            COUNT(*)::BIGINT as session_count,
            SUM(products_scanned)::BIGINT as scan_count,
            SUM(reviews_submitted)::BIGINT as review_count,
            SUM(loyalty_signups)::BIGINT as signup_count,
            AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, last_activity_at) - started_at))) as avg_duration
        FROM public.kiosk_sessions
        WHERE kiosk_id = p_kiosk_id
          AND started_at > now() - (p_days || ' days')::INTERVAL
    ),
    daily AS (
        SELECT
            started_at::date as day,
            COUNT(*) as sessions,
            SUM(products_scanned) as scans
        FROM public.kiosk_sessions
        WHERE kiosk_id = p_kiosk_id
          AND started_at > now() - (p_days || ' days')::INTERVAL
        GROUP BY started_at::date
        ORDER BY day
    )
    SELECT
        ss.session_count,
        ss.scan_count,
        CASE WHEN ss.session_count > 0 THEN ROUND(ss.scan_count::NUMERIC / ss.session_count, 2) ELSE 0 END,
        ss.review_count,
        ss.signup_count,
        ROUND(ss.avg_duration, 0),
        (SELECT jsonb_agg(jsonb_build_object('date', day, 'sessions', sessions, 'scans', scans)) FROM daily)
    FROM session_stats ss;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.retail_kiosks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_scan_logs ENABLE ROW LEVEL SECURITY;

-- Retail Kiosks: Managed by store's organization
CREATE POLICY "Store org members can view kiosks"
    ON public.retail_kiosks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_kiosks.store_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can manage kiosks"
    ON public.retail_kiosks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_kiosks.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_kiosks.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins manage all kiosks"
    ON public.retail_kiosks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Kiosk Sessions: Store org members can view
CREATE POLICY "Store org members can view kiosk sessions"
    ON public.kiosk_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_kiosks rk
            JOIN public.retail_stores rs ON rs.id = rk.store_id
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rk.id = kiosk_sessions.kiosk_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service can manage kiosk sessions"
    ON public.kiosk_sessions FOR ALL
    USING (true)
    WITH CHECK (true);  -- Sessions managed via secure functions

CREATE POLICY "Platform admins view all kiosk sessions"
    ON public.kiosk_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Kiosk Scan Logs: Store org members can view
CREATE POLICY "Store org members can view scan logs"
    ON public.kiosk_scan_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_kiosks rk
            JOIN public.retail_stores rs ON rs.id = rk.store_id
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rk.id = kiosk_scan_logs.kiosk_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service can insert scan logs"
    ON public.kiosk_scan_logs FOR INSERT
    WITH CHECK (true);  -- Scan logs inserted via kiosk API

CREATE POLICY "Platform admins view all scan logs"
    ON public.kiosk_scan_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.retail_kiosks IS 'Registry of kiosk devices deployed in retail stores for product verification';
COMMENT ON TABLE public.kiosk_sessions IS 'Tracks user interaction sessions on kiosk devices';
COMMENT ON TABLE public.kiosk_scan_logs IS 'Detailed log of product scans performed on kiosks';

COMMENT ON COLUMN public.retail_kiosks.device_code IS 'Unique identifier used for device authentication';
COMMENT ON COLUMN public.retail_kiosks.api_key_hash IS 'SHA256 hash of the device API key';
COMMENT ON COLUMN public.retail_kiosks.config IS 'JSON configuration for kiosk behavior and features';
COMMENT ON COLUMN public.kiosk_sessions.session_token IS 'Secure token for the active session';

COMMENT ON FUNCTION authenticate_kiosk IS 'Validates kiosk credentials and returns configuration';
COMMENT ON FUNCTION start_kiosk_session IS 'Creates a new user interaction session on a kiosk';
COMMENT ON FUNCTION record_kiosk_heartbeat IS 'Updates kiosk online status and hardware info';
COMMENT ON FUNCTION mark_offline_kiosks IS 'Marks kiosks without recent heartbeat as offline';
COMMENT ON FUNCTION get_kiosk_analytics IS 'Returns usage metrics for a kiosk device';
