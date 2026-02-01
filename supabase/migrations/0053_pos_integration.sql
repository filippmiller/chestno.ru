-- Migration: POS Integration and Digital Receipts
-- Session 17 Feature 5: Integration with point-of-sale systems for trust badges
-- on receipts and post-purchase verification

-- =============================================================================
-- POS INTEGRATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pos_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,

    -- Integration details
    pos_provider TEXT NOT NULL CHECK (pos_provider IN (
        '1c',        -- 1C:Retail (most common in Russia)
        'atol',      -- ATOL fiscal data operators
        'evotor',    -- Evotor cloud POS
        'iiko',      -- iiko (restaurants)
        'r_keeper',  -- R-Keeper (restaurants)
        'custom'     -- Custom webhook integration
    )),
    integration_name TEXT,  -- Friendly name for this integration

    -- Authentication
    api_key_hash TEXT,
    webhook_secret_hash TEXT,  -- For HMAC signature verification
    webhook_url TEXT,  -- URL to receive events (for custom integrations)

    -- Configuration
    config JSONB NOT NULL DEFAULT '{
        "sync_products": true,
        "sync_transactions": true,
        "include_unverified_products": false
    }'::jsonb,

    -- Features enabled
    print_badges BOOLEAN NOT NULL DEFAULT true,
    digital_receipts BOOLEAN NOT NULL DEFAULT false,
    review_prompt BOOLEAN NOT NULL DEFAULT true,
    loyalty_integration BOOLEAN NOT NULL DEFAULT false,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for POS integrations
CREATE INDEX idx_pos_integrations_store ON public.pos_integrations(store_id);
CREATE INDEX idx_pos_integrations_provider ON public.pos_integrations(pos_provider);
CREATE INDEX idx_pos_integrations_active ON public.pos_integrations(is_active) WHERE is_active = true;

-- =============================================================================
-- PURCHASE TRANSACTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,
    pos_integration_id UUID REFERENCES public.pos_integrations(id) ON DELETE SET NULL,

    -- Transaction identification
    external_transaction_id TEXT,  -- POS system's transaction ID
    fiscal_receipt_number TEXT,    -- Official fiscal receipt number

    -- Customer identification (optional, for loyalty)
    customer_phone TEXT,
    customer_phone_hash TEXT,  -- SHA256 hash for privacy
    customer_email TEXT,
    customer_email_hash TEXT,  -- SHA256 hash for privacy
    customer_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,

    -- Transaction summary
    total_amount_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RUB',
    total_items INTEGER NOT NULL DEFAULT 0,
    verified_items INTEGER NOT NULL DEFAULT 0,

    -- Loyalty
    loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
    loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0,

    -- Receipt delivery status
    receipt_sent BOOLEAN NOT NULL DEFAULT false,
    receipt_sent_at TIMESTAMPTZ,
    receipt_delivery_method TEXT CHECK (receipt_delivery_method IN ('sms', 'email', 'none')),

    -- Review collection
    review_requested BOOLEAN NOT NULL DEFAULT false,
    review_requested_at TIMESTAMPTZ,
    review_submitted BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for purchase transactions
CREATE INDEX idx_purchase_transactions_store ON public.purchase_transactions(store_id);
CREATE INDEX idx_purchase_transactions_pos ON public.purchase_transactions(pos_integration_id) WHERE pos_integration_id IS NOT NULL;
CREATE INDEX idx_purchase_transactions_external ON public.purchase_transactions(external_transaction_id) WHERE external_transaction_id IS NOT NULL;
CREATE INDEX idx_purchase_transactions_customer ON public.purchase_transactions(customer_user_id) WHERE customer_user_id IS NOT NULL;
CREATE INDEX idx_purchase_transactions_phone_hash ON public.purchase_transactions(customer_phone_hash) WHERE customer_phone_hash IS NOT NULL;
CREATE INDEX idx_purchase_transactions_time ON public.purchase_transactions(purchased_at DESC);
CREATE INDEX idx_purchase_transactions_review ON public.purchase_transactions(review_requested, review_submitted) WHERE review_requested = true;

