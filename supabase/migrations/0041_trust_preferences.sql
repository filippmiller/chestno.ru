-- Migration 0041: Trust Preferences System
-- Date: 2026-02-01
-- Description: Personalized trust factor weighting for consumers

BEGIN;

-- ============================================================
-- TABLE: trust_factors (Reference Data)
-- ============================================================
-- Defines available trust factors that users can weight
-- These are the dimensions by which products/orgs can be evaluated

CREATE TABLE IF NOT EXISTS public.trust_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  code text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN (
    'ethical',      -- Vegan, fair-trade, cruelty-free
    'quality',      -- Certifications, standards
    'origin',       -- Local, regional, country
    'environmental', -- Eco, sustainable, carbon neutral
    'health',       -- Organic, allergen-free, dietary
    'social',       -- Small business, women-owned, minority-owned
    'transparency'  -- Supply chain visibility, disclosure level
  )),

  -- Display
  name_ru text NOT NULL,
  name_en text NOT NULL,
  description_ru text,
  description_en text,
  icon text,  -- Icon name/code for UI
  color text DEFAULT '#6366F1',  -- Primary color for UI

  -- Scoring parameters
  default_weight integer NOT NULL DEFAULT 50 CHECK (default_weight BETWEEN 0 AND 100),
  min_weight integer NOT NULL DEFAULT 0,
  max_weight integer NOT NULL DEFAULT 100,

  -- Whether this factor can be computed automatically
  auto_computable boolean NOT NULL DEFAULT false,
  computation_rule jsonb,  -- Rules for auto-computation

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed core trust factors
INSERT INTO public.trust_factors (code, category, name_ru, name_en, description_ru, description_en, icon, color, default_weight, auto_computable, display_order) VALUES
  -- Ethical
  ('vegan', 'ethical', 'Веганский', 'Vegan', 'Продукт не содержит компонентов животного происхождения', 'Product contains no animal-derived ingredients', 'leaf', '#22C55E', 50, true, 10),
  ('vegetarian', 'ethical', 'Вегетарианский', 'Vegetarian', 'Продукт подходит для вегетарианцев', 'Suitable for vegetarians', 'seedling', '#84CC16', 50, true, 11),
  ('fair_trade', 'ethical', 'Честная торговля', 'Fair Trade', 'Справедливые условия для производителей', 'Fair conditions for producers', 'handshake', '#F59E0B', 50, true, 12),
  ('cruelty_free', 'ethical', 'Без жестокости', 'Cruelty-Free', 'Не тестировалось на животных', 'Not tested on animals', 'heart', '#EC4899', 50, true, 13),

  -- Quality
  ('certified_quality', 'quality', 'Сертификация качества', 'Quality Certified', 'Имеет сертификаты качества (ГОСТ, ISO)', 'Has quality certifications (GOST, ISO)', 'badge-check', '#3B82F6', 60, true, 20),
  ('premium_grade', 'quality', 'Премиум класс', 'Premium Grade', 'Продукция высшего класса', 'Highest grade product', 'star', '#FBBF24', 50, false, 21),

  -- Origin
  ('local', 'origin', 'Местное', 'Local', 'Произведено в вашем регионе', 'Produced in your region', 'map-pin', '#8B5CF6', 50, true, 30),
  ('russian_made', 'origin', 'Сделано в России', 'Made in Russia', 'Произведено в России', 'Made in Russia', 'flag', '#EF4444', 60, true, 31),
  ('single_origin', 'origin', 'Один источник', 'Single Origin', 'Из одного региона/фермы', 'From single region/farm', 'location-marker', '#6366F1', 40, false, 32),

  -- Environmental
  ('organic', 'environmental', 'Органик', 'Organic', 'Органическое производство без химикатов', 'Organic production without chemicals', 'globe', '#22C55E', 55, true, 40),
  ('eco_friendly', 'environmental', 'Экологичный', 'Eco-Friendly', 'Минимальное воздействие на окружающую среду', 'Minimal environmental impact', 'recycle', '#10B981', 50, true, 41),
  ('sustainable', 'environmental', 'Устойчивый', 'Sustainable', 'Устойчивое производство', 'Sustainable production practices', 'tree', '#059669', 50, false, 42),
  ('carbon_neutral', 'environmental', 'Углеродно-нейтральный', 'Carbon Neutral', 'Нулевой углеродный след', 'Zero carbon footprint', 'cloud', '#0EA5E9', 40, false, 43),
  ('plastic_free', 'environmental', 'Без пластика', 'Plastic-Free', 'Упаковка без пластика', 'Plastic-free packaging', 'trash', '#14B8A6', 45, false, 44),

  -- Health
  ('allergen_free', 'health', 'Без аллергенов', 'Allergen-Free', 'Не содержит основных аллергенов', 'Free from major allergens', 'shield-check', '#F97316', 50, true, 50),
  ('gluten_free', 'health', 'Без глютена', 'Gluten-Free', 'Не содержит глютен', 'Does not contain gluten', 'x-circle', '#FB923C', 50, true, 51),
  ('sugar_free', 'health', 'Без сахара', 'Sugar-Free', 'Без добавленного сахара', 'No added sugar', 'cake', '#F472B6', 45, true, 52),
  ('halal', 'health', 'Халяль', 'Halal', 'Соответствует стандартам халяль', 'Meets halal standards', 'moon', '#10B981', 50, true, 53),
  ('kosher', 'health', 'Кошер', 'Kosher', 'Соответствует стандартам кошрут', 'Meets kosher standards', 'star', '#3B82F6', 50, true, 54),

  -- Social
  ('small_business', 'social', 'Малый бизнес', 'Small Business', 'Поддержка малого бизнеса', 'Support for small businesses', 'store', '#8B5CF6', 45, true, 60),
  ('family_owned', 'social', 'Семейный бизнес', 'Family-Owned', 'Семейное предприятие', 'Family-owned business', 'users', '#EC4899', 45, false, 61),
  ('social_enterprise', 'social', 'Социальное предприятие', 'Social Enterprise', 'Социально ориентированный бизнес', 'Socially-focused business', 'heart', '#EF4444', 45, false, 62),

  -- Transparency
  ('full_traceability', 'transparency', 'Полная прослеживаемость', 'Full Traceability', 'Полная история происхождения', 'Complete origin history', 'eye', '#6366F1', 60, true, 70),
  ('verified_producer', 'transparency', 'Верифицированный производитель', 'Verified Producer', 'Производитель прошел верификацию', 'Producer is verified', 'check-circle', '#22C55E', 65, true, 71),
  ('open_practices', 'transparency', 'Открытые практики', 'Open Practices', 'Открытая информация о производстве', 'Open information about production', 'document-text', '#0EA5E9', 50, false, 72)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- TABLE: trust_preference_profiles (Preset Profiles)
