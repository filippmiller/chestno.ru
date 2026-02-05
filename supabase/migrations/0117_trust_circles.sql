-- ============================================================================
-- Feature 8: Trust Circles
-- Private groups for sharing product recommendations
-- ============================================================================

-- Trust circle groups
CREATE TABLE IF NOT EXISTS trust_circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

    -- Circle details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    emoji VARCHAR(10),                                -- Circle emoji icon

    -- Settings
    max_members INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Stats (denormalized for performance)
    member_count INTEGER NOT NULL DEFAULT 1,
    product_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Circle membership
CREATE TABLE IF NOT EXISTS trust_circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES trust_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

    -- Role
    role VARCHAR(20) NOT NULL DEFAULT 'member',       -- owner, admin, member

    -- Sharing preferences
    share_scan_history BOOLEAN NOT NULL DEFAULT false,
    share_favorites BOOLEAN NOT NULL DEFAULT true,
    share_reviews BOOLEAN NOT NULL DEFAULT true,

    -- Status
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    invited_by UUID REFERENCES app_users(id),

    UNIQUE(circle_id, user_id)
);

-- Circle invites
CREATE TABLE IF NOT EXISTS trust_circle_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES trust_circles(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES app_users(id),

    -- Invite method
    invite_code VARCHAR(20) UNIQUE,                   -- For link sharing
    invited_email VARCHAR(255),                       -- For direct email invite
    invited_user_id UUID REFERENCES app_users(id),    -- For existing users

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending, accepted, declined, expired
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ
);

-- Shared products within circles
CREATE TABLE IF NOT EXISTS circle_shared_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES trust_circles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES app_users(id),

    -- Recommendation
    recommendation_type VARCHAR(20) NOT NULL DEFAULT 'recommended',  -- recommended, avoid, neutral
    comment TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),

    -- Engagement
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(circle_id, product_id, shared_by)
);

-- Comments on shared products
CREATE TABLE IF NOT EXISTS circle_product_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_product_id UUID NOT NULL REFERENCES circle_shared_products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

    comment_text TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Likes on shared products
CREATE TABLE IF NOT EXISTS circle_product_likes (
    shared_product_id UUID NOT NULL REFERENCES circle_shared_products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (shared_product_id, user_id)
);

-- Circle activity feed
CREATE TABLE IF NOT EXISTS circle_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES trust_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id),

    -- Activity type
    activity_type VARCHAR(50) NOT NULL,               -- product_shared, member_joined, product_scanned, review_posted

    -- Related entities
    product_id UUID REFERENCES products(id),
    shared_product_id UUID REFERENCES circle_shared_products(id),

    -- Activity data
    activity_data JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_circles_owner ON trust_circles(owner_id);
CREATE INDEX idx_circle_members_user ON trust_circle_members(user_id);
CREATE INDEX idx_circle_members_circle ON trust_circle_members(circle_id);
CREATE INDEX idx_circle_invites_code ON trust_circle_invites(invite_code) WHERE status = 'pending';
CREATE INDEX idx_circle_invites_email ON trust_circle_invites(invited_email) WHERE status = 'pending';
CREATE INDEX idx_circle_shared_products_circle ON circle_shared_products(circle_id, created_at DESC);
CREATE INDEX idx_circle_activity_circle ON circle_activity(circle_id, created_at DESC);

-- Function to generate invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    chars VARCHAR(36) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result VARCHAR(20) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to join circle by invite code
CREATE OR REPLACE FUNCTION join_circle_by_code(p_user_id UUID, p_invite_code VARCHAR)
RETURNS trust_circle_members AS $$
DECLARE
    invite trust_circle_invites;
    circle trust_circles;
    result trust_circle_members;
