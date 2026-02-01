-- Migration: QR Code Gamification System
-- Adds scan-based tiers, achievements, rewards, and monthly leaderboards
-- Separate from the existing loyalty points system (which is review-based)

-- =============================================================================
-- QR SCAN TIERS (Consumer-facing, based on scan count)
-- =============================================================================
-- Tier definitions are stored in code, but we track user progress here

CREATE TYPE qr_scan_tier AS ENUM ('none', 'bronze', 'silver', 'gold');

CREATE TABLE IF NOT EXISTS qr_scanner_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Scan statistics
    total_scans INTEGER NOT NULL DEFAULT 0,
    unique_products_scanned INTEGER NOT NULL DEFAULT 0,
    unique_organizations_scanned INTEGER NOT NULL DEFAULT 0,

    -- Current tier (computed from total_scans, stored for performance)
    current_tier qr_scan_tier NOT NULL DEFAULT 'none',
    tier_achieved_at TIMESTAMPTZ,

    -- Monthly tracking for leaderboards
    scans_this_month INTEGER NOT NULL DEFAULT 0,
    month_start DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::DATE,

    -- Streaks
    current_streak_days INTEGER NOT NULL DEFAULT 0,
    longest_streak_days INTEGER NOT NULL DEFAULT 0,
    last_scan_date DATE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_qr_scanner_user UNIQUE (user_id)
);

-- Indexes for leaderboard and lookup queries
CREATE INDEX idx_qr_scanner_total_scans ON qr_scanner_profiles(total_scans DESC);
CREATE INDEX idx_qr_scanner_monthly ON qr_scanner_profiles(scans_this_month DESC, month_start);
CREATE INDEX idx_qr_scanner_tier ON qr_scanner_profiles(current_tier);
CREATE INDEX idx_qr_scanner_user ON qr_scanner_profiles(user_id);

-- =============================================================================
-- SCAN HISTORY (Detailed log of each scan for achievement tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS qr_scan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- What was scanned
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,

    -- Scan context
    scan_type TEXT NOT NULL DEFAULT 'product' CHECK (scan_type IN ('product', 'organization', 'marketing', 'review_request')),

    -- Points awarded for this scan (if any)
    points_awarded INTEGER NOT NULL DEFAULT 0,

    -- Location (optional, for geo-achievements)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    city TEXT,

    -- Timestamp
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_history_user ON qr_scan_history(user_id);
CREATE INDEX idx_scan_history_user_date ON qr_scan_history(user_id, scanned_at DESC);
CREATE INDEX idx_scan_history_org ON qr_scan_history(organization_id);
CREATE INDEX idx_scan_history_product ON qr_scan_history(product_id);
CREATE INDEX idx_scan_history_month ON qr_scan_history(user_id, date_trunc('month', scanned_at));

-- =============================================================================
-- ACHIEVEMENTS SYSTEM
-- =============================================================================
CREATE TABLE IF NOT EXISTS qr_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Achievement identity
    code TEXT NOT NULL UNIQUE,  -- e.g., 'first_scan', 'scan_10_products', 'category_explorer'
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ru TEXT NOT NULL,
    description_en TEXT NOT NULL,

    -- Visual
    icon TEXT NOT NULL DEFAULT 'trophy',  -- Lucide icon name
    badge_color TEXT NOT NULL DEFAULT '#FFD700',

    -- Achievement criteria (JSON for flexibility)
    -- Examples:
    -- {"type": "total_scans", "threshold": 5}
    -- {"type": "unique_organizations", "threshold": 10}
    -- {"type": "streak_days", "threshold": 7}
    -- {"type": "category_scans", "category": "food", "threshold": 20}
    criteria JSONB NOT NULL,

    -- Reward on achievement
    points_reward INTEGER NOT NULL DEFAULT 0,

    -- Achievement rarity/tier
    rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),

    -- Display order
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial achievements
INSERT INTO qr_achievements (code, name_ru, name_en, description_ru, description_en, icon, badge_color, criteria, points_reward, rarity, sort_order) VALUES
-- Scan count achievements (tier milestones)
('tier_bronze', 'Бронзовый сканер', 'Bronze Scanner', 'Отсканируйте 5 QR-кодов', 'Scan 5 QR codes', 'award', '#CD7F32', '{"type": "total_scans", "threshold": 5}', 50, 'common', 1),
('tier_silver', 'Серебряный сканер', 'Silver Scanner', 'Отсканируйте 20 QR-кодов', 'Scan 20 QR codes', 'star', '#C0C0C0', '{"type": "total_scans", "threshold": 20}', 150, 'uncommon', 2),
('tier_gold', 'Золотой сканер', 'Gold Scanner', 'Отсканируйте 50 QR-кодов', 'Scan 50 QR codes', 'trophy', '#FFD700', '{"type": "total_scans", "threshold": 50}', 500, 'rare', 3),

