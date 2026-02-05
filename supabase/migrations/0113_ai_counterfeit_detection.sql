-- ============================================================================
-- Feature 2: AI Photo Counterfeit Detection
-- Consumers can photograph products for authenticity verification
-- ============================================================================

-- Reference images uploaded by manufacturers
CREATE TABLE IF NOT EXISTS product_reference_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Image details
    image_url TEXT NOT NULL,
    image_type VARCHAR(50) NOT NULL DEFAULT 'packaging',  -- packaging, logo, label, barcode, hologram
    description TEXT,

    -- Ordering
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    uploaded_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Counterfeit detection results
CREATE TABLE IF NOT EXISTS counterfeit_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Context
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,

    -- Submitted image
    submitted_image_url TEXT NOT NULL,

    -- AI Analysis results
    overall_confidence DECIMAL(5,2),              -- 0-100 confidence score
    is_likely_authentic BOOLEAN,                  -- true if confidence >= 70
    analysis_details JSONB DEFAULT '{}'::jsonb,   -- Detailed comparison results

    -- Reference image matched against
    matched_reference_id UUID REFERENCES product_reference_images(id),
    matched_confidence DECIMAL(5,2),

    -- Location context (from IP or GPS)
    location_country VARCHAR(100),
    location_city VARCHAR(200),

    -- Processing status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- AI Counterfeit reports (user-submitted concerns from AI detection)
-- Named differently to avoid conflict with existing counterfeit_reports table
CREATE TABLE IF NOT EXISTS ai_counterfeit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID REFERENCES counterfeit_checks(id) ON DELETE SET NULL,

    -- Reporter
    reporter_user_id UUID REFERENCES app_users(id),
    reporter_email VARCHAR(255),

    -- Report details
    purchase_location TEXT,
    purchase_date DATE,
    report_notes TEXT,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',  -- submitted, investigating, confirmed_fake, false_positive, resolved
    resolution_notes TEXT,
    resolved_by UUID REFERENCES app_users(id),
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (use IF NOT EXISTS to avoid conflicts with existing tables)
CREATE INDEX IF NOT EXISTS idx_reference_images_product ON product_reference_images(product_id);
CREATE INDEX IF NOT EXISTS idx_reference_images_org ON product_reference_images(organization_id);
CREATE INDEX IF NOT EXISTS idx_counterfeit_checks_product ON counterfeit_checks(product_id);
CREATE INDEX IF NOT EXISTS idx_counterfeit_checks_user ON counterfeit_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_counterfeit_checks_status ON counterfeit_checks(status);
CREATE INDEX IF NOT EXISTS idx_counterfeit_checks_confidence ON counterfeit_checks(overall_confidence);
CREATE INDEX IF NOT EXISTS idx_ai_counterfeit_reports_status ON ai_counterfeit_reports(status);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_reference_images_updated_at ON product_reference_images;
CREATE TRIGGER trigger_reference_images_updated_at
    BEFORE UPDATE ON product_reference_images
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

-- Stats function for organization dashboard
CREATE OR REPLACE FUNCTION get_counterfeit_stats(org_id UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_checks BIGINT,
    authentic_count BIGINT,
    suspicious_count BIGINT,
    avg_confidence DECIMAL(5,2),
    reports_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_checks,
        COUNT(*) FILTER (WHERE is_likely_authentic = true)::BIGINT as authentic_count,
        COUNT(*) FILTER (WHERE is_likely_authentic = false)::BIGINT as suspicious_count,
        ROUND(AVG(overall_confidence), 2)::DECIMAL(5,2) as avg_confidence,
        (SELECT COUNT(*) FROM ai_counterfeit_reports cr
         JOIN counterfeit_checks cc ON cc.id = cr.check_id
         WHERE cc.organization_id = org_id
         AND cr.created_at >= now() - (days || ' days')::INTERVAL)::BIGINT as reports_count
    FROM counterfeit_checks
    WHERE organization_id = org_id
    AND created_at >= now() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE product_reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterfeit_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_counterfeit_reports ENABLE ROW LEVEL SECURITY;

-- Reference images: org members can manage, public can view for active products
CREATE POLICY "Public can view active reference images"
    ON product_reference_images FOR SELECT
    USING (is_active = true);

CREATE POLICY "Org members can manage reference images"
    ON product_reference_images FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = product_reference_images.organization_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Counterfeit checks: users can view their own, org can view all for their products
CREATE POLICY "Users can view own checks"
    ON counterfeit_checks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Org members can view org checks"
    ON counterfeit_checks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = counterfeit_checks.organization_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can create checks"
    ON counterfeit_checks FOR INSERT
    WITH CHECK (true);

-- AI Counterfeit reports: org can view, reporters can view own
CREATE POLICY "Reporters can view own AI reports"
    ON ai_counterfeit_reports FOR SELECT
    USING (reporter_user_id = auth.uid());

CREATE POLICY "Org members can view org AI reports"
    ON ai_counterfeit_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM counterfeit_checks cc
            JOIN organization_members om ON om.organization_id = cc.organization_id
            WHERE cc.id = ai_counterfeit_reports.check_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can create AI reports"
    ON ai_counterfeit_reports FOR INSERT
    WITH CHECK (true);

-- Notification type for counterfeit alerts
INSERT INTO notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('business.counterfeit_alert', 'business', 'high',
     'Подозрение на подделку',
     'Обнаружена возможная подделка продукта "{{product_name}}" в {{location}}',
     ARRAY['in_app', 'email', 'push'])
ON CONFLICT (key) DO NOTHING;
