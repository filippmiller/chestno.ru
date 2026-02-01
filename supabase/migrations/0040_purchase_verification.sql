-- Migration: Purchase Verification System
-- Adds verified purchase badges for reviews with Честный ЗНАК integration

-- ============================================
-- 1. Create verification methods enum type
-- ============================================

DO $$ BEGIN
    CREATE TYPE verification_method AS ENUM (
        'chestny_znak',      -- Честный ЗНАК API verification
        'qr_scan',           -- QR code scan proof (from our system)
        'receipt_upload',    -- Receipt/check photo upload
        'manual_admin',      -- Manual admin verification
        'loyalty_purchase'   -- Verified through loyalty program
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM (
        'pending',           -- Awaiting verification
        'verified',          -- Successfully verified
        'failed',            -- Verification failed
        'expired',           -- Verification expired
        'revoked'            -- Manually revoked
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. Create purchase_verifications table
-- ============================================

CREATE TABLE IF NOT EXISTS public.purchase_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,

    -- Verification details
    method verification_method NOT NULL,
    status verification_status NOT NULL DEFAULT 'pending',

    -- Честный ЗНАК specific fields
    chestny_znak_code text,              -- The DataMatrix code (КМ)
    chestny_znak_gtin text,              -- Global Trade Item Number
    chestny_znak_serial text,            -- Serial number from code
    chestny_znak_verified_at timestamptz,
    chestny_znak_response jsonb,         -- Full API response for audit

    -- QR scan verification
    qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
    qr_scan_event_id uuid,               -- Reference to scan event
    qr_scanned_at timestamptz,

    -- Receipt verification
    receipt_image_url text,
    receipt_date date,
    receipt_amount_cents integer,
    receipt_ocr_result jsonb,            -- OCR extracted data
    receipt_verified_by uuid REFERENCES public.app_users(id),
    receipt_verified_at timestamptz,

    -- Trust scoring
    trust_score decimal(3,2) DEFAULT 0.00 CHECK (trust_score >= 0 AND trust_score <= 1),
    trust_factors jsonb DEFAULT '{}'::jsonb,

    -- Metadata
    verification_notes text,
    verified_by uuid REFERENCES public.app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,              -- Verification can expire

    CONSTRAINT purchase_verifications_review_unique UNIQUE (review_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_user ON public.purchase_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_org ON public.purchase_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_product ON public.purchase_verifications(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_status ON public.purchase_verifications(status);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_method ON public.purchase_verifications(method);
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_chestny_code ON public.purchase_verifications(chestny_znak_code) WHERE chestny_znak_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_verifications_trust ON public.purchase_verifications(trust_score DESC) WHERE status = 'verified';

COMMENT ON TABLE public.purchase_verifications IS 'Purchase verification records for verified review badges';
COMMENT ON COLUMN public.purchase_verifications.trust_score IS 'Composite trust score 0-1 based on verification strength';
COMMENT ON COLUMN public.purchase_verifications.trust_factors IS 'JSON breakdown of trust score components';

-- ============================================
-- 3. Create Честный ЗНАК verification log
-- ============================================

CREATE TABLE IF NOT EXISTS public.chestny_znak_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id uuid REFERENCES public.purchase_verifications(id) ON DELETE CASCADE,

    -- Request data
    code_raw text NOT NULL,              -- Original scanned code
    code_normalized text,                -- Normalized code without brackets
    gtin text,                           -- Extracted GTIN
    serial text,                         -- Extracted serial

    -- API response
    api_endpoint text,
    api_request_at timestamptz NOT NULL DEFAULT now(),
    api_response_code integer,
    api_response_body jsonb,
    api_response_time_ms integer,

    -- Parsed results
    product_name text,
    producer_name text,
    product_category text,
    is_valid boolean,
    is_sold boolean,                     -- Product status in system
    ownership_status text,               -- Current ownership
    last_operation_date timestamptz,

    -- Error handling
    error_code text,
    error_message text,
    retry_count integer DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chestny_znak_verifications_code ON public.chestny_znak_verifications(code_normalized);
CREATE INDEX IF NOT EXISTS idx_chestny_znak_verifications_gtin ON public.chestny_znak_verifications(gtin);
CREATE INDEX IF NOT EXISTS idx_chestny_znak_verifications_verification ON public.chestny_znak_verifications(verification_id);

COMMENT ON TABLE public.chestny_znak_verifications IS 'Audit log for Честный ЗНАК API calls';

-- ============================================
-- 4. Add verification fields to reviews table
-- ============================================

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS is_verified_purchase boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_method verification_method,
    ADD COLUMN IF NOT EXISTS verification_badge_shown boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS trust_weight decimal(3,2) DEFAULT 1.00;

CREATE INDEX IF NOT EXISTS idx_reviews_verified ON public.reviews(is_verified_purchase) WHERE is_verified_purchase = true;
CREATE INDEX IF NOT EXISTS idx_reviews_trust_weight ON public.reviews(trust_weight DESC);

COMMENT ON COLUMN public.reviews.is_verified_purchase IS 'Whether this review has a verified purchase';
COMMENT ON COLUMN public.reviews.verification_method IS 'How the purchase was verified';
COMMENT ON COLUMN public.reviews.trust_weight IS 'Weight multiplier for sorting (verified reviews rank higher)';

-- ============================================
-- 5. Create verification requests queue
-- ============================================

CREATE TABLE IF NOT EXISTS public.verification_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,

    -- Request type
    method verification_method NOT NULL,
    priority integer DEFAULT 0,          -- Higher = process first

    -- Request data
    request_data jsonb NOT NULL,         -- Method-specific data

    -- Processing status
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_attempt_at timestamptz,
    next_attempt_at timestamptz,

    -- Results
    result_data jsonb,
    error_message text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_verification_requests_review ON public.verification_requests(review_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_next_attempt ON public.verification_requests(next_attempt_at) WHERE status IN ('queued', 'failed');

COMMENT ON TABLE public.verification_requests IS 'Queue for async verification processing';

-- ============================================
-- 6. Trust score configuration
-- ============================================

CREATE TABLE IF NOT EXISTS public.verification_trust_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Method weights (how much each method contributes to trust)
    weight_chestny_znak decimal(3,2) DEFAULT 1.00,
    weight_qr_scan decimal(3,2) DEFAULT 0.80,
    weight_receipt_upload decimal(3,2) DEFAULT 0.70,
    weight_manual_admin decimal(3,2) DEFAULT 0.90,
    weight_loyalty_purchase decimal(3,2) DEFAULT 0.85,

    -- Sorting boost factors
    verified_review_boost decimal(3,2) DEFAULT 1.50,   -- Multiply in sort score
    unverified_penalty decimal(3,2) DEFAULT 0.80,      -- Reduce unverified weight

    -- Display settings
    show_verification_badge boolean DEFAULT true,
    show_method_icon boolean DEFAULT true,
    require_verification_for_featured boolean DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT verification_trust_config_org_unique UNIQUE (organization_id)
);

-- Insert default config (organization_id NULL = platform default)
INSERT INTO public.verification_trust_config (organization_id) VALUES (NULL)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.verification_trust_config IS 'Configuration for trust scoring and display';

-- ============================================
-- 7. RLS Policies
-- ============================================

ALTER TABLE public.purchase_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chestny_znak_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_trust_config ENABLE ROW LEVEL SECURITY;

-- purchase_verifications policies
CREATE POLICY "Users view own verifications" ON public.purchase_verifications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Org members view org verifications" ON public.purchase_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = purchase_verifications.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins view all verifications" ON public.purchase_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    );

CREATE POLICY "Users create own verifications" ON public.purchase_verifications
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Platform admins manage verifications" ON public.purchase_verifications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- chestny_znak_verifications policies (audit log - read-only for users)
CREATE POLICY "Users view own chestny znak logs" ON public.chestny_znak_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_verifications pv
            WHERE pv.id = chestny_znak_verifications.verification_id
              AND pv.user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins view all chestny znak logs" ON public.chestny_znak_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    );

-- verification_requests policies
CREATE POLICY "Users view own requests" ON public.verification_requests
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users create own requests" ON public.verification_requests
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Platform admins manage requests" ON public.verification_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- verification_trust_config policies
CREATE POLICY "Anyone reads default config" ON public.verification_trust_config
    FOR SELECT
    USING (organization_id IS NULL);

CREATE POLICY "Org members read org config" ON public.verification_trust_config
    FOR SELECT
    USING (
        organization_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = verification_trust_config.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins manage config" ON public.verification_trust_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = verification_trust_config.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

-- ============================================
-- 8. Functions for trust score calculation
-- ============================================

CREATE OR REPLACE FUNCTION calculate_verification_trust_score(
    p_method verification_method,
    p_organization_id uuid DEFAULT NULL
) RETURNS decimal(3,2)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_config record;
    v_score decimal(3,2);
BEGIN
    -- Get config (org-specific or default)
    SELECT * INTO v_config
    FROM public.verification_trust_config
    WHERE organization_id = p_organization_id
       OR (p_organization_id IS NOT NULL AND organization_id IS NULL)
    ORDER BY organization_id NULLS LAST
    LIMIT 1;

    -- Calculate score based on method
    CASE p_method
        WHEN 'chestny_znak' THEN v_score := COALESCE(v_config.weight_chestny_znak, 1.00);
        WHEN 'qr_scan' THEN v_score := COALESCE(v_config.weight_qr_scan, 0.80);
        WHEN 'receipt_upload' THEN v_score := COALESCE(v_config.weight_receipt_upload, 0.70);
        WHEN 'manual_admin' THEN v_score := COALESCE(v_config.weight_manual_admin, 0.90);
        WHEN 'loyalty_purchase' THEN v_score := COALESCE(v_config.weight_loyalty_purchase, 0.85);
        ELSE v_score := 0.50;
    END CASE;

    RETURN v_score;
END;
$$;

CREATE OR REPLACE FUNCTION update_review_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When verification is created/updated to verified
    IF NEW.status = 'verified' THEN
        UPDATE public.reviews
        SET
            is_verified_purchase = true,
            verification_method = NEW.method,
            trust_weight = calculate_verification_trust_score(NEW.method, NEW.organization_id) * 1.5,
            updated_at = now()
        WHERE id = NEW.review_id;
    -- When verification is revoked/failed
    ELSIF NEW.status IN ('revoked', 'failed', 'expired') AND OLD.status = 'verified' THEN
        UPDATE public.reviews
        SET
            is_verified_purchase = false,
            verification_method = NULL,
            trust_weight = 1.00,
            updated_at = now()
        WHERE id = NEW.review_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_review_verification
    AFTER INSERT OR UPDATE OF status ON public.purchase_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_review_verification_status();

-- ============================================
-- 9. Function for weighted review sorting
-- ============================================

CREATE OR REPLACE FUNCTION get_weighted_review_score(
    p_review_id uuid
) RETURNS decimal(10,4)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_review record;
    v_base_score decimal(10,4);
    v_time_decay decimal(5,4);
    v_final_score decimal(10,4);
BEGIN
    SELECT r.*, pv.trust_score as verification_trust
    INTO v_review
    FROM public.reviews r
    LEFT JOIN public.purchase_verifications pv ON pv.review_id = r.id AND pv.status = 'verified'
    WHERE r.id = p_review_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Base score from rating (1-5 normalized to 0.2-1.0)
    v_base_score := v_review.rating::decimal / 5.0;

    -- Apply trust weight multiplier
    v_base_score := v_base_score * COALESCE(v_review.trust_weight, 1.0);

    -- Time decay (reviews lose relevance over time)
    -- Half-life of 90 days
    v_time_decay := POWER(0.5, EXTRACT(EPOCH FROM (now() - v_review.created_at)) / (90 * 24 * 60 * 60));

    -- Minimum decay of 0.3 (reviews never completely disappear)
    v_time_decay := GREATEST(v_time_decay, 0.3);

    v_final_score := v_base_score * v_time_decay;

    RETURN v_final_score;
END;
$$;

COMMENT ON FUNCTION get_weighted_review_score IS 'Calculate weighted score for review sorting considering verification and time decay';

-- ============================================
-- 10. View for public reviews with verification info
-- ============================================

CREATE OR REPLACE VIEW public.v_public_reviews_with_verification AS
SELECT
    r.id,
    r.organization_id,
    r.product_id,
    r.author_user_id,
    r.rating,
    r.title,
    r.body,
    r.media,
    r.response,
    r.response_at,
    r.created_at,
    r.is_verified_purchase,
    r.verification_method,
    r.trust_weight,
    pv.status as verification_status,
    pv.trust_score,
    CASE
        WHEN r.is_verified_purchase AND pv.status = 'verified' THEN
            CASE r.verification_method
                WHEN 'chestny_znak' THEN 'government_verified'
                WHEN 'qr_scan' THEN 'qr_verified'
                WHEN 'receipt_upload' THEN 'receipt_verified'
                WHEN 'manual_admin' THEN 'admin_verified'
                WHEN 'loyalty_purchase' THEN 'loyalty_verified'
                ELSE 'verified'
            END
        ELSE 'unverified'
    END as badge_type,
    get_weighted_review_score(r.id) as sort_score
FROM public.reviews r
LEFT JOIN public.purchase_verifications pv ON pv.review_id = r.id
WHERE r.status = 'approved';

COMMENT ON VIEW public.v_public_reviews_with_verification IS 'Public reviews with verification badges for display';