-- First actions
('first_scan', 'Первый шаг', 'First Step', 'Выполните первое сканирование', 'Complete your first scan', 'scan', '#4CAF50', '{"type": "total_scans", "threshold": 1}', 10, 'common', 10),
('first_review_after_scan', 'Голос покупателя', 'Customer Voice', 'Оставьте отзыв после сканирования', 'Leave a review after scanning', 'message-square', '#2196F3', '{"type": "review_after_scan", "threshold": 1}', 25, 'common', 11),

-- Explorer achievements
('org_explorer_5', 'Исследователь', 'Explorer', 'Отсканируйте товары 5 разных компаний', 'Scan products from 5 different companies', 'compass', '#9C27B0', '{"type": "unique_organizations", "threshold": 5}', 30, 'common', 20),
('org_explorer_20', 'Путешественник', 'Traveler', 'Отсканируйте товары 20 разных компаний', 'Scan products from 20 different companies', 'map', '#673AB7', '{"type": "unique_organizations", "threshold": 20}', 100, 'uncommon', 21),
('org_explorer_50', 'Мировой гражданин', 'World Citizen', 'Отсканируйте товары 50 разных компаний', 'Scan products from 50 different companies', 'globe', '#3F51B5', '{"type": "unique_organizations", "threshold": 50}', 300, 'rare', 22),

-- Streak achievements
('streak_3', 'Трехдневка', 'Three Day Streak', 'Сканируйте 3 дня подряд', 'Scan for 3 consecutive days', 'flame', '#FF5722', '{"type": "streak_days", "threshold": 3}', 20, 'common', 30),
('streak_7', 'Недельный марафон', 'Week Warrior', 'Сканируйте 7 дней подряд', 'Scan for 7 consecutive days', 'zap', '#FF9800', '{"type": "streak_days", "threshold": 7}', 75, 'uncommon', 31),
('streak_30', 'Месячный чемпион', 'Monthly Champion', 'Сканируйте 30 дней подряд', 'Scan for 30 consecutive days', 'crown', '#FFC107', '{"type": "streak_days", "threshold": 30}', 500, 'epic', 32),

-- Special achievements
('night_owl', 'Ночная сова', 'Night Owl', 'Отсканируйте QR-код после полуночи', 'Scan a QR code after midnight', 'moon', '#1A237E', '{"type": "time_based", "condition": "night"}', 15, 'uncommon', 40),
('early_bird', 'Ранняя пташка', 'Early Bird', 'Отсканируйте QR-код до 7 утра', 'Scan a QR code before 7 AM', 'sunrise', '#FFA726', '{"type": "time_based", "condition": "early"}', 15, 'uncommon', 41),
('weekend_scanner', 'Выходной день', 'Weekend Scanner', 'Отсканируйте 10 QR-кодов в выходные', 'Scan 10 QR codes on weekends', 'calendar', '#26A69A', '{"type": "weekend_scans", "threshold": 10}', 30, 'common', 42)

ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- USER ACHIEVEMENTS (Tracks which achievements each user has earned)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_qr_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES qr_achievements(id) ON DELETE CASCADE,

    -- When earned
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Progress at time of earning (for display)
    progress_value INTEGER NOT NULL DEFAULT 0,

    -- Whether user has seen this achievement
    is_seen BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_qr_achievements(user_id);
