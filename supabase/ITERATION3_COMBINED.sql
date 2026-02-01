-- Migration: Retail Store Registry and Analytics
-- Session 17 Feature 1: Enable retailers to register physical store locations
-- and track product verification scans by store

-- =============================================================================
-- RETAIL STORES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.retail_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Store identification
    store_code TEXT NOT NULL UNIQUE,  -- Human-readable code like "METRO-MSK-001"
    name TEXT NOT NULL,
    chain_name TEXT,  -- "Metro", "Perekrestok", etc.

    -- Location
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    region TEXT,
    postal_code TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Contact
    manager_name TEXT,
    manager_email TEXT,
    manager_phone TEXT,

    -- Optional organization ownership (for retail partners)
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    verified_at TIMESTAMPTZ,  -- When chestno verified this store
    verified_by UUID REFERENCES public.app_users(id),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for retail stores
CREATE INDEX idx_retail_stores_chain ON public.retail_stores(chain_name);
CREATE INDEX idx_retail_stores_city ON public.retail_stores(city);
CREATE INDEX idx_retail_stores_active ON public.retail_stores(is_active) WHERE is_active = true;
CREATE INDEX idx_retail_stores_org ON public.retail_stores(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_retail_stores_location ON public.retail_stores(latitude, longitude) WHERE latitude IS NOT NULL;

-- =============================================================================
-- STORE PRODUCTS TABLE
-- Links products to stores they're sold in
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Shelf location
    aisle TEXT,
    shelf_position TEXT,

    -- Pricing (store-specific)
    store_price_cents INTEGER,

    -- Status
    in_stock BOOLEAN NOT NULL DEFAULT true,
    last_stock_check TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_store_product UNIQUE (store_id, product_id)
);

-- Indexes for store products
CREATE INDEX idx_store_products_store ON public.store_products(store_id);
CREATE INDEX idx_store_products_product ON public.store_products(product_id);
CREATE INDEX idx_store_products_org ON public.store_products(organization_id);
CREATE INDEX idx_store_products_in_stock ON public.store_products(store_id, in_stock) WHERE in_stock = true;

-- =============================================================================
-- STORE SCAN EVENTS TABLE
-- Extends existing qr_scan_events with store-specific context
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to existing systems
    qr_scan_event_id UUID REFERENCES public.qr_scan_events(id) ON DELETE SET NULL,
    store_id UUID REFERENCES public.retail_stores(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Scan context
    scan_source TEXT NOT NULL DEFAULT 'shelf' CHECK (scan_source IN (
        'shelf',           -- Scanned from shelf display
        'kiosk',           -- From store kiosk
        'checkout',        -- At POS/checkout
        'staff_device',    -- Staff scanner
        'signage'          -- Digital signage
    )),

    -- Attribution to staff member who assisted
    store_staff_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,

    -- Optional customer context (for loyalty integration)
    customer_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,

    -- Timestamps
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for store scan events
CREATE INDEX idx_store_scans_store ON public.store_scan_events(store_id);
CREATE INDEX idx_store_scans_product ON public.store_scan_events(product_id);
CREATE INDEX idx_store_scans_org ON public.store_scan_events(organization_id);
CREATE INDEX idx_store_scans_source ON public.store_scan_events(scan_source);
CREATE INDEX idx_store_scans_time ON public.store_scan_events(scanned_at DESC);
CREATE INDEX idx_store_scans_qr_event ON public.store_scan_events(qr_scan_event_id) WHERE qr_scan_event_id IS NOT NULL;

-- =============================================================================
-- TRIGGER: Updated At
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to retail_stores
DROP TRIGGER IF EXISTS trg_retail_stores_updated_at ON public.retail_stores;
CREATE TRIGGER trg_retail_stores_updated_at
    BEFORE UPDATE ON public.retail_stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to store_products
DROP TRIGGER IF EXISTS trg_store_products_updated_at ON public.store_products;
CREATE TRIGGER trg_store_products_updated_at
    BEFORE UPDATE ON public.store_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTION: Calculate Store Performance Metrics
-- Returns scan counts, verified product ratio, and engagement score
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_store_performance(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    total_scans BIGINT,
    unique_products BIGINT,
    verified_products BIGINT,
    scans_by_source JSONB,
    top_products JSONB,
    daily_scans JSONB
) AS $$
DECLARE
    v_start_date TIMESTAMPTZ := COALESCE(p_start_date, now() - INTERVAL '30 days');
    v_end_date TIMESTAMPTZ := COALESCE(p_end_date, now());
BEGIN
    RETURN QUERY
    WITH scan_data AS (
        SELECT
            sse.id,
            sse.product_id,
            sse.scan_source,
            sse.scanned_at::date as scan_date,
            p.status as product_status
        FROM public.store_scan_events sse
        LEFT JOIN public.products p ON p.id = sse.product_id
        WHERE sse.store_id = p_store_id
          AND sse.scanned_at BETWEEN v_start_date AND v_end_date
    ),
    source_counts AS (
        SELECT scan_source, COUNT(*) as cnt
        FROM scan_data
        GROUP BY scan_source
    ),
    top_prods AS (
        SELECT sd.product_id, p.name, COUNT(*) as cnt
        FROM scan_data sd
        JOIN public.products p ON p.id = sd.product_id
        WHERE sd.product_id IS NOT NULL
        GROUP BY sd.product_id, p.name
        ORDER BY cnt DESC
        LIMIT 10
    ),
    daily AS (
        SELECT scan_date, COUNT(*) as cnt
        FROM scan_data
        GROUP BY scan_date
        ORDER BY scan_date
    )
    SELECT
        COUNT(DISTINCT sd.id)::BIGINT as total_scans,
        COUNT(DISTINCT sd.product_id)::BIGINT as unique_products,
        COUNT(DISTINCT sd.product_id) FILTER (WHERE sd.product_status = 'published')::BIGINT as verified_products,
        (SELECT jsonb_object_agg(scan_source, cnt) FROM source_counts) as scans_by_source,
        (SELECT jsonb_agg(jsonb_build_object('product_id', product_id, 'name', name, 'scans', cnt)) FROM top_prods) as top_products,
        (SELECT jsonb_agg(jsonb_build_object('date', scan_date, 'scans', cnt)) FROM daily) as daily_scans
    FROM scan_data sd;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Get Stores Ranking
-- Returns stores ranked by scan volume
-- =============================================================================
CREATE OR REPLACE FUNCTION get_stores_ranking(
    p_limit INTEGER DEFAULT 50,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    store_id UUID,
    store_code TEXT,
    store_name TEXT,
    chain_name TEXT,
    city TEXT,
    total_scans BIGINT,
    unique_products BIGINT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rs.id as store_id,
        rs.store_code,
        rs.name as store_name,
        rs.chain_name,
        rs.city,
        COUNT(sse.id)::BIGINT as total_scans,
        COUNT(DISTINCT sse.product_id)::BIGINT as unique_products,
        ROW_NUMBER() OVER (ORDER BY COUNT(sse.id) DESC)::BIGINT as rank
    FROM public.retail_stores rs
    LEFT JOIN public.store_scan_events sse
        ON sse.store_id = rs.id
        AND sse.scanned_at > now() - (p_days || ' days')::INTERVAL
    WHERE rs.is_active = true
    GROUP BY rs.id, rs.store_code, rs.name, rs.chain_name, rs.city
    ORDER BY total_scans DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.retail_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_scan_events ENABLE ROW LEVEL SECURITY;

-- Retail Stores: Public read for active stores, org members manage their stores
CREATE POLICY "Public can view active retail stores"
    ON public.retail_stores FOR SELECT
    USING (is_active = true);

CREATE POLICY "Org members can manage their stores"
    ON public.retail_stores FOR ALL
    USING (
        organization_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = retail_stores.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        organization_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = retail_stores.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins manage all retail stores"
    ON public.retail_stores FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Store Products: Org members can manage their products in stores
CREATE POLICY "Org members can view their store products"
    ON public.store_products FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = store_products.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org editors can manage store products"
    ON public.store_products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = store_products.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = store_products.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

CREATE POLICY "Platform admins manage all store products"
    ON public.store_products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Store Scan Events: Org members can view their scans
CREATE POLICY "Org members view store scan events"
    ON public.store_scan_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = store_scan_events.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service can insert store scan events"
    ON public.store_scan_events FOR INSERT
    WITH CHECK (true);  -- Allow anonymous scan event creation

CREATE POLICY "Platform admins view all store scan events"
    ON public.store_scan_events FOR SELECT
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
COMMENT ON TABLE public.retail_stores IS 'Registry of retail store locations for in-store product verification tracking';
COMMENT ON TABLE public.store_products IS 'Links products to retail stores where they are sold, with shelf location and pricing';
COMMENT ON TABLE public.store_scan_events IS 'Tracks product verification scans that occur in retail stores';

COMMENT ON COLUMN public.retail_stores.store_code IS 'Human-readable unique identifier like METRO-MSK-001';
COMMENT ON COLUMN public.retail_stores.verified_at IS 'When Chestno verified this store as legitimate';
COMMENT ON COLUMN public.store_scan_events.scan_source IS 'Where in the store the scan occurred: shelf, kiosk, checkout, staff_device, signage';

COMMENT ON FUNCTION calculate_store_performance IS 'Returns comprehensive performance metrics for a store over a date range';
COMMENT ON FUNCTION get_stores_ranking IS 'Returns top stores ranked by scan volume';
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
-- Migration: Staff Training and Certification Portal
-- Session 17 Feature 4: Training materials and certification for retail staff
-- to become "Trust Ambassadors" who can explain product verification

-- =============================================================================
-- STAFF TRAINING MODULES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Module info
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Content
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'interactive', 'quiz', 'document')),
    content_url TEXT,  -- URL to video or document
    content_data JSONB,  -- Structured content for interactive/quiz

    -- Requirements
    prerequisite_module_id UUID REFERENCES public.staff_training_modules(id) ON DELETE SET NULL,
    passing_score INTEGER NOT NULL DEFAULT 80,  -- Percentage required to pass quiz

    -- Categorization
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
        'general',       -- Introduction to Chestno
        'badges',        -- Understanding trust badges
        'customer',      -- Customer interaction
        'technical',     -- Using kiosks and tools
        'advanced'       -- Advanced topics
    )),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for training modules
CREATE INDEX idx_training_modules_category ON public.staff_training_modules(category);
CREATE INDEX idx_training_modules_prerequisite ON public.staff_training_modules(prerequisite_module_id) WHERE prerequisite_module_id IS NOT NULL;
CREATE INDEX idx_training_modules_active ON public.staff_training_modules(is_active, sort_order) WHERE is_active = true;

-- =============================================================================
-- RETAIL STAFF TABLE
-- Links app users to stores as staff members
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.retail_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,

    -- Staff info
    employee_id TEXT,  -- Store's internal employee ID
    department TEXT,
    position TEXT,

    -- Certification status
    is_certified BOOLEAN NOT NULL DEFAULT false,
    certified_at TIMESTAMPTZ,
    certification_expires_at TIMESTAMPTZ,
    certification_level TEXT CHECK (certification_level IN ('basic', 'advanced', 'expert')),

    -- Engagement metrics (denormalized for performance)
    customer_assists INTEGER NOT NULL DEFAULT 0,
    scans_assisted INTEGER NOT NULL DEFAULT 0,
    reviews_collected INTEGER NOT NULL DEFAULT 0,

    -- Points earned as staff member
    staff_points INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    deactivated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_staff_store UNIQUE (user_id, store_id)
);

-- Indexes for retail staff
CREATE INDEX idx_retail_staff_user ON public.retail_staff(user_id);
CREATE INDEX idx_retail_staff_store ON public.retail_staff(store_id);
CREATE INDEX idx_retail_staff_certified ON public.retail_staff(is_certified) WHERE is_certified = true;
CREATE INDEX idx_retail_staff_active ON public.retail_staff(store_id, is_active) WHERE is_active = true;
CREATE INDEX idx_retail_staff_points ON public.retail_staff(store_id, staff_points DESC);

-- =============================================================================
-- STAFF TRAINING PROGRESS TABLE
-- Tracks each staff member's progress through training modules
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.retail_staff(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.staff_training_modules(id) ON DELETE CASCADE,

    -- Progress
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'completed', 'failed'
    )),
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),

    -- Quiz results
    quiz_attempts INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER CHECK (best_score BETWEEN 0 AND 100),
    last_score INTEGER CHECK (last_score BETWEEN 0 AND 100),

    -- Content progress (for videos/documents)
    content_progress JSONB DEFAULT '{}'::jsonb,  -- e.g., {"video_position": 120, "pages_read": [1,2,3]}

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,

    CONSTRAINT unique_staff_module UNIQUE (staff_id, module_id)
);

-- Indexes for training progress
CREATE INDEX idx_training_progress_staff ON public.staff_training_progress(staff_id);
CREATE INDEX idx_training_progress_module ON public.staff_training_progress(module_id);
CREATE INDEX idx_training_progress_status ON public.staff_training_progress(staff_id, status);

