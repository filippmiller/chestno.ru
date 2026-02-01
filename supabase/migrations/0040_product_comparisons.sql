-- Migration 0040: Product Comparison System
-- Date: 2026-02-01
-- Description: Side-by-side supply chain comparison for consumers

BEGIN;

-- =============================================================================
-- PRODUCT ATTRIBUTES (for similarity matching)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_attributes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

    -- Product characteristics for matching
    primary_category text NOT NULL,            -- e.g., 'dairy', 'meat', 'produce'
    subcategory text,                          -- e.g., 'cheese', 'beef', 'tomatoes'
    product_type text,                         -- e.g., 'cheddar', 'ground', 'cherry'

    -- Physical attributes
    weight_grams integer,                      -- Standard weight for comparison
    volume_ml integer,                         -- For liquids
    unit_count integer,                        -- For packaged items (e.g., 12-pack)

    -- Quality indicators
    organic boolean NOT NULL DEFAULT false,
    local_sourced boolean NOT NULL DEFAULT false,
    handmade boolean NOT NULL DEFAULT false,
    seasonal boolean NOT NULL DEFAULT false,

    -- Dietary classifications
    vegan boolean NOT NULL DEFAULT false,
    vegetarian boolean NOT NULL DEFAULT false,
    gluten_free boolean NOT NULL DEFAULT false,
    lactose_free boolean NOT NULL DEFAULT false,
    halal boolean NOT NULL DEFAULT false,
    kosher boolean NOT NULL DEFAULT false,

    -- Origin
    origin_country text DEFAULT 'RU',
    origin_region text,                        -- e.g., 'Краснодарский край'

    -- For similarity scoring
    attribute_vector jsonb,                    -- Computed attribute vector for ML matching

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT unique_product_attrs UNIQUE (product_id)
);

-- Index for similarity queries
CREATE INDEX idx_product_attrs_category ON public.product_attributes(primary_category, subcategory);
CREATE INDEX idx_product_attrs_type ON public.product_attributes(product_type) WHERE product_type IS NOT NULL;
CREATE INDEX idx_product_attrs_organic ON public.product_attributes(organic) WHERE organic = true;
CREATE INDEX idx_product_attrs_local ON public.product_attributes(local_sourced) WHERE local_sourced = true;

-- =============================================================================
-- TRANSPARENCY SCORES (computed metrics)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_transparency_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

    -- Journey completeness (0-100)
    journey_completeness_score integer NOT NULL DEFAULT 0
        CHECK (journey_completeness_score BETWEEN 0 AND 100),
    journey_steps_count integer NOT NULL DEFAULT 0,
    journey_verified_steps integer NOT NULL DEFAULT 0,

    -- Certification coverage (0-100)
    certification_score integer NOT NULL DEFAULT 0
        CHECK (certification_score BETWEEN 0 AND 100),
    certifications_count integer NOT NULL DEFAULT 0,
    verified_certifications integer NOT NULL DEFAULT 0,

    -- Transit metrics
    total_transit_days integer,                -- Total estimated days from source to shelf
    storage_conditions_tracked boolean NOT NULL DEFAULT false,
    cold_chain_verified boolean NOT NULL DEFAULT false,

    -- Source traceability (0-100)
    traceability_score integer NOT NULL DEFAULT 0
        CHECK (traceability_score BETWEEN 0 AND 100),
    origin_verified boolean NOT NULL DEFAULT false,
    supplier_disclosed boolean NOT NULL DEFAULT false,

    -- Media/documentation (0-100)
    documentation_score integer NOT NULL DEFAULT 0
        CHECK (documentation_score BETWEEN 0 AND 100),
    has_photos boolean NOT NULL DEFAULT false,
    has_videos boolean NOT NULL DEFAULT false,
    has_certificates boolean NOT NULL DEFAULT false,

    -- Overall composite score (0-100)
    overall_transparency_score integer NOT NULL DEFAULT 0
        CHECK (overall_transparency_score BETWEEN 0 AND 100),

    -- Price quality metrics
    price_per_100g integer,                    -- Price in kopeks per 100g/ml
    quality_price_ratio numeric(5,2),          -- Higher = better value

    -- Computed at
    computed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT unique_transparency_score UNIQUE (product_id)
);

