-- Migration: Loyalty Points System
-- Adds gamification/loyalty system for reviewers

-- =============================================================================
-- USER LOYALTY PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_loyalty_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Points balances
    total_points INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,  -- Never decreases

    -- Tier (computed from lifetime_points, stored for performance)
    current_tier TEXT NOT NULL DEFAULT 'bronze' CHECK (current_tier IN ('bronze', 'silver', 'gold', 'platinum')),

    -- Stats
    review_count INTEGER NOT NULL DEFAULT 0,
    helpful_votes_received INTEGER NOT NULL DEFAULT 0,

    -- Streaks
    current_streak_weeks INTEGER NOT NULL DEFAULT 0,
    longest_streak_weeks INTEGER NOT NULL DEFAULT 0,
    last_review_week DATE,  -- ISO week start date of last review

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_user_loyalty UNIQUE (user_id)
);

-- Index for leaderboard queries
CREATE INDEX idx_loyalty_lifetime_points ON user_loyalty_profiles(lifetime_points DESC);
CREATE INDEX idx_loyalty_tier ON user_loyalty_profiles(current_tier);
CREATE INDEX idx_loyalty_user ON user_loyalty_profiles(user_id);

-- =============================================================================
-- POINTS TRANSACTIONS (Ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Transaction details
    action_type TEXT NOT NULL CHECK (action_type IN (
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
        'points_expired'
    )),
    points INTEGER NOT NULL,  -- Positive = earned, Negative = spent/deducted
    balance_after INTEGER NOT NULL,

    -- Optional context
    description TEXT,
    reference_id UUID,  -- e.g., review_id
    reference_type TEXT,  -- e.g., 'review', 'referral'

    -- Admin adjustments
    performed_by UUID REFERENCES auth.users(id),

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for history queries
CREATE INDEX idx_points_tx_user ON points_transactions(user_id);
CREATE INDEX idx_points_tx_user_created ON points_transactions(user_id, created_at DESC);
CREATE INDEX idx_points_tx_reference ON points_transactions(reference_type, reference_id);

-- =============================================================================
-- HELPFUL VOTES (For tracking which reviews got upvoted)
-- =============================================================================
CREATE TABLE IF NOT EXISTS review_helpful_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    voter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_helpful_vote UNIQUE (review_id, voter_user_id)
);

CREATE INDEX idx_helpful_votes_review ON review_helpful_votes(review_id);
CREATE INDEX idx_helpful_votes_voter ON review_helpful_votes(voter_user_id);

-- =============================================================================
-- FUNCTION: Calculate tier from lifetime points
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_loyalty_tier(points INTEGER)
RETURNS TEXT AS $$
BEGIN
    IF points >= 1500 THEN
        RETURN 'platinum';
    ELSIF points >= 500 THEN
        RETURN 'gold';
    ELSIF points >= 100 THEN
        RETURN 'silver';
    ELSE
        RETURN 'bronze';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Update tier after points change
-- =============================================================================
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_tier := calculate_loyalty_tier(NEW.lifetime_points);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_loyalty_tier
    BEFORE UPDATE OF lifetime_points ON user_loyalty_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_loyalty_tier();

-- =============================================================================
-- FUNCTION: Create loyalty profile for new users
-- =============================================================================
CREATE OR REPLACE FUNCTION create_loyalty_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_loyalty_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on auth.users (if accessible) or handle in application code
-- Note: This may need to be created via Supabase dashboard if auth schema is restricted

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE user_loyalty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;

-- Loyalty profiles: Users can read their own, public can see for leaderboard
CREATE POLICY "Users can view own loyalty profile"
    ON user_loyalty_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Public can view loyalty profiles for leaderboard"
    ON user_loyalty_profiles FOR SELECT
    USING (true);  -- Allow reading for leaderboard

CREATE POLICY "Service role can manage loyalty profiles"
    ON user_loyalty_profiles FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Points transactions: Users can only view their own
CREATE POLICY "Users can view own transactions"
    ON points_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions"
    ON points_transactions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Helpful votes: Users can manage their own votes
CREATE POLICY "Users can view helpful votes"
    ON review_helpful_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can create helpful votes"
    ON review_helpful_votes FOR INSERT
    WITH CHECK (auth.uid() = voter_user_id);

CREATE POLICY "Users can delete own helpful votes"
    ON review_helpful_votes FOR DELETE
    USING (auth.uid() = voter_user_id);

-- =============================================================================
-- ADD helpful_count TO reviews TABLE
-- =============================================================================
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE user_loyalty_profiles IS 'Stores loyalty/gamification profile for each user';
COMMENT ON TABLE points_transactions IS 'Ledger of all points transactions (earning and spending)';
COMMENT ON TABLE review_helpful_votes IS 'Tracks which users marked which reviews as helpful';
COMMENT ON COLUMN user_loyalty_profiles.lifetime_points IS 'Total points ever earned (never decreases, used for tier calculation)';
COMMENT ON COLUMN user_loyalty_profiles.total_points IS 'Current spendable points balance';