-- =============================================================================
-- STAFF QUIZ ATTEMPTS TABLE
-- Detailed log of quiz attempts for compliance tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.retail_staff(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.staff_training_modules(id) ON DELETE CASCADE,
    progress_id UUID NOT NULL REFERENCES public.staff_training_progress(id) ON DELETE CASCADE,

    -- Attempt details
    attempt_number INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    passed BOOLEAN NOT NULL,

    -- Answers (for audit/improvement)
    answers JSONB NOT NULL,  -- {"question_id": "selected_answer", ...}
    time_spent_seconds INTEGER,

    -- Timestamp
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for quiz attempts
CREATE INDEX idx_quiz_attempts_staff ON public.staff_quiz_attempts(staff_id);
CREATE INDEX idx_quiz_attempts_module ON public.staff_quiz_attempts(module_id);
CREATE INDEX idx_quiz_attempts_progress ON public.staff_quiz_attempts(progress_id);

-- =============================================================================
-- STAFF ASSISTED SCANS TABLE
-- Links staff members to scans they helped customers with
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_assisted_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.retail_staff(id) ON DELETE CASCADE,
    scan_event_id UUID NOT NULL REFERENCES public.store_scan_events(id) ON DELETE CASCADE,

    -- Context
    assistance_type TEXT NOT NULL CHECK (assistance_type IN (
        'helped_scan',       -- Physically helped customer scan
        'explained_badge',   -- Explained trust badge meaning
        'answered_question', -- Answered product question
        'demo_kiosk',        -- Demonstrated kiosk usage
        'collected_review'   -- Helped customer leave review
    )),

    -- Optional notes
    notes TEXT,

    -- Customer feedback (optional)
    customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for staff assisted scans
CREATE INDEX idx_staff_assisted_scans_staff ON public.staff_assisted_scans(staff_id);
CREATE INDEX idx_staff_assisted_scans_event ON public.staff_assisted_scans(scan_event_id);
CREATE INDEX idx_staff_assisted_scans_type ON public.staff_assisted_scans(staff_id, assistance_type);
CREATE INDEX idx_staff_assisted_scans_time ON public.staff_assisted_scans(created_at DESC);

-- =============================================================================
-- TRIGGERS: Updated At
-- =============================================================================
DROP TRIGGER IF EXISTS trg_training_modules_updated_at ON public.staff_training_modules;
CREATE TRIGGER trg_training_modules_updated_at
    BEFORE UPDATE ON public.staff_training_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_retail_staff_updated_at ON public.retail_staff;
CREATE TRIGGER trg_retail_staff_updated_at
    BEFORE UPDATE ON public.retail_staff
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTION: Check Certification Eligibility
-- Returns whether staff has completed all required modules
-- =============================================================================
CREATE OR REPLACE FUNCTION check_certification_eligibility(p_staff_id UUID)
RETURNS TABLE (
    eligible BOOLEAN,
    completed_modules INTEGER,
    total_required_modules INTEGER,
    missing_modules UUID[]
) AS $$
DECLARE
    v_completed INTEGER;
    v_total INTEGER;
    v_missing UUID[];
BEGIN
    -- Count required modules (active, general/badges/customer categories)
    SELECT COUNT(*)::INTEGER INTO v_total
    FROM public.staff_training_modules
    WHERE is_active = true
      AND category IN ('general', 'badges', 'customer');

    -- Count completed modules
    SELECT COUNT(*)::INTEGER INTO v_completed
    FROM public.staff_training_progress stp
    JOIN public.staff_training_modules stm ON stm.id = stp.module_id
    WHERE stp.staff_id = p_staff_id
      AND stp.status = 'completed'
      AND stm.is_active = true
      AND stm.category IN ('general', 'badges', 'customer');

    -- Find missing modules
    SELECT ARRAY_AGG(stm.id) INTO v_missing
    FROM public.staff_training_modules stm
    WHERE stm.is_active = true
      AND stm.category IN ('general', 'badges', 'customer')
      AND NOT EXISTS (
          SELECT 1 FROM public.staff_training_progress stp
          WHERE stp.staff_id = p_staff_id
            AND stp.module_id = stm.id
            AND stp.status = 'completed'
      );

    RETURN QUERY SELECT
        (v_completed >= v_total AND v_total > 0) as eligible,
        v_completed,
        v_total,
        COALESCE(v_missing, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Grant Staff Certification
-- Certifies a staff member after passing all requirements
-- =============================================================================
CREATE OR REPLACE FUNCTION grant_staff_certification(
    p_staff_id UUID,
    p_level TEXT DEFAULT 'basic'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_eligible BOOLEAN;
BEGIN
    -- Check eligibility
    SELECT eligible INTO v_eligible
    FROM check_certification_eligibility(p_staff_id);

    IF NOT v_eligible THEN
        RETURN false;
    END IF;

    -- Update certification status
    UPDATE public.retail_staff
    SET is_certified = true,
        certified_at = now(),
        certification_expires_at = now() + INTERVAL '1 year',
        certification_level = p_level
    WHERE id = p_staff_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Update Training Progress
-- Updates progress and handles completion
-- =============================================================================
CREATE OR REPLACE FUNCTION update_training_progress(
    p_staff_id UUID,
    p_module_id UUID,
    p_progress_percent INTEGER,
    p_content_progress JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_progress_id UUID;
    v_current_status TEXT;
BEGIN
    -- Upsert progress record
    INSERT INTO public.staff_training_progress (staff_id, module_id, status, progress_percent, content_progress, started_at, last_accessed_at)
    VALUES (p_staff_id, p_module_id, 'in_progress', p_progress_percent, COALESCE(p_content_progress, '{}'::jsonb), now(), now())
    ON CONFLICT (staff_id, module_id) DO UPDATE SET
        progress_percent = GREATEST(staff_training_progress.progress_percent, p_progress_percent),
        content_progress = COALESCE(p_content_progress, staff_training_progress.content_progress),
        last_accessed_at = now(),
        status = CASE
            WHEN staff_training_progress.status = 'completed' THEN 'completed'
            WHEN p_progress_percent >= 100 THEN 'completed'
            ELSE 'in_progress'
        END,
        completed_at = CASE
            WHEN staff_training_progress.status != 'completed' AND p_progress_percent >= 100 THEN now()
            ELSE staff_training_progress.completed_at
        END
    RETURNING id INTO v_progress_id;

    RETURN v_progress_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Submit Quiz
-- Records quiz attempt and updates progress
-- =============================================================================
CREATE OR REPLACE FUNCTION submit_staff_quiz(
    p_staff_id UUID,
    p_module_id UUID,
    p_answers JSONB,
    p_time_spent_seconds INTEGER DEFAULT NULL
)
RETURNS TABLE (
    attempt_id UUID,
    score INTEGER,
    passed BOOLEAN,
    progress_status TEXT
) AS $$
DECLARE
    v_progress_id UUID;
    v_attempt_number INTEGER;
    v_score INTEGER;
    v_passed BOOLEAN;
    v_passing_score INTEGER;
    v_attempt_id UUID;
    v_module RECORD;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_question RECORD;
BEGIN
    -- Get module info and validate
    SELECT * INTO v_module
    FROM public.staff_training_modules
    WHERE id = p_module_id AND is_active = true;

    IF v_module IS NULL THEN
        RAISE EXCEPTION 'Module not found or inactive';
    END IF;

    -- Calculate score from answers
    -- Assumes content_data has structure: {"questions": [{"id": "q1", "correct_answer": "a"}, ...]}
    IF v_module.content_data ? 'questions' THEN
        FOR v_question IN SELECT * FROM jsonb_array_elements(v_module.content_data->'questions')
        LOOP
            v_total := v_total + 1;
            IF p_answers->(v_question.value->>'id') = v_question.value->'correct_answer' THEN
                v_correct := v_correct + 1;
            END IF;
        END LOOP;
    END IF;

    v_score := CASE WHEN v_total > 0 THEN (v_correct * 100 / v_total) ELSE 0 END;
    v_passed := v_score >= v_module.passing_score;

    -- Ensure progress record exists
    INSERT INTO public.staff_training_progress (staff_id, module_id, status, started_at, last_accessed_at)
    VALUES (p_staff_id, p_module_id, 'in_progress', now(), now())
    ON CONFLICT (staff_id, module_id) DO UPDATE SET
        last_accessed_at = now()
    RETURNING id INTO v_progress_id;

    -- Get attempt number
    SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_number
    FROM public.staff_quiz_attempts
    WHERE staff_id = p_staff_id AND module_id = p_module_id;

    -- Record attempt
    INSERT INTO public.staff_quiz_attempts (staff_id, module_id, progress_id, attempt_number, score, passed, answers, time_spent_seconds)
    VALUES (p_staff_id, p_module_id, v_progress_id, v_attempt_number, v_score, v_passed, p_answers, p_time_spent_seconds)
    RETURNING id INTO v_attempt_id;

    -- Update progress
    UPDATE public.staff_training_progress
    SET quiz_attempts = v_attempt_number,
        last_score = v_score,
        best_score = GREATEST(COALESCE(best_score, 0), v_score),
        status = CASE WHEN v_passed THEN 'completed' ELSE 'failed' END,
        completed_at = CASE WHEN v_passed THEN now() ELSE completed_at END,
        progress_percent = CASE WHEN v_passed THEN 100 ELSE progress_percent END
    WHERE id = v_progress_id;

    RETURN QUERY SELECT
        v_attempt_id,
        v_score,
        v_passed,
        CASE WHEN v_passed THEN 'completed'::TEXT ELSE 'failed'::TEXT END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Get Staff Leaderboard
-- Returns top staff by engagement metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_staff_leaderboard(
    p_store_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    staff_id UUID,
    user_id UUID,
    store_id UUID,
    store_name TEXT,
    employee_id TEXT,
    position TEXT,
    is_certified BOOLEAN,
    certification_level TEXT,
    customer_assists INTEGER,
    scans_assisted INTEGER,
    staff_points INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rs.id as staff_id,
        rs.user_id,
        rs.store_id,
        rst.name as store_name,
        rs.employee_id,
        rs.position,
        rs.is_certified,
        rs.certification_level,
        rs.customer_assists,
        rs.scans_assisted,
        rs.staff_points,
        ROW_NUMBER() OVER (ORDER BY rs.staff_points DESC, rs.customer_assists DESC)::BIGINT as rank
    FROM public.retail_staff rs
    JOIN public.retail_stores rst ON rst.id = rs.store_id
    WHERE rs.is_active = true
      AND (p_store_id IS NULL OR rs.store_id = p_store_id)
    ORDER BY rs.staff_points DESC, rs.customer_assists DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Record Staff Assist
-- Records a staff-assisted scan and updates metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION record_staff_assist(
    p_staff_id UUID,
    p_scan_event_id UUID,
    p_assistance_type TEXT,
    p_notes TEXT DEFAULT NULL,
    p_customer_rating INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_assist_id UUID;
    v_points INTEGER;
BEGIN
    -- Validate assistance type
    IF p_assistance_type NOT IN ('helped_scan', 'explained_badge', 'answered_question', 'demo_kiosk', 'collected_review') THEN
        RAISE EXCEPTION 'Invalid assistance type';
    END IF;

    -- Determine points based on assistance type
    v_points := CASE p_assistance_type
        WHEN 'helped_scan' THEN 5
        WHEN 'explained_badge' THEN 10
        WHEN 'answered_question' THEN 10
        WHEN 'demo_kiosk' THEN 15
        WHEN 'collected_review' THEN 20
        ELSE 5
    END;

    -- Add bonus for positive customer rating
    IF p_customer_rating >= 4 THEN
        v_points := v_points + 5;
    END IF;

    -- Insert assist record
    INSERT INTO public.staff_assisted_scans (staff_id, scan_event_id, assistance_type, notes, customer_rating)
    VALUES (p_staff_id, p_scan_event_id, p_assistance_type, p_notes, p_customer_rating)
    RETURNING id INTO v_assist_id;

    -- Update staff metrics
    UPDATE public.retail_staff
    SET customer_assists = customer_assists + 1,
        scans_assisted = scans_assisted + 1,
        reviews_collected = reviews_collected + CASE WHEN p_assistance_type = 'collected_review' THEN 1 ELSE 0 END,
        staff_points = staff_points + v_points
    WHERE id = p_staff_id;

    RETURN v_assist_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.staff_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assisted_scans ENABLE ROW LEVEL SECURITY;

-- Training Modules: Public read for active modules
CREATE POLICY "Public can view active training modules"
    ON public.staff_training_modules FOR SELECT
    USING (is_active = true AND published_at IS NOT NULL);

CREATE POLICY "Platform admins manage training modules"
    ON public.staff_training_modules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Retail Staff: Users can view their own, store orgs can view their staff
CREATE POLICY "Users can view own staff profile"
    ON public.retail_staff FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Store org members can view staff"
    ON public.retail_staff FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_staff.store_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can manage staff"
    ON public.retail_staff FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_staff.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_staff.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins manage all staff"
    ON public.retail_staff FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Training Progress: Users can view/manage their own
CREATE POLICY "Staff can view own training progress"
    ON public.staff_training_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_training_progress.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can manage own training progress"
    ON public.staff_training_progress FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_training_progress.staff_id
              AND rs.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_training_progress.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can view staff progress"
    ON public.staff_training_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            JOIN public.retail_stores rst ON rst.id = rs.store_id
            JOIN public.organization_members om ON om.organization_id = rst.organization_id
            WHERE rs.id = staff_training_progress.staff_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins view all training progress"
    ON public.staff_training_progress FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Quiz Attempts: Same as training progress
CREATE POLICY "Staff can view own quiz attempts"
    ON public.staff_quiz_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_quiz_attempts.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can insert quiz attempts"
    ON public.staff_quiz_attempts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_quiz_attempts.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins view all quiz attempts"
    ON public.staff_quiz_attempts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Staff Assisted Scans: Staff can view/create their own
CREATE POLICY "Staff can view own assisted scans"
    ON public.staff_assisted_scans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_assisted_scans.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can record assisted scans"
    ON public.staff_assisted_scans FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_assisted_scans.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can view assisted scans"
    ON public.staff_assisted_scans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            JOIN public.retail_stores rst ON rst.id = rs.store_id
            JOIN public.organization_members om ON om.organization_id = rst.organization_id
            WHERE rs.id = staff_assisted_scans.staff_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins view all assisted scans"
    ON public.staff_assisted_scans FOR ALL
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
COMMENT ON TABLE public.staff_training_modules IS 'Training content modules for retail staff certification';
COMMENT ON TABLE public.retail_staff IS 'Links app users to retail stores as staff members with certification status';
COMMENT ON TABLE public.staff_training_progress IS 'Tracks staff progress through training modules';
COMMENT ON TABLE public.staff_quiz_attempts IS 'Detailed log of quiz attempts for compliance tracking';
COMMENT ON TABLE public.staff_assisted_scans IS 'Records staff-assisted customer product scans for attribution';

COMMENT ON COLUMN public.staff_training_modules.passing_score IS 'Minimum percentage score required to pass the quiz';
COMMENT ON COLUMN public.retail_staff.certification_expires_at IS 'Staff must recertify after this date (typically 1 year)';
COMMENT ON COLUMN public.retail_staff.staff_points IS 'Gamification points earned through customer assists';

COMMENT ON FUNCTION check_certification_eligibility IS 'Checks if staff has completed all required training modules';
COMMENT ON FUNCTION grant_staff_certification IS 'Certifies a staff member after passing all requirements';
COMMENT ON FUNCTION submit_staff_quiz IS 'Records quiz attempt and updates training progress';
COMMENT ON FUNCTION get_staff_leaderboard IS 'Returns top staff ranked by engagement metrics';
COMMENT ON FUNCTION record_staff_assist IS 'Records a staff-assisted scan and awards points';
-- Migration: POS Integration and Digital Receipts
-- Session 17 Feature 5: Integration with point-of-sale systems for trust badges
-- on receipts and post-purchase verification

-- =============================================================================
-- POS INTEGRATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pos_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,

    -- Integration details
    pos_provider TEXT NOT NULL CHECK (pos_provider IN (
        '1c',        -- 1C:Retail (most common in Russia)
        'atol',      -- ATOL fiscal data operators
        'evotor',    -- Evotor cloud POS
        'iiko',      -- iiko (restaurants)
        'r_keeper',  -- R-Keeper (restaurants)
        'custom'     -- Custom webhook integration
    )),
    integration_name TEXT,  -- Friendly name for this integration

    -- Authentication
    api_key_hash TEXT,
    webhook_secret_hash TEXT,  -- For HMAC signature verification
    webhook_url TEXT,  -- URL to receive events (for custom integrations)

    -- Configuration
    config JSONB NOT NULL DEFAULT '{
        "sync_products": true,
        "sync_transactions": true,
        "include_unverified_products": false
    }'::jsonb,

    -- Features enabled
    print_badges BOOLEAN NOT NULL DEFAULT true,
    digital_receipts BOOLEAN NOT NULL DEFAULT false,
    review_prompt BOOLEAN NOT NULL DEFAULT true,
    loyalty_integration BOOLEAN NOT NULL DEFAULT false,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for POS integrations
CREATE INDEX idx_pos_integrations_store ON public.pos_integrations(store_id);
CREATE INDEX idx_pos_integrations_provider ON public.pos_integrations(pos_provider);
CREATE INDEX idx_pos_integrations_active ON public.pos_integrations(is_active) WHERE is_active = true;

-- =============================================================================
-- PURCHASE TRANSACTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,
    pos_integration_id UUID REFERENCES public.pos_integrations(id) ON DELETE SET NULL,

    -- Transaction identification
    external_transaction_id TEXT,  -- POS system's transaction ID
    fiscal_receipt_number TEXT,    -- Official fiscal receipt number

    -- Customer identification (optional, for loyalty)
    customer_phone TEXT,
    customer_phone_hash TEXT,  -- SHA256 hash for privacy
    customer_email TEXT,
    customer_email_hash TEXT,  -- SHA256 hash for privacy
    customer_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,

    -- Transaction summary
    total_amount_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RUB',
    total_items INTEGER NOT NULL DEFAULT 0,
    verified_items INTEGER NOT NULL DEFAULT 0,

    -- Loyalty
    loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
    loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0,

    -- Receipt delivery status
    receipt_sent BOOLEAN NOT NULL DEFAULT false,
    receipt_sent_at TIMESTAMPTZ,
    receipt_delivery_method TEXT CHECK (receipt_delivery_method IN ('sms', 'email', 'none')),

    -- Review collection
    review_requested BOOLEAN NOT NULL DEFAULT false,
    review_requested_at TIMESTAMPTZ,
    review_submitted BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for purchase transactions
CREATE INDEX idx_purchase_transactions_store ON public.purchase_transactions(store_id);
CREATE INDEX idx_purchase_transactions_pos ON public.purchase_transactions(pos_integration_id) WHERE pos_integration_id IS NOT NULL;
CREATE INDEX idx_purchase_transactions_external ON public.purchase_transactions(external_transaction_id) WHERE external_transaction_id IS NOT NULL;
CREATE INDEX idx_purchase_transactions_customer ON public.purchase_transactions(customer_user_id) WHERE customer_user_id IS NOT NULL;
CREATE INDEX idx_purchase_transactions_phone_hash ON public.purchase_transactions(customer_phone_hash) WHERE customer_phone_hash IS NOT NULL;
CREATE INDEX idx_purchase_transactions_time ON public.purchase_transactions(purchased_at DESC);
CREATE INDEX idx_purchase_transactions_review ON public.purchase_transactions(review_requested, review_submitted) WHERE review_requested = true;

-- =============================================================================
-- PURCHASE LINE ITEMS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.purchase_transactions(id) ON DELETE CASCADE,

    -- Product reference
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    barcode TEXT,
    external_product_id TEXT,  -- POS system's product ID
    product_name TEXT NOT NULL,

    -- Verification status at time of purchase
    status_level TEXT CHECK (status_level IN ('A', 'B', 'C')),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verification_timestamp TIMESTAMPTZ,  -- When product was last verified

    -- Purchase details
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER,
    total_price_cents INTEGER,
    discount_cents INTEGER DEFAULT 0,

    -- Category (for analytics)
    category TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for purchase line items
CREATE INDEX idx_purchase_line_items_transaction ON public.purchase_line_items(transaction_id);
CREATE INDEX idx_purchase_line_items_product ON public.purchase_line_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_purchase_line_items_barcode ON public.purchase_line_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_purchase_line_items_verified ON public.purchase_line_items(transaction_id, is_verified);

-- =============================================================================
-- RECEIPT TOKENS TABLE
-- Secure tokens for accessing digital receipts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.receipt_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.purchase_transactions(id) ON DELETE CASCADE,

    -- Token for secure access
    token TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,  -- SHA256 hash for lookup

    -- Delivery
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('sms', 'email', 'qr')),
    delivered_at TIMESTAMPTZ,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    delivery_error TEXT,

    -- Access tracking
    first_viewed_at TIMESTAMPTZ,
    last_viewed_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,

    -- Actions taken
    review_link_clicked BOOLEAN NOT NULL DEFAULT false,
    products_viewed INTEGER NOT NULL DEFAULT 0,

    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    is_expired BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for receipt tokens
CREATE INDEX idx_receipt_tokens_transaction ON public.receipt_tokens(transaction_id);
CREATE INDEX idx_receipt_tokens_token_hash ON public.receipt_tokens(token_hash);
CREATE INDEX idx_receipt_tokens_delivery ON public.receipt_tokens(delivery_method, delivery_status);
CREATE INDEX idx_receipt_tokens_expires ON public.receipt_tokens(expires_at) WHERE is_expired = false;

-- =============================================================================
-- POS WEBHOOK LOGS TABLE
-- For debugging and audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pos_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_integration_id UUID REFERENCES public.pos_integrations(id) ON DELETE SET NULL,

    -- Request details
    event_type TEXT NOT NULL,  -- 'transaction', 'product_sync', 'inventory', etc.
    payload JSONB NOT NULL,
    headers JSONB,

    -- Validation
    signature_valid BOOLEAN,
    validation_error TEXT,

    -- Processing
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    result_transaction_id UUID REFERENCES public.purchase_transactions(id) ON DELETE SET NULL,

    -- Timestamp
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for webhook logs
CREATE INDEX idx_pos_webhook_logs_integration ON public.pos_webhook_logs(pos_integration_id);
CREATE INDEX idx_pos_webhook_logs_event ON public.pos_webhook_logs(event_type);
CREATE INDEX idx_pos_webhook_logs_processed ON public.pos_webhook_logs(processed, received_at);
CREATE INDEX idx_pos_webhook_logs_time ON public.pos_webhook_logs(received_at DESC);

-- =============================================================================
-- TRIGGERS: Updated At
-- =============================================================================
DROP TRIGGER IF EXISTS trg_pos_integrations_updated_at ON public.pos_integrations;
CREATE TRIGGER trg_pos_integrations_updated_at
    BEFORE UPDATE ON public.pos_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTION: Hash Customer PII
-- Automatically hashes phone/email for privacy
-- =============================================================================
CREATE OR REPLACE FUNCTION hash_customer_pii()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
        NEW.customer_phone_hash := encode(digest(NEW.customer_phone, 'sha256'), 'hex');
    END IF;
    IF NEW.customer_email IS NOT NULL AND NEW.customer_email != '' THEN
        NEW.customer_email_hash := encode(digest(LOWER(NEW.customer_email), 'sha256'), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hash_customer_pii ON public.purchase_transactions;
CREATE TRIGGER trg_hash_customer_pii
    BEFORE INSERT OR UPDATE ON public.purchase_transactions
    FOR EACH ROW
    EXECUTE FUNCTION hash_customer_pii();

-- =============================================================================
-- FUNCTION: Generate Receipt Token
-- Creates a secure token for digital receipt access
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_receipt_token(
    p_transaction_id UUID,
    p_delivery_method TEXT,
    p_expires_hours INTEGER DEFAULT 720  -- 30 days default
)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_token_hash TEXT;
BEGIN
    -- Generate secure random token
    v_token := encode(gen_random_bytes(32), 'base64');
    v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
    v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

    -- Insert token record
    INSERT INTO public.receipt_tokens (
        transaction_id,
        token,
        token_hash,
        delivery_method,
        expires_at
    ) VALUES (
        p_transaction_id,
        v_token,
        v_token_hash,
        p_delivery_method,
        now() + (p_expires_hours || ' hours')::INTERVAL
    );

    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Validate Receipt Token
-- Validates token and records view
-- =============================================================================
CREATE OR REPLACE FUNCTION validate_receipt_token(p_token TEXT)
RETURNS TABLE (
    valid BOOLEAN,
    transaction_id UUID,
    store_id UUID,
    is_first_view BOOLEAN
) AS $$
DECLARE
    v_token_hash TEXT;
    v_record RECORD;
BEGIN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT rt.*, pt.store_id as tx_store_id
    INTO v_record
    FROM public.receipt_tokens rt
    JOIN public.purchase_transactions pt ON pt.id = rt.transaction_id
    WHERE rt.token_hash = v_token_hash;

    IF v_record IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, false;
        RETURN;
    END IF;

    IF v_record.expires_at < now() OR v_record.is_expired THEN
        -- Mark as expired if not already
        UPDATE public.receipt_tokens SET is_expired = true WHERE id = v_record.id;
        RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, false;
        RETURN;
    END IF;

    -- Update view tracking
    UPDATE public.receipt_tokens
    SET view_count = view_count + 1,
        first_viewed_at = COALESCE(first_viewed_at, now()),
        last_viewed_at = now()
    WHERE id = v_record.id;

    RETURN QUERY SELECT
        true,
        v_record.transaction_id,
        v_record.tx_store_id,
        (v_record.first_viewed_at IS NULL);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Process POS Transaction
-- Creates transaction and line items from webhook data
-- =============================================================================
CREATE OR REPLACE FUNCTION process_pos_transaction(
    p_integration_id UUID,
    p_external_id TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT,
    p_total_cents INTEGER,
    p_items JSONB,  -- Array of {barcode, name, quantity, unit_price_cents, category}
    p_purchased_at TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_store_id UUID;
    v_item RECORD;
    v_product RECORD;
    v_total_items INTEGER := 0;
    v_verified_items INTEGER := 0;
    v_loyalty_points INTEGER := 0;
BEGIN
    -- Get store ID from integration
    SELECT store_id INTO v_store_id
    FROM public.pos_integrations
    WHERE id = p_integration_id AND is_active = true;

    IF v_store_id IS NULL THEN
        RAISE EXCEPTION 'POS integration not found or inactive';
    END IF;

    -- Create transaction
    INSERT INTO public.purchase_transactions (
        store_id,
        pos_integration_id,
        external_transaction_id,
        customer_phone,
        customer_email,
        total_amount_cents,
        purchased_at
    ) VALUES (
        v_store_id,
        p_integration_id,
        p_external_id,
        p_customer_phone,
        p_customer_email,
        p_total_cents,
        p_purchased_at
    ) RETURNING id INTO v_transaction_id;

    -- Process line items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        barcode TEXT,
        external_id TEXT,
        name TEXT,
        quantity INTEGER,
        unit_price_cents INTEGER,
        category TEXT
    )
    LOOP
        v_total_items := v_total_items + COALESCE(v_item.quantity, 1);

        -- Try to find matching product
        SELECT p.id, p.status, sl.level as status_level
        INTO v_product
        FROM public.products p
        LEFT JOIN public.product_status_levels sl ON sl.product_id = p.id
        WHERE (p.id::TEXT = v_item.barcode OR EXISTS (
            SELECT 1 FROM public.product_variants pv
            WHERE pv.product_id = p.id AND pv.barcode = v_item.barcode
        ))
        LIMIT 1;

        -- Insert line item
        INSERT INTO public.purchase_line_items (
            transaction_id,
            product_id,
            barcode,
            external_product_id,
            product_name,
            status_level,
            is_verified,
            verification_timestamp,
            quantity,
            unit_price_cents,
            total_price_cents,
            category
        ) VALUES (
            v_transaction_id,
            v_product.id,
            v_item.barcode,
            v_item.external_id,
            v_item.name,
            v_product.status_level,
            (v_product.id IS NOT NULL AND v_product.status = 'published'),
            CASE WHEN v_product.id IS NOT NULL THEN now() ELSE NULL END,
            COALESCE(v_item.quantity, 1),
            v_item.unit_price_cents,
            COALESCE(v_item.unit_price_cents, 0) * COALESCE(v_item.quantity, 1),
            v_item.category
        );

        IF v_product.id IS NOT NULL AND v_product.status = 'published' THEN
            v_verified_items := v_verified_items + COALESCE(v_item.quantity, 1);
            -- Award bonus points for verified products
            v_loyalty_points := v_loyalty_points + (COALESCE(v_item.quantity, 1) * 5);
        END IF;
    END LOOP;

    -- Update transaction totals
    UPDATE public.purchase_transactions
    SET total_items = v_total_items,
        verified_items = v_verified_items,
        loyalty_points_earned = v_loyalty_points
    WHERE id = v_transaction_id;

    -- Update integration last sync
    UPDATE public.pos_integrations
    SET last_sync_at = now(),
        last_error = NULL,
        last_error_at = NULL
    WHERE id = p_integration_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Get Digital Receipt
-- Returns formatted receipt data
-- =============================================================================
CREATE OR REPLACE FUNCTION get_digital_receipt(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'transaction', jsonb_build_object(
            'id', pt.id,
            'date', pt.purchased_at,
            'store_name', rs.name,
            'store_address', rs.address,
            'total_amount', pt.total_amount_cents,
            'currency', pt.currency
        ),
        'items', (
            SELECT jsonb_agg(jsonb_build_object(
                'name', pli.product_name,
                'quantity', pli.quantity,
                'unit_price', pli.unit_price_cents,
                'total_price', pli.total_price_cents,
                'verified', pli.is_verified,
                'status_level', pli.status_level,
                'product_id', pli.product_id
            ) ORDER BY pli.created_at)
            FROM public.purchase_line_items pli
            WHERE pli.transaction_id = pt.id
        ),
        'summary', jsonb_build_object(
            'total_items', pt.total_items,
            'verified_items', pt.verified_items,
            'verification_percent', CASE
                WHEN pt.total_items > 0
                THEN ROUND((pt.verified_items::NUMERIC / pt.total_items) * 100, 1)
                ELSE 0
            END,
            'loyalty_points_earned', pt.loyalty_points_earned
        )
    ) INTO v_result
    FROM public.purchase_transactions pt
    JOIN public.retail_stores rs ON rs.id = pt.store_id
    WHERE pt.id = p_transaction_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Get POS Analytics
-- Returns analytics for a POS integration or store
-- =============================================================================
CREATE OR REPLACE FUNCTION get_pos_analytics(
    p_store_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_transactions BIGINT,
    total_revenue_cents BIGINT,
    total_items_sold BIGINT,
    verified_items_sold BIGINT,
    verification_rate NUMERIC,
    avg_transaction_value NUMERIC,
    receipts_sent BIGINT,
    reviews_requested BIGINT,
    reviews_submitted BIGINT,
    review_conversion_rate NUMERIC,
    daily_stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH tx_stats AS (
        SELECT
            COUNT(*)::BIGINT as tx_count,
            SUM(total_amount_cents)::BIGINT as revenue,
            SUM(total_items)::BIGINT as items,
            SUM(verified_items)::BIGINT as verified,
            COUNT(*) FILTER (WHERE receipt_sent)::BIGINT as receipts,
            COUNT(*) FILTER (WHERE review_requested)::BIGINT as review_req,
            COUNT(*) FILTER (WHERE review_submitted)::BIGINT as review_sub
        FROM public.purchase_transactions
        WHERE store_id = p_store_id
          AND purchased_at > now() - (p_days || ' days')::INTERVAL
    ),
    daily AS (
        SELECT
            purchased_at::date as day,
            COUNT(*) as transactions,
            SUM(total_amount_cents) as revenue,
            SUM(verified_items) as verified_items
        FROM public.purchase_transactions
        WHERE store_id = p_store_id
          AND purchased_at > now() - (p_days || ' days')::INTERVAL
        GROUP BY purchased_at::date
        ORDER BY day
    )
    SELECT
        ts.tx_count,
        ts.revenue,
        ts.items,
        ts.verified,
        CASE WHEN ts.items > 0 THEN ROUND((ts.verified::NUMERIC / ts.items) * 100, 1) ELSE 0 END,
        CASE WHEN ts.tx_count > 0 THEN ROUND(ts.revenue::NUMERIC / ts.tx_count, 0) ELSE 0 END,
        ts.receipts,
        ts.review_req,
        ts.review_sub,
        CASE WHEN ts.review_req > 0 THEN ROUND((ts.review_sub::NUMERIC / ts.review_req) * 100, 1) ELSE 0 END,
        (SELECT jsonb_agg(jsonb_build_object(
            'date', day,
            'transactions', transactions,
            'revenue', revenue,
            'verified_items', verified_items
        )) FROM daily)
    FROM tx_stats ts;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.pos_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_webhook_logs ENABLE ROW LEVEL SECURITY;

-- POS Integrations: Store org members can manage
CREATE POLICY "Store org members can view POS integrations"
    ON public.pos_integrations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = pos_integrations.store_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can manage POS integrations"
    ON public.pos_integrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = pos_integrations.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = pos_integrations.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins manage all POS integrations"
    ON public.pos_integrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Purchase Transactions: Store org members can view, customers can view own
CREATE POLICY "Store org members can view transactions"
    ON public.purchase_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = purchase_transactions.store_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can view own transactions"
    ON public.purchase_transactions FOR SELECT
    USING (customer_user_id = auth.uid());

CREATE POLICY "Service can manage transactions"
    ON public.purchase_transactions FOR ALL
    USING (true)
    WITH CHECK (true);  -- Transactions created via secure webhook functions

CREATE POLICY "Platform admins view all transactions"
    ON public.purchase_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Purchase Line Items: Same as transactions
CREATE POLICY "Store org members can view line items"
    ON public.purchase_line_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_transactions pt
            JOIN public.retail_stores rs ON rs.id = pt.store_id
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE pt.id = purchase_line_items.transaction_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can view own line items"
    ON public.purchase_line_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_transactions pt
            WHERE pt.id = purchase_line_items.transaction_id
              AND pt.customer_user_id = auth.uid()
        )
    );

CREATE POLICY "Service can manage line items"
    ON public.purchase_line_items FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Platform admins view all line items"
    ON public.purchase_line_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Receipt Tokens: Public can validate (for receipt viewing)
CREATE POLICY "Public can view receipt tokens for validation"
    ON public.receipt_tokens FOR SELECT
    USING (true);  -- Actual validation done via secure function

CREATE POLICY "Service can manage receipt tokens"
    ON public.receipt_tokens FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Platform admins view all receipt tokens"
    ON public.receipt_tokens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Webhook Logs: Store org admins can view
CREATE POLICY "Store org admins can view webhook logs"
    ON public.pos_webhook_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.pos_integrations pi
            JOIN public.retail_stores rs ON rs.id = pi.store_id
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE pi.id = pos_webhook_logs.pos_integration_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service can manage webhook logs"
    ON public.pos_webhook_logs FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Platform admins view all webhook logs"
    ON public.pos_webhook_logs FOR SELECT
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
COMMENT ON TABLE public.pos_integrations IS 'Registry of POS system integrations for retail stores';
COMMENT ON TABLE public.purchase_transactions IS 'Records of purchases made at integrated POS systems';
COMMENT ON TABLE public.purchase_line_items IS 'Individual items in purchase transactions with verification status';
COMMENT ON TABLE public.receipt_tokens IS 'Secure tokens for accessing digital receipts';
COMMENT ON TABLE public.pos_webhook_logs IS 'Audit log of POS webhook events';

COMMENT ON COLUMN public.pos_integrations.pos_provider IS 'POS system type: 1c, atol, evotor, iiko, r_keeper, custom';
COMMENT ON COLUMN public.pos_integrations.webhook_secret_hash IS 'SHA256 hash of webhook secret for HMAC verification';
COMMENT ON COLUMN public.purchase_transactions.customer_phone_hash IS 'SHA256 hash of phone for privacy-preserving lookups';
COMMENT ON COLUMN public.purchase_line_items.status_level IS 'Trust status level (A/B/C) at time of purchase';
COMMENT ON COLUMN public.receipt_tokens.token_hash IS 'SHA256 hash of token for secure lookup';

COMMENT ON FUNCTION generate_receipt_token IS 'Creates a secure token for digital receipt access';
COMMENT ON FUNCTION validate_receipt_token IS 'Validates receipt token and tracks view';
COMMENT ON FUNCTION process_pos_transaction IS 'Processes POS webhook data into transaction records';
COMMENT ON FUNCTION get_digital_receipt IS 'Returns formatted digital receipt data';
COMMENT ON FUNCTION get_pos_analytics IS 'Returns POS analytics for a store';
-- =====================================================
-- Content Moderation Queue Enhancement
-- Migration 0054
-- =====================================================
-- Extends the existing moderation system (0035) with:
-- - Proper enum types for type safety
-- - Enhanced priority calculation
-- - Queue management functions (claim, resolve, escalate)
-- - Additional indexes for performant queue queries

SET client_encoding = 'UTF8';

-- =================
-- 1. ENUM TYPES
-- =================
-- Create proper PostgreSQL enum types for type safety and performance

DO $$
BEGIN
    -- Content type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_content_type') THEN
        CREATE TYPE moderation_content_type AS ENUM (
            'organization',
            'product',
            'review',
            'post',
            'media',
            'document',
            'certification'
        );
    END IF;

    -- Queue status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_queue_status') THEN
        CREATE TYPE moderation_queue_status AS ENUM (
            'pending',
            'in_review',
            'approved',
            'rejected',
            'escalated',
            'appealed',
            'resolved'
        );
    END IF;

    -- Queue source enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_source') THEN
        CREATE TYPE moderation_source AS ENUM (
            'auto_flag',
            'user_report',
            'new_content',
            'edit',
            'appeal',
            'scheduled_review'
        );
    END IF;

    -- Resolution action enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_resolution_action') THEN
        CREATE TYPE moderation_resolution_action AS ENUM (
            'approved',
            'rejected',
            'modified',
            'deleted',
            'no_action',
            'deferred'
        );
    END IF;
END $$;

-- =================
-- 2. ENHANCED PRIORITY CALCULATION FUNCTION
-- =================
-- More sophisticated priority calculation with detailed breakdown

CREATE OR REPLACE FUNCTION calculate_moderation_priority_v2(
    p_content_type text,
    p_source text,
    p_report_count integer DEFAULT 0,
    p_ai_confidence numeric DEFAULT 0,
    p_violator_history integer DEFAULT 0,
    p_content_age_hours integer DEFAULT 0,
    p_is_verified_business boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
    v_base_priority integer := 50;
    v_priority integer;
    v_reasons text[] := ARRAY[]::text[];
    v_content_weight integer := 0;
    v_source_weight integer := 0;
    v_report_weight integer := 0;
    v_ai_weight integer := 0;
    v_history_weight integer := 0;
    v_age_weight integer := 0;
    v_verified_weight integer := 0;
BEGIN
    -- Start with base priority
    v_priority := v_base_priority;

    -- Content type weight (certifications and organizations are highest priority)
    CASE p_content_type
        WHEN 'certification' THEN
            v_content_weight := 25;
            v_reasons := array_append(v_reasons, 'high_priority_content_type:certification');
        WHEN 'document' THEN
            v_content_weight := 20;
            v_reasons := array_append(v_reasons, 'high_priority_content_type:document');
        WHEN 'organization' THEN
            v_content_weight := 15;
            v_reasons := array_append(v_reasons, 'priority_content_type:organization');
        WHEN 'product' THEN
            v_content_weight := 10;
            v_reasons := array_append(v_reasons, 'priority_content_type:product');
        WHEN 'review' THEN
            v_content_weight := 5;
        WHEN 'post' THEN
            v_content_weight := 3;
        WHEN 'media' THEN
            v_content_weight := 2;
        ELSE
            v_content_weight := 0;
    END CASE;
    v_priority := v_priority + v_content_weight;

    -- Source weight (user reports are prioritized over auto-detection)
    CASE p_source
        WHEN 'user_report' THEN
            v_source_weight := 15;
            v_reasons := array_append(v_reasons, 'user_reported');
        WHEN 'auto_flag' THEN
            v_source_weight := 8;
            v_reasons := array_append(v_reasons, 'auto_flagged');
        WHEN 'appeal' THEN
            v_source_weight := 12;
            v_reasons := array_append(v_reasons, 'appeal_review');
        WHEN 'scheduled_review' THEN
            v_source_weight := 3;
        ELSE
            v_source_weight := 0;
    END CASE;
    v_priority := v_priority + v_source_weight;

    -- Report count boost (more reports = higher priority, capped at 30)
    v_report_weight := LEAST(p_report_count * 5, 30);
    IF v_report_weight > 0 THEN
        v_reasons := array_append(v_reasons, 'multiple_reports:' || p_report_count);
    END IF;
    v_priority := v_priority + v_report_weight;

    -- AI confidence boost (higher confidence = higher priority)
    v_ai_weight := (COALESCE(p_ai_confidence, 0) * 15)::integer;
    IF v_ai_weight >= 10 THEN
        v_reasons := array_append(v_reasons, 'high_ai_confidence:' || round(p_ai_confidence::numeric, 2));
    END IF;
    v_priority := v_priority + v_ai_weight;

    -- Violator history boost (repeat offenders get higher priority)
    v_history_weight := LEAST(p_violator_history * 12, 35);
    IF v_history_weight > 0 THEN
        v_reasons := array_append(v_reasons, 'repeat_violator:' || p_violator_history || '_violations');
    END IF;
    v_priority := v_priority + v_history_weight;

    -- Content age penalty (older items get slight deprioritization to handle fresh content first)
    -- But very old items (>72 hours) get priority bump as they need resolution
    IF p_content_age_hours > 72 THEN
        v_age_weight := 10;
        v_reasons := array_append(v_reasons, 'stale_item:' || p_content_age_hours || 'h');
    ELSIF p_content_age_hours > 24 THEN
        v_age_weight := -5;
    ELSE
        v_age_weight := 0;
    END IF;
    v_priority := v_priority + v_age_weight;

    -- Verified business boost (verified businesses get faster review)
    IF p_is_verified_business THEN
        v_verified_weight := 8;
        v_reasons := array_append(v_reasons, 'verified_business');
    END IF;
    v_priority := v_priority + v_verified_weight;

    -- Cap at 100
    v_priority := LEAST(v_priority, 100);

    RETURN jsonb_build_object(
        'priority_score', v_priority,
        'reasons', v_reasons,
        'breakdown', jsonb_build_object(
            'base', v_base_priority,
            'content_type', v_content_weight,
            'source', v_source_weight,
            'reports', v_report_weight,
            'ai_confidence', v_ai_weight,
            'violator_history', v_history_weight,
            'content_age', v_age_weight,
            'verified_business', v_verified_weight
        )
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_moderation_priority_v2 IS 'Enhanced priority calculation with detailed breakdown and multiple factors';

-- =================
-- 3. QUEUE MANAGEMENT FUNCTIONS
-- =================

-- Function to claim a queue item for review
CREATE OR REPLACE FUNCTION claim_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
    v_result jsonb;
BEGIN
    -- Attempt to claim the item (only if pending or unassigned)
    UPDATE moderation_queue
    SET
        status = 'in_review',
        assigned_to = p_moderator_id,
        assigned_at = now(),
        updated_at = now()
    WHERE id = p_queue_item_id
      AND (status = 'pending' OR (status = 'in_review' AND assigned_to IS NULL))
    RETURNING * INTO v_item;

    IF v_item IS NULL THEN
        -- Check if item exists and why it couldn't be claimed
        SELECT * INTO v_item FROM moderation_queue WHERE id = p_queue_item_id;

        IF v_item IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'item_not_found',
                'message', 'Queue item not found'
            );
        ELSIF v_item.assigned_to IS NOT NULL AND v_item.assigned_to != p_moderator_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'already_claimed',
                'message', 'Item already claimed by another moderator',
                'assigned_to', v_item.assigned_to,
                'assigned_at', v_item.assigned_at
            );
        ELSIF v_item.status NOT IN ('pending', 'in_review') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'invalid_status',
                'message', 'Item cannot be claimed in current status',
                'current_status', v_item.status
            );
        END IF;
    END IF;

    -- Log the claim action
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        notes
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        'assign',
        p_moderator_id,
        'Item claimed for review'
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'content_type', v_item.content_type,
        'content_id', v_item.content_id,
        'priority_score', v_item.priority_score,
        'claimed_at', now()
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_moderation_item IS 'Atomically claims a queue item for review by a moderator';

-- Function to release a claimed item back to the queue
CREATE OR REPLACE FUNCTION release_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid,
    p_reason text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
BEGIN
    -- Release the item (only if currently assigned to this moderator)
    UPDATE moderation_queue
    SET
        status = 'pending',
        assigned_to = NULL,
        assigned_at = NULL,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND assigned_to = p_moderator_id
      AND status = 'in_review'
    RETURNING * INTO v_item;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'cannot_release',
            'message', 'Item not assigned to you or not in review status'
        );
    END IF;

    -- Log the release action
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        notes
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        'unassign',
        p_moderator_id,
        COALESCE(p_reason, 'Item released back to queue')
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'released_at', now()
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_moderation_item IS 'Releases a claimed item back to the pending queue';

-- Function to resolve a queue item
CREATE OR REPLACE FUNCTION resolve_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid,
    p_action text,
    p_violation_type text DEFAULT NULL,
    p_guideline_code text DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_notify_user boolean DEFAULT true
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
    v_previous_state jsonb;
    v_result jsonb;
BEGIN
    -- Validate action
    IF p_action NOT IN ('approved', 'rejected', 'modified', 'deleted', 'no_action') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_action',
            'message', 'Action must be one of: approved, rejected, modified, deleted, no_action'
        );
    END IF;

    -- Get current item state
    SELECT * INTO v_item FROM moderation_queue WHERE id = p_queue_item_id;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'item_not_found',
            'message', 'Queue item not found'
        );
    END IF;

    IF v_item.assigned_to IS NULL OR v_item.assigned_to != p_moderator_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_assigned',
            'message', 'You must claim this item before resolving it'
        );
    END IF;

    -- Store previous state for audit
    v_previous_state := to_jsonb(v_item);

    -- Update the queue item
    UPDATE moderation_queue
    SET
        status = 'resolved',
        resolution_action = p_action,
        resolution_notes = p_notes,
        resolved_by = p_moderator_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_queue_item_id;

    -- Log the resolution action
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        reason,
        notes,
        previous_state,
        new_state,
        violation_type,
        guideline_ref
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        CASE
            WHEN p_action = 'approved' THEN 'approve'
            WHEN p_action = 'rejected' THEN 'reject'
            WHEN p_action = 'deleted' THEN 'delete'
            ELSE 'resolve'
        END,
        p_moderator_id,
        p_violation_type,
        p_notes,
        v_previous_state,
        jsonb_build_object('status', 'resolved', 'resolution_action', p_action),
        p_violation_type,
        p_guideline_code
    );

    -- Record violation if content was rejected
    IF p_action IN ('rejected', 'deleted') AND p_violation_type IS NOT NULL THEN
        INSERT INTO violation_history (
            violator_type,
            violator_id,
            violation_type,
            guideline_code,
            severity,
            content_type,
            content_id,
            queue_item_id,
            consequence,
            notes,
            created_by
        )
        SELECT
            CASE WHEN v_item.content_type = 'organization' THEN 'organization' ELSE 'user' END,
            CASE
                WHEN v_item.content_type = 'organization' THEN v_item.content_id
                ELSE (v_item.content_snapshot->>'author_user_id')::uuid
            END,
            p_violation_type,
            p_guideline_code,
            COALESCE(
                (SELECT severity FROM moderation_guidelines WHERE code = p_guideline_code),
                'medium'
            ),
            v_item.content_type,
            v_item.content_id,
            p_queue_item_id,
            CASE p_action
                WHEN 'deleted' THEN 'content_removed'
                WHEN 'rejected' THEN 'warning'
                ELSE 'warning'
            END,
            p_notes,
            p_moderator_id
        WHERE (v_item.content_snapshot->>'author_user_id') IS NOT NULL
           OR v_item.content_type = 'organization';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'action', p_action,
        'resolved_at', now(),
        'notify_user', p_notify_user
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resolve_moderation_item IS 'Resolves a queue item with a moderation decision';

