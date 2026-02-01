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
-- Migration: Review Helpfulness Voting System
-- Extends existing helpful votes to support up/down voting with trust weighting

-- =============================================================================
-- 1. EXTEND review_helpful_votes TO SUPPORT UP/DOWN VOTES
-- =============================================================================

-- Add vote_type column to existing table
ALTER TABLE review_helpful_votes
    ADD COLUMN IF NOT EXISTS vote_type TEXT NOT NULL DEFAULT 'up'
    CHECK (vote_type IN ('up', 'down'));

-- Add voter trust weight (verified purchasers get higher weight)
ALTER TABLE review_helpful_votes
    ADD COLUMN IF NOT EXISTS is_verified_voter BOOLEAN NOT NULL DEFAULT false;

-- Add weight column for computed trust score
ALTER TABLE review_helpful_votes
    ADD COLUMN IF NOT EXISTS vote_weight NUMERIC(3,2) NOT NULL DEFAULT 1.0;

-- =============================================================================
-- 2. ADD VOTE COUNTS TO REVIEWS TABLE
-- =============================================================================

-- Add separate up/down counts for efficient querying
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS upvote_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS downvote_count INTEGER NOT NULL DEFAULT 0;

-- Add Wilson score for sorting (precomputed for performance)
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS wilson_score NUMERIC(10,8) NOT NULL DEFAULT 0.0;

-- Add verified purchase flag to reviews
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS is_verified_purchase BOOLEAN NOT NULL DEFAULT false;

-- =============================================================================
-- 3. CREATE VERIFIED PURCHASES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS verified_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,

    -- Purchase evidence
    verification_method TEXT NOT NULL CHECK (verification_method IN (
        'qr_scan',           -- Scanned product QR code
        'receipt_upload',    -- Uploaded receipt
        'order_integration', -- Connected order system
        'manual_approval'    -- Admin verified
    )),
    evidence_data JSONB,     -- Method-specific data (receipt_url, order_id, etc.)

    -- Verification status
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_by UUID REFERENCES auth.users(id), -- For manual approvals

    -- Timestamps
    purchase_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate verifications per user/product combo
    CONSTRAINT unique_verified_purchase UNIQUE (user_id, organization_id, product_id)
);

CREATE INDEX idx_verified_purchases_user ON verified_purchases(user_id);
CREATE INDEX idx_verified_purchases_org ON verified_purchases(organization_id);
CREATE INDEX idx_verified_purchases_product ON verified_purchases(product_id);

-- =============================================================================
-- 4. WILSON SCORE CALCULATION FUNCTION
-- =============================================================================

-- Wilson score confidence interval for binomial distribution
-- Uses 95% confidence (z = 1.96, z^2 = 3.8416)
-- Formula: (p + z^2/(2n) - z * sqrt((p*(1-p) + z^2/(4n))/n)) / (1 + z^2/n)
-- Where p = positive / total, n = total votes

CREATE OR REPLACE FUNCTION calculate_wilson_score(
    positive INTEGER,
    negative INTEGER
) RETURNS NUMERIC(10,8) AS $$
DECLARE
    n INTEGER;
    p NUMERIC;
    z CONSTANT NUMERIC := 1.96;
    z2 CONSTANT NUMERIC := 3.8416;
BEGIN
    n := positive + negative;

    -- No votes = 0 score
    IF n = 0 THEN
        RETURN 0.0;
    END IF;

    p := positive::NUMERIC / n;

    -- Wilson score lower bound
    RETURN (
        (p + z2 / (2 * n) - z * SQRT((p * (1 - p) + z2 / (4 * n)) / n))
        / (1 + z2 / n)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 5. VOTE WEIGHT CALCULATION
-- =============================================================================

-- Determines vote weight based on voter trust factors
CREATE OR REPLACE FUNCTION calculate_vote_weight(
    p_voter_user_id UUID,
    p_review_organization_id UUID,
    p_review_product_id UUID
) RETURNS NUMERIC(3,2) AS $$
DECLARE
    base_weight NUMERIC := 1.0;
    voter_tier TEXT;
    has_verified_purchase BOOLEAN;
BEGIN
    -- Check if voter has verified purchase for this product/organization
    SELECT EXISTS (
        SELECT 1 FROM verified_purchases
        WHERE user_id = p_voter_user_id
          AND organization_id = p_review_organization_id
          AND (
              p_review_product_id IS NULL
              OR product_id IS NULL
              OR product_id = p_review_product_id
          )
    ) INTO has_verified_purchase;

    -- Verified purchasers get 50% more weight
    IF has_verified_purchase THEN
        base_weight := base_weight + 0.5;
    END IF;

    -- Get voter's loyalty tier
    SELECT current_tier INTO voter_tier
    FROM user_loyalty_profiles
    WHERE user_id = p_voter_user_id;

    -- Tier bonuses
    CASE voter_tier
        WHEN 'platinum' THEN base_weight := base_weight + 0.3;
        WHEN 'gold' THEN base_weight := base_weight + 0.2;
        WHEN 'silver' THEN base_weight := base_weight + 0.1;
        ELSE NULL;
    END CASE;

    -- Cap at 2.0
    RETURN LEAST(base_weight, 2.0);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 6. TRIGGER: UPDATE REVIEW COUNTS AND WILSON SCORE
-- =============================================================================

CREATE OR REPLACE FUNCTION update_review_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
    review_rec RECORD;
    total_up INTEGER;
    total_down INTEGER;
BEGIN
    -- Determine which review_id to update
    IF TG_OP = 'DELETE' THEN
        -- Get current counts with weighted votes
        SELECT
            COALESCE(SUM(CASE WHEN vote_type = 'up' THEN vote_weight ELSE 0 END), 0)::INTEGER,
            COALESCE(SUM(CASE WHEN vote_type = 'down' THEN vote_weight ELSE 0 END), 0)::INTEGER
        INTO total_up, total_down
        FROM review_helpful_votes
        WHERE review_id = OLD.review_id;

        -- Update the review
        UPDATE reviews SET
            upvote_count = total_up,
            downvote_count = total_down,
            helpful_count = total_up, -- Maintain backward compatibility
            wilson_score = calculate_wilson_score(total_up, total_down),
            updated_at = now()
        WHERE id = OLD.review_id;

        RETURN OLD;
    ELSE
        -- Get current counts with weighted votes
        SELECT
            COALESCE(SUM(CASE WHEN vote_type = 'up' THEN vote_weight ELSE 0 END), 0)::INTEGER,
            COALESCE(SUM(CASE WHEN vote_type = 'down' THEN vote_weight ELSE 0 END), 0)::INTEGER
        INTO total_up, total_down
        FROM review_helpful_votes
        WHERE review_id = NEW.review_id;

        -- Update the review
        UPDATE reviews SET
            upvote_count = total_up,
            downvote_count = total_down,
            helpful_count = total_up, -- Maintain backward compatibility
            wilson_score = calculate_wilson_score(total_up, total_down),
            updated_at = now()
        WHERE id = NEW.review_id;

        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_update_review_vote_counts ON review_helpful_votes;

CREATE TRIGGER trg_update_review_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON review_helpful_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_review_vote_counts();

-- =============================================================================
-- 7. FUNCTION: CAST VOTE (WITH ANTI-MANIPULATION)
-- =============================================================================

CREATE OR REPLACE FUNCTION cast_review_vote(
    p_review_id UUID,
    p_vote_type TEXT  -- 'up', 'down', or 'none' to remove
) RETURNS JSONB AS $$
DECLARE
    voter_id UUID;
    review_rec RECORD;
    existing_vote RECORD;
    vote_weight NUMERIC(3,2);
    is_verified BOOLEAN;
    result JSONB;
BEGIN
    -- Get current user
    voter_id := auth.uid();

    IF voter_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Get review info
    SELECT id, author_user_id, organization_id, product_id, status
    INTO review_rec
    FROM reviews
    WHERE id = p_review_id;

    IF review_rec IS NULL THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    -- Only allow voting on approved reviews
    IF review_rec.status != 'approved' THEN
        RAISE EXCEPTION 'Can only vote on approved reviews';
    END IF;

    -- ANTI-MANIPULATION: Prevent self-voting
    IF review_rec.author_user_id = voter_id THEN
        RAISE EXCEPTION 'Cannot vote on your own review';
    END IF;

    -- Check for existing vote
    SELECT * INTO existing_vote
    FROM review_helpful_votes
    WHERE review_id = p_review_id AND voter_user_id = voter_id;

    -- Handle vote removal
    IF p_vote_type = 'none' THEN
        IF existing_vote IS NOT NULL THEN
            DELETE FROM review_helpful_votes
            WHERE id = existing_vote.id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'removed',
            'vote_type', NULL
        );
    END IF;

    -- Validate vote type
    IF p_vote_type NOT IN ('up', 'down') THEN
        RAISE EXCEPTION 'Invalid vote type. Use up, down, or none';
    END IF;

    -- Calculate vote weight
    vote_weight := calculate_vote_weight(
        voter_id,
        review_rec.organization_id,
        review_rec.product_id
    );

    -- Check if voter is verified purchaser
    SELECT EXISTS (
        SELECT 1 FROM verified_purchases
        WHERE user_id = voter_id
          AND organization_id = review_rec.organization_id
    ) INTO is_verified;

    -- Insert or update vote
    IF existing_vote IS NULL THEN
        INSERT INTO review_helpful_votes (
            review_id,
            voter_user_id,
            vote_type,
            is_verified_voter,
            vote_weight
        )
        VALUES (
            p_review_id,
            voter_id,
            p_vote_type,
            is_verified,
            vote_weight
        );

        result := jsonb_build_object(
            'success', true,
            'action', 'created',
            'vote_type', p_vote_type,
            'vote_weight', vote_weight
        );
    ELSE
        -- Update existing vote
        UPDATE review_helpful_votes
        SET vote_type = p_vote_type,
            is_verified_voter = is_verified,
            vote_weight = vote_weight
        WHERE id = existing_vote.id;

        result := jsonb_build_object(
            'success', true,
            'action', 'updated',
            'vote_type', p_vote_type,
            'vote_weight', vote_weight,
            'previous_vote', existing_vote.vote_type
        );
    END IF;

    -- Award points for helpful vote (only for upvotes on first vote)
    IF p_vote_type = 'up' AND (existing_vote IS NULL OR existing_vote.vote_type = 'down') THEN
        -- This would be handled by the points system trigger
        -- Points are awarded to the review AUTHOR, not the voter
        NULL;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. FUNCTION: GET USER'S VOTE ON A REVIEW
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_review_vote(p_review_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT vote_type
        FROM review_helpful_votes
        WHERE review_id = p_review_id
          AND voter_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- 9. FUNCTION: GET USER'S VOTES FOR MULTIPLE REVIEWS (BATCH)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_review_votes(p_review_ids UUID[])
RETURNS TABLE(review_id UUID, vote_type TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT rhv.review_id, rhv.vote_type
    FROM review_helpful_votes rhv
    WHERE rhv.review_id = ANY(p_review_ids)
      AND rhv.voter_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- 10. INDEX FOR WILSON SCORE SORTING
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_reviews_wilson_score
    ON reviews(organization_id, wilson_score DESC)
    WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_reviews_product_wilson
    ON reviews(product_id, wilson_score DESC)
    WHERE status = 'approved' AND product_id IS NOT NULL;

-- =============================================================================
-- 11. RLS POLICIES FOR VERIFIED_PURCHASES
-- =============================================================================

ALTER TABLE verified_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own verified purchases
CREATE POLICY "Users can view own verified purchases"
    ON verified_purchases FOR SELECT
    USING (auth.uid() = user_id);

-- Organization members can view verified purchases for their org
CREATE POLICY "Org members can view verified purchases"
    ON verified_purchases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = verified_purchases.organization_id
              AND om.user_id = auth.uid()
        )
    );

-- Service role can manage all
CREATE POLICY "Service role manages verified purchases"
    ON verified_purchases FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- 12. UPDATE EXISTING RLS FOR review_helpful_votes
-- =============================================================================

-- Drop old policies that may conflict
DROP POLICY IF EXISTS "Users can create helpful votes" ON review_helpful_votes;
DROP POLICY IF EXISTS "Users can delete own helpful votes" ON review_helpful_votes;

-- New policy: Users can only vote on others' reviews
CREATE POLICY "Users can vote on reviews"
    ON review_helpful_votes FOR INSERT
    WITH CHECK (
        auth.uid() = voter_user_id
        AND NOT EXISTS (
            SELECT 1 FROM reviews r
            WHERE r.id = review_helpful_votes.review_id
              AND r.author_user_id = auth.uid()
        )
    );

-- Users can update their own votes
CREATE POLICY "Users can update own votes"
    ON review_helpful_votes FOR UPDATE
    USING (auth.uid() = voter_user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete own votes"
    ON review_helpful_votes FOR DELETE
    USING (auth.uid() = voter_user_id);

-- =============================================================================
-- 13. BACKFILL: Update existing reviews with wilson scores
-- =============================================================================

-- Update existing reviews that have helpful votes
UPDATE reviews r
SET
    upvote_count = COALESCE(v.up_count, 0),
    downvote_count = COALESCE(v.down_count, 0),
    wilson_score = calculate_wilson_score(
        COALESCE(v.up_count, 0),
        COALESCE(v.down_count, 0)
    )
FROM (
    SELECT
        review_id,
        COUNT(*) FILTER (WHERE vote_type = 'up' OR vote_type IS NULL) as up_count,
        COUNT(*) FILTER (WHERE vote_type = 'down') as down_count
    FROM review_helpful_votes
    GROUP BY review_id
) v
WHERE r.id = v.review_id;

-- =============================================================================
-- 14. COMMENTS
-- =============================================================================

COMMENT ON COLUMN review_helpful_votes.vote_type IS 'Type of vote: up (helpful) or down (not helpful)';
COMMENT ON COLUMN review_helpful_votes.is_verified_voter IS 'Whether voter has verified purchase for this product/org';
COMMENT ON COLUMN review_helpful_votes.vote_weight IS 'Computed trust weight (1.0-2.0) based on verification and tier';
COMMENT ON COLUMN reviews.wilson_score IS 'Wilson score confidence interval lower bound for ranking';
COMMENT ON COLUMN reviews.is_verified_purchase IS 'Whether reviewer has verified purchase';
COMMENT ON TABLE verified_purchases IS 'Tracks verified product purchases for trust weighting';
COMMENT ON FUNCTION calculate_wilson_score IS 'Calculates Wilson score lower bound with 95% confidence';
COMMENT ON FUNCTION cast_review_vote IS 'Casts/updates a vote on a review with anti-manipulation checks';
-- Migration: Dynamic QR URL System
-- Purpose: Enable changing QR destinations without reprinting, campaigns, and A/B testing
-- Author: System
-- Date: 2026-02-01

-- ============================================================================
-- PART 1: QR URL VERSIONS
-- Stores all possible destinations for a QR code with versioning
-- ============================================================================

CREATE TABLE IF NOT EXISTS qr_url_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,

    -- Version metadata
    version_number INT NOT NULL DEFAULT 1,
    name TEXT NOT NULL,                     -- Human-readable name: "Holiday Sale Link"
    description TEXT,                       -- Optional description

    -- Target configuration
    target_url TEXT NOT NULL,               -- Full URL or path
    target_type TEXT NOT NULL DEFAULT 'custom', -- 'organization', 'product', 'custom', 'external'

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT false,  -- Only one can be active at a time (unless A/B)
    is_default BOOLEAN NOT NULL DEFAULT false, -- Fallback when no campaign/A/B is active

    -- Metadata
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,                -- Soft delete

    -- Ensure unique version numbers per QR code
    CONSTRAINT unique_qr_version UNIQUE(qr_code_id, version_number)
);

-- Index for active version lookup (most common query)
CREATE INDEX idx_qr_url_versions_active ON qr_url_versions(qr_code_id, is_active) WHERE is_active = true;
CREATE INDEX idx_qr_url_versions_default ON qr_url_versions(qr_code_id, is_default) WHERE is_default = true;

-- ============================================================================
-- PART 2: QR CAMPAIGNS
-- Time-based URL switching (scheduled campaigns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS qr_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
    url_version_id UUID NOT NULL REFERENCES qr_url_versions(id) ON DELETE CASCADE,

    -- Campaign metadata
    name TEXT NOT NULL,                     -- "Black Friday 2026"
    description TEXT,

    -- Schedule
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,                    -- NULL = runs indefinitely after start
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',

    -- Recurrence (optional)
    recurrence_rule TEXT,                   -- iCal RRULE format for recurring campaigns

    -- Priority (higher wins when campaigns overlap)
    priority INT NOT NULL DEFAULT 0,

    -- Status
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),

    -- Metadata
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure URL version belongs to same QR code
    CONSTRAINT campaign_url_version_check CHECK (
        (SELECT qr_code_id FROM qr_url_versions WHERE id = url_version_id) = qr_code_id
    )
);

-- Index for finding active campaigns
CREATE INDEX idx_qr_campaigns_schedule ON qr_campaigns(qr_code_id, status, starts_at, ends_at);
CREATE INDEX idx_qr_campaigns_active ON qr_campaigns(qr_code_id, status) WHERE status = 'active';

-- ============================================================================
-- PART 3: A/B TESTING
-- Split traffic between multiple destinations
-- ============================================================================

CREATE TABLE IF NOT EXISTS qr_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,

    -- Test metadata
    name TEXT NOT NULL,                     -- "Landing Page Test Q1"
    description TEXT,
    hypothesis TEXT,                        -- What we're testing

    -- Schedule
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,                    -- When to auto-conclude

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'concluded')),

    -- Winner selection
    winning_variant_id UUID REFERENCES qr_url_versions(id),
    concluded_at TIMESTAMPTZ,
    concluded_by UUID REFERENCES app_users(id),
    conclusion_notes TEXT,

    -- Statistical settings
    min_sample_size INT DEFAULT 100,        -- Minimum clicks before concluding
    confidence_level DECIMAL(3,2) DEFAULT 0.95, -- 95% confidence

    -- Metadata
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A/B test variants (the actual split)
CREATE TABLE IF NOT EXISTS qr_ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ab_test_id UUID NOT NULL REFERENCES qr_ab_tests(id) ON DELETE CASCADE,
    url_version_id UUID NOT NULL REFERENCES qr_url_versions(id) ON DELETE CASCADE,

    -- Traffic allocation
    weight INT NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100), -- Percentage

    -- Variant metadata
    variant_name TEXT NOT NULL DEFAULT 'Variant',  -- "Control", "Variant A", etc.

    -- Statistics (denormalized for quick access)
    total_clicks INT NOT NULL DEFAULT 0,
    unique_visitors INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique variant per test
    CONSTRAINT unique_ab_variant UNIQUE(ab_test_id, url_version_id)
);

