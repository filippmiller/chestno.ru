-- =====================================================
-- Content Moderation Queue Enhancement
-- Migration 0054
-- =====================================================
-- Extends the existing moderation system (0035) with:
-- - Proper enum types for type safety
-- - Enhanced priority calculation
-- - Queue management functions (claim, resolve, escalate)
-- - Additional indexes for performant queue queries

SET client_encoding = 'UTF8';

-- =================
-- 1. ENUM TYPES
-- =================
-- Create proper PostgreSQL enum types for type safety and performance

DO $$
BEGIN
    -- Content type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_content_type') THEN
        CREATE TYPE moderation_content_type AS ENUM (
            'organization',
            'product',
            'review',
            'post',
            'media',
            'document',
            'certification'
        );
    END IF;

    -- Queue status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_queue_status') THEN
        CREATE TYPE moderation_queue_status AS ENUM (
            'pending',
            'in_review',
            'approved',
            'rejected',
            'escalated',
            'appealed',
            'resolved'
        );
    END IF;

    -- Queue source enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_source') THEN
        CREATE TYPE moderation_source AS ENUM (
            'auto_flag',
            'user_report',
            'new_content',
            'edit',
            'appeal',
            'scheduled_review'
        );
    END IF;

    -- Resolution action enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_resolution_action') THEN
        CREATE TYPE moderation_resolution_action AS ENUM (
            'approved',
            'rejected',
            'modified',
            'deleted',
            'no_action',
            'deferred'
        );
    END IF;
END $$;

-- =================
-- 2. ENHANCED PRIORITY CALCULATION FUNCTION
-- =================
-- More sophisticated priority calculation with detailed breakdown