-- Function to escalate a queue item
CREATE OR REPLACE FUNCTION escalate_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid,
    p_reason text,
    p_target_level integer DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
    v_new_level integer;
BEGIN
    -- Get current item
    SELECT * INTO v_item FROM moderation_queue WHERE id = p_queue_item_id;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'item_not_found',
            'message', 'Queue item not found'
        );
    END IF;

    -- Calculate new escalation level
    v_new_level := COALESCE(p_target_level, v_item.escalation_level + 1);

    IF v_new_level > 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'max_escalation',
            'message', 'Item is already at maximum escalation level'
        );
    END IF;

    IF v_new_level <= v_item.escalation_level THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_level',
            'message', 'Target escalation level must be higher than current level'
        );
    END IF;

    -- Update the queue item
    UPDATE moderation_queue
    SET
        status = 'escalated',
        escalation_level = v_new_level,
        escalated_by = p_moderator_id,
        escalated_at = now(),
        escalation_reason = p_reason,
        -- Release from current assignee so senior moderator can claim
        assigned_to = NULL,
        assigned_at = NULL,
        -- Boost priority for escalated items
        priority_score = LEAST(priority_score + 15, 100),
        priority_reason = array_append(priority_reason, 'escalated_level_' || v_new_level),
        updated_at = now()
    WHERE id = p_queue_item_id;

    -- Log the escalation
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        reason,
        notes,
        previous_state,
        new_state
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        'escalate',
        p_moderator_id,
        p_reason,
        'Escalated from level ' || v_item.escalation_level || ' to level ' || v_new_level,
        jsonb_build_object('escalation_level', v_item.escalation_level),
        jsonb_build_object('escalation_level', v_new_level)
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'previous_level', v_item.escalation_level,
        'new_level', v_new_level,
        'escalated_at', now()
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION escalate_moderation_item IS 'Escalates a queue item to a higher review level';

