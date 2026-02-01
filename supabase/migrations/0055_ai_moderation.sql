-- =====================================================
-- AI Moderation System Enhancement
-- Migration 0055
-- =====================================================
-- Extends the existing AI moderation system with:
-- - Pattern type enums
-- - AI moderation results table for tracking runs
-- - Enhanced pattern matching functions
-- - Performance tracking and pattern effectiveness metrics

SET client_encoding = 'UTF8';

-- =================
-- 1. ENUM TYPES FOR AI MODERATION
-- =================

DO $$
BEGIN
    -- Pattern type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_pattern_type') THEN
        CREATE TYPE ai_pattern_type AS ENUM (
            'text_regex',
            'text_keywords',
            'image_hash',
            'document_fingerprint',
            'behavioral',
            'ml_model',
            'semantic_similarity'
        );
    END IF;

    -- Detection category enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_detection_category') THEN
        CREATE TYPE ai_detection_category AS ENUM (
            'fake_business',
            'misleading_health_claim',
            'counterfeit_cert',
            'offensive_content',
            'spam',
            'competitor_attack',
            'suspicious_pattern',
            'copyright_violation',
            'privacy_violation',
            'fraud_indicator'
        );
    END IF;

    -- AI action enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_moderation_action') THEN
        CREATE TYPE ai_moderation_action AS ENUM (
            'flag_for_review',
            'auto_reject',
            'increase_priority',
            'notify_admin',
            'quarantine',
            'allow_with_warning'
        );
    END IF;

    -- Moderation run status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_run_status') THEN
        CREATE TYPE ai_run_status AS ENUM (
            'pending',
            'running',
            'completed',
            'failed',
            'timeout'
        );
    END IF;
END $$;

-- =================
-- 2. AI MODERATION RESULTS TABLE
-- =================
-- Stores results from each AI moderation run

CREATE TABLE IF NOT EXISTS ai_moderation_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Content being analyzed
    content_type text NOT NULL,
    content_id uuid NOT NULL,

    -- Run metadata
    run_status text NOT NULL DEFAULT 'pending' CHECK (run_status IN (
        'pending', 'running', 'completed', 'failed', 'timeout'
    )),
    started_at timestamptz,
    completed_at timestamptz,
    duration_ms integer,

    -- Analysis results
    overall_confidence numeric(4,3) CHECK (overall_confidence BETWEEN 0 AND 1),
    overall_recommendation text CHECK (overall_recommendation IN (
        'approve', 'review', 'reject', 'escalate'
    )),

    -- Pattern matches (array of matched patterns)
    matched_patterns jsonb DEFAULT '[]',
    -- Structure: [{ pattern_id, pattern_name, confidence, match_details, action }]

    -- Risk assessment
    risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
    risk_factors jsonb DEFAULT '[]',
    -- Structure: [{ factor, weight, description }]

    -- Text analysis results (if applicable)
    text_analysis jsonb,
    -- Structure: { sentiment, toxicity_score, keywords_found, language }

    -- Image analysis results (if applicable)
    image_analysis jsonb,
    -- Structure: { nsfw_score, manipulation_detected, similar_images }

    -- Document analysis results (if applicable)
    document_analysis jsonb,
    -- Structure: { authenticity_score, format_issues, metadata_anomalies }

    -- Behavioral analysis results (if applicable)
    behavioral_analysis jsonb,
    -- Structure: { patterns_detected, anomaly_score, timeline }

    -- Processing info
    processor_version text,
    processing_node text,
    error_message text,

    -- Link to queue item if flagged
    queue_item_id uuid REFERENCES moderation_queue(id),

    created_at timestamptz NOT NULL DEFAULT now(),

    -- Index for finding results by content
    CONSTRAINT unique_ai_result_per_run UNIQUE (content_type, content_id, created_at)
);

