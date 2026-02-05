-- ============================================================================
-- Feature 3: Open Trust Score Algorithm
-- Transparent, computed trust score from multiple signals
-- ============================================================================

-- Trust score signals configuration
CREATE TABLE IF NOT EXISTS trust_score_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name_ru VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    description_ru TEXT,
    description_en TEXT,

    -- Scoring configuration
    weight DECIMAL(4,2) NOT NULL DEFAULT 1.0,      -- Weight in final score (0.5-2.0)
    max_points INTEGER NOT NULL DEFAULT 100,        -- Maximum points for this signal
    formula_description TEXT,                       -- Human-readable formula explanation

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the trust score signals
INSERT INTO trust_score_signals (code, name_ru, name_en, description_ru, description_en, weight, formula_description, display_order) VALUES
    ('review_rating', 'Средний рейтинг', 'Average Rating',
     'Средняя оценка по всем отзывам', 'Average rating across all reviews',
     1.5, 'rating * 20 (5 stars = 100 points)', 1),

    ('review_count', 'Количество отзывов', 'Review Count',
     'Общее количество отзывов', 'Total number of reviews',
     1.0, 'min(count / 10, 100) - up to 1000 reviews for max', 2),

    ('response_rate', 'Скорость ответа', 'Response Rate',
     'Процент отзывов с ответом от бизнеса', 'Percentage of reviews with business response',
     1.2, 'responses / total_reviews * 100', 3),

    ('challenge_resolution', 'Разрешение вызовов', 'Challenge Resolution',
     'Процент успешно разрешенных вызовов', 'Percentage of successfully resolved challenges',
     1.3, 'resolved / total_challenges * 100', 4),

    ('supply_chain_docs', 'Документация цепочки', 'Supply Chain Docs',
     'Полнота документации цепочки поставок', 'Completeness of supply chain documentation',
     1.0, 'verified_nodes / total_nodes * 100', 5),

    ('platform_tenure', 'Время на платформе', 'Platform Tenure',
     'Как долго организация на платформе', 'How long organization has been on platform',
     0.8, 'min(months_active * 2, 100)', 6),

    ('content_freshness', 'Свежесть контента', 'Content Freshness',
     'Как недавно обновлялся контент', 'How recently content was updated',
     0.7, '100 - min(days_since_update, 100)', 7),

    ('verification_level', 'Уровень верификации', 'Verification Level',
     'Текущий статусный уровень', 'Current status level',
     1.0, 'level_a=50, level_b=75, level_c=100', 8)
ON CONFLICT (code) DO NOTHING;

-- Add new columns to existing organization_trust_scores table if they don't exist
DO $$
BEGIN
    -- Add score_grade column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'score_grade') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN score_grade VARCHAR(1);
    END IF;

    -- Add signal_scores column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'signal_scores') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN signal_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- Add individual score breakdown columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'review_rating_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN review_rating_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'review_count_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN review_count_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'response_rate_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN response_rate_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'challenge_resolution_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN challenge_resolution_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'supply_chain_docs_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN supply_chain_docs_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'platform_tenure_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN platform_tenure_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'content_freshness_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN content_freshness_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'verification_level_score') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN verification_level_score DECIMAL(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'last_calculated_at') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organization_trust_scores' AND column_name = 'calculation_version') THEN
        ALTER TABLE organization_trust_scores ADD COLUMN calculation_version INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Trust score history for trends
CREATE TABLE IF NOT EXISTS trust_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    total_score DECIMAL(5,2) NOT NULL,
    signal_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,

    UNIQUE(organization_id, recorded_at)
);

-- Indexes (use IF NOT EXISTS to avoid conflicts)
CREATE INDEX IF NOT EXISTS idx_trust_score_history_org ON trust_score_history(organization_id, recorded_at DESC);

-- Function to calculate trust score for an organization
-- Uses overall_score column (from existing table schema)
CREATE OR REPLACE FUNCTION calculate_open_trust_score(org_id UUID)
RETURNS TABLE (
    organization_id UUID,
    overall_score INTEGER,
    score_grade VARCHAR(1),
    signal_scores JSONB
) AS $$
DECLARE
    review_stats RECORD;
    challenge_stats RECORD;
    supply_chain_stats RECORD;
    org_info RECORD;
    calc_signal_scores JSONB;
    total_weighted DECIMAL(10,2);
    total_weight DECIMAL(10,2);
    calc_score_grade VARCHAR(1);
    final_score INTEGER;