-- Function to get next item from queue for a moderator
CREATE OR REPLACE FUNCTION get_next_moderation_item(
    p_moderator_id uuid,
    p_content_type text DEFAULT NULL,
    p_min_escalation_level integer DEFAULT 0,
    p_max_escalation_level integer DEFAULT 3
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
BEGIN
    -- Find and claim the highest priority pending item
    SELECT * INTO v_item
    FROM moderation_queue
    WHERE status IN ('pending', 'escalated')
      AND (assigned_to IS NULL)
      AND (p_content_type IS NULL OR content_type = p_content_type)
      AND escalation_level >= p_min_escalation_level
      AND escalation_level <= p_max_escalation_level
    ORDER BY
        CASE WHEN status = 'escalated' THEN 0 ELSE 1 END, -- Escalated items first
        priority_score DESC,
        created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'no_items',
            'message', 'No pending items available'
        );
    END IF;

    -- Claim the item
    RETURN claim_moderation_item(v_item.id, p_moderator_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_moderation_item IS 'Gets and claims the next highest priority item for a moderator';

-- =================
-- 4. ADDITIONAL INDEXES FOR QUEUE QUERIES
-- =================

-- Index for efficient queue fetching by moderator workload
CREATE INDEX IF NOT EXISTS idx_moderation_queue_escalation
    ON moderation_queue(escalation_level, priority_score DESC)
    WHERE status IN ('pending', 'escalated');

-- Index for moderator assignment tracking
CREATE INDEX IF NOT EXISTS idx_moderation_queue_moderator_active
    ON moderation_queue(assigned_to, updated_at DESC)
    WHERE status = 'in_review';

-- Index for content lookup with status
CREATE INDEX IF NOT EXISTS idx_moderation_queue_content_status
    ON moderation_queue(content_type, content_id, status);

-- Index for time-based queries (SLA tracking)
CREATE INDEX IF NOT EXISTS idx_moderation_queue_created_pending
    ON moderation_queue(created_at)
    WHERE status IN ('pending', 'in_review', 'escalated');

-- Index for resolved items by date (reporting)
CREATE INDEX IF NOT EXISTS idx_moderation_queue_resolved_date
    ON moderation_queue(resolved_at DESC)
    WHERE status = 'resolved';

-- =================
-- 5. QUEUE STATISTICS VIEW
-- =================

CREATE OR REPLACE VIEW moderation_queue_stats AS
SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'in_review') as in_review_count,
    COUNT(*) FILTER (WHERE status = 'escalated') as escalated_count,
    COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at > now() - interval '24 hours') as resolved_today,
    COUNT(*) FILTER (WHERE status IN ('pending', 'escalated') AND created_at < now() - interval '24 hours') as overdue_count,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
        FILTER (WHERE status = 'resolved' AND resolved_at > now() - interval '7 days') as avg_resolution_hours_7d,
    COUNT(*) FILTER (WHERE escalation_level >= 2) as high_escalation_count,
    jsonb_object_agg(
        content_type,
        COUNT(*) FILTER (WHERE status IN ('pending', 'in_review', 'escalated'))
    ) as pending_by_type