-- ============================================================
-- Pre-built preference profiles users can select from

CREATE TABLE IF NOT EXISTS public.trust_preference_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_en text NOT NULL,
  description_ru text,
  description_en text,
  icon text,
  color text DEFAULT '#6366F1',

  -- Profile weights (factor_code -> weight 0-100)
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Whether this is a system profile or user-created template
  is_system boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,

  -- Usage tracking
  usage_count integer NOT NULL DEFAULT 0,

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed preset profiles
INSERT INTO public.trust_preference_profiles (code, name_ru, name_en, description_ru, description_en, icon, color, weights, is_system, is_featured, display_order) VALUES
  (
    'balanced',
    'Сбалансированный',
    'Balanced',
    'Равномерное внимание ко всем факторам доверия',
    'Even attention to all trust factors',
    'scale',
    '#6366F1',
    '{"certified_quality": 60, "verified_producer": 60, "organic": 50, "local": 50, "fair_trade": 50, "eco_friendly": 50}',
    true, true, 1
  ),
  (
    'eco_conscious',
    'Эко-сознательный',
    'Eco-Conscious',
    'Приоритет экологичности и устойчивости',
    'Priority on environmental sustainability',
    'globe',
    '#22C55E',
    '{"organic": 90, "eco_friendly": 90, "sustainable": 85, "carbon_neutral": 80, "plastic_free": 75, "fair_trade": 70, "local": 60}',
    true, true, 2
  ),
  (
    'vegan',
    'Веган',
    'Vegan',
    'Фокус на веганских и этичных продуктах',
    'Focus on vegan and ethical products',
    'leaf',
    '#84CC16',
    '{"vegan": 100, "cruelty_free": 95, "organic": 70, "eco_friendly": 65, "fair_trade": 60}',
    true, true, 3
  ),
  (
    'local_first',
    'Местное первым',
    'Local First',
    'Поддержка местных производителей',
    'Support for local producers',
    'map-pin',
    '#8B5CF6',
    '{"local": 100, "russian_made": 90, "small_business": 85, "family_owned": 80, "verified_producer": 70}',
    true, true, 4
  ),
  (
    'quality_focused',
    'Качество прежде всего',
    'Quality First',
    'Приоритет сертификации и качества',
    'Priority on certifications and quality',
    'badge-check',
    '#3B82F6',
    '{"certified_quality": 100, "premium_grade": 90, "verified_producer": 85, "full_traceability": 80, "organic": 60}',
    true, true, 5
  ),
  (
    'health_conscious',
    'Здоровое питание',
    'Health-Conscious',
    'Фокус на здоровых и диетических продуктах',
    'Focus on healthy and dietary products',
    'heart',
    '#EF4444',
    '{"organic": 90, "allergen_free": 85, "gluten_free": 80, "sugar_free": 75, "certified_quality": 70}',
    true, false, 6
  ),
  (
    'ethical_consumer',
    'Этичный потребитель',
    'Ethical Consumer',
    'Социальная ответственность и этика',
    'Social responsibility and ethics',
    'handshake',
    '#F59E0B',
    '{"fair_trade": 95, "cruelty_free": 90, "social_enterprise": 85, "small_business": 80, "sustainable": 75, "verified_producer": 70}',
    true, false, 7
  ),
  (
    'kosher_halal',
    'Кошер и Халяль',
    'Kosher & Halal',
    'Религиозные стандарты питания',
    'Religious dietary standards',
    'star',
    '#10B981',
    '{"kosher": 100, "halal": 100, "certified_quality": 80, "verified_producer": 75, "full_traceability": 70}',
    true, false, 8
  ),
  (
    'transparency_first',
    'Прозрачность первым',
    'Transparency First',
    'Максимальная открытость о продукции',
    'Maximum openness about products',
    'eye',
    '#0EA5E9',
    '{"full_traceability": 100, "verified_producer": 95, "open_practices": 90, "certified_quality": 80, "single_origin": 75}',
    true, false, 9
  )
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- TABLE: user_trust_preferences
-- ============================================================
-- Stores individual user preferences (authenticated users)

