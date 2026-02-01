-- Migration 0040: Better Alternatives Recommendation Engine
-- Date: 2026-02-01
-- Description: Creates tables and functions for recommending more transparent product alternatives

BEGIN;

-- ============================================================
-- TABLE: product_categories
-- ============================================================
-- Normalized category hierarchy for better matching

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_en text,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 4),
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent ON public.product_categories(parent_id);
CREATE INDEX idx_categories_slug ON public.product_categories(slug);

-- ============================================================
-- TABLE: product_transparency_scores
-- ============================================================
-- Pre-calculated transparency scores for products

CREATE TABLE IF NOT EXISTS public.product_transparency_scores (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,

  -- Component scores (0-100)
  journey_completeness_score smallint DEFAULT 0 CHECK (journey_completeness_score BETWEEN 0 AND 100),
  certification_score smallint DEFAULT 0 CHECK (certification_score BETWEEN 0 AND 100),
  claim_verification_score smallint DEFAULT 0 CHECK (claim_verification_score BETWEEN 0 AND 100),
  producer_status_score smallint DEFAULT 0 CHECK (producer_status_score BETWEEN 0 AND 100),
  review_authenticity_score smallint DEFAULT 0 CHECK (review_authenticity_score BETWEEN 0 AND 100),

  -- Aggregated total score (weighted average)
  total_score smallint GENERATED ALWAYS AS (
    ROUND(
      (journey_completeness_score * 0.25 +
       certification_score * 0.20 +
       claim_verification_score * 0.20 +
       producer_status_score * 0.20 +
       review_authenticity_score * 0.15)
    )
  ) STORED,

  -- Transparency tier
  transparency_tier text GENERATED ALWAYS AS (
    CASE
      WHEN (journey_completeness_score * 0.25 + certification_score * 0.20 +
            claim_verification_score * 0.20 + producer_status_score * 0.20 +
            review_authenticity_score * 0.15) >= 80 THEN 'excellent'
      WHEN (journey_completeness_score * 0.25 + certification_score * 0.20 +
            claim_verification_score * 0.20 + producer_status_score * 0.20 +
            review_authenticity_score * 0.15) >= 60 THEN 'good'
      WHEN (journey_completeness_score * 0.25 + certification_score * 0.20 +
            claim_verification_score * 0.20 + producer_status_score * 0.20 +
            review_authenticity_score * 0.15) >= 40 THEN 'fair'
      ELSE 'low'
    END
  ) STORED,

  -- Metadata
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  calculation_version smallint NOT NULL DEFAULT 1
);

-- CREATE INDEX idx_transparency_total ON public.product_transparency_scores(total_score DESC);
-- Note: Using overall_transparency_score instead (existing table structure)
-- CREATE INDEX idx_transparency_tier ON public.product_transparency_scores(transparency_tier);
-- Note: Skipped - column doesn't exist in current table structure

-- ============================================================
-- TABLE: product_similarity_cache
-- ============================================================
-- Pre-computed product similarity pairs for fast recommendations

CREATE TABLE IF NOT EXISTS public.product_similarity_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  similar_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Similarity components (0.0-1.0)
  category_similarity float NOT NULL DEFAULT 0,
  price_similarity float NOT NULL DEFAULT 0,
  region_overlap float NOT NULL DEFAULT 0,
  tag_similarity float NOT NULL DEFAULT 0,

  -- Aggregated similarity score
  total_similarity float GENERATED ALWAYS AS (
    category_similarity * 0.40 +
    price_similarity * 0.25 +
    region_overlap * 0.20 +
    tag_similarity * 0.15
  ) STORED,

  -- Cache metadata
  computed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT no_self_similarity CHECK (source_product_id != similar_product_id),
  UNIQUE(source_product_id, similar_product_id)
);

CREATE INDEX idx_similarity_source ON public.product_similarity_cache(source_product_id, total_similarity DESC);
CREATE INDEX idx_similarity_computed ON public.product_similarity_cache(computed_at);

-- ============================================================
-- TABLE: sponsored_alternatives
-- ============================================================
-- Paid placements for "better alternatives" (clearly labeled)