CREATE OR REPLACE FUNCTION calculate_moderation_priority_v2(
    p_content_type text,
    p_source text,
    p_report_count integer DEFAULT 0,
    p_ai_confidence numeric DEFAULT 0,
    p_violator_history integer DEFAULT 0,
    p_content_age_hours integer DEFAULT 0,
    p_is_verified_business boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
    v_base_priority integer := 50;
    v_priority integer;
    v_reasons text[] := ARRAY[]::text[];
    v_content_weight integer := 0;
    v_source_weight integer := 0;
    v_report_weight integer := 0;
    v_ai_weight integer := 0;
    v_history_weight integer := 0;
    v_age_weight integer := 0;
    v_verified_weight integer := 0;
BEGIN
    -- Start with base priority
    v_priority := v_base_priority;

    -- Content type weight (certifications and organizations are highest priority)
    CASE p_content_type
        WHEN 'certification' THEN
            v_content_weight := 25;
            v_reasons := array_append(v_reasons, 'high_priority_content_type:certification');
        WHEN 'document' THEN
            v_content_weight := 20;
            v_reasons := array_append(v_reasons, 'high_priority_content_type:document');
        WHEN 'organization' THEN
            v_content_weight := 15;
            v_reasons := array_append(v_reasons, 'priority_content_type:organization');
        WHEN 'product' THEN
            v_content_weight := 10;
            v_reasons := array_append(v_reasons, 'priority_content_type:product');
        WHEN 'review' THEN
            v_content_weight := 5;
        WHEN 'post' THEN
            v_content_weight := 3;
        WHEN 'media' THEN
            v_content_weight := 2;
        ELSE
            v_content_weight := 0;
    END CASE;
    v_priority := v_priority + v_content_weight;

    -- Source weight (user reports are prioritized over auto-detection)
    CASE p_source
        WHEN 'user_report' THEN
            v_source_weight := 15;
            v_reasons := array_append(v_reasons, 'user_reported');
        WHEN 'auto_flag' THEN
            v_source_weight := 8;
            v_reasons := array_append(v_reasons, 'auto_flagged');
        WHEN 'appeal' THEN
            v_source_weight := 12;
            v_reasons := array_append(v_reasons, 'appeal_review');
        WHEN 'scheduled_review' THEN
            v_source_weight := 3;
        ELSE
            v_source_weight := 0;
    END CASE;
    v_priority := v_priority + v_source_weight;

    -- Report count boost (more reports = higher priority, capped at 30)
    v_report_weight := LEAST(p_report_count * 5, 30);
    IF v_report_weight > 0 THEN
        v_reasons := array_append(v_reasons, 'multiple_reports:' || p_report_count);
    END IF;
    v_priority := v_priority + v_report_weight;

    -- AI confidence boost (higher confidence = higher priority)
    v_ai_weight := (COALESCE(p_ai_confidence, 0) * 15)::integer;
    IF v_ai_weight >= 10 THEN
        v_reasons := array_append(v_reasons, 'high_ai_confidence:' || round(p_ai_confidence::numeric, 2));
    END IF;
    v_priority := v_priority + v_ai_weight;

    -- Violator history boost (repeat offenders get higher priority)
    v_history_weight := LEAST(p_violator_history * 12, 35);
    IF v_history_weight > 0 THEN
        v_reasons := array_append(v_reasons, 'repeat_violator:' || p_violator_history || '_violations');
    END IF;
    v_priority := v_priority + v_history_weight;

    -- Content age penalty (older items get slight deprioritization to handle fresh content first)
    -- But very old items (>72 hours) get priority bump as they need resolution
    IF p_content_age_hours > 72 THEN
        v_age_weight := 10;
        v_reasons := array_append(v_reasons, 'stale_item:' || p_content_age_hours || 'h');
    ELSIF p_content_age_hours > 24 THEN
        v_age_weight := -5;
    ELSE
        v_age_weight := 0;
    END IF;
    v_priority := v_priority + v_age_weight;

    -- Verified business boost (verified businesses get faster review)
    IF p_is_verified_business THEN
        v_verified_weight := 8;
        v_reasons := array_append(v_reasons, 'verified_business');
    END IF;
    v_priority := v_priority + v_verified_weight;

    -- Cap at 100
    v_priority := LEAST(v_priority, 100);

    RETURN jsonb_build_object(
        'priority_score', v_priority,
        'reasons', v_reasons,
        'breakdown', jsonb_build_object(
            'base', v_base_priority,
            'content_type', v_content_weight,
            'source', v_source_weight,
            'reports', v_report_weight,
            'ai_confidence', v_ai_weight,
            'violator_history', v_history_weight,
            'content_age', v_age_weight,
            'verified_business', v_verified_weight
        )
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_moderation_priority_v2 IS 'Enhanced priority calculation with detailed breakdown and multiple factors';

-- =================
-- 3. QUEUE MANAGEMENT FUNCTIONS
-- =================

-- Function to claim a queue item for review
CREATE OR REPLACE FUNCTION claim_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
    v_result jsonb;
BEGIN
    -- Attempt to claim the item (only if pending or unassigned)
    UPDATE moderation_queue
    SET
        status = 'in_review',
        assigned_to = p_moderator_id,
        assigned_at = now(),
        updated_at = now()
    WHERE id = p_queue_item_id
      AND (status = 'pending' OR (status = 'in_review' AND assigned_to IS NULL))
    RETURNING * INTO v_item;

    IF v_item IS NULL THEN
        -- Check if item exists and why it couldn't be claimed
        SELECT * INTO v_item FROM moderation_queue WHERE id = p_queue_item_id;

        IF v_item IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'item_not_found',
                'message', 'Queue item not found'
            );
        ELSIF v_item.assigned_to IS NOT NULL AND v_item.assigned_to != p_moderator_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'already_claimed',
                'message', 'Item already claimed by another moderator',
                'assigned_to', v_item.assigned_to,
                'assigned_at', v_item.assigned_at
            );
        ELSIF v_item.status NOT IN ('pending', 'in_review') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'invalid_status',
                'message', 'Item cannot be claimed in current status',
                'current_status', v_item.status
            );
        END IF;
    END IF;

    -- Log the claim action
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        notes
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        'assign',
        p_moderator_id,
        'Item claimed for review'
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'content_type', v_item.content_type,
        'content_id', v_item.content_id,
        'priority_score', v_item.priority_score,
        'claimed_at', now()
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_moderation_item IS 'Atomically claims a queue item for review by a moderator';

-- Function to release a claimed item back to the queue
CREATE OR REPLACE FUNCTION release_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid,
    p_reason text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
BEGIN
    -- Release the item (only if currently assigned to this moderator)
    UPDATE moderation_queue
    SET
        status = 'pending',
        assigned_to = NULL,
        assigned_at = NULL,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND assigned_to = p_moderator_id
      AND status = 'in_review'
    RETURNING * INTO v_item;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'cannot_release',
            'message', 'Item not assigned to you or not in review status'
        );
    END IF;

    -- Log the release action
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        notes
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        'unassign',
        p_moderator_id,
        COALESCE(p_reason, 'Item released back to queue')
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'released_at', now()
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_moderation_item IS 'Releases a claimed item back to the pending queue';

-- Function to resolve a queue item
CREATE OR REPLACE FUNCTION resolve_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid,
    p_action text,
    p_violation_type text DEFAULT NULL,
    p_guideline_code text DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_notify_user boolean DEFAULT true
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
    v_previous_state jsonb;
    v_result jsonb;