-- =============================================================================
-- PURCHASE LINE ITEMS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.purchase_transactions(id) ON DELETE CASCADE,

    -- Product reference
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    barcode TEXT,
    external_product_id TEXT,  -- POS system's product ID
    product_name TEXT NOT NULL,

    -- Verification status at time of purchase
    status_level TEXT CHECK (status_level IN ('A', 'B', 'C')),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verification_timestamp TIMESTAMPTZ,  -- When product was last verified

    -- Purchase details
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER,
    total_price_cents INTEGER,
    discount_cents INTEGER DEFAULT 0,

    -- Category (for analytics)
    category TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for purchase line items
CREATE INDEX idx_purchase_line_items_transaction ON public.purchase_line_items(transaction_id);
CREATE INDEX idx_purchase_line_items_product ON public.purchase_line_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_purchase_line_items_barcode ON public.purchase_line_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_purchase_line_items_verified ON public.purchase_line_items(transaction_id, is_verified);

-- =============================================================================
-- RECEIPT TOKENS TABLE
-- Secure tokens for accessing digital receipts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.receipt_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.purchase_transactions(id) ON DELETE CASCADE,

    -- Token for secure access
    token TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,  -- SHA256 hash for lookup

    -- Delivery
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('sms', 'email', 'qr')),
    delivered_at TIMESTAMPTZ,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    delivery_error TEXT,

    -- Access tracking
    first_viewed_at TIMESTAMPTZ,
    last_viewed_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,

    -- Actions taken
    review_link_clicked BOOLEAN NOT NULL DEFAULT false,
    products_viewed INTEGER NOT NULL DEFAULT 0,

    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    is_expired BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for receipt tokens
CREATE INDEX idx_receipt_tokens_transaction ON public.receipt_tokens(transaction_id);
CREATE INDEX idx_receipt_tokens_token_hash ON public.receipt_tokens(token_hash);
CREATE INDEX idx_receipt_tokens_delivery ON public.receipt_tokens(delivery_method, delivery_status);
CREATE INDEX idx_receipt_tokens_expires ON public.receipt_tokens(expires_at) WHERE is_expired = false;

-- =============================================================================
-- POS WEBHOOK LOGS TABLE
-- For debugging and audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pos_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_integration_id UUID REFERENCES public.pos_integrations(id) ON DELETE SET NULL,

    -- Request details
    event_type TEXT NOT NULL,  -- 'transaction', 'product_sync', 'inventory', etc.
    payload JSONB NOT NULL,
    headers JSONB,

    -- Validation
    signature_valid BOOLEAN,
    validation_error TEXT,

    -- Processing
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    result_transaction_id UUID REFERENCES public.purchase_transactions(id) ON DELETE SET NULL,

    -- Timestamp
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for webhook logs
CREATE INDEX idx_pos_webhook_logs_integration ON public.pos_webhook_logs(pos_integration_id);
CREATE INDEX idx_pos_webhook_logs_event ON public.pos_webhook_logs(event_type);
CREATE INDEX idx_pos_webhook_logs_processed ON public.pos_webhook_logs(processed, received_at);
CREATE INDEX idx_pos_webhook_logs_time ON public.pos_webhook_logs(received_at DESC);

-- =============================================================================
-- TRIGGERS: Updated At
-- =============================================================================
DROP TRIGGER IF EXISTS trg_pos_integrations_updated_at ON public.pos_integrations;
CREATE TRIGGER trg_pos_integrations_updated_at
    BEFORE UPDATE ON public.pos_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTION: Hash Customer PII
