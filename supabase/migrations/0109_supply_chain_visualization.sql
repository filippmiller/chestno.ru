-- Migration 0107: Supply Chain Visualization
-- Date: 2026-02-03
-- Description: Create tables for interactive supply chain visualization with nodes and steps

BEGIN;

-- ============================================================
-- ENUM: supply_chain_node_type
-- ============================================================
-- Types of nodes in the supply chain

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supply_chain_node_type') THEN
    CREATE TYPE supply_chain_node_type AS ENUM (
      'PRODUCER',     -- Original producer/farmer
      'PROCESSOR',    -- Processing facility
      'WAREHOUSE',    -- Storage/warehousing
      'DISTRIBUTOR',  -- Distribution center
      'RETAILER',     -- Retail location
      'CONSUMER'      -- End consumer (final destination)
    );
  END IF;
END
$$;

-- ============================================================
-- TABLE: supply_chain_nodes
-- ============================================================
-- Individual nodes/locations in the supply chain

CREATE TABLE IF NOT EXISTS public.supply_chain_nodes (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid
    REFERENCES public.products(id) ON DELETE CASCADE,

  -- Node classification
  node_type supply_chain_node_type NOT NULL,

  -- Node details
  name text NOT NULL,
    -- Human-readable name (e.g., "Altai Mountain Farm")
  description text,
    -- Optional description of this node
  location text,
    -- Human-readable location (e.g., "Altai Krai, Russia")

  -- Geographic coordinates (optional, for map display)
  coordinates jsonb,
    -- { "lat": 52.5200, "lng": 13.4050 }

  -- Ordering (for linear supply chains)
  order_index integer NOT NULL DEFAULT 0,

  -- Contact info (optional)
  contact_name text,
  contact_phone text,
  contact_email text,

  -- External reference
  external_id text,
    -- Third-party tracking ID

  -- Verification
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Media
  image_url text,
  certificate_urls jsonb DEFAULT '[]'::jsonb,

  -- Metadata
  metadata jsonb,

  -- Audit timestamps
  created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: supply_chain_steps
-- ============================================================
-- Transitions between nodes in the supply chain

CREATE TABLE IF NOT EXISTS public.supply_chain_steps (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  product_id uuid NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL
    REFERENCES public.supply_chain_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL
    REFERENCES public.supply_chain_nodes(id) ON DELETE CASCADE,

  -- Step details
  description text,
    -- What happens during this step
  transport_method text,
    -- How the product moves (e.g., "truck", "train", "ship")
  distance_km numeric(10,2),
    -- Distance between nodes
  duration_hours numeric(10,2),
    -- Time taken for this step

  -- Temporal info
  timestamp timestamptz,
    -- When this step occurred
  expected_arrival timestamptz,
    -- Expected arrival time

  -- Verification
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_notes text,

  -- Tracking
  tracking_number text,
  batch_id text,

  -- Environmental data (optional)
  temperature_celsius numeric(5,2),
  humidity_percent numeric(5,2),

  -- Media
  document_urls jsonb DEFAULT '[]'::jsonb,

  -- Metadata
  metadata jsonb,

  -- Audit timestamps
  created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Nodes indexes
CREATE INDEX idx_supply_chain_nodes_org
ON public.supply_chain_nodes(organization_id);

CREATE INDEX idx_supply_chain_nodes_product
ON public.supply_chain_nodes(product_id)
WHERE product_id IS NOT NULL;

CREATE INDEX idx_supply_chain_nodes_type
ON public.supply_chain_nodes(node_type);

CREATE INDEX idx_supply_chain_nodes_order
ON public.supply_chain_nodes(organization_id, product_id, order_index);

CREATE INDEX idx_supply_chain_nodes_verified
ON public.supply_chain_nodes(organization_id, is_verified)
WHERE is_verified = true;

-- Steps indexes
CREATE INDEX idx_supply_chain_steps_product
ON public.supply_chain_steps(product_id);

CREATE INDEX idx_supply_chain_steps_from
ON public.supply_chain_steps(from_node_id);

CREATE INDEX idx_supply_chain_steps_to
ON public.supply_chain_steps(to_node_id);

CREATE INDEX idx_supply_chain_steps_timestamp
ON public.supply_chain_steps(product_id, timestamp DESC)
WHERE timestamp IS NOT NULL;

CREATE INDEX idx_supply_chain_steps_verified
ON public.supply_chain_steps(product_id, verified)
WHERE verified = true;

-- Constraint: from_node_id != to_node_id
ALTER TABLE public.supply_chain_steps
ADD CONSTRAINT supply_chain_steps_different_nodes
CHECK (from_node_id != to_node_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.supply_chain_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_chain_steps ENABLE ROW LEVEL SECURITY;

-- Nodes: Public can view verified nodes for published products
DROP POLICY IF EXISTS "Public view supply chain nodes" ON public.supply_chain_nodes;
CREATE POLICY "Public view supply chain nodes"
ON public.supply_chain_nodes
FOR SELECT
USING (
  -- Node is verified OR product is published
  is_verified = true
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = supply_chain_nodes.product_id
      AND p.status = 'published'
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = supply_chain_nodes.organization_id
      AND o.is_approved = true
  )
);

-- Nodes: Org members can manage nodes
DROP POLICY IF EXISTS "Org members manage supply chain nodes" ON public.supply_chain_nodes;
CREATE POLICY "Org members manage supply chain nodes"
ON public.supply_chain_nodes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = supply_chain_nodes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = supply_chain_nodes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
);

-- Nodes: Platform admins can manage all nodes
DROP POLICY IF EXISTS "Platform admins manage all supply chain nodes" ON public.supply_chain_nodes;
CREATE POLICY "Platform admins manage all supply chain nodes"
ON public.supply_chain_nodes
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

-- Steps: Public can view verified steps
DROP POLICY IF EXISTS "Public view supply chain steps" ON public.supply_chain_steps;
CREATE POLICY "Public view supply chain steps"
ON public.supply_chain_steps
FOR SELECT
USING (
  verified = true
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = supply_chain_steps.product_id
      AND p.status = 'published'
  )
);

