-- =====================================================
-- Content Moderation & Quality Control System
-- Migration 0035
-- =====================================================

-- =================
-- 1. MODERATION QUEUE TABLE
-- Unified queue for all content types requiring moderation
-- =================

CREATE TABLE IF NOT EXISTS moderation_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Content identification
    content_type text NOT NULL CHECK (content_type IN (
        'organization', 'product', 'review', 'post', 
        'media', 'document', 'certification'
    )),
    content_id uuid NOT NULL,
    content_snapshot jsonb, -- Snapshot of content at time of flagging
    
    -- Priority scoring (higher = more urgent)
    priority_score integer NOT NULL DEFAULT 50 CHECK (priority_score BETWEEN 0 AND 100),
    priority_reason text[], -- Array of reasons contributing to priority
    
    -- Status workflow
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_review', 'approved', 'rejected', 
        'escalated', 'appealed', 'resolved'
    )),
    
    -- Source of the moderation request
    source text NOT NULL CHECK (source IN (
        'auto_flag', 'user_report', 'new_content', 'edit', 'appeal'
    )),
    
    -- AI auto-moderation results
    ai_flags jsonb DEFAULT '{}',
    ai_confidence_score numeric(3,2) CHECK (ai_confidence_score BETWEEN 0 AND 1),
    ai_recommended_action text,
    
    -- Assignment
    assigned_to uuid REFERENCES auth.users(id),
    assigned_at timestamptz,
    
    -- Escalation
    escalation_level integer DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 3),
    escalated_by uuid REFERENCES auth.users(id),
    escalated_at timestamptz,
    escalation_reason text,
    
    -- Resolution
    resolved_by uuid REFERENCES auth.users(id),
    resolved_at timestamptz,
    resolution_action text CHECK (resolution_action IN (
        'approved', 'rejected', 'modified', 'deleted', 'no_action'
    )),
    resolution_notes text,
    
    -- Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(content_type, content_id, source)
);

CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_priority ON moderation_queue(priority_score DESC) WHERE status = 'pending';
CREATE INDEX idx_moderation_queue_assigned ON moderation_queue(assigned_to) WHERE status = 'in_review';
CREATE INDEX idx_moderation_queue_content ON moderation_queue(content_type, content_id);

-- =================
-- 2. COMMUNITY REPORTS TABLE
-- User-submitted reports for problematic content
-- =================

CREATE TABLE IF NOT EXISTS content_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Content being reported
    content_type text NOT NULL CHECK (content_type IN (
        'organization', 'product', 'review', 'post', 'media', 'user'
    )),
    content_id uuid NOT NULL,
    
    -- Reporter information
    reporter_user_id uuid REFERENCES auth.users(id),
    reporter_ip text, -- For anonymous reports
    reporter_session_id text,
    
    -- Report details
    reason text NOT NULL CHECK (reason IN (
        'fake_business', 'misleading_claims', 'counterfeit_cert',
        'offensive_content', 'spam', 'competitor_sabotage',
        'copyright', 'privacy_violation', 'other'
    )),
    reason_details text,
    evidence_urls text[],
    
    -- Processing status
    status text NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'reviewing', 'valid', 'invalid', 'duplicate'
    )),
    linked_queue_item uuid REFERENCES moderation_queue(id),
    
    -- Review
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    review_notes text,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_reports_content ON content_reports(content_type, content_id);
CREATE INDEX idx_content_reports_status ON content_reports(status) WHERE status = 'new';
CREATE INDEX idx_content_reports_reporter ON content_reports(reporter_user_id);

-- =================
-- 3. MODERATION ACTIONS LOG
-- Complete audit trail of all moderation decisions
-- =================

CREATE TABLE IF NOT EXISTS moderation_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Queue item reference
    queue_item_id uuid REFERENCES moderation_queue(id),
    
    -- Content reference
    content_type text NOT NULL,
    content_id uuid NOT NULL,
    
    -- Action details
    action text NOT NULL CHECK (action IN (
        'approve', 'reject', 'escalate', 'assign', 'unassign',
        'add_note', 'request_changes', 'restore', 'delete',
        'warn_user', 'suspend_user', 'flag_for_review'
    )),
    action_by uuid NOT NULL REFERENCES auth.users(id),
    action_at timestamptz NOT NULL DEFAULT now(),
    
    -- Additional context
    reason text,
    notes text,
    previous_state jsonb, -- For rollback capability
    new_state jsonb,
    
    -- Violation tracking
    violation_type text,
    guideline_ref text -- Reference to specific guideline violated
);

CREATE INDEX idx_moderation_actions_queue ON moderation_actions(queue_item_id);
CREATE INDEX idx_moderation_actions_content ON moderation_actions(content_type, content_id);
CREATE INDEX idx_moderation_actions_moderator ON moderation_actions(action_by, action_at DESC);

