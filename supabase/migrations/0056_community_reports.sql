-- =====================================================
-- Community Reports Enhancement
-- Migration 0056
-- =====================================================
-- Extends the content_reports table with:
-- - Report reason enum type
-- - Enhanced report handling workflow
-- - Duplicate report detection
-- - Reporter reputation tracking
-- - Report aggregation functions

SET client_encoding = 'UTF8';

-- =================
-- 1. ENUM TYPES FOR REPORTS
-- =================

DO $$
BEGIN
    -- Report reason enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
        CREATE TYPE report_reason AS ENUM (
            'fake_business',
            'misleading_claims',
            'counterfeit_cert',
            'offensive_content',
            'spam',
            'competitor_sabotage',
            'copyright',
            'privacy_violation',
            'fraud',
            'illegal_content',
            'duplicate_listing',
            'wrong_category',
            'outdated_info',
            'other'
        );
    END IF;

    -- Report status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE report_status AS ENUM (
            'new',
            'reviewing',
            'valid',
            'invalid',
            'duplicate',
            'merged',
            'resolved'
        );
    END IF;

    -- Report priority enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_priority') THEN
        CREATE TYPE report_priority AS ENUM (
            'low',
            'medium',
            'high',
            'critical'
        );
    END IF;
END $$;

-- =================
-- 2. REPORTER REPUTATION TABLE
-- =================
-- Tracks the accuracy of reporters to weight their reports

CREATE TABLE IF NOT EXISTS reporter_reputation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Report statistics
    total_reports integer NOT NULL DEFAULT 0,
    valid_reports integer NOT NULL DEFAULT 0,
    invalid_reports integer NOT NULL DEFAULT 0,
    pending_reports integer NOT NULL DEFAULT 0,

    -- Reputation score (0-100, based on accuracy)
    reputation_score integer NOT NULL DEFAULT 50,

    -- Status
    is_trusted boolean NOT NULL DEFAULT false, -- High accuracy reporters
    is_flagged boolean NOT NULL DEFAULT false, -- Potentially abusive reporters
    flagged_reason text,
    flagged_at timestamptz,
    flagged_by uuid REFERENCES auth.users(id),

    -- Rate limiting
    reports_today integer NOT NULL DEFAULT 0,
    reports_this_week integer NOT NULL DEFAULT 0,
    last_report_at timestamptz,
    daily_limit integer NOT NULL DEFAULT 10,
    weekly_limit integer NOT NULL DEFAULT 50,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT unique_reporter UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_reporter_reputation_user
    ON reporter_reputation(user_id);

CREATE INDEX IF NOT EXISTS idx_reporter_reputation_score
    ON reporter_reputation(reputation_score DESC)
    WHERE NOT is_flagged;

CREATE INDEX IF NOT EXISTS idx_reporter_reputation_trusted
    ON reporter_reputation(is_trusted)
    WHERE is_trusted = true;

-- =================
-- 3. ENHANCE CONTENT_REPORTS TABLE
-- =================

-- Add new columns to existing content_reports table
ALTER TABLE content_reports
    ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    ADD COLUMN IF NOT EXISTS reporter_reputation_at_report integer,
    ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS merged_into_report_id uuid REFERENCES content_reports(id),
    ADD COLUMN IF NOT EXISTS duplicate_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS first_reported_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_duplicate_at timestamptz,
    ADD COLUMN IF NOT EXISTS auto_escalated boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS escalation_reason text,
    ADD COLUMN IF NOT EXISTS resolution_type text CHECK (resolution_type IN (
        'content_removed', 'content_modified', 'no_violation', 'false_report', 'insufficient_evidence'
    )),
    ADD COLUMN IF NOT EXISTS feedback_sent boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_content_reports_content_reason
    ON content_reports(content_type, content_id, reason)
    WHERE status NOT IN ('resolved', 'invalid', 'duplicate');

-- Add index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_content_reports_priority
    ON content_reports(priority DESC, created_at)
    WHERE status = 'new';

-- Add index for reporter lookup
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_date
    ON content_reports(reporter_user_id, created_at DESC);

-- =================
-- 4. REPORT HANDLING FUNCTIONS
-- =================