CREATE INDEX idx_transparency_overall ON public.product_transparency_scores(overall_transparency_score DESC);
CREATE INDEX idx_transparency_journey ON public.product_transparency_scores(journey_completeness_score DESC);
CREATE INDEX idx_transparency_cert ON public.product_transparency_scores(certification_score DESC);
CREATE INDEX idx_transparency_price_quality ON public.product_transparency_scores(quality_price_ratio DESC NULLS LAST);

-- =============================================================================
-- SAVED COMPARISONS (user-created)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_comparisons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Comparison metadata
    slug text NOT NULL UNIQUE,                 -- URL-friendly identifier
    title text NOT NULL,                       -- e.g., "Органический сыр: сравнение"
    description text,                          -- For SEO

    -- Products being compared (2-4 products)
    product_ids uuid[] NOT NULL
        CHECK (array_length(product_ids, 1) BETWEEN 2 AND 4),

    -- Creator
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public boolean NOT NULL DEFAULT false,
    is_featured boolean NOT NULL DEFAULT false,

    -- Stats
    view_count integer NOT NULL DEFAULT 0,

    -- SEO metadata
    meta_title text,
    meta_description text,
    canonical_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comparisons_slug ON public.product_comparisons(slug);
CREATE INDEX idx_comparisons_public ON public.product_comparisons(is_public, is_featured) WHERE is_public = true;
CREATE INDEX idx_comparisons_products ON public.product_comparisons USING GIN(product_ids);
CREATE INDEX idx_comparisons_views ON public.product_comparisons(view_count DESC) WHERE is_public = true;

-- =============================================================================
-- COMPARISON VIEWS LOG (for analytics)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.comparison_view_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_id uuid REFERENCES public.product_comparisons(id) ON DELETE CASCADE,

    -- View context
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id text,
    ip_hash text,                              -- Hashed for privacy
    user_agent text,
    referrer text,

    -- Outcome tracking
    clicked_product_id uuid,                   -- Which product did they click?
    clicked_at timestamptz,

    viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comparison_views_comparison ON public.comparison_view_logs(comparison_id, viewed_at DESC);
CREATE INDEX idx_comparison_views_outcome ON public.comparison_view_logs(clicked_product_id) WHERE clicked_product_id IS NOT NULL;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Find similar products for comparison
CREATE OR REPLACE FUNCTION public.find_similar_products(
    p_product_id uuid,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    organization_name text,
    similarity_score numeric,
    transparency_score integer,
    price_cents integer
)
LANGUAGE sql
STABLE
AS $$
    WITH target_product AS (
        SELECT
            pa.primary_category,
            pa.subcategory,
            pa.product_type,
            pa.organic,
            pa.local_sourced,
            p.organization_id
        FROM public.product_attributes pa
        JOIN public.products p ON p.id = pa.product_id
        WHERE pa.product_id = p_product_id
    )
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        o.name AS organization_name,
        -- Similarity scoring
        (
            CASE WHEN pa.primary_category = tp.primary_category THEN 30 ELSE 0 END +
            CASE WHEN pa.subcategory = tp.subcategory THEN 25 ELSE 0 END +
            CASE WHEN pa.product_type = tp.product_type THEN 20 ELSE 0 END +
            CASE WHEN pa.organic = tp.organic THEN 10 ELSE 0 END +
            CASE WHEN pa.local_sourced = tp.local_sourced THEN 5 ELSE 0 END +
            -- Bonus for different org (more interesting comparison)
            CASE WHEN p.organization_id != tp.organization_id THEN 10 ELSE 0 END
        )::numeric AS similarity_score,
        COALESCE(pts.overall_transparency_score, 0) AS transparency_score,
        p.price_cents
    FROM public.products p
    JOIN public.product_attributes pa ON pa.product_id = p.id
    LEFT JOIN public.product_transparency_scores pts ON pts.product_id = p.id
    JOIN public.organizations o ON o.id = p.organization_id
    CROSS JOIN target_product tp
    WHERE
        p.id != p_product_id
        AND p.status = 'published'
        AND pa.primary_category = tp.primary_category
    ORDER BY similarity_score DESC, transparency_score DESC
    LIMIT p_limit;