-- =================
-- 4. APPEAL REQUESTS TABLE
-- Producer appeals for rejected content
-- =================

CREATE TABLE IF NOT EXISTS moderation_appeals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Original moderation
    original_queue_item_id uuid REFERENCES moderation_queue(id),
    content_type text NOT NULL,
    content_id uuid NOT NULL,
    
    -- Appellant
    appellant_user_id uuid NOT NULL REFERENCES auth.users(id),
    organization_id uuid, -- If appealing on behalf of organization
    
    -- Appeal details
    appeal_reason text NOT NULL,
    supporting_evidence text[],
    additional_context text,
    
    -- Status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'under_review', 'upheld', 'overturned', 'partially_overturned'
    )),
    
    -- Review
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    review_decision text,
    review_notes text,
    
    -- New queue item if appeal results in re-review
    new_queue_item_id uuid REFERENCES moderation_queue(id),
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_appeals_status ON moderation_appeals(status) WHERE status = 'pending';
CREATE INDEX idx_moderation_appeals_appellant ON moderation_appeals(appellant_user_id);
CREATE INDEX idx_moderation_appeals_org ON moderation_appeals(organization_id);

-- =================
-- 5. QUALITY GUIDELINES TABLE
-- Configurable content quality standards
-- =================

CREATE TABLE IF NOT EXISTS moderation_guidelines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Guideline identification
    code text UNIQUE NOT NULL, -- e.g., 'CERT_AUTHENTICITY', 'REVIEW_QUALITY'
    category text NOT NULL CHECK (category IN (
        'authenticity', 'accuracy', 'quality', 'safety', 'legal', 'community'
    )),
    
    -- Content
    title_ru text NOT NULL,
    title_en text,
    description_ru text NOT NULL,
    description_en text,
    examples_json jsonb, -- Good and bad examples
    
    -- Enforcement
    applies_to text[] NOT NULL, -- Content types this applies to
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    auto_flag boolean DEFAULT false,
    auto_reject boolean DEFAULT false,
    
    -- Status
    is_active boolean DEFAULT true,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =================
-- 6. AI MODERATION PATTERNS
-- Patterns for auto-flagging content
-- =================

CREATE TABLE IF NOT EXISTS ai_moderation_patterns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pattern identification
    name text NOT NULL,
    pattern_type text NOT NULL CHECK (pattern_type IN (
        'text_regex', 'text_keywords', 'image_hash', 
        'document_fingerprint', 'behavioral', 'ml_model'
    )),
    
    -- Pattern definition
    pattern_data jsonb NOT NULL,
    -- For text: {"keywords": [...], "regex": "...", "fuzzy_match": true}
    -- For image: {"phash": "...", "threshold": 0.95}
    -- For behavioral: {"rule": "...", "params": {...}}
    
    -- What this pattern detects
    detects text NOT NULL CHECK (detects IN (
        'fake_business', 'misleading_health_claim', 'counterfeit_cert',
        'offensive_content', 'spam', 'competitor_attack',
        'suspicious_pattern', 'copyright_violation'
    )),
    
    -- Response
    action_on_match text NOT NULL CHECK (action_on_match IN (
        'flag_for_review', 'auto_reject', 'increase_priority', 'notify_admin'
    )),
    priority_boost integer DEFAULT 20,
    confidence_weight numeric(3,2) DEFAULT 0.5,
    
    -- Performance tracking
    match_count integer DEFAULT 0,
    true_positive_count integer DEFAULT 0,
    false_positive_count integer DEFAULT 0,
    
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =================
-- 7. MODERATOR NOTES / ANNOTATIONS
-- Internal notes on content or users
-- =================

CREATE TABLE IF NOT EXISTS moderator_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Subject of the note
    subject_type text NOT NULL CHECK (subject_type IN (
        'organization', 'user', 'product', 'review', 'report', 'appeal'
    )),
    subject_id uuid NOT NULL,
    
    -- Note content
    note_type text NOT NULL CHECK (note_type IN (
        'observation', 'warning', 'context', 'follow_up', 'evidence'
    )),
    content text NOT NULL,
    attachments jsonb, -- URLs to supporting files
    
    -- Visibility
    is_internal boolean DEFAULT true, -- Only visible to moderators
    
    -- Author
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderator_notes_subject ON moderator_notes(subject_type, subject_id);

-- =================
-- 8. VIOLATION HISTORY
-- Track repeat offenders
-- =================

