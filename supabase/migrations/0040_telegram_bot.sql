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