-- Index for variant lookup during redirect
CREATE INDEX idx_qr_ab_test_variants_test ON qr_ab_test_variants(ab_test_id);

-- ============================================================================
-- PART 4: CLICK TRACKING (Enhanced)
-- Track which version/campaign/variant was served
-- ============================================================================

-- Add columns to existing qr_events table
ALTER TABLE qr_events
ADD COLUMN IF NOT EXISTS url_version_id UUID REFERENCES qr_url_versions(id),
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES qr_campaigns(id),
ADD COLUMN IF NOT EXISTS ab_test_id UUID REFERENCES qr_ab_tests(id),
ADD COLUMN IF NOT EXISTS ab_variant_id UUID REFERENCES qr_ab_test_variants(id);

-- Index for version analytics
CREATE INDEX IF NOT EXISTS idx_qr_events_version ON qr_events(url_version_id) WHERE url_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_events_campaign ON qr_events(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_events_ab_test ON qr_events(ab_test_id) WHERE ab_test_id IS NOT NULL;

-- ============================================================================
-- PART 5: URL VERSION HISTORY (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS qr_url_version_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url_version_id UUID NOT NULL REFERENCES qr_url_versions(id) ON DELETE CASCADE,

    -- What changed
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'activated', 'deactivated', 'archived')),
    changes JSONB,                          -- {"field": {"old": "...", "new": "..."}}

    -- Who and when
    performed_by UUID NOT NULL REFERENCES app_users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- IP for audit
    ip_address TEXT
);

CREATE INDEX idx_qr_url_version_history_version ON qr_url_version_history(url_version_id, performed_at DESC);

-- ============================================================================
-- PART 6: TRIGGERS & FUNCTIONS
-- ============================================================================

-- Auto-increment version number
CREATE OR REPLACE FUNCTION set_qr_url_version_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version_number := COALESCE(
        (SELECT MAX(version_number) + 1 FROM qr_url_versions WHERE qr_code_id = NEW.qr_code_id),
        1
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_qr_url_version_number
BEFORE INSERT ON qr_url_versions
FOR EACH ROW
WHEN (NEW.version_number IS NULL OR NEW.version_number = 1)
EXECUTE FUNCTION set_qr_url_version_number();

-- Updated_at trigger for url_versions
CREATE TRIGGER trigger_update_qr_url_versions_updated_at
BEFORE UPDATE ON qr_url_versions
FOR EACH ROW
EXECUTE FUNCTION update_qr_customization_updated_at(); -- Reuse existing function

-- Updated_at trigger for campaigns
CREATE TRIGGER trigger_update_qr_campaigns_updated_at
BEFORE UPDATE ON qr_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_qr_customization_updated_at();

-- Updated_at trigger for ab_tests
CREATE TRIGGER trigger_update_qr_ab_tests_updated_at
BEFORE UPDATE ON qr_ab_tests
FOR EACH ROW
EXECUTE FUNCTION update_qr_customization_updated_at();

-- Ensure only one default version per QR code
CREATE OR REPLACE FUNCTION ensure_single_default_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE qr_url_versions
        SET is_default = false
        WHERE qr_code_id = NEW.qr_code_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_version
BEFORE INSERT OR UPDATE ON qr_url_versions
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION ensure_single_default_version();

-- Function to get active URL for a QR code (used in redirect)
CREATE OR REPLACE FUNCTION get_active_qr_url(p_qr_code_id UUID, p_visitor_hash TEXT DEFAULT NULL)
RETURNS TABLE (
    target_url TEXT,
    url_version_id UUID,
    campaign_id UUID,
    ab_test_id UUID,
    ab_variant_id UUID
) AS $$
DECLARE
    v_ab_test RECORD;
    v_variant RECORD;
    v_campaign RECORD;
    v_default_version RECORD;
    v_random_weight INT;
    v_cumulative_weight INT;
BEGIN
    -- Priority 1: Check for running A/B test
    SELECT at.* INTO v_ab_test
    FROM qr_ab_tests at
    WHERE at.qr_code_id = p_qr_code_id
      AND at.status = 'running'
      AND at.starts_at <= NOW()
      AND (at.ends_at IS NULL OR at.ends_at > NOW())
    LIMIT 1;

    IF FOUND THEN
        -- Use consistent hashing for same visitor (if hash provided)
        IF p_visitor_hash IS NOT NULL THEN
            v_random_weight := ABS(('x' || SUBSTRING(p_visitor_hash, 1, 8))::bit(32)::int) % 100;
        ELSE
            v_random_weight := FLOOR(RANDOM() * 100)::INT;
        END IF;

        -- Select variant based on weight
        v_cumulative_weight := 0;
        FOR v_variant IN
            SELECT atv.*, uv.target_url
            FROM qr_ab_test_variants atv
            JOIN qr_url_versions uv ON uv.id = atv.url_version_id
            WHERE atv.ab_test_id = v_ab_test.id
            ORDER BY atv.weight DESC
        LOOP
            v_cumulative_weight := v_cumulative_weight + v_variant.weight;
            IF v_random_weight < v_cumulative_weight THEN
                RETURN QUERY SELECT
                    v_variant.target_url,
                    v_variant.url_version_id,
                    NULL::UUID,
                    v_ab_test.id,
                    v_variant.id;
                RETURN;
            END IF;
        END LOOP;
    END IF;

    -- Priority 2: Check for active campaign (highest priority first)
    SELECT c.*, uv.target_url INTO v_campaign
    FROM qr_campaigns c
    JOIN qr_url_versions uv ON uv.id = c.url_version_id
    WHERE c.qr_code_id = p_qr_code_id
      AND c.status IN ('scheduled', 'active')
      AND c.starts_at <= NOW()
      AND (c.ends_at IS NULL OR c.ends_at > NOW())
    ORDER BY c.priority DESC, c.starts_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT
            v_campaign.target_url,
            v_campaign.url_version_id,
            v_campaign.id,
            NULL::UUID,
            NULL::UUID;
        RETURN;
    END IF;

    -- Priority 3: Return default version
    SELECT uv.target_url, uv.id INTO v_default_version
    FROM qr_url_versions uv
    WHERE uv.qr_code_id = p_qr_code_id
      AND uv.is_default = true
      AND uv.archived_at IS NULL
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT
            v_default_version.target_url,
            v_default_version.id,
            NULL::UUID,
            NULL::UUID,
            NULL::UUID;
        RETURN;
    END IF;

    -- Fallback: Return NULL (will use legacy behavior)
    RETURN QUERY SELECT
        NULL::TEXT,
        NULL::UUID,
        NULL::UUID,
        NULL::UUID,
        NULL::UUID;
END;
$$ LANGUAGE plpgsql;

-- Function to update A/B test variant stats
CREATE OR REPLACE FUNCTION update_ab_variant_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ab_variant_id IS NOT NULL THEN
        UPDATE qr_ab_test_variants
        SET total_clicks = total_clicks + 1
        WHERE id = NEW.ab_variant_id;

        -- Update unique visitors (simplified - based on ip_hash)
        IF NEW.ip_hash IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM qr_events
            WHERE ab_variant_id = NEW.ab_variant_id
              AND ip_hash = NEW.ip_hash
              AND id != NEW.id
        ) THEN
            UPDATE qr_ab_test_variants
            SET unique_visitors = unique_visitors + 1
            WHERE id = NEW.ab_variant_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ab_variant_stats
AFTER INSERT ON qr_events
FOR EACH ROW
WHEN (NEW.ab_variant_id IS NOT NULL)
EXECUTE FUNCTION update_ab_variant_stats();

-- ============================================================================
-- PART 7: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE qr_url_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_url_version_history ENABLE ROW LEVEL SECURITY;

-- URL Versions: View policy
CREATE POLICY "Org members view url versions" ON qr_url_versions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_url_versions.qr_code_id
        AND om.user_id = auth.uid()
    )
);

-- URL Versions: Manage policy
CREATE POLICY "Org managers manage url versions" ON qr_url_versions
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_url_versions.qr_code_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

-- Campaigns: View policy
CREATE POLICY "Org members view campaigns" ON qr_campaigns
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_campaigns.qr_code_id
        AND om.user_id = auth.uid()
    )
);

-- Campaigns: Manage policy
CREATE POLICY "Org managers manage campaigns" ON qr_campaigns
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_campaigns.qr_code_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

-- A/B Tests: View policy
CREATE POLICY "Org members view ab tests" ON qr_ab_tests
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_ab_tests.qr_code_id
        AND om.user_id = auth.uid()
    )
);

-- A/B Tests: Manage policy
CREATE POLICY "Org managers manage ab tests" ON qr_ab_tests
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_ab_tests.qr_code_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

-- A/B Test Variants: View policy
CREATE POLICY "Org members view ab test variants" ON qr_ab_test_variants
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM qr_ab_tests abt
        JOIN qr_codes qc ON qc.id = abt.qr_code_id
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE abt.id = qr_ab_test_variants.ab_test_id
        AND om.user_id = auth.uid()
    )
);

-- A/B Test Variants: Manage policy
CREATE POLICY "Org managers manage ab test variants" ON qr_ab_test_variants
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM qr_ab_tests abt
        JOIN qr_codes qc ON qc.id = abt.qr_code_id
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE abt.id = qr_ab_test_variants.ab_test_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

-- URL Version History: View policy (analysts+)
CREATE POLICY "Org analysts view url version history" ON qr_url_version_history
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM qr_url_versions uv
        JOIN qr_codes qc ON qc.id = uv.qr_code_id
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE uv.id = qr_url_version_history.url_version_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'analyst')
    )
);

-- ============================================================================
-- PART 8: DATA MIGRATION
-- Create default URL versions for existing QR codes
-- ============================================================================

-- Create default URL version for each existing QR code that doesn't have one
INSERT INTO qr_url_versions (qr_code_id, name, target_url, target_type, is_default, is_active, created_by)
SELECT
    qc.id,
    'Default Destination',
    CASE
        WHEN qc.target_type = 'organization' THEN '/org/' || COALESCE(qc.target_slug, o.slug)
        ELSE '/org/' || o.slug
    END,
    qc.target_type,
    true,
    true,
    qc.created_by
FROM qr_codes qc
JOIN organizations o ON o.id = qc.organization_id
WHERE NOT EXISTS (
    SELECT 1 FROM qr_url_versions uv WHERE uv.qr_code_id = qc.id
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE qr_url_versions IS 'Stores all possible URL destinations for a QR code with versioning';
COMMENT ON TABLE qr_campaigns IS 'Scheduled campaigns that activate specific URL versions at set times';
COMMENT ON TABLE qr_ab_tests IS 'A/B tests for comparing different URL versions';
COMMENT ON TABLE qr_ab_test_variants IS 'Individual variants in an A/B test with traffic weights';
COMMENT ON TABLE qr_url_version_history IS 'Audit trail for URL version changes';
COMMENT ON FUNCTION get_active_qr_url IS 'Returns the currently active URL for a QR code based on A/B tests, campaigns, or default';
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
        o.display_name AS organization_name,
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
        o.display_name AS organization_name,
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
-- Migration: Environmental Impact Scoring System
-- Calculates and displays eco-friendliness for products

-- =============================================================================
-- ECO SCORING PARAMETERS (Reference Table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS eco_scoring_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parameter identification
    parameter_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'transport',      -- Carbon footprint from transport
        'packaging',      -- Packaging materials and recyclability
        'production',     -- Production methods and energy
        'certification',  -- Eco certifications bonus
        'sourcing'        -- Raw material sourcing
    )),

    -- Display info
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ru TEXT,
    description_en TEXT,

    -- Scoring
    max_points INTEGER NOT NULL DEFAULT 100,
    weight DECIMAL(4,2) NOT NULL DEFAULT 1.0,  -- Weight in final score

    -- For UI
    icon_name TEXT,  -- Lucide icon name
    display_order INTEGER DEFAULT 100,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed eco scoring parameters
INSERT INTO eco_scoring_parameters (parameter_code, category, name_ru, name_en, description_ru, description_en, max_points, weight, icon_name, display_order) VALUES
    -- Transport (30% of total score)
    ('transport_distance', 'transport', 'Расстояние доставки', 'Transport Distance',
     'Километры от места производства до потребителя', 'Kilometers from production to consumer',
     100, 0.20, 'Truck', 10),
    ('transport_mode', 'transport', 'Способ доставки', 'Transport Mode',
     'Тип транспорта (ж/д, авто, авиа)', 'Transport type (rail, road, air)',
     100, 0.10, 'Train', 20),

    -- Packaging (25% of total score)
    ('packaging_material', 'packaging', 'Материал упаковки', 'Packaging Material',
     'Экологичность материала упаковки', 'Eco-friendliness of packaging material',
     100, 0.15, 'Package', 30),
    ('packaging_recyclable', 'packaging', 'Перерабатываемость', 'Recyclability',
     'Возможность переработки упаковки', 'Packaging recyclability potential',
     100, 0.10, 'Recycle', 40),

    -- Production (30% of total score)
    ('production_energy', 'production', 'Энергоэффективность', 'Energy Efficiency',
     'Источники энергии в производстве', 'Energy sources in production',
     100, 0.15, 'Zap', 50),
    ('production_waste', 'production', 'Управление отходами', 'Waste Management',
     'Методы утилизации производственных отходов', 'Production waste disposal methods',
     100, 0.10, 'Trash2', 60),
    ('production_water', 'production', 'Водопотребление', 'Water Usage',
     'Эффективность использования воды', 'Water usage efficiency',
     100, 0.05, 'Droplets', 70),

    -- Certification bonus (15% of total score)
    ('eco_certifications', 'certification', 'Эко-сертификаты', 'Eco Certifications',
     'Наличие экологических сертификатов', 'Presence of eco certifications',
     100, 0.15, 'Award', 80)
ON CONFLICT (parameter_code) DO NOTHING;

-- =============================================================================
-- TRANSPORT DISTANCE BRACKETS
-- =============================================================================
CREATE TABLE IF NOT EXISTS transport_distance_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    min_distance_km INTEGER NOT NULL,
    max_distance_km INTEGER,  -- NULL means infinity

    -- Score for this bracket (out of 100)
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),

    -- CO2 multiplier for display calculations
    co2_kg_per_km DECIMAL(6,4) NOT NULL DEFAULT 0.1,

    -- Display labels
    label_ru TEXT NOT NULL,
    label_en TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed distance brackets (closer = better)
INSERT INTO transport_distance_scoring (min_distance_km, max_distance_km, score, co2_kg_per_km, label_ru, label_en) VALUES
    (0, 50, 100, 0.05, 'Местное (до 50 км)', 'Local (up to 50 km)'),
    (51, 150, 85, 0.08, 'Региональное (50-150 км)', 'Regional (50-150 km)'),
    (151, 500, 70, 0.10, 'Межрегиональное (150-500 км)', 'Inter-regional (150-500 km)'),
    (501, 1000, 50, 0.12, 'Дальнее (500-1000 км)', 'Long-distance (500-1000 km)'),
    (1001, 3000, 30, 0.15, 'Очень дальнее (1000-3000 км)', 'Very long (1000-3000 km)'),
    (3001, NULL, 10, 0.20, 'Импорт (более 3000 км)', 'Import (over 3000 km)');

-- =============================================================================
-- TRANSPORT MODE SCORING
-- =============================================================================
CREATE TABLE IF NOT EXISTS transport_mode_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mode_code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,

    -- Environmental impact (higher = worse)
    co2_multiplier DECIMAL(4,2) NOT NULL,  -- Base CO2 multiplier
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),

    icon_name TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed transport modes
INSERT INTO transport_mode_scoring (mode_code, name_ru, name_en, co2_multiplier, score, icon_name) VALUES
    ('local_pickup', 'Самовывоз', 'Local Pickup', 0.0, 100, 'MapPin'),
    ('bicycle', 'Велосипед', 'Bicycle', 0.01, 98, 'Bike'),
    ('electric', 'Электротранспорт', 'Electric Vehicle', 0.3, 90, 'BatteryCharging'),
    ('rail', 'Железная дорога', 'Rail', 0.5, 85, 'Train'),
    ('road_hybrid', 'Гибридный авто', 'Hybrid Vehicle', 0.7, 75, 'Car'),
    ('road_standard', 'Автомобильный', 'Standard Road', 1.0, 60, 'Truck'),
    ('sea', 'Морской', 'Sea Freight', 1.2, 55, 'Ship'),
    ('air', 'Авиа', 'Air Freight', 5.0, 15, 'Plane')
ON CONFLICT (mode_code) DO NOTHING;

-- =============================================================================
-- PACKAGING MATERIAL SCORING
-- =============================================================================
CREATE TABLE IF NOT EXISTS packaging_material_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    material_code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,

    -- Eco scores
    base_score INTEGER NOT NULL CHECK (base_score >= 0 AND base_score <= 100),
    recyclable_bonus INTEGER DEFAULT 0,  -- Added if packaging is recyclable
    biodegradable_bonus INTEGER DEFAULT 0,  -- Added if biodegradable

    -- For comparison display
    co2_equivalent_kg DECIMAL(6,3),  -- CO2 equivalent per kg of material

    icon_name TEXT,
    color TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed packaging materials
INSERT INTO packaging_material_scoring (material_code, name_ru, name_en, base_score, recyclable_bonus, biodegradable_bonus, co2_equivalent_kg, icon_name, color) VALUES
    ('none', 'Без упаковки', 'No Packaging', 100, 0, 0, 0.0, 'Package', '#22C55E'),
    ('paper', 'Бумага', 'Paper', 85, 10, 5, 0.9, 'FileText', '#84CC16'),
    ('cardboard', 'Картон', 'Cardboard', 80, 10, 5, 1.1, 'Box', '#A3E635'),
    ('glass', 'Стекло', 'Glass', 70, 15, 0, 1.2, 'GlassWater', '#38BDF8'),
    ('metal_aluminum', 'Алюминий', 'Aluminum', 60, 20, 0, 8.1, 'Circle', '#94A3B8'),
    ('metal_steel', 'Сталь', 'Steel', 55, 15, 0, 2.0, 'Circle', '#64748B'),
    ('bioplastic', 'Биопластик', 'Bioplastic', 75, 5, 15, 2.5, 'Leaf', '#4ADE80'),
    ('plastic_recycled', 'Переработанный пластик', 'Recycled Plastic', 50, 10, 0, 1.5, 'Recycle', '#FACC15'),
    ('plastic_standard', 'Пластик', 'Standard Plastic', 25, 5, 0, 3.5, 'Box', '#F97316'),
    ('styrofoam', 'Пенопласт', 'Styrofoam', 10, 0, 0, 6.0, 'Square', '#EF4444'),
    ('mixed_non_recyclable', 'Смешанная (не перераб.)', 'Mixed Non-recyclable', 5, 0, 0, 4.5, 'XCircle', '#DC2626')
