-- Migration: Staff Training and Certification Portal
-- Session 17 Feature 4: Training materials and certification for retail staff
-- to become "Trust Ambassadors" who can explain product verification

-- =============================================================================
-- STAFF TRAINING MODULES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Module info
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Content
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'interactive', 'quiz', 'document')),
    content_url TEXT,  -- URL to video or document
    content_data JSONB,  -- Structured content for interactive/quiz

    -- Requirements
    prerequisite_module_id UUID REFERENCES public.staff_training_modules(id) ON DELETE SET NULL,
    passing_score INTEGER NOT NULL DEFAULT 80,  -- Percentage required to pass quiz

    -- Categorization
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
        'general',       -- Introduction to Chestno
        'badges',        -- Understanding trust badges
        'customer',      -- Customer interaction
        'technical',     -- Using kiosks and tools
        'advanced'       -- Advanced topics
    )),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for training modules
CREATE INDEX idx_training_modules_category ON public.staff_training_modules(category);
CREATE INDEX idx_training_modules_prerequisite ON public.staff_training_modules(prerequisite_module_id) WHERE prerequisite_module_id IS NOT NULL;
CREATE INDEX idx_training_modules_active ON public.staff_training_modules(is_active, sort_order) WHERE is_active = true;

-- =============================================================================
-- RETAIL STAFF TABLE
-- Links app users to stores as staff members
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.retail_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,

    -- Staff info
    employee_id TEXT,  -- Store's internal employee ID
    department TEXT,
    position TEXT,

    -- Certification status
    is_certified BOOLEAN NOT NULL DEFAULT false,
    certified_at TIMESTAMPTZ,
    certification_expires_at TIMESTAMPTZ,
    certification_level TEXT CHECK (certification_level IN ('basic', 'advanced', 'expert')),

    -- Engagement metrics (denormalized for performance)
    customer_assists INTEGER NOT NULL DEFAULT 0,
    scans_assisted INTEGER NOT NULL DEFAULT 0,
    reviews_collected INTEGER NOT NULL DEFAULT 0,

    -- Points earned as staff member
    staff_points INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    deactivated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_staff_store UNIQUE (user_id, store_id)
);

-- Indexes for retail staff
CREATE INDEX idx_retail_staff_user ON public.retail_staff(user_id);
CREATE INDEX idx_retail_staff_store ON public.retail_staff(store_id);
CREATE INDEX idx_retail_staff_certified ON public.retail_staff(is_certified) WHERE is_certified = true;
CREATE INDEX idx_retail_staff_active ON public.retail_staff(store_id, is_active) WHERE is_active = true;
CREATE INDEX idx_retail_staff_points ON public.retail_staff(store_id, staff_points DESC);

-- =============================================================================
-- STAFF TRAINING PROGRESS TABLE
-- Tracks each staff member's progress through training modules
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.retail_staff(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.staff_training_modules(id) ON DELETE CASCADE,

    -- Progress
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'completed', 'failed'
    )),
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),

    -- Quiz results
    quiz_attempts INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER CHECK (best_score BETWEEN 0 AND 100),
    last_score INTEGER CHECK (last_score BETWEEN 0 AND 100),

    -- Content progress (for videos/documents)
    content_progress JSONB DEFAULT '{}'::jsonb,  -- e.g., {"video_position": 120, "pages_read": [1,2,3]}

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,

    CONSTRAINT unique_staff_module UNIQUE (staff_id, module_id)
);

-- Indexes for training progress
CREATE INDEX idx_training_progress_staff ON public.staff_training_progress(staff_id);
CREATE INDEX idx_training_progress_module ON public.staff_training_progress(module_id);
CREATE INDEX idx_training_progress_status ON public.staff_training_progress(staff_id, status);