-- Function to create a report with duplicate detection
CREATE OR REPLACE FUNCTION create_content_report(
    p_content_type text,
    p_content_id uuid,
    p_reporter_user_id uuid,
    p_reason text,
    p_reason_details text DEFAULT NULL,
    p_evidence_urls text[] DEFAULT ARRAY[]::text[],
    p_is_anonymous boolean DEFAULT false,
    p_reporter_ip text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_report_id uuid;
    v_existing_report_id uuid;
    v_reporter_rep reporter_reputation;
    v_priority text;
    v_queue_id uuid;
    v_cooldown_check timestamptz;
BEGIN
    -- Get or create reporter reputation
    INSERT INTO reporter_reputation (user_id)
    VALUES (p_reporter_user_id)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_reporter_rep;

    -- Check rate limiting
    IF v_reporter_rep.reports_today >= v_reporter_rep.daily_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'daily_limit_reached',
            'message', 'You have reached your daily report limit. Please try again tomorrow.',
            'limit', v_reporter_rep.daily_limit
        );
    END IF;

    IF v_reporter_rep.reports_this_week >= v_reporter_rep.weekly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'weekly_limit_reached',
            'message', 'You have reached your weekly report limit.',
            'limit', v_reporter_rep.weekly_limit
        );
    END IF;

    -- Check if reporter is flagged
    IF v_reporter_rep.is_flagged THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'reporter_flagged',
            'message', 'Your reporting privileges have been restricted.'
        );
    END IF;

    -- Check 24-hour cooldown for same content/reason from same user
    v_cooldown_check := now() - interval '24 hours';
    SELECT id INTO v_existing_report_id
    FROM content_reports
    WHERE content_type = p_content_type
      AND content_id = p_content_id
      AND reporter_user_id = p_reporter_user_id
      AND reason = p_reason
      AND created_at > v_cooldown_check;

    IF v_existing_report_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'duplicate_report',
            'message', 'You have already reported this content for this reason within the last 24 hours.',
            'existing_report_id', v_existing_report_id
        );
    END IF;

    -- Check for existing reports from other users (for merging)
    SELECT id INTO v_existing_report_id
    FROM content_reports
    WHERE content_type = p_content_type
      AND content_id = p_content_id
      AND reason = p_reason
      AND status NOT IN ('resolved', 'invalid', 'duplicate')
      AND merged_into_report_id IS NULL
    ORDER BY created_at
    LIMIT 1;

    -- Calculate priority based on reason and reporter reputation
    v_priority := CASE
        WHEN p_reason IN ('counterfeit_cert', 'illegal_content', 'fraud') THEN 'critical'
        WHEN p_reason IN ('fake_business', 'privacy_violation', 'copyright') THEN 'high'
        WHEN p_reason IN ('misleading_claims', 'competitor_sabotage', 'offensive_content') THEN 'medium'
        ELSE 'low'
    END;

    -- Boost priority for trusted reporters
    IF v_reporter_rep.is_trusted AND v_priority != 'critical' THEN
        v_priority := CASE v_priority
            WHEN 'high' THEN 'critical'
            WHEN 'medium' THEN 'high'
            WHEN 'low' THEN 'medium'
            ELSE v_priority
        END;
    END IF;

    IF v_existing_report_id IS NOT NULL THEN
        -- Merge with existing report
        UPDATE content_reports
        SET
            duplicate_count = duplicate_count + 1,
            last_duplicate_at = now(),
            -- Escalate priority if multiple reports
            priority = CASE
                WHEN duplicate_count >= 5 THEN 'critical'
                WHEN duplicate_count >= 3 THEN 'high'
                ELSE priority
            END,
            auto_escalated = CASE WHEN duplicate_count >= 3 THEN true ELSE auto_escalated END,
            escalation_reason = CASE
                WHEN duplicate_count >= 3 THEN 'Multiple independent reports'
                ELSE escalation_reason
            END,
            updated_at = now()
        WHERE id = v_existing_report_id;

        -- Create the new report as a duplicate pointing to the original
        INSERT INTO content_reports (
            content_type, content_id, reporter_user_id, reporter_ip,
            reason, reason_details, evidence_urls,
            status, priority, is_anonymous,
            merged_into_report_id, reporter_reputation_at_report
        ) VALUES (
            p_content_type, p_content_id, p_reporter_user_id, p_reporter_ip,
            p_reason, p_reason_details, p_evidence_urls,
            'merged', v_priority, p_is_anonymous,
            v_existing_report_id, v_reporter_rep.reputation_score
        )
        RETURNING id INTO v_report_id;

        -- Update reporter stats
        UPDATE reporter_reputation
        SET
            reports_today = reports_today + 1,
            reports_this_week = reports_this_week + 1,
            pending_reports = pending_reports + 1,
            last_report_at = now(),
            updated_at = now()
        WHERE user_id = p_reporter_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'report_id', v_report_id,
            'merged_into', v_existing_report_id,
            'message', 'Your report has been added to an existing investigation.',
            'total_reports_for_content', (SELECT duplicate_count + 1 FROM content_reports WHERE id = v_existing_report_id)
        );
    ELSE
        -- Create new primary report
        INSERT INTO content_reports (
            content_type, content_id, reporter_user_id, reporter_ip,
            reason, reason_details, evidence_urls,
            status, priority, is_anonymous,
            first_reported_at, reporter_reputation_at_report
        ) VALUES (
            p_content_type, p_content_id, p_reporter_user_id, p_reporter_ip,
            p_reason, p_reason_details, p_evidence_urls,
            'new', v_priority, p_is_anonymous,
            now(), v_reporter_rep.reputation_score
        )
        RETURNING id INTO v_report_id;

        -- Create moderation queue item
        v_queue_id := add_to_moderation_queue(
            p_content_type,
            p_content_id,
            'user_report',
            jsonb_build_object('report_id', v_report_id, 'reason', p_reason),
            CASE v_priority
                WHEN 'critical' THEN 0.9
                WHEN 'high' THEN 0.7
                WHEN 'medium' THEN 0.5
                ELSE 0.3
            END,
            ARRAY['user_report:' || p_reason]
        );

        -- Link report to queue item
        UPDATE content_reports
        SET linked_queue_item = v_queue_id
        WHERE id = v_report_id;

        -- Update reporter stats
        UPDATE reporter_reputation
        SET
            total_reports = total_reports + 1,
            reports_today = reports_today + 1,
            reports_this_week = reports_this_week + 1,
            pending_reports = pending_reports + 1,
            last_report_at = now(),
            updated_at = now()
        WHERE user_id = p_reporter_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'report_id', v_report_id,
            'queue_item_id', v_queue_id,
            'priority', v_priority,
            'message', 'Thank you for your report. Our team will review it.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_content_report IS 'Creates a content report with duplicate detection and reporter rate limiting';