CREATE TABLE IF NOT EXISTS violation_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Violator identification
    violator_type text NOT NULL CHECK (violator_type IN ('user', 'organization')),
    violator_id uuid NOT NULL,
    
    -- Violation details
    violation_type text NOT NULL,
    guideline_code text REFERENCES moderation_guidelines(code),
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Source
    content_type text,
    content_id uuid,
    queue_item_id uuid REFERENCES moderation_queue(id),
    
    -- Consequence
    consequence text CHECK (consequence IN (
        'warning', 'content_removed', 'temporary_restriction',
        'permanent_restriction', 'account_suspended', 'account_banned'
    )),
    
    -- Details
    notes text,
    
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_violation_history_violator ON violation_history(violator_type, violator_id);
CREATE INDEX idx_violation_history_severity ON violation_history(severity, created_at DESC);

-- =================
-- FUNCTIONS
-- =================

-- Function to calculate queue priority
CREATE OR REPLACE FUNCTION calculate_moderation_priority(
    p_content_type text,
    p_source text,
    p_report_count integer DEFAULT 0,
    p_ai_confidence numeric DEFAULT 0,
    p_violator_history integer DEFAULT 0
) RETURNS integer AS $$
DECLARE
    base_priority integer := 50;
    priority integer;
BEGIN
    -- Start with base priority
    priority := base_priority;
    
    -- Content type weight
    CASE p_content_type
        WHEN 'certification' THEN priority := priority + 20; -- High priority
        WHEN 'organization' THEN priority := priority + 15;
        WHEN 'product' THEN priority := priority + 10;
        WHEN 'review' THEN priority := priority + 5;
        ELSE priority := priority;
    END CASE;
    
    -- Source weight
    CASE p_source
        WHEN 'user_report' THEN priority := priority + 10;
        WHEN 'auto_flag' THEN priority := priority + 5;
        ELSE priority := priority;
    END CASE;
    
    -- Report count boost (more reports = higher priority)
    priority := priority + LEAST(p_report_count * 5, 25);
    
    -- AI confidence boost
    priority := priority + (p_ai_confidence * 10)::integer;
    
    -- History of violations boost
    priority := priority + LEAST(p_violator_history * 10, 30);
    
    -- Cap at 100
    RETURN LEAST(priority, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to add item to moderation queue
CREATE OR REPLACE FUNCTION add_to_moderation_queue(
    p_content_type text,
    p_content_id uuid,
    p_source text,
    p_ai_flags jsonb DEFAULT '{}',
    p_ai_confidence numeric DEFAULT NULL,
    p_priority_reasons text[] DEFAULT ARRAY[]::text[]
) RETURNS uuid AS $$
DECLARE
    v_queue_id uuid;
    v_priority integer;
    v_report_count integer := 0;
    v_violation_count integer := 0;
    v_org_id uuid;
BEGIN
    -- Get report count for this content
    SELECT COUNT(*) INTO v_report_count
    FROM content_reports
    WHERE content_type = p_content_type 
    AND content_id = p_content_id
    AND status IN ('new', 'reviewing');
    
    -- Get violation history (for organization if applicable)
    IF p_content_type IN ('organization', 'product', 'review', 'post') THEN
        -- Try to get organization_id from the content
        CASE p_content_type
            WHEN 'organization' THEN v_org_id := p_content_id;
            WHEN 'product' THEN
                SELECT organization_id INTO v_org_id FROM products WHERE id = p_content_id;
            WHEN 'review' THEN
                SELECT organization_id INTO v_org_id FROM reviews WHERE id = p_content_id;
            WHEN 'post' THEN
                SELECT organization_id INTO v_org_id FROM posts WHERE id = p_content_id;
        END CASE;
        
        IF v_org_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_violation_count
            FROM violation_history
            WHERE violator_type = 'organization' AND violator_id = v_org_id
            AND created_at > now() - interval '6 months';
        END IF;
    END IF;
    
    -- Calculate priority
    v_priority := calculate_moderation_priority(
        p_content_type, p_source, v_report_count, 
        COALESCE(p_ai_confidence, 0), v_violation_count
    );
    
    -- Insert or update queue item
    INSERT INTO moderation_queue (
        content_type, content_id, source, 
        priority_score, priority_reason,
        ai_flags, ai_confidence_score
    ) VALUES (
        p_content_type, p_content_id, p_source,
        v_priority, p_priority_reasons,
        p_ai_flags, p_ai_confidence
    )
    ON CONFLICT (content_type, content_id, source) 
    DO UPDATE SET
        priority_score = GREATEST(moderation_queue.priority_score, EXCLUDED.priority_score),
        priority_reason = moderation_queue.priority_reason || EXCLUDED.priority_reason,
        ai_flags = moderation_queue.ai_flags || EXCLUDED.ai_flags,
        updated_at = now()
    RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- =================
-- ROW LEVEL SECURITY
-- =================

ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderator_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_history ENABLE ROW LEVEL SECURITY;

-- Moderators can see and manage queue
CREATE POLICY "Moderators manage queue" ON moderation_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Users can create reports
CREATE POLICY "Users can create reports" ON content_reports
    FOR INSERT WITH CHECK (
        reporter_user_id = auth.uid() OR reporter_user_id IS NULL
    );

-- Users can view their own reports
CREATE POLICY "Users view own reports" ON content_reports
    FOR SELECT USING (
        reporter_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Moderators can manage reports
CREATE POLICY "Moderators manage reports" ON content_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Only moderators can see actions
CREATE POLICY "Moderators view actions" ON moderation_actions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Users can create appeals for their content
CREATE POLICY "Users create appeals" ON moderation_appeals
    FOR INSERT WITH CHECK (appellant_user_id = auth.uid());

-- Users can view their own appeals
CREATE POLICY "Users view own appeals" ON moderation_appeals
    FOR SELECT USING (
        appellant_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Moderators can manage appeals
CREATE POLICY "Moderators manage appeals" ON moderation_appeals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Only moderators can see/create notes
CREATE POLICY "Moderators manage notes" ON moderator_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Only moderators can see violation history
CREATE POLICY "Moderators view violations" ON violation_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM app_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- =================
-- SEED INITIAL GUIDELINES
-- =================

INSERT INTO moderation_guidelines (code, category, title_ru, description_ru, applies_to, severity, auto_flag) VALUES
('AUTH_FAKE_BUSINESS', 'authenticity', 'Поддельный бизнес', 
 'Профиль заявляет о производственной деятельности, которой не существует или не принадлежит создателю профиля.',
 ARRAY['organization'], 'critical', true),

('AUTH_COUNTERFEIT_CERT', 'authenticity', 'Поддельные сертификаты',
 'Загруженные сертификаты или документы являются подделками или не принадлежат организации.',
 ARRAY['document', 'certification'], 'critical', true),

('ACC_MISLEADING_HEALTH', 'accuracy', 'Вводящие в заблуждение заявления о здоровье',
 'Продукт содержит необоснованные или ложные заявления о пользе для здоровья.',
 ARRAY['product', 'post'], 'high', true),

('ACC_FALSE_ORIGIN', 'accuracy', 'Ложное происхождение',
 'Указание неверного региона происхождения или места производства.',
 ARRAY['organization', 'product'], 'high', true),

('QUAL_LOW_PHOTO', 'quality', 'Низкое качество фото',
 'Фотографии не соответствуют минимальным стандартам качества (размытые, слишком тёмные и т.д.).',
 ARRAY['media', 'product'], 'low', false),

('SAFE_OFFENSIVE', 'safety', 'Оскорбительный контент',
 'Контент содержит оскорбления, ненависть или неприемлемые материалы.',
 ARRAY['review', 'post', 'media'], 'high', true),

('COMM_COMPETITOR_ATTACK', 'community', 'Атака конкурента',
 'Подозрение на умышленные негативные отзывы от конкурентов.',
 ARRAY['review'], 'medium', true),

('COMM_SPAM', 'community', 'Спам',
 'Нежелательный рекламный контент или массовые однотипные сообщения.',
 ARRAY['review', 'post'], 'medium', true),

('LEGAL_COPYRIGHT', 'legal', 'Нарушение авторских прав',
 'Использование чужих изображений, текстов или материалов без разрешения.',
 ARRAY['media', 'post', 'product'], 'high', false)
ON CONFLICT (code) DO NOTHING;

-- =================
-- SEED INITIAL AI PATTERNS
-- =================

INSERT INTO ai_moderation_patterns (name, pattern_type, pattern_data, detects, action_on_match, priority_boost) VALUES
('Health Claims Keywords', 'text_keywords', 
 '{"keywords": ["лечит", "вылечит", "исцеляет", "панацея", "чудо-средство", "гарантированный результат"], "case_insensitive": true}',
 'misleading_health_claim', 'flag_for_review', 25),

('Spam Patterns', 'text_regex',
 '{"regex": "(купи|закажи|скидка|акция).{0,50}(сейчас|срочно|только сегодня)", "flags": "i"}',
 'spam', 'flag_for_review', 15),

('Suspicious Review Burst', 'behavioral',
 '{"rule": "review_burst", "params": {"max_reviews_per_hour": 5, "min_interval_seconds": 60}}',
 'competitor_attack', 'flag_for_review', 30),

('Offensive Language', 'text_keywords',
 '{"keywords": ["мат", "оскорбление"], "use_external_list": true}',
 'offensive_content', 'flag_for_review', 20)
ON CONFLICT DO NOTHING;
