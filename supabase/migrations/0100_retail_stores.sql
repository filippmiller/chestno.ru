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