FROM moderation_queue;

COMMENT ON VIEW moderation_queue_stats IS 'Real-time statistics for the moderation queue';

-- =================
-- 6. UPDATE TRIGGER FOR TIMESTAMP
-- =================

CREATE OR REPLACE FUNCTION update_moderation_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_moderation_queue_updated ON moderation_queue;
CREATE TRIGGER trg_moderation_queue_updated
    BEFORE UPDATE ON moderation_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_moderation_queue_timestamp();

-- =================
-- COMMENTS
-- =================

COMMENT ON TYPE moderation_content_type IS 'Types of content that can be moderated';
COMMENT ON TYPE moderation_queue_status IS 'Workflow statuses for moderation queue items';
COMMENT ON TYPE moderation_source IS 'Sources that can trigger moderation review';
COMMENT ON TYPE moderation_resolution_action IS 'Actions that can be taken when resolving moderation';
-- =====================================================
-- AI Moderation System Enhancement
-- Migration 0055
-- =====================================================
-- Extends the existing AI moderation system with:
-- - Pattern type enums
-- - AI moderation results table for tracking runs
-- - Enhanced pattern matching functions
-- - Performance tracking and pattern effectiveness metrics

SET client_encoding = 'UTF8';

-- =================
-- 1. ENUM TYPES FOR AI MODERATION
-- =================