$$;

-- Compute transparency score for a product
CREATE OR REPLACE FUNCTION public.compute_transparency_score(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_journey_steps integer;
    v_verified_steps integer;
    v_journey_score integer;
    v_certs_count integer;
    v_verified_certs integer;
    v_cert_score integer;
    v_has_photos boolean;
    v_has_videos boolean;
    v_has_certs boolean;
    v_doc_score integer;
    v_origin_verified boolean;
    v_trace_score integer;
    v_overall integer;
    v_price_cents integer;
    v_weight_grams integer;
    v_price_per_100g integer;
BEGIN
    -- Count journey steps
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE is_verified = true)
    INTO v_journey_steps, v_verified_steps
    FROM public.product_journey_steps
    WHERE product_id = p_product_id;

    -- Journey completeness score (0-100)
    -- Ideal: 5+ steps with >80% verified
    v_journey_score := LEAST(100, (
        (LEAST(v_journey_steps, 5) * 12) +  -- Up to 60 points for steps
        (CASE WHEN v_journey_steps > 0
            THEN (v_verified_steps::numeric / v_journey_steps * 40)::integer
            ELSE 0 END)                       -- Up to 40 points for verification
    ));

    -- Count certifications
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE verification_status IN ('verified', 'auto_verified'))
    INTO v_certs_count, v_verified_certs
    FROM public.product_certifications pc
    JOIN public.producer_certifications cert ON cert.id = pc.certification_id
    WHERE pc.product_id = p_product_id;

    -- Certification score (0-100)
    v_cert_score := LEAST(100, (
        (LEAST(v_certs_count, 3) * 20) +      -- Up to 60 points for having certs
        (CASE WHEN v_certs_count > 0
            THEN (v_verified_certs::numeric / v_certs_count * 40)::integer
            ELSE 0 END)                        -- Up to 40 points for verification
    ));

    -- Check media presence
    SELECT
        EXISTS (SELECT 1 FROM public.product_journey_steps pjs
                WHERE pjs.product_id = p_product_id
                AND jsonb_array_length(COALESCE(media_urls, '[]'::jsonb)) > 0
                AND EXISTS (SELECT 1 FROM jsonb_array_elements(media_urls) m WHERE m->>'type' = 'image')),
        EXISTS (SELECT 1 FROM public.product_journey_steps pjs
                WHERE pjs.product_id = p_product_id
                AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(media_urls, '[]'::jsonb)) m WHERE m->>'type' = 'video')),
        EXISTS (SELECT 1 FROM public.product_journey_steps pjs
                WHERE pjs.product_id = p_product_id
                AND jsonb_array_length(COALESCE(certificate_urls, '[]'::jsonb)) > 0)
    INTO v_has_photos, v_has_videos, v_has_certs;

    -- Documentation score (0-100)
    v_doc_score := (
        CASE WHEN v_has_photos THEN 40 ELSE 0 END +
        CASE WHEN v_has_videos THEN 30 ELSE 0 END +
        CASE WHEN v_has_certs THEN 30 ELSE 0 END
    );

    -- Traceability score
    SELECT
        EXISTS (SELECT 1 FROM public.product_journey_steps pjs
                WHERE pjs.product_id = p_product_id
                AND step_type = 'sourcing'
                AND is_verified = true)
    INTO v_origin_verified;

    v_trace_score := (
        CASE WHEN v_journey_steps > 0 THEN 40 ELSE 0 END +
        CASE WHEN v_origin_verified THEN 30 ELSE 0 END +
        CASE WHEN v_verified_steps >= 2 THEN 30 ELSE 0 END
    );

    -- Overall composite score (weighted average)
    v_overall := (
        v_journey_score * 0.30 +
        v_cert_score * 0.25 +
        v_trace_score * 0.25 +
        v_doc_score * 0.20
    )::integer;

    -- Price per 100g calculation
    SELECT price_cents INTO v_price_cents FROM public.products WHERE id = p_product_id;
    SELECT weight_grams INTO v_weight_grams FROM public.product_attributes WHERE product_id = p_product_id;

    IF v_price_cents IS NOT NULL AND v_weight_grams IS NOT NULL AND v_weight_grams > 0 THEN
        v_price_per_100g := (v_price_cents::numeric / v_weight_grams * 100)::integer;
    END IF;

    -- Upsert transparency score
    INSERT INTO public.product_transparency_scores (
        product_id,
        journey_completeness_score,
        journey_steps_count,
        journey_verified_steps,
        certification_score,
        certifications_count,
        verified_certifications,
        traceability_score,
        origin_verified,
        documentation_score,
        has_photos,
        has_videos,
        has_certificates,
        overall_transparency_score,
        price_per_100g,
        quality_price_ratio,
        computed_at
    )
    VALUES (
        p_product_id,
        v_journey_score,
        v_journey_steps,
        v_verified_steps,
        v_cert_score,
        v_certs_count,
        v_verified_certs,
        v_trace_score,
        v_origin_verified,
        v_doc_score,
        v_has_photos,
        v_has_videos,
        v_has_certs,
        v_overall,
        v_price_per_100g,
        CASE WHEN v_price_per_100g > 0
            THEN (v_overall::numeric / (v_price_per_100g::numeric / 100))
            ELSE NULL END,
        now()
    )
    ON CONFLICT (product_id) DO UPDATE SET
        journey_completeness_score = EXCLUDED.journey_completeness_score,
        journey_steps_count = EXCLUDED.journey_steps_count,
        journey_verified_steps = EXCLUDED.journey_verified_steps,
        certification_score = EXCLUDED.certification_score,
        certifications_count = EXCLUDED.certifications_count,
        verified_certifications = EXCLUDED.verified_certifications,
        traceability_score = EXCLUDED.traceability_score,
        origin_verified = EXCLUDED.origin_verified,
        documentation_score = EXCLUDED.documentation_score,
        has_photos = EXCLUDED.has_photos,
        has_videos = EXCLUDED.has_videos,
        has_certificates = EXCLUDED.has_certificates,
        overall_transparency_score = EXCLUDED.overall_transparency_score,
        price_per_100g = EXCLUDED.price_per_100g,
        quality_price_ratio = EXCLUDED.quality_price_ratio,
        computed_at = now();
