-- Migration 0028: Status Levels RLS Policies
-- Date: 2026-01-26
-- Description: Row Level Security policies for status levels system

BEGIN;

-- ============================================================
-- organization_status_levels POLICIES
-- ============================================================

-- Public: can view active badges only
CREATE POLICY "Public can view active status badges"
ON public.organization_status_levels FOR SELECT
TO public
USING (is_active = true AND can_use_badge = true);

-- Org members: can view full details of their org
CREATE POLICY "Org members can view own status details"
ON public.organization_status_levels FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Platform admins: full read access
CREATE POLICY "Platform admins can view all statuses"
ON public.organization_status_levels FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

-- Platform admins: can grant status
CREATE POLICY "Only platform admin can grant status"
ON public.organization_status_levels FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

-- Platform admins: can update status
CREATE POLICY "Only platform admin can update status"
ON public.organization_status_levels FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

-- System: can update (for cron jobs via service role)
CREATE POLICY "System can update statuses"
ON public.organization_status_levels FOR UPDATE
TO service_role
USING (true);

-- System: can insert (for cron jobs via service role)
CREATE POLICY "System can insert statuses"
ON public.organization_status_levels FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================
-- organization_status_history POLICIES
-- ============================================================

-- Org admins: can view own history
CREATE POLICY "Org admins can view own status history"
ON public.organization_status_history FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);

-- Platform admins: can view all history
CREATE POLICY "Platform admins can view all history"
ON public.organization_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

-- System and admins: can insert
CREATE POLICY "System and admins can insert history"
ON public.organization_status_history FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

-- ============================================================
-- status_upgrade_requests POLICIES
-- ============================================================

-- Org members: can view own requests
CREATE POLICY "Org members can view own requests"
ON public.status_upgrade_requests FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Org admins: can create requests
CREATE POLICY "Org admins can create requests"
ON public.status_upgrade_requests FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
  AND requested_by = auth.uid()
);

-- Org admins: can cancel own pending requests
CREATE POLICY "Org admins can cancel own requests"
ON public.status_upgrade_requests FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
  AND status = 'pending'
)
WITH CHECK (status = 'cancelled');

-- Platform admins: can view all requests
CREATE POLICY "Platform admins can view all requests"
ON public.status_upgrade_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

-- Platform admins: can review requests
CREATE POLICY "Platform admins can review requests"
ON public.status_upgrade_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

COMMIT;