-- Automatically hashes phone/email for privacy
-- =============================================================================
CREATE OR REPLACE FUNCTION hash_customer_pii()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
        NEW.customer_phone_hash := encode(digest(NEW.customer_phone, 'sha256'), 'hex');
    END IF;
    IF NEW.customer_email IS NOT NULL AND NEW.customer_email != '' THEN
        NEW.customer_email_hash := encode(digest(LOWER(NEW.customer_email), 'sha256'), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hash_customer_pii ON public.purchase_transactions;
CREATE TRIGGER trg_hash_customer_pii
    BEFORE INSERT OR UPDATE ON public.purchase_transactions
    FOR EACH ROW
    EXECUTE FUNCTION hash_customer_pii();

-- =============================================================================
-- FUNCTION: Generate Receipt Token
-- Creates a secure token for digital receipt access
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_receipt_token(
    p_transaction_id UUID,
    p_delivery_method TEXT,
    p_expires_hours INTEGER DEFAULT 720  -- 30 days default
)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_token_hash TEXT;
BEGIN
    -- Generate secure random token
    v_token := encode(gen_random_bytes(32), 'base64');
    v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
    v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

    -- Insert token record
    INSERT INTO public.receipt_tokens (
        transaction_id,
        token,
        token_hash,
        delivery_method,
        expires_at
    ) VALUES (
        p_transaction_id,
        v_token,
        v_token_hash,
        p_delivery_method,
        now() + (p_expires_hours || ' hours')::INTERVAL
    );

    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Validate Receipt Token
-- Validates token and records view
-- =============================================================================
CREATE OR REPLACE FUNCTION validate_receipt_token(p_token TEXT)
RETURNS TABLE (
    valid BOOLEAN,
    transaction_id UUID,
    store_id UUID,
    is_first_view BOOLEAN
) AS $$
DECLARE
    v_token_hash TEXT;
    v_record RECORD;
BEGIN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT rt.*, pt.store_id as tx_store_id
    INTO v_record
    FROM public.receipt_tokens rt
    JOIN public.purchase_transactions pt ON pt.id = rt.transaction_id
    WHERE rt.token_hash = v_token_hash;

    IF v_record IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, false;
        RETURN;
    END IF;

    IF v_record.expires_at < now() OR v_record.is_expired THEN
        -- Mark as expired if not already
        UPDATE public.receipt_tokens SET is_expired = true WHERE id = v_record.id;
        RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, false;
        RETURN;
    END IF;

    -- Update view tracking
    UPDATE public.receipt_tokens
    SET view_count = view_count + 1,
        first_viewed_at = COALESCE(first_viewed_at, now()),
        last_viewed_at = now()
    WHERE id = v_record.id;

    RETURN QUERY SELECT
        true,
        v_record.transaction_id,
        v_record.tx_store_id,
        (v_record.first_viewed_at IS NULL);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Process POS Transaction
-- Creates transaction and line items from webhook data
-- =============================================================================
CREATE OR REPLACE FUNCTION process_pos_transaction(
    p_integration_id UUID,
    p_external_id TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT,
    p_total_cents INTEGER,
    p_items JSONB,  -- Array of {barcode, name, quantity, unit_price_cents, category}
    p_purchased_at TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_store_id UUID;
    v_item RECORD;
    v_product RECORD;
    v_total_items INTEGER := 0;
    v_verified_items INTEGER := 0;
    v_loyalty_points INTEGER := 0;
BEGIN
    -- Get store ID from integration
    SELECT store_id INTO v_store_id
    FROM public.pos_integrations
    WHERE id = p_integration_id AND is_active = true;

    IF v_store_id IS NULL THEN
        RAISE EXCEPTION 'POS integration not found or inactive';
    END IF;

    -- Create transaction
    INSERT INTO public.purchase_transactions (
        store_id,
        pos_integration_id,
        external_transaction_id,
        customer_phone,
        customer_email,
        total_amount_cents,
        purchased_at
    ) VALUES (
        v_store_id,
        p_integration_id,
        p_external_id,
        p_customer_phone,
        p_customer_email,
        p_total_cents,
        p_purchased_at
    ) RETURNING id INTO v_transaction_id;

    -- Process line items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        barcode TEXT,
        external_id TEXT,
        name TEXT,
        quantity INTEGER,
        unit_price_cents INTEGER,
        category TEXT
    )
    LOOP
        v_total_items := v_total_items + COALESCE(v_item.quantity, 1);

        -- Try to find matching product
        SELECT p.id, p.status, sl.level as status_level
        INTO v_product
        FROM public.products p
        LEFT JOIN public.product_status_levels sl ON sl.product_id = p.id
        WHERE (p.id::TEXT = v_item.barcode OR EXISTS (
            SELECT 1 FROM public.product_variants pv
            WHERE pv.product_id = p.id AND pv.barcode = v_item.barcode
        ))
        LIMIT 1;

        -- Insert line item
        INSERT INTO public.purchase_line_items (
            transaction_id,
            product_id,
            barcode,
            external_product_id,
            product_name,
            status_level,
            is_verified,
            verification_timestamp,
            quantity,
            unit_price_cents,
            total_price_cents,
            category
        ) VALUES (
            v_transaction_id,
            v_product.id,
            v_item.barcode,
            v_item.external_id,
            v_item.name,
            v_product.status_level,
            (v_product.id IS NOT NULL AND v_product.status = 'published'),
            CASE WHEN v_product.id IS NOT NULL THEN now() ELSE NULL END,
            COALESCE(v_item.quantity, 1),
            v_item.unit_price_cents,
            COALESCE(v_item.unit_price_cents, 0) * COALESCE(v_item.quantity, 1),
            v_item.category
        );

        IF v_product.id IS NOT NULL AND v_product.status = 'published' THEN
            v_verified_items := v_verified_items + COALESCE(v_item.quantity, 1);
            -- Award bonus points for verified products
            v_loyalty_points := v_loyalty_points + (COALESCE(v_item.quantity, 1) * 5);
        END IF;
    END LOOP;

    -- Update transaction totals
    UPDATE public.purchase_transactions
    SET total_items = v_total_items,
        verified_items = v_verified_items,
        loyalty_points_earned = v_loyalty_points
    WHERE id = v_transaction_id;

    -- Update integration last sync
    UPDATE public.pos_integrations
    SET last_sync_at = now(),
        last_error = NULL,
        last_error_at = NULL
    WHERE id = p_integration_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Get Digital Receipt
-- Returns formatted receipt data
-- =============================================================================
CREATE OR REPLACE FUNCTION get_digital_receipt(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'transaction', jsonb_build_object(
            'id', pt.id,
            'date', pt.purchased_at,
            'store_name', rs.name,
            'store_address', rs.address,
            'total_amount', pt.total_amount_cents,
            'currency', pt.currency
        ),
        'items', (
            SELECT jsonb_agg(jsonb_build_object(
                'name', pli.product_name,
                'quantity', pli.quantity,
                'unit_price', pli.unit_price_cents,
                'total_price', pli.total_price_cents,
                'verified', pli.is_verified,
                'status_level', pli.status_level,
                'product_id', pli.product_id
            ) ORDER BY pli.created_at)
            FROM public.purchase_line_items pli
            WHERE pli.transaction_id = pt.id
        ),
        'summary', jsonb_build_object(
            'total_items', pt.total_items,
            'verified_items', pt.verified_items,
            'verification_percent', CASE
                WHEN pt.total_items > 0
                THEN ROUND((pt.verified_items::NUMERIC / pt.total_items) * 100, 1)
                ELSE 0
            END,
            'loyalty_points_earned', pt.loyalty_points_earned
        )
    ) INTO v_result
    FROM public.purchase_transactions pt
    JOIN public.retail_stores rs ON rs.id = pt.store_id
    WHERE pt.id = p_transaction_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Get POS Analytics
-- Returns analytics for a POS integration or store
-- =============================================================================
CREATE OR REPLACE FUNCTION get_pos_analytics(
    p_store_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_transactions BIGINT,
    total_revenue_cents BIGINT,
    total_items_sold BIGINT,
    verified_items_sold BIGINT,
    verification_rate NUMERIC,
    avg_transaction_value NUMERIC,
    receipts_sent BIGINT,
    reviews_requested BIGINT,
    reviews_submitted BIGINT,
    review_conversion_rate NUMERIC,
    daily_stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH tx_stats AS (
        SELECT
            COUNT(*)::BIGINT as tx_count,
            SUM(total_amount_cents)::BIGINT as revenue,
            SUM(total_items)::BIGINT as items,
            SUM(verified_items)::BIGINT as verified,
            COUNT(*) FILTER (WHERE receipt_sent)::BIGINT as receipts,
            COUNT(*) FILTER (WHERE review_requested)::BIGINT as review_req,
            COUNT(*) FILTER (WHERE review_submitted)::BIGINT as review_sub
        FROM public.purchase_transactions
        WHERE store_id = p_store_id
          AND purchased_at > now() - (p_days || ' days')::INTERVAL
    ),
    daily AS (
        SELECT
            purchased_at::date as day,
            COUNT(*) as transactions,
            SUM(total_amount_cents) as revenue,
            SUM(verified_items) as verified_items
        FROM public.purchase_transactions
        WHERE store_id = p_store_id
          AND purchased_at > now() - (p_days || ' days')::INTERVAL
        GROUP BY purchased_at::date
        ORDER BY day
    )
    SELECT
        ts.tx_count,
        ts.revenue,
        ts.items,
        ts.verified,
        CASE WHEN ts.items > 0 THEN ROUND((ts.verified::NUMERIC / ts.items) * 100, 1) ELSE 0 END,
        CASE WHEN ts.tx_count > 0 THEN ROUND(ts.revenue::NUMERIC / ts.tx_count, 0) ELSE 0 END,
        ts.receipts,
        ts.review_req,
        ts.review_sub,
        CASE WHEN ts.review_req > 0 THEN ROUND((ts.review_sub::NUMERIC / ts.review_req) * 100, 1) ELSE 0 END,
        (SELECT jsonb_agg(jsonb_build_object(
            'date', day,
            'transactions', transactions,
            'revenue', revenue,
            'verified_items', verified_items
        )) FROM daily)
    FROM tx_stats ts;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.pos_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_webhook_logs ENABLE ROW LEVEL SECURITY;

-- POS Integrations: Store org members can manage
CREATE POLICY "Store org members can view POS integrations"
    ON public.pos_integrations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = pos_integrations.store_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can manage POS integrations"
    ON public.pos_integrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = pos_integrations.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = pos_integrations.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins manage all POS integrations"
    ON public.pos_integrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Purchase Transactions: Store org members can view, customers can view own
CREATE POLICY "Store org members can view transactions"
    ON public.purchase_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = purchase_transactions.store_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can view own transactions"
    ON public.purchase_transactions FOR SELECT
    USING (customer_user_id = auth.uid());

CREATE POLICY "Service can manage transactions"
    ON public.purchase_transactions FOR ALL
    USING (true)
    WITH CHECK (true);  -- Transactions created via secure webhook functions

CREATE POLICY "Platform admins view all transactions"
    ON public.purchase_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Purchase Line Items: Same as transactions
CREATE POLICY "Store org members can view line items"
    ON public.purchase_line_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_transactions pt
            JOIN public.retail_stores rs ON rs.id = pt.store_id
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE pt.id = purchase_line_items.transaction_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can view own line items"
    ON public.purchase_line_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_transactions pt
            WHERE pt.id = purchase_line_items.transaction_id
              AND pt.customer_user_id = auth.uid()
        )
    );