BEGIN
    -- Get organization info
    SELECT
        o.created_at,
        o.verification_status,
        o.updated_at
    INTO org_info
    FROM organizations o WHERE o.id = org_id;

    IF org_info IS NULL THEN
        RETURN;
    END IF;

    -- Calculate review stats
    SELECT
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE r.response IS NOT NULL) as with_response
    INTO review_stats
    FROM reviews r
    WHERE r.organization_id = org_id AND r.status = 'approved';

    -- Calculate challenge stats
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE vc.status = 'responded') as resolved
    INTO challenge_stats
    FROM verification_challenges vc
    WHERE vc.organization_id = org_id AND vc.status IN ('responded', 'expired');

    -- Calculate supply chain stats
    SELECT
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE scn.is_verified = true) as verified_nodes
    INTO supply_chain_stats
    FROM supply_chain_nodes scn
    WHERE scn.organization_id = org_id;

    -- Calculate individual signal scores
    calc_signal_scores := jsonb_build_object(
        'review_rating', jsonb_build_object(
            'raw', LEAST(review_stats.avg_rating * 20, 100),
            'weight', 1.5
        ),
        'review_count', jsonb_build_object(
            'raw', LEAST(review_stats.total_reviews::DECIMAL / 10, 100),
            'weight', 1.0
        ),
        'response_rate', jsonb_build_object(
            'raw', CASE WHEN review_stats.total_reviews > 0
                        THEN review_stats.with_response::DECIMAL / review_stats.total_reviews * 100
                        ELSE 0 END,
            'weight', 1.2
        ),
        'challenge_resolution', jsonb_build_object(
            'raw', CASE WHEN challenge_stats.total > 0
                        THEN challenge_stats.resolved::DECIMAL / challenge_stats.total * 100
                        ELSE 100 END,
            'weight', 1.3
        ),
        'supply_chain_docs', jsonb_build_object(
            'raw', CASE WHEN supply_chain_stats.total_nodes > 0
                        THEN supply_chain_stats.verified_nodes::DECIMAL / supply_chain_stats.total_nodes * 100
                        ELSE 0 END,
            'weight', 1.0
        ),
        'platform_tenure', jsonb_build_object(
            'raw', LEAST(EXTRACT(MONTH FROM age(now(), org_info.created_at)) * 2, 100),
            'weight', 0.8
        ),
        'content_freshness', jsonb_build_object(
            'raw', 100 - LEAST(EXTRACT(DAY FROM age(now(), org_info.updated_at)), 100),
            'weight', 0.7
        ),
        'verification_level', jsonb_build_object(
            'raw', CASE org_info.verification_status
                       WHEN 'level_c' THEN 100
                       WHEN 'level_b' THEN 75
                       WHEN 'level_a' THEN 50
                       ELSE 25 END,
            'weight', 1.0
        )
    );

    -- Calculate weighted total
    total_weighted := 0;
    total_weight := 0;

    SELECT
        SUM((value->>'raw')::DECIMAL * (value->>'weight')::DECIMAL),
        SUM((value->>'weight')::DECIMAL)
    INTO total_weighted, total_weight
    FROM jsonb_each(calc_signal_scores) AS x(key, value);

    final_score := ROUND(total_weighted / total_weight)::INTEGER;

    -- Calculate grade
    IF final_score >= 90 THEN calc_score_grade := 'A';
    ELSIF final_score >= 80 THEN calc_score_grade := 'B';
    ELSIF final_score >= 70 THEN calc_score_grade := 'C';
    ELSIF final_score >= 60 THEN calc_score_grade := 'D';
    ELSE calc_score_grade := 'F';
    END IF;

    -- Update the existing organization_trust_scores table
    INSERT INTO organization_trust_scores (
        organization_id, overall_score, score_grade, signal_scores,
        review_rating_score, review_count_score, response_rate_score,
        challenge_resolution_score, supply_chain_docs_score,
        platform_tenure_score, content_freshness_score, verification_level_score,
        last_calculated_at
    )
    VALUES (
        org_id,
        final_score,
        calc_score_grade,
        calc_signal_scores,
        (calc_signal_scores->'review_rating'->>'raw')::DECIMAL,
        (calc_signal_scores->'review_count'->>'raw')::DECIMAL,
        (calc_signal_scores->'response_rate'->>'raw')::DECIMAL,
        (calc_signal_scores->'challenge_resolution'->>'raw')::DECIMAL,
        (calc_signal_scores->'supply_chain_docs'->>'raw')::DECIMAL,
        (calc_signal_scores->'platform_tenure'->>'raw')::DECIMAL,
        (calc_signal_scores->'content_freshness'->>'raw')::DECIMAL,
        (calc_signal_scores->'verification_level'->>'raw')::DECIMAL,
        now()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        score_grade = EXCLUDED.score_grade,
        signal_scores = EXCLUDED.signal_scores,
        review_rating_score = EXCLUDED.review_rating_score,
        review_count_score = EXCLUDED.review_count_score,
        response_rate_score = EXCLUDED.response_rate_score,
        challenge_resolution_score = EXCLUDED.challenge_resolution_score,
        supply_chain_docs_score = EXCLUDED.supply_chain_docs_score,
        platform_tenure_score = EXCLUDED.platform_tenure_score,
        content_freshness_score = EXCLUDED.content_freshness_score,
        verification_level_score = EXCLUDED.verification_level_score,
        last_calculated_at = EXCLUDED.last_calculated_at;

    -- Record history (daily)
    INSERT INTO trust_score_history (organization_id, total_score, signal_scores, recorded_at)
    VALUES (org_id, final_score, calc_signal_scores, CURRENT_DATE)
    ON CONFLICT (organization_id, recorded_at) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        signal_scores = EXCLUDED.signal_scores;

    -- Return the result
    RETURN QUERY SELECT org_id, final_score, calc_score_grade, calc_signal_scores;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE trust_score_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_score_history ENABLE ROW LEVEL SECURITY;

-- Signals are public (transparency)
DROP POLICY IF EXISTS "Trust signals are public" ON trust_score_signals;
CREATE POLICY "Trust signals are public"
    ON trust_score_signals FOR SELECT USING (true);

-- History is public (transparency)
DROP POLICY IF EXISTS "Trust history is public" ON trust_score_history;
CREATE POLICY "Trust history is public"
    ON trust_score_history FOR SELECT USING (true);
