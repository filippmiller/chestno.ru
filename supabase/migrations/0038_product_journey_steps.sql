-- Migration 0038: Product Journey Steps
-- Date: 2026-02-01
-- Description: Track supply chain transparency - sourcing, processing, packaging, distribution steps

BEGIN;

-- ============================================================
-- TABLE: product_journey_steps
-- ============================================================
-- Records each step in a product's journey from source to consumer
-- Enables transparency and traceability features

CREATE TABLE IF NOT EXISTS public.product_journey_steps (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to product
  product_id uuid NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,

  -- Step ordering (1 = first step in journey)
  step_order integer NOT NULL,

  -- Step type classification
  step_type text NOT NULL
    CHECK (step_type IN (
      'sourcing',      -- Raw material acquisition
      'processing',    -- Manufacturing/transformation
      'packaging',     -- Packaging and labeling
      'distribution',  -- Logistics and delivery
      'quality_check', -- Quality control checkpoint
      'certification', -- Certification/verification point
      'storage',       -- Storage/warehousing
      'other'          -- Custom step type
    )),

  -- Step details
  title text NOT NULL,
    -- E.g., "Sourced from family farm in Krasnodar"
  description text,
    -- Detailed description of this step

  -- Location information
  location_name text,
    -- Human-readable location name
  location_address text,
    -- Full address if available
  location_coordinates jsonb,
    -- { "lat": 45.0355, "lng": 38.9753 }

  -- Temporal information
  step_date date,
    -- When this step occurred/occurs
  step_date_end date,
    -- For steps that span time (e.g., aging, fermentation)

  -- Media attachments
  media_urls jsonb DEFAULT '[]'::jsonb,
    -- Array of media objects: [{ "url": "...", "type": "image|video|document", "caption": "..." }]

  -- Verification/certification
  is_verified boolean NOT NULL DEFAULT false,
  verified_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  verification_notes text,

  -- External references
  certificate_urls jsonb DEFAULT '[]'::jsonb,
    -- Links to certificates, audits, etc.
  external_reference text,
    -- External tracking number, batch ID, etc.

  -- Metadata
  metadata jsonb,
    -- Flexible field for additional data

  -- Audit timestamps
  created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Product's journey (ordered)
CREATE INDEX idx_journey_steps_product_order
ON public.product_journey_steps(product_id, step_order);

-- By step type (for filtering/analytics)
CREATE INDEX idx_journey_steps_type
ON public.product_journey_steps(step_type);

-- By date (for timeline views)
CREATE INDEX idx_journey_steps_date
ON public.product_journey_steps(step_date DESC)
WHERE step_date IS NOT NULL;

-- Verified steps
CREATE INDEX idx_journey_steps_verified
ON public.product_journey_steps(product_id, is_verified)
WHERE is_verified = true;

-- Full-text search on title and description
CREATE INDEX idx_journey_steps_search
ON public.product_journey_steps
USING gin(to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Unique constraint: one step_order per product
CREATE UNIQUE INDEX idx_journey_steps_unique_order
ON public.product_journey_steps(product_id, step_order);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.product_journey_steps ENABLE ROW LEVEL SECURITY;

-- Public can view journey steps for published products
DROP POLICY IF EXISTS "Public view published product journeys" ON public.product_journey_steps;
CREATE POLICY "Public view published product journeys"
ON public.product_journey_steps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_journey_steps.product_id
      AND p.status = 'published'
  )
);

-- Org editors can manage journey steps
DROP POLICY IF EXISTS "Org editors manage journey steps" ON public.product_journey_steps;
CREATE POLICY "Org editors manage journey steps"
ON public.product_journey_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = product_journey_steps.product_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = product_journey_steps.product_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
);

-- Platform admins can manage all journey steps
DROP POLICY IF EXISTS "Platform admins manage all journeys" ON public.product_journey_steps;
CREATE POLICY "Platform admins manage all journeys"
ON public.product_journey_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.role IN ('platform_owner', 'platform_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.role IN ('platform_owner', 'platform_admin')
  )
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get complete product journey
CREATE OR REPLACE FUNCTION public.get_product_journey(p_product_id uuid)
RETURNS TABLE (
  id uuid,
  step_order integer,
  step_type text,
  title text,
  description text,
  location_name text,
  location_coordinates jsonb,
  step_date date,
  step_date_end date,
  media_urls jsonb,
  is_verified boolean,
  verified_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    step_order,
    step_type,
    title,
    description,
    location_name,
    location_coordinates,
    step_date,
    step_date_end,
    media_urls,
    is_verified,
    verified_at
  FROM public.product_journey_steps
  WHERE product_id = p_product_id
  ORDER BY step_order ASC;
$$;

-- Reorder journey steps (after drag-drop)
CREATE OR REPLACE FUNCTION public.reorder_journey_steps(
  p_product_id uuid,
  p_step_orders jsonb -- Array of { "id": "uuid", "order": 1 }
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_step record;
BEGIN
  -- Verify user has permission (done via RLS, but double-check)
  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = p_product_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Update each step's order
  FOR v_step IN SELECT * FROM jsonb_to_recordset(p_step_orders) AS x(id uuid, "order" integer)
  LOOP
    UPDATE public.product_journey_steps
    SET step_order = v_step.order,
        updated_at = now()
    WHERE id = v_step.id
      AND product_id = p_product_id;
  END LOOP;

  RETURN true;
END;
$$;

-- ============================================================
-- TRIGGER: Updated at
-- ============================================================

CREATE OR REPLACE FUNCTION public.journey_steps_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey_steps_updated_at_trigger ON public.product_journey_steps;
CREATE TRIGGER journey_steps_updated_at_trigger
BEFORE UPDATE ON public.product_journey_steps
FOR EACH ROW
EXECUTE FUNCTION public.journey_steps_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.product_journey_steps IS
  'Records each step in a product supply chain journey for transparency and traceability.';

COMMENT ON COLUMN public.product_journey_steps.step_type IS
  'Type of journey step: sourcing, processing, packaging, distribution, quality_check, certification, storage, other';

COMMENT ON COLUMN public.product_journey_steps.media_urls IS
  'JSONB array of media objects: [{ "url": "...", "type": "image|video|document", "caption": "..." }]';

COMMENT ON COLUMN public.product_journey_steps.location_coordinates IS
  'JSONB object with lat/lng coordinates: { "lat": 45.0355, "lng": 38.9753 }';

COMMENT ON FUNCTION public.get_product_journey IS
  'Returns all journey steps for a product, ordered by step_order.';

COMMENT ON FUNCTION public.reorder_journey_steps IS
  'Reorder journey steps after drag-drop operation. Takes product_id and array of {id, order} objects.';

COMMIT;
