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