ON CONFLICT (material_code) DO NOTHING;

-- =============================================================================
-- PRODUCTION ENERGY SCORING
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_energy_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    energy_code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,

    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    co2_kg_per_kwh DECIMAL(6,4),  -- CO2 per kWh

    icon_name TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed energy sources
INSERT INTO production_energy_scoring (energy_code, name_ru, name_en, score, co2_kg_per_kwh, icon_name) VALUES
    ('solar', 'Солнечная энергия', 'Solar Power', 100, 0.02, 'Sun'),
    ('wind', 'Ветровая энергия', 'Wind Power', 98, 0.01, 'Wind'),
    ('hydro', 'Гидроэнергия', 'Hydropower', 95, 0.02, 'Waves'),
    ('geothermal', 'Геотермальная', 'Geothermal', 92, 0.04, 'Thermometer'),
    ('nuclear', 'Атомная', 'Nuclear', 80, 0.01, 'Atom'),
    ('biomass', 'Биомасса', 'Biomass', 70, 0.23, 'TreeDeciduous'),
    ('natural_gas', 'Природный газ', 'Natural Gas', 50, 0.45, 'Flame'),
    ('grid_mixed', 'Сеть (смешанная)', 'Grid (Mixed)', 40, 0.50, 'Plug'),
    ('coal', 'Уголь', 'Coal', 15, 1.00, 'Factory'),
    ('diesel', 'Дизель', 'Diesel Generator', 20, 0.85, 'Fuel')
ON CONFLICT (energy_code) DO NOTHING;

-- =============================================================================
-- ECO CERTIFICATION BONUSES
-- =============================================================================
-- Map existing certification_types to eco bonus points
CREATE TABLE IF NOT EXISTS eco_certification_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    certification_type_code TEXT NOT NULL,  -- References certification_types.code

    -- Bonus points for having this certification
    eco_bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (eco_bonus_points >= 0 AND eco_bonus_points <= 30),

    -- Display priority
    display_order INTEGER DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(certification_type_code)
);

-- Map eco-relevant certifications to bonus points
INSERT INTO eco_certification_bonuses (certification_type_code, eco_bonus_points, display_order) VALUES
    -- Strong eco certifications (max bonus)
    ('leaf_of_life', 30, 10),
    ('eco_product_ru', 28, 20),
    ('fsc', 25, 30),
    ('rainforest_alliance', 25, 40),

    -- Organic certifications (high bonus)
    ('organic_ru', 25, 50),
    ('organic_eu', 25, 60),
    ('usda_organic', 25, 70),
    ('ecocert', 25, 80),

    -- Quality standards with environmental component
    ('iso_22000', 10, 90),
    ('roskachestvo', 8, 100),

    -- Geographic origin (supports local production)
    ('pdo_ru', 15, 110),
    ('pgi_ru', 12, 120)
ON CONFLICT (certification_type_code) DO NOTHING;

-- =============================================================================
-- PRODUCT ECO DATA (Producer Input)
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_eco_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Transport data
    production_location_lat DECIMAL(10, 7),
    production_location_lng DECIMAL(10, 7),
    production_location_name TEXT,
    production_region TEXT,  -- Russian federal subject
    transport_distance_km INTEGER,
    transport_mode TEXT REFERENCES transport_mode_scoring(mode_code),
    uses_local_ingredients BOOLEAN DEFAULT false,
    local_ingredients_percentage INTEGER CHECK (local_ingredients_percentage >= 0 AND local_ingredients_percentage <= 100),

    -- Packaging data
    packaging_material TEXT REFERENCES packaging_material_scoring(material_code),
    packaging_is_recyclable BOOLEAN DEFAULT false,
    packaging_is_biodegradable BOOLEAN DEFAULT false,
    packaging_is_reusable BOOLEAN DEFAULT false,
    packaging_notes TEXT,

    -- Production data
    primary_energy_source TEXT REFERENCES production_energy_scoring(energy_code),
    secondary_energy_source TEXT REFERENCES production_energy_scoring(energy_code),
    renewable_energy_percentage INTEGER CHECK (renewable_energy_percentage >= 0 AND renewable_energy_percentage <= 100),
    has_waste_recycling BOOLEAN DEFAULT false,
    waste_recycling_percentage INTEGER CHECK (waste_recycling_percentage >= 0 AND waste_recycling_percentage <= 100),
    water_recycling_percentage INTEGER CHECK (water_recycling_percentage >= 0 AND water_recycling_percentage <= 100),
    uses_organic_materials BOOLEAN DEFAULT false,

    -- Optional detailed data (for advanced producers)
    carbon_footprint_kg DECIMAL(10, 3),  -- If producer has calculated this
    water_usage_liters DECIMAL(10, 3),
    production_notes TEXT,

    -- Verification
    data_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,

    -- Last update tracking
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(product_id)
);

-- =============================================================================
-- PRODUCT ECO SCORES (Calculated)
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_eco_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Individual scores (0-100 each)
    transport_score INTEGER CHECK (transport_score >= 0 AND transport_score <= 100),
    packaging_score INTEGER CHECK (packaging_score >= 0 AND packaging_score <= 100),
    production_score INTEGER CHECK (production_score >= 0 AND production_score <= 100),
    certification_score INTEGER CHECK (certification_score >= 0 AND certification_score <= 100),

    -- Weighted final score (0-100)
    total_score INTEGER CHECK (total_score >= 0 AND total_score <= 100),

    -- Eco grade (A-F like energy labels)
    eco_grade TEXT CHECK (eco_grade IN ('A+', 'A', 'B', 'C', 'D', 'E', 'F')),

    -- CO2 comparison data
    estimated_co2_kg DECIMAL(10, 3),  -- Total estimated CO2
    co2_vs_import_percentage DECIMAL(5, 2),  -- e.g., -40 means 40% less than import
    co2_saved_kg DECIMAL(10, 3),  -- CO2 saved vs typical import

    -- Category benchmarks
    category_average_score INTEGER,
    category_rank INTEGER,  -- Rank within category
    category_total_products INTEGER,  -- Total products in category

    -- Calculation metadata
    calculation_version INTEGER NOT NULL DEFAULT 1,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_completeness_percentage INTEGER,  -- How much eco data was provided

    UNIQUE(product_id)
);

-- =============================================================================
-- ORGANIZATION ECO PROFILE
-- =============================================================================
CREATE TABLE IF NOT EXISTS organization_eco_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Default values for new products
    default_production_location_lat DECIMAL(10, 7),
    default_production_location_lng DECIMAL(10, 7),
    default_production_location_name TEXT,
    default_production_region TEXT,

    default_transport_mode TEXT REFERENCES transport_mode_scoring(mode_code),
    default_packaging_material TEXT REFERENCES packaging_material_scoring(material_code),
    default_energy_source TEXT REFERENCES production_energy_scoring(energy_code),

    -- Organization-wide eco initiatives
    has_carbon_offset_program BOOLEAN DEFAULT false,
    has_sustainability_report BOOLEAN DEFAULT false,
    sustainability_report_url TEXT,
    eco_commitment_statement TEXT,

    -- Aggregate scores
    average_product_eco_score INTEGER,
    total_products_with_eco_data INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(organization_id)
);

-- =============================================================================
-- ECO COMPARISON BENCHMARKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS eco_category_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    category TEXT NOT NULL,  -- Product category

    -- Benchmark values (for comparison)
    avg_import_distance_km INTEGER DEFAULT 5000,
    avg_import_co2_kg DECIMAL(10, 3),
    avg_local_distance_km INTEGER DEFAULT 200,
    avg_local_co2_kg DECIMAL(10, 3),

    -- Score thresholds for grades
    grade_a_plus_min INTEGER DEFAULT 90,
    grade_a_min INTEGER DEFAULT 80,
    grade_b_min INTEGER DEFAULT 65,
    grade_c_min INTEGER DEFAULT 50,
    grade_d_min INTEGER DEFAULT 35,
    grade_e_min INTEGER DEFAULT 20,
    -- Below grade_e_min = F

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(category)
);

-- Seed some category benchmarks
INSERT INTO eco_category_benchmarks (category, avg_import_distance_km, avg_import_co2_kg, avg_local_distance_km, avg_local_co2_kg) VALUES
    ('food_dairy', 3000, 2.5, 150, 0.3),
    ('food_meat', 4000, 8.0, 200, 1.2),
    ('food_vegetables', 5000, 1.5, 50, 0.1),
    ('food_fruit', 6000, 2.0, 100, 0.2),
    ('food_bakery', 2000, 0.8, 30, 0.05),
    ('food_beverages', 4000, 1.2, 100, 0.15),
    ('food_honey', 3000, 0.5, 80, 0.08),
    ('cosmetics', 5000, 1.0, 300, 0.25),
    ('textiles', 8000, 15.0, 500, 3.0),
    ('crafts', 4000, 2.0, 200, 0.4)
ON CONFLICT (category) DO NOTHING;

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_eco_data_product ON product_eco_data(product_id);
CREATE INDEX idx_eco_scores_product ON product_eco_scores(product_id);
CREATE INDEX idx_eco_scores_grade ON product_eco_scores(eco_grade);
CREATE INDEX idx_eco_scores_total ON product_eco_scores(total_score DESC);
CREATE INDEX idx_org_eco_profile ON organization_eco_profile(organization_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to calculate eco score for a product
CREATE OR REPLACE FUNCTION calculate_product_eco_score(p_product_id UUID)
RETURNS product_eco_scores AS $$
DECLARE
    v_eco_data product_eco_data%ROWTYPE;
    v_product products%ROWTYPE;
    v_result product_eco_scores%ROWTYPE;
    v_transport_score INTEGER := 0;
    v_packaging_score INTEGER := 0;
    v_production_score INTEGER := 0;
    v_certification_score INTEGER := 0;
    v_total_score INTEGER := 0;
    v_eco_grade TEXT;
    v_estimated_co2 DECIMAL := 0;
    v_benchmark eco_category_benchmarks%ROWTYPE;
    v_data_completeness INTEGER := 0;
    v_cert_bonus INTEGER := 0;
BEGIN
    -- Get product and eco data
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    SELECT * INTO v_eco_data FROM product_eco_data WHERE product_id = p_product_id;

    IF v_eco_data.id IS NULL THEN
        -- No eco data, return empty score
        RETURN v_result;
    END IF;

    -- Calculate transport score
    IF v_eco_data.transport_distance_km IS NOT NULL THEN
        SELECT score INTO v_transport_score
        FROM transport_distance_scoring
        WHERE v_eco_data.transport_distance_km >= min_distance_km
          AND (max_distance_km IS NULL OR v_eco_data.transport_distance_km <= max_distance_km)
        LIMIT 1;

        v_data_completeness := v_data_completeness + 20;
    END IF;

    IF v_eco_data.transport_mode IS NOT NULL THEN
        SELECT (v_transport_score * score / 100) INTO v_transport_score
        FROM transport_mode_scoring
        WHERE mode_code = v_eco_data.transport_mode;

        v_data_completeness := v_data_completeness + 10;
    END IF;

    -- Calculate packaging score
    IF v_eco_data.packaging_material IS NOT NULL THEN
        SELECT
            base_score +
            CASE WHEN v_eco_data.packaging_is_recyclable THEN recyclable_bonus ELSE 0 END +
            CASE WHEN v_eco_data.packaging_is_biodegradable THEN biodegradable_bonus ELSE 0 END
        INTO v_packaging_score
        FROM packaging_material_scoring
        WHERE material_code = v_eco_data.packaging_material;

        -- Cap at 100
        v_packaging_score := LEAST(v_packaging_score, 100);
        v_data_completeness := v_data_completeness + 25;
    END IF;

    -- Calculate production score
    IF v_eco_data.primary_energy_source IS NOT NULL THEN
        SELECT score INTO v_production_score
        FROM production_energy_scoring
        WHERE energy_code = v_eco_data.primary_energy_source;

        v_data_completeness := v_data_completeness + 20;
    END IF;

    -- Add waste management bonus
    IF v_eco_data.has_waste_recycling THEN
        v_production_score := v_production_score + COALESCE(v_eco_data.waste_recycling_percentage, 50) / 5;
        v_data_completeness := v_data_completeness + 10;
    END IF;

    -- Cap production score at 100
    v_production_score := LEAST(v_production_score, 100);

    -- Calculate certification bonus
    SELECT COALESCE(SUM(ecb.eco_bonus_points), 0)
    INTO v_cert_bonus
    FROM producer_certifications pc
    JOIN certification_types ct ON ct.id = pc.certification_type_id
    LEFT JOIN eco_certification_bonuses ecb ON ecb.certification_type_code = ct.code
    WHERE pc.organization_id = v_product.organization_id
      AND pc.verification_status IN ('verified', 'auto_verified')
      AND (pc.expiry_date IS NULL OR pc.expiry_date >= CURRENT_DATE);

    -- Cap certification score at 100
    v_certification_score := LEAST(v_cert_bonus, 100);
    IF v_certification_score > 0 THEN
        v_data_completeness := v_data_completeness + 15;
    END IF;

    -- Calculate weighted total score
    v_total_score := (
        v_transport_score * 0.30 +
        v_packaging_score * 0.25 +
        v_production_score * 0.30 +
        v_certification_score * 0.15
    )::INTEGER;

    -- Determine eco grade
    SELECT
        CASE
            WHEN v_total_score >= COALESCE(grade_a_plus_min, 90) THEN 'A+'
            WHEN v_total_score >= COALESCE(grade_a_min, 80) THEN 'A'
            WHEN v_total_score >= COALESCE(grade_b_min, 65) THEN 'B'
            WHEN v_total_score >= COALESCE(grade_c_min, 50) THEN 'C'
            WHEN v_total_score >= COALESCE(grade_d_min, 35) THEN 'D'
            WHEN v_total_score >= COALESCE(grade_e_min, 20) THEN 'E'
            ELSE 'F'
        END
    INTO v_eco_grade
    FROM eco_category_benchmarks
    WHERE category = COALESCE(v_product.category, 'default')
    LIMIT 1;

    -- Default grade if no benchmark
    IF v_eco_grade IS NULL THEN
        v_eco_grade := CASE
            WHEN v_total_score >= 90 THEN 'A+'
            WHEN v_total_score >= 80 THEN 'A'
            WHEN v_total_score >= 65 THEN 'B'
            WHEN v_total_score >= 50 THEN 'C'
            WHEN v_total_score >= 35 THEN 'D'
            WHEN v_total_score >= 20 THEN 'E'
            ELSE 'F'
        END;
    END IF;

    -- Estimate CO2
    IF v_eco_data.carbon_footprint_kg IS NOT NULL THEN
        v_estimated_co2 := v_eco_data.carbon_footprint_kg;
    ELSIF v_eco_data.transport_distance_km IS NOT NULL THEN
        SELECT v_eco_data.transport_distance_km * co2_kg_per_km
        INTO v_estimated_co2
        FROM transport_distance_scoring
        WHERE v_eco_data.transport_distance_km >= min_distance_km
          AND (max_distance_km IS NULL OR v_eco_data.transport_distance_km <= max_distance_km)
        LIMIT 1;
    END IF;

    -- Upsert the score
    INSERT INTO product_eco_scores (
        product_id,
        transport_score,
        packaging_score,
        production_score,
        certification_score,
        total_score,
        eco_grade,
        estimated_co2_kg,
        data_completeness_percentage,
        calculated_at
    ) VALUES (
        p_product_id,
        v_transport_score,
        v_packaging_score,
        v_production_score,
        v_certification_score,
        v_total_score,
        v_eco_grade,
        v_estimated_co2,
        v_data_completeness,
        now()
    )
    ON CONFLICT (product_id) DO UPDATE SET
        transport_score = EXCLUDED.transport_score,
        packaging_score = EXCLUDED.packaging_score,
        production_score = EXCLUDED.production_score,
        certification_score = EXCLUDED.certification_score,
        total_score = EXCLUDED.total_score,
        eco_grade = EXCLUDED.eco_grade,
        estimated_co2_kg = EXCLUDED.estimated_co2_kg,
        data_completeness_percentage = EXCLUDED.data_completeness_percentage,
        calculated_at = EXCLUDED.calculated_at
    RETURNING * INTO v_result;

    -- Update eco data last calculated timestamp
    UPDATE product_eco_data
    SET last_calculated_at = now(), updated_at = now()
    WHERE product_id = p_product_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get eco comparison with imports
CREATE OR REPLACE FUNCTION get_eco_comparison(p_product_id UUID)
RETURNS TABLE (
    eco_grade TEXT,
    total_score INTEGER,
    estimated_co2_kg DECIMAL,
    import_avg_co2_kg DECIMAL,
    co2_saved_kg DECIMAL,
    co2_reduction_percentage INTEGER,
    transport_score INTEGER,
    packaging_score INTEGER,
    production_score INTEGER,
    certification_score INTEGER,
    data_completeness INTEGER
) AS $$
DECLARE
    v_product products%ROWTYPE;
    v_eco_score product_eco_scores%ROWTYPE;
    v_benchmark eco_category_benchmarks%ROWTYPE;
BEGIN
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    SELECT * INTO v_eco_score FROM product_eco_scores WHERE product_id = p_product_id;

    SELECT * INTO v_benchmark
    FROM eco_category_benchmarks
    WHERE category = COALESCE(v_product.category, 'default')
    LIMIT 1;

    RETURN QUERY SELECT
        v_eco_score.eco_grade,
        v_eco_score.total_score,
        v_eco_score.estimated_co2_kg,
        COALESCE(v_benchmark.avg_import_co2_kg, 5.0),
        COALESCE(v_benchmark.avg_import_co2_kg, 5.0) - COALESCE(v_eco_score.estimated_co2_kg, 0),
        CASE
            WHEN v_benchmark.avg_import_co2_kg > 0 AND v_eco_score.estimated_co2_kg IS NOT NULL
            THEN ((v_benchmark.avg_import_co2_kg - v_eco_score.estimated_co2_kg) / v_benchmark.avg_import_co2_kg * 100)::INTEGER
            ELSE NULL
        END,
        v_eco_score.transport_score,
        v_eco_score.packaging_score,
        v_eco_score.production_score,
        v_eco_score.certification_score,
        v_eco_score.data_completeness_percentage;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate score when eco data changes
CREATE OR REPLACE FUNCTION trigger_recalculate_eco_score()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_product_eco_score(NEW.product_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER eco_data_changed
    AFTER INSERT OR UPDATE ON product_eco_data
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_eco_score();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE eco_scoring_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_distance_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_mode_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_material_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_energy_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco_certification_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_eco_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_eco_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_eco_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco_category_benchmarks ENABLE ROW LEVEL SECURITY;

-- Reference tables: Public read
CREATE POLICY "Anyone can view eco scoring parameters"
    ON eco_scoring_parameters FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view transport distance scoring"
    ON transport_distance_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view transport mode scoring"
    ON transport_mode_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view packaging material scoring"
    ON packaging_material_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view production energy scoring"
    ON production_energy_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view eco certification bonuses"
    ON eco_certification_bonuses FOR SELECT USING (true);

CREATE POLICY "Anyone can view category benchmarks"
    ON eco_category_benchmarks FOR SELECT USING (true);

-- Product eco data: Org members can manage, public can view
CREATE POLICY "Public can view product eco data"
    ON product_eco_data FOR SELECT USING (true);

CREATE POLICY "Org members can manage product eco data"
    ON product_eco_data FOR ALL USING (
        product_id IN (
            SELECT id FROM products
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'editor')
            )
        )
    );