BEGIN
    -- Validate action
    IF p_action NOT IN ('approved', 'rejected', 'modified', 'deleted', 'no_action') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_action',
            'message', 'Action must be one of: approved, rejected, modified, deleted, no_action'
        );
    END IF;

    -- Get current item state
    SELECT * INTO v_item FROM moderation_queue WHERE id = p_queue_item_id;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'item_not_found',
            'message', 'Queue item not found'
        );
    END IF;

    IF v_item.assigned_to IS NULL OR v_item.assigned_to != p_moderator_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_assigned',
            'message', 'You must claim this item before resolving it'
        );
    END IF;

    -- Store previous state for audit
    v_previous_state := to_jsonb(v_item);

    -- Update the queue item
    UPDATE moderation_queue
    SET
        status = 'resolved',
        resolution_action = p_action,
        resolution_notes = p_notes,
        resolved_by = p_moderator_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_queue_item_id;

    -- Log the resolution action
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        reason,
        notes,
        previous_state,
        new_state,
        violation_type,
        guideline_ref
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        CASE
            WHEN p_action = 'approved' THEN 'approve'
            WHEN p_action = 'rejected' THEN 'reject'
            WHEN p_action = 'deleted' THEN 'delete'
            ELSE 'resolve'
        END,
        p_moderator_id,
        p_violation_type,
        p_notes,
        v_previous_state,
        jsonb_build_object('status', 'resolved', 'resolution_action', p_action),
        p_violation_type,
        p_guideline_code
    );

    -- Record violation if content was rejected
    IF p_action IN ('rejected', 'deleted') AND p_violation_type IS NOT NULL THEN
        INSERT INTO violation_history (
            violator_type,
            violator_id,
            violation_type,
            guideline_code,
            severity,
            content_type,
            content_id,
            queue_item_id,
            consequence,
            notes,
            created_by
        )
        SELECT
            CASE WHEN v_item.content_type = 'organization' THEN 'organization' ELSE 'user' END,
            CASE
                WHEN v_item.content_type = 'organization' THEN v_item.content_id
                ELSE (v_item.content_snapshot->>'author_user_id')::uuid
            END,
            p_violation_type,
            p_guideline_code,
            COALESCE(
                (SELECT severity FROM moderation_guidelines WHERE code = p_guideline_code),
                'medium'
            ),
            v_item.content_type,
            v_item.content_id,
            p_queue_item_id,
            CASE p_action
                WHEN 'deleted' THEN 'content_removed'
                WHEN 'rejected' THEN 'warning'
                ELSE 'warning'
            END,
            p_notes,
            p_moderator_id
        WHERE (v_item.content_snapshot->>'author_user_id') IS NOT NULL
           OR v_item.content_type = 'organization';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'action', p_action,
        'resolved_at', now(),
        'notify_user', p_notify_user
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resolve_moderation_item IS 'Resolves a queue item with a moderation decision';

