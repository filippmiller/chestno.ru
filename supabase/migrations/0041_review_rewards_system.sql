-- Migration: Review Rewards System ("Баллы за отзывы")
-- Ozon-style rewards with partner discounts, quality bonuses, and anti-abuse measures

-- =============================================================================
-- ENHANCED POINTS CONFIGURATION (Quality-based scoring)
-- =============================================================================

-- Store review quality scores for transparency
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS word_count INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;

COMMENT ON COLUMN reviews.quality_score IS 'Calculated quality score (0-100) based on length, photos, detail';
COMMENT ON COLUMN reviews.word_count IS 'Word count in review body';
COMMENT ON COLUMN reviews.points_awarded IS 'Total points awarded for this review';

-- =============================================================================
-- PARTNER REWARDS CATALOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS reward_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Partner info
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    description TEXT,
    website_url TEXT,

    -- Partner category
    category TEXT NOT NULL CHECK (category IN (
        'ecommerce',      -- Online stores
        'food',           -- Restaurants, delivery
        'entertainment',  -- Cinema, events
        'services',       -- Subscriptions, services
        'travel',         -- Hotels, transport
        'education'       -- Courses, books
    )),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,  -- For sorting (higher = more prominent)

    -- Partnership terms
    contract_start_date DATE,
    contract_end_date DATE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_partners_active ON reward_partners(is_active, priority DESC);
CREATE INDEX idx_reward_partners_category ON reward_partners(category) WHERE is_active = true;

-- =============================================================================
-- REWARDS CATALOG (Discount codes, vouchers, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS rewards_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES reward_partners(id) ON DELETE CASCADE,

    -- Reward info
    title TEXT NOT NULL,
    description TEXT,
    terms TEXT,  -- Fine print, restrictions

    -- Reward type
    reward_type TEXT NOT NULL CHECK (reward_type IN (
        'discount_percent',   -- e.g., 10% off
        'discount_fixed',     -- e.g., 500 RUB off
        'freebie',           -- Free item/service
        'subscription',       -- Free trial or subscription period
        'cashback',          -- Cashback to chestno.ru balance
        'exclusive_access'   -- Early access, exclusive deals
    )),

    -- Value details
    discount_percent INTEGER CHECK (discount_percent BETWEEN 1 AND 100),
    discount_amount INTEGER,  -- In kopeks for fixed discounts
    min_purchase_amount INTEGER,  -- Minimum order for discount (kopeks)

    -- Points cost
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),

    -- Availability
    is_active BOOLEAN NOT NULL DEFAULT true,
    stock_total INTEGER,  -- NULL = unlimited
    stock_remaining INTEGER,

    -- Redemption limits
    max_per_user INTEGER DEFAULT 1,  -- How many times one user can redeem
    valid_days INTEGER DEFAULT 30,  -- Days until voucher expires after redemption

    -- Images
    image_url TEXT,

    -- Dates
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rewards_catalog_active ON rewards_catalog(is_active, points_cost) WHERE is_active = true;
CREATE INDEX idx_rewards_catalog_partner ON rewards_catalog(partner_id) WHERE is_active = true;

-- =============================================================================
-- USER REWARD REDEMPTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards_catalog(id) ON DELETE CASCADE,

    -- Points spent
    points_spent INTEGER NOT NULL,

    -- Voucher details
    voucher_code TEXT NOT NULL,  -- Generated unique code

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',    -- Valid, not yet used
        'used',      -- Used by customer
        'expired',   -- Past expiration date
        'cancelled'  -- Cancelled (refunded)
    )),

    -- Usage tracking
    used_at TIMESTAMPTZ,

    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemptions_user ON reward_redemptions(user_id, status);
CREATE INDEX idx_redemptions_code ON reward_redemptions(voucher_code);
CREATE INDEX idx_redemptions_expiry ON reward_redemptions(expires_at) WHERE status = 'active';