CREATE INDEX idx_user_achievements_unseen ON user_qr_achievements(user_id, is_seen) WHERE is_seen = false;

-- =============================================================================
-- REWARDS SYSTEM
-- =============================================================================
CREATE TABLE IF NOT EXISTS qr_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reward identity
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ru TEXT NOT NULL,
    description_en TEXT NOT NULL,

    -- Reward type
    reward_type TEXT NOT NULL CHECK (reward_type IN (
        'discount_code',      -- Partner discount code
        'early_access',       -- Early access to features/products
        'certification_pdf',  -- Downloadable certificate
        'premium_feature',    -- Temporary premium access
        'physical_badge',     -- Physical badge request
        'partner_offer'       -- Partner-specific offer
    )),

    -- Tier requirement (minimum tier to claim)
    required_tier qr_scan_tier NOT NULL DEFAULT 'bronze',

    -- Points cost (0 = free with tier)
    points_cost INTEGER NOT NULL DEFAULT 0,

    -- Reward value/data (JSON)
    -- For discount_code: {"discount_percent": 10, "partner_id": "uuid", "valid_days": 30}
    -- For certification_pdf: {"template": "scanner_certificate", "tier": "gold"}
    -- For early_access: {"feature": "beta_features", "duration_days": 90}
    reward_data JSONB NOT NULL DEFAULT '{}',

    -- Availability
    total_available INTEGER,  -- NULL = unlimited
    claimed_count INTEGER NOT NULL DEFAULT 0,

    -- Validity period
    available_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    available_until TIMESTAMPTZ,

    -- Partner association (optional)
    partner_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial rewards
INSERT INTO qr_rewards (code, name_ru, name_en, description_ru, description_en, reward_type, required_tier, points_cost, reward_data) VALUES
-- Tier-based rewards (free with tier)
('bronze_certificate', 'Сертификат Бронзового сканера', 'Bronze Scanner Certificate', 'Скачайте PDF-сертификат бронзового уровня', 'Download Bronze level PDF certificate', 'certification_pdf', 'bronze', 0, '{"template": "bronze_scanner", "tier": "bronze"}'),
('silver_certificate', 'Сертификат Серебряного сканера', 'Silver Scanner Certificate', 'Скачайте PDF-сертификат серебряного уровня', 'Download Silver level PDF certificate', 'certification_pdf', 'silver', 0, '{"template": "silver_scanner", "tier": "silver"}'),
('gold_certificate', 'Сертификат Золотого сканера', 'Gold Scanner Certificate', 'Скачайте PDF-сертификат золотого уровня', 'Download Gold level PDF certificate', 'certification_pdf', 'gold', 0, '{"template": "gold_scanner", "tier": "gold"}'),

-- Points-based rewards
('early_access_beta', 'Ранний доступ к бета-функциям', 'Beta Features Early Access', 'Получите доступ к новым функциям раньше всех', 'Get access to new features before everyone else', 'early_access', 'silver', 100, '{"feature": "beta_features", "duration_days": 30}'),
('premium_week', 'Неделя премиума', 'Premium Week', 'Бесплатная неделя премиум-функций', 'Free week of premium features', 'premium_feature', 'bronze', 200, '{"feature": "premium", "duration_days": 7}')

ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- USER CLAIMED REWARDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_claimed_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES qr_rewards(id) ON DELETE CASCADE,

    -- Claim details
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    points_spent INTEGER NOT NULL DEFAULT 0,

    -- Generated reward data (e.g., actual discount code, certificate URL)
    claim_data JSONB NOT NULL DEFAULT '{}',

    -- For discount codes: when used
    redeemed_at TIMESTAMPTZ,

    -- Expiration
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_claimed_rewards_user ON user_claimed_rewards(user_id);
CREATE INDEX idx_claimed_rewards_reward ON user_claimed_rewards(reward_id);

