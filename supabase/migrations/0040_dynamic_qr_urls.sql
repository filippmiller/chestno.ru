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