BEGIN
    -- Find valid invite
    SELECT * INTO invite
    FROM trust_circle_invites
    WHERE invite_code = p_invite_code
    AND status = 'pending'
    AND expires_at > now();

    IF invite IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invite code';
    END IF;

    -- Check circle exists and is active
    SELECT * INTO circle
    FROM trust_circles
    WHERE id = invite.circle_id
    AND is_active = true;

    IF circle IS NULL THEN
        RAISE EXCEPTION 'Circle not found or inactive';
    END IF;

    -- Check member limit
    IF circle.member_count >= circle.max_members THEN
        RAISE EXCEPTION 'Circle has reached member limit';
    END IF;

    -- Check not already a member
    IF EXISTS (SELECT 1 FROM trust_circle_members WHERE circle_id = invite.circle_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Already a member of this circle';
    END IF;

    -- Add member
    INSERT INTO trust_circle_members (circle_id, user_id, invited_by)
    VALUES (invite.circle_id, p_user_id, invite.invited_by)
    RETURNING * INTO result;

    -- Update invite status
    UPDATE trust_circle_invites
    SET status = 'accepted', accepted_at = now(), invited_user_id = p_user_id
    WHERE id = invite.id;

    -- Update circle member count
    UPDATE trust_circles
    SET member_count = member_count + 1, updated_at = now()
    WHERE id = invite.circle_id;

    -- Add activity
    INSERT INTO circle_activity (circle_id, user_id, activity_type)
    VALUES (invite.circle_id, p_user_id, 'member_joined');

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update counts
CREATE OR REPLACE FUNCTION update_circle_product_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE trust_circles SET product_count = product_count + 1 WHERE id = NEW.circle_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE trust_circles SET product_count = product_count - 1 WHERE id = OLD.circle_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_circle_product_count
    AFTER INSERT OR DELETE ON circle_shared_products
    FOR EACH ROW EXECUTE FUNCTION update_circle_product_count();

-- Trigger to update updated_at
CREATE TRIGGER trigger_circles_updated_at
    BEFORE UPDATE ON trust_circles
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

CREATE TRIGGER trigger_shared_products_updated_at
    BEFORE UPDATE ON circle_shared_products
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

-- RLS Policies
ALTER TABLE trust_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_circle_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_shared_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_product_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_product_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_activity ENABLE ROW LEVEL SECURITY;

-- Circles: members can view, owner can manage
CREATE POLICY "Members can view circles"
    ON trust_circles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM trust_circle_members
            WHERE circle_id = trust_circles.id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create circles"
    ON trust_circles FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update circle"
    ON trust_circles FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Owner can delete circle"
    ON trust_circles FOR DELETE
    USING (owner_id = auth.uid());

-- Members: can view if member of circle
CREATE POLICY "Members can view circle members"
    ON trust_circle_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM trust_circle_members tcm
            WHERE tcm.circle_id = trust_circle_members.circle_id
            AND tcm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage members"
    ON trust_circle_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM trust_circle_members tcm
            WHERE tcm.circle_id = trust_circle_members.circle_id
            AND tcm.user_id = auth.uid()
            AND tcm.role IN ('owner', 'admin')
        )
    );

-- Invites: creator and invitee can view
CREATE POLICY "Users can view relevant invites"
    ON trust_circle_invites FOR SELECT
    USING (
        invited_by = auth.uid()
        OR invited_user_id = auth.uid()
        OR invited_email = (SELECT email FROM app_users WHERE id = auth.uid())
    );

CREATE POLICY "Circle admins can create invites"
    ON trust_circle_invites FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM trust_circle_members
            WHERE circle_id = trust_circle_invites.circle_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Shared products: members can view and share
CREATE POLICY "Members can view shared products"
    ON circle_shared_products FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM trust_circle_members
            WHERE circle_id = circle_shared_products.circle_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Members can share products"
    ON circle_shared_products FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM trust_circle_members
            WHERE circle_id = circle_shared_products.circle_id
            AND user_id = auth.uid()
        )
        AND shared_by = auth.uid()
    );

-- Comments and likes: members only
CREATE POLICY "Members can view comments"
    ON circle_product_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM circle_shared_products csp
            JOIN trust_circle_members tcm ON tcm.circle_id = csp.circle_id
            WHERE csp.id = circle_product_comments.shared_product_id
            AND tcm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can comment"
    ON circle_product_comments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM circle_shared_products csp
            JOIN trust_circle_members tcm ON tcm.circle_id = csp.circle_id
            WHERE csp.id = circle_product_comments.shared_product_id
            AND tcm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can like"
    ON circle_product_likes FOR ALL
    USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM circle_shared_products csp
            JOIN trust_circle_members tcm ON tcm.circle_id = csp.circle_id
            WHERE csp.id = circle_product_likes.shared_product_id
            AND tcm.user_id = auth.uid()
        )
    );

-- Activity: members can view
CREATE POLICY "Members can view activity"
    ON circle_activity FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM trust_circle_members
            WHERE circle_id = circle_activity.circle_id
            AND user_id = auth.uid()
        )
    );

-- Notification types
INSERT INTO notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('circle.invite', 'social', 'info',
     'Приглашение в круг доверия',
     '{{inviter_name}} приглашает вас в круг "{{circle_name}}"',
     ARRAY['in_app', 'push']),
    ('circle.new_product', 'social', 'info',
     'Новая рекомендация в {{circle_name}}',
     '{{sharer_name}} поделился продуктом: {{product_name}}',
     ARRAY['in_app'])
ON CONFLICT (key) DO NOTHING;
