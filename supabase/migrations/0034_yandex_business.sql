-- Migration: Yandex Business Integration
-- Adds support for linking Yandex Business profiles and importing reviews

-- =============================================================================
-- YANDEX BUSINESS PROFILE LINKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS yandex_business_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Yandex profile identifiers
    yandex_permalink TEXT NOT NULL,  -- The numeric ID from Yandex Maps URL
    yandex_url TEXT,  -- Full URL to the profile

    -- Profile info (manually updated or from future API)
    business_name TEXT,
    business_address TEXT,
    yandex_rating NUMERIC(2,1),  -- 0.0 - 5.0
    yandex_review_count INTEGER DEFAULT 0,

    -- Verification status
    status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('pending', 'verified', 'unverified', 'rejected')),
    verification_code TEXT,  -- Code to add to Yandex profile for verification
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),

    -- Sync tracking
    last_synced_at TIMESTAMPTZ,
    last_import_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    CONSTRAINT unique_org_yandex UNIQUE (organization_id),
    CONSTRAINT unique_yandex_permalink UNIQUE (yandex_permalink)
);

CREATE INDEX idx_yandex_links_org ON yandex_business_links(organization_id);
CREATE INDEX idx_yandex_links_status ON yandex_business_links(status);

-- =============================================================================
-- IMPORTED YANDEX REVIEWS
-- =============================================================================
CREATE TABLE IF NOT EXISTS yandex_imported_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    yandex_link_id UUID NOT NULL REFERENCES yandex_business_links(id) ON DELETE CASCADE,

    -- Review content
    author_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL,
    review_date TIMESTAMPTZ NOT NULL,

    -- Organization response (if any)
    response_text TEXT,
    response_date TIMESTAMPTZ,

    -- Deduplication
    content_hash TEXT NOT NULL,  -- Hash of author + date + text for dedup

    -- Link to internal review if converted
    internal_review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,

    -- Import metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    imported_by UUID REFERENCES auth.users(id),

    CONSTRAINT unique_yandex_review UNIQUE (organization_id, content_hash)
);

CREATE INDEX idx_yandex_reviews_org ON yandex_imported_reviews(organization_id);
CREATE INDEX idx_yandex_reviews_date ON yandex_imported_reviews(review_date DESC);
CREATE INDEX idx_yandex_reviews_hash ON yandex_imported_reviews(content_hash);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE yandex_business_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE yandex_imported_reviews ENABLE ROW LEVEL SECURITY;

-- Yandex links: Members can view, owners can manage
CREATE POLICY "Members can view yandex links"
    ON yandex_business_links FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = yandex_business_links.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage yandex links"
    ON yandex_business_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = yandex_business_links.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service role full access to yandex links"
    ON yandex_business_links FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Imported reviews: Members can view, admins can manage
CREATE POLICY "Members can view imported reviews"
    ON yandex_imported_reviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = yandex_imported_reviews.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage imported reviews"
    ON yandex_imported_reviews FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = yandex_imported_reviews.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service role full access to imported reviews"
    ON yandex_imported_reviews FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- ADD yandex_rating TO ORGANIZATIONS (for easy badge display)
-- =============================================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS yandex_rating NUMERIC(2,1);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS yandex_review_count INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS show_yandex_badge BOOLEAN DEFAULT false;

-- =============================================================================
-- TRIGGER: Update organization yandex rating when link is updated
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_org_yandex_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE organizations
    SET yandex_rating = NEW.yandex_rating,
        yandex_review_count = NEW.yandex_review_count,
        show_yandex_badge = (NEW.status = 'verified' AND NEW.yandex_rating IS NOT NULL)
    WHERE id = NEW.organization_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_org_yandex_rating
    AFTER INSERT OR UPDATE ON yandex_business_links
    FOR EACH ROW
    EXECUTE FUNCTION sync_org_yandex_rating();

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE yandex_business_links IS 'Links organizations to their Yandex Business profiles';
COMMENT ON TABLE yandex_imported_reviews IS 'Reviews imported from Yandex Business CSV exports';
COMMENT ON COLUMN yandex_business_links.yandex_permalink IS 'Numeric ID from Yandex Maps URL (e.g., 1234567890)';
COMMENT ON COLUMN yandex_business_links.verification_code IS 'Random code to add to Yandex profile description for verification';
COMMENT ON COLUMN yandex_imported_reviews.content_hash IS 'SHA256 hash of author+date+text for deduplication';
