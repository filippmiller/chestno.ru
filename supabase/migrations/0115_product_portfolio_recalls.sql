-- ============================================================================
-- Feature 5: Personal Product Portfolio + Recall Alerts
-- Track all products consumers have scanned, alert on recalls
-- ============================================================================

-- Consumer product portfolio (automatically populated from scans)
CREATE TABLE IF NOT EXISTS consumer_product_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- Scan info
    first_scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scan_count INTEGER NOT NULL DEFAULT 1,

    -- User-added info
    is_favorite BOOLEAN DEFAULT false,
    user_notes TEXT,
    purchase_date DATE,
    purchase_location TEXT,

    -- Product snapshot (in case product is deleted)
    product_name VARCHAR(255),
    product_image_url TEXT,
    organization_name VARCHAR(255),

    -- Recall tracking
    recall_alert_sent BOOLEAN DEFAULT false,
    recall_alert_sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, product_id)
);

-- Product recalls database
CREATE TABLE IF NOT EXISTS product_recalls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Linked product (may be null for external recalls)
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- Recall details
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'warning',  -- info, warning, critical
    recall_reason TEXT,

    -- Affected products (for matching)
    affected_product_names TEXT[],                   -- Product name patterns
    affected_batch_numbers TEXT[],                   -- Batch/lot numbers
    affected_date_range DATERANGE,                   -- Production date range

    -- Source
    source VARCHAR(100),                              -- rospotrebnadzor, manufacturer, admin
    source_url TEXT,
    source_reference VARCHAR(255),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,

    -- Admin
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consumer recall notifications (tracking which alerts were sent)
CREATE TABLE IF NOT EXISTS consumer_recall_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    recall_id UUID NOT NULL REFERENCES product_recalls(id) ON DELETE CASCADE,
    portfolio_item_id UUID REFERENCES consumer_product_portfolio(id) ON DELETE SET NULL,

    -- Delivery status
    notification_sent BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMPTZ,
    notification_channel VARCHAR(50),                 -- push, email, in_app

    -- User action
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, recall_id)
);

-- Consumer portfolio categories (user-defined organization)
CREATE TABLE IF NOT EXISTS portfolio_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),                                 -- Hex color
    icon VARCHAR(50),
    display_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link portfolio items to categories
CREATE TABLE IF NOT EXISTS portfolio_item_categories (
    portfolio_item_id UUID NOT NULL REFERENCES consumer_product_portfolio(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES portfolio_categories(id) ON DELETE CASCADE,

    PRIMARY KEY (portfolio_item_id, category_id)
);

-- Indexes
CREATE INDEX idx_portfolio_user ON consumer_product_portfolio(user_id);
CREATE INDEX idx_portfolio_product ON consumer_product_portfolio(product_id);
CREATE INDEX idx_portfolio_last_scan ON consumer_product_portfolio(last_scanned_at DESC);
CREATE INDEX idx_portfolio_favorites ON consumer_product_portfolio(user_id, is_favorite) WHERE is_favorite = true;

CREATE INDEX idx_recalls_active ON product_recalls(is_active, published_at DESC);
CREATE INDEX idx_recalls_product ON product_recalls(product_id);
CREATE INDEX idx_recalls_severity ON product_recalls(severity);

CREATE INDEX idx_recall_alerts_user ON consumer_recall_alerts(user_id);
CREATE INDEX idx_recall_alerts_unack ON consumer_recall_alerts(user_id, acknowledged) WHERE acknowledged = false;

-- Function to add/update portfolio from QR scan
CREATE OR REPLACE FUNCTION update_portfolio_from_scan(
    p_user_id UUID,
    p_product_id UUID
)
RETURNS consumer_product_portfolio AS $$
DECLARE
    result consumer_product_portfolio;
    product_info RECORD;
BEGIN
    -- Get product info for snapshot
    SELECT
        p.name as product_name,
        p.image_url as product_image_url,
        o.id as organization_id,
        o.name as organization_name
    INTO product_info
    FROM products p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = p_product_id;

    IF product_info IS NULL THEN
        RETURN NULL;
    END IF;

    -- Upsert portfolio item
    INSERT INTO consumer_product_portfolio (
        user_id, product_id, organization_id,
        product_name, product_image_url, organization_name,
        first_scanned_at, last_scanned_at, scan_count
    )
    VALUES (
        p_user_id, p_product_id, product_info.organization_id,
        product_info.product_name, product_info.product_image_url, product_info.organization_name,
        now(), now(), 1
    )
    ON CONFLICT (user_id, product_id) DO UPDATE SET
        last_scanned_at = now(),
        scan_count = consumer_product_portfolio.scan_count + 1,
        updated_at = now()
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check for recalls affecting a user's portfolio
CREATE OR REPLACE FUNCTION check_recalls_for_user(p_user_id UUID)
RETURNS TABLE (
    recall_id UUID,
    portfolio_item_id UUID,
    product_name VARCHAR,
    recall_title VARCHAR,
    severity VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id as recall_id,
        cpp.id as portfolio_item_id,
        cpp.product_name,
        r.title as recall_title,
        r.severity
    FROM consumer_product_portfolio cpp
    JOIN product_recalls r ON (
        r.product_id = cpp.product_id
        OR cpp.product_name = ANY(r.affected_product_names)
    )
    LEFT JOIN consumer_recall_alerts cra ON cra.recall_id = r.id AND cra.user_id = p_user_id
    WHERE cpp.user_id = p_user_id
    AND r.is_active = true
    AND cra.id IS NULL;  -- Not yet alerted
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER trigger_portfolio_updated_at
    BEFORE UPDATE ON consumer_product_portfolio
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

CREATE TRIGGER trigger_recalls_updated_at
    BEFORE UPDATE ON product_recalls
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

-- RLS Policies
ALTER TABLE consumer_product_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_recall_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_item_categories ENABLE ROW LEVEL SECURITY;

-- Portfolio: users can only access their own
CREATE POLICY "Users can manage own portfolio"
    ON consumer_product_portfolio FOR ALL
    USING (user_id = auth.uid());

-- Recalls: public read
CREATE POLICY "Recalls are public"
    ON product_recalls FOR SELECT
    USING (is_active = true);

-- Recall alerts: users can only access their own
CREATE POLICY "Users can view own recall alerts"
    ON consumer_recall_alerts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own recall alerts"
    ON consumer_recall_alerts FOR UPDATE
    USING (user_id = auth.uid());

-- Categories: users can only access their own
CREATE POLICY "Users can manage own categories"
    ON portfolio_categories FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own item categories"
    ON portfolio_item_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM consumer_product_portfolio
            WHERE id = portfolio_item_categories.portfolio_item_id
            AND user_id = auth.uid()
        )
    );

-- Notification types for recalls
INSERT INTO notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('consumer.recall_alert', 'consumer', 'critical',
     'Отзыв продукта: {{product_name}}',
     '{{recall_title}} - проверьте, есть ли у вас этот продукт',
     ARRAY['in_app', 'push', 'email'])
ON CONFLICT (key) DO NOTHING;
