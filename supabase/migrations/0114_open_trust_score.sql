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

-- Computed trust scores per organization
CREATE TABLE IF NOT EXISTS organization_trust_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Overall score
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0,      -- 0-100 final score
    score_grade VARCHAR(1),                            -- A, B, C, D, F

    -- Individual signal scores (JSONB for flexibility)
    signal_scores JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {signal_code: {raw: x, weighted: y, details: {...}}}

    -- Breakdown
    review_rating_score DECIMAL(5,2) DEFAULT 0,
    review_count_score DECIMAL(5,2) DEFAULT 0,
    response_rate_score DECIMAL(5,2) DEFAULT 0,
    challenge_resolution_score DECIMAL(5,2) DEFAULT 0,
    supply_chain_docs_score DECIMAL(5,2) DEFAULT 0,
    platform_tenure_score DECIMAL(5,2) DEFAULT 0,
    content_freshness_score DECIMAL(5,2) DEFAULT 0,
    verification_level_score DECIMAL(5,2) DEFAULT 0,

    -- Metadata
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculation_version INTEGER NOT NULL DEFAULT 1,

    UNIQUE(organization_id)
);

-- Trust score history for trends
CREATE TABLE IF NOT EXISTS trust_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    total_score DECIMAL(5,2) NOT NULL,
    signal_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,

    UNIQUE(organization_id, recorded_at)
);

-- Indexes
CREATE INDEX idx_trust_scores_org ON organization_trust_scores(organization_id);
CREATE INDEX idx_trust_scores_total ON organization_trust_scores(total_score DESC);
CREATE INDEX idx_trust_score_history_org ON trust_score_history(organization_id, recorded_at DESC);

-- Function to calculate trust score for an organization
CREATE OR REPLACE FUNCTION calculate_trust_score(org_id UUID)
RETURNS organization_trust_scores AS $$
DECLARE
    result organization_trust_scores;
    review_stats RECORD;
    challenge_stats RECORD;
    supply_chain_stats RECORD;
    org_info RECORD;
    signal_scores JSONB;
    total_weighted DECIMAL(10,2);
    total_weight DECIMAL(10,2);
    score_grade VARCHAR(1);
BEGIN
    -- Get organization info
    SELECT
        created_at,
        verification_status,
        updated_at
    INTO org_info
    FROM organizations WHERE id = org_id;

    IF org_info IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calculate review stats
    SELECT
        COALESCE(AVG(rating), 0) as avg_rating,
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE response IS NOT NULL) as with_response
    INTO review_stats
    FROM reviews
    WHERE organization_id = org_id AND status = 'approved';

    -- Calculate challenge stats
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'responded') as resolved
    INTO challenge_stats
    FROM verification_challenges
    WHERE organization_id = org_id AND status IN ('responded', 'expired');

    -- Calculate supply chain stats
    SELECT
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE is_verified = true) as verified_nodes
    INTO supply_chain_stats
    FROM supply_chain_nodes
    WHERE organization_id = org_id;

    -- Calculate individual signal scores
    signal_scores := jsonb_build_object(
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
                        ELSE 100 END,  -- No challenges = perfect score
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
    FROM jsonb_each(signal_scores) AS x(key, value);

    -- Calculate grade
    IF total_weighted / total_weight >= 90 THEN score_grade := 'A';
    ELSIF total_weighted / total_weight >= 80 THEN score_grade := 'B';
    ELSIF total_weighted / total_weight >= 70 THEN score_grade := 'C';
    ELSIF total_weighted / total_weight >= 60 THEN score_grade := 'D';
    ELSE score_grade := 'F';
    END IF;

    -- Upsert the score
    INSERT INTO organization_trust_scores (
        organization_id, total_score, score_grade, signal_scores,
        review_rating_score, review_count_score, response_rate_score,
        challenge_resolution_score, supply_chain_docs_score,
        platform_tenure_score, content_freshness_score, verification_level_score,
        last_calculated_at
    )
    VALUES (
        org_id,
        ROUND(total_weighted / total_weight, 2),
        score_grade,
        signal_scores,
        (signal_scores->'review_rating'->>'raw')::DECIMAL,
        (signal_scores->'review_count'->>'raw')::DECIMAL,
        (signal_scores->'response_rate'->>'raw')::DECIMAL,
        (signal_scores->'challenge_resolution'->>'raw')::DECIMAL,
        (signal_scores->'supply_chain_docs'->>'raw')::DECIMAL,
        (signal_scores->'platform_tenure'->>'raw')::DECIMAL,
        (signal_scores->'content_freshness'->>'raw')::DECIMAL,
        (signal_scores->'verification_level'->>'raw')::DECIMAL,
        now()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
        total_score = EXCLUDED.total_score,
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
        last_calculated_at = EXCLUDED.last_calculated_at
    RETURNING * INTO result;

    -- Record history (daily)
    INSERT INTO trust_score_history (organization_id, total_score, signal_scores, recorded_at)
    VALUES (org_id, result.total_score, signal_scores, CURRENT_DATE)
    ON CONFLICT (organization_id, recorded_at) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        signal_scores = EXCLUDED.signal_scores;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE trust_score_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_score_history ENABLE ROW LEVEL SECURITY;

-- Signals are public (transparency)
CREATE POLICY "Trust signals are public"
    ON trust_score_signals FOR SELECT USING (true);

-- Scores are public (transparency)
CREATE POLICY "Trust scores are public"
    ON organization_trust_scores FOR SELECT USING (true);

-- History is public (transparency)
CREATE POLICY "Trust history is public"
    ON trust_score_history FOR SELECT USING (true);
