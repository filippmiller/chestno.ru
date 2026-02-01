-- Migration: Geographic Scan Analytics
-- Privacy-respecting location analytics for product/QR code scans
-- Stores ONLY aggregated data - no individual user tracking

-- =============================================================================
-- GEOGRAPHIC REGIONS REFERENCE TABLE
-- =============================================================================
-- Predefined Russian regions for consistent aggregation
CREATE TABLE IF NOT EXISTS geo_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,  -- e.g., 'RU-MOW', 'RU-SPE'
    name TEXT NOT NULL,         -- e.g., 'Москва', 'Санкт-Петербург'
    name_en TEXT,               -- e.g., 'Moscow', 'Saint Petersburg'
    federal_district TEXT,      -- e.g., 'Центральный', 'Северо-Западный'
    timezone TEXT DEFAULT 'Europe/Moscow',
    center_lat NUMERIC(10,7),   -- Region center for map display
    center_lng NUMERIC(10,7),
    bounds_ne_lat NUMERIC(10,7), -- Northeast corner
    bounds_ne_lng NUMERIC(10,7),
    bounds_sw_lat NUMERIC(10,7), -- Southwest corner
    bounds_sw_lng NUMERIC(10,7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert major Russian regions
INSERT INTO geo_regions (code, name, name_en, federal_district, center_lat, center_lng) VALUES
    ('RU-MOW', 'Москва', 'Moscow', 'Центральный', 55.7558, 37.6173),
    ('RU-SPE', 'Санкт-Петербург', 'Saint Petersburg', 'Северо-Западный', 59.9343, 30.3351),
    ('RU-MOS', 'Московская область', 'Moscow Oblast', 'Центральный', 55.8154, 37.3645),
    ('RU-LEN', 'Ленинградская область', 'Leningrad Oblast', 'Северо-Западный', 60.1892, 32.3566),
    ('RU-KDA', 'Краснодарский край', 'Krasnodar Krai', 'Южный', 45.0448, 38.9760),
    ('RU-NIZ', 'Нижегородская область', 'Nizhny Novgorod Oblast', 'Приволжский', 56.3269, 44.0059),
    ('RU-SVE', 'Свердловская область', 'Sverdlovsk Oblast', 'Уральский', 56.8389, 60.6057),
    ('RU-TAT', 'Республика Татарстан', 'Tatarstan', 'Приволжский', 55.7898, 49.1221),
    ('RU-SAM', 'Самарская область', 'Samara Oblast', 'Приволжский', 53.1959, 50.1002),
    ('RU-ROS', 'Ростовская область', 'Rostov Oblast', 'Южный', 47.2357, 39.7015),
    ('RU-CHE', 'Челябинская область', 'Chelyabinsk Oblast', 'Уральский', 55.1644, 61.4368),
    ('RU-BA', 'Республика Башкортостан', 'Bashkortostan', 'Приволжский', 54.7388, 55.9721),
    ('RU-PER', 'Пермский край', 'Perm Krai', 'Приволжский', 58.0105, 56.2502),
    ('RU-VOR', 'Воронежская область', 'Voronezh Oblast', 'Центральный', 51.6720, 39.1843),
    ('RU-VGG', 'Волгоградская область', 'Volgograd Oblast', 'Южный', 48.7080, 44.5133),
    ('RU-KR', 'Крым', 'Crimea', 'Южный', 44.9521, 34.1024),
    ('RU-NSK', 'Новосибирская область', 'Novosibirsk Oblast', 'Сибирский', 55.0084, 82.9357),
    ('RU-OMS', 'Омская область', 'Omsk Oblast', 'Сибирский', 54.9893, 73.3682),
    ('RU-TYU', 'Тюменская область', 'Tyumen Oblast', 'Уральский', 57.1522, 65.5272),
    ('RU-IRK', 'Иркутская область', 'Irkutsk Oblast', 'Сибирский', 52.2870, 104.2890),
    ('RU-KEM', 'Кемеровская область', 'Kemerovo Oblast', 'Сибирский', 55.3548, 86.0884),
    ('RU-KYA', 'Красноярский край', 'Krasnoyarsk Krai', 'Сибирский', 56.0097, 92.8523),
    ('RU-PRI', 'Приморский край', 'Primorsky Krai', 'Дальневосточный', 43.1056, 131.8735),
    ('RU-KHA', 'Хабаровский край', 'Khabarovsk Krai', 'Дальневосточный', 48.4827, 135.0839),
    ('RU-UNKNOWN', 'Другие регионы', 'Other Regions', NULL, 55.7558, 37.6173)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- SCAN LOCATION AGGREGATES (PRIVACY-FIRST)
-- =============================================================================
-- Stores AGGREGATED scan counts by location grid cell
-- Grid cells are ~1km squares (approx. 0.01 degree precision)
-- NO individual scan data is stored - only counts per time bucket

CREATE TABLE IF NOT EXISTS scan_location_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,  -- NULL = org-wide scan
    
    -- Time bucket (hourly aggregation for privacy)
    time_bucket TIMESTAMPTZ NOT NULL,  -- Truncated to hour
    
    -- Location grid (approx 1km precision)
    grid_lat NUMERIC(6,2) NOT NULL,  -- Latitude truncated to 2 decimals (~1.1km)
    grid_lng NUMERIC(6,2) NOT NULL,  -- Longitude truncated to 2 decimals
    
    -- Region reference (for fast region-level queries)
    region_id UUID REFERENCES geo_regions(id),
    city TEXT,  -- Detected city name (reverse geocoded)
    
    -- Aggregated metrics (no individual tracking!)
    scan_count INTEGER NOT NULL DEFAULT 0,
    unique_sessions INTEGER NOT NULL DEFAULT 0,  -- Approximated via HyperLogLog-style counting
    
    -- Time-of-day distribution (24 buckets)
    hourly_distribution JSONB DEFAULT '{}',  -- {"0": 5, "9": 23, "12": 45, ...}
    
    -- Device breakdown (aggregated)
    device_mobile_count INTEGER DEFAULT 0,
    device_desktop_count INTEGER DEFAULT 0,
    device_tablet_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique constraint for upsert
    CONSTRAINT unique_location_time_bucket UNIQUE (organization_id, product_id, time_bucket, grid_lat, grid_lng)
);