-- =============================================================================
-- ANTI-ABUSE: Review Quality Requirements
-- =============================================================================
CREATE TABLE IF NOT EXISTS review_quality_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Config name for versioning
    config_version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Base points
    base_points INTEGER NOT NULL DEFAULT 10,  -- Minimum for any approved review

    -- Length bonuses (cumulative)
    min_words_for_bonus INTEGER NOT NULL DEFAULT 50,  -- Words needed for any length bonus
    words_tier_1 INTEGER NOT NULL DEFAULT 100,  -- Short review
    words_tier_1_bonus INTEGER NOT NULL DEFAULT 10,
    words_tier_2 INTEGER NOT NULL DEFAULT 200,  -- Medium review
    words_tier_2_bonus INTEGER NOT NULL DEFAULT 25,
    words_tier_3 INTEGER NOT NULL DEFAULT 400,  -- Detailed review
    words_tier_3_bonus INTEGER NOT NULL DEFAULT 50,

    -- Media bonuses
    photo_bonus INTEGER NOT NULL DEFAULT 15,  -- Per photo, max 3
    photo_max_count INTEGER NOT NULL DEFAULT 3,
    video_bonus INTEGER NOT NULL DEFAULT 30,

    -- Quality bonuses
    verified_purchase_bonus INTEGER NOT NULL DEFAULT 20,
    helpful_vote_bonus INTEGER NOT NULL DEFAULT 3,  -- Per helpful vote
    helpful_vote_max INTEGER NOT NULL DEFAULT 20,  -- Cap on helpful vote bonuses

    -- Anti-abuse limits
    daily_review_limit INTEGER NOT NULL DEFAULT 5,
    weekly_review_limit INTEGER NOT NULL DEFAULT 20,
    min_account_age_days INTEGER NOT NULL DEFAULT 3,
    min_words_for_points INTEGER NOT NULL DEFAULT 30,  -- Below this, no points

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT single_active_config UNIQUE (is_active)
);

-- Insert default config
INSERT INTO review_quality_config (config_version, is_active)
VALUES (1, true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- ANTI-ABUSE: Rate Limiting Tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_review_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Daily tracking
    reviews_today INTEGER NOT NULL DEFAULT 0,
    last_review_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Weekly tracking
    reviews_this_week INTEGER NOT NULL DEFAULT 0,
    week_start_date DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,

    -- Abuse flags
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    flag_reason TEXT,
    flagged_at TIMESTAMPTZ,
    flagged_by UUID REFERENCES auth.users(id),

    -- Cooldown
    cooldown_until TIMESTAMPTZ,  -- Temporary ban from earning points

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_user_rate_limit UNIQUE (user_id)
);

CREATE INDEX idx_rate_limits_flagged ON user_review_rate_limits(is_flagged) WHERE is_flagged = true;

-- =============================================================================
-- ANTI-ABUSE: Suspicious Activity Tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS abuse_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,

    -- Signal type
    signal_type TEXT NOT NULL CHECK (signal_type IN (
        'rapid_submission',      -- Multiple reviews too quickly
        'copy_paste',            -- Similar text to previous reviews
        'suspicious_pattern',    -- AI-detected gaming pattern
        'ip_anomaly',            -- Multiple accounts from same IP
        'vote_manipulation',     -- Self-voting or vote rings
        'low_quality_burst',     -- Many low-quality reviews
        'new_account_abuse'      -- New account with unusual activity
    )),

    -- Signal details
    severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    metadata JSONB,  -- Additional context (IPs, patterns, etc.)

    -- Resolution
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_action TEXT,  -- 'dismissed', 'warning', 'points_revoked', 'banned'

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_abuse_signals_user ON abuse_signals(user_id, created_at DESC);
CREATE INDEX idx_abuse_signals_unresolved ON abuse_signals(resolved, severity) WHERE resolved = false;

-- =============================================================================
-- UPDATE POINTS ACTION TYPES
-- =============================================================================