-- Function to resolve a report and update reporter reputation
CREATE OR REPLACE FUNCTION resolve_content_report(
    p_report_id uuid,
    p_moderator_id uuid,
    p_status text, -- 'valid' or 'invalid'
    p_resolution_type text,
    p_notes text DEFAULT NULL,
    p_send_feedback boolean DEFAULT true
) RETURNS jsonb AS $$
DECLARE
    v_report content_reports;
    v_reputation_change integer;
    v_merged_reports uuid[];
BEGIN
    -- Validate status
    IF p_status NOT IN ('valid', 'invalid') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_status',
            'message', 'Status must be valid or invalid'
        );
    END IF;

    -- Get the report
    SELECT * INTO v_report FROM content_reports WHERE id = p_report_id;

    IF v_report IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'report_not_found'
        );
    END IF;

    -- Update the primary report
    UPDATE content_reports
    SET
        status = p_status,
        resolution_type = p_resolution_type,
        reviewed_by = p_moderator_id,
        reviewed_at = now(),
        review_notes = p_notes,
        feedback_sent = p_send_feedback,
        feedback_sent_at = CASE WHEN p_send_feedback THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_report_id;

    -- Get all merged reports
    SELECT array_agg(id) INTO v_merged_reports
    FROM content_reports
    WHERE merged_into_report_id = p_report_id;

    -- Update all merged reports
    IF v_merged_reports IS NOT NULL THEN
        UPDATE content_reports
        SET
            status = 'resolved',
            resolution_type = p_resolution_type,
            reviewed_by = p_moderator_id,
            reviewed_at = now(),
            review_notes = 'Resolved as part of merged report ' || p_report_id,
            updated_at = now()
        WHERE id = ANY(v_merged_reports);
    END IF;

    -- Calculate reputation change
    v_reputation_change := CASE
        WHEN p_status = 'valid' THEN 5 -- Reward valid reports
        WHEN p_status = 'invalid' THEN -3 -- Penalize invalid reports
        ELSE 0
    END;

    -- Update primary reporter reputation
    UPDATE reporter_reputation
    SET
        valid_reports = valid_reports + CASE WHEN p_status = 'valid' THEN 1 ELSE 0 END,
        invalid_reports = invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END,
        pending_reports = GREATEST(0, pending_reports - 1),
        reputation_score = LEAST(100, GREATEST(0, reputation_score + v_reputation_change)),
        is_trusted = CASE
            WHEN reputation_score + v_reputation_change >= 80
                 AND valid_reports + CASE WHEN p_status = 'valid' THEN 1 ELSE 0 END >= 10
            THEN true
            ELSE is_trusted
        END,
        is_flagged = CASE
            WHEN reputation_score + v_reputation_change <= 20
                 AND invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END >= 5
            THEN true
            ELSE is_flagged
        END,
        flagged_reason = CASE
            WHEN reputation_score + v_reputation_change <= 20
                 AND invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END >= 5
            THEN 'High rate of invalid reports'
            ELSE flagged_reason
        END,
        flagged_at = CASE
            WHEN reputation_score + v_reputation_change <= 20
                 AND invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END >= 5
            THEN now()
            ELSE flagged_at
        END,
        updated_at = now()
    WHERE user_id = v_report.reporter_user_id;

    -- Update merged reporters (smaller reputation change)
    IF v_merged_reports IS NOT NULL THEN
        UPDATE reporter_reputation rr
        SET
            valid_reports = valid_reports + CASE WHEN p_status = 'valid' THEN 1 ELSE 0 END,
            invalid_reports = invalid_reports + CASE WHEN p_status = 'invalid' THEN 1 ELSE 0 END,
            pending_reports = GREATEST(0, pending_reports - 1),
            reputation_score = LEAST(100, GREATEST(0, reputation_score + (v_reputation_change / 2))),
            updated_at = now()
        FROM content_reports cr
        WHERE cr.id = ANY(v_merged_reports)
          AND cr.reporter_user_id = rr.user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'report_id', p_report_id,
        'status', p_status,
        'resolution_type', p_resolution_type,
        'merged_reports_resolved', COALESCE(array_length(v_merged_reports, 1), 0),
        'feedback_sent', p_send_feedback
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resolve_content_report IS 'Resolves a content report and updates reporter reputation';