-- Function to escalate a queue item
CREATE OR REPLACE FUNCTION escalate_moderation_item(
    p_queue_item_id uuid,
    p_moderator_id uuid,
    p_reason text,
    p_target_level integer DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
    v_new_level integer;
BEGIN
    -- Get current item
    SELECT * INTO v_item FROM moderation_queue WHERE id = p_queue_item_id;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'item_not_found',
            'message', 'Queue item not found'
        );
    END IF;

    -- Calculate new escalation level
    v_new_level := COALESCE(p_target_level, v_item.escalation_level + 1);

    IF v_new_level > 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'max_escalation',
            'message', 'Item is already at maximum escalation level'
        );
    END IF;

    IF v_new_level <= v_item.escalation_level THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_level',
            'message', 'Target escalation level must be higher than current level'
        );
    END IF;

    -- Update the queue item
    UPDATE moderation_queue
    SET
        status = 'escalated',
        escalation_level = v_new_level,
        escalated_by = p_moderator_id,
        escalated_at = now(),
        escalation_reason = p_reason,
        -- Release from current assignee so senior moderator can claim
        assigned_to = NULL,
        assigned_at = NULL,
        -- Boost priority for escalated items
        priority_score = LEAST(priority_score + 15, 100),
        priority_reason = array_append(priority_reason, 'escalated_level_' || v_new_level),
        updated_at = now()
    WHERE id = p_queue_item_id;

    -- Log the escalation
    INSERT INTO moderation_actions (
        queue_item_id,
        content_type,
        content_id,
        action,
        action_by,
        reason,
        notes,
        previous_state,
        new_state
    ) VALUES (
        p_queue_item_id,
        v_item.content_type,
        v_item.content_id,
        'escalate',
        p_moderator_id,
        p_reason,
        'Escalated from level ' || v_item.escalation_level || ' to level ' || v_new_level,
        jsonb_build_object('escalation_level', v_item.escalation_level),
        jsonb_build_object('escalation_level', v_new_level)
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'previous_level', v_item.escalation_level,
        'new_level', v_new_level,
        'escalated_at', now()
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION escalate_moderation_item IS 'Escalates a queue item to a higher review level';

-- Function to get next item from queue for a moderator
CREATE OR REPLACE FUNCTION get_next_moderation_item(
    p_moderator_id uuid,
    p_content_type text DEFAULT NULL,
    p_min_escalation_level integer DEFAULT 0,
    p_max_escalation_level integer DEFAULT 3
) RETURNS jsonb AS $$
DECLARE
    v_item moderation_queue;
BEGIN
    -- Find and claim the highest priority pending item
    SELECT * INTO v_item
    FROM moderation_queue
    WHERE status IN ('pending', 'escalated')
      AND (assigned_to IS NULL)
      AND (p_content_type IS NULL OR content_type = p_content_type)
      AND escalation_level >= p_min_escalation_level
      AND escalation_level <= p_max_escalation_level
    ORDER BY
        CASE WHEN status = 'escalated' THEN 0 ELSE 1 END, -- Escalated items first
        priority_score DESC,
        created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'no_items',
            'message', 'No pending items available'
        );
    END IF;

    -- Claim the item
    RETURN claim_moderation_item(v_item.id, p_moderator_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_moderation_item IS 'Gets and claims the next highest priority item for a moderator';

-- =================
-- 4. ADDITIONAL INDEXES FOR QUEUE QUERIES
-- =================

-- Index for efficient queue fetching by moderator workload
CREATE INDEX IF NOT EXISTS idx_moderation_queue_escalation
    ON moderation_queue(escalation_level, priority_score DESC)
    WHERE status IN ('pending', 'escalated');

-- Index for moderator assignment tracking
CREATE INDEX IF NOT EXISTS idx_moderation_queue_moderator_active
    ON moderation_queue(assigned_to, updated_at DESC)
    WHERE status = 'in_review';

-- Index for content lookup with status
CREATE INDEX IF NOT EXISTS idx_moderation_queue_content_status
    ON moderation_queue(content_type, content_id, status);

-- Index for time-based queries (SLA tracking)
CREATE INDEX IF NOT EXISTS idx_moderation_queue_created_pending
    ON moderation_queue(created_at)
    WHERE status IN ('pending', 'in_review', 'escalated');

-- Index for resolved items by date (reporting)
CREATE INDEX IF NOT EXISTS idx_moderation_queue_resolved_date
    ON moderation_queue(resolved_at DESC)
    WHERE status = 'resolved';

-- =================
-- 5. QUEUE STATISTICS VIEW
-- =================

CREATE OR REPLACE VIEW moderation_queue_stats AS
SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'in_review') as in_review_count,
    COUNT(*) FILTER (WHERE status = 'escalated') as escalated_count,
    COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at > now() - interval '24 hours') as resolved_today,
    COUNT(*) FILTER (WHERE status IN ('pending', 'escalated') AND created_at < now() - interval '24 hours') as overdue_count,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
        FILTER (WHERE status = 'resolved' AND resolved_at > now() - interval '7 days') as avg_resolution_hours_7d,
    COUNT(*) FILTER (WHERE escalation_level >= 2) as high_escalation_count,
    (SELECT jsonb_object_agg(content_type, cnt) FROM (
        SELECT content_type, COUNT(*) as cnt
        FROM moderation_queue
        WHERE status IN ('pending', 'in_review', 'escalated')
        GROUP BY content_type
    ) sub) as pending_by_type
FROM moderation_queue;

COMMENT ON VIEW moderation_queue_stats IS 'Real-time statistics for the moderation queue';

-- =================
-- 6. UPDATE TRIGGER FOR TIMESTAMP
-- =================

CREATE OR REPLACE FUNCTION update_moderation_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_moderation_queue_updated ON moderation_queue;
CREATE TRIGGER trg_moderation_queue_updated
    BEFORE UPDATE ON moderation_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_moderation_queue_timestamp();

-- =================
-- COMMENTS
-- =================

COMMENT ON TYPE moderation_content_type IS 'Types of content that can be moderated';
COMMENT ON TYPE moderation_queue_status IS 'Workflow statuses for moderation queue items';
COMMENT ON TYPE moderation_source IS 'Sources that can trigger moderation review';
COMMENT ON TYPE moderation_resolution_action IS 'Actions that can be taken when resolving moderation';