END;
$$;

-- Get comparison data for multiple products
CREATE OR REPLACE FUNCTION public.get_comparison_data(p_product_ids uuid[])
RETURNS TABLE (
    product_id uuid,
    product_name text,
    product_slug text,
    organization_name text,
    main_image_url text,
    price_cents integer,
    -- Transparency scores
    overall_score integer,
    journey_score integer,
    certification_score integer,
    traceability_score integer,
    documentation_score integer,
    -- Journey details
    journey_steps_count integer,
    verified_steps_count integer,
    -- Certification details
    certifications_count integer,
    verified_certifications integer,
    -- Price metrics
    price_per_100g integer,
    quality_price_ratio numeric,
    -- Attributes
    organic boolean,
    local_sourced boolean,
    origin_region text
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.slug AS product_slug,
        o.name AS organization_name,
        p.main_image_url,
        p.price_cents,
        -- Transparency scores
        COALESCE(pts.overall_transparency_score, 0) AS overall_score,
        COALESCE(pts.journey_completeness_score, 0) AS journey_score,
        COALESCE(pts.certification_score, 0) AS certification_score,
        COALESCE(pts.traceability_score, 0) AS traceability_score,
        COALESCE(pts.documentation_score, 0) AS documentation_score,
        -- Journey details
        COALESCE(pts.journey_steps_count, 0) AS journey_steps_count,
        COALESCE(pts.journey_verified_steps, 0) AS verified_steps_count,
        -- Certification details
        COALESCE(pts.certifications_count, 0) AS certifications_count,
        COALESCE(pts.verified_certifications, 0) AS verified_certifications,
        -- Price metrics
        pts.price_per_100g,
        pts.quality_price_ratio,
        -- Attributes
        COALESCE(pa.organic, false) AS organic,
        COALESCE(pa.local_sourced, false) AS local_sourced,
        pa.origin_region
    FROM public.products p
    JOIN public.organizations o ON o.id = p.organization_id
    LEFT JOIN public.product_transparency_scores pts ON pts.product_id = p.id
    LEFT JOIN public.product_attributes pa ON pa.product_id = p.id
    WHERE p.id = ANY(p_product_ids)
    AND p.status = 'published';
$$;

-- Recommend best product from comparison
CREATE OR REPLACE FUNCTION public.recommend_best_product(
    p_product_ids uuid[],
    p_priority text DEFAULT 'balanced' -- 'balanced', 'transparency', 'value', 'certification'
)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    recommendation_score numeric,
    recommendation_reason text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH scored_products AS (
        SELECT
            p.id,
            p.name,
            pts.overall_transparency_score,
            pts.journey_completeness_score,
            pts.certification_score,
            pts.quality_price_ratio,
            CASE p_priority
                WHEN 'transparency' THEN
                    pts.overall_transparency_score::numeric * 1.0
                WHEN 'value' THEN
                    COALESCE(pts.quality_price_ratio, 0) * 10 +
                    pts.overall_transparency_score::numeric * 0.3
                WHEN 'certification' THEN
                    pts.certification_score::numeric * 0.6 +
                    pts.overall_transparency_score::numeric * 0.4
                ELSE -- balanced
                    pts.overall_transparency_score::numeric * 0.4 +
                    pts.certification_score::numeric * 0.3 +
                    pts.journey_completeness_score::numeric * 0.2 +
                    COALESCE(pts.quality_price_ratio, 0) * 1.0
            END AS score
        FROM public.products p
        LEFT JOIN public.product_transparency_scores pts ON pts.product_id = p.id
        WHERE p.id = ANY(p_product_ids)
        AND p.status = 'published'
    )
    SELECT
        sp.id AS product_id,
        sp.name AS product_name,
        ROUND(sp.score, 2) AS recommendation_score,
        CASE
            WHEN p_priority = 'transparency' AND sp.overall_transparency_score >= 80
                THEN 'Наивысшая прозрачность цепочки поставок'
            WHEN p_priority = 'value' AND sp.quality_price_ratio >= 1
                THEN 'Лучшее соотношение цена/качество'
            WHEN p_priority = 'certification' AND sp.certification_score >= 80
                THEN 'Наибольшее количество подтвержденных сертификатов'
            WHEN sp.overall_transparency_score >= 70
                THEN 'Высокий общий показатель прозрачности'
            ELSE 'Рекомендуется для сравнения'
        END AS recommendation_reason
    FROM scored_products sp
    ORDER BY sp.score DESC
    LIMIT 1;
END;
$$;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_transparency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_view_logs ENABLE ROW LEVEL SECURITY;

-- Product attributes: Public read for published products
DROP POLICY IF EXISTS "Public view product attributes" ON public.product_attributes;
CREATE POLICY "Public view product attributes"
ON public.product_attributes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_attributes.product_id
        AND p.status = 'published'
    )
);