-- =============================================================================
-- STAFF QUIZ ATTEMPTS TABLE
-- Detailed log of quiz attempts for compliance tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.retail_staff(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.staff_training_modules(id) ON DELETE CASCADE,
    progress_id UUID NOT NULL REFERENCES public.staff_training_progress(id) ON DELETE CASCADE,

    -- Attempt details
    attempt_number INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    passed BOOLEAN NOT NULL,

    -- Answers (for audit/improvement)
    answers JSONB NOT NULL,  -- {"question_id": "selected_answer", ...}
    time_spent_seconds INTEGER,

    -- Timestamp
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for quiz attempts
CREATE INDEX idx_quiz_attempts_staff ON public.staff_quiz_attempts(staff_id);
CREATE INDEX idx_quiz_attempts_module ON public.staff_quiz_attempts(module_id);
CREATE INDEX idx_quiz_attempts_progress ON public.staff_quiz_attempts(progress_id);

-- =============================================================================
-- STAFF ASSISTED SCANS TABLE
-- Links staff members to scans they helped customers with
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_assisted_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.retail_staff(id) ON DELETE CASCADE,
    scan_event_id UUID NOT NULL REFERENCES public.store_scan_events(id) ON DELETE CASCADE,

    -- Context
    assistance_type TEXT NOT NULL CHECK (assistance_type IN (
        'helped_scan',       -- Physically helped customer scan
        'explained_badge',   -- Explained trust badge meaning
        'answered_question', -- Answered product question
        'demo_kiosk',        -- Demonstrated kiosk usage
        'collected_review'   -- Helped customer leave review
    )),

    -- Optional notes
    notes TEXT,

    -- Customer feedback (optional)
    customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for staff assisted scans
CREATE INDEX idx_staff_assisted_scans_staff ON public.staff_assisted_scans(staff_id);
CREATE INDEX idx_staff_assisted_scans_event ON public.staff_assisted_scans(scan_event_id);
CREATE INDEX idx_staff_assisted_scans_type ON public.staff_assisted_scans(staff_id, assistance_type);
CREATE INDEX idx_staff_assisted_scans_time ON public.staff_assisted_scans(created_at DESC);

-- =============================================================================
-- TRIGGERS: Updated At
-- =============================================================================
DROP TRIGGER IF EXISTS trg_training_modules_updated_at ON public.staff_training_modules;
CREATE TRIGGER trg_training_modules_updated_at
    BEFORE UPDATE ON public.staff_training_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_retail_staff_updated_at ON public.retail_staff;
CREATE TRIGGER trg_retail_staff_updated_at
    BEFORE UPDATE ON public.retail_staff
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTION: Check Certification Eligibility
-- Returns whether staff has completed all required modules
-- =============================================================================
CREATE OR REPLACE FUNCTION check_certification_eligibility(p_staff_id UUID)
RETURNS TABLE (
    eligible BOOLEAN,
    completed_modules INTEGER,
    total_required_modules INTEGER,
    missing_modules UUID[]
) AS $$
DECLARE
    v_completed INTEGER;
    v_total INTEGER;
    v_missing UUID[];
BEGIN
    -- Count required modules (active, general/badges/customer categories)
    SELECT COUNT(*)::INTEGER INTO v_total
    FROM public.staff_training_modules
    WHERE is_active = true
      AND category IN ('general', 'badges', 'customer');

    -- Count completed modules
    SELECT COUNT(*)::INTEGER INTO v_completed
    FROM public.staff_training_progress stp
    JOIN public.staff_training_modules stm ON stm.id = stp.module_id
    WHERE stp.staff_id = p_staff_id
      AND stp.status = 'completed'
      AND stm.is_active = true
      AND stm.category IN ('general', 'badges', 'customer');

    -- Find missing modules
    SELECT ARRAY_AGG(stm.id) INTO v_missing
    FROM public.staff_training_modules stm
    WHERE stm.is_active = true
      AND stm.category IN ('general', 'badges', 'customer')
      AND NOT EXISTS (
          SELECT 1 FROM public.staff_training_progress stp
          WHERE stp.staff_id = p_staff_id
            AND stp.module_id = stm.id
            AND stp.status = 'completed'
      );

    RETURN QUERY SELECT
        (v_completed >= v_total AND v_total > 0) as eligible,
        v_completed,
        v_total,
        COALESCE(v_missing, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Grant Staff Certification
-- Certifies a staff member after passing all requirements
-- =============================================================================
CREATE OR REPLACE FUNCTION grant_staff_certification(
    p_staff_id UUID,
    p_level TEXT DEFAULT 'basic'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_eligible BOOLEAN;
BEGIN
    -- Check eligibility
    SELECT eligible INTO v_eligible
    FROM check_certification_eligibility(p_staff_id);

    IF NOT v_eligible THEN
        RETURN false;
    END IF;

    -- Update certification status
    UPDATE public.retail_staff
    SET is_certified = true,
        certified_at = now(),
        certification_expires_at = now() + INTERVAL '1 year',
        certification_level = p_level
    WHERE id = p_staff_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Update Training Progress
-- Updates progress and handles completion
-- =============================================================================
CREATE OR REPLACE FUNCTION update_training_progress(
    p_staff_id UUID,
    p_module_id UUID,
    p_progress_percent INTEGER,
    p_content_progress JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_progress_id UUID;
    v_current_status TEXT;
BEGIN
    -- Upsert progress record
    INSERT INTO public.staff_training_progress (staff_id, module_id, status, progress_percent, content_progress, started_at, last_accessed_at)
    VALUES (p_staff_id, p_module_id, 'in_progress', p_progress_percent, COALESCE(p_content_progress, '{}'::jsonb), now(), now())
    ON CONFLICT (staff_id, module_id) DO UPDATE SET
        progress_percent = GREATEST(staff_training_progress.progress_percent, p_progress_percent),
        content_progress = COALESCE(p_content_progress, staff_training_progress.content_progress),
        last_accessed_at = now(),
        status = CASE
            WHEN staff_training_progress.status = 'completed' THEN 'completed'
            WHEN p_progress_percent >= 100 THEN 'completed'
            ELSE 'in_progress'
        END,
        completed_at = CASE
            WHEN staff_training_progress.status != 'completed' AND p_progress_percent >= 100 THEN now()
            ELSE staff_training_progress.completed_at
        END
    RETURNING id INTO v_progress_id;

    RETURN v_progress_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Submit Quiz
-- Records quiz attempt and updates progress
-- =============================================================================
CREATE OR REPLACE FUNCTION submit_staff_quiz(
    p_staff_id UUID,
    p_module_id UUID,
    p_answers JSONB,
    p_time_spent_seconds INTEGER DEFAULT NULL
)
RETURNS TABLE (
    attempt_id UUID,
    score INTEGER,
    passed BOOLEAN,
    progress_status TEXT
) AS $$
DECLARE
    v_progress_id UUID;
    v_attempt_number INTEGER;
    v_score INTEGER;
    v_passed BOOLEAN;
    v_passing_score INTEGER;
    v_attempt_id UUID;
    v_module RECORD;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_question RECORD;
BEGIN
    -- Get module info and validate
    SELECT * INTO v_module
    FROM public.staff_training_modules
    WHERE id = p_module_id AND is_active = true;

    IF v_module IS NULL THEN
        RAISE EXCEPTION 'Module not found or inactive';
    END IF;

    -- Calculate score from answers
    -- Assumes content_data has structure: {"questions": [{"id": "q1", "correct_answer": "a"}, ...]}
    IF v_module.content_data ? 'questions' THEN
        FOR v_question IN SELECT * FROM jsonb_array_elements(v_module.content_data->'questions')
        LOOP
            v_total := v_total + 1;
            IF p_answers->(v_question.value->>'id') = v_question.value->'correct_answer' THEN
                v_correct := v_correct + 1;
            END IF;
        END LOOP;
    END IF;

    v_score := CASE WHEN v_total > 0 THEN (v_correct * 100 / v_total) ELSE 0 END;
    v_passed := v_score >= v_module.passing_score;

    -- Ensure progress record exists
    INSERT INTO public.staff_training_progress (staff_id, module_id, status, started_at, last_accessed_at)
    VALUES (p_staff_id, p_module_id, 'in_progress', now(), now())
    ON CONFLICT (staff_id, module_id) DO UPDATE SET
        last_accessed_at = now()
    RETURNING id INTO v_progress_id;

    -- Get attempt number
    SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_number
    FROM public.staff_quiz_attempts
    WHERE staff_id = p_staff_id AND module_id = p_module_id;

    -- Record attempt
    INSERT INTO public.staff_quiz_attempts (staff_id, module_id, progress_id, attempt_number, score, passed, answers, time_spent_seconds)
    VALUES (p_staff_id, p_module_id, v_progress_id, v_attempt_number, v_score, v_passed, p_answers, p_time_spent_seconds)
    RETURNING id INTO v_attempt_id;

    -- Update progress
    UPDATE public.staff_training_progress
    SET quiz_attempts = v_attempt_number,
        last_score = v_score,
        best_score = GREATEST(COALESCE(best_score, 0), v_score),
        status = CASE WHEN v_passed THEN 'completed' ELSE 'failed' END,
        completed_at = CASE WHEN v_passed THEN now() ELSE completed_at END,
        progress_percent = CASE WHEN v_passed THEN 100 ELSE progress_percent END
    WHERE id = v_progress_id;

    RETURN QUERY SELECT
        v_attempt_id,
        v_score,
        v_passed,
        CASE WHEN v_passed THEN 'completed'::TEXT ELSE 'failed'::TEXT END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Get Staff Leaderboard
-- Returns top staff by engagement metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_staff_leaderboard(
    p_store_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    staff_id UUID,
    user_id UUID,
    store_id UUID,
    store_name TEXT,
    employee_id TEXT,
    staff_position TEXT,
    is_certified BOOLEAN,
    certification_level TEXT,
    customer_assists INTEGER,
    scans_assisted INTEGER,
    staff_points INTEGER,
    staff_rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rs.id as staff_id,
        rs.user_id,
        rs.store_id,
        rst.name as store_name,
        rs.employee_id,
        rs."position" as staff_position,
        rs.is_certified,
        rs.certification_level,
        rs.customer_assists,
        rs.scans_assisted,
        rs.staff_points,
        ROW_NUMBER() OVER (ORDER BY rs.staff_points DESC, rs.customer_assists DESC)::BIGINT as staff_rank
    FROM public.retail_staff rs
    JOIN public.retail_stores rst ON rst.id = rs.store_id
    WHERE rs.is_active = true
      AND (p_store_id IS NULL OR rs.store_id = p_store_id)
    ORDER BY rs.staff_points DESC, rs.customer_assists DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Record Staff Assist
-- Records a staff-assisted scan and updates metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION record_staff_assist(
    p_staff_id UUID,
    p_scan_event_id UUID,
    p_assistance_type TEXT,
    p_notes TEXT DEFAULT NULL,
    p_customer_rating INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_assist_id UUID;
    v_points INTEGER;
BEGIN
    -- Validate assistance type
    IF p_assistance_type NOT IN ('helped_scan', 'explained_badge', 'answered_question', 'demo_kiosk', 'collected_review') THEN
        RAISE EXCEPTION 'Invalid assistance type';
    END IF;

    -- Determine points based on assistance type
    v_points := CASE p_assistance_type
        WHEN 'helped_scan' THEN 5
        WHEN 'explained_badge' THEN 10
        WHEN 'answered_question' THEN 10
        WHEN 'demo_kiosk' THEN 15
        WHEN 'collected_review' THEN 20
        ELSE 5
    END;

    -- Add bonus for positive customer rating
    IF p_customer_rating >= 4 THEN
        v_points := v_points + 5;
    END IF;

    -- Insert assist record
    INSERT INTO public.staff_assisted_scans (staff_id, scan_event_id, assistance_type, notes, customer_rating)
    VALUES (p_staff_id, p_scan_event_id, p_assistance_type, p_notes, p_customer_rating)
    RETURNING id INTO v_assist_id;

    -- Update staff metrics
    UPDATE public.retail_staff
    SET customer_assists = customer_assists + 1,
        scans_assisted = scans_assisted + 1,
        reviews_collected = reviews_collected + CASE WHEN p_assistance_type = 'collected_review' THEN 1 ELSE 0 END,
        staff_points = staff_points + v_points
    WHERE id = p_staff_id;

    RETURN v_assist_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.staff_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assisted_scans ENABLE ROW LEVEL SECURITY;

-- Training Modules: Public read for active modules
CREATE POLICY "Public can view active training modules"
    ON public.staff_training_modules FOR SELECT
    USING (is_active = true AND published_at IS NOT NULL);

CREATE POLICY "Platform admins manage training modules"
    ON public.staff_training_modules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Retail Staff: Users can view their own, store orgs can view their staff
CREATE POLICY "Users can view own staff profile"
    ON public.retail_staff FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Store org members can view staff"
    ON public.retail_staff FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_staff.store_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can manage staff"
    ON public.retail_staff FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_staff.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_stores rs
            JOIN public.organization_members om ON om.organization_id = rs.organization_id
            WHERE rs.id = retail_staff.store_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins manage all staff"
    ON public.retail_staff FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Training Progress: Users can view/manage their own
CREATE POLICY "Staff can view own training progress"
    ON public.staff_training_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_training_progress.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can manage own training progress"
    ON public.staff_training_progress FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_training_progress.staff_id
              AND rs.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_training_progress.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can view staff progress"
    ON public.staff_training_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            JOIN public.retail_stores rst ON rst.id = rs.store_id
            JOIN public.organization_members om ON om.organization_id = rst.organization_id
            WHERE rs.id = staff_training_progress.staff_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Platform admins view all training progress"
    ON public.staff_training_progress FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Quiz Attempts: Same as training progress
CREATE POLICY "Staff can view own quiz attempts"
    ON public.staff_quiz_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_quiz_attempts.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can insert quiz attempts"
    ON public.staff_quiz_attempts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_quiz_attempts.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins view all quiz attempts"
    ON public.staff_quiz_attempts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- Staff Assisted Scans: Staff can view/create their own
CREATE POLICY "Staff can view own assisted scans"
    ON public.staff_assisted_scans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_assisted_scans.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can record assisted scans"
    ON public.staff_assisted_scans FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            WHERE rs.id = staff_assisted_scans.staff_id
              AND rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Store org admins can view assisted scans"
    ON public.staff_assisted_scans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.retail_staff rs
            JOIN public.retail_stores rst ON rst.id = rs.store_id
            JOIN public.organization_members om ON om.organization_id = rst.organization_id
            WHERE rs.id = staff_assisted_scans.staff_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins view all assisted scans"
    ON public.staff_assisted_scans FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin')
        )
    );

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.staff_training_modules IS 'Training content modules for retail staff certification';
COMMENT ON TABLE public.retail_staff IS 'Links app users to retail stores as staff members with certification status';
COMMENT ON TABLE public.staff_training_progress IS 'Tracks staff progress through training modules';
COMMENT ON TABLE public.staff_quiz_attempts IS 'Detailed log of quiz attempts for compliance tracking';
COMMENT ON TABLE public.staff_assisted_scans IS 'Records staff-assisted customer product scans for attribution';

COMMENT ON COLUMN public.staff_training_modules.passing_score IS 'Minimum percentage score required to pass the quiz';
COMMENT ON COLUMN public.retail_staff.certification_expires_at IS 'Staff must recertify after this date (typically 1 year)';
COMMENT ON COLUMN public.retail_staff.staff_points IS 'Gamification points earned through customer assists';

COMMENT ON FUNCTION check_certification_eligibility IS 'Checks if staff has completed all required training modules';
COMMENT ON FUNCTION grant_staff_certification IS 'Certifies a staff member after passing all requirements';
COMMENT ON FUNCTION submit_staff_quiz IS 'Records quiz attempt and updates training progress';
COMMENT ON FUNCTION get_staff_leaderboard IS 'Returns top staff ranked by engagement metrics';
COMMENT ON FUNCTION record_staff_assist IS 'Records a staff-assisted scan and awards points';