-- Product eco scores: Public read
CREATE POLICY "Public can view product eco scores"
    ON product_eco_scores FOR SELECT USING (true);

CREATE POLICY "Service role manages eco scores"
    ON product_eco_scores FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Organization eco profile
CREATE POLICY "Public can view org eco profile"
    ON organization_eco_profile FOR SELECT USING (true);

CREATE POLICY "Org admins can manage eco profile"
    ON organization_eco_profile FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE eco_scoring_parameters IS 'Configuration for eco score calculation weights and parameters';
COMMENT ON TABLE transport_distance_scoring IS 'Distance brackets and their eco scores';
COMMENT ON TABLE transport_mode_scoring IS 'Transport modes and their environmental impact';
COMMENT ON TABLE packaging_material_scoring IS 'Packaging materials and their eco scores';
COMMENT ON TABLE production_energy_scoring IS 'Energy sources and their environmental impact';
COMMENT ON TABLE eco_certification_bonuses IS 'Maps certifications to eco bonus points';
COMMENT ON TABLE product_eco_data IS 'Producer-entered environmental data for products';
COMMENT ON TABLE product_eco_scores IS 'Calculated eco scores for products';
COMMENT ON TABLE organization_eco_profile IS 'Organization-level eco settings and defaults';
COMMENT ON TABLE eco_category_benchmarks IS 'Category benchmarks for eco comparisons';
COMMENT ON FUNCTION calculate_product_eco_score IS 'Calculates and stores eco score for a product';
COMMENT ON FUNCTION get_eco_comparison IS 'Returns eco score with import comparison data';
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

CREATE INDEX idx_transparency_total ON public.product_transparency_scores(total_score DESC);
CREATE INDEX idx_transparency_tier ON public.product_transparency_scores(transparency_tier);

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
  position smallint NOT NULL,
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
  position smallint
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
    COALESCE(pts.total_score, 0) as transparency_score
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
      pts.total_score as transparency_score,
      pts.transparency_tier,
      COALESCE(psc.total_similarity, 0.5) as similarity_score,
      o.name as organization_name,
      o.slug as organization_slug,
      osl.level as organization_status_level,
      false as is_sponsored,
      NULL::uuid as sponsored_id,
      ROW_NUMBER() OVER (
        ORDER BY
          pts.total_score DESC,
          COALESCE(psc.total_similarity, 0) DESC
      )::smallint as position
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
      AND COALESCE(pts.total_score, 0) >= 60  -- Must have good transparency
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
      pts.total_score DESC,
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
      pts.total_score as transparency_score,
      pts.transparency_tier,
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
      AND COALESCE(pts.total_score, 0) >= sa.min_transparency_score
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
    SELECT * FROM ranked_alternatives WHERE position <= p_limit - 1
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
      (p_limit)::smallint as position  -- Sponsored always last
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
    ROW_NUMBER() OVER (ORDER BY fr.position)::smallint as position
  FROM final_results fr
  ORDER BY fr.position
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
  p_position smallint,
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
    position,
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
-- Migration: Telegram Bot Integration
-- Adds tables for Telegram user linking and bot interactions

-- =============================================================================
-- TELEGRAM USER LINKS (Connect Telegram accounts to chestno.ru users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS telegram_user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Telegram user info
    telegram_user_id BIGINT NOT NULL UNIQUE,
    telegram_username TEXT,
    telegram_first_name TEXT,
    telegram_last_name TEXT,
    telegram_language_code TEXT,

    -- Link to chestno.ru account (nullable until linked)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Link verification
    link_token TEXT,  -- One-time token for account linking
    link_token_expires_at TIMESTAMPTZ,
    linked_at TIMESTAMPTZ,

    -- Bot interaction state
    current_state TEXT DEFAULT 'idle',  -- FSM state for conversation
    state_data JSONB DEFAULT '{}',  -- Temporary data for multi-step interactions

    -- Notification preferences
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    notify_producer_updates BOOLEAN NOT NULL DEFAULT true,
    notify_review_replies BOOLEAN NOT NULL DEFAULT true,
    notify_new_reviews BOOLEAN NOT NULL DEFAULT false,  -- For producers

    -- Rate limiting
    last_request_at TIMESTAMPTZ,
    request_count_today INTEGER NOT NULL DEFAULT 0,
    request_count_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_telegram_links_user ON telegram_user_links(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_telegram_links_token ON telegram_user_links(link_token) WHERE link_token IS NOT NULL;
CREATE INDEX idx_telegram_links_telegram_id ON telegram_user_links(telegram_user_id);

-- =============================================================================
-- TELEGRAM BOT INTERACTIONS LOG (Audit trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS telegram_bot_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL,

    -- Interaction details
    interaction_type TEXT NOT NULL CHECK (interaction_type IN (
        'command',
        'inn_lookup',
        'ogrn_lookup',
        'qr_scan',
        'review_submit',
        'follow_producer',
        'unfollow_producer',
        'account_link',
        'account_unlink',
        'settings_change',
        'error'
    )),

    -- Input/Output
    input_text TEXT,
    input_data JSONB,
    response_type TEXT,  -- 'text', 'company_card', 'error', etc.
    response_data JSONB,

    -- Timing
    processing_time_ms INTEGER,

    -- Rate limiting info
    was_rate_limited BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for analytics
CREATE INDEX idx_telegram_interactions_user ON telegram_bot_interactions(telegram_user_id);
CREATE INDEX idx_telegram_interactions_type ON telegram_bot_interactions(interaction_type);
CREATE INDEX idx_telegram_interactions_created ON telegram_bot_interactions(created_at);

-- =============================================================================
-- PRODUCER FOLLOWERS (For Telegram notifications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS telegram_producer_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Follow preferences
    notify_new_products BOOLEAN NOT NULL DEFAULT true,
    notify_certifications BOOLEAN NOT NULL DEFAULT true,
    notify_news BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_telegram_producer_follow UNIQUE (telegram_user_id, organization_id)
);

CREATE INDEX idx_telegram_follows_user ON telegram_producer_follows(telegram_user_id);
CREATE INDEX idx_telegram_follows_org ON telegram_producer_follows(organization_id);

-- =============================================================================
-- PENDING REVIEWS (Reviews started in Telegram, completed on web)
-- =============================================================================
CREATE TABLE IF NOT EXISTS telegram_pending_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL,

    -- Review target
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID,  -- If reviewing specific product

    -- Review data (partial)
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,

    -- Completion link
    completion_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_pending_reviews_token ON telegram_pending_reviews(completion_token);
CREATE INDEX idx_telegram_pending_reviews_user ON telegram_pending_reviews(telegram_user_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE telegram_user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_bot_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_producer_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_pending_reviews ENABLE ROW LEVEL SECURITY;

-- Users can view/manage their own Telegram link
CREATE POLICY "Users can view own telegram link"
    ON telegram_user_links FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages telegram links"
    ON telegram_user_links FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Interactions: service role only
CREATE POLICY "Service role manages interactions"
    ON telegram_bot_interactions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Follows: service role manages, linked users can view their own
CREATE POLICY "Service role manages follows"
    ON telegram_producer_follows FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Pending reviews: service role only
CREATE POLICY "Service role manages pending reviews"
    ON telegram_pending_reviews FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- FUNCTION: Reset daily rate limits
-- =============================================================================
CREATE OR REPLACE FUNCTION reset_telegram_rate_limits()
RETURNS void AS $$
BEGIN
    UPDATE telegram_user_links
    SET request_count_today = 0,
        request_count_reset_at = CURRENT_DATE
    WHERE request_count_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Check and increment rate limit
-- =============================================================================
CREATE OR REPLACE FUNCTION check_telegram_rate_limit(
    p_telegram_user_id BIGINT,
    p_daily_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMPTZ
) AS $$
DECLARE
    v_link telegram_user_links%ROWTYPE;
BEGIN
    -- Get or create link record
    INSERT INTO telegram_user_links (telegram_user_id)
    VALUES (p_telegram_user_id)
    ON CONFLICT (telegram_user_id) DO NOTHING;

    -- Reset if new day
    UPDATE telegram_user_links
    SET request_count_today = 0,
        request_count_reset_at = CURRENT_DATE
    WHERE telegram_user_id = p_telegram_user_id
      AND request_count_reset_at < CURRENT_DATE;

    -- Get current state
    SELECT * INTO v_link
    FROM telegram_user_links
    WHERE telegram_user_id = p_telegram_user_id;

    -- Check limit
    IF v_link.request_count_today >= p_daily_limit THEN
        RETURN QUERY SELECT
            false,
            0,
            (v_link.request_count_reset_at + INTERVAL '1 day')::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Increment counter
    UPDATE telegram_user_links
    SET request_count_today = request_count_today + 1,
        last_request_at = now(),
        updated_at = now()
    WHERE telegram_user_id = p_telegram_user_id;

    RETURN QUERY SELECT
        true,
        p_daily_limit - v_link.request_count_today - 1,
        (v_link.request_count_reset_at + INTERVAL '1 day')::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE telegram_user_links IS 'Links Telegram users to chestno.ru accounts';
COMMENT ON TABLE telegram_bot_interactions IS 'Audit log of all bot interactions';
COMMENT ON TABLE telegram_producer_follows IS 'Tracks which producers Telegram users follow';
COMMENT ON TABLE telegram_pending_reviews IS 'Reviews started in Telegram but not yet completed';
COMMENT ON COLUMN telegram_user_links.current_state IS 'FSM state for multi-step conversations';
COMMENT ON COLUMN telegram_user_links.request_count_today IS 'Daily request counter for rate limiting';
-- Migration: Real-time Scan Alert System
-- Adds alert rules, scan statistics, Telegram integration, and escalation

SET client_encoding = 'UTF8';

-- ============================================
-- 1. Product Batches Table (for batch-level tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.product_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_code text NOT NULL,
    batch_name text,
    production_date date,
    expiry_date date,
    quantity integer,
    metadata jsonb DEFAULT '{}',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT product_batches_unique_code UNIQUE (organization_id, batch_code)
);

CREATE INDEX idx_product_batches_org ON public.product_batches(organization_id);
CREATE INDEX idx_product_batches_product ON public.product_batches(product_id);
CREATE INDEX idx_product_batches_code ON public.product_batches(batch_code);

-- ============================================
-- 2. Scan Events Extended (link to batches)
-- ============================================

ALTER TABLE public.qr_scan_events
    ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS country text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
    ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
    ADD COLUMN IF NOT EXISTS device_type text,
    ADD COLUMN IF NOT EXISTS is_suspicious boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS suspicious_reason text;

CREATE INDEX IF NOT EXISTS idx_qr_scan_events_batch ON public.qr_scan_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_product ON public.qr_scan_events(product_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_suspicious ON public.qr_scan_events(is_suspicious) WHERE is_suspicious = true;

-- ============================================
-- 3. Scan Alert Types (extends notification_types)
-- ============================================

INSERT INTO public.notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('scan.first_batch_scan', 'scan', 'info',
     'Первое сканирование партии {{batch_code}}',
     'Партия {{batch_code}} продукта "{{product_name}}" впервые отсканирована в {{location}}.',
     ARRAY['in_app', 'push']),

    ('scan.unusual_pattern', 'scan', 'warning',
     'Подозрительная активность сканирования',
     'Обнаружена необычная активность для {{batch_code}}: {{reason}}. Рекомендуем проверить.',
     ARRAY['in_app', 'push', 'email']),

    ('scan.potential_counterfeit', 'scan', 'critical',
     'Возможная подделка обнаружена!',
     'ВНИМАНИЕ: Партия {{batch_code}} показывает признаки подделки. {{details}}',
     ARRAY['in_app', 'push', 'email', 'telegram']),

    ('scan.viral_spike', 'scan', 'info',
     'Резкий рост сканирований!',
     'Партия {{batch_code}} набирает популярность: {{scan_count}} сканирований за {{time_period}}.',
     ARRAY['in_app', 'push']),

    ('scan.geographic_anomaly', 'scan', 'warning',
     'Географическая аномалия сканирования',
     'Партия {{batch_code}} сканируется из неожиданного региона: {{location}}.',
     ARRAY['in_app', 'push', 'email']),

    ('scan.milestone_reached', 'scan', 'info',
     'Достигнут рубеж сканирований!',
     'Поздравляем! Партия {{batch_code}} достигла {{milestone}} сканирований.',
     ARRAY['in_app', 'push']),

    ('review.negative_alert', 'review', 'warning',
     'Получен негативный отзыв',
     'Пользователь оставил отзыв с оценкой {{rating}}/5 о продукте "{{product_name}}". Рекомендуем ответить.',
     ARRAY['in_app', 'push', 'email'])
ON CONFLICT (key) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    default_channels = EXCLUDED.default_channels;

-- ============================================
-- 4. Alert Rules Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_alert_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_type text NOT NULL CHECK (rule_type IN (
        'first_scan',
        'scan_spike',
        'unusual_location',
        'time_anomaly',
        'counterfeit_pattern',
        'milestone',
        'negative_review'
    )),
    rule_name text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    priority smallint NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

    -- Rule configuration (varies by type)
    config jsonb NOT NULL DEFAULT '{}',

    -- Notification settings
    channels text[] NOT NULL DEFAULT ARRAY['in_app'],
    cooldown_minutes integer NOT NULL DEFAULT 60,

    -- Auto-escalation settings
    escalate_after_minutes integer,
    escalate_to_user_ids uuid[],

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_alert_rules_org ON public.scan_alert_rules(organization_id);
CREATE INDEX idx_scan_alert_rules_type ON public.scan_alert_rules(rule_type);
CREATE INDEX idx_scan_alert_rules_enabled ON public.scan_alert_rules(is_enabled) WHERE is_enabled = true;

-- ============================================
-- 5. Alert Events (fired alerts)
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_id uuid REFERENCES public.scan_alert_rules(id) ON DELETE SET NULL,
    alert_type text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),

    -- Alert context
    batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    scan_event_id uuid REFERENCES public.qr_scan_events(id) ON DELETE SET NULL,

    -- Alert content
    title text NOT NULL,
    body text NOT NULL,
    metadata jsonb DEFAULT '{}',

    -- Status tracking
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'investigating', 'resolved', 'dismissed')),
    acknowledged_at timestamptz,
    acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes text,

    -- Escalation tracking
    is_escalated boolean NOT NULL DEFAULT false,
    escalated_at timestamptz,
    escalation_level smallint DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_alerts_org ON public.scan_alerts(organization_id);
CREATE INDEX idx_scan_alerts_status ON public.scan_alerts(status);
CREATE INDEX idx_scan_alerts_severity ON public.scan_alerts(severity);
CREATE INDEX idx_scan_alerts_created ON public.scan_alerts(created_at DESC);
CREATE INDEX idx_scan_alerts_batch ON public.scan_alerts(batch_id);
CREATE INDEX idx_scan_alerts_unresolved ON public.scan_alerts(organization_id, status)
    WHERE status NOT IN ('resolved', 'dismissed');

-- ============================================
-- 6. Telegram Integration
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_telegram_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id text NOT NULL,
    telegram_username text,
    is_verified boolean NOT NULL DEFAULT false,
    verification_code text,
    verification_expires_at timestamptz,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id),
    UNIQUE (telegram_chat_id)
);

CREATE INDEX idx_user_telegram_verified ON public.user_telegram_links(is_verified) WHERE is_verified = true;

-- ============================================
-- 7. Organization Alert Preferences
-- ============================================

CREATE TABLE IF NOT EXISTS public.organization_alert_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,

    -- Global settings
    alerts_enabled boolean NOT NULL DEFAULT true,
    quiet_hours_start time,
    quiet_hours_end time,
    quiet_hours_timezone text DEFAULT 'Europe/Moscow',

    -- Default channels
    default_channels text[] NOT NULL DEFAULT ARRAY['in_app', 'email'],

    -- Escalation defaults
    auto_escalate_critical boolean NOT NULL DEFAULT true,
    escalation_delay_minutes integer NOT NULL DEFAULT 30,

    -- Digest preferences
    send_daily_digest boolean NOT NULL DEFAULT true,
    digest_time time DEFAULT '09:00',

    -- Thresholds
    scan_spike_threshold integer NOT NULL DEFAULT 100,
    scan_spike_window_minutes integer NOT NULL DEFAULT 60,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 8. Scan Statistics (for anomaly detection)
-- ============================================