-- Org editors can manage
DROP POLICY IF EXISTS "Org editors manage attributes" ON public.product_attributes;
CREATE POLICY "Org editors manage attributes"
ON public.product_attributes FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = product_attributes.product_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'editor')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = product_attributes.product_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'editor')
    )
);

-- Transparency scores: Public read
DROP POLICY IF EXISTS "Public view transparency scores" ON public.product_transparency_scores;
CREATE POLICY "Public view transparency scores"
ON public.product_transparency_scores FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_transparency_scores.product_id
        AND p.status = 'published'
    )
);

-- Service role can compute scores
DROP POLICY IF EXISTS "Service manages transparency scores" ON public.product_transparency_scores;
CREATE POLICY "Service manages transparency scores"
ON public.product_transparency_scores FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Comparisons: Public read for public comparisons
DROP POLICY IF EXISTS "Public view public comparisons" ON public.product_comparisons;
CREATE POLICY "Public view public comparisons"
ON public.product_comparisons FOR SELECT
USING (is_public = true);

-- Users can view their own comparisons
DROP POLICY IF EXISTS "Users view own comparisons" ON public.product_comparisons;
CREATE POLICY "Users view own comparisons"
ON public.product_comparisons FOR SELECT
USING (created_by = auth.uid());

-- Authenticated users can create comparisons
DROP POLICY IF EXISTS "Auth users create comparisons" ON public.product_comparisons;
CREATE POLICY "Auth users create comparisons"
ON public.product_comparisons FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own comparisons
DROP POLICY IF EXISTS "Users update own comparisons" ON public.product_comparisons;
CREATE POLICY "Users update own comparisons"
ON public.product_comparisons FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- View logs: Insert only, service role can read
DROP POLICY IF EXISTS "Anyone can log views" ON public.comparison_view_logs;
CREATE POLICY "Anyone can log views"
ON public.comparison_view_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Service reads view logs" ON public.comparison_view_logs;
CREATE POLICY "Service reads view logs"
ON public.comparison_view_logs FOR SELECT
USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION public.comparison_tables_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_attributes_updated_at ON public.product_attributes;
CREATE TRIGGER product_attributes_updated_at
BEFORE UPDATE ON public.product_attributes
FOR EACH ROW EXECUTE FUNCTION public.comparison_tables_updated_at();