-- Function to get reports for content
CREATE OR REPLACE FUNCTION get_content_reports(
    p_content_type text,
    p_content_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total_reports', COUNT(*),
        'unique_reporters', COUNT(DISTINCT reporter_user_id),
        'first_reported', MIN(first_reported_at),
        'last_reported', MAX(GREATEST(created_at, last_duplicate_at)),
        'status_summary', jsonb_object_agg(status, status_count),
        'reason_summary', jsonb_object_agg(reason, reason_count),
        'highest_priority', MAX(CASE priority
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            ELSE 1
        END),
        'auto_escalated', bool_or(auto_escalated)
    ) INTO v_result
    FROM (
        SELECT
            status,
            reason,
            first_reported_at,
            created_at,
            last_duplicate_at,
            reporter_user_id,
            priority,
            auto_escalated,
            COUNT(*) OVER (PARTITION BY status) as status_count,
            COUNT(*) OVER (PARTITION BY reason) as reason_count
        FROM content_reports
        WHERE content_type = p_content_type
          AND content_id = p_content_id
          AND merged_into_report_id IS NULL
    ) sub;

    RETURN COALESCE(v_result, jsonb_build_object('total_reports', 0));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_content_reports IS 'Gets aggregated report information for a piece of content';

-- =================
-- 5. DAILY RESET FUNCTION
-- =================

