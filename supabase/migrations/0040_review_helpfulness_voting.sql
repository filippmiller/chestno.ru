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
    positive BIGINT,
    negative BIGINT
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