DO $$
BEGIN
    -- Pattern type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_pattern_type') THEN
        CREATE TYPE ai_pattern_type AS ENUM (
            'text_regex',
            'text_keywords',
            'image_hash',
            'document_fingerprint',
            'behavioral',
            'ml_model',
            'semantic_similarity'
        );
    END IF;

    -- Detection category enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_detection_category') THEN
        CREATE TYPE ai_detection_category AS ENUM (
            'fake_business',
            'misleading_health_claim',
            'counterfeit_cert',
            'offensive_content',
            'spam',
            'competitor_attack',
            'suspicious_pattern',
            'copyright_violation',
            'privacy_violation',
            'fraud_indicator'
        );
    END IF;

    -- AI action enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_moderation_action') THEN
        CREATE TYPE ai_moderation_action AS ENUM (
            'flag_for_review',
            'auto_reject',
            'increase_priority',
            'notify_admin',
            'quarantine',
            'allow_with_warning'
        );
    END IF;

    -- Moderation run status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_run_status') THEN
        CREATE TYPE ai_run_status AS ENUM (
            'pending',
            'running',
            'completed',
            'failed',
            'timeout'
        );
    END IF;
END $$;

-- =================
-- 2. AI MODERATION RESULTS TABLE
-- =================
-- Stores results from each AI moderation run

CREATE TABLE IF NOT EXISTS ai_moderation_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Content being analyzed
    content_type text NOT NULL,
    content_id uuid NOT NULL,

    -- Run metadata
    run_status text NOT NULL DEFAULT 'pending' CHECK (run_status IN (
        'pending', 'running', 'completed', 'failed', 'timeout'
    )),
    started_at timestamptz,
    completed_at timestamptz,
    duration_ms integer,

    -- Analysis results
    overall_confidence numeric(4,3) CHECK (overall_confidence BETWEEN 0 AND 1),
    overall_recommendation text CHECK (overall_recommendation IN (
        'approve', 'review', 'reject', 'escalate'
    )),

    -- Pattern matches (array of matched patterns)
    matched_patterns jsonb DEFAULT '[]',
    -- Structure: [{ pattern_id, pattern_name, confidence, match_details, action }]

    -- Risk assessment
    risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
    risk_factors jsonb DEFAULT '[]',
    -- Structure: [{ factor, weight, description }]

    -- Text analysis results (if applicable)
    text_analysis jsonb,
    -- Structure: { sentiment, toxicity_score, keywords_found, language }

    -- Image analysis results (if applicable)
    image_analysis jsonb,
    -- Structure: { nsfw_score, manipulation_detected, similar_images }

    -- Document analysis results (if applicable)
    document_analysis jsonb,
    -- Structure: { authenticity_score, format_issues, metadata_anomalies }

    -- Behavioral analysis results (if applicable)
    behavioral_analysis jsonb,
    -- Structure: { patterns_detected, anomaly_score, timeline }

    -- Processing info
    processor_version text,
    processing_node text,
    error_message text,

    -- Link to queue item if flagged
    queue_item_id uuid REFERENCES moderation_queue(id),

    created_at timestamptz NOT NULL DEFAULT now(),

    -- Index for finding results by content
    CONSTRAINT unique_ai_result_per_run UNIQUE (content_type, content_id, created_at)
);