CREATE TABLE IF NOT EXISTS public.sponsored_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target: which products this sponsored item can appear alongside
  target_category text,
  target_price_min integer,
  target_price_max integer,
  target_regions text[],

  -- Sponsored product
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Campaign details
  campaign_name text NOT NULL,
  priority smallint NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 10),
  budget_cents integer NOT NULL DEFAULT 0,
  spent_cents integer NOT NULL DEFAULT 0,
  cost_per_impression_cents integer NOT NULL DEFAULT 10,
  cost_per_click_cents integer NOT NULL DEFAULT 100,

  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'depleted', 'ended')),

  -- Validity period
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,

  -- Requirements: must meet minimum transparency
  min_transparency_score smallint NOT NULL DEFAULT 60,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsored_active ON public.sponsored_alternatives(status, starts_at, ends_at)
  WHERE status = 'active';
CREATE INDEX idx_sponsored_category ON public.sponsored_alternatives(target_category)
  WHERE status = 'active';
CREATE INDEX idx_sponsored_product ON public.sponsored_alternatives(product_id);

-- ============================================================
-- TABLE: recommendation_impressions
-- ============================================================
-- Analytics for A/B testing and effectiveness measurement

CREATE TABLE IF NOT EXISTS public.recommendation_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  source_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  recommended_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- User (nullable for anonymous)
  user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  session_id text,

  -- Recommendation details
  display_position smallint NOT NULL,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsored_id uuid REFERENCES public.sponsored_alternatives(id) ON DELETE SET NULL,
  algorithm_version text NOT NULL DEFAULT 'v1',

  -- A/B test info
  experiment_id text,
  variant text,

  -- Engagement
  was_clicked boolean NOT NULL DEFAULT false,
  clicked_at timestamptz,

  -- Conversion tracking
  led_to_follow boolean NOT NULL DEFAULT false,
  led_to_purchase_intent boolean NOT NULL DEFAULT false,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_impressions_source ON public.recommendation_impressions(source_product_id, created_at DESC);
CREATE INDEX idx_impressions_recommended ON public.recommendation_impressions(recommended_product_id, created_at DESC);
CREATE INDEX idx_impressions_experiment ON public.recommendation_impressions(experiment_id, variant, created_at DESC)
  WHERE experiment_id IS NOT NULL;
CREATE INDEX idx_impressions_clicked ON public.recommendation_impressions(was_clicked, created_at DESC)
  WHERE was_clicked = true;

-- ============================================================
-- TABLE: ab_experiments
-- ============================================================
-- A/B test configuration for recommendations

CREATE TABLE IF NOT EXISTS public.ab_experiments (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,

  -- Variants
  variants jsonb NOT NULL DEFAULT '["control", "treatment"]'::jsonb,
  traffic_allocation jsonb NOT NULL DEFAULT '{"control": 50, "treatment": 50}'::jsonb,

  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),

  -- Duration
  started_at timestamptz,
  ends_at timestamptz,

  -- Target
  targeting_rules jsonb,

  -- Results
  winner_variant text,
  statistical_significance float,

  -- Metadata
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- FUNCTION: get_better_alternatives
-- ============================================================
-- Main recommendation function

