-- ============================================================================
-- Feature 1: Consumer Verification Challenges
-- Consumers can challenge manufacturer claims and demand proof
-- ============================================================================

-- Challenge categories (predefined claim types)
CREATE TYPE challenge_category AS ENUM (
    'organic',           -- Organic certification claims
    'local',             -- Local production claims
    'certified',         -- Quality certification claims
    'ingredients',       -- Ingredient composition claims
    'origin',            -- Country/region of origin claims
    'sustainability',    -- Environmental/sustainability claims
    'health',            -- Health benefit claims
    'freshness',         -- Freshness/expiration claims
    'other'              -- Free-form challenges
);

CREATE TYPE challenge_status AS ENUM (
    'pending_moderation',  -- Awaiting moderator approval
    'active',              -- Published, awaiting manufacturer response
    'responded',           -- Manufacturer has responded
    'expired',             -- 7 days passed without response
    'rejected',            -- Rejected by moderator (spam/abuse)
    'withdrawn'            -- Withdrawn by challenger
);

-- Main challenges table
CREATE TABLE IF NOT EXISTS verification_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relations
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    challenger_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

    -- Challenge content
    category challenge_category NOT NULL DEFAULT 'other',
    claim_text TEXT NOT NULL,                    -- What claim is being challenged
    challenge_question TEXT NOT NULL,            -- The specific question/demand

    -- Status tracking
    status challenge_status NOT NULL DEFAULT 'pending_moderation',
    expires_at TIMESTAMPTZ,                      -- When the challenge expires (7 days from activation)

    -- Moderation
    moderated_by UUID REFERENCES app_users(id),
    moderated_at TIMESTAMPTZ,
    moderation_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Challenge responses from manufacturers
CREATE TABLE IF NOT EXISTS challenge_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES verification_challenges(id) ON DELETE CASCADE,

    -- Response content
    responder_user_id UUID NOT NULL REFERENCES app_users(id),
    response_text TEXT NOT NULL,

    -- Evidence attachments (stored as JSON array of URLs)
    evidence_urls JSONB DEFAULT '[]'::jsonb,     -- Array of {type: 'pdf'|'image'|'link', url: '...', title: '...'}

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Challenge votes (community can vote on response quality)
CREATE TABLE IF NOT EXISTS challenge_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES verification_challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

    vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('satisfied', 'unsatisfied')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(challenge_id, user_id)
);

-- Indexes
CREATE INDEX idx_challenges_org ON verification_challenges(organization_id);
CREATE INDEX idx_challenges_product ON verification_challenges(product_id);
CREATE INDEX idx_challenges_status ON verification_challenges(status);
CREATE INDEX idx_challenges_category ON verification_challenges(category);
CREATE INDEX idx_challenges_expires ON verification_challenges(expires_at) WHERE status = 'active';
CREATE INDEX idx_challenge_responses_challenge ON challenge_responses(challenge_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_challenge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_challenges_updated_at
    BEFORE UPDATE ON verification_challenges
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

CREATE TRIGGER trigger_challenge_responses_updated_at
    BEFORE UPDATE ON challenge_responses
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

-- Function to activate challenge after moderation
CREATE OR REPLACE FUNCTION activate_challenge(challenge_id UUID, moderator_id UUID)
RETURNS verification_challenges AS $$
DECLARE
    result verification_challenges;
BEGIN
    UPDATE verification_challenges
    SET
        status = 'active',
        expires_at = now() + INTERVAL '7 days',
        moderated_by = moderator_id,
        moderated_at = now()
    WHERE id = challenge_id AND status = 'pending_moderation'
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check and expire old challenges (run by cron)
CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE verification_challenges
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < now();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE verification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can view active/responded challenges
CREATE POLICY "Public can view public challenges"
    ON verification_challenges FOR SELECT
    USING (status IN ('active', 'responded', 'expired'));

-- Authenticated users can create challenges
CREATE POLICY "Authenticated users can create challenges"
    ON verification_challenges FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Challengers can update their own pending challenges
CREATE POLICY "Challengers can update own pending challenges"
    ON verification_challenges FOR UPDATE
    USING (challenger_user_id = auth.uid() AND status = 'pending_moderation');

-- Organization members can view all challenges for their org
CREATE POLICY "Org members can view all org challenges"
    ON verification_challenges FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = verification_challenges.organization_id
            AND user_id = auth.uid()
        )
    );

-- Responses are public for public challenges
CREATE POLICY "Public can view responses to public challenges"
    ON challenge_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM verification_challenges
            WHERE id = challenge_responses.challenge_id
            AND status IN ('active', 'responded', 'expired')
        )
    );

-- Organization managers can create responses
CREATE POLICY "Org managers can create responses"
    ON challenge_responses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM verification_challenges vc
            JOIN organization_members om ON om.organization_id = vc.organization_id
            WHERE vc.id = challenge_responses.challenge_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- Anyone can view votes
CREATE POLICY "Public can view votes"
    ON challenge_votes FOR SELECT
    USING (true);

-- Authenticated users can vote
CREATE POLICY "Authenticated users can vote"
    ON challenge_votes FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can change their vote
CREATE POLICY "Users can update own vote"
    ON challenge_votes FOR UPDATE
    USING (user_id = auth.uid());

-- Add notification type for challenges
INSERT INTO notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('business.new_challenge', 'business', 'medium',
     'Новый вызов по продукту',
     'Потребитель задал вопрос о вашем заявлении: "{{claim_text}}"',
     ARRAY['in_app', 'email']),
    ('consumer.challenge_response', 'consumer', 'info',
     'Ответ на ваш вызов',
     'Производитель ответил на ваш вопрос о "{{claim_text}}"',
     ARRAY['in_app', 'push'])
ON CONFLICT (key) DO NOTHING;