-- Indexes for AI results
CREATE INDEX IF NOT EXISTS idx_ai_results_content
    ON ai_moderation_results(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_ai_results_status
    ON ai_moderation_results(run_status)
    WHERE run_status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_ai_results_recommendation
    ON ai_moderation_results(overall_recommendation, created_at DESC)
    WHERE overall_recommendation IN ('reject', 'escalate');

CREATE INDEX IF NOT EXISTS idx_ai_results_risk
    ON ai_moderation_results(risk_score DESC)
    WHERE risk_score >= 70;

CREATE INDEX IF NOT EXISTS idx_ai_results_queue
    ON ai_moderation_results(queue_item_id)
    WHERE queue_item_id IS NOT NULL;

-- =================
-- 3. PATTERN EFFECTIVENESS TRACKING
-- =================
-- Add columns to track pattern performance over time

ALTER TABLE ai_moderation_patterns
    ADD COLUMN IF NOT EXISTS last_match_at timestamptz,
    ADD COLUMN IF NOT EXISTS effectiveness_score numeric(4,3) DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS auto_disable_threshold integer DEFAULT 10,
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS test_content text[]; -- Sample content for testing the pattern

-- =================
-- 4. AI PATTERN MATCH DETAILS TABLE
-- =================
-- Detailed record of each pattern match for analysis

CREATE TABLE IF NOT EXISTS ai_pattern_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to AI result
    ai_result_id uuid NOT NULL REFERENCES ai_moderation_results(id) ON DELETE CASCADE,

    -- Pattern that matched
    pattern_id uuid NOT NULL REFERENCES ai_moderation_patterns(id),

    -- Match details
    confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    match_location jsonb, -- { start, end, field, context }
    match_content text, -- The actual content that matched
    match_context text, -- Surrounding context

    -- Outcome tracking (filled in after moderation decision)
    was_true_positive boolean,
    feedback_by uuid REFERENCES auth.users(id),
    feedback_at timestamptz,
    feedback_notes text,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_matches_result
    ON ai_pattern_matches(ai_result_id);

CREATE INDEX IF NOT EXISTS idx_pattern_matches_pattern
    ON ai_pattern_matches(pattern_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_matches_feedback
    ON ai_pattern_matches(pattern_id, was_true_positive)
    WHERE was_true_positive IS NOT NULL;

-- =================
-- 5. FUNCTIONS FOR AI MODERATION
-- =================

-- Function to run AI moderation on content
CREATE OR REPLACE FUNCTION initiate_ai_moderation(
    p_content_type text,
    p_content_id uuid,
    p_content_data jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_result_id uuid;
BEGIN
    -- Create a pending AI moderation result
    INSERT INTO ai_moderation_results (
        content_type,
        content_id,
        run_status,
        started_at
    ) VALUES (
        p_content_type,
        p_content_id,
        'pending',
        now()
    )
    RETURNING id INTO v_result_id;

    -- Note: Actual AI processing would be triggered by a background worker
    -- that picks up pending results and processes them

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initiate_ai_moderation IS 'Creates a pending AI moderation request for background processing';

-- Function to complete AI moderation with results
CREATE OR REPLACE FUNCTION complete_ai_moderation(
    p_result_id uuid,
    p_overall_confidence numeric,
    p_recommendation text,
    p_risk_score integer,
    p_matched_patterns jsonb,
    p_risk_factors jsonb DEFAULT '[]',
    p_text_analysis jsonb DEFAULT NULL,
    p_image_analysis jsonb DEFAULT NULL,
    p_document_analysis jsonb DEFAULT NULL,
    p_processor_version text DEFAULT '1.0'
) RETURNS jsonb AS $$
DECLARE
    v_result ai_moderation_results;
    v_queue_id uuid;
    v_pattern jsonb;
    v_pattern_record RECORD;
BEGIN
    -- Update the AI result
    UPDATE ai_moderation_results
    SET
        run_status = 'completed',
        completed_at = now(),
        duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
        overall_confidence = p_overall_confidence,
        overall_recommendation = p_recommendation,
        risk_score = p_risk_score,
        matched_patterns = p_matched_patterns,
        risk_factors = p_risk_factors,
        text_analysis = p_text_analysis,
        image_analysis = p_image_analysis,
        document_analysis = p_document_analysis,
        processor_version = p_processor_version
    WHERE id = p_result_id
    RETURNING * INTO v_result;

    IF v_result IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'result_not_found'
        );
    END IF;

    -- Record individual pattern matches
    FOR v_pattern IN SELECT * FROM jsonb_array_elements(p_matched_patterns)
    LOOP
        INSERT INTO ai_pattern_matches (
            ai_result_id,
            pattern_id,
            confidence,
            match_location,
            match_content
        ) VALUES (
            p_result_id,
            (v_pattern->>'pattern_id')::uuid,
            (v_pattern->>'confidence')::numeric,
            v_pattern->'match_location',
            v_pattern->>'match_content'
        );

        -- Update pattern statistics
        UPDATE ai_moderation_patterns
        SET
            match_count = match_count + 1,
            last_match_at = now()
        WHERE id = (v_pattern->>'pattern_id')::uuid;
    END LOOP;

    -- If recommendation is review/reject/escalate, create queue item
    IF p_recommendation IN ('review', 'reject', 'escalate') THEN
        v_queue_id := add_to_moderation_queue(
            v_result.content_type,
            v_result.content_id,
            'auto_flag',
            p_matched_patterns,
            p_overall_confidence,
            ARRAY(SELECT value->>'factor' FROM jsonb_array_elements(p_risk_factors) AS value)
        );

        -- Link result to queue item
        UPDATE ai_moderation_results
        SET queue_item_id = v_queue_id
        WHERE id = p_result_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'result_id', p_result_id,
        'recommendation', p_recommendation,
        'risk_score', p_risk_score,
        'queue_item_id', v_queue_id,
        'patterns_matched', jsonb_array_length(p_matched_patterns)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_ai_moderation IS 'Records completed AI moderation results and triggers queue item creation if needed';

-- Function to update pattern effectiveness based on moderation feedback
CREATE OR REPLACE FUNCTION update_pattern_effectiveness(
    p_pattern_id uuid
) RETURNS void AS $$
DECLARE
    v_stats RECORD;
BEGIN
    -- Calculate effectiveness from recent matches
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE was_true_positive = true) as true_positives,
        COUNT(*) FILTER (WHERE was_true_positive = false) as false_positives,
        COUNT(*) FILTER (WHERE was_true_positive IS NOT NULL) as reviewed
    INTO v_stats
    FROM ai_pattern_matches
    WHERE pattern_id = p_pattern_id
      AND created_at > now() - interval '30 days';

    -- Update pattern effectiveness score
    IF v_stats.reviewed > 0 THEN
        UPDATE ai_moderation_patterns
        SET
            effectiveness_score = v_stats.true_positives::numeric / v_stats.reviewed,
            true_positive_count = COALESCE(true_positive_count, 0) +
                (v_stats.true_positives - COALESCE((
                    SELECT SUM(CASE WHEN was_true_positive THEN 1 ELSE 0 END)
                    FROM ai_pattern_matches
                    WHERE pattern_id = p_pattern_id
                      AND created_at <= now() - interval '30 days'
                ), 0)),
            false_positive_count = COALESCE(false_positive_count, 0) +
                (v_stats.false_positives - COALESCE((
                    SELECT SUM(CASE WHEN NOT was_true_positive THEN 1 ELSE 0 END)
                    FROM ai_pattern_matches
                    WHERE pattern_id = p_pattern_id
                      AND created_at <= now() - interval '30 days'
                ), 0)),
            review_count = v_stats.reviewed,
            last_reviewed_at = now(),
            updated_at = now()
        WHERE id = p_pattern_id;

        -- Auto-disable patterns with poor effectiveness
        UPDATE ai_moderation_patterns
        SET
            is_active = false,
            updated_at = now()
        WHERE id = p_pattern_id
          AND effectiveness_score < 0.3
          AND review_count >= auto_disable_threshold;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_pattern_effectiveness IS 'Updates pattern effectiveness score based on moderation feedback';

-- Function to provide feedback on a pattern match
CREATE OR REPLACE FUNCTION provide_pattern_feedback(
    p_match_id uuid,
    p_was_true_positive boolean,
    p_feedback_by uuid,
    p_notes text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_match ai_pattern_matches;
BEGIN
    -- Update the match with feedback
    UPDATE ai_pattern_matches
    SET
        was_true_positive = p_was_true_positive,
        feedback_by = p_feedback_by,
        feedback_at = now(),
        feedback_notes = p_notes
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    IF v_match IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'match_not_found'
        );
    END IF;

    -- Update pattern effectiveness
    PERFORM update_pattern_effectiveness(v_match.pattern_id);

    RETURN jsonb_build_object(
        'success', true,
        'match_id', p_match_id,
        'pattern_id', v_match.pattern_id,
        'was_true_positive', p_was_true_positive
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION provide_pattern_feedback IS 'Records moderator feedback on whether a pattern match was correct';

-- =================
-- 6. AI MODERATION PATTERNS VIEW
-- =================

CREATE OR REPLACE VIEW ai_pattern_effectiveness AS
SELECT
    p.id,
    p.name,
    p.pattern_type,
    p.detects,
    p.is_active,
    p.match_count,
    p.true_positive_count,
    p.false_positive_count,
    p.effectiveness_score,
    p.last_match_at,
    p.last_reviewed_at,
    CASE
        WHEN p.effectiveness_score >= 0.8 THEN 'excellent'
        WHEN p.effectiveness_score >= 0.6 THEN 'good'
        WHEN p.effectiveness_score >= 0.4 THEN 'moderate'
        WHEN p.effectiveness_score >= 0.2 THEN 'poor'
        ELSE 'very_poor'
    END as effectiveness_rating,
    CASE
        WHEN NOT p.is_active THEN 'disabled'
        WHEN p.match_count = 0 THEN 'no_matches'
        WHEN p.effectiveness_score < 0.3 AND p.review_count >= p.auto_disable_threshold THEN 'at_risk'
        ELSE 'active'
    END as status,
    p.created_at,
    p.updated_at
FROM ai_moderation_patterns p;

COMMENT ON VIEW ai_pattern_effectiveness IS 'Shows AI pattern performance metrics and effectiveness ratings';

-- =================
-- 7. ROW LEVEL SECURITY
-- =================

ALTER TABLE ai_moderation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pattern_matches ENABLE ROW LEVEL SECURITY;

-- Moderators can view AI results
CREATE POLICY "Moderators view AI results" ON ai_moderation_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Service role can manage AI results
CREATE POLICY "Service role manages AI results" ON ai_moderation_results
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Moderators can view pattern matches
CREATE POLICY "Moderators view pattern matches" ON ai_pattern_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Moderators can provide feedback on pattern matches
CREATE POLICY "Moderators provide pattern feedback" ON ai_pattern_matches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Service role can manage pattern matches
CREATE POLICY "Service role manages pattern matches" ON ai_pattern_matches
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- =================
-- 8. SEED ADDITIONAL AI PATTERNS
-- =================

INSERT INTO ai_moderation_patterns (name, pattern_type, pattern_data, detects, action_on_match, priority_boost, severity, description) VALUES
-- Document authenticity patterns
('Certificate Format Anomaly', 'document_fingerprint',
 '{"checks": ["resolution_consistency", "font_uniformity", "metadata_validity", "compression_artifacts"]}',
 'counterfeit_cert', 'flag_for_review', 30, 'critical',
 'Detects potential certificate forgery through document analysis'),

-- Behavioral patterns
('Account Review Burst', 'behavioral',
 '{"rule": "review_velocity", "params": {"max_reviews_per_day": 10, "max_same_org_reviews": 3, "min_account_age_days": 7}}',
 'competitor_attack', 'flag_for_review', 25, 'high',
 'Detects suspicious review patterns from new accounts'),

('Cross-Organization Negative Pattern', 'behavioral',
 '{"rule": "cross_org_negative", "params": {"min_negative_reviews": 5, "max_positive_ratio": 0.2, "time_window_days": 30}}',
 'competitor_attack', 'flag_for_review', 30, 'high',
 'Detects accounts that predominantly leave negative reviews'),

-- Text patterns for Russian content
('Promotional URL Pattern', 'text_regex',
 '{"regex": "(https?://)?([\\w-]+\\.)+[\\w]{2,}(/[\\w-./?%&=]*)?", "context_check": true, "flags": "i"}',
 'spam', 'increase_priority', 10, 'medium',
 'Detects promotional URLs in reviews'),

('Contact Info Solicitation', 'text_keywords',
 '{"keywords": ["напишите мне", "позвоните", "мой телеграм", "в вотсап", "whatsapp", "telegram", "@"], "context_required": true}',
 'spam', 'flag_for_review', 15, 'medium',
 'Detects attempts to solicit direct contact'),

('False Certification Claims', 'text_keywords',
 '{"keywords": ["сертифицировано", "одобрено роспотребнадзором", "одобрено минздравом", "гост", "iso сертификат"], "verify_claims": true}',
 'misleading_health_claim', 'flag_for_review', 25, 'high',
 'Detects potentially false certification claims'),

-- Image patterns
('Stock Photo Detection', 'image_hash',
 '{"method": "perceptual_hash", "database": "stock_photos", "threshold": 0.92}',
 'fake_business', 'flag_for_review', 20, 'medium',
 'Detects use of stock photos for business profiles'),

-- ML-based patterns (placeholder for future ML models)
('Sentiment Anomaly', 'ml_model',
 '{"model": "sentiment_analysis", "threshold": {"negative": -0.8, "suspicious_positive": 0.95}}',
 'suspicious_pattern', 'increase_priority', 10, 'low',
 'Detects abnormal sentiment patterns in reviews')

ON CONFLICT DO NOTHING;

-- =================
-- COMMENTS
-- =================

COMMENT ON TABLE ai_moderation_results IS 'Stores results from AI moderation analysis runs';
COMMENT ON TABLE ai_pattern_matches IS 'Detailed records of individual pattern matches for analysis and feedback';
COMMENT ON TYPE ai_pattern_type IS 'Types of patterns used for AI content moderation';
COMMENT ON TYPE ai_detection_category IS 'Categories of issues that AI moderation can detect';
COMMENT ON TYPE ai_moderation_action IS 'Actions that can be triggered by AI moderation';
-- =====================================================
-- Community Reports Enhancement
-- Migration 0056
-- =====================================================
-- Extends the content_reports table with:
-- - Report reason enum type
-- - Enhanced report handling workflow
-- - Duplicate report detection
-- - Reporter reputation tracking
-- - Report aggregation functions

SET client_encoding = 'UTF8';

-- =================
-- 1. ENUM TYPES FOR REPORTS
-- =================

DO $$
BEGIN
    -- Report reason enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
        CREATE TYPE report_reason AS ENUM (
            'fake_business',
            'misleading_claims',
            'counterfeit_cert',
            'offensive_content',
            'spam',
            'competitor_sabotage',
            'copyright',
            'privacy_violation',
            'fraud',
            'illegal_content',
            'duplicate_listing',
            'wrong_category',
            'outdated_info',
            'other'
        );
    END IF;

    -- Report status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE report_status AS ENUM (
            'new',
            'reviewing',
            'valid',
            'invalid',
            'duplicate',
            'merged',
            'resolved'
        );
    END IF;

    -- Report priority enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_priority') THEN
        CREATE TYPE report_priority AS ENUM (
            'low',
            'medium',
            'high',
            'critical'
        );
    END IF;
END $$;

-- =================
-- 2. REPORTER REPUTATION TABLE
-- =================
-- Tracks the accuracy of reporters to weight their reports

CREATE TABLE IF NOT EXISTS reporter_reputation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Report statistics
    total_reports integer NOT NULL DEFAULT 0,
    valid_reports integer NOT NULL DEFAULT 0,
    invalid_reports integer NOT NULL DEFAULT 0,
    pending_reports integer NOT NULL DEFAULT 0,

    -- Reputation score (0-100, based on accuracy)
    reputation_score integer NOT NULL DEFAULT 50,

    -- Status
    is_trusted boolean NOT NULL DEFAULT false, -- High accuracy reporters
    is_flagged boolean NOT NULL DEFAULT false, -- Potentially abusive reporters
    flagged_reason text,
    flagged_at timestamptz,
    flagged_by uuid REFERENCES auth.users(id),

    -- Rate limiting
    reports_today integer NOT NULL DEFAULT 0,
    reports_this_week integer NOT NULL DEFAULT 0,
    last_report_at timestamptz,
    daily_limit integer NOT NULL DEFAULT 10,
    weekly_limit integer NOT NULL DEFAULT 50,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT unique_reporter UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_reporter_reputation_user
    ON reporter_reputation(user_id);

CREATE INDEX IF NOT EXISTS idx_reporter_reputation_score
    ON reporter_reputation(reputation_score DESC)
    WHERE NOT is_flagged;

CREATE INDEX IF NOT EXISTS idx_reporter_reputation_trusted
    ON reporter_reputation(is_trusted)
    WHERE is_trusted = true;

-- =================
-- 3. ENHANCE CONTENT_REPORTS TABLE
-- =================

-- Add new columns to existing content_reports table
ALTER TABLE content_reports
    ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    ADD COLUMN IF NOT EXISTS reporter_reputation_at_report integer,
    ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS merged_into_report_id uuid REFERENCES content_reports(id),
    ADD COLUMN IF NOT EXISTS duplicate_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS first_reported_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_duplicate_at timestamptz,
    ADD COLUMN IF NOT EXISTS auto_escalated boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS escalation_reason text,
    ADD COLUMN IF NOT EXISTS resolution_type text CHECK (resolution_type IN (
        'content_removed', 'content_modified', 'no_violation', 'false_report', 'insufficient_evidence'
    )),
    ADD COLUMN IF NOT EXISTS feedback_sent boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_content_reports_content_reason
    ON content_reports(content_type, content_id, reason)
    WHERE status NOT IN ('resolved', 'invalid', 'duplicate');

-- Add index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_content_reports_priority
    ON content_reports(priority DESC, created_at)
    WHERE status = 'new';

-- Add index for reporter lookup
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_date
    ON content_reports(reporter_user_id, created_at DESC);

-- =================
-- 4. REPORT HANDLING FUNCTIONS
-- =================

-- Function to create a report with duplicate detection
CREATE OR REPLACE FUNCTION create_content_report(
    p_content_type text,
    p_content_id uuid,
    p_reporter_user_id uuid,
    p_reason text,
    p_reason_details text DEFAULT NULL,
    p_evidence_urls text[] DEFAULT ARRAY[]::text[],
    p_is_anonymous boolean DEFAULT false,
    p_reporter_ip text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_report_id uuid;
    v_existing_report_id uuid;
    v_reporter_rep reporter_reputation;
    v_priority text;
    v_queue_id uuid;
    v_cooldown_check timestamptz;
BEGIN
    -- Get or create reporter reputation
    INSERT INTO reporter_reputation (user_id)
    VALUES (p_reporter_user_id)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_reporter_rep;

    -- Check rate limiting
    IF v_reporter_rep.reports_today >= v_reporter_rep.daily_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'daily_limit_reached',
            'message', 'You have reached your daily report limit. Please try again tomorrow.',
            'limit', v_reporter_rep.daily_limit
        );
    END IF;

    IF v_reporter_rep.reports_this_week >= v_reporter_rep.weekly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'weekly_limit_reached',
            'message', 'You have reached your weekly report limit.',
            'limit', v_reporter_rep.weekly_limit
        );
    END IF;

    -- Check if reporter is flagged
    IF v_reporter_rep.is_flagged THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'reporter_flagged',
            'message', 'Your reporting privileges have been restricted.'
        );
    END IF;

    -- Check 24-hour cooldown for same content/reason from same user
    v_cooldown_check := now() - interval '24 hours';
    SELECT id INTO v_existing_report_id
    FROM content_reports
    WHERE content_type = p_content_type
      AND content_id = p_content_id
      AND reporter_user_id = p_reporter_user_id
      AND reason = p_reason
      AND created_at > v_cooldown_check;

    IF v_existing_report_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'duplicate_report',
            'message', 'You have already reported this content for this reason within the last 24 hours.',
            'existing_report_id', v_existing_report_id
        );
    END IF;

    -- Check for existing reports from other users (for merging)
    SELECT id INTO v_existing_report_id
    FROM content_reports
    WHERE content_type = p_content_type
      AND content_id = p_content_id
      AND reason = p_reason
      AND status NOT IN ('resolved', 'invalid', 'duplicate')
      AND merged_into_report_id IS NULL
    ORDER BY created_at
    LIMIT 1;

    -- Calculate priority based on reason and reporter reputation
    v_priority := CASE
        WHEN p_reason IN ('counterfeit_cert', 'illegal_content', 'fraud') THEN 'critical'
        WHEN p_reason IN ('fake_business', 'privacy_violation', 'copyright') THEN 'high'
        WHEN p_reason IN ('misleading_claims', 'competitor_sabotage', 'offensive_content') THEN 'medium'
        ELSE 'low'
    END;

    -- Boost priority for trusted reporters
    IF v_reporter_rep.is_trusted AND v_priority != 'critical' THEN
        v_priority := CASE v_priority
            WHEN 'high' THEN 'critical'
            WHEN 'medium' THEN 'high'
            WHEN 'low' THEN 'medium'
            ELSE v_priority
        END;
    END IF;

    IF v_existing_report_id IS NOT NULL THEN
        -- Merge with existing report
        UPDATE content_reports
        SET
            duplicate_count = duplicate_count + 1,
            last_duplicate_at = now(),
            -- Escalate priority if multiple reports
            priority = CASE
                WHEN duplicate_count >= 5 THEN 'critical'
                WHEN duplicate_count >= 3 THEN 'high'
                ELSE priority
            END,
            auto_escalated = CASE WHEN duplicate_count >= 3 THEN true ELSE auto_escalated END,
            escalation_reason = CASE
                WHEN duplicate_count >= 3 THEN 'Multiple independent reports'
                ELSE escalation_reason
            END,
            updated_at = now()
        WHERE id = v_existing_report_id;

        -- Create the new report as a duplicate pointing to the original
        INSERT INTO content_reports (
            content_type, content_id, reporter_user_id, reporter_ip,
            reason, reason_details, evidence_urls,
            status, priority, is_anonymous,
            merged_into_report_id, reporter_reputation_at_report
        ) VALUES (
            p_content_type, p_content_id, p_reporter_user_id, p_reporter_ip,
            p_reason, p_reason_details, p_evidence_urls,
            'merged', v_priority, p_is_anonymous,
            v_existing_report_id, v_reporter_rep.reputation_score
        )
        RETURNING id INTO v_report_id;

        -- Update reporter stats
        UPDATE reporter_reputation
        SET
            reports_today = reports_today + 1,
            reports_this_week = reports_this_week + 1,
            pending_reports = pending_reports + 1,
            last_report_at = now(),
            updated_at = now()
        WHERE user_id = p_reporter_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'report_id', v_report_id,
            'merged_into', v_existing_report_id,
            'message', 'Your report has been added to an existing investigation.',
            'total_reports_for_content', (SELECT duplicate_count + 1 FROM content_reports WHERE id = v_existing_report_id)
        );
    ELSE
        -- Create new primary report
        INSERT INTO content_reports (
            content_type, content_id, reporter_user_id, reporter_ip,
            reason, reason_details, evidence_urls,
            status, priority, is_anonymous,
            first_reported_at, reporter_reputation_at_report
        ) VALUES (
            p_content_type, p_content_id, p_reporter_user_id, p_reporter_ip,
            p_reason, p_reason_details, p_evidence_urls,
            'new', v_priority, p_is_anonymous,
            now(), v_reporter_rep.reputation_score
        )
        RETURNING id INTO v_report_id;

        -- Create moderation queue item
        v_queue_id := add_to_moderation_queue(
            p_content_type,
            p_content_id,
            'user_report',
            jsonb_build_object('report_id', v_report_id, 'reason', p_reason),
            CASE v_priority
                WHEN 'critical' THEN 0.9
                WHEN 'high' THEN 0.7
                WHEN 'medium' THEN 0.5
                ELSE 0.3
            END,
            ARRAY['user_report:' || p_reason]
        );

        -- Link report to queue item
        UPDATE content_reports
        SET linked_queue_item = v_queue_id
        WHERE id = v_report_id;

        -- Update reporter stats
        UPDATE reporter_reputation
        SET
            total_reports = total_reports + 1,
            reports_today = reports_today + 1,
            reports_this_week = reports_this_week + 1,
            pending_reports = pending_reports + 1,
            last_report_at = now(),
            updated_at = now()
        WHERE user_id = p_reporter_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'report_id', v_report_id,
            'queue_item_id', v_queue_id,
            'priority', v_priority,
            'message', 'Thank you for your report. Our team will review it.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_content_report IS 'Creates a content report with duplicate detection and reporter rate limiting';