CREATE TABLE IF NOT EXISTS public.user_trust_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User (nullable for anonymous preference sync)
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Selected profile (optional - user may have custom weights)
  profile_id uuid REFERENCES public.trust_preference_profiles(id) ON DELETE SET NULL,

  -- Custom weights (overrides profile if set)
  -- Format: { "factor_code": weight_0_to_100, ... }
  custom_weights jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Whether to use custom weights or profile
  use_custom_weights boolean NOT NULL DEFAULT false,

  -- Display preferences
  show_trust_scores boolean NOT NULL DEFAULT true,
  highlight_matching boolean NOT NULL DEFAULT true,
  sort_by_trust_score boolean NOT NULL DEFAULT false,

  -- Filter preferences (factors with weight > threshold are filtered)
  filter_threshold integer NOT NULL DEFAULT 80,
  active_filters text[] NOT NULL DEFAULT '{}',

  -- Onboarding state
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_skipped boolean NOT NULL DEFAULT false,

  -- Metadata
  device_fingerprint text,  -- For anonymous user matching
  metadata jsonb,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for user lookup
CREATE INDEX idx_user_trust_prefs_user ON public.user_trust_preferences(user_id) WHERE user_id IS NOT NULL;

-- Index for device fingerprint (anonymous user matching)
CREATE INDEX idx_user_trust_prefs_device ON public.user_trust_preferences(device_fingerprint) WHERE device_fingerprint IS NOT NULL;

-- ============================================================
-- TABLE: user_trust_preference_history
-- ============================================================
-- Audit trail of preference changes

CREATE TABLE IF NOT EXISTS public.user_trust_preference_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_preference_id uuid NOT NULL REFERENCES public.user_trust_preferences(id) ON DELETE CASCADE,

  -- What changed
  change_type text NOT NULL CHECK (change_type IN (
    'profile_selected',
    'weights_updated',
    'filters_updated',
    'display_updated',
    'onboarding_completed',
    'preferences_reset'
  )),

  previous_value jsonb,
  new_value jsonb,

  -- Context
  source text,  -- 'onboarding', 'settings', 'quick_filter', 'api'

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trust_pref_history_user ON public.user_trust_preference_history(user_preference_id, created_at DESC);

