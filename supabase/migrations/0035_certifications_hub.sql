-- Migration: Certification & Compliance Hub
-- Manages producer certifications (GOST, organic, halal, kosher, eco-labels)

-- =============================================================================
-- CERTIFICATION TYPES (Reference Table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS certification_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,  -- e.g., 'gost', 'organic_eu', 'halal'

    -- Display info
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ru TEXT,
    description_en TEXT,

    -- Categorization
    category TEXT NOT NULL CHECK (category IN (
        'quality_standard',   -- GOST, ISO, etc.
        'organic',            -- Organic certifications
        'religious',          -- Halal, Kosher
        'eco_label',          -- Eco-friendly labels
        'safety',             -- Sanitary, safety certs
        'origin',             -- PDO, PGI, geographic
        'other'
    )),

    -- Issuing body info
    issuing_body_name_ru TEXT,
    issuing_body_name_en TEXT,
    issuing_body_website TEXT,
    issuing_body_country TEXT DEFAULT 'RU',

    -- Verification settings
    requires_document BOOLEAN NOT NULL DEFAULT true,
    auto_verify_enabled BOOLEAN NOT NULL DEFAULT false,
    verification_api_url TEXT,  -- For automated verification

    -- Visual assets
    logo_url TEXT,
    badge_color TEXT DEFAULT '#4F46E5',

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed common Russian and international certification types
INSERT INTO certification_types (code, name_ru, name_en, category, issuing_body_name_ru, issuing_body_name_en, issuing_body_country, badge_color) VALUES
    -- Quality Standards
    ('gost_r', 'ГОСТ Р', 'GOST R', 'quality_standard', 'Росстандарт', 'Rosstandart', 'RU', '#1E40AF'),
    ('gost_iso', 'ГОСТ ИСО', 'GOST ISO', 'quality_standard', 'Росстандарт', 'Rosstandart', 'RU', '#1E40AF'),
    ('iso_9001', 'ИСО 9001', 'ISO 9001', 'quality_standard', 'ISO', 'ISO', 'INT', '#0EA5E9'),
    ('iso_22000', 'ИСО 22000', 'ISO 22000 (Food Safety)', 'quality_standard', 'ISO', 'ISO', 'INT', '#0EA5E9'),
    ('roskachestvo', 'Роскачество', 'Roskachestvo', 'quality_standard', 'Роскачество', 'Russian Quality System', 'RU', '#DC2626'),

    -- Organic
    ('organic_ru', 'Органик (РФ)', 'Organic (Russia)', 'organic', 'Роскачество', 'Roskachestvo', 'RU', '#22C55E'),
    ('organic_eu', 'Органик ЕС', 'EU Organic', 'organic', 'European Commission', 'European Commission', 'EU', '#22C55E'),
    ('usda_organic', 'USDA Органик', 'USDA Organic', 'organic', 'USDA', 'USDA', 'US', '#22C55E'),
    ('ecocert', 'Ecocert', 'Ecocert', 'organic', 'Ecocert', 'Ecocert', 'FR', '#16A34A'),

    -- Religious
    ('halal_ru', 'Халяль (РФ)', 'Halal (Russia)', 'religious', 'Совет муфтиев России', 'Council of Muftis of Russia', 'RU', '#10B981'),
    ('halal_iswa', 'Халяль ISWA', 'Halal ISWA', 'religious', 'ISWA', 'Islamic Society of Washington Area', 'INT', '#10B981'),
    ('kosher_ru', 'Кошер', 'Kosher', 'religious', 'Главный раввинат России', 'Chief Rabbinate of Russia', 'RU', '#3B82F6'),
    ('kosher_ou', 'Кошер OU', 'Kosher OU', 'religious', 'Orthodox Union', 'Orthodox Union', 'US', '#3B82F6'),

    -- Eco Labels
    ('leaf_of_life', 'Листок жизни', 'Leaf of Life', 'eco_label', 'Экологический союз', 'Ecological Union', 'RU', '#84CC16'),
    ('eco_product_ru', 'Экопродукт', 'Eco Product', 'eco_label', 'Роскачество', 'Roskachestvo', 'RU', '#84CC16'),
    ('fsc', 'FSC', 'FSC', 'eco_label', 'Forest Stewardship Council', 'Forest Stewardship Council', 'INT', '#15803D'),
    ('rainforest_alliance', 'Rainforest Alliance', 'Rainforest Alliance', 'eco_label', 'Rainforest Alliance', 'Rainforest Alliance', 'INT', '#16A34A'),

    -- Safety
    ('sanitary_ru', 'Санитарный сертификат', 'Sanitary Certificate', 'safety', 'Роспотребнадзор', 'Rospotrebnadzor', 'RU', '#EF4444'),
    ('declaration_conformity', 'Декларация соответствия', 'Declaration of Conformity', 'safety', 'Росаккредитация', 'Rosaccreditation', 'RU', '#F97316'),
    ('fire_safety', 'Пожарный сертификат', 'Fire Safety Certificate', 'safety', 'МЧС России', 'EMERCOM of Russia', 'RU', '#DC2626'),

    -- Geographic Origin
    ('pdo_ru', 'НМПТ', 'Protected Designation of Origin (Russia)', 'origin', 'Роспатент', 'Rospatent', 'RU', '#8B5CF6'),
    ('pgi_ru', 'ГУ', 'Protected Geographical Indication (Russia)', 'origin', 'Роспатент', 'Rospatent', 'RU', '#A855F7')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- PRODUCER CERTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS producer_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    certification_type_id UUID NOT NULL REFERENCES certification_types(id),

    -- Certificate details
    certificate_number TEXT,  -- Official certificate/registration number
    issued_by TEXT,           -- Specific issuing organization
    issued_date DATE,
    expiry_date DATE,         -- NULL means no expiry

    -- Scope
    scope_description TEXT,   -- What products/processes are covered
    product_ids UUID[],       -- Specific products this cert covers (optional)

    -- Document storage
    document_url TEXT,        -- URL to uploaded certificate document
    document_original_name TEXT,
    document_uploaded_at TIMESTAMPTZ,

    -- Verification status
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
        'pending',            -- Awaiting review
        'verified',           -- Confirmed by chestno.ru
        'rejected',           -- Failed verification
        'expired',            -- Past expiry date
        'revoked',            -- Revoked by issuing body
        'auto_verified'       -- Verified via API
    )),
    verification_notes TEXT,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,

    -- Auto-verification
    external_verification_id TEXT,  -- ID from external verification API
    last_auto_check_at TIMESTAMPTZ,
    next_auto_check_at TIMESTAMPTZ,

    -- Visibility
    is_public BOOLEAN NOT NULL DEFAULT true,
    display_on_products BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate active certs
    CONSTRAINT unique_active_cert UNIQUE (organization_id, certification_type_id, certificate_number)
);