-- Add new action types to the existing constraint
ALTER TABLE points_transactions DROP CONSTRAINT IF EXISTS points_transactions_action_type_check;
ALTER TABLE points_transactions ADD CONSTRAINT points_transactions_action_type_check
    CHECK (action_type IN (
        -- Existing actions
        'review_submitted',
        'review_approved',
        'review_with_photo',
        'review_with_video',
        'review_helpful_vote',
        'first_review',
        'streak_bonus',
        'profile_completed',
        'referral_bonus',
        'points_redeemed',
        'admin_adjustment',
        'points_expired',
        -- New actions for quality scoring
        'review_quality_bonus',
        'review_length_bonus',
        'verified_purchase_bonus',
        'helpful_votes_bonus',
        'reward_redemption',
        'points_revoked'  -- For anti-abuse
    ));

-- =============================================================================
-- FUNCTIONS: Calculate Review Quality Score
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_review_quality_score(
    p_word_count INTEGER,
    p_photo_count INTEGER,
    p_video_count INTEGER,
    p_is_verified_purchase BOOLEAN
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    config review_quality_config%ROWTYPE;
BEGIN
    -- Get active config
    SELECT * INTO config FROM review_quality_config WHERE is_active = true LIMIT 1;

    IF config IS NULL THEN
        RETURN 50;  -- Default score if no config
    END IF;

    -- Base score from word count (0-40 points)
    IF p_word_count >= config.words_tier_3 THEN
        score := score + 40;
    ELSIF p_word_count >= config.words_tier_2 THEN
        score := score + 30;
    ELSIF p_word_count >= config.words_tier_1 THEN
        score := score + 20;
    ELSIF p_word_count >= config.min_words_for_bonus THEN
        score := score + 10;
    END IF;

    -- Media score (0-30 points)
    score := score + LEAST(p_photo_count, config.photo_max_count) * 10;
    IF p_video_count > 0 THEN
        score := score + 15;
    END IF;

    -- Verified purchase (0-30 points)
    IF p_is_verified_purchase THEN
        score := score + 30;
    END IF;

    RETURN LEAST(100, score);  -- Cap at 100
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTIONS: Calculate Points for Review
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_review_points(
    p_word_count INTEGER,
    p_photo_count INTEGER,
    p_video_count INTEGER,
    p_is_verified_purchase BOOLEAN,
    p_helpful_votes INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    points INTEGER := 0;
    config review_quality_config%ROWTYPE;
BEGIN
    -- Get active config
    SELECT * INTO config FROM review_quality_config WHERE is_active = true LIMIT 1;

    IF config IS NULL THEN
        RETURN 10;  -- Default
    END IF;

    -- Minimum word count check
    IF p_word_count < config.min_words_for_points THEN
        RETURN 0;  -- No points for very short reviews
    END IF;

    -- Base points
    points := config.base_points;

    -- Length bonuses
    IF p_word_count >= config.words_tier_3 THEN
        points := points + config.words_tier_3_bonus;
    ELSIF p_word_count >= config.words_tier_2 THEN
        points := points + config.words_tier_2_bonus;
    ELSIF p_word_count >= config.words_tier_1 THEN
        points := points + config.words_tier_1_bonus;
    END IF;

    -- Photo bonus
    points := points + LEAST(p_photo_count, config.photo_max_count) * config.photo_bonus;

    -- Video bonus
    IF p_video_count > 0 THEN
        points := points + config.video_bonus;
    END IF;

    -- Verified purchase bonus
    IF p_is_verified_purchase THEN
        points := points + config.verified_purchase_bonus;
    END IF;

    -- Helpful votes bonus
    points := points + LEAST(p_helpful_votes * config.helpful_vote_bonus, config.helpful_vote_max);

    RETURN points;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTIONS: Check Rate Limits
-- =============================================================================
CREATE OR REPLACE FUNCTION check_review_rate_limit(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    limits user_review_rate_limits%ROWTYPE;
    config review_quality_config%ROWTYPE;
    user_profile profiles%ROWTYPE;
    account_age_days INTEGER;
    result JSONB;
BEGIN
    -- Get config
    SELECT * INTO config FROM review_quality_config WHERE is_active = true LIMIT 1;

    -- Get or create rate limit record
    SELECT * INTO limits FROM user_review_rate_limits WHERE user_id = p_user_id;

    IF limits IS NULL THEN
        INSERT INTO user_review_rate_limits (user_id)
        VALUES (p_user_id)
        RETURNING * INTO limits;
    END IF;

    -- Check cooldown
    IF limits.cooldown_until IS NOT NULL AND limits.cooldown_until > now() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'cooldown',
            'cooldown_until', limits.cooldown_until
        );
    END IF;

    -- Check if flagged
    IF limits.is_flagged THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'flagged',
            'flag_reason', limits.flag_reason
        );
    END IF;

    -- Reset daily counter if new day
    IF limits.last_review_date < CURRENT_DATE THEN
        UPDATE user_review_rate_limits
        SET reviews_today = 0, last_review_date = CURRENT_DATE
        WHERE user_id = p_user_id;
        limits.reviews_today := 0;
    END IF;

    -- Reset weekly counter if new week
    IF limits.week_start_date < date_trunc('week', CURRENT_DATE)::date THEN
        UPDATE user_review_rate_limits
        SET reviews_this_week = 0, week_start_date = date_trunc('week', CURRENT_DATE)::date
        WHERE user_id = p_user_id;
        limits.reviews_this_week := 0;
    END IF;

    -- Check daily limit
    IF limits.reviews_today >= config.daily_review_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'daily_limit',
            'limit', config.daily_review_limit,
            'current', limits.reviews_today
        );
    END IF;

    -- Check weekly limit
    IF limits.reviews_this_week >= config.weekly_review_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'weekly_limit',
            'limit', config.weekly_review_limit,
            'current', limits.reviews_this_week
        );
    END IF;

    -- Check account age
    SELECT * INTO user_profile FROM profiles WHERE id = p_user_id;
    IF user_profile.created_at IS NOT NULL THEN
        account_age_days := EXTRACT(DAY FROM now() - user_profile.created_at);
        IF account_age_days < config.min_account_age_days THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', 'account_too_new',
                'min_age_days', config.min_account_age_days,
                'current_age_days', account_age_days
            );
        END IF;
    END IF;

    -- All checks passed
    RETURN jsonb_build_object(
        'allowed', true,
        'daily_remaining', config.daily_review_limit - limits.reviews_today,
        'weekly_remaining', config.weekly_review_limit - limits.reviews_this_week
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTIONS: Increment Rate Limit Counters
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_review_rate_limit(p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO user_review_rate_limits (user_id, reviews_today, reviews_this_week)
    VALUES (p_user_id, 1, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET reviews_today = CASE
            WHEN user_review_rate_limits.last_review_date < CURRENT_DATE
            THEN 1
            ELSE user_review_rate_limits.reviews_today + 1
        END,
        reviews_this_week = CASE
            WHEN user_review_rate_limits.week_start_date < date_trunc('week', CURRENT_DATE)::date
            THEN 1
            ELSE user_review_rate_limits.reviews_this_week + 1
        END,
        last_review_date = CURRENT_DATE,
        week_start_date = date_trunc('week', CURRENT_DATE)::date,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTIONS: Generate Unique Voucher Code
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- Removed confusing chars (0,O,1,I)
    code TEXT := '';
    i INTEGER;
BEGIN
    -- Format: XXXX-XXXX-XXXX (12 chars)
    FOR i IN 1..12 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        IF i IN (4, 8) THEN
            code := code || '-';
        END IF;
    END LOOP;

    RETURN code;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE reward_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_quality_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_review_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_signals ENABLE ROW LEVEL SECURITY;

-- Partners: Public read for active
CREATE POLICY "Anyone can view active partners"
    ON reward_partners FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role manages partners"
    ON reward_partners FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Rewards catalog: Public read for active
CREATE POLICY "Anyone can view active rewards"
    ON rewards_catalog FOR SELECT
    USING (is_active = true AND (available_from IS NULL OR available_from <= now())
           AND (available_until IS NULL OR available_until >= now()));

CREATE POLICY "Service role manages rewards"
    ON rewards_catalog FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Redemptions: Users see own
CREATE POLICY "Users view own redemptions"
    ON reward_redemptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages redemptions"
    ON reward_redemptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Quality config: Public read
CREATE POLICY "Anyone can view quality config"
    ON review_quality_config FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role manages config"
    ON review_quality_config FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Rate limits: Users see own
CREATE POLICY "Users view own rate limits"
    ON user_review_rate_limits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages rate limits"
    ON user_review_rate_limits FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Abuse signals: Admin only
CREATE POLICY "Service role manages abuse signals"
    ON abuse_signals FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- SEED DATA: Sample Partners
-- =============================================================================
INSERT INTO reward_partners (name, slug, description, category, priority) VALUES
('Яндекс Маркет', 'yandex-market', 'Скидки на товары маркетплейса', 'ecommerce', 100),
('Литрес', 'litres', 'Электронные книги и аудиокниги', 'education', 90),
('Кинопоиск', 'kinopoisk', 'Подписка на онлайн-кинотеатр', 'entertainment', 85),
('Delivery Club', 'delivery-club', 'Доставка еды из ресторанов', 'food', 80),
('Skillbox', 'skillbox', 'Онлайн-курсы и обучение', 'education', 75)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- SEED DATA: Sample Rewards
-- =============================================================================
INSERT INTO rewards_catalog (
    partner_id, title, description, reward_type,
    discount_percent, points_cost, max_per_user, valid_days
)
SELECT
    p.id,
    '10% скидка на первый заказ',
    'Скидка 10% на любой заказ от 1000 рублей',
    'discount_percent',
    10,
    100,
    1,
    30
FROM reward_partners p WHERE p.slug = 'yandex-market'
ON CONFLICT DO NOTHING;

INSERT INTO rewards_catalog (
    partner_id, title, description, reward_type,
    discount_amount, min_purchase_amount, points_cost, max_per_user, valid_days
)
SELECT
    p.id,
    'Скидка 200 рублей',
    'Скидка на любую книгу от 500 рублей',
    'discount_fixed',
    20000,  -- 200 RUB in kopeks
    50000,  -- 500 RUB min
    150,
    3,
    30
FROM reward_partners p WHERE p.slug = 'litres'
ON CONFLICT DO NOTHING;

INSERT INTO rewards_catalog (
    partner_id, title, description, reward_type,
    points_cost, max_per_user, valid_days
)
SELECT
    p.id,
    '7 дней подписки бесплатно',
    'Пробная подписка на Кинопоиск',
    'subscription',
    200,
    1,
    14
FROM reward_partners p WHERE p.slug = 'kinopoisk'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE reward_partners IS 'Partner companies providing rewards/discounts for points';
COMMENT ON TABLE rewards_catalog IS 'Available rewards that can be redeemed with points';
COMMENT ON TABLE reward_redemptions IS 'User redemption history with voucher codes';
COMMENT ON TABLE review_quality_config IS 'Configuration for quality-based points calculation';
COMMENT ON TABLE user_review_rate_limits IS 'Per-user rate limiting for anti-abuse';
COMMENT ON TABLE abuse_signals IS 'Suspicious activity detection log';
COMMENT ON FUNCTION calculate_review_quality_score IS 'Calculate 0-100 quality score for a review';
COMMENT ON FUNCTION calculate_review_points IS 'Calculate points to award based on review quality';
COMMENT ON FUNCTION check_review_rate_limit IS 'Check if user can submit review (anti-abuse)';