CREATE INDEX idx_scan_loc_org ON scan_location_aggregates(organization_id);
CREATE INDEX idx_scan_loc_product ON scan_location_aggregates(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_scan_loc_time ON scan_location_aggregates(time_bucket DESC);
CREATE INDEX idx_scan_loc_region ON scan_location_aggregates(region_id);
CREATE INDEX idx_scan_loc_grid ON scan_location_aggregates(grid_lat, grid_lng);
CREATE INDEX idx_scan_loc_city ON scan_location_aggregates(city) WHERE city IS NOT NULL;

-- =============================================================================
-- REGIONAL SCAN SUMMARIES (DAILY ROLLUP)
-- =============================================================================
-- Pre-aggregated daily summaries by region for fast dashboard queries

CREATE TABLE IF NOT EXISTS scan_region_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES geo_regions(id),
    
    -- Date (UTC)
    scan_date DATE NOT NULL,
    
    -- Aggregated counts
    total_scans INTEGER NOT NULL DEFAULT 0,
    unique_sessions INTEGER NOT NULL DEFAULT 0,
    
    -- Peak hour (0-23)
    peak_hour INTEGER,
    peak_hour_scans INTEGER,
    
    -- Day comparison
    scans_vs_prev_day NUMERIC(5,2),  -- Percentage change
    scans_vs_prev_week NUMERIC(5,2),
    
    -- Top cities in this region (top 5)
    top_cities JSONB DEFAULT '[]',  -- [{"city": "Москва", "count": 150}, ...]
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_region_daily UNIQUE (organization_id, product_id, region_id, scan_date)
);

CREATE INDEX idx_region_daily_org ON scan_region_daily(organization_id);
CREATE INDEX idx_region_daily_date ON scan_region_daily(scan_date DESC);
CREATE INDEX idx_region_daily_region ON scan_region_daily(region_id);

-- =============================================================================
-- STORE-LEVEL ATTRIBUTION (OPTIONAL)
-- =============================================================================
-- If producers have stores registered, we can attribute scans to specific stores

CREATE TABLE IF NOT EXISTS store_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Store info
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    region_id UUID REFERENCES geo_regions(id),
    
    -- Exact location (for attribution)
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    
    -- Attribution radius (meters) - scans within this radius attributed to store
    attribution_radius_m INTEGER DEFAULT 100,
    
    -- Store type
    store_type TEXT DEFAULT 'retail' CHECK (store_type IN ('retail', 'wholesale', 'warehouse', 'popup', 'partner', 'other')),
    
    -- Active status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_loc_org ON store_locations(organization_id);
CREATE INDEX idx_store_loc_coords ON store_locations(latitude, longitude);
CREATE INDEX idx_store_loc_active ON store_locations(is_active) WHERE is_active = true;

-- =============================================================================
-- STORE SCAN ATTRIBUTION
-- =============================================================================
-- Aggregated scans attributed to specific stores