-- ============================================================
-- TABLE: product_trust_scores
-- ============================================================
-- Precomputed trust scores for products based on their attributes

CREATE TABLE IF NOT EXISTS public.product_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Individual factor scores (0-100)
  -- Format: { "factor_code": score_0_to_100, ... }
  factor_scores jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Aggregate scores
  overall_score integer NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),

  -- Matching factors (codes of factors this product excels at)
  strong_factors text[] NOT NULL DEFAULT '{}',

  -- Computation metadata
  computed_at timestamptz NOT NULL DEFAULT now(),
  computation_version integer NOT NULL DEFAULT 1,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One score per product
  CONSTRAINT unique_product_trust_score UNIQUE (product_id)
);

CREATE INDEX idx_product_trust_scores_product ON public.product_trust_scores(product_id);
CREATE INDEX idx_product_trust_scores_overall ON public.product_trust_scores(overall_score DESC);
CREATE INDEX idx_product_trust_scores_factors ON public.product_trust_scores USING GIN(strong_factors);

-- ============================================================
-- TABLE: organization_trust_scores
-- ============================================================
-- Precomputed trust scores for organizations

CREATE TABLE IF NOT EXISTS public.organization_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Individual factor scores (0-100)
  factor_scores jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Aggregate scores
  overall_score integer NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),

  -- Strong factors
  strong_factors text[] NOT NULL DEFAULT '{}',

  -- Computation metadata
  computed_at timestamptz NOT NULL DEFAULT now(),
  computation_version integer NOT NULL DEFAULT 1,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_org_trust_score UNIQUE (organization_id)
);