-- Steps: Org members can manage steps (via product ownership)
DROP POLICY IF EXISTS "Org members manage supply chain steps" ON public.supply_chain_steps;
CREATE POLICY "Org members manage supply chain steps"
ON public.supply_chain_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = supply_chain_steps.product_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = supply_chain_steps.product_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
);

-- Steps: Platform admins can manage all steps
DROP POLICY IF EXISTS "Platform admins manage all supply chain steps" ON public.supply_chain_steps;
CREATE POLICY "Platform admins manage all supply chain steps"
ON public.supply_chain_steps
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

-- Get complete supply chain journey for a product
CREATE OR REPLACE FUNCTION public.get_supply_chain_journey(p_product_id uuid)
RETURNS TABLE (
  node_id uuid,
  node_name text,
  node_type supply_chain_node_type,
  node_location text,
  node_coordinates jsonb,
  node_order integer,
  node_verified boolean,
  step_id uuid,
  step_description text,
  step_timestamp timestamptz,
  step_verified boolean,
  next_node_id uuid
)
LANGUAGE sql
STABLE
AS $$
  WITH ordered_nodes AS (
    SELECT
      n.id,
      n.name,
      n.node_type,
      n.location,
      n.coordinates,
      n.order_index,
      n.is_verified
    FROM public.supply_chain_nodes n
    WHERE n.product_id = p_product_id
    ORDER BY n.order_index ASC
  )
  SELECT
    n.id as node_id,
    n.name as node_name,
    n.node_type,
    n.location as node_location,
    n.coordinates as node_coordinates,
    n.order_index as node_order,
    n.is_verified as node_verified,
    s.id as step_id,
    s.description as step_description,
    s.timestamp as step_timestamp,
    s.verified as step_verified,
    s.to_node_id as next_node_id
  FROM ordered_nodes n
  LEFT JOIN public.supply_chain_steps s ON s.from_node_id = n.id AND s.product_id = p_product_id
  ORDER BY n.order_index ASC;
$$;

-- Get supply chain statistics for a product
CREATE OR REPLACE FUNCTION public.get_supply_chain_stats(p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_nodes', (SELECT COUNT(*) FROM public.supply_chain_nodes WHERE product_id = p_product_id),
    'verified_nodes', (SELECT COUNT(*) FROM public.supply_chain_nodes WHERE product_id = p_product_id AND is_verified = true),
    'total_steps', (SELECT COUNT(*) FROM public.supply_chain_steps WHERE product_id = p_product_id),
    'verified_steps', (SELECT COUNT(*) FROM public.supply_chain_steps WHERE product_id = p_product_id AND verified = true),
    'total_distance_km', (SELECT COALESCE(SUM(distance_km), 0) FROM public.supply_chain_steps WHERE product_id = p_product_id),
    'total_duration_hours', (SELECT COALESCE(SUM(duration_hours), 0) FROM public.supply_chain_steps WHERE product_id = p_product_id)
  );
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at for nodes
CREATE OR REPLACE FUNCTION public.supply_chain_nodes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supply_chain_nodes_updated_at_trigger ON public.supply_chain_nodes;
CREATE TRIGGER supply_chain_nodes_updated_at_trigger
BEFORE UPDATE ON public.supply_chain_nodes
FOR EACH ROW
EXECUTE FUNCTION public.supply_chain_nodes_updated_at();

-- Auto-update updated_at for steps
CREATE OR REPLACE FUNCTION public.supply_chain_steps_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supply_chain_steps_updated_at_trigger ON public.supply_chain_steps;
CREATE TRIGGER supply_chain_steps_updated_at_trigger
BEFORE UPDATE ON public.supply_chain_steps
FOR EACH ROW
EXECUTE FUNCTION public.supply_chain_steps_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.supply_chain_nodes IS
  'Nodes/locations in the product supply chain (producer, warehouse, distributor, etc.)';

COMMENT ON TABLE public.supply_chain_steps IS
  'Transitions between nodes in the supply chain, tracking product movement';

COMMENT ON TYPE supply_chain_node_type IS
  'Types of supply chain nodes: PRODUCER, PROCESSOR, WAREHOUSE, DISTRIBUTOR, RETAILER, CONSUMER';

COMMENT ON FUNCTION public.get_supply_chain_journey IS
  'Returns the complete supply chain journey for a product with nodes and steps';

COMMENT ON FUNCTION public.get_supply_chain_stats IS
  'Returns statistics about a product supply chain (counts, distances, etc.)';

COMMIT;