CREATE TABLE IF NOT EXISTS store_scan_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES store_locations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- Time bucket (daily for stores)
    scan_date DATE NOT NULL,
    
    -- Metrics
    scan_count INTEGER NOT NULL DEFAULT 0,
    unique_sessions INTEGER NOT NULL DEFAULT 0,
    
    -- Time distribution
    peak_hour INTEGER,
    hourly_distribution JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_store_daily UNIQUE (store_id, product_id, scan_date)
);

CREATE INDEX idx_store_scan_org ON store_scan_aggregates(organization_id);
CREATE INDEX idx_store_scan_store ON store_scan_aggregates(store_id);
CREATE INDEX idx_store_scan_date ON store_scan_aggregates(scan_date DESC);

-- =============================================================================
-- HEATMAP CACHE (FOR FAST MAP RENDERING)
-- =============================================================================
-- Pre-computed heatmap data points for various zoom levels

CREATE TABLE IF NOT EXISTS heatmap_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- Cache parameters
    zoom_level INTEGER NOT NULL CHECK (zoom_level BETWEEN 3 AND 18),
    time_range TEXT NOT NULL CHECK (time_range IN ('7d', '30d', '90d', '1y', 'all')),
    
    -- Computed heatmap points
    -- Format: [{"lat": 55.75, "lng": 37.61, "weight": 150}, ...]
    points JSONB NOT NULL DEFAULT '[]',
    point_count INTEGER NOT NULL DEFAULT 0,
    max_weight INTEGER NOT NULL DEFAULT 0,
    
    -- Cache metadata
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
    
    CONSTRAINT unique_heatmap_cache UNIQUE (organization_id, product_id, zoom_level, time_range)
);

CREATE INDEX idx_heatmap_org ON heatmap_cache(organization_id);
CREATE INDEX idx_heatmap_expires ON heatmap_cache(expires_at);

-- =============================================================================
-- COMPETITOR GEOGRAPHIC COMPARISON (ANONYMIZED)
-- =============================================================================
-- Aggregated industry-level benchmarks by region (no competitor identification)

CREATE TABLE IF NOT EXISTS industry_region_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Industry/category
    industry_category TEXT NOT NULL,  -- e.g., 'food_dairy', 'cosmetics'
    
    -- Region
    region_id UUID NOT NULL REFERENCES geo_regions(id),
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Anonymized benchmarks (percentiles, not individual data)
    avg_scans_per_producer INTEGER,
    median_scans_per_producer INTEGER,
    p25_scans INTEGER,  -- 25th percentile
    p75_scans INTEGER,  -- 75th percentile
    p90_scans INTEGER,  -- 90th percentile
    
    -- Total producers in this category/region (for context)
    producer_count INTEGER,
    
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_industry_region_period UNIQUE (industry_category, region_id, period_start, period_end)
);