-- Indexes
CREATE INDEX idx_cert_org ON producer_certifications(organization_id);
CREATE INDEX idx_cert_type ON producer_certifications(certification_type_id);
CREATE INDEX idx_cert_status ON producer_certifications(verification_status);
CREATE INDEX idx_cert_expiry ON producer_certifications(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_cert_products ON producer_certifications USING GIN(product_ids) WHERE product_ids IS NOT NULL;

-- =============================================================================
-- CERTIFICATION VERIFICATION LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS certification_verification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id UUID NOT NULL REFERENCES producer_certifications(id) ON DELETE CASCADE,

    -- Action details
    action TEXT NOT NULL CHECK (action IN (
        'submitted',
        'auto_check_passed',
        'auto_check_failed',
        'manual_verified',
        'manual_rejected',
        'expired',
        'renewal_submitted',
        'revoked'
    )),

    previous_status TEXT,
    new_status TEXT NOT NULL,
    notes TEXT,

    -- Who performed
    performed_by UUID REFERENCES auth.users(id),  -- NULL for system actions
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_log_cert ON certification_verification_log(certification_id);

-- =============================================================================
-- CERTIFICATION EXPIRY ALERTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS certification_expiry_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id UUID NOT NULL REFERENCES producer_certifications(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Alert configuration
    alert_days_before INTEGER NOT NULL DEFAULT 30,  -- Days before expiry
    alert_type TEXT NOT NULL CHECK (alert_type IN ('email', 'notification', 'both')),

    -- Alert status
    scheduled_at TIMESTAMPTZ NOT NULL,  -- When alert should fire
    sent_at TIMESTAMPTZ,                -- When alert was actually sent
    acknowledged_at TIMESTAMPTZ,        -- When user acknowledged

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expiry_alerts_scheduled ON certification_expiry_alerts(scheduled_at) WHERE sent_at IS NULL;
CREATE INDEX idx_expiry_alerts_org ON certification_expiry_alerts(organization_id);

-- =============================================================================
-- PRODUCT CERTIFICATION MAPPING
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES producer_certifications(id) ON DELETE CASCADE,

    -- Override org-level cert for specific product
    is_primary BOOLEAN NOT NULL DEFAULT false,  -- Featured on product page

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_product_cert UNIQUE (product_id, certification_id)
);

CREATE INDEX idx_product_cert_product ON product_certifications(product_id);
CREATE INDEX idx_product_cert_cert ON product_certifications(certification_id);

-- =============================================================================
-- CERTIFICATION VERIFICATION REQUESTS (Consumer-initiated)
-- =============================================================================
CREATE TABLE IF NOT EXISTS certification_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id UUID NOT NULL REFERENCES producer_certifications(id) ON DELETE CASCADE,

    -- Requester info
    requester_user_id UUID REFERENCES auth.users(id),
    requester_ip TEXT,
    requester_reason TEXT,

    -- Request details
    request_type TEXT NOT NULL CHECK (request_type IN (
        'authenticity_check',  -- Consumer wants to verify cert is real
        'dispute',             -- Consumer disputes the certification
        'renewal_inquiry'      -- Asking if cert has been renewed
    )),

    -- Resolution
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_requests_cert ON certification_verification_requests(certification_id);
CREATE INDEX idx_verification_requests_status ON certification_verification_requests(status);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update certification status when expired
CREATE OR REPLACE FUNCTION check_certification_expiry()
RETURNS void AS $$
BEGIN
    UPDATE producer_certifications
    SET
        verification_status = 'expired',
        updated_at = now()
    WHERE
        expiry_date IS NOT NULL
        AND expiry_date < CURRENT_DATE
        AND verification_status NOT IN ('expired', 'revoked', 'rejected');

    -- Log the expiry
    INSERT INTO certification_verification_log (certification_id, action, previous_status, new_status, notes)
    SELECT
        id,
        'expired',
        verification_status,
        'expired',
        'Certificate expired on ' || expiry_date::text
    FROM producer_certifications
    WHERE
        expiry_date IS NOT NULL
        AND expiry_date < CURRENT_DATE
        AND verification_status = 'expired'
        AND NOT EXISTS (
            SELECT 1 FROM certification_verification_log l
            WHERE l.certification_id = producer_certifications.id
            AND l.action = 'expired'
            AND l.performed_at > now() - interval '1 day'
        );
END;
$$ LANGUAGE plpgsql;

-- Function to schedule expiry alerts
CREATE OR REPLACE FUNCTION schedule_expiry_alerts()
RETURNS void AS $$
DECLARE
    alert_days INTEGER[] := ARRAY[90, 60, 30, 14, 7, 1];
    days INTEGER;
BEGIN
    FOREACH days IN ARRAY alert_days
    LOOP
        INSERT INTO certification_expiry_alerts (
            certification_id,
            organization_id,
            alert_days_before,
            alert_type,
            scheduled_at
        )
        SELECT
            pc.id,
            pc.organization_id,
            days,
            'both',
            pc.expiry_date - (days || ' days')::interval
        FROM producer_certifications pc
        WHERE
            pc.expiry_date IS NOT NULL
            AND pc.expiry_date > CURRENT_DATE
            AND pc.verification_status IN ('verified', 'auto_verified')
            AND NOT EXISTS (
                SELECT 1 FROM certification_expiry_alerts cea
                WHERE cea.certification_id = pc.id
                AND cea.alert_days_before = days
            );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get organization's active certifications
CREATE OR REPLACE FUNCTION get_org_certifications(org_id UUID)
RETURNS TABLE (
    certification_id UUID,
    cert_type_code TEXT,
    cert_type_name_ru TEXT,
    cert_type_name_en TEXT,
    category TEXT,
    badge_color TEXT,
    logo_url TEXT,
    certificate_number TEXT,
    issued_date DATE,
    expiry_date DATE,
    verification_status TEXT,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.id,
        ct.code,
        ct.name_ru,
        ct.name_en,
        ct.category,
        ct.badge_color,
        ct.logo_url,
        pc.certificate_number,
        pc.issued_date,
        pc.expiry_date,
        pc.verification_status,
        (pc.verification_status IN ('verified', 'auto_verified')
         AND (pc.expiry_date IS NULL OR pc.expiry_date >= CURRENT_DATE)) as is_valid
    FROM producer_certifications pc
    JOIN certification_types ct ON ct.id = pc.certification_type_id
    WHERE pc.organization_id = org_id
    AND pc.is_public = true
    ORDER BY ct.display_order, ct.name_ru;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE certification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE producer_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_verification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_expiry_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_verification_requests ENABLE ROW LEVEL SECURITY;

-- Certification types: Public read
CREATE POLICY "Anyone can view active certification types"
    ON certification_types FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role manages certification types"
    ON certification_types FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Producer certifications: Org members can manage, public can view verified
CREATE POLICY "Public can view verified certifications"
    ON producer_certifications FOR SELECT
    USING (is_public = true AND verification_status IN ('verified', 'auto_verified'));

CREATE POLICY "Org members can view all their certifications"
    ON producer_certifications FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins can manage certifications"
    ON producer_certifications FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service role manages certifications"
    ON producer_certifications FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Verification log: Org members can view, service role can insert
CREATE POLICY "Org members can view verification log"
    ON certification_verification_log FOR SELECT
    USING (
        certification_id IN (
            SELECT id FROM producer_certifications
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role manages verification log"
    ON certification_verification_log FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Expiry alerts: Org members only
CREATE POLICY "Org members can view expiry alerts"
    ON certification_expiry_alerts FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role manages expiry alerts"
    ON certification_expiry_alerts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Product certifications: Follow product visibility
CREATE POLICY "Public can view product certifications"
    ON product_certifications FOR SELECT
    USING (true);

CREATE POLICY "Org admins can manage product certifications"
    ON product_certifications FOR ALL
    USING (
        product_id IN (
            SELECT id FROM products
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- Verification requests: Anyone can create, org members can view theirs
CREATE POLICY "Authenticated users can create verification requests"
    ON certification_verification_requests FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Org members can view verification requests"
    ON certification_verification_requests FOR SELECT
    USING (
        certification_id IN (
            SELECT id FROM producer_certifications
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role manages verification requests"
    ON certification_verification_requests FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE certification_types IS 'Reference table of all supported certification types (GOST, organic, halal, etc.)';
COMMENT ON TABLE producer_certifications IS 'Certifications held by producers/organizations';
COMMENT ON TABLE certification_verification_log IS 'Audit log of all verification status changes';
COMMENT ON TABLE certification_expiry_alerts IS 'Scheduled alerts for expiring certifications';
COMMENT ON TABLE product_certifications IS 'Links specific products to certifications';
COMMENT ON TABLE certification_verification_requests IS 'Consumer-initiated verification requests';