-- =============================================================================
-- MONTHLY LEADERBOARDS (Archived for historical viewing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS qr_monthly_leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Month identifier
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

    -- User ranking
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,

    -- Stats for that month
    scans_count INTEGER NOT NULL,
    unique_products INTEGER NOT NULL DEFAULT 0,
    unique_organizations INTEGER NOT NULL DEFAULT 0,

    -- Prizes awarded (if any)
    prize_awarded TEXT,
    prize_claimed_at TIMESTAMPTZ,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_monthly_rank UNIQUE (year, month, rank),
    CONSTRAINT unique_user_month UNIQUE (year, month, user_id)
);

CREATE INDEX idx_monthly_leaderboard_month ON qr_monthly_leaderboards(year, month);
CREATE INDEX idx_monthly_leaderboard_user ON qr_monthly_leaderboards(user_id);

-- =============================================================================
-- PARTNER DISCOUNT CODES (For reward fulfillment)
-- =============================================================================
CREATE TABLE IF NOT EXISTS partner_discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Partner
    partner_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Code pool
    discount_code TEXT NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),

    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ NOT NULL,

    -- Usage
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,

    -- Linked reward claim
    claimed_reward_id UUID REFERENCES user_claimed_rewards(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_codes_org ON partner_discount_codes(partner_organization_id);
CREATE INDEX idx_partner_codes_available ON partner_discount_codes(partner_organization_id, is_used, valid_until) WHERE is_used = false;

-- =============================================================================
-- FUNCTIONS: Tier Calculation
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_qr_scan_tier(scans INTEGER)
RETURNS qr_scan_tier AS $$
BEGIN
    IF scans >= 50 THEN
        RETURN 'gold';
    ELSIF scans >= 20 THEN
        RETURN 'silver';
    ELSIF scans >= 5 THEN
        RETURN 'bronze';
    ELSE
        RETURN 'none';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTIONS: Update Scanner Profile on Scan
-- =============================================================================
CREATE OR REPLACE FUNCTION record_qr_scan(
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_qr_code_id UUID DEFAULT NULL,
    p_scan_type TEXT DEFAULT 'product',
    p_latitude DECIMAL DEFAULT NULL,
    p_longitude DECIMAL DEFAULT NULL,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE (
    scan_id UUID,
    new_tier qr_scan_tier,
    tier_changed BOOLEAN,
    new_achievements UUID[],
    points_earned INTEGER
) AS $$
DECLARE
    v_profile qr_scanner_profiles%ROWTYPE;
    v_scan_id UUID;
    v_old_tier qr_scan_tier;
    v_new_tier qr_scan_tier;
    v_tier_changed BOOLEAN := false;
    v_points INTEGER := 0;
    v_new_achievements UUID[] := '{}';
    v_achievement RECORD;
    v_is_new_org BOOLEAN := false;
    v_is_new_product BOOLEAN := false;
    v_current_month DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Ensure profile exists
    INSERT INTO qr_scanner_profiles (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get current profile with lock
    SELECT * INTO v_profile
    FROM qr_scanner_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    v_old_tier := v_profile.current_tier;

    -- Check if this is a new org/product
    IF p_organization_id IS NOT NULL THEN
        SELECT NOT EXISTS (
            SELECT 1 FROM qr_scan_history
            WHERE user_id = p_user_id AND organization_id = p_organization_id
        ) INTO v_is_new_org;
    END IF;

    IF p_product_id IS NOT NULL THEN
        SELECT NOT EXISTS (
            SELECT 1 FROM qr_scan_history
            WHERE user_id = p_user_id AND product_id = p_product_id
        ) INTO v_is_new_product;
    END IF;

    -- Base points for scanning
    v_points := 1;
    IF v_is_new_org THEN
        v_points := v_points + 2;  -- Bonus for new organization
    END IF;
    IF v_is_new_product THEN
        v_points := v_points + 1;  -- Bonus for new product
    END IF;

    -- Record the scan
    INSERT INTO qr_scan_history (
        user_id, organization_id, product_id, qr_code_id,
        scan_type, points_awarded, latitude, longitude, city
    ) VALUES (
        p_user_id, p_organization_id, p_product_id, p_qr_code_id,
        p_scan_type, v_points, p_latitude, p_longitude, p_city
    )
    RETURNING id INTO v_scan_id;

    -- Reset monthly counter if new month
    IF v_profile.month_start < v_current_month THEN
        v_profile.scans_this_month := 0;
        v_profile.month_start := v_current_month;
    END IF;

    -- Update streak
    IF v_profile.last_scan_date IS NULL THEN
        v_profile.current_streak_days := 1;
    ELSIF v_profile.last_scan_date = v_today THEN
        -- Same day, no streak change
        NULL;
    ELSIF v_profile.last_scan_date = v_today - 1 THEN
        -- Consecutive day
        v_profile.current_streak_days := v_profile.current_streak_days + 1;
    ELSE
        -- Streak broken
        v_profile.current_streak_days := 1;
    END IF;

    IF v_profile.current_streak_days > v_profile.longest_streak_days THEN
        v_profile.longest_streak_days := v_profile.current_streak_days;
    END IF;

    -- Update profile counters
    UPDATE qr_scanner_profiles SET
        total_scans = total_scans + 1,
        unique_products_scanned = unique_products_scanned + (CASE WHEN v_is_new_product THEN 1 ELSE 0 END),
        unique_organizations_scanned = unique_organizations_scanned + (CASE WHEN v_is_new_org THEN 1 ELSE 0 END),
        scans_this_month = v_profile.scans_this_month + 1,
        month_start = v_profile.month_start,
        current_streak_days = v_profile.current_streak_days,
        longest_streak_days = v_profile.longest_streak_days,
        last_scan_date = v_today,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Refresh profile to get updated values
    SELECT * INTO v_profile
    FROM qr_scanner_profiles
    WHERE user_id = p_user_id;

    -- Calculate new tier
    v_new_tier := calculate_qr_scan_tier(v_profile.total_scans);

    IF v_new_tier != v_old_tier THEN
        v_tier_changed := true;
        UPDATE qr_scanner_profiles SET
            current_tier = v_new_tier,
            tier_achieved_at = now()
        WHERE user_id = p_user_id;
    END IF;

    -- Check for new achievements
    FOR v_achievement IN
        SELECT a.* FROM qr_achievements a
        WHERE a.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM user_qr_achievements ua
            WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
        )
    LOOP
        -- Check achievement criteria
        IF (v_achievement.criteria->>'type' = 'total_scans' AND
            v_profile.total_scans >= (v_achievement.criteria->>'threshold')::INTEGER) OR
           (v_achievement.criteria->>'type' = 'unique_organizations' AND
            v_profile.unique_organizations_scanned >= (v_achievement.criteria->>'threshold')::INTEGER) OR
           (v_achievement.criteria->>'type' = 'streak_days' AND
            v_profile.current_streak_days >= (v_achievement.criteria->>'threshold')::INTEGER)
        THEN
            -- Award achievement
            INSERT INTO user_qr_achievements (user_id, achievement_id, progress_value)
            VALUES (p_user_id, v_achievement.id, v_profile.total_scans);

            v_new_achievements := array_append(v_new_achievements, v_achievement.id);
            v_points := v_points + v_achievement.points_reward;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_scan_id, v_new_tier, v_tier_changed, v_new_achievements, v_points;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTIONS: Archive Monthly Leaderboard
-- =============================================================================
CREATE OR REPLACE FUNCTION archive_monthly_leaderboard(
    p_year INTEGER,
    p_month INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Archive top 100 users for the month
    INSERT INTO qr_monthly_leaderboards (year, month, user_id, rank, scans_count, unique_products, unique_organizations)
    SELECT
        p_year,
        p_month,
        user_id,
        ROW_NUMBER() OVER (ORDER BY scans_this_month DESC, total_scans DESC),
        scans_this_month,
        unique_products_scanned,
        unique_organizations_scanned
    FROM qr_scanner_profiles
    WHERE month_start = make_date(p_year, p_month, 1)
      AND scans_this_month > 0
    ORDER BY scans_this_month DESC
    LIMIT 100
    ON CONFLICT (year, month, user_id) DO UPDATE SET
        rank = EXCLUDED.rank,
        scans_count = EXCLUDED.scans_count;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE qr_scanner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_qr_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_claimed_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_monthly_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_discount_codes ENABLE ROW LEVEL SECURITY;

-- Scanner profiles: Users can view their own, public can see for leaderboard
CREATE POLICY "Users can view own scanner profile"
    ON qr_scanner_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Public can view scanner profiles for leaderboard"
    ON qr_scanner_profiles FOR SELECT
    USING (true);

CREATE POLICY "Service role manages scanner profiles"
    ON qr_scanner_profiles FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Scan history: Users can only view their own
CREATE POLICY "Users can view own scan history"
    ON qr_scan_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages scan history"
    ON qr_scan_history FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Achievements: Public read, service role write
CREATE POLICY "Public can view achievements"
    ON qr_achievements FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role manages achievements"
    ON qr_achievements FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- User achievements: Users view own, public for profiles
CREATE POLICY "Users can view own achievements"
    ON user_qr_achievements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Public can view user achievements"
    ON user_qr_achievements FOR SELECT
    USING (true);

CREATE POLICY "Service role manages user achievements"
    ON user_qr_achievements FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Rewards: Public read active, service role write
CREATE POLICY "Public can view active rewards"
    ON qr_rewards FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role manages rewards"
    ON qr_rewards FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Claimed rewards: Users view own only
CREATE POLICY "Users can view own claimed rewards"
    ON user_claimed_rewards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages claimed rewards"
    ON user_claimed_rewards FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Monthly leaderboards: Public read
CREATE POLICY "Public can view monthly leaderboards"
    ON qr_monthly_leaderboards FOR SELECT
    USING (true);

CREATE POLICY "Service role manages leaderboards"
    ON qr_monthly_leaderboards FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Partner codes: Only service role (assigned via reward claim)
CREATE POLICY "Service role manages partner codes"
    ON partner_discount_codes FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE qr_scanner_profiles IS 'Tracks user progress in QR scanning gamification (separate from review-based loyalty)';
COMMENT ON TABLE qr_scan_history IS 'Detailed log of each QR code scan for achievement tracking';
COMMENT ON TABLE qr_achievements IS 'Definitions of all possible achievements users can earn';
COMMENT ON TABLE user_qr_achievements IS 'Tracks which achievements each user has earned';
COMMENT ON TABLE qr_rewards IS 'Rewards that users can claim based on tier or points';
COMMENT ON TABLE user_claimed_rewards IS 'History of rewards claimed by users';
COMMENT ON TABLE qr_monthly_leaderboards IS 'Archived monthly leaderboard rankings';
COMMENT ON TABLE partner_discount_codes IS 'Pool of discount codes from partners for reward fulfillment';

COMMENT ON FUNCTION calculate_qr_scan_tier IS 'Calculates tier based on total scan count: none (<5), bronze (5+), silver (20+), gold (50+)';
COMMENT ON FUNCTION record_qr_scan IS 'Records a scan and returns tier changes, new achievements, and points earned';
COMMENT ON FUNCTION archive_monthly_leaderboard IS 'Archives the top 100 users for a given month';