CREATE POLICY "Service can manage line items"
    ON public.purchase_line_items FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Platform admins view all line items"
    ON public.purchase_line_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Receipt Tokens: Public can validate (for receipt viewing)
CREATE POLICY "Public can view receipt tokens for validation"
    ON public.receipt_tokens FOR SELECT
    USING (true);  -- Actual validation done via secure function

CREATE POLICY "Service can manage receipt tokens"
    ON public.receipt_tokens FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Platform admins view all receipt tokens"
    ON public.receipt_tokens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Webhook Logs: Store org admins can view
CREATE POLICY "Store org admins can view webhook logs"
    ON public.pos_webhook_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.pos_integrations pi
            JOIN public.retail_stores rs ON rs.id = pi.store_id
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE pi.id = pos_webhook_logs.pos_integration_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service can manage webhook logs"
    ON public.pos_webhook_logs FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Platform admins view all webhook logs"
    ON public.pos_webhook_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.pos_integrations IS 'Registry of POS system integrations for retail stores';
COMMENT ON TABLE public.purchase_transactions IS 'Records of purchases made at integrated POS systems';
COMMENT ON TABLE public.purchase_line_items IS 'Individual items in purchase transactions with verification status';
COMMENT ON TABLE public.receipt_tokens IS 'Secure tokens for accessing digital receipts';
COMMENT ON TABLE public.pos_webhook_logs IS 'Audit log of POS webhook events';

COMMENT ON COLUMN public.pos_integrations.pos_provider IS 'POS system type: 1c, atol, evotor, iiko, r_keeper, custom';
COMMENT ON COLUMN public.pos_integrations.webhook_secret_hash IS 'SHA256 hash of webhook secret for HMAC verification';
COMMENT ON COLUMN public.purchase_transactions.customer_phone_hash IS 'SHA256 hash of phone for privacy-preserving lookups';
COMMENT ON COLUMN public.purchase_line_items.status_level IS 'Trust status level (A/B/C) at time of purchase';
COMMENT ON COLUMN public.receipt_tokens.token_hash IS 'SHA256 hash of token for secure lookup';

COMMENT ON FUNCTION generate_receipt_token IS 'Creates a secure token for digital receipt access';
COMMENT ON FUNCTION validate_receipt_token IS 'Validates receipt token and tracks view';
COMMENT ON FUNCTION process_pos_transaction IS 'Processes POS webhook data into transaction records';
COMMENT ON FUNCTION get_digital_receipt IS 'Returns formatted digital receipt data';
COMMENT ON FUNCTION get_pos_analytics IS 'Returns POS analytics for a store';