-- Indexes for AI results
CREATE INDEX IF NOT EXISTS idx_ai_results_content
    ON ai_moderation_results(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_ai_results_status
    ON ai_moderation_results(run_status)
    WHERE run_status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_ai_results_recommendation
    ON ai_moderation_results(overall_recommendation, created_at DESC)
    WHERE overall_recommendation IN ('reject', 'escalate');

CREATE INDEX IF NOT EXISTS idx_ai_results_risk
    ON ai_moderation_results(risk_score DESC)
    WHERE risk_score >= 70;

CREATE INDEX IF NOT EXISTS idx_ai_results_queue
    ON ai_moderation_results(queue_item_id)
    WHERE queue_item_id IS NOT NULL;

-- =================
-- 3. PATTERN EFFECTIVENESS TRACKING
-- =================
-- Add columns to track pattern performance over time

ALTER TABLE ai_moderation_patterns
    ADD COLUMN IF NOT EXISTS last_match_at timestamptz,
    ADD COLUMN IF NOT EXISTS effectiveness_score numeric(4,3) DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS auto_disable_threshold integer DEFAULT 10,
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS test_content text[]; -- Sample content for testing the pattern

-- =================
-- 4. AI PATTERN MATCH DETAILS TABLE
-- =================
-- Detailed record of each pattern match for analysis

CREATE TABLE IF NOT EXISTS ai_pattern_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to AI result
    ai_result_id uuid NOT NULL REFERENCES ai_moderation_results(id) ON DELETE CASCADE,

    -- Pattern that matched
    pattern_id uuid NOT NULL REFERENCES ai_moderation_patterns(id),

    -- Match details
    confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    match_location jsonb, -- { start, end, field, context }
    match_content text, -- The actual content that matched
    match_context text, -- Surrounding context

    -- Outcome tracking (filled in after moderation decision)
    was_true_positive boolean,
    feedback_by uuid REFERENCES auth.users(id),
    feedback_at timestamptz,
    feedback_notes text,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_matches_result
    ON ai_pattern_matches(ai_result_id);

CREATE INDEX IF NOT EXISTS idx_pattern_matches_pattern
    ON ai_pattern_matches(pattern_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_matches_feedback
    ON ai_pattern_matches(pattern_id, was_true_positive)
    WHERE was_true_positive IS NOT NULL;

-- =================
-- 5. FUNCTIONS FOR AI MODERATION
-- =================

-- Function to run AI moderation on content
CREATE OR REPLACE FUNCTION initiate_ai_moderation(
    p_content_type text,
    p_content_id uuid,
    p_content_data jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_result_id uuid;
BEGIN
    -- Create a pending AI moderation result
    INSERT INTO ai_moderation_results (
        content_type,
        content_id,
        run_status,
        started_at
    ) VALUES (
        p_content_type,
        p_content_id,
        'pending',
        now()
    )
    RETURNING id INTO v_result_id;

    -- Note: Actual AI processing would be triggered by a background worker
    -- that picks up pending results and processes them

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initiate_ai_moderation IS 'Creates a pending AI moderation request for background processing';

-- Function to complete AI moderation with results
CREATE OR REPLACE FUNCTION complete_ai_moderation(
    p_result_id uuid,
    p_overall_confidence numeric,
    p_recommendation text,
    p_risk_score integer,
    p_matched_patterns jsonb,
    p_risk_factors jsonb DEFAULT '[]',
    p_text_analysis jsonb DEFAULT NULL,
    p_image_analysis jsonb DEFAULT NULL,
    p_document_analysis jsonb DEFAULT NULL,
    p_processor_version text DEFAULT '1.0'
) RETURNS jsonb AS $$
DECLARE
    v_result ai_moderation_results;
    v_queue_id uuid;
    v_pattern jsonb;
    v_pattern_record RECORD;
BEGIN
    -- Update the AI result
    UPDATE ai_moderation_results
    SET
        run_status = 'completed',
        completed_at = now(),
        duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
        overall_confidence = p_overall_confidence,
        overall_recommendation = p_recommendation,
        risk_score = p_risk_score,
        matched_patterns = p_matched_patterns,
        risk_factors = p_risk_factors,
        text_analysis = p_text_analysis,
        image_analysis = p_image_analysis,
        document_analysis = p_document_analysis,
        processor_version = p_processor_version
    WHERE id = p_result_id
    RETURNING * INTO v_result;

    IF v_result IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'result_not_found'
        );
    END IF;

    -- Record individual pattern matches
    FOR v_pattern IN SELECT * FROM jsonb_array_elements(p_matched_patterns)
    LOOP
        INSERT INTO ai_pattern_matches (
            ai_result_id,
            pattern_id,
            confidence,
            match_location,
            match_content
        ) VALUES (
            p_result_id,
            (v_pattern->>'pattern_id')::uuid,
            (v_pattern->>'confidence')::numeric,
            v_pattern->'match_location',
            v_pattern->>'match_content'
        );

        -- Update pattern statistics
        UPDATE ai_moderation_patterns
        SET
            match_count = match_count + 1,
            last_match_at = now()
        WHERE id = (v_pattern->>'pattern_id')::uuid;
    END LOOP;

    -- If recommendation is review/reject/escalate, create queue item
    IF p_recommendation IN ('review', 'reject', 'escalate') THEN
        v_queue_id := add_to_moderation_queue(
            v_result.content_type,
            v_result.content_id,
            'auto_flag',
            p_matched_patterns,
            p_overall_confidence,
            ARRAY(SELECT value->>'factor' FROM jsonb_array_elements(p_risk_factors) AS value)
        );

        -- Link result to queue item
        UPDATE ai_moderation_results
        SET queue_item_id = v_queue_id
        WHERE id = p_result_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'result_id', p_result_id,
        'recommendation', p_recommendation,
        'risk_score', p_risk_score,
        'queue_item_id', v_queue_id,
        'patterns_matched', jsonb_array_length(p_matched_patterns)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_ai_moderation IS 'Records completed AI moderation results and triggers queue item creation if needed';

-- Function to update pattern effectiveness based on moderation feedback
CREATE OR REPLACE FUNCTION update_pattern_effectiveness(
    p_pattern_id uuid
) RETURNS void AS $$
DECLARE
    v_stats RECORD;
BEGIN
    -- Calculate effectiveness from recent matches
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE was_true_positive = true) as true_positives,
        COUNT(*) FILTER (WHERE was_true_positive = false) as false_positives,
        COUNT(*) FILTER (WHERE was_true_positive IS NOT NULL) as reviewed
    INTO v_stats
    FROM ai_pattern_matches
    WHERE pattern_id = p_pattern_id
      AND created_at > now() - interval '30 days';

    -- Update pattern effectiveness score
    IF v_stats.reviewed > 0 THEN
        UPDATE ai_moderation_patterns
        SET
            effectiveness_score = v_stats.true_positives::numeric / v_stats.reviewed,
            true_positive_count = COALESCE(true_positive_count, 0) +
                (v_stats.true_positives - COALESCE((
                    SELECT SUM(CASE WHEN was_true_positive THEN 1 ELSE 0 END)
                    FROM ai_pattern_matches
                    WHERE pattern_id = p_pattern_id
                      AND created_at <= now() - interval '30 days'
                ), 0)),
            false_positive_count = COALESCE(false_positive_count, 0) +
                (v_stats.false_positives - COALESCE((
                    SELECT SUM(CASE WHEN NOT was_true_positive THEN 1 ELSE 0 END)
                    FROM ai_pattern_matches
                    WHERE pattern_id = p_pattern_id
                      AND created_at <= now() - interval '30 days'
                ), 0)),
            review_count = v_stats.reviewed,
            last_reviewed_at = now(),
            updated_at = now()
        WHERE id = p_pattern_id;

        -- Auto-disable patterns with poor effectiveness
        UPDATE ai_moderation_patterns
        SET
            is_active = false,
            updated_at = now()
        WHERE id = p_pattern_id
          AND effectiveness_score < 0.3
          AND review_count >= auto_disable_threshold;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_pattern_effectiveness IS 'Updates pattern effectiveness score based on moderation feedback';

-- Function to provide feedback on a pattern match
CREATE OR REPLACE FUNCTION provide_pattern_feedback(
    p_match_id uuid,
    p_was_true_positive boolean,
    p_feedback_by uuid,
    p_notes text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_match ai_pattern_matches;
BEGIN
    -- Update the match with feedback
    UPDATE ai_pattern_matches
    SET
        was_true_positive = p_was_true_positive,
        feedback_by = p_feedback_by,
        feedback_at = now(),
        feedback_notes = p_notes
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    IF v_match IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'match_not_found'
        );
    END IF;

    -- Update pattern effectiveness
    PERFORM update_pattern_effectiveness(v_match.pattern_id);

    RETURN jsonb_build_object(
        'success', true,
        'match_id', p_match_id,
        'pattern_id', v_match.pattern_id,
        'was_true_positive', p_was_true_positive
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION provide_pattern_feedback IS 'Records moderator feedback on whether a pattern match was correct';

-- =================
-- 6. AI MODERATION PATTERNS VIEW
-- =================

CREATE OR REPLACE VIEW ai_pattern_effectiveness AS
SELECT
    p.id,
    p.name,
    p.pattern_type,
    p.detects,
    p.is_active,
    p.match_count,
    p.true_positive_count,
    p.false_positive_count,
    p.effectiveness_score,
    p.last_match_at,
    p.last_reviewed_at,
    CASE
        WHEN p.effectiveness_score >= 0.8 THEN 'excellent'
        WHEN p.effectiveness_score >= 0.6 THEN 'good'
        WHEN p.effectiveness_score >= 0.4 THEN 'moderate'
        WHEN p.effectiveness_score >= 0.2 THEN 'poor'
        ELSE 'very_poor'
    END as effectiveness_rating,
    CASE
        WHEN NOT p.is_active THEN 'disabled'
        WHEN p.match_count = 0 THEN 'no_matches'
        WHEN p.effectiveness_score < 0.3 AND p.review_count >= p.auto_disable_threshold THEN 'at_risk'
        ELSE 'active'
    END as status,
    p.created_at,
    p.updated_at
FROM ai_moderation_patterns p;

COMMENT ON VIEW ai_pattern_effectiveness IS 'Shows AI pattern performance metrics and effectiveness ratings';

-- =================
-- 7. ROW LEVEL SECURITY
-- =================

ALTER TABLE ai_moderation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pattern_matches ENABLE ROW LEVEL SECURITY;

-- Moderators can view AI results
CREATE POLICY "Moderators view AI results" ON ai_moderation_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Service role can manage AI results
CREATE POLICY "Service role manages AI results" ON ai_moderation_results
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Moderators can view pattern matches
CREATE POLICY "Moderators view pattern matches" ON ai_pattern_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Moderators can provide feedback on pattern matches
CREATE POLICY "Moderators provide pattern feedback" ON ai_pattern_matches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Service role can manage pattern matches
CREATE POLICY "Service role manages pattern matches" ON ai_pattern_matches
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- =================
-- 8. SEED ADDITIONAL AI PATTERNS
-- =================

INSERT INTO ai_moderation_patterns (name, pattern_type, pattern_data, detects, action_on_match, priority_boost, severity, description) VALUES
-- Document authenticity patterns
('Certificate Format Anomaly', 'document_fingerprint',
 '{"checks": ["resolution_consistency", "font_uniformity", "metadata_validity", "compression_artifacts"]}',
 'counterfeit_cert', 'flag_for_review', 30, 'critical',
 'Detects potential certificate forgery through document analysis'),

-- Behavioral patterns
('Account Review Burst', 'behavioral',
 '{"rule": "review_velocity", "params": {"max_reviews_per_day": 10, "max_same_org_reviews": 3, "min_account_age_days": 7}}',
 'competitor_attack', 'flag_for_review', 25, 'high',
 'Detects suspicious review patterns from new accounts'),

('Cross-Organization Negative Pattern', 'behavioral',
 '{"rule": "cross_org_negative", "params": {"min_negative_reviews": 5, "max_positive_ratio": 0.2, "time_window_days": 30}}',
 'competitor_attack', 'flag_for_review', 30, 'high',
 'Detects accounts that predominantly leave negative reviews'),

-- Text patterns for Russian content
('Promotional URL Pattern', 'text_regex',
 '{"regex": "(https?://)?([\\w-]+\\.)+[\\w]{2,}(/[\\w-./?%&=]*)?", "context_check": true, "flags": "i"}',
 'spam', 'increase_priority', 10, 'medium',
 'Detects promotional URLs in reviews'),

('Contact Info Solicitation', 'text_keywords',
 '{"keywords": ["напишите мне", "позвоните", "мой телеграм", "в вотсап", "whatsapp", "telegram", "@"], "context_required": true}',
 'spam', 'flag_for_review', 15, 'medium',
 'Detects attempts to solicit direct contact'),

('False Certification Claims', 'text_keywords',
 '{"keywords": ["сертифицировано", "одобрено роспотребнадзором", "одобрено минздравом", "гост", "iso сертификат"], "verify_claims": true}',
 'misleading_health_claim', 'flag_for_review', 25, 'high',
 'Detects potentially false certification claims'),

-- Image patterns
('Stock Photo Detection', 'image_hash',
 '{"method": "perceptual_hash", "database": "stock_photos", "threshold": 0.92}',
 'fake_business', 'flag_for_review', 20, 'medium',
 'Detects use of stock photos for business profiles'),

-- ML-based patterns (placeholder for future ML models)
('Sentiment Anomaly', 'ml_model',
 '{"model": "sentiment_analysis", "threshold": {"negative": -0.8, "suspicious_positive": 0.95}}',
 'suspicious_pattern', 'increase_priority', 10, 'low',
 'Detects abnormal sentiment patterns in reviews')

ON CONFLICT DO NOTHING;

-- =================
-- COMMENTS
-- =================

COMMENT ON TABLE ai_moderation_results IS 'Stores results from AI moderation analysis runs';
COMMENT ON TABLE ai_pattern_matches IS 'Detailed records of individual pattern matches for analysis and feedback';
COMMENT ON TYPE ai_pattern_type IS 'Types of patterns used for AI content moderation';
COMMENT ON TYPE ai_detection_category IS 'Categories of issues that AI moderation can detect';
COMMENT ON TYPE ai_moderation_action IS 'Actions that can be triggered by AI moderation';
