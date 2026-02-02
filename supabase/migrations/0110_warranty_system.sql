-- Migration 0107: Warranty Management System
-- Date: 2026-02-03
-- Description: Creates tables for digital warranty registration, tracking, and claims

BEGIN;

-- ============================================================
-- TABLE: warranty_policies
-- ============================================================
-- Defines warranty policies per organization and product category

CREATE TABLE IF NOT EXISTS public.warranty_policies (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Policy details
  product_category text NOT NULL,
    -- Category like 'electronics', 'appliances', 'furniture', etc.
  duration_months integer NOT NULL CHECK (duration_months > 0 AND duration_months <= 120),
    -- Max 10 years warranty
  coverage_description text NOT NULL,
    -- What the warranty covers (short description)
  terms text,
    -- Full warranty terms and conditions

  -- Policy options
  is_transferable boolean NOT NULL DEFAULT false,
    -- Can warranty be transferred to new owner
  requires_registration boolean NOT NULL DEFAULT true,
    -- Must user register to activate warranty
  registration_deadline_days integer,
    -- Days after purchase to register (NULL = no deadline)

  -- Status
  is_active boolean NOT NULL DEFAULT true,

  -- Metadata
  metadata jsonb,

  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_warranty_policies_org
ON public.warranty_policies(organization_id, is_active)
WHERE is_active = true;

CREATE INDEX idx_warranty_policies_category
ON public.warranty_policies(organization_id, product_category)
WHERE is_active = true;

-- Unique constraint: one active policy per org per category
CREATE UNIQUE INDEX idx_unique_active_policy_per_category
ON public.warranty_policies(organization_id, product_category)
WHERE is_active = true;

-- ============================================================
-- TABLE: warranty_registrations
-- ============================================================
-- Stores warranty registrations linked to products and QR codes

CREATE TABLE IF NOT EXISTS public.warranty_registrations (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  product_id uuid NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.app_users(id) ON DELETE CASCADE,
  qr_code_id uuid
    REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  policy_id uuid
    REFERENCES public.warranty_policies(id) ON DELETE SET NULL,

  -- Registration details
  serial_number text,
    -- Product serial number (optional)
  purchase_date date NOT NULL,
  purchase_location text,
    -- Where the product was purchased
  purchase_proof_url text,
    -- Receipt/invoice image URL

  -- Warranty period
  warranty_start date NOT NULL,
  warranty_end date NOT NULL,

  -- Status
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'expired', 'voided', 'transferred')),

  -- Contact info (for warranty claims)
  contact_email text,
  contact_phone text,

  -- Metadata
  metadata jsonb,
    -- Extended warranty info, transfer history, etc.

  -- Timestamps
  registered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_warranty_reg_user
ON public.warranty_registrations(user_id, status);

CREATE INDEX idx_warranty_reg_product
ON public.warranty_registrations(product_id);

CREATE INDEX idx_warranty_reg_qr
ON public.warranty_registrations(qr_code_id)
WHERE qr_code_id IS NOT NULL;

CREATE INDEX idx_warranty_reg_status
ON public.warranty_registrations(status, warranty_end)
WHERE status = 'active';

CREATE INDEX idx_warranty_reg_expiring
ON public.warranty_registrations(warranty_end)
WHERE status = 'active';

-- Unique: one registration per product per user
CREATE UNIQUE INDEX idx_unique_warranty_per_product_user
ON public.warranty_registrations(product_id, user_id)
WHERE status IN ('pending', 'active');

-- ============================================================
-- TABLE: warranty_claims
-- ============================================================
-- Tracks warranty claims and their resolution

CREATE TABLE IF NOT EXISTS public.warranty_claims (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  registration_id uuid NOT NULL
    REFERENCES public.warranty_registrations(id) ON DELETE CASCADE,

  -- Claim details
  claim_type text NOT NULL
    CHECK (claim_type IN ('repair', 'replacement', 'refund', 'inspection', 'other')),
  description text NOT NULL,
    -- User's description of the issue
  photos text[],
    -- Array of photo URLs showing the issue

  -- Status tracking
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'resolved', 'closed')),

  -- Priority
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Assigned staff (for business)
  assigned_to uuid
    REFERENCES public.app_users(id) ON DELETE SET NULL,

  -- Resolution
  resolution_notes text,
  resolution_type text
    CHECK (resolution_type IN ('repaired', 'replaced', 'refunded', 'no_fault_found', 'out_of_warranty', 'user_error', 'other')),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,

  -- Metadata
  metadata jsonb
    -- Service center info, tracking numbers, etc.
);

-- Indexes
CREATE INDEX idx_warranty_claims_registration
ON public.warranty_claims(registration_id);

CREATE INDEX idx_warranty_claims_status
ON public.warranty_claims(status, created_at DESC)
WHERE status NOT IN ('resolved', 'closed');

CREATE INDEX idx_warranty_claims_assigned
ON public.warranty_claims(assigned_to, status)
WHERE assigned_to IS NOT NULL;

CREATE INDEX idx_warranty_claims_priority
ON public.warranty_claims(priority, created_at)
WHERE status NOT IN ('resolved', 'closed');