CREATE TABLE IF NOT EXISTS public.scan_statistics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    batch_id uuid REFERENCES public.product_batches(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,

    -- Time bucket
    bucket_start timestamptz NOT NULL,
    bucket_type text NOT NULL CHECK (bucket_type IN ('hour', 'day', 'week')),

    -- Metrics
    scan_count integer NOT NULL DEFAULT 0,
    unique_users integer NOT NULL DEFAULT 0,
    unique_locations integer NOT NULL DEFAULT 0,
    suspicious_count integer NOT NULL DEFAULT 0,

    -- Geographic distribution
    top_countries jsonb DEFAULT '[]',
    top_cities jsonb DEFAULT '[]',

    -- Computed metrics
    avg_scans_per_hour numeric(10, 2),
    deviation_from_normal numeric(10, 2),

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT scan_stats_unique_bucket UNIQUE (organization_id, batch_id, product_id, bucket_start, bucket_type)
);

CREATE INDEX idx_scan_stats_org ON public.scan_statistics(organization_id);
CREATE INDEX idx_scan_stats_batch ON public.scan_statistics(batch_id);
CREATE INDEX idx_scan_stats_bucket ON public.scan_statistics(bucket_start, bucket_type);

-- ============================================
-- 9. RLS Policies
-- ============================================

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_statistics ENABLE ROW LEVEL SECURITY;

-- Product Batches Policies
CREATE POLICY "Org members view batches" ON public.product_batches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = product_batches.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org editors manage batches" ON public.product_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = product_batches.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Scan Alert Rules Policies
CREATE POLICY "Org members view alert rules" ON public.scan_alert_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alert_rules.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage alert rules" ON public.scan_alert_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alert_rules.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

-- Scan Alerts Policies
CREATE POLICY "Org members view alerts" ON public.scan_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alerts.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org members update alerts" ON public.scan_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_alerts.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- Telegram Links Policies
CREATE POLICY "Users manage own telegram" ON public.user_telegram_links
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Alert Preferences Policies
CREATE POLICY "Org members view alert preferences" ON public.organization_alert_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_alert_preferences.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage alert preferences" ON public.organization_alert_preferences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_alert_preferences.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

-- Scan Statistics Policies
CREATE POLICY "Org members view scan stats" ON public.scan_statistics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = scan_statistics.organization_id
              AND om.user_id = auth.uid()
        )
    );

-- ============================================
-- 10. Default Alert Rules Function
-- ============================================

CREATE OR REPLACE FUNCTION public.create_default_alert_rules(org_id uuid)
RETURNS void AS $$
BEGIN
    -- First scan alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'first_scan', 'Первое сканирование партии',
            '{"notify_for_each_batch": true}'::jsonb,
            ARRAY['in_app', 'push'], 3);

    -- Scan spike alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'scan_spike', 'Всплеск сканирований',
            '{"threshold_multiplier": 3, "min_scans": 50, "window_minutes": 60}'::jsonb,
            ARRAY['in_app', 'push', 'email'], 5);

    -- Unusual location alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'unusual_location', 'Неожиданный регион',
            '{"expected_countries": ["RU"], "alert_on_new_country": true}'::jsonb,
            ARRAY['in_app', 'email'], 4);

    -- Counterfeit pattern alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority,
                                         escalate_after_minutes)
    VALUES (org_id, 'counterfeit_pattern', 'Признаки подделки',
            '{"max_scans_per_hour": 10, "geographic_spread_threshold": 3}'::jsonb,
            ARRAY['in_app', 'push', 'email', 'telegram'], 10,
            15);

    -- Milestone alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'milestone', 'Достижение рубежей',
            '{"milestones": [100, 500, 1000, 5000, 10000]}'::jsonb,
            ARRAY['in_app'], 2);

    -- Negative review alert
    INSERT INTO public.scan_alert_rules (organization_id, rule_type, rule_name, config, channels, priority)
    VALUES (org_id, 'negative_review', 'Негативные отзывы',
            '{"min_rating_threshold": 3, "include_no_text": false}'::jsonb,
            ARRAY['in_app', 'push', 'email'], 6);

    -- Create default preferences
    INSERT INTO public.organization_alert_preferences (organization_id)
    VALUES (org_id)
    ON CONFLICT (organization_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Trigger: Auto-create alert rules for new orgs
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_create_org_alert_rules()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_default_alert_rules(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created_alert_rules ON public.organizations;
CREATE TRIGGER on_organization_created_alert_rules
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_create_org_alert_rules();

-- ============================================
-- 12. Comments
-- ============================================

COMMENT ON TABLE public.product_batches IS 'Product batches for tracking individual production runs';
COMMENT ON TABLE public.scan_alert_rules IS 'Configurable alert rules per organization';
COMMENT ON TABLE public.scan_alerts IS 'Fired alerts with status tracking and escalation';
COMMENT ON TABLE public.user_telegram_links IS 'Telegram bot integration for user notifications';
COMMENT ON TABLE public.organization_alert_preferences IS 'Organization-wide alert settings';
COMMENT ON TABLE public.scan_statistics IS 'Aggregated scan metrics for anomaly detection';
-- Migration: Purchase Verification System
-- Adds verified purchase badges for reviews with Честный ЗНАК integration

-- ============================================
-- 1. Create verification methods enum type
-- ============================================

DO $$ BEGIN
    CREATE TYPE verification_method AS ENUM (
        'chestny_znak',      -- Честный ЗНАК API verification
        'qr_scan',           -- QR code scan proof (from our system)
        'receipt_upload',    -- Receipt/check photo upload
        'manual_admin',      -- Manual admin verification
        'loyalty_purchase'   -- Verified through loyalty program
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM (
        'pending',           -- Awaiting verification
        'verified',          -- Successfully verified
        'failed',            -- Verification failed
        'expired',           -- Verification expired
        'revoked'            -- Manually revoked
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. Create purchase_verifications table
-- ============================================

CREATE TABLE IF NOT EXISTS public.purchase_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,

    -- Verification details
    method verification_method NOT NULL,
    status verification_status NOT NULL DEFAULT 'pending',

    -- Честный ЗНАК specific fields
    chestny_znak_code text,              -- The DataMatrix code (КМ)
    chestny_znak_gtin text,              -- Global Trade Item Number
    chestny_znak_serial text,            -- Serial number from code
    chestny_znak_verified_at timestamptz,
    chestny_znak_response jsonb,         -- Full API response for audit

    -- QR scan verification
    qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
    qr_scan_event_id uuid,               -- Reference to scan event
    qr_scanned_at timestamptz,

    -- Receipt verification
    receipt_image_url text,
    receipt_date date,
    receipt_amount_cents integer,
    receipt_ocr_result jsonb,            -- OCR extracted data
    receipt_verified_by uuid REFERENCES public.app_users(id),
    receipt_verified_at timestamptz,

    -- Trust scoring
    trust_score decimal(3,2) DEFAULT 0.00 CHECK (trust_score >= 0 AND trust_score <= 1),
    trust_factors jsonb DEFAULT '{}'::jsonb,

    -- Metadata
    verification_notes text,
    verified_by uuid REFERENCES public.app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,              -- Verification can expire

    CONSTRAINT purchase_verifications_review_unique UNIQUE (review_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_user ON public.purchase_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_org ON public.purchase_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_product ON public.purchase_verifications(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_status ON public.purchase_verifications(status);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_method ON public.purchase_verifications(method);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_chestny_code ON public.purchase_verifications(chestny_znak_code) WHERE chestny_znak_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_trust ON public.purchase_verifications(trust_score DESC) WHERE status = 'verified';

COMMENT ON TABLE public.purchase_verifications IS 'Purchase verification records for verified review badges';
COMMENT ON COLUMN public.purchase_verifications.trust_score IS 'Composite trust score 0-1 based on verification strength';
COMMENT ON COLUMN public.purchase_verifications.trust_factors IS 'JSON breakdown of trust score components';

-- ============================================
-- 3. Create Честный ЗНАК verification log
-- ============================================

CREATE TABLE IF NOT EXISTS public.chestny_znak_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id uuid REFERENCES public.purchase_verifications(id) ON DELETE CASCADE,

    -- Request data
    code_raw text NOT NULL,              -- Original scanned code
    code_normalized text,                -- Normalized code without brackets
    gtin text,                           -- Extracted GTIN
    serial text,                         -- Extracted serial

    -- API response
    api_endpoint text,
    api_request_at timestamptz NOT NULL DEFAULT now(),
    api_response_code integer,
    api_response_body jsonb,
    api_response_time_ms integer,

    -- Parsed results
    product_name text,
    producer_name text,
    product_category text,
    is_valid boolean,
    is_sold boolean,                     -- Product status in system
    ownership_status text,               -- Current ownership
    last_operation_date timestamptz,

    -- Error handling
    error_code text,
    error_message text,
    retry_count integer DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chestny_znak_verifications_code ON public.chestny_znak_verifications(code_normalized);
CREATE INDEX IF NOT EXISTS idx_chestny_znak_verifications_gtin ON public.chestny_znak_verifications(gtin);
CREATE INDEX IF NOT EXISTS idx_chestny_znak_verifications_verification ON public.chestny_znak_verifications(verification_id);

COMMENT ON TABLE public.chestny_znak_verifications IS 'Audit log for Честный ЗНАК API calls';

-- ============================================
-- 4. Add verification fields to reviews table
-- ============================================

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS is_verified_purchase boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_method verification_method,
    ADD COLUMN IF NOT EXISTS verification_badge_shown boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS trust_weight decimal(3,2) DEFAULT 1.00;

CREATE INDEX IF NOT EXISTS idx_reviews_verified ON public.reviews(is_verified_purchase) WHERE is_verified_purchase = true;
CREATE INDEX IF NOT EXISTS idx_reviews_trust_weight ON public.reviews(trust_weight DESC);

COMMENT ON COLUMN public.reviews.is_verified_purchase IS 'Whether this review has a verified purchase';
COMMENT ON COLUMN public.reviews.verification_method IS 'How the purchase was verified';
COMMENT ON COLUMN public.reviews.trust_weight IS 'Weight multiplier for sorting (verified reviews rank higher)';

-- ============================================
-- 5. Create verification requests queue
-- ============================================

CREATE TABLE IF NOT EXISTS public.verification_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,

    -- Request type
    method verification_method NOT NULL,
    priority integer DEFAULT 0,          -- Higher = process first

    -- Request data
    request_data jsonb NOT NULL,         -- Method-specific data

    -- Processing status
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_attempt_at timestamptz,
    next_attempt_at timestamptz,

    -- Results
    result_data jsonb,
    error_message text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_verification_requests_review ON public.verification_requests(review_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_next_attempt ON public.verification_requests(next_attempt_at) WHERE status IN ('queued', 'failed');

COMMENT ON TABLE public.verification_requests IS 'Queue for async verification processing';

-- ============================================
-- 6. Trust score configuration
-- ============================================

CREATE TABLE IF NOT EXISTS public.verification_trust_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Method weights (how much each method contributes to trust)
    weight_chestny_znak decimal(3,2) DEFAULT 1.00,
    weight_qr_scan decimal(3,2) DEFAULT 0.80,
    weight_receipt_upload decimal(3,2) DEFAULT 0.70,
    weight_manual_admin decimal(3,2) DEFAULT 0.90,
    weight_loyalty_purchase decimal(3,2) DEFAULT 0.85,

    -- Sorting boost factors
    verified_review_boost decimal(3,2) DEFAULT 1.50,   -- Multiply in sort score
    unverified_penalty decimal(3,2) DEFAULT 0.80,      -- Reduce unverified weight

    -- Display settings
    show_verification_badge boolean DEFAULT true,
    show_method_icon boolean DEFAULT true,
    require_verification_for_featured boolean DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT verification_trust_config_org_unique UNIQUE (organization_id)
);

-- Insert default config (organization_id NULL = platform default)
INSERT INTO public.verification_trust_config (organization_id) VALUES (NULL)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.verification_trust_config IS 'Configuration for trust scoring and display';

-- ============================================
-- 7. RLS Policies
-- ============================================

ALTER TABLE public.purchase_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chestny_znak_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_trust_config ENABLE ROW LEVEL SECURITY;

-- purchase_verifications policies
CREATE POLICY "Users view own verifications" ON public.purchase_verifications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Org members view org verifications" ON public.purchase_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = purchase_verifications.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins view all verifications" ON public.purchase_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    );

CREATE POLICY "Users create own verifications" ON public.purchase_verifications
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Platform admins manage verifications" ON public.purchase_verifications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- chestny_znak_verifications policies (audit log - read-only for users)
CREATE POLICY "Users view own chestny znak logs" ON public.chestny_znak_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_verifications pv
            WHERE pv.id = chestny_znak_verifications.verification_id
              AND pv.user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins view all chestny znak logs" ON public.chestny_znak_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    );

-- verification_requests policies
CREATE POLICY "Users view own requests" ON public.verification_requests
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users create own requests" ON public.verification_requests
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Platform admins manage requests" ON public.verification_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- verification_trust_config policies
CREATE POLICY "Anyone reads default config" ON public.verification_trust_config
    FOR SELECT
    USING (organization_id IS NULL);

CREATE POLICY "Org members read org config" ON public.verification_trust_config
    FOR SELECT
    USING (
        organization_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = verification_trust_config.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage config" ON public.verification_trust_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = verification_trust_config.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

-- ============================================
-- 8. Functions for trust score calculation
-- ============================================

CREATE OR REPLACE FUNCTION calculate_verification_trust_score(
    p_method verification_method,
    p_organization_id uuid DEFAULT NULL
) RETURNS decimal(3,2)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_config record;
    v_score decimal(3,2);
BEGIN
    -- Get config (org-specific or default)
    SELECT * INTO v_config
    FROM public.verification_trust_config
    WHERE organization_id = p_organization_id
       OR (p_organization_id IS NOT NULL AND organization_id IS NULL)
    ORDER BY organization_id NULLS LAST
    LIMIT 1;

    -- Calculate score based on method
    CASE p_method
        WHEN 'chestny_znak' THEN v_score := COALESCE(v_config.weight_chestny_znak, 1.00);
        WHEN 'qr_scan' THEN v_score := COALESCE(v_config.weight_qr_scan, 0.80);
        WHEN 'receipt_upload' THEN v_score := COALESCE(v_config.weight_receipt_upload, 0.70);
        WHEN 'manual_admin' THEN v_score := COALESCE(v_config.weight_manual_admin, 0.90);
        WHEN 'loyalty_purchase' THEN v_score := COALESCE(v_config.weight_loyalty_purchase, 0.85);
        ELSE v_score := 0.50;
    END CASE;

    RETURN v_score;
END;
$$;

CREATE OR REPLACE FUNCTION update_review_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When verification is created/updated to verified
    IF NEW.status = 'verified' THEN
        UPDATE public.reviews
        SET
            is_verified_purchase = true,
            verification_method = NEW.method,
            trust_weight = calculate_verification_trust_score(NEW.method, NEW.organization_id) * 1.5,
            updated_at = now()
        WHERE id = NEW.review_id;
    -- When verification is revoked/failed
    ELSIF NEW.status IN ('revoked', 'failed', 'expired') AND OLD.status = 'verified' THEN
        UPDATE public.reviews
        SET
            is_verified_purchase = false,
            verification_method = NULL,
            trust_weight = 1.00,
            updated_at = now()
        WHERE id = NEW.review_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_review_verification
    AFTER INSERT OR UPDATE OF status ON public.purchase_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_review_verification_status();

-- ============================================
-- 9. Function for weighted review sorting
-- ============================================

CREATE OR REPLACE FUNCTION get_weighted_review_score(
    p_review_id uuid
) RETURNS decimal(10,4)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_review record;
    v_base_score decimal(10,4);
    v_time_decay decimal(5,4);
    v_final_score decimal(10,4);
BEGIN
    SELECT r.*, pv.trust_score as verification_trust
    INTO v_review
    FROM public.reviews r
    LEFT JOIN public.purchase_verifications pv ON pv.review_id = r.id AND pv.status = 'verified'
    WHERE r.id = p_review_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Base score from rating (1-5 normalized to 0.2-1.0)
    v_base_score := v_review.rating::decimal / 5.0;

    -- Apply trust weight multiplier
    v_base_score := v_base_score * COALESCE(v_review.trust_weight, 1.0);

    -- Time decay (reviews lose relevance over time)
    -- Half-life of 90 days
    v_time_decay := POWER(0.5, EXTRACT(EPOCH FROM (now() - v_review.created_at)) / (90 * 24 * 60 * 60));

    -- Minimum decay of 0.3 (reviews never completely disappear)
    v_time_decay := GREATEST(v_time_decay, 0.3);

    v_final_score := v_base_score * v_time_decay;

    RETURN v_final_score;
END;
$$;

COMMENT ON FUNCTION get_weighted_review_score IS 'Calculate weighted score for review sorting considering verification and time decay';

-- ============================================
-- 10. View for public reviews with verification info
-- ============================================

CREATE OR REPLACE VIEW public.v_public_reviews_with_verification AS
SELECT
    r.id,
    r.organization_id,
    r.product_id,
    r.author_user_id,
    r.rating,
    r.title,
    r.body,
    r.media,
    r.response,
    r.response_at,
    r.created_at,
    r.is_verified_purchase,
    r.verification_method,
    r.trust_weight,
    pv.status as verification_status,
    pv.trust_score,
    CASE
        WHEN r.is_verified_purchase AND pv.status = 'verified' THEN
            CASE r.verification_method
                WHEN 'chestny_znak' THEN 'government_verified'
                WHEN 'qr_scan' THEN 'qr_verified'
                WHEN 'receipt_upload' THEN 'receipt_verified'
                WHEN 'manual_admin' THEN 'admin_verified'
                WHEN 'loyalty_purchase' THEN 'loyalty_verified'
                ELSE 'verified'
            END
        ELSE 'unverified'
    END as badge_type,
    get_weighted_review_score(r.id) as sort_score
FROM public.reviews r
LEFT JOIN public.purchase_verifications pv ON pv.review_id = r.id
WHERE r.status = 'approved';

COMMENT ON VIEW public.v_public_reviews_with_verification IS 'Public reviews with verification badges for display';
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
-- Migration 0041: Story Videos for Producer Journey
-- Date: 2026-02-01
-- Description: Video content for producer stories at key journey stages
-- Features: Video metadata, subtitles/captions, thumbnail generation tracking

BEGIN;

-- ============================================================
-- TABLE: story_videos
-- ============================================================
-- Stores video content for producer stories
-- Optimized for short-form (30-60 sec) storytelling at journey stages

CREATE TABLE IF NOT EXISTS public.story_videos (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Optional link to journey step (can be standalone or attached to journey)
  journey_step_id uuid
    REFERENCES public.product_journey_steps(id) ON DELETE SET NULL,
  
  -- Optional link to product
  product_id uuid
    REFERENCES public.products(id) ON DELETE SET NULL,

  -- Video metadata
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (length(description) <= 2000),
  
  -- Video file information
  video_url text NOT NULL,
  video_path text NOT NULL,  -- Storage path for deletion
  thumbnail_url text,
  thumbnail_path text,
  
  -- Technical metadata
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 300),
  width integer,
  height integer,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('video/mp4', 'video/webm', 'video/quicktime')),
  codec text,
  
  -- Processing status
  processing_status text NOT NULL DEFAULT 'uploaded' 
    CHECK (processing_status IN (
      'uploaded',      -- Raw upload complete
      'processing',    -- Being transcoded/compressed
      'ready',         -- Ready for playback
      'failed'         -- Processing failed
    )),
  processing_error text,
  processed_at timestamptz,
  
  -- Playback settings
  autoplay_on_hover boolean NOT NULL DEFAULT true,
  loop_playback boolean NOT NULL DEFAULT false,
  muted_by_default boolean NOT NULL DEFAULT true,
  
  -- Visibility
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  
  -- Analytics
  view_count integer NOT NULL DEFAULT 0,
  unique_view_count integer NOT NULL DEFAULT 0,
  watch_time_seconds bigint NOT NULL DEFAULT 0,
  completion_rate numeric(5,2),  -- Percentage of video watched on average

  -- Audit
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: story_video_subtitles
-- ============================================================
-- VTT-style subtitle tracks for accessibility

CREATE TABLE IF NOT EXISTS public.story_video_subtitles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  video_id uuid NOT NULL
    REFERENCES public.story_videos(id) ON DELETE CASCADE,
  
  -- Language code (ISO 639-1)
  language_code text NOT NULL CHECK (length(language_code) = 2),
  language_name text NOT NULL,  -- e.g., "Русский", "English"
  
  -- Subtitle content
  subtitle_url text,  -- URL to VTT file in storage
  subtitle_path text, -- Storage path
  
  -- Inline subtitles (for simpler cases)
  subtitle_data jsonb,
    -- Array format: [{ "start": 0.5, "end": 2.5, "text": "Привет!" }, ...]
  
  -- Metadata
  is_auto_generated boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Only one subtitle track per language per video
  CONSTRAINT unique_video_language UNIQUE (video_id, language_code)
);

-- ============================================================
-- TABLE: story_video_views
-- ============================================================
-- Analytics for video engagement

CREATE TABLE IF NOT EXISTS public.story_video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  video_id uuid NOT NULL
    REFERENCES public.story_videos(id) ON DELETE CASCADE,
  
  -- Viewer info (nullable for anonymous)
  viewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  
  -- View details
  watched_seconds integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  device_type text CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  referrer text,
  
  -- Interaction
  was_muted boolean,
  entered_fullscreen boolean NOT NULL DEFAULT false,
  
  viewed_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Story videos by organization
CREATE INDEX idx_story_videos_org ON public.story_videos(organization_id);

-- Story videos by journey step
CREATE INDEX idx_story_videos_journey ON public.story_videos(journey_step_id)
  WHERE journey_step_id IS NOT NULL;

-- Story videos by product
CREATE INDEX idx_story_videos_product ON public.story_videos(product_id)
  WHERE product_id IS NOT NULL;

-- Published videos for public queries
CREATE INDEX idx_story_videos_published ON public.story_videos(organization_id, is_published, created_at DESC)
  WHERE is_published = true AND processing_status = 'ready';

-- Processing queue
CREATE INDEX idx_story_videos_processing ON public.story_videos(processing_status, created_at)
  WHERE processing_status IN ('uploaded', 'processing');

-- Subtitles by video
CREATE INDEX idx_subtitles_video ON public.story_video_subtitles(video_id);

-- View analytics
CREATE INDEX idx_video_views_video ON public.story_video_views(video_id);
CREATE INDEX idx_video_views_viewer ON public.story_video_views(viewer_user_id)
  WHERE viewer_user_id IS NOT NULL;
CREATE INDEX idx_video_views_time ON public.story_video_views(viewed_at DESC);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.story_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_video_subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_video_views ENABLE ROW LEVEL SECURITY;

-- Public can view published videos
DROP POLICY IF EXISTS "Public view published videos" ON public.story_videos;
CREATE POLICY "Public view published videos"
ON public.story_videos
FOR SELECT
USING (
  is_published = true 
  AND processing_status = 'ready'
);

-- Org editors can manage their videos
DROP POLICY IF EXISTS "Org editors manage videos" ON public.story_videos;
CREATE POLICY "Org editors manage videos"
ON public.story_videos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = story_videos.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = story_videos.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
);

-- Public can view subtitles for published videos
DROP POLICY IF EXISTS "Public view subtitles" ON public.story_video_subtitles;
CREATE POLICY "Public view subtitles"
ON public.story_video_subtitles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.story_videos v
    WHERE v.id = story_video_subtitles.video_id
      AND v.is_published = true
      AND v.processing_status = 'ready'
  )
);

-- Org editors can manage subtitles
DROP POLICY IF EXISTS "Org editors manage subtitles" ON public.story_video_subtitles;
CREATE POLICY "Org editors manage subtitles"
ON public.story_video_subtitles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.story_videos v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE v.id = story_video_subtitles.video_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.story_videos v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE v.id = story_video_subtitles.video_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
);

