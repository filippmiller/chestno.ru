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