-- Function to resolve a report and update reporter reputation
CREATE OR REPLACE FUNCTION resolve_content_report(
    p_report_id uuid,
    p_moderator_id uuid,
    p_status text, -- 'valid' or 'invalid'
    p_resolution_type text,
    p_notes text DEFAULT NULL,
    p_send_feedback boolean DEFAULT true
) RETURNS jsonb AS $$
DECLARE
    v_report content_reports;
    v_reputation_change integer;
    v_merged_reports uuid[];
BEGIN
    -- Validate status
    IF p_status NOT IN ('valid', 'invalid') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_status',
            'message', 'Status must be valid or invalid'
        );
    END IF;

    -- Get the report
    SELECT * INTO v_report FROM content_reports WHERE id = p_report_id;

    IF v_report IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'report_not_found'
        );
    END IF;

    -- Update the primary report
    UPDATE content_reports
    SET
        status = p_status,
        resolution_type = p_resolution_type,
        reviewed_by = p_moderator_id,
        reviewed_at = now(),
        review_notes = p_notes,
        feedback_sent = p_send_feedback,
        feedback_sent_at = CASE WHEN p_send_feedback THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_report_id;

    -- Get all merged reports
    SELECT array_agg(id) INTO v_merged_reports
    FROM content_reports
    WHERE merged_into_report_id = p_report_id;

    -- Update all merged reports
    IF v_merged_reports IS NOT NULL THEN
        UPDATE content_reports
        SET
            status = 'resolved',
            resolution_type = p_resolution_type,
            reviewed_by = p_moderator_id,
            reviewed_at = now(),
            review_notes = 'Resolved as part of merged report ' || p_report_id,
            updated_at = now()
        WHERE id = ANY(v_merged_reports);
    END IF;

    -- Calculate reputation change
    v_reputation_change := CASE
        WHEN p_status = 'valid' THEN 5 -- Reward valid reports
        WHEN p_status = 'invalid' THEN -3 -- Penalize invalid reports
        ELSE 0
    END;

    -- Update primary reporter reputation
    UPDATE reporter_reputation
    SET
        valid_reports = valid_reports + CASE WHEN p_status = 'valid' THEN 1 ELSE 0 END,
        invalid_reports = invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END,
        pending_reports = GREATEST(0, pending_reports - 1),
        reputation_score = LEAST(100, GREATEST(0, reputation_score + v_reputation_change)),
        is_trusted = CASE
            WHEN reputation_score + v_reputation_change >= 80
                 AND valid_reports + CASE WHEN p_status = 'valid' THEN 1 ELSE 0 END >= 10
            THEN true
            ELSE is_trusted
        END,
        is_flagged = CASE
            WHEN reputation_score + v_reputation_change <= 20
                 AND invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END >= 5
            THEN true
            ELSE is_flagged
        END,
        flagged_reason = CASE
            WHEN reputation_score + v_reputation_change <= 20
                 AND invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END >= 5
            THEN 'High rate of invalid reports'
            ELSE flagged_reason
        END,
        flagged_at = CASE
            WHEN reputation_score + v_reputation_change <= 20
                 AND invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END >= 5
            THEN now()
            ELSE flagged_at
        END,
        updated_at = now()
    WHERE user_id = v_report.reporter_user_id;

    -- Update merged reporters (smaller reputation change)
    IF v_merged_reports IS NOT NULL THEN
        UPDATE reporter_reputation rr
        SET
            valid_reports = valid_reports + CASE WHEN p_status = 'valid' THEN 1 ELSE 0 END,
            invalid_reports = invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END,
            pending_reports = GREATEST(0, pending_reports - 1),
            reputation_score = LEAST(100, GREATEST(0, reputation_score + (v_reputation_change / 2))),
            updated_at = now()
        FROM content_reports cr
        WHERE cr.id = ANY(v_merged_reports)
          AND cr.reporter_user_id = rr.user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'report_id', p_report_id,
        'status', p_status,
        'resolution_type', p_resolution_type,
        'merged_reports_resolved', COALESCE(array_length(v_merged_reports, 1), 0),
        'feedback_sent', p_send_feedback
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resolve_content_report IS 'Resolves a content report and updates reporter reputation';

-- Function to get reports for content
CREATE OR REPLACE FUNCTION get_content_reports(
    p_content_type text,
    p_content_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total_reports', COUNT(*),
        'unique_reporters', COUNT(DISTINCT reporter_user_id),
        'first_reported', MIN(first_reported_at),
        'last_reported', MAX(GREATEST(created_at, last_duplicate_at)),
        'status_summary', jsonb_object_agg(status, status_count),
        'reason_summary', jsonb_object_agg(reason, reason_count),
        'highest_priority', MAX(CASE priority
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            ELSE 1
        END),
        'auto_escalated', bool_or(auto_escalated)
    ) INTO v_result
    FROM (
        SELECT
            status,
            reason,
            first_reported_at,
            created_at,
            last_duplicate_at,
            reporter_user_id,
            priority,
            auto_escalated,
            COUNT(*) OVER (PARTITION BY status) as status_count,
            COUNT(*) OVER (PARTITION BY reason) as reason_count
        FROM content_reports
        WHERE content_type = p_content_type
          AND content_id = p_content_id
          AND merged_into_report_id IS NULL
    ) sub;

    RETURN COALESCE(v_result, jsonb_build_object('total_reports', 0));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_content_reports IS 'Gets aggregated report information for a piece of content';

-- =================
-- 5. DAILY RESET FUNCTION
-- =================

-- Function to reset daily/weekly report counters
CREATE OR REPLACE FUNCTION reset_reporter_counters()
RETURNS void AS $$
BEGIN
    -- Reset daily counters at midnight
    UPDATE reporter_reputation
    SET
        reports_today = 0,
        updated_at = now()
    WHERE reports_today > 0;

    -- Reset weekly counters on Monday
    IF EXTRACT(DOW FROM now()) = 1 THEN
        UPDATE reporter_reputation
        SET
            reports_this_week = 0,
            updated_at = now()
        WHERE reports_this_week > 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_reporter_counters IS 'Resets daily and weekly report counters (run via cron)';

-- =================
-- 6. REPORT STATISTICS VIEW
-- =================

CREATE OR REPLACE VIEW content_report_stats AS
SELECT
    COUNT(*) FILTER (WHERE status = 'new') as new_reports,
    COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing_reports,
    COUNT(*) FILTER (WHERE status = 'valid') as valid_reports,
    COUNT(*) FILTER (WHERE status = 'invalid') as invalid_reports,
    COUNT(*) FILTER (WHERE auto_escalated) as auto_escalated_reports,
    COUNT(*) FILTER (WHERE priority = 'critical' AND status = 'new') as critical_pending,
    COUNT(*) FILTER (WHERE priority = 'high' AND status = 'new') as high_pending,
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') as reports_today,
    COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') as reports_this_week,
    AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600)
        FILTER (WHERE reviewed_at IS NOT NULL AND created_at > now() - interval '7 days')
        as avg_resolution_hours_7d,
    jsonb_object_agg(reason, reason_count) as reports_by_reason
FROM (
    SELECT
        status, priority, auto_escalated, created_at, reviewed_at, reason,
        COUNT(*) OVER (PARTITION BY reason) as reason_count
    FROM content_reports
    WHERE merged_into_report_id IS NULL
) sub;

COMMENT ON VIEW content_report_stats IS 'Real-time statistics for content reports';

-- =================
-- 7. ROW LEVEL SECURITY
-- =================

ALTER TABLE reporter_reputation ENABLE ROW LEVEL SECURITY;

-- Users can view their own reputation
CREATE POLICY "Users view own reputation" ON reporter_reputation
    FOR SELECT USING (user_id = auth.uid());

-- Moderators can view all reputations
CREATE POLICY "Moderators view all reputations" ON reporter_reputation
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Moderators can update reputations (for flagging)
CREATE POLICY "Moderators manage reputations" ON reporter_reputation
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Service role can manage all
CREATE POLICY "Service role manages reputations" ON reporter_reputation
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- =================
-- 8. TRIGGER FOR UPDATED_AT
-- =================

CREATE OR REPLACE FUNCTION update_content_reports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_reports_updated ON content_reports;
CREATE TRIGGER trg_content_reports_updated
    BEFORE UPDATE ON content_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_content_reports_timestamp();

DROP TRIGGER IF EXISTS trg_reporter_reputation_updated ON reporter_reputation;
CREATE TRIGGER trg_reporter_reputation_updated
    BEFORE UPDATE ON reporter_reputation
    FOR EACH ROW
    EXECUTE FUNCTION update_content_reports_timestamp();

-- =================
-- COMMENTS
-- =================

COMMENT ON TABLE reporter_reputation IS 'Tracks reporter accuracy and rate limiting';
COMMENT ON TYPE report_reason IS 'Reasons users can select when reporting content';
COMMENT ON TYPE report_status IS 'Workflow statuses for content reports';
COMMENT ON TYPE report_priority IS 'Priority levels for content reports';
COMMENT ON COLUMN content_reports.merged_into_report_id IS 'If set, this report was merged into another report';
COMMENT ON COLUMN content_reports.duplicate_count IS 'Number of duplicate reports merged into this one';
COMMENT ON COLUMN reporter_reputation.is_trusted IS 'High-accuracy reporters get priority handling';
COMMENT ON COLUMN reporter_reputation.is_flagged IS 'Reporters with many invalid reports get restricted';
