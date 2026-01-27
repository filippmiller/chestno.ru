-- Migration 0027: Status Levels Core Tables
-- Date: 2026-01-26
-- Description: Creates core tables for status levels system (A/B/C badges)

BEGIN;

-- ============================================================
-- TABLE: organization_status_levels
-- ============================================================
-- Stores active status levels for organizations (A, B, C)

CREATE TABLE IF NOT EXISTS public.organization_status_levels (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  granted_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id uuid
    REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,

  -- Status fields
  level text NOT NULL
    CHECK (level IN ('A', 'B', 'C')),
  is_active boolean NOT NULL DEFAULT true,
  can_use_badge boolean NOT NULL DEFAULT true,

  -- Timestamps
  granted_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
    -- NULL means no expiration (for level C)
    -- For A: set to subscription end date
    -- For B: set to granted_at + 18 months
  last_verified_at timestamptz,
    -- For B: when content was last updated
    -- NULL for A and C

  -- Metadata
  notes text,
    -- Admin notes (not visible to org)
  metadata jsonb,
    -- Flexible field for future extensions

  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_org_status_org_active
ON public.organization_status_levels(organization_id, is_active, level)
WHERE is_active = true;

CREATE INDEX idx_org_status_level_active
ON public.organization_status_levels(level, is_active)
WHERE is_active = true;

CREATE INDEX idx_org_status_expiring
ON public.organization_status_levels(valid_until)
WHERE is_active = true AND valid_until IS NOT NULL;

CREATE INDEX idx_org_status_b_verification
ON public.organization_status_levels(level, last_verified_at)
WHERE is_active = true AND level = 'B';

-- Constraints
-- Partial unique: one active level per org per level type
CREATE UNIQUE INDEX unique_active_level_per_org
ON public.organization_status_levels(organization_id, level)
WHERE is_active = true;

-- Check: valid_until must be in future when set
ALTER TABLE public.organization_status_levels
ADD CONSTRAINT valid_until_future
CHECK (valid_until IS NULL OR valid_until > granted_at);

-- Check: last_verified_at only for B
ALTER TABLE public.organization_status_levels
ADD CONSTRAINT last_verified_only_for_b
CHECK (
  (level = 'B' AND last_verified_at IS NOT NULL) OR
  (level != 'B' AND last_verified_at IS NULL)
);

-- ============================================================
-- TABLE: organization_status_history
-- ============================================================
-- Audit trail for all status changes

CREATE TABLE IF NOT EXISTS public.organization_status_history (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  performed_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Action details
  level text NOT NULL,
  action text NOT NULL
    CHECK (action IN ('granted', 'renewed', 'suspended', 'revoked', 'degraded', 'auto_granted')),
  reason text,

  -- Metadata
  metadata jsonb,
    -- Flexible field: payment_id, review_id, etc.

  -- Audit fields
  ip_address inet,
  user_agent text,

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_status_history_org_time
ON public.organization_status_history(organization_id, created_at DESC);

CREATE INDEX idx_status_history_action
ON public.organization_status_history(action, created_at DESC);

CREATE INDEX idx_status_history_performed_by
ON public.organization_status_history(performed_by, created_at DESC)
WHERE performed_by IS NOT NULL;

-- ============================================================
-- TABLE: status_upgrade_requests
-- ============================================================
-- Tracking upgrade requests from organizations

CREATE TABLE IF NOT EXISTS public.status_upgrade_requests (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL
    REFERENCES auth.users(id),
  reviewed_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Request details
  target_level text NOT NULL CHECK (target_level IN ('B', 'C')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  message text,
    -- User's explanation
  evidence_urls text[],
    -- Links to supporting materials

  -- Review details
  review_notes text,
    -- Admin notes (visible to org after review)
  rejection_reason text,

  -- Timestamps
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,

  -- Metadata
  metadata jsonb
);

-- Indexes
CREATE INDEX idx_upgrade_requests_org
ON public.status_upgrade_requests(organization_id, requested_at DESC);

CREATE INDEX idx_upgrade_requests_pending
ON public.status_upgrade_requests(status, requested_at)
WHERE status = 'pending';

CREATE INDEX idx_upgrade_requests_reviewer
ON public.status_upgrade_requests(reviewed_by, reviewed_at DESC)
WHERE reviewed_by IS NOT NULL;

-- Constraint: Rate limit - 1 pending request per org
CREATE UNIQUE INDEX idx_one_pending_per_org
ON public.status_upgrade_requests(organization_id)
WHERE status = 'pending';

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.organization_status_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_upgrade_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EXTEND SUBSCRIPTIONS TABLE
-- ============================================================
-- Add grace period fields to existing subscriptions

ALTER TABLE public.organization_subscriptions
ADD COLUMN IF NOT EXISTS grace_period_days integer DEFAULT 14,
ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz;

COMMIT;