CREATE INDEX idx_industry_bench_cat ON industry_region_benchmarks(industry_category);
CREATE INDEX idx_industry_bench_region ON industry_region_benchmarks(region_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE geo_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_location_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_region_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_scan_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE heatmap_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_region_benchmarks ENABLE ROW LEVEL SECURITY;

-- Geo regions: Public read
CREATE POLICY "Anyone can view geo regions"
    ON geo_regions FOR SELECT
    USING (true);

-- Location aggregates: Org members only
CREATE POLICY "Org members view location aggregates"
    ON scan_location_aggregates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = scan_location_aggregates.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role manages location aggregates"
    ON scan_location_aggregates FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Region daily: Org members only
CREATE POLICY "Org members view region daily"
    ON scan_region_daily FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = scan_region_daily.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role manages region daily"
    ON scan_region_daily FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Store locations: Org members can view, admins can manage
CREATE POLICY "Org members view stores"
    ON store_locations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = store_locations.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage stores"
    ON store_locations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = store_locations.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- Store scan aggregates: Org members only
CREATE POLICY "Org members view store scans"
    ON store_scan_aggregates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = store_scan_aggregates.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role manages store scans"
    ON store_scan_aggregates FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Heatmap cache: Org members only
CREATE POLICY "Org members view heatmap cache"
    ON heatmap_cache FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = heatmap_cache.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role manages heatmap cache"
    ON heatmap_cache FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Industry benchmarks: Public read (anonymized data)
CREATE POLICY "Anyone can view industry benchmarks"
    ON industry_region_benchmarks FOR SELECT
    USING (true);

CREATE POLICY "Service role manages industry benchmarks"
    ON industry_region_benchmarks FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to record a scan with location (called from backend)
-- This function aggregates data - no individual tracking!
CREATE OR REPLACE FUNCTION record_scan_location(
    p_organization_id UUID,
    p_product_id UUID,
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_device_type TEXT DEFAULT 'unknown',
    p_session_hash TEXT DEFAULT NULL  -- Hashed session ID for unique counting
)
RETURNS void AS $$
DECLARE
    v_grid_lat NUMERIC(6,2);
    v_grid_lng NUMERIC(6,2);
    v_time_bucket TIMESTAMPTZ;
    v_hour INTEGER;
    v_region_id UUID;
    v_hourly_key TEXT;
BEGIN
    -- Round coordinates to grid (privacy: ~1km precision)
    v_grid_lat := ROUND(p_latitude::numeric, 2);
    v_grid_lng := ROUND(p_longitude::numeric, 2);
    
    -- Truncate time to hour (privacy: no exact timestamps)
    v_time_bucket := date_trunc('hour', now());
    v_hour := EXTRACT(HOUR FROM now())::INTEGER;
    v_hourly_key := v_hour::TEXT;
    
    -- Find region (simple bounding box check for major cities)
    SELECT id INTO v_region_id
    FROM geo_regions
    WHERE ABS(center_lat - p_latitude) < 2  -- ~200km radius
      AND ABS(center_lng - p_longitude) < 3
    ORDER BY 
        (center_lat - p_latitude)^2 + (center_lng - p_longitude)^2
    LIMIT 1;
    
    -- Default to unknown region
    IF v_region_id IS NULL THEN
        SELECT id INTO v_region_id FROM geo_regions WHERE code = 'RU-UNKNOWN';
    END IF;
    
    -- Upsert aggregate record
    INSERT INTO scan_location_aggregates (
        organization_id, product_id, time_bucket,
        grid_lat, grid_lng, region_id,
        scan_count, unique_sessions,
        hourly_distribution,
        device_mobile_count, device_desktop_count, device_tablet_count
    )
    VALUES (
        p_organization_id, p_product_id, v_time_bucket,
        v_grid_lat, v_grid_lng, v_region_id,
        1,
        CASE WHEN p_session_hash IS NOT NULL THEN 1 ELSE 0 END,
        jsonb_build_object(v_hourly_key, 1),
        CASE WHEN p_device_type = 'mobile' THEN 1 ELSE 0 END,
        CASE WHEN p_device_type = 'desktop' THEN 1 ELSE 0 END,
        CASE WHEN p_device_type = 'tablet' THEN 1 ELSE 0 END
    )
    ON CONFLICT (organization_id, product_id, time_bucket, grid_lat, grid_lng)
    DO UPDATE SET
        scan_count = scan_location_aggregates.scan_count + 1,
        unique_sessions = scan_location_aggregates.unique_sessions + 
            CASE WHEN p_session_hash IS NOT NULL THEN 1 ELSE 0 END,
        hourly_distribution = scan_location_aggregates.hourly_distribution || 
            jsonb_build_object(
                v_hourly_key, 
                COALESCE((scan_location_aggregates.hourly_distribution ->> v_hourly_key)::INTEGER, 0) + 1
            ),
        device_mobile_count = scan_location_aggregates.device_mobile_count + 
            CASE WHEN p_device_type = 'mobile' THEN 1 ELSE 0 END,
        device_desktop_count = scan_location_aggregates.device_desktop_count + 
            CASE WHEN p_device_type = 'desktop' THEN 1 ELSE 0 END,
        device_tablet_count = scan_location_aggregates.device_tablet_count + 
            CASE WHEN p_device_type = 'tablet' THEN 1 ELSE 0 END,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get heatmap data for a time range
CREATE OR REPLACE FUNCTION get_heatmap_data(
    p_organization_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30,
    p_min_zoom INTEGER DEFAULT 5
)
RETURNS TABLE (
    lat NUMERIC,
    lng NUMERIC,
    weight INTEGER,
    city TEXT,
    region_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sla.grid_lat AS lat,
        sla.grid_lng AS lng,
        SUM(sla.scan_count)::INTEGER AS weight,
        sla.city,
        gr.name AS region_name
    FROM scan_location_aggregates sla
    LEFT JOIN geo_regions gr ON gr.id = sla.region_id
    WHERE sla.organization_id = p_organization_id
      AND (p_product_id IS NULL OR sla.product_id = p_product_id)
      AND sla.time_bucket >= now() - (p_days || ' days')::INTERVAL
    GROUP BY sla.grid_lat, sla.grid_lng, sla.city, gr.name
    HAVING SUM(sla.scan_count) > 0
    ORDER BY weight DESC
    LIMIT 10000;  -- Limit for performance
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get regional breakdown
CREATE OR REPLACE FUNCTION get_scan_regions_breakdown(
    p_organization_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    region_code TEXT,
    region_name TEXT,
    federal_district TEXT,
    total_scans BIGINT,
    unique_sessions BIGINT,
    top_city TEXT,
    percent_of_total NUMERIC
) AS $$
DECLARE
    v_total_scans BIGINT;
BEGIN
    -- Get total scans for percentage calculation
    SELECT COALESCE(SUM(sla.scan_count), 0) INTO v_total_scans
    FROM scan_location_aggregates sla
    WHERE sla.organization_id = p_organization_id
      AND (p_product_id IS NULL OR sla.product_id = p_product_id)
      AND sla.time_bucket >= now() - (p_days || ' days')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        gr.code AS region_code,
        gr.name AS region_name,
        gr.federal_district,
        SUM(sla.scan_count)::BIGINT AS total_scans,
        SUM(sla.unique_sessions)::BIGINT AS unique_sessions,
        (
            SELECT sla2.city 
            FROM scan_location_aggregates sla2 
            WHERE sla2.region_id = gr.id 
              AND sla2.organization_id = p_organization_id
              AND (p_product_id IS NULL OR sla2.product_id = p_product_id)
              AND sla2.time_bucket >= now() - (p_days || ' days')::INTERVAL
              AND sla2.city IS NOT NULL
            GROUP BY sla2.city
            ORDER BY SUM(sla2.scan_count) DESC
            LIMIT 1
        ) AS top_city,
        CASE 
            WHEN v_total_scans > 0 THEN 
                ROUND((SUM(sla.scan_count)::NUMERIC / v_total_scans * 100), 1)
            ELSE 0
        END AS percent_of_total
    FROM geo_regions gr
    LEFT JOIN scan_location_aggregates sla 
        ON sla.region_id = gr.id 
        AND sla.organization_id = p_organization_id
        AND (p_product_id IS NULL OR sla.product_id = p_product_id)
        AND sla.time_bucket >= now() - (p_days || ' days')::INTERVAL
    GROUP BY gr.id, gr.code, gr.name, gr.federal_district
    HAVING SUM(sla.scan_count) > 0
    ORDER BY total_scans DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get time-of-day patterns
CREATE OR REPLACE FUNCTION get_scan_time_patterns(
    p_organization_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    hour_of_day INTEGER,
    total_scans BIGINT,
    avg_scans_per_day NUMERIC,
    percent_of_total NUMERIC
) AS $$
DECLARE
    v_total_scans BIGINT;
    v_day_count INTEGER;
BEGIN
    -- Get total scans and day count
    SELECT 
        COALESCE(SUM(sla.scan_count), 0),
        GREATEST(1, p_days)
    INTO v_total_scans, v_day_count
    FROM scan_location_aggregates sla
    WHERE sla.organization_id = p_organization_id
      AND (p_product_id IS NULL OR sla.product_id = p_product_id)
      AND sla.time_bucket >= now() - (p_days || ' days')::INTERVAL;
    
    RETURN QUERY
    WITH hourly_data AS (
        SELECT 
            h.hour,
            COALESCE(SUM(
                (sla.hourly_distribution ->> h.hour::TEXT)::INTEGER
            ), 0) AS scans
        FROM generate_series(0, 23) AS h(hour)
        LEFT JOIN scan_location_aggregates sla 
            ON sla.organization_id = p_organization_id
            AND (p_product_id IS NULL OR sla.product_id = p_product_id)
            AND sla.time_bucket >= now() - (p_days || ' days')::INTERVAL
        GROUP BY h.hour
    )
    SELECT 
        hd.hour AS hour_of_day,
        hd.scans AS total_scans,
        ROUND(hd.scans::NUMERIC / v_day_count, 1) AS avg_scans_per_day,
        CASE 
            WHEN v_total_scans > 0 THEN 
                ROUND((hd.scans::NUMERIC / v_total_scans * 100), 1)
            ELSE 0
        END AS percent_of_total
    FROM hourly_data hd
    ORDER BY hd.hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE scan_location_aggregates IS 'Privacy-respecting aggregated scan location data. Grid precision ~1km, time precision 1 hour.';
COMMENT ON TABLE scan_region_daily IS 'Daily rollup of scan data by region for fast dashboard queries.';
COMMENT ON TABLE store_locations IS 'Producer store locations for scan attribution.';
COMMENT ON TABLE heatmap_cache IS 'Pre-computed heatmap data for fast map rendering.';
COMMENT ON FUNCTION record_scan_location IS 'Records a scan location with privacy-preserving aggregation.';