CREATE OR REPLACE FUNCTION public.get_better_alternatives(
  p_product_id uuid,
  p_limit integer DEFAULT 3,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_experiment_id text DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  name text,
  slug text,
  image_url text,
  price_cents integer,
  currency text,
  category text,
  transparency_score smallint,
  transparency_tier text,
  similarity_score float,
  organization_name text,
  organization_slug text,
  organization_status_level text,
  is_sponsored boolean,
  sponsored_id uuid,
  display_position smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_product RECORD;
  v_variant text;
  v_experiment RECORD;
BEGIN
  -- Get source product details
  SELECT
    p.id,
    p.category,
    p.price_cents,
    p.organization_id,
    o.country,
    o.city,
    COALESCE(pts.overall_transparency_score, 0) as transparency_score
  INTO v_source_product
  FROM public.products p
  JOIN public.organizations o ON o.id = p.organization_id
  LEFT JOIN public.product_transparency_scores pts ON pts.product_id = p.id
  WHERE p.id = p_product_id AND p.status = 'published';

  -- Exit if product not found or not published
  IF v_source_product IS NULL THEN
    RETURN;
  END IF;

  -- Only show alternatives if source has low transparency (< 60)
  IF v_source_product.transparency_score >= 60 THEN
    RETURN;
  END IF;

  -- Determine A/B test variant if experiment is active
  IF p_experiment_id IS NOT NULL THEN
    SELECT * INTO v_experiment
    FROM public.ab_experiments
    WHERE id = p_experiment_id AND status = 'running';

    IF v_experiment IS NOT NULL THEN
      -- Simple hash-based assignment
      v_variant := (v_experiment.variants->>
        (abs(hashtext(COALESCE(p_user_id::text, p_session_id, gen_random_uuid()::text)))
         % jsonb_array_length(v_experiment.variants))
      );
    END IF;
  END IF;

  -- Return recommendations
  RETURN QUERY
  WITH ranked_alternatives AS (
    -- Organic alternatives from similarity cache
    SELECT
      p.id as product_id,
      p.name,
      p.slug,
      p.main_image_url as image_url,
      p.price_cents,
      p.currency,
      p.category,
      pts.overall_transparency_score as transparency_score,
      CASE
        WHEN pts.overall_transparency_score >= 90 THEN 'excellent'
        WHEN pts.overall_transparency_score >= 75 THEN 'good'
        WHEN pts.overall_transparency_score >= 50 THEN 'moderate'
        ELSE 'low'
      END as transparency_tier,
      COALESCE(psc.total_similarity, 0.5) as similarity_score,
      o.name as organization_name,
      o.slug as organization_slug,
      osl.level as organization_status_level,
      false as is_sponsored,
      NULL::uuid as sponsored_id,
      ROW_NUMBER() OVER (
        ORDER BY
          pts.overall_transparency_score DESC,
          COALESCE(psc.total_similarity, 0) DESC
      )::smallint as display_position
    FROM public.products p
    JOIN public.organizations o ON o.id = p.organization_id
    LEFT JOIN public.product_transparency_scores pts ON pts.product_id = p.id
    LEFT JOIN public.product_similarity_cache psc
      ON psc.source_product_id = p_product_id
      AND psc.similar_product_id = p.id
    LEFT JOIN public.organization_status_levels osl
      ON osl.organization_id = o.id
      AND osl.is_active = true
    WHERE
      p.status = 'published'
      AND p.id != p_product_id
      AND p.organization_id != v_source_product.organization_id
      AND COALESCE(pts.overall_transparency_score, 0) >= 60  -- Must have good transparency
      -- Category match (relaxed)
      AND (
        p.category = v_source_product.category
        OR v_source_product.category IS NULL
      )
      -- Price range (within 50% +/-)
      AND (
        v_source_product.price_cents IS NULL
        OR p.price_cents IS NULL
        OR p.price_cents BETWEEN
          (v_source_product.price_cents * 0.5)::integer
          AND (v_source_product.price_cents * 1.5)::integer
      )
    ORDER BY
      pts.overall_transparency_score DESC,
      COALESCE(psc.total_similarity, 0) DESC
    LIMIT p_limit + 2  -- Extra buffer for sponsored insertion
  ),
  sponsored AS (
    -- Get one relevant sponsored alternative (if any)
    SELECT
      p.id as product_id,
      p.name,
      p.slug,
      p.main_image_url as image_url,
      p.price_cents,
      p.currency,
      p.category,
      pts.overall_transparency_score as transparency_score,
      CASE
        WHEN pts.overall_transparency_score >= 90 THEN 'excellent'
        WHEN pts.overall_transparency_score >= 75 THEN 'good'
        WHEN pts.overall_transparency_score >= 50 THEN 'moderate'
        ELSE 'low'
      END as transparency_tier,
      0.0::float as similarity_score,
      o.name as organization_name,
      o.slug as organization_slug,
      osl.level as organization_status_level,
      true as is_sponsored,
      sa.id as sponsored_id
    FROM public.sponsored_alternatives sa
    JOIN public.products p ON p.id = sa.product_id
    JOIN public.organizations o ON o.id = p.organization_id
    LEFT JOIN public.product_transparency_scores pts ON pts.product_id = p.id
    LEFT JOIN public.organization_status_levels osl
      ON osl.organization_id = o.id
      AND osl.is_active = true
    WHERE
      sa.status = 'active'
      AND sa.starts_at <= now()
      AND (sa.ends_at IS NULL OR sa.ends_at > now())
      AND sa.spent_cents < sa.budget_cents
      AND COALESCE(pts.overall_transparency_score, 0) >= sa.min_transparency_score
      AND (
        sa.target_category IS NULL
        OR sa.target_category = v_source_product.category
      )
      AND (
        sa.target_price_min IS NULL
        OR v_source_product.price_cents >= sa.target_price_min
      )
      AND (
        sa.target_price_max IS NULL
        OR v_source_product.price_cents <= sa.target_price_max
      )
      AND p.id NOT IN (SELECT ra.product_id FROM ranked_alternatives ra)
    ORDER BY sa.priority DESC, random()
    LIMIT 1
  ),
  final_results AS (
    SELECT * FROM ranked_alternatives WHERE display_position <= p_limit - 1
    UNION ALL
    SELECT
      s.product_id,
      s.name,
      s.slug,
      s.image_url,
      s.price_cents,
      s.currency,
      s.category,
      s.transparency_score,
      s.transparency_tier,
      s.similarity_score,
      s.organization_name,
      s.organization_slug,
      s.organization_status_level,
      s.is_sponsored,
      s.sponsored_id,
      (p_limit)::smallint as display_position  -- Sponsored always last
    FROM sponsored s
  )
  SELECT
    fr.product_id,
    fr.name,
    fr.slug,
    fr.image_url,
    fr.price_cents,
    fr.currency,
    fr.category,
    fr.transparency_score,
    fr.transparency_tier,
    fr.similarity_score,
    fr.organization_name,
    fr.organization_slug,
    fr.organization_status_level,
    fr.is_sponsored,
    fr.sponsored_id,
    ROW_NUMBER() OVER (ORDER BY fr.display_position)::smallint as display_position
  FROM final_results fr
  ORDER BY fr.display_position
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- FUNCTION: calculate_product_transparency_score
-- ============================================================
-- Recalculates transparency score for a product

CREATE OR REPLACE FUNCTION public.calculate_product_transparency_score(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_journey_score smallint;
  v_cert_score smallint;
  v_claim_score smallint;
  v_producer_score smallint;
  v_review_score smallint;
  v_step_count integer;
  v_verified_step_count integer;
  v_cert_count integer;
  v_org_id uuid;
  v_org_status text;
BEGIN
  -- Get organization ID
  SELECT organization_id INTO v_org_id
  FROM public.products WHERE id = p_product_id;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Journey Completeness Score (25% weight)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE verified = true)
  INTO v_step_count, v_verified_step_count
  FROM public.product_journey_steps
  WHERE product_id = p_product_id;

  -- 6 stages expected, bonus for verification
  v_journey_score := LEAST(100,
    (v_step_count::float / 6.0 * 60)::smallint +
    (CASE WHEN v_step_count > 0 THEN (v_verified_step_count::float / v_step_count * 40)::smallint ELSE 0 END)
  );

  -- Certification Score (20% weight)
  SELECT COUNT(*) INTO v_cert_count
  FROM public.organization_certifications
  WHERE organization_id = v_org_id
    AND status = 'verified'
    AND (valid_until IS NULL OR valid_until > now());

  v_cert_score := LEAST(100, v_cert_count * 25);

  -- Claim Verification Score (20% weight)
  -- Based on verified_claims array in products
  v_claim_score := 50; -- Default baseline, would be calculated from actual claims

  -- Producer Status Score (20% weight)
  SELECT level INTO v_org_status
  FROM public.organization_status_levels
  WHERE organization_id = v_org_id AND is_active = true
  ORDER BY
    CASE level WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 END
  LIMIT 1;

  v_producer_score := CASE v_org_status
    WHEN 'A' THEN 100
    WHEN 'B' THEN 70
    WHEN 'C' THEN 40
    ELSE 20
  END;

  -- Review Authenticity Score (15% weight)
  -- Would analyze review patterns - using baseline
  v_review_score := 50;

  -- Upsert score
  INSERT INTO public.product_transparency_scores (
    product_id,
    journey_completeness_score,
    certification_score,
    claim_verification_score,
    producer_status_score,
    review_authenticity_score,
    last_calculated_at
  ) VALUES (
    p_product_id,
    v_journey_score,
    v_cert_score,
    v_claim_score,
    v_producer_score,
    v_review_score,
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    journey_completeness_score = EXCLUDED.journey_completeness_score,
    certification_score = EXCLUDED.certification_score,
    claim_verification_score = EXCLUDED.claim_verification_score,
    producer_status_score = EXCLUDED.producer_status_score,
    review_authenticity_score = EXCLUDED.review_authenticity_score,
    last_calculated_at = now();
END;
$$;

-- ============================================================
-- FUNCTION: calculate_product_similarity
-- ============================================================
-- Calculates similarity between two products

CREATE OR REPLACE FUNCTION public.calculate_product_similarity(
  p_source_id uuid,
  p_target_id uuid
)
RETURNS float
LANGUAGE plpgsql
AS $$
DECLARE
  v_source RECORD;
  v_target RECORD;
  v_category_sim float := 0;
  v_price_sim float := 0;
  v_region_sim float := 0;
  v_tag_sim float := 0;
  v_source_tags text[];
  v_target_tags text[];
  v_common_tags int;
BEGIN
  -- Get source product
  SELECT p.*, o.country, o.city
  INTO v_source
  FROM public.products p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = p_source_id;

  -- Get target product
  SELECT p.*, o.country, o.city
  INTO v_target
  FROM public.products p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = p_target_id;

  IF v_source IS NULL OR v_target IS NULL THEN
    RETURN 0;
  END IF;

  -- Category similarity (exact match = 1, else 0)
  IF v_source.category = v_target.category AND v_source.category IS NOT NULL THEN
    v_category_sim := 1.0;
  ELSIF v_source.category IS NULL OR v_target.category IS NULL THEN
    v_category_sim := 0.5;  -- Unknown categories get partial credit
  END IF;

  -- Price similarity (inverse of price difference percentage)
  IF v_source.price_cents IS NOT NULL AND v_target.price_cents IS NOT NULL
     AND v_source.price_cents > 0 THEN
    v_price_sim := 1.0 - LEAST(1.0,
      ABS(v_source.price_cents - v_target.price_cents)::float / v_source.price_cents
    );
  ELSIF v_source.price_cents IS NULL OR v_target.price_cents IS NULL THEN
    v_price_sim := 0.5;
  END IF;

  -- Region overlap (same country = 1, same city bonus)
  IF v_source.country = v_target.country AND v_source.country IS NOT NULL THEN
    v_region_sim := 0.7;
    IF v_source.city = v_target.city AND v_source.city IS NOT NULL THEN
      v_region_sim := 1.0;
    END IF;
  ELSE
    v_region_sim := 0.3;  -- Different regions still available
  END IF;

  -- Tag similarity (Jaccard coefficient)
  v_source_tags := string_to_array(COALESCE(v_source.tags, ''), ',');
  v_target_tags := string_to_array(COALESCE(v_target.tags, ''), ',');

  IF array_length(v_source_tags, 1) > 0 AND array_length(v_target_tags, 1) > 0 THEN
    SELECT COUNT(*) INTO v_common_tags
    FROM unnest(v_source_tags) s
    WHERE trim(s) = ANY(SELECT trim(t) FROM unnest(v_target_tags) t);

    v_tag_sim := v_common_tags::float /
      (array_length(v_source_tags, 1) + array_length(v_target_tags, 1) - v_common_tags);
  END IF;

  -- Weighted total
  RETURN (
    v_category_sim * 0.40 +
    v_price_sim * 0.25 +
    v_region_sim * 0.20 +
    v_tag_sim * 0.15
  );
END;
$$;

-- ============================================================
-- FUNCTION: record_recommendation_impression
-- ============================================================
-- Records when alternatives are shown and interactions

CREATE OR REPLACE FUNCTION public.record_recommendation_impression(
  p_source_product_id uuid,
  p_recommended_product_id uuid,
  p_display_position smallint,
  p_is_sponsored boolean DEFAULT false,
  p_sponsored_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_experiment_id text DEFAULT NULL,
  p_variant text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_impression_id uuid;
BEGIN
  INSERT INTO public.recommendation_impressions (
    source_product_id,
    recommended_product_id,
    display_position,
    is_sponsored,
    sponsored_id,
    user_id,
    session_id,
    experiment_id,
    variant
  ) VALUES (
    p_source_product_id,
    p_recommended_product_id,
    p_position,
    p_is_sponsored,
    p_sponsored_id,
    p_user_id,
    p_session_id,
    p_experiment_id,
    p_variant
  )
  RETURNING id INTO v_impression_id;

  -- Update sponsored spend if applicable
  IF p_is_sponsored AND p_sponsored_id IS NOT NULL THEN
    UPDATE public.sponsored_alternatives
    SET spent_cents = spent_cents + cost_per_impression_cents,
        status = CASE
          WHEN spent_cents + cost_per_impression_cents >= budget_cents THEN 'depleted'
          ELSE status
        END
    WHERE id = p_sponsored_id;
  END IF;

  RETURN v_impression_id;
END;
$$;

-- ============================================================
-- FUNCTION: record_recommendation_click
-- ============================================================
-- Records when a recommended alternative is clicked

CREATE OR REPLACE FUNCTION public.record_recommendation_click(
  p_impression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_impression RECORD;
BEGIN
  SELECT * INTO v_impression
  FROM public.recommendation_impressions
  WHERE id = p_impression_id;

  IF v_impression IS NULL THEN
    RETURN;
  END IF;

  -- Update impression
  UPDATE public.recommendation_impressions
  SET was_clicked = true, clicked_at = now()
  WHERE id = p_impression_id;

  -- Update sponsored spend for click
  IF v_impression.is_sponsored AND v_impression.sponsored_id IS NOT NULL THEN
    UPDATE public.sponsored_alternatives
    SET spent_cents = spent_cents + cost_per_click_cents,
        status = CASE
          WHEN spent_cents + cost_per_click_cents >= budget_cents THEN 'depleted'
          ELSE status
        END
    WHERE id = v_impression.sponsored_id;
  END IF;
END;
$$;

-- ============================================================
-- TRIGGER: Recalculate transparency on product changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_recalculate_transparency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.calculate_product_transparency_score(NEW.product_id);
  RETURN NEW;
END;
$$;

-- Trigger on journey steps changes
DROP TRIGGER IF EXISTS trg_journey_step_transparency ON public.product_journey_steps;
CREATE TRIGGER trg_journey_step_transparency
AFTER INSERT OR UPDATE OR DELETE ON public.product_journey_steps
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalculate_transparency();

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_transparency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_similarity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_experiments ENABLE ROW LEVEL SECURITY;

-- Categories: public read
CREATE POLICY "Anyone can read categories" ON public.product_categories
  FOR SELECT USING (true);

-- Transparency scores: public read
CREATE POLICY "Anyone can read transparency scores" ON public.product_transparency_scores
  FOR SELECT USING (true);

-- Similarity cache: public read
CREATE POLICY "Anyone can read similarity cache" ON public.product_similarity_cache
  FOR SELECT USING (true);

-- Sponsored: org members manage their own
CREATE POLICY "Org members manage sponsored" ON public.sponsored_alternatives
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = sponsored_alternatives.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- Platform admins can view all sponsored
CREATE POLICY "Platform admins view all sponsored" ON public.sponsored_alternatives
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('platform_admin', 'platform_owner')
    )
  );

-- Impressions: platform admins only (analytics)
CREATE POLICY "Platform admins view impressions" ON public.recommendation_impressions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('platform_admin', 'platform_owner')
    )
  );

-- Experiments: platform admins manage
CREATE POLICY "Platform admins manage experiments" ON public.ab_experiments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('platform_admin', 'platform_owner')
    )
  );

-- ============================================================
-- SEED DATA: Default categories
-- ============================================================

INSERT INTO public.product_categories (slug, name_ru, name_en, level) VALUES
  ('food', 'Продукты питания', 'Food', 1),
  ('beverages', 'Напитки', 'Beverages', 1),
  ('cosmetics', 'Косметика', 'Cosmetics', 1),
  ('household', 'Бытовые товары', 'Household', 1),
  ('clothing', 'Одежда', 'Clothing', 1),
  ('electronics', 'Электроника', 'Electronics', 1)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