-- Anyone can create view records
DROP POLICY IF EXISTS "Insert video views" ON public.story_video_views;
CREATE POLICY "Insert video views"
ON public.story_video_views
FOR INSERT
WITH CHECK (true);

-- Users can view their own view history
DROP POLICY IF EXISTS "View own video history" ON public.story_video_views;
CREATE POLICY "View own video history"
ON public.story_video_views
FOR SELECT
USING (
  viewer_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.story_videos v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE v.id = story_video_views.video_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
  )
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Record video view and update counters
CREATE OR REPLACE FUNCTION public.record_video_view(
  p_video_id uuid,
  p_session_id text DEFAULT NULL,
  p_watched_seconds integer DEFAULT 0,
  p_completed boolean DEFAULT false,
  p_device_type text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_was_muted boolean DEFAULT NULL,
  p_entered_fullscreen boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_view_id uuid;
  v_viewer_id uuid;
  v_is_unique boolean := false;
BEGIN
  -- Get current user if authenticated
  v_viewer_id := auth.uid();
  
  -- Check if this is a unique view
  IF v_viewer_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.story_video_views
      WHERE video_id = p_video_id AND viewer_user_id = v_viewer_id
    ) INTO v_is_unique;
  ELSIF p_session_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.story_video_views
      WHERE video_id = p_video_id AND session_id = p_session_id
    ) INTO v_is_unique;
  ELSE
    v_is_unique := true; -- Anonymous views are always counted as unique
  END IF;
  
  -- Insert view record
  INSERT INTO public.story_video_views (
    video_id,
    viewer_user_id,
    session_id,
    watched_seconds,
    completed,
    device_type,
    referrer,
    was_muted,
    entered_fullscreen
  ) VALUES (
    p_video_id,
    v_viewer_id,
    p_session_id,
    p_watched_seconds,
    p_completed,
    p_device_type,
    p_referrer,
    p_was_muted,
    p_entered_fullscreen
  )
  RETURNING id INTO v_view_id;
  
  -- Update video counters
  UPDATE public.story_videos
  SET 
    view_count = view_count + 1,
    unique_view_count = unique_view_count + (CASE WHEN v_is_unique THEN 1 ELSE 0 END),
    watch_time_seconds = watch_time_seconds + p_watched_seconds,
    updated_at = now()
  WHERE id = p_video_id;
  
  RETURN v_view_id;
END;
$$;

-- Get video analytics summary
CREATE OR REPLACE FUNCTION public.get_video_analytics(
  p_video_id uuid
)
RETURNS TABLE (
  total_views bigint,
  unique_views bigint,
  total_watch_time bigint,
  avg_watch_time numeric,
  completion_rate numeric,
  mobile_views bigint,
  tablet_views bigint,
  desktop_views bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v.view_count::bigint,
    v.unique_view_count::bigint,
    v.watch_time_seconds,
    CASE WHEN v.view_count > 0 
      THEN (v.watch_time_seconds::numeric / v.view_count)
      ELSE 0 
    END,
    v.completion_rate,
    (SELECT COUNT(*) FROM story_video_views WHERE video_id = p_video_id AND device_type = 'mobile'),
    (SELECT COUNT(*) FROM story_video_views WHERE video_id = p_video_id AND device_type = 'tablet'),
    (SELECT COUNT(*) FROM story_video_views WHERE video_id = p_video_id AND device_type = 'desktop')
  FROM public.story_videos v
  WHERE v.id = p_video_id;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.story_videos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS story_videos_updated_at_trigger ON public.story_videos;
CREATE TRIGGER story_videos_updated_at_trigger
BEFORE UPDATE ON public.story_videos
FOR EACH ROW
EXECUTE FUNCTION public.story_videos_updated_at();

DROP TRIGGER IF EXISTS story_video_subtitles_updated_at_trigger ON public.story_video_subtitles;
CREATE TRIGGER story_video_subtitles_updated_at_trigger
BEFORE UPDATE ON public.story_video_subtitles
FOR EACH ROW
EXECUTE FUNCTION public.story_videos_updated_at();

-- ============================================================
-- STORAGE BUCKET SETUP
-- ============================================================
-- Note: Run these in Supabase Dashboard or via supabase CLI

-- CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "extensions";

-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('story-videos', 'story-videos', true, 104857600)  -- 100MB
-- ON CONFLICT DO NOTHING;

-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('story-thumbnails', 'story-thumbnails', true, 5242880)  -- 5MB
-- ON CONFLICT DO NOTHING;

-- Storage policies would go here (see TEAM4_STORIES_HANDOFF.md for examples)

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.story_videos IS
  'Short-form video content (30-60 sec) for producer storytelling at journey stages.';

COMMENT ON TABLE public.story_video_subtitles IS
  'VTT-style subtitle tracks for video accessibility. Supports multiple languages.';

COMMENT ON TABLE public.story_video_views IS
  'Analytics tracking for video engagement including watch time and completion.';

COMMENT ON FUNCTION public.record_video_view IS
  'Records a video view and updates aggregate counters. Handles unique view detection.';

COMMENT ON FUNCTION public.get_video_analytics IS
  'Returns aggregated analytics for a video including device breakdown.';

COMMIT;
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
-- ============================================
-- Verified Business Response System
-- ============================================
-- This migration adds comprehensive business verification,
-- response templates, and public accountability metrics.

SET client_encoding = 'UTF8';

-- ============================================
-- 1. Business Verification System
-- ============================================

-- Business verification requests
CREATE TABLE IF NOT EXISTS business_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES app_users(id),

    -- Verification method
    verification_method TEXT NOT NULL CHECK (verification_method IN (
        'document',          -- Upload legal documents
        'domain',            -- Verify domain ownership
        'phone',             -- Phone verification
        'inn_check',         -- Russian INN verification
        'manual'             -- Manual verification by admin
    )),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Awaiting review
        'documents_required', -- Need additional documents
        'under_review',      -- Being reviewed
        'approved',          -- Verification passed
        'rejected'           -- Verification failed
    )),

    -- Verification data
    verification_data JSONB DEFAULT '{}'::jsonb,
    -- For document: {documents: [{type, url, uploaded_at}]}
    -- For domain: {domain, verification_code, verified_at}
    -- For phone: {phone, code_sent_at, verified_at}
    -- For inn_check: {inn, company_name, verification_result}

    -- Review info
    reviewed_by UUID REFERENCES app_users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),

    -- One active request per organization
    CONSTRAINT unique_active_verification UNIQUE (organization_id, status)
        DEFERRABLE INITIALLY DEFERRED
);

-- Verification documents storage
CREATE TABLE IF NOT EXISTS business_verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES business_verification_requests(id) ON DELETE CASCADE,

    document_type TEXT NOT NULL CHECK (document_type IN (
        'registration_certificate',  -- Business registration
        'inn_certificate',           -- Tax ID certificate
        'director_passport',         -- Director's ID
        'power_of_attorney',         -- Authorization document
        'bank_statement',            -- Bank account proof
        'utility_bill',              -- Address verification
        'other'
    )),

    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,

    -- Review status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'expired'
    )),
    review_notes TEXT,

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_verification_requests_org ON business_verification_requests(organization_id);
CREATE INDEX idx_verification_requests_status ON business_verification_requests(status);
CREATE INDEX idx_verification_documents_request ON business_verification_documents(request_id);

-- ============================================
-- 2. Response Templates System
-- ============================================

CREATE TABLE IF NOT EXISTS response_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Template info
    name TEXT NOT NULL,
    description TEXT,

    -- Categorization
    category TEXT NOT NULL CHECK (category IN (
        'positive_review',      -- Thank you responses
        'neutral_review',       -- Informational responses
        'negative_review',      -- Apology/resolution responses
        'quality_issue',        -- Product quality problems
        'delivery_issue',       -- Shipping/delivery problems
        'service_issue',        -- Customer service problems
        'general'               -- General purpose
    )),

    -- Template content
    template_text TEXT NOT NULL,

    -- Variables that can be replaced
    -- {{customer_name}}, {{product_name}}, {{order_id}}, {{company_name}}
    variables JSONB DEFAULT '[]'::jsonb,

    -- Usage tracking
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Settings
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_default_per_category UNIQUE (organization_id, category, is_default)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_response_templates_org ON response_templates(organization_id);
CREATE INDEX idx_response_templates_category ON response_templates(category);
CREATE INDEX idx_response_templates_active ON response_templates(organization_id, is_active);

-- ============================================
-- 3. Enhanced Review Response Tracking
-- ============================================

-- Add more columns to reviews for response tracking
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS response_status TEXT DEFAULT NULL CHECK (response_status IS NULL OR response_status IN (
        'pending',           -- Awaiting response
        'responded',         -- Response sent
        'follow_up_needed',  -- Needs additional follow-up
        'resolved'           -- Issue resolved
    )),
    ADD COLUMN IF NOT EXISTS response_template_id UUID REFERENCES response_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS response_edited BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS response_time_hours NUMERIC(10,2);

-- Response history for edits and follow-ups
CREATE TABLE IF NOT EXISTS review_response_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,

    -- Response content
    response_text TEXT NOT NULL,
    response_by UUID NOT NULL REFERENCES app_users(id),

    -- Template usage
    template_id UUID REFERENCES response_templates(id) ON DELETE SET NULL,
    template_modified BOOLEAN DEFAULT false,

    -- Version tracking
    version INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,

    -- Edit info
    edit_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_response_history_review ON review_response_history(review_id);
CREATE INDEX idx_response_history_current ON review_response_history(review_id, is_current) WHERE is_current = true;

-- ============================================
-- 4. Response Metrics and Accountability
-- ============================================

-- Daily response metrics aggregation
CREATE TABLE IF NOT EXISTS response_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,

    -- Volume metrics
    total_reviews INTEGER NOT NULL DEFAULT 0,
    reviews_responded INTEGER NOT NULL DEFAULT 0,
    reviews_pending INTEGER NOT NULL DEFAULT 0,

    -- Time metrics (in hours)
    avg_response_time_hours NUMERIC(10,2),
    min_response_time_hours NUMERIC(10,2),
    max_response_time_hours NUMERIC(10,2),
    median_response_time_hours NUMERIC(10,2),

    -- Rating breakdown
    positive_reviews INTEGER NOT NULL DEFAULT 0,   -- 4-5 stars
    neutral_reviews INTEGER NOT NULL DEFAULT 0,    -- 3 stars
    negative_reviews INTEGER NOT NULL DEFAULT 0,   -- 1-2 stars

    -- Response rate by rating
    positive_responded INTEGER NOT NULL DEFAULT 0,
    neutral_responded INTEGER NOT NULL DEFAULT 0,
    negative_responded INTEGER NOT NULL DEFAULT 0,

    -- Satisfaction signals (if customers rate responses)
    helpful_votes INTEGER NOT NULL DEFAULT 0,
    unhelpful_votes INTEGER NOT NULL DEFAULT 0,

    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_metrics_per_day UNIQUE (organization_id, metric_date)
);

CREATE INDEX idx_response_metrics_org ON response_metrics_daily(organization_id);
CREATE INDEX idx_response_metrics_date ON response_metrics_daily(metric_date DESC);

-- Public accountability scores (aggregated monthly)
CREATE TABLE IF NOT EXISTS business_accountability_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    score_month DATE NOT NULL, -- First day of month

    -- Response performance (0-100)
    response_rate_score INTEGER NOT NULL DEFAULT 0,
    response_time_score INTEGER NOT NULL DEFAULT 0,
    response_quality_score INTEGER NOT NULL DEFAULT 0,

    -- Overall accountability score (weighted average)
    overall_score INTEGER NOT NULL DEFAULT 0,

    -- Transparency badge eligibility
    badge_level TEXT CHECK (badge_level IN (
        'none',
        'bronze',      -- 50-69 overall
        'silver',      -- 70-84 overall
        'gold',        -- 85-94 overall
        'platinum'     -- 95+ overall
    )) DEFAULT 'none',

    -- Raw metrics for transparency
    total_reviews INTEGER NOT NULL DEFAULT 0,
    total_responded INTEGER NOT NULL DEFAULT 0,
    avg_response_hours NUMERIC(10,2),

    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_score_per_month UNIQUE (organization_id, score_month)
);

CREATE INDEX idx_accountability_org ON business_accountability_scores(organization_id);
CREATE INDEX idx_accountability_month ON business_accountability_scores(score_month DESC);
CREATE INDEX idx_accountability_badge ON business_accountability_scores(badge_level) WHERE badge_level != 'none';

-- ============================================
-- 5. Response Satisfaction Tracking
-- ============================================

-- Allow review authors to rate business responses
CREATE TABLE IF NOT EXISTS response_satisfaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id),

    -- Rating
    is_helpful BOOLEAN NOT NULL,

    -- Optional feedback
    feedback_text TEXT,
    feedback_category TEXT CHECK (feedback_category IS NULL OR feedback_category IN (
        'resolved_issue',
        'appreciated_response',
        'unprofessional',
        'did_not_address_issue',
        'other'
    )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One rating per user per review
    CONSTRAINT unique_satisfaction_rating UNIQUE (review_id, user_id)
);

CREATE INDEX idx_response_satisfaction_review ON response_satisfaction(review_id);

-- ============================================
-- 6. Functions and Triggers
-- ============================================