DROP TRIGGER IF EXISTS product_comparisons_updated_at ON public.product_comparisons;
CREATE TRIGGER product_comparisons_updated_at
BEFORE UPDATE ON public.product_comparisons
FOR EACH ROW EXECUTE FUNCTION public.comparison_tables_updated_at();

-- Recompute transparency score when journey steps change
CREATE OR REPLACE FUNCTION public.trigger_recompute_transparency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.compute_transparency_score(
        CASE TG_OP
            WHEN 'DELETE' THEN OLD.product_id
            ELSE NEW.product_id
        END
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS journey_steps_recompute_score ON public.product_journey_steps;
CREATE TRIGGER journey_steps_recompute_score
AFTER INSERT OR UPDATE OR DELETE ON public.product_journey_steps
FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_transparency();

DROP TRIGGER IF EXISTS product_certs_recompute_score ON public.product_certifications;
CREATE TRIGGER product_certs_recompute_score
AFTER INSERT OR UPDATE OR DELETE ON public.product_certifications
FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_transparency();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.product_attributes IS
    'Product characteristics used for similarity matching in comparisons';

COMMENT ON TABLE public.product_transparency_scores IS
    'Computed transparency metrics for products (journey, certs, traceability)';

COMMENT ON TABLE public.product_comparisons IS
    'Saved product comparisons (user-created or featured)';

COMMENT ON FUNCTION public.find_similar_products IS
    'Find products similar to a given product for comparison suggestions';

COMMENT ON FUNCTION public.compute_transparency_score IS
    'Compute and store transparency metrics for a product';

COMMENT ON FUNCTION public.get_comparison_data IS
    'Get detailed comparison data for multiple products';

COMMENT ON FUNCTION public.recommend_best_product IS
    'Recommend the best product from a comparison based on priority criteria';

COMMIT;