CREATE INDEX idx_org_trust_scores_org ON public.organization_trust_scores(organization_id);
CREATE INDEX idx_org_trust_scores_overall ON public.organization_trust_scores(overall_score DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to compute personalized trust score
CREATE OR REPLACE FUNCTION public.compute_personalized_score(
  p_entity_factor_scores jsonb,
  p_user_weights jsonb
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total_weight integer := 0;
  v_weighted_sum integer := 0;
  v_factor_code text;
  v_entity_score integer;
  v_user_weight integer;
BEGIN
  -- Iterate through user weights
  FOR v_factor_code, v_user_weight IN SELECT * FROM jsonb_each_text(p_user_weights)
  LOOP
    v_user_weight := v_user_weight::integer;

    -- Only consider factors with weight > 0
    IF v_user_weight > 0 THEN
      -- Get entity's score for this factor (default 0 if not present)
      v_entity_score := COALESCE((p_entity_factor_scores ->> v_factor_code)::integer, 0);

      v_total_weight := v_total_weight + v_user_weight;
      v_weighted_sum := v_weighted_sum + (v_entity_score * v_user_weight);
    END IF;
  END LOOP;

  -- Return weighted average, or 0 if no weights
  IF v_total_weight = 0 THEN
    RETURN 0;
  END IF;

  RETURN (v_weighted_sum / v_total_weight);
END;
$$;

-- Function to get effective user weights (profile or custom)
CREATE OR REPLACE FUNCTION public.get_user_effective_weights(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_prefs record;
  v_profile_weights jsonb;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Get user preferences
  SELECT * INTO v_prefs
  FROM public.user_trust_preferences
  WHERE user_id = p_user_id;

  -- If no preferences, return default weights from all active factors
  IF v_prefs IS NULL THEN
    SELECT jsonb_object_agg(code, default_weight) INTO v_result
    FROM public.trust_factors
    WHERE is_active = true;
    RETURN v_result;
  END IF;

  -- If using custom weights
  IF v_prefs.use_custom_weights AND v_prefs.custom_weights != '{}'::jsonb THEN
    RETURN v_prefs.custom_weights;
  END IF;

  -- If using profile
  IF v_prefs.profile_id IS NOT NULL THEN
    SELECT weights INTO v_profile_weights
    FROM public.trust_preference_profiles
    WHERE id = v_prefs.profile_id;

    IF v_profile_weights IS NOT NULL THEN
      RETURN v_profile_weights;
    END IF;
  END IF;

  -- Fall back to default weights
  SELECT jsonb_object_agg(code, default_weight) INTO v_result
  FROM public.trust_factors
  WHERE is_active = true;

  RETURN v_result;
END;
$$;

-- Function to compute trust score for a product against user preferences
CREATE OR REPLACE FUNCTION public.get_product_trust_score_for_user(
  p_product_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  personalized_score integer,
  factor_matches jsonb,
  strong_match_count integer
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_weights jsonb;
  v_product_scores jsonb;
  v_personalized integer;
  v_matches jsonb := '{}'::jsonb;
  v_match_count integer := 0;
  v_factor_code text;
  v_product_score integer;
  v_user_weight integer;
BEGIN
  -- Get user weights
  IF p_user_id IS NOT NULL THEN
    v_user_weights := public.get_user_effective_weights(p_user_id);
  ELSE
    -- Default weights for anonymous users
    SELECT jsonb_object_agg(code, default_weight) INTO v_user_weights
    FROM public.trust_factors
    WHERE is_active = true;
  END IF;

  -- Get product factor scores
  SELECT factor_scores INTO v_product_scores
  FROM public.product_trust_scores
  WHERE product_id = p_product_id;

  IF v_product_scores IS NULL THEN
    v_product_scores := '{}'::jsonb;
  END IF;

  -- Compute personalized score
  v_personalized := public.compute_personalized_score(v_product_scores, v_user_weights);

  -- Find factor matches (product score >= 70 AND user weight >= 50)
  FOR v_factor_code, v_user_weight IN SELECT * FROM jsonb_each_text(v_user_weights)
  LOOP
    v_user_weight := v_user_weight::integer;
    v_product_score := COALESCE((v_product_scores ->> v_factor_code)::integer, 0);

    IF v_product_score >= 70 AND v_user_weight >= 50 THEN
      v_matches := v_matches || jsonb_build_object(v_factor_code, jsonb_build_object(
        'product_score', v_product_score,
        'user_weight', v_user_weight
      ));
      v_match_count := v_match_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_personalized, v_matches, v_match_count;
END;
$$;

-- Function to merge anonymous preferences on login
CREATE OR REPLACE FUNCTION public.merge_anonymous_preferences(
  p_user_id uuid,
  p_device_fingerprint text,
  p_anonymous_weights jsonb DEFAULT NULL,
  p_anonymous_profile_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pref_id uuid;
  v_existing_prefs record;
  v_profile_id uuid;
BEGIN
  -- Check if user already has preferences
  SELECT * INTO v_existing_prefs
  FROM public.user_trust_preferences
  WHERE user_id = p_user_id;

  -- If user has existing preferences and completed onboarding, don't overwrite
  IF v_existing_prefs IS NOT NULL AND v_existing_prefs.onboarding_completed THEN
    RETURN v_existing_prefs.id;
  END IF;

  -- Get profile ID if code provided
  IF p_anonymous_profile_code IS NOT NULL THEN
    SELECT id INTO v_profile_id
    FROM public.trust_preference_profiles
    WHERE code = p_anonymous_profile_code;
  END IF;

  IF v_existing_prefs IS NOT NULL THEN
    -- Update existing preferences with anonymous data
    UPDATE public.user_trust_preferences
    SET
      device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint),
      profile_id = COALESCE(v_profile_id, profile_id),
      custom_weights = CASE
        WHEN p_anonymous_weights IS NOT NULL AND p_anonymous_weights != '{}'::jsonb
        THEN p_anonymous_weights
        ELSE custom_weights
      END,
      use_custom_weights = CASE
        WHEN p_anonymous_weights IS NOT NULL AND p_anonymous_weights != '{}'::jsonb
        THEN true
        ELSE use_custom_weights
      END,
      updated_at = now()
    WHERE id = v_existing_prefs.id
    RETURNING id INTO v_pref_id;
  ELSE
    -- Create new preferences
    INSERT INTO public.user_trust_preferences (
      user_id,
      device_fingerprint,
      profile_id,
      custom_weights,
      use_custom_weights
    ) VALUES (
      p_user_id,
      p_device_fingerprint,
      v_profile_id,
      COALESCE(p_anonymous_weights, '{}'::jsonb),
      (p_anonymous_weights IS NOT NULL AND p_anonymous_weights != '{}'::jsonb)
    )
    RETURNING id INTO v_pref_id;
  END IF;

  -- Log the merge
  INSERT INTO public.user_trust_preference_history (
    user_preference_id,
    change_type,
    new_value,
    source
  ) VALUES (
    v_pref_id,
    'weights_updated',
    jsonb_build_object(
      'profile_code', p_anonymous_profile_code,
      'custom_weights', p_anonymous_weights,
      'device_fingerprint', p_device_fingerprint
    ),
    'anonymous_merge'
  );

  RETURN v_pref_id;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.trust_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_preference_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trust_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trust_preference_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_trust_scores ENABLE ROW LEVEL SECURITY;

-- Trust factors: Public read
CREATE POLICY "Anyone can view active trust factors"
  ON public.trust_factors FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages trust factors"
  ON public.trust_factors FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Preference profiles: Public read
CREATE POLICY "Anyone can view active profiles"
  ON public.trust_preference_profiles FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages profiles"
  ON public.trust_preference_profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- User preferences: User-owned
CREATE POLICY "Users manage their own preferences"
  ON public.user_trust_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages all preferences"
  ON public.user_trust_preferences FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Preference history: User can view their own
CREATE POLICY "Users view their preference history"
  ON public.user_trust_preference_history FOR SELECT
  USING (
    user_preference_id IN (
      SELECT id FROM public.user_trust_preferences
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages preference history"
  ON public.user_trust_preference_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Product trust scores: Public read
CREATE POLICY "Anyone can view product trust scores"
  ON public.product_trust_scores FOR SELECT
  USING (true);

CREATE POLICY "Service role manages product trust scores"
  ON public.product_trust_scores FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Organization trust scores: Public read
CREATE POLICY "Anyone can view org trust scores"
  ON public.organization_trust_scores FOR SELECT
  USING (true);

CREATE POLICY "Service role manages org trust scores"
  ON public.organization_trust_scores FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Updated at trigger for user preferences
CREATE OR REPLACE FUNCTION public.trust_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_trust_preferences_updated_at
  BEFORE UPDATE ON public.user_trust_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.trust_preferences_updated_at();

CREATE TRIGGER product_trust_scores_updated_at
  BEFORE UPDATE ON public.product_trust_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.trust_preferences_updated_at();

CREATE TRIGGER organization_trust_scores_updated_at
  BEFORE UPDATE ON public.organization_trust_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.trust_preferences_updated_at();

-- Log preference changes
CREATE OR REPLACE FUNCTION public.log_preference_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only log significant changes
  IF OLD.profile_id IS DISTINCT FROM NEW.profile_id THEN
    INSERT INTO public.user_trust_preference_history (
      user_preference_id, change_type, previous_value, new_value, source
    ) VALUES (
      NEW.id,
      'profile_selected',
      jsonb_build_object('profile_id', OLD.profile_id),
      jsonb_build_object('profile_id', NEW.profile_id),
      'settings'
    );
  END IF;

  IF OLD.custom_weights IS DISTINCT FROM NEW.custom_weights THEN
    INSERT INTO public.user_trust_preference_history (
      user_preference_id, change_type, previous_value, new_value, source
    ) VALUES (
      NEW.id,
      'weights_updated',
      jsonb_build_object('weights', OLD.custom_weights),
      jsonb_build_object('weights', NEW.custom_weights),
      'settings'
    );
  END IF;

  IF OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed AND NEW.onboarding_completed THEN
    INSERT INTO public.user_trust_preference_history (
      user_preference_id, change_type, new_value, source
    ) VALUES (
      NEW.id,
      'onboarding_completed',
      jsonb_build_object('completed_at', now()),
      'onboarding'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER log_preference_changes
  AFTER UPDATE ON public.user_trust_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.log_preference_change();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.trust_factors IS 'Reference table of trust factors that users can weight (vegan, local, fair-trade, etc.)';
COMMENT ON TABLE public.trust_preference_profiles IS 'Pre-built preference profiles (Eco-Conscious, Vegan, Local First, etc.)';
COMMENT ON TABLE public.user_trust_preferences IS 'Individual user trust preferences and weights';
COMMENT ON TABLE public.product_trust_scores IS 'Precomputed trust factor scores for products';
COMMENT ON TABLE public.organization_trust_scores IS 'Precomputed trust factor scores for organizations';
COMMENT ON FUNCTION public.compute_personalized_score IS 'Computes weighted trust score based on user preferences';
COMMENT ON FUNCTION public.get_user_effective_weights IS 'Gets effective weights for user (custom or from profile)';
COMMENT ON FUNCTION public.merge_anonymous_preferences IS 'Merges anonymous localStorage preferences when user logs in';

COMMIT;