-- ============================================================
-- TABLE: warranty_claim_history
-- ============================================================
-- Audit trail for claim status changes

CREATE TABLE IF NOT EXISTS public.warranty_claim_history (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  claim_id uuid NOT NULL
    REFERENCES public.warranty_claims(id) ON DELETE CASCADE,
  performed_by uuid
    REFERENCES public.app_users(id) ON DELETE SET NULL,

  -- Change details
  old_status text,
  new_status text NOT NULL,
  comment text,

  -- Metadata
  metadata jsonb,

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_claim_history_claim
ON public.warranty_claim_history(claim_id, created_at DESC);

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.warranty_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claim_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: warranty_policies
-- ============================================================

-- Public can view active policies
CREATE POLICY "Anyone can view active warranty policies" ON public.warranty_policies
    FOR SELECT
    USING (is_active = true);

-- Org managers can manage policies
CREATE POLICY "Org managers manage warranty policies" ON public.warranty_policies
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = warranty_policies.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = warranty_policies.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- ============================================================
-- RLS POLICIES: warranty_registrations
-- ============================================================

-- Users can view their own registrations
CREATE POLICY "Users view own warranty registrations" ON public.warranty_registrations
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can create registrations
CREATE POLICY "Users create warranty registrations" ON public.warranty_registrations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own registrations
CREATE POLICY "Users update own warranty registrations" ON public.warranty_registrations
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Org members can view registrations for their products
CREATE POLICY "Org members view product warranty registrations" ON public.warranty_registrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = warranty_registrations.product_id
              AND om.user_id = auth.uid()
        )
    );

-- ============================================================
-- RLS POLICIES: warranty_claims
-- ============================================================

-- Users can view claims on their registrations
CREATE POLICY "Users view own warranty claims" ON public.warranty_claims
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.warranty_registrations wr
            WHERE wr.id = warranty_claims.registration_id
              AND wr.user_id = auth.uid()
        )
    );

-- Users can create claims on their registrations
CREATE POLICY "Users create warranty claims" ON public.warranty_claims
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.warranty_registrations wr
            WHERE wr.id = warranty_claims.registration_id
              AND wr.user_id = auth.uid()
              AND wr.status = 'active'
        )
    );

-- Org members can view and manage claims for their products
CREATE POLICY "Org members manage warranty claims" ON public.warranty_claims
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.warranty_registrations wr
            JOIN public.products p ON p.id = wr.product_id
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE wr.id = warranty_claims.registration_id
              AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.warranty_registrations wr
            JOIN public.products p ON p.id = wr.product_id
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE wr.id = warranty_claims.registration_id
              AND om.user_id = auth.uid()
        )
    );

-- ============================================================
-- RLS POLICIES: warranty_claim_history
-- ============================================================

-- Same access as claims
CREATE POLICY "Users view own claim history" ON public.warranty_claim_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.warranty_claims wc
            JOIN public.warranty_registrations wr ON wr.id = wc.registration_id
            WHERE wc.id = warranty_claim_history.claim_id
              AND wr.user_id = auth.uid()
        )
    );

CREATE POLICY "Org members view claim history" ON public.warranty_claim_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.warranty_claims wc
            JOIN public.warranty_registrations wr ON wr.id = wc.registration_id
            JOIN public.products p ON p.id = wr.product_id
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE wc.id = warranty_claim_history.claim_id
              AND om.user_id = auth.uid()
        )
    );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to check if warranty is valid
CREATE OR REPLACE FUNCTION public.is_warranty_valid(registration_id uuid)
RETURNS boolean AS $$
DECLARE
    reg_status text;
    end_date date;
BEGIN
    SELECT status, warranty_end INTO reg_status, end_date
    FROM public.warranty_registrations
    WHERE id = registration_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    RETURN reg_status = 'active' AND end_date >= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get warranty days remaining
CREATE OR REPLACE FUNCTION public.get_warranty_days_remaining(registration_id uuid)
RETURNS integer AS $$
DECLARE
    end_date date;
    days_left integer;
BEGIN
    SELECT warranty_end INTO end_date
    FROM public.warranty_registrations
    WHERE id = registration_id
      AND status = 'active';

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    days_left := end_date - CURRENT_DATE;
    RETURN GREATEST(0, days_left);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to auto-expire warranties (for scheduled job)
CREATE OR REPLACE FUNCTION public.expire_warranties()
RETURNS integer AS $$
DECLARE
    expired_count integer;
BEGIN
    UPDATE public.warranty_registrations
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active'
      AND warranty_end < CURRENT_DATE;

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log claim status changes
CREATE OR REPLACE FUNCTION public.log_claim_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.warranty_claim_history (
            claim_id,
            old_status,
            new_status,
            metadata
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            jsonb_build_object('changed_at', now())
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_status_change_trigger
    AFTER UPDATE OF status ON public.warranty_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.log_claim_status_change();

-- Trigger to update resolved_at when claim is resolved
CREATE OR REPLACE FUNCTION public.set_claim_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
        NEW.resolved_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_resolved_at_trigger
    BEFORE UPDATE OF status ON public.warranty_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.set_claim_resolved_at();

COMMIT;