-- Function to reset daily/weekly report counters
CREATE OR REPLACE FUNCTION reset_reporter_counters()
RETURNS void AS $$
BEGIN
    -- Reset daily counters at midnight
    UPDATE reporter_reputation
    SET
        reports_today = 0,
        updated_at = now()
    WHERE reports_today > 0;

    -- Reset weekly counters on Monday
    IF EXTRACT(DOW FROM now()) = 1 THEN
        UPDATE reporter_reputation
        SET
            reports_this_week = 0,
            updated_at = now()
        WHERE reports_this_week > 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_reporter_counters IS 'Resets daily and weekly report counters (run via cron)';

-- =================
-- 6. REPORT STATISTICS VIEW
-- =================

CREATE OR REPLACE VIEW content_report_stats AS
SELECT
    COUNT(*) FILTER (WHERE status = 'new') as new_reports,
    COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing_reports,
    COUNT(*) FILTER (WHERE status = 'valid') as valid_reports,
    COUNT(*) FILTER (WHERE status = 'invalid') as invalid_reports,
    COUNT(*) FILTER (WHERE auto_escalated) as auto_escalated_reports,
    COUNT(*) FILTER (WHERE priority = 'critical' AND status = 'new') as critical_pending,
    COUNT(*) FILTER (WHERE priority = 'high' AND status = 'new') as high_pending,
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') as reports_today,
    COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') as reports_this_week,
    AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600)
        FILTER (WHERE reviewed_at IS NOT NULL AND created_at > now() - interval '7 days')
        as avg_resolution_hours_7d,
    jsonb_object_agg(reason, reason_count) as reports_by_reason
FROM (
    SELECT
        status, priority, auto_escalated, created_at, reviewed_at, reason,
        COUNT(*) OVER (PARTITION BY reason) as reason_count
    FROM content_reports
    WHERE merged_into_report_id IS NULL
) sub;

COMMENT ON VIEW content_report_stats IS 'Real-time statistics for content reports';

-- =================
-- 7. ROW LEVEL SECURITY
-- =================

ALTER TABLE reporter_reputation ENABLE ROW LEVEL SECURITY;

-- Users can view their own reputation
CREATE POLICY "Users view own reputation" ON reporter_reputation
    FOR SELECT USING (user_id = auth.uid());

-- Moderators can view all reputations
CREATE POLICY "Moderators view all reputations" ON reporter_reputation
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Moderators can update reputations (for flagging)
CREATE POLICY "Moderators manage reputations" ON reporter_reputation
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Service role can manage all
CREATE POLICY "Service role manages reputations" ON reporter_reputation
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- =================
-- 8. TRIGGER FOR UPDATED_AT
-- =================

CREATE OR REPLACE FUNCTION update_content_reports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_reports_updated ON content_reports;
CREATE TRIGGER trg_content_reports_updated
    BEFORE UPDATE ON content_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_content_reports_timestamp();

DROP TRIGGER IF EXISTS trg_reporter_reputation_updated ON reporter_reputation;
CREATE TRIGGER trg_reporter_reputation_updated
    BEFORE UPDATE ON reporter_reputation
    FOR EACH ROW
    EXECUTE FUNCTION update_content_reports_timestamp();

-- =================
-- COMMENTS
-- =================

COMMENT ON TABLE reporter_reputation IS 'Tracks reporter accuracy and rate limiting';
COMMENT ON TYPE report_reason IS 'Reasons users can select when reporting content';
COMMENT ON TYPE report_status IS 'Workflow statuses for content reports';
COMMENT ON TYPE report_priority IS 'Priority levels for content reports';
COMMENT ON COLUMN content_reports.merged_into_report_id IS 'If set, this report was merged into another report';
COMMENT ON COLUMN content_reports.duplicate_count IS 'Number of duplicate reports merged into this one';
COMMENT ON COLUMN reporter_reputation.is_trusted IS 'High-accuracy reporters get priority handling';
COMMENT ON COLUMN reporter_reputation.is_flagged IS 'Reporters with many invalid reports get restricted';
