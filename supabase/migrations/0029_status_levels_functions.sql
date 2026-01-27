-- Migration 0029: Status Levels Helper Functions
-- Date: 2026-01-26
-- Description: SQL functions for status levels business logic

BEGIN;

-- ============================================================
-- FUNCTION: Get current status for organization
-- ============================================================
-- Returns: '0', 'A', 'B', or 'C' based on highest active level

CREATE OR REPLACE FUNCTION public.get_current_status_level(org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  current_level text;
BEGIN
  -- Get the highest active level
  SELECT level INTO current_level
  FROM public.organization_status_levels
  WHERE organization_id = org_id
    AND is_active = true
    AND (valid_until IS NULL OR valid_until > now())
  ORDER BY
    CASE level
      WHEN 'C' THEN 3
      WHEN 'B' THEN 2
      WHEN 'A' THEN 1
    END DESC
  LIMIT 1;

  RETURN COALESCE(current_level, '0');
END;
$$;

COMMENT ON FUNCTION public.get_current_status_level IS 'Returns current status level (0/A/B/C) for an organization';

-- ============================================================
-- FUNCTION: Check if org meets level C criteria
-- ============================================================
-- Returns: jsonb with meets_criteria boolean and detailed criteria

CREATE OR REPLACE FUNCTION public.check_level_c_criteria(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  has_active_b boolean;
  review_count integer;
  response_rate numeric;
  avg_response_hours numeric;
  public_cases integer;
BEGIN
  -- Check 1: Active B
  SELECT EXISTS (
    SELECT 1 FROM public.organization_status_levels
    WHERE organization_id = org_id
      AND level = 'B'
      AND is_active = true
      AND (valid_until IS NULL OR valid_until > now())
  ) INTO has_active_b;

  -- Check 2: Review count (last 12 months)
  -- Note: Assuming reviews table exists with organization_id, status, created_at
  SELECT COALESCE(COUNT(*), 0) INTO review_count
  FROM public.reviews
  WHERE organization_id = org_id
    AND status = 'published'
    AND created_at > now() - interval '12 months';

  -- Check 3: Response rate (last 90 days)
  WITH recent_reviews AS (
    SELECT
      COUNT(*) as total,
      COUNT(org_response) as responded
    FROM public.reviews
    WHERE organization_id = org_id
      AND created_at > now() - interval '90 days'
      AND status = 'published'
  )
  SELECT
    CASE
      WHEN total = 0 THEN 0
      ELSE ROUND((responded::numeric / total::numeric) * 100, 2)
    END
  INTO response_rate
  FROM recent_reviews;

  -- Check 4: Average response time (last 90 days) in hours
  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (org_responded_at - created_at)) / 3600),
    999
  ) INTO avg_response_hours
  FROM public.reviews
  WHERE organization_id = org_id
    AND org_response IS NOT NULL
    AND created_at > now() - interval '90 days'
    AND status = 'published';

  -- Check 5: Public case studies
  -- Note: Assuming public_case_studies table exists
  SELECT COALESCE(COUNT(*), 0) INTO public_cases
  FROM public.public_case_studies
  WHERE organization_id = org_id
    AND status = 'published';

  -- Build result
  result := jsonb_build_object(
    'meets_criteria', (
      has_active_b AND
      review_count >= 15 AND
      response_rate >= 85 AND
      avg_response_hours < 48 AND
      public_cases >= 1
    ),
    'criteria', jsonb_build_object(
      'has_active_b', has_active_b,
      'review_count', review_count,
      'review_count_needed', 15,
      'response_rate', response_rate,
      'response_rate_needed', 85,
      'avg_response_hours', avg_response_hours,
      'avg_response_hours_max', 48,
      'public_cases', public_cases,
      'public_cases_needed', 1
    )
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- If reviews or case studies tables don't exist yet, return safe default
    RETURN jsonb_build_object(
      'meets_criteria', false,
      'criteria', jsonb_build_object(
        'has_active_b', has_active_b,
        'review_count', 0,
        'review_count_needed', 15,
        'response_rate', 0,
        'response_rate_needed', 85,
        'avg_response_hours', 999,
        'avg_response_hours_max', 48,
        'public_cases', 0,
        'public_cases_needed', 1
      ),
      'error', 'Missing dependent tables'
    );
END;
$$;

COMMENT ON FUNCTION public.check_level_c_criteria IS 'Checks if organization meets all criteria for level C status';

-- ============================================================
-- FUNCTION: Grant status level (with history)
-- ============================================================
-- Returns: uuid of new status level record

CREATE OR REPLACE FUNCTION public.grant_status_level(
  org_id uuid,
  status_level text,
  granted_by_user uuid DEFAULT NULL,
  valid_until_date timestamptz DEFAULT NULL,
  subscription_id_ref uuid DEFAULT NULL,
  admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  last_verified timestamptz;
BEGIN
  -- Validate level
  IF status_level NOT IN ('A', 'B', 'C') THEN
    RAISE EXCEPTION 'Invalid status level: %. Must be A, B, or C', status_level;
  END IF;

  -- Set last_verified_at for level B
  IF status_level = 'B' THEN
    last_verified := now();
  ELSE
    last_verified := NULL;
  END IF;

  -- Insert new status
  INSERT INTO public.organization_status_levels (
    organization_id,
    level,
    granted_by,
    valid_until,
    subscription_id,
    last_verified_at,
    notes
  ) VALUES (
    org_id,
    status_level,
    granted_by_user,
    valid_until_date,
    subscription_id_ref,
    last_verified,
    admin_notes
  )
  RETURNING id INTO new_id;

  -- Log to history
  INSERT INTO public.organization_status_history (
    organization_id,
    level,
    action,
    performed_by,
    reason
  ) VALUES (
    org_id,
    status_level,
    CASE WHEN granted_by_user IS NULL THEN 'auto_granted' ELSE 'granted' END,
    granted_by_user,
    admin_notes
  );

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION public.grant_status_level IS 'Grants a status level to organization and logs to history';

-- ============================================================
-- FUNCTION: Revoke status level
-- ============================================================
-- Returns: boolean indicating success

CREATE OR REPLACE FUNCTION public.revoke_status_level(
  org_id uuid,
  status_level text,
  revoked_by_user uuid DEFAULT NULL,
  revoke_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected integer;
BEGIN
  -- Deactivate status
  UPDATE public.organization_status_levels
  SET
    is_active = false,
    updated_at = now()
  WHERE organization_id = org_id
    AND level = status_level
    AND is_active = true;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  -- Only log if something was revoked
  IF rows_affected > 0 THEN
    -- Log to history
    INSERT INTO public.organization_status_history (
      organization_id,
      level,
      action,
      performed_by,
      reason
    ) VALUES (
      org_id,
      status_level,
      'revoked',
      revoked_by_user,
      revoke_reason
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.revoke_status_level IS 'Revokes (deactivates) a status level and logs to history';

-- ============================================================
-- FUNCTION: Update status level validity
-- ============================================================
-- Updates valid_until for a status level (for renewals)

CREATE OR REPLACE FUNCTION public.update_status_validity(
  org_id uuid,
  status_level text,
  new_valid_until timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.organization_status_levels
  SET
    valid_until = new_valid_until,
    updated_at = now()
  WHERE organization_id = org_id
    AND level = status_level
    AND is_active = true;

  IF FOUND THEN
    -- Log renewal
    INSERT INTO public.organization_status_history (
      organization_id,
      level,
      action,
      reason
    ) VALUES (
      org_id,
      status_level,
      'renewed',
      format('Valid until extended to %s', new_valid_until)
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.update_status_validity IS 'Updates the validity period of a status level';

-- ============================================================
-- FUNCTION: Update B content verification timestamp
-- ============================================================
-- Updates last_verified_at for level B (when content refreshed)

CREATE OR REPLACE FUNCTION public.update_b_verification(
  org_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.organization_status_levels
  SET
    last_verified_at = now(),
    updated_at = now()
  WHERE organization_id = org_id
    AND level = 'B'
    AND is_active = true;

  IF FOUND THEN
    -- Log verification update
    INSERT INTO public.organization_status_history (
      organization_id,
      level,
      action,
      reason
    ) VALUES (
      org_id,
      'B',
      'renewed',
      'Content verified and refreshed'
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.update_b_verification IS 'Updates last_verified_at for level B when content is refreshed';

COMMIT;