-- Function to calculate response time when response is added
CREATE OR REPLACE FUNCTION calculate_response_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.response IS NOT NULL AND NEW.response_at IS NOT NULL
       AND (OLD.response IS NULL OR OLD.response_at IS NULL) THEN
        -- Calculate hours between review creation and first response
        NEW.first_response_at := COALESCE(NEW.first_response_at, NEW.response_at);
        NEW.response_time_hours := EXTRACT(EPOCH FROM (NEW.response_at - NEW.created_at)) / 3600;
        NEW.response_status := 'responded';
    END IF;

    -- Track if response was edited
    IF OLD.response IS NOT NULL AND NEW.response IS NOT NULL
       AND OLD.response != NEW.response THEN
        NEW.response_edited := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_response_time
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION calculate_response_time();

-- Function to record response history
CREATE OR REPLACE FUNCTION record_response_history()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.response IS NOT NULL AND (OLD.response IS NULL OR OLD.response != NEW.response) THEN
        -- Mark previous responses as not current
        UPDATE review_response_history
        SET is_current = false
        WHERE review_id = NEW.id AND is_current = true;

        -- Insert new history record
        INSERT INTO review_response_history (
            review_id,
            response_text,
            response_by,
            template_id,
            version,
            is_current
        )
        SELECT
            NEW.id,
            NEW.response,
            NEW.response_by,
            NEW.response_template_id,
            COALESCE((SELECT MAX(version) FROM review_response_history WHERE review_id = NEW.id), 0) + 1,
            true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_response_history
    AFTER UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION record_response_history();

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.response_template_id IS NOT NULL
       AND (OLD.response_template_id IS NULL OR OLD.response_template_id != NEW.response_template_id) THEN
        UPDATE response_templates
        SET usage_count = usage_count + 1,
            last_used_at = now()
        WHERE id = NEW.response_template_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_template_usage
    AFTER UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION increment_template_usage();

-- Function to calculate daily metrics
CREATE OR REPLACE FUNCTION calculate_daily_response_metrics(p_organization_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_metrics RECORD;
BEGIN
    SELECT
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE response IS NOT NULL) as reviews_responded,
        COUNT(*) FILTER (WHERE response IS NULL AND status = 'approved') as reviews_pending,
        AVG(response_time_hours) FILTER (WHERE response_time_hours IS NOT NULL) as avg_response_time,
        MIN(response_time_hours) FILTER (WHERE response_time_hours IS NOT NULL) as min_response_time,
        MAX(response_time_hours) FILTER (WHERE response_time_hours IS NOT NULL) as max_response_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_hours)
            FILTER (WHERE response_time_hours IS NOT NULL) as median_response_time,
        COUNT(*) FILTER (WHERE rating >= 4) as positive_reviews,
        COUNT(*) FILTER (WHERE rating = 3) as neutral_reviews,
        COUNT(*) FILTER (WHERE rating <= 2) as negative_reviews,
        COUNT(*) FILTER (WHERE rating >= 4 AND response IS NOT NULL) as positive_responded,
        COUNT(*) FILTER (WHERE rating = 3 AND response IS NOT NULL) as neutral_responded,
        COUNT(*) FILTER (WHERE rating <= 2 AND response IS NOT NULL) as negative_responded
    INTO v_metrics
    FROM reviews
    WHERE organization_id = p_organization_id
      AND DATE(created_at) = p_date
      AND status = 'approved';

    INSERT INTO response_metrics_daily (
        organization_id, metric_date,
        total_reviews, reviews_responded, reviews_pending,
        avg_response_time_hours, min_response_time_hours, max_response_time_hours, median_response_time_hours,
        positive_reviews, neutral_reviews, negative_reviews,
        positive_responded, neutral_responded, negative_responded
    )
    VALUES (
        p_organization_id, p_date,
        v_metrics.total_reviews, v_metrics.reviews_responded, v_metrics.reviews_pending,
        v_metrics.avg_response_time, v_metrics.min_response_time, v_metrics.max_response_time, v_metrics.median_response_time,
        v_metrics.positive_reviews, v_metrics.neutral_reviews, v_metrics.negative_reviews,
        v_metrics.positive_responded, v_metrics.neutral_responded, v_metrics.negative_responded
    )
    ON CONFLICT (organization_id, metric_date)
    DO UPDATE SET
        total_reviews = EXCLUDED.total_reviews,
        reviews_responded = EXCLUDED.reviews_responded,
        reviews_pending = EXCLUDED.reviews_pending,
        avg_response_time_hours = EXCLUDED.avg_response_time_hours,
        min_response_time_hours = EXCLUDED.min_response_time_hours,
        max_response_time_hours = EXCLUDED.max_response_time_hours,
        median_response_time_hours = EXCLUDED.median_response_time_hours,
        positive_reviews = EXCLUDED.positive_reviews,
        neutral_reviews = EXCLUDED.neutral_reviews,
        negative_reviews = EXCLUDED.negative_reviews,
        positive_responded = EXCLUDED.positive_responded,
        neutral_responded = EXCLUDED.neutral_responded,
        negative_responded = EXCLUDED.negative_responded,
        calculated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate monthly accountability score
CREATE OR REPLACE FUNCTION calculate_monthly_accountability_score(p_organization_id UUID, p_month DATE)
RETURNS VOID AS $$
DECLARE
    v_metrics RECORD;
    v_response_rate_score INTEGER;
    v_response_time_score INTEGER;
    v_quality_score INTEGER;
    v_overall_score INTEGER;
    v_badge_level TEXT;
BEGIN
    -- Get aggregated metrics for the month
    SELECT
        SUM(total_reviews) as total_reviews,
        SUM(reviews_responded) as total_responded,
        AVG(avg_response_time_hours) as avg_response_hours,
        SUM(helpful_votes) as helpful_votes,
        SUM(unhelpful_votes) as unhelpful_votes
    INTO v_metrics
    FROM response_metrics_daily
    WHERE organization_id = p_organization_id
      AND metric_date >= p_month
      AND metric_date < (p_month + INTERVAL '1 month');

    -- Calculate response rate score (0-100)
    IF v_metrics.total_reviews > 0 THEN
        v_response_rate_score := LEAST(100, (v_metrics.total_responded::NUMERIC / v_metrics.total_reviews * 100)::INTEGER);
    ELSE
        v_response_rate_score := 100; -- No reviews = perfect score
    END IF;

    -- Calculate response time score (0-100)
    -- Target: < 24 hours = 100, < 48 hours = 75, < 72 hours = 50, > 72 hours = 25
    IF v_metrics.avg_response_hours IS NULL THEN
        v_response_time_score := 0;
    ELSIF v_metrics.avg_response_hours <= 24 THEN
        v_response_time_score := 100;
    ELSIF v_metrics.avg_response_hours <= 48 THEN
        v_response_time_score := 75;
    ELSIF v_metrics.avg_response_hours <= 72 THEN
        v_response_time_score := 50;
    ELSE
        v_response_time_score := GREATEST(0, 25 - ((v_metrics.avg_response_hours - 72) / 24)::INTEGER);
    END IF;

    -- Calculate quality score based on helpful/unhelpful votes (0-100)
    IF (v_metrics.helpful_votes + v_metrics.unhelpful_votes) > 0 THEN
        v_quality_score := (v_metrics.helpful_votes::NUMERIC / (v_metrics.helpful_votes + v_metrics.unhelpful_votes) * 100)::INTEGER;
    ELSE
        v_quality_score := 50; -- Default neutral score
    END IF;

    -- Calculate overall score (weighted: 40% response rate, 30% time, 30% quality)
    v_overall_score := (v_response_rate_score * 0.4 + v_response_time_score * 0.3 + v_quality_score * 0.3)::INTEGER;

    -- Determine badge level
    IF v_overall_score >= 95 THEN
        v_badge_level := 'platinum';
    ELSIF v_overall_score >= 85 THEN
        v_badge_level := 'gold';
    ELSIF v_overall_score >= 70 THEN
        v_badge_level := 'silver';
    ELSIF v_overall_score >= 50 THEN
        v_badge_level := 'bronze';
    ELSE
        v_badge_level := 'none';
    END IF;

    -- Insert or update accountability score
    INSERT INTO business_accountability_scores (
        organization_id, score_month,
        response_rate_score, response_time_score, response_quality_score, overall_score,
        badge_level, total_reviews, total_responded, avg_response_hours
    )
    VALUES (
        p_organization_id, p_month,
        v_response_rate_score, v_response_time_score, v_quality_score, v_overall_score,
        v_badge_level, COALESCE(v_metrics.total_reviews, 0), COALESCE(v_metrics.total_responded, 0), v_metrics.avg_response_hours
    )
    ON CONFLICT (organization_id, score_month)
    DO UPDATE SET
        response_rate_score = EXCLUDED.response_rate_score,
        response_time_score = EXCLUDED.response_time_score,
        response_quality_score = EXCLUDED.response_quality_score,
        overall_score = EXCLUDED.overall_score,
        badge_level = EXCLUDED.badge_level,
        total_reviews = EXCLUDED.total_reviews,
        total_responded = EXCLUDED.total_responded,
        avg_response_hours = EXCLUDED.avg_response_hours,
        calculated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Row Level Security
-- ============================================

ALTER TABLE business_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_response_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_accountability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_satisfaction ENABLE ROW LEVEL SECURITY;

-- Verification requests: org members can view, owners/admins can manage
CREATE POLICY "Org members view verification requests"
    ON business_verification_requests FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = business_verification_requests.organization_id
          AND om.user_id = auth.uid()
    ));

CREATE POLICY "Org owners create verification requests"
    ON business_verification_requests FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = business_verification_requests.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
    ));

-- Verification documents follow request access
CREATE POLICY "View verification documents through request"
    ON business_verification_documents FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM business_verification_requests r
        JOIN organization_members om ON om.organization_id = r.organization_id
        WHERE r.id = business_verification_documents.request_id
          AND om.user_id = auth.uid()
    ));

CREATE POLICY "Upload verification documents"
    ON business_verification_documents FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM business_verification_requests r
        JOIN organization_members om ON om.organization_id = r.organization_id
        WHERE r.id = business_verification_documents.request_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
    ));

-- Response templates: org members can view, editors+ can manage
CREATE POLICY "Org members view templates"
    ON response_templates FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = response_templates.organization_id
          AND om.user_id = auth.uid()
    ));

CREATE POLICY "Org editors manage templates"
    ON response_templates FOR ALL
    USING (EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = response_templates.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin', 'manager', 'editor')
    ));

-- Response history: org members can view
CREATE POLICY "Org members view response history"
    ON review_response_history FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM reviews r
        JOIN organization_members om ON om.organization_id = r.organization_id
        WHERE r.id = review_response_history.review_id
          AND om.user_id = auth.uid()
    ));

-- Metrics: org members can view their own
CREATE POLICY "Org members view metrics"
    ON response_metrics_daily FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = response_metrics_daily.organization_id
          AND om.user_id = auth.uid()
    ));

-- Accountability scores: public read for verified orgs, org members for their own
CREATE POLICY "Public view accountability scores"
    ON business_accountability_scores FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = business_accountability_scores.organization_id
          AND o.public_visible = true
          AND o.verification_status = 'verified'
    ));

CREATE POLICY "Org members view own accountability"
    ON business_accountability_scores FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = business_accountability_scores.organization_id
          AND om.user_id = auth.uid()
    ));

-- Response satisfaction: review author can rate, public can view
CREATE POLICY "Review author rates response"
    ON response_satisfaction FOR INSERT
    WITH CHECK (auth.uid() = user_id AND EXISTS (
        SELECT 1 FROM reviews r
        WHERE r.id = response_satisfaction.review_id
          AND r.author_user_id = auth.uid()
          AND r.response IS NOT NULL
    ));

CREATE POLICY "Public view satisfaction ratings"
    ON response_satisfaction FOR SELECT
    USING (true);

-- Platform admins have full access
CREATE POLICY "Platform admins manage verifications"
    ON business_verification_requests
    USING (EXISTS (
        SELECT 1 FROM platform_roles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'platform_admin'
    ));

CREATE POLICY "Platform admins manage verification docs"
    ON business_verification_documents
    USING (EXISTS (
        SELECT 1 FROM platform_roles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'platform_admin'
    ));

-- ============================================
-- 8. Add organization verification level
-- ============================================

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS verification_level TEXT DEFAULT 'unverified' CHECK (verification_level IN (
        'unverified',
        'basic',          -- Email/phone verified
        'standard',       -- Documents verified
        'premium'         -- Full business verification
    )),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

-- ============================================
-- 9. Notification types for responses
-- ============================================

INSERT INTO notification_types (key, name, default_enabled, user_configurable, category)
VALUES
    ('consumer.review_response', 'Business responded to your review', true, true, 'reviews'),
    ('business.pending_reviews', 'Reviews awaiting response', true, true, 'reviews'),
    ('business.verification_approved', 'Business verification approved', true, false, 'account'),
    ('business.verification_rejected', 'Business verification rejected', true, false, 'account')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 10. Comments
-- ============================================

COMMENT ON TABLE business_verification_requests IS 'Business verification requests for enhanced trust';
COMMENT ON TABLE business_verification_documents IS 'Documents uploaded for business verification';
COMMENT ON TABLE response_templates IS 'Reusable response templates for businesses';
COMMENT ON TABLE review_response_history IS 'History of review responses for audit trail';
COMMENT ON TABLE response_metrics_daily IS 'Daily aggregated response metrics per organization';
COMMENT ON TABLE business_accountability_scores IS 'Monthly accountability scores for public display';
COMMENT ON TABLE response_satisfaction IS 'Customer satisfaction ratings for business responses';

COMMENT ON COLUMN organizations.verification_level IS 'Level of business verification achieved';
COMMENT ON COLUMN reviews.response_time_hours IS 'Hours between review creation and first response';
COMMENT ON COLUMN reviews.response_status IS 'Current status of response handling';
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
-- Migration: Scan Alert Trigger Functions
-- PostgreSQL functions for real-time alert detection

SET client_encoding = 'UTF8';

-- ============================================
-- 1. Helper: Check if within quiet hours
-- ============================================

CREATE OR REPLACE FUNCTION public.is_within_quiet_hours(org_id uuid)
RETURNS boolean AS $$
DECLARE
    prefs public.organization_alert_preferences;
    current_time_in_tz time;
BEGIN
    SELECT * INTO prefs FROM public.organization_alert_preferences
    WHERE organization_id = org_id;

    IF prefs IS NULL OR prefs.quiet_hours_start IS NULL THEN
        RETURN false;
    END IF;

    current_time_in_tz := (now() AT TIME ZONE COALESCE(prefs.quiet_hours_timezone, 'Europe/Moscow'))::time;

    IF prefs.quiet_hours_start < prefs.quiet_hours_end THEN
        RETURN current_time_in_tz >= prefs.quiet_hours_start
           AND current_time_in_tz < prefs.quiet_hours_end;
    ELSE
        RETURN current_time_in_tz >= prefs.quiet_hours_start
            OR current_time_in_tz < prefs.quiet_hours_end;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2. Helper: Check rule cooldown
-- ============================================

CREATE OR REPLACE FUNCTION public.is_rule_in_cooldown(
    rule_id uuid,
    batch_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    rule public.scan_alert_rules;
    last_alert timestamptz;
BEGIN
    SELECT * INTO rule FROM public.scan_alert_rules WHERE id = rule_id;

    IF rule IS NULL THEN
        RETURN false;
    END IF;

    SELECT MAX(created_at) INTO last_alert
    FROM public.scan_alerts
    WHERE scan_alerts.rule_id = is_rule_in_cooldown.rule_id
      AND (batch_id IS NULL OR scan_alerts.batch_id = is_rule_in_cooldown.batch_id);

    IF last_alert IS NULL THEN
        RETURN false;
    END IF;

    RETURN last_alert > (now() - (rule.cooldown_minutes || ' minutes')::interval);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 3. Create Alert Function
-- ============================================

CREATE OR REPLACE FUNCTION public.create_scan_alert(
    p_org_id uuid,
    p_rule_id uuid,
    p_alert_type text,
    p_severity text,
    p_title text,
    p_body text,
    p_batch_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_scan_event_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
    alert_id uuid;
    rule public.scan_alert_rules;
    notification_type_id uuid;
    notification_id uuid;
    member record;
BEGIN
    -- Check quiet hours
    IF public.is_within_quiet_hours(p_org_id) AND p_severity != 'critical' THEN
        RETURN NULL;
    END IF;

    -- Check cooldown
    IF p_rule_id IS NOT NULL AND public.is_rule_in_cooldown(p_rule_id, p_batch_id) THEN
        RETURN NULL;
    END IF;

    -- Get rule for channels
    SELECT * INTO rule FROM public.scan_alert_rules WHERE id = p_rule_id;

    -- Insert alert
    INSERT INTO public.scan_alerts (
        organization_id, rule_id, alert_type, severity,
        batch_id, product_id, scan_event_id,
        title, body, metadata
    ) VALUES (
        p_org_id, p_rule_id, p_alert_type, p_severity,
        p_batch_id, p_product_id, p_scan_event_id,
        p_title, p_body, p_metadata
    ) RETURNING id INTO alert_id;

    -- Get notification type
    SELECT id INTO notification_type_id
    FROM public.notification_types
    WHERE key = 'scan.' || p_alert_type
    LIMIT 1;

    -- Create notification for each org member with appropriate role
    FOR member IN
        SELECT om.user_id
        FROM public.organization_members om
        WHERE om.organization_id = p_org_id
          AND om.role IN ('owner', 'admin', 'manager')
    LOOP
        -- Insert notification
        INSERT INTO public.notifications (
            notification_type_id, org_id, recipient_user_id,
            recipient_scope, title, body, payload, severity, category
        ) VALUES (
            notification_type_id, p_org_id, member.user_id,
            'user', p_title, p_body,
            jsonb_build_object(
                'alert_id', alert_id,
                'batch_id', p_batch_id,
                'product_id', p_product_id
            ) || p_metadata,
            p_severity, 'scan'
        ) RETURNING id INTO notification_id;

        -- Create delivery records for each channel
        IF rule IS NOT NULL THEN
            INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status)
            SELECT notification_id, member.user_id, unnest(rule.channels), 'pending';
        ELSE
            INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status)
            VALUES (notification_id, member.user_id, 'in_app', 'pending');
        END IF;
    END LOOP;

    RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. First Scan Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_first_batch_scan(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    previous_scans integer;
    location_text text;
BEGIN
    -- Get batch info
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
    IF batch IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO product FROM public.products WHERE id = batch.product_id;

    -- Check if this is truly the first scan
    SELECT COUNT(*) INTO previous_scans
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND id != scan_event.id;

    IF previous_scans > 0 THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'first_scan'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    -- Build location text
    location_text := COALESCE(scan_event.city, '') ||
                     CASE WHEN scan_event.city IS NOT NULL AND scan_event.country IS NOT NULL
                          THEN ', ' ELSE '' END ||
                     COALESCE(scan_event.country, 'неизвестное место');

    -- Create alert
    PERFORM public.create_scan_alert(
        scan_event.organization_id,
        rule.id,
        'first_batch_scan',
        'info',
        'Первое сканирование партии ' || batch.batch_code,
        'Партия ' || batch.batch_code || ' продукта "' ||
            COALESCE(product.name, 'Неизвестный продукт') ||
            '" впервые отсканирована в ' || location_text || '.',
        scan_event.batch_id,
        batch.product_id,
        scan_event.id,
        jsonb_build_object(
            'batch_code', batch.batch_code,
            'product_name', product.name,
            'location', location_text,
            'scan_time', scan_event.created_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Scan Spike Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_scan_spike(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    window_minutes integer;
    min_scans integer;
    threshold_multiplier numeric;
    recent_count integer;
    historical_avg numeric;
    org_prefs public.organization_alert_preferences;
BEGIN
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'scan_spike'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    window_minutes := COALESCE((config->>'window_minutes')::integer, 60);
    min_scans := COALESCE((config->>'min_scans')::integer, 50);
    threshold_multiplier := COALESCE((config->>'threshold_multiplier')::numeric, 3);

    -- Count recent scans
    SELECT COUNT(*) INTO recent_count
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND created_at > (now() - (window_minutes || ' minutes')::interval);

    IF recent_count < min_scans THEN
        RETURN;
    END IF;

    -- Get historical average (last 7 days, same time window)
    SELECT AVG(bucket_count)::numeric INTO historical_avg
    FROM (
        SELECT COUNT(*) as bucket_count
        FROM public.qr_scan_events
        WHERE batch_id = scan_event.batch_id
          AND created_at > (now() - interval '7 days')
          AND created_at < (now() - (window_minutes || ' minutes')::interval)
        GROUP BY date_trunc('hour', created_at)
    ) hourly_counts;

    IF historical_avg IS NULL OR historical_avg = 0 THEN
        historical_avg := 10;
    END IF;

    -- Check if spike
    IF recent_count > (historical_avg * threshold_multiplier) THEN
        SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
        SELECT * INTO product FROM public.products WHERE id = batch.product_id;

        PERFORM public.create_scan_alert(
            scan_event.organization_id,
            rule.id,
            'viral_spike',
            'info',
            'Резкий рост сканирований!',
            'Партия ' || batch.batch_code || ' набирает популярность: ' ||
                recent_count || ' сканирований за последний час.',
            scan_event.batch_id,
            batch.product_id,
            scan_event.id,
            jsonb_build_object(
                'batch_code', batch.batch_code,
                'scan_count', recent_count,
                'time_period', window_minutes || ' минут',
                'historical_avg', round(historical_avg, 1),
                'multiplier', round(recent_count / historical_avg, 1)
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Counterfeit Pattern Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_counterfeit_pattern(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    max_scans_per_hour integer;
    geographic_threshold integer;
    recent_scans_count integer;
    distinct_locations integer;
    suspicious_reasons text[];
BEGIN
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'counterfeit_pattern'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    max_scans_per_hour := COALESCE((config->>'max_scans_per_hour')::integer, 10);
    geographic_threshold := COALESCE((config->>'geographic_spread_threshold')::integer, 3);

    suspicious_reasons := ARRAY[]::text[];

    -- Check rapid scanning from same IP
    SELECT COUNT(*) INTO recent_scans_count
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND ip_hash = scan_event.ip_hash
      AND created_at > (now() - interval '1 hour')
      AND ip_hash IS NOT NULL;

    IF recent_scans_count > max_scans_per_hour THEN
        suspicious_reasons := array_append(suspicious_reasons,
            recent_scans_count || ' сканирований с одного IP за час');
    END IF;

    -- Check geographic spread in short time
    SELECT COUNT(DISTINCT country) INTO distinct_locations
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND created_at > (now() - interval '30 minutes')
      AND country IS NOT NULL;

    IF distinct_locations >= geographic_threshold THEN
        suspicious_reasons := array_append(suspicious_reasons,
            'Сканирования из ' || distinct_locations || ' разных стран за 30 минут');
    END IF;

    -- If suspicious patterns found
    IF array_length(suspicious_reasons, 1) > 0 THEN
        SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
        SELECT * INTO product FROM public.products WHERE id = batch.product_id;

        -- Mark scan as suspicious
        UPDATE public.qr_scan_events
        SET is_suspicious = true,
            suspicious_reason = array_to_string(suspicious_reasons, '; ')
        WHERE id = scan_event.id;

        PERFORM public.create_scan_alert(
            scan_event.organization_id,
            rule.id,
            'potential_counterfeit',
            'critical',
            'Возможная подделка обнаружена!',
            'ВНИМАНИЕ: Партия ' || batch.batch_code ||
                ' показывает признаки подделки. ' ||
                array_to_string(suspicious_reasons, '. ') || '.',
            scan_event.batch_id,
            batch.product_id,
            scan_event.id,
            jsonb_build_object(
                'batch_code', batch.batch_code,
                'reasons', suspicious_reasons,
                'ip_hash', scan_event.ip_hash,
                'location', COALESCE(scan_event.city, '') || ', ' || COALESCE(scan_event.country, '')
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Geographic Anomaly Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_geographic_anomaly(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    expected_countries text[];
    alert_on_new boolean;
    is_expected boolean;
    first_from_country boolean;
BEGIN
    IF scan_event.country IS NULL OR scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'unusual_location'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    expected_countries := ARRAY(SELECT jsonb_array_elements_text(config->'expected_countries'));
    alert_on_new := COALESCE((config->>'alert_on_new_country')::boolean, true);

    -- Check if country is in expected list
    is_expected := scan_event.country = ANY(expected_countries);

    -- Check if this is first scan from this country for this batch
    SELECT NOT EXISTS (
        SELECT 1 FROM public.qr_scan_events
        WHERE batch_id = scan_event.batch_id
          AND country = scan_event.country
          AND id != scan_event.id
    ) INTO first_from_country;

    -- Alert if unexpected country OR first from new country
    IF (NOT is_expected) OR (alert_on_new AND first_from_country AND array_length(expected_countries, 1) > 0) THEN
        SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
        SELECT * INTO product FROM public.products WHERE id = batch.product_id;

        PERFORM public.create_scan_alert(
            scan_event.organization_id,
            rule.id,
            'geographic_anomaly',
            CASE WHEN NOT is_expected THEN 'warning' ELSE 'info' END,
            CASE WHEN NOT is_expected
                THEN 'Географическая аномалия сканирования'
                ELSE 'Ваш продукт увидели из новой страны'
            END,
            'Партия ' || batch.batch_code ||
                CASE WHEN NOT is_expected
                    THEN ' сканируется из неожиданного региона: '
                    ELSE ' впервые сканируется из: '
                END ||
                COALESCE(scan_event.city, '') ||
                CASE WHEN scan_event.city IS NOT NULL THEN ', ' ELSE '' END ||
                scan_event.country || '.',
            scan_event.batch_id,
            batch.product_id,
            scan_event.id,
            jsonb_build_object(
                'batch_code', batch.batch_code,
                'country', scan_event.country,
                'city', scan_event.city,
                'expected_countries', expected_countries,
                'is_unexpected', NOT is_expected,
                'is_first_from_country', first_from_country
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Milestone Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_scan_milestone(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    milestones integer[];
    total_scans integer;
    milestone integer;
BEGIN
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'milestone'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    milestones := ARRAY(SELECT (jsonb_array_elements_text(config->'milestones'))::integer);

    -- Get total scans for batch
    SELECT COUNT(*) INTO total_scans
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id;

    -- Check if we just hit a milestone
    FOREACH milestone IN ARRAY milestones
    LOOP
        IF total_scans = milestone THEN
            SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
            SELECT * INTO product FROM public.products WHERE id = batch.product_id;

            PERFORM public.create_scan_alert(
                scan_event.organization_id,
                rule.id,
                'milestone_reached',
                'info',
                'Достигнут рубеж сканирований!',
                'Поздравляем! Партия ' || batch.batch_code ||
                    ' достигла ' || milestone || ' сканирований.',
                scan_event.batch_id,
                batch.product_id,
                scan_event.id,
                jsonb_build_object(
                    'batch_code', batch.batch_code,
                    'milestone', milestone,
                    'total_scans', total_scans
                )
            );
            EXIT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Main Scan Event Trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_scan_event_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Run all alert checks
    PERFORM public.check_first_batch_scan(NEW);
    PERFORM public.check_scan_spike(NEW);
    PERFORM public.check_counterfeit_pattern(NEW);
    PERFORM public.check_geographic_anomaly(NEW);
    PERFORM public.check_scan_milestone(NEW);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_scan_event_check_alerts ON public.qr_scan_events;
CREATE TRIGGER on_scan_event_check_alerts
    AFTER INSERT ON public.qr_scan_events
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_scan_event_alerts();

-- ============================================
-- 10. Review Alert Trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_review_alerts()
RETURNS TRIGGER AS $$
DECLARE
    rule public.scan_alert_rules;
    config jsonb;
    min_rating integer;
    include_no_text boolean;
    product public.products;
BEGIN
    -- Only for new approved reviews
    IF TG_OP != 'INSERT' OR NEW.status != 'approved' THEN
        RETURN NEW;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = NEW.organization_id
      AND rule_type = 'negative_review'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN NEW;
    END IF;

    config := rule.config;
    min_rating := COALESCE((config->>'min_rating_threshold')::integer, 3);
    include_no_text := COALESCE((config->>'include_no_text')::boolean, false);

    -- Check if this is a negative review
    IF NEW.rating > min_rating THEN
        RETURN NEW;
    END IF;

    -- Check text requirement
    IF NOT include_no_text AND (NEW.body IS NULL OR length(trim(NEW.body)) < 10) THEN
        RETURN NEW;
    END IF;

    -- Get product name if exists
    IF NEW.product_id IS NOT NULL THEN
        SELECT * INTO product FROM public.products WHERE id = NEW.product_id;
    END IF;

    PERFORM public.create_scan_alert(
        NEW.organization_id,
        rule.id,
        'negative_review',
        CASE WHEN NEW.rating <= 2 THEN 'warning' ELSE 'info' END,
        'Получен негативный отзыв',
        'Пользователь оставил отзыв с оценкой ' || NEW.rating || '/5' ||
            CASE WHEN product IS NOT NULL
                THEN ' о продукте "' || product.name || '"'
                ELSE ''
            END || '. Рекомендуем ответить.',
        NULL,
        NEW.product_id,
        NULL,
        jsonb_build_object(
            'review_id', NEW.id,
            'rating', NEW.rating,
            'product_name', product.name,
            'has_text', length(COALESCE(NEW.body, '')) > 10
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_check_alerts ON public.reviews;
CREATE TRIGGER on_review_check_alerts
    AFTER INSERT OR UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_review_alerts();

-- ============================================
-- 11. Escalation Function (called by cron)
-- ============================================

CREATE OR REPLACE FUNCTION public.process_alert_escalations()
RETURNS integer AS $$
DECLARE
    alert_record record;
    rule public.scan_alert_rules;
    escalated_count integer := 0;
BEGIN
    FOR alert_record IN
        SELECT a.*
        FROM public.scan_alerts a
        JOIN public.scan_alert_rules r ON r.id = a.rule_id
        WHERE a.status = 'new'
          AND a.severity IN ('warning', 'critical')
          AND a.is_escalated = false
          AND r.escalate_after_minutes IS NOT NULL
          AND a.created_at < (now() - (r.escalate_after_minutes || ' minutes')::interval)
    LOOP
        SELECT * INTO rule FROM public.scan_alert_rules WHERE id = alert_record.rule_id;

        -- Mark as escalated
        UPDATE public.scan_alerts
        SET is_escalated = true,
            escalated_at = now(),
            escalation_level = escalation_level + 1
        WHERE id = alert_record.id;

        -- Create notifications for escalation targets
        IF rule.escalate_to_user_ids IS NOT NULL THEN
            INSERT INTO public.notifications (
                notification_type_id, org_id, recipient_user_id,
                recipient_scope, title, body, payload, severity, category
            )
            SELECT
                (SELECT id FROM public.notification_types WHERE key = 'scan.' || alert_record.alert_type LIMIT 1),
                alert_record.organization_id,
                user_id,
                'user',
                'ЭСКАЛАЦИЯ: ' || alert_record.title,
                'Оповещение не было обработано в течение ' ||
                    rule.escalate_after_minutes || ' минут. ' || alert_record.body,
                jsonb_build_object('alert_id', alert_record.id, 'escalated', true),
                alert_record.severity,
                'scan'
            FROM unnest(rule.escalate_to_user_ids) AS user_id;
        END IF;

        escalated_count := escalated_count + 1;
    END LOOP;

    RETURN escalated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. Statistics Aggregation Function
-- ============================================

CREATE OR REPLACE FUNCTION public.aggregate_scan_statistics(p_bucket_type text DEFAULT 'hour')
RETURNS integer AS $$
DECLARE
    bucket_interval interval;
    bucket_start_time timestamptz;
    inserted_count integer := 0;
BEGIN
    bucket_interval := CASE p_bucket_type
        WHEN 'hour' THEN interval '1 hour'
        WHEN 'day' THEN interval '1 day'
        WHEN 'week' THEN interval '1 week'
        ELSE interval '1 hour'
    END;

    bucket_start_time := date_trunc(p_bucket_type, now() - bucket_interval);

    INSERT INTO public.scan_statistics (
        organization_id, batch_id, product_id,
        bucket_start, bucket_type,
        scan_count, unique_users, unique_locations, suspicious_count,
        top_countries, top_cities
    )
    SELECT
        organization_id,
        batch_id,
        product_id,
        bucket_start_time,
        p_bucket_type,
        COUNT(*),
        COUNT(DISTINCT user_id),
        COUNT(DISTINCT country),
        COUNT(*) FILTER (WHERE is_suspicious),
        COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('country', country, 'count', 1))
            FILTER (WHERE country IS NOT NULL),
            '[]'::jsonb
        ),
        COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('city', city, 'count', 1))
            FILTER (WHERE city IS NOT NULL),
            '[]'::jsonb
        )
    FROM public.qr_scan_events
    WHERE created_at >= bucket_start_time
      AND created_at < bucket_start_time + bucket_interval
    GROUP BY organization_id, batch_id, product_id
    ON CONFLICT (organization_id, batch_id, product_id, bucket_start, bucket_type)
    DO UPDATE SET
        scan_count = EXCLUDED.scan_count,
        unique_users = EXCLUDED.unique_users,
        unique_locations = EXCLUDED.unique_locations,
        suspicious_count = EXCLUDED.suspicious_count,
        top_countries = EXCLUDED.top_countries,
        top_cities = EXCLUDED.top_cities;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.trigger_scan_event_alerts IS 'Main trigger for processing scan events and generating alerts';
COMMENT ON FUNCTION public.process_alert_escalations IS 'Called by cron to escalate unacknowledged alerts';
COMMENT ON FUNCTION public.aggregate_scan_statistics IS 'Called by cron to aggregate scan statistics';
-- Telegram Bot Integration
-- Links Telegram users to chestno.ru accounts and tracks bot interactions

-- Telegram users table
CREATE TABLE IF NOT EXISTS telegram_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL UNIQUE,
    telegram_username TEXT,
    telegram_first_name TEXT,
    telegram_last_name TEXT,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    language_code TEXT DEFAULT 'ru',
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_reason TEXT,
    blocked_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram user subscriptions (follows via bot)
CREATE TABLE IF NOT EXISTS telegram_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notify_on_reviews BOOLEAN DEFAULT TRUE,
    notify_on_qr_scans BOOLEAN DEFAULT TRUE,
    notify_on_posts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_user_id, organization_id)
);

-- Telegram bot commands log for analytics
CREATE TABLE IF NOT EXISTS telegram_bot_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id UUID REFERENCES telegram_users(id) ON DELETE SET NULL,
    telegram_id BIGINT NOT NULL,
    command TEXT NOT NULL,
    arguments TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS telegram_rate_limits (
    telegram_id BIGINT NOT NULL,
    action_type TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER DEFAULT 1,
    PRIMARY KEY (telegram_id, action_type, window_start)
);

-- Account linking tokens (for linking Telegram to chestno.ru account)
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    linked_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_telegram_user ON telegram_subscriptions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_org ON telegram_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bot_commands_telegram_id ON telegram_bot_commands(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bot_commands_created ON telegram_bot_commands(created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_rate_limits_cleanup ON telegram_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_token ON telegram_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires ON telegram_link_tokens(expires_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_telegram_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_users_updated_at
    BEFORE UPDATE ON telegram_users
    FOR EACH ROW
    EXECUTE FUNCTION update_telegram_users_updated_at();

-- Cleanup old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_telegram_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM telegram_rate_limits
    WHERE window_start < NOW() - INTERVAL '1 hour';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired link tokens
CREATE OR REPLACE FUNCTION cleanup_telegram_link_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM telegram_link_tokens
    WHERE expires_at < NOW() AND used_at IS NULL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add notification type for telegram bot events
INSERT INTO notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('telegram_account_linked', 'account', 'info', 'Telegram подключен', 'Ваш Telegram аккаунт успешно подключен к chestno.ru', ARRAY['in_app']),
    ('telegram_new_follower', 'social', 'info', 'Новый подписчик в Telegram', '{{follower_name}} подписался на вашу организацию через Telegram', ARRAY['in_app', 'telegram'])
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE telegram_users IS 'Telegram users who interact with the bot';
COMMENT ON TABLE telegram_subscriptions IS 'Organizations followed by Telegram users';
COMMENT ON TABLE telegram_bot_commands IS 'Log of all bot commands for analytics';
COMMENT ON TABLE telegram_rate_limits IS 'Rate limiting data for abuse prevention';
COMMENT ON TABLE telegram_link_tokens IS 'Temporary tokens for linking Telegram to web accounts';
