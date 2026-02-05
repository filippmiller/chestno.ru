-- ============================================================================
-- Feature 10: Review Intelligence Dashboard
-- AI-powered analytics and insights from reviews
-- ============================================================================

-- Review intelligence reports (generated periodically)
CREATE TABLE IF NOT EXISTS review_intelligence_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Report period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL DEFAULT 'weekly',  -- daily, weekly, monthly

    -- Summary metrics
    total_reviews INTEGER NOT NULL DEFAULT 0,
    new_reviews INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2),
    rating_trend DECIMAL(4,2),                          -- Change from previous period

    -- Sentiment analysis
    positive_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    sentiment_score DECIMAL(5,2),                       -- -100 to +100

    -- Topic breakdown (from defect early warning system)
    topic_breakdown JSONB DEFAULT '{}'::jsonb,          -- {topic_code: {count, percentage, trend}}

    -- Top keywords/phrases
    top_positive_keywords JSONB DEFAULT '[]'::jsonb,    -- [{keyword, count}]
    top_negative_keywords JSONB DEFAULT '[]'::jsonb,    -- [{keyword, count}]

    -- Competitor comparison (vs category average)
    category_avg_rating DECIMAL(3,2),
    category_percentile INTEGER,                        -- 0-100 where you rank

    -- Actionable insights
    insights JSONB DEFAULT '[]'::jsonb,                 -- [{type, priority, title, description, impact_score}]

    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',      -- pending, processing, completed, failed
    generated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Review keywords extraction
CREATE TABLE IF NOT EXISTS review_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,

    keyword VARCHAR(100) NOT NULL,
    sentiment VARCHAR(20),                              -- positive, negative, neutral
    frequency INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(review_id, keyword)
);

-- Category benchmarks (for comparison)
CREATE TABLE IF NOT EXISTS category_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,                     -- Product category

    -- Benchmark metrics
    avg_rating DECIMAL(3,2),
    avg_review_count INTEGER,
    avg_response_rate DECIMAL(5,2),
    avg_response_time_hours INTEGER,

    -- Distribution
    rating_distribution JSONB DEFAULT '{}'::jsonb,      -- {1: x%, 2: y%, ...}

    -- Calculation metadata
    organization_count INTEGER,
    review_count INTEGER,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(category)
);

-- Improvement suggestions
CREATE TABLE IF NOT EXISTS improvement_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    report_id UUID REFERENCES review_intelligence_reports(id) ON DELETE SET NULL,

    -- Suggestion details
    suggestion_type VARCHAR(50) NOT NULL,               -- respond_faster, fix_packaging, etc.
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',     -- low, medium, high, critical
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Impact prediction
    predicted_impact_score DECIMAL(5,2),                -- Predicted trust score improvement
    predicted_rating_change DECIMAL(3,2),               -- Predicted rating improvement
    confidence DECIMAL(5,2),                            -- Confidence in prediction

    -- Evidence
    supporting_review_ids UUID[],
    affected_topic_codes TEXT[],

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'new',          -- new, acknowledged, in_progress, completed, dismissed
    acknowledged_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    outcome_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_intelligence_reports_org ON review_intelligence_reports(organization_id, period_end DESC);
CREATE INDEX idx_intelligence_reports_period ON review_intelligence_reports(period_type, period_end DESC);
CREATE INDEX idx_review_keywords_review ON review_keywords(review_id);
CREATE INDEX idx_review_keywords_keyword ON review_keywords(keyword);
CREATE INDEX idx_suggestions_org ON improvement_suggestions(organization_id, priority);
CREATE INDEX idx_suggestions_status ON improvement_suggestions(status);

-- Function to extract keywords from a review (simple word frequency)
CREATE OR REPLACE FUNCTION extract_review_keywords(p_review_id UUID)
RETURNS INTEGER AS $$
DECLARE
    review_text TEXT;
    review_rating INTEGER;
    words TEXT[];
    word TEXT;
    sentiment VARCHAR(20);
    extracted_count INTEGER := 0;
    -- Russian stop words to exclude
    stop_words TEXT[] := ARRAY[
        'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она',
        'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'её',
        'мне', 'было', 'вот', 'от', 'меня', 'ещё', 'нет', 'о', 'из', 'ему', 'теперь', 'когда',
        'уже', 'вам', 'ней', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'после',
        'может', 'для', 'очень', 'это', 'этой', 'этих', 'был', 'была', 'были', 'быть', 'есть'
    ];
BEGIN
    -- Get review text and rating
    SELECT LOWER(COALESCE(title, '') || ' ' || COALESCE(body, '')), rating
    INTO review_text, review_rating
    FROM reviews WHERE id = p_review_id;

    IF review_text IS NULL THEN
        RETURN 0;
    END IF;

    -- Determine overall sentiment from rating
    IF review_rating >= 4 THEN
        sentiment := 'positive';
    ELSIF review_rating <= 2 THEN
        sentiment := 'negative';
    ELSE
        sentiment := 'neutral';
    END IF;

    -- Clean and split text into words
    review_text := regexp_replace(review_text, '[^а-яёa-z0-9\s]', '', 'gi');
    words := regexp_split_to_array(review_text, '\s+');

    -- Extract meaningful words (3+ chars, not stop words)
    FOREACH word IN ARRAY words LOOP
        IF length(word) >= 3 AND NOT (word = ANY(stop_words)) THEN
            INSERT INTO review_keywords (review_id, keyword, sentiment)
            VALUES (p_review_id, word, sentiment)
            ON CONFLICT (review_id, keyword) DO UPDATE SET
                frequency = review_keywords.frequency + 1;

            extracted_count := extracted_count + 1;
        END IF;
    END LOOP;

    RETURN extracted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate intelligence report
CREATE OR REPLACE FUNCTION generate_intelligence_report(
    p_org_id UUID,
    p_period_type VARCHAR DEFAULT 'weekly'
)
RETURNS review_intelligence_reports AS $$
DECLARE
    result review_intelligence_reports;
    period_start DATE;
    period_end DATE;
    review_stats RECORD;
    topic_data JSONB;
    prev_period_rating DECIMAL;
BEGIN
    -- Calculate period
    period_end := CURRENT_DATE;
    IF p_period_type = 'daily' THEN
        period_start := period_end - 1;
    ELSIF p_period_type = 'weekly' THEN
        period_start := period_end - 7;
    ELSIF p_period_type = 'monthly' THEN
        period_start := period_end - 30;
    ELSE
        period_start := period_end - 7;
    END IF;

    -- Get review stats for period
    SELECT
        COUNT(*) as new_reviews,
        AVG(rating) as average_rating,
        COUNT(*) FILTER (WHERE rating >= 4) as positive_count,
        COUNT(*) FILTER (WHERE rating = 3) as neutral_count,
        COUNT(*) FILTER (WHERE rating <= 2) as negative_count
    INTO review_stats
    FROM reviews
    WHERE organization_id = p_org_id
    AND status = 'approved'
    AND created_at >= period_start
    AND created_at < period_end;

    -- Get previous period rating for trend
    SELECT AVG(rating)
    INTO prev_period_rating
    FROM reviews
    WHERE organization_id = p_org_id
    AND status = 'approved'
    AND created_at >= (period_start - (period_end - period_start))
    AND created_at < period_start;

    -- Get topic breakdown
    SELECT jsonb_object_agg(
        ct.code,
        jsonb_build_object(
            'count', COALESCE(dts.mention_count, 0),
            'percentage', COALESCE(dts.percentage, 0)
        )
    )
    INTO topic_data
    FROM complaint_topics ct
    LEFT JOIN daily_topic_stats dts ON dts.topic_id = ct.id
        AND dts.organization_id = p_org_id
        AND dts.stat_date >= period_start
        AND dts.stat_date < period_end;

    -- Get total reviews for org
    -- Insert report
    INSERT INTO review_intelligence_reports (
        organization_id, period_start, period_end, period_type,
        total_reviews, new_reviews, average_rating, rating_trend,
        positive_count, neutral_count, negative_count,
        sentiment_score, topic_breakdown,
        status, generated_at
    )
    VALUES (
        p_org_id, period_start, period_end, p_period_type,
        (SELECT COUNT(*) FROM reviews WHERE organization_id = p_org_id AND status = 'approved'),
        COALESCE(review_stats.new_reviews, 0),
        review_stats.average_rating,
        CASE WHEN prev_period_rating IS NOT NULL
             THEN review_stats.average_rating - prev_period_rating
             ELSE 0 END,
        COALESCE(review_stats.positive_count, 0),
        COALESCE(review_stats.neutral_count, 0),
        COALESCE(review_stats.negative_count, 0),
        CASE WHEN COALESCE(review_stats.new_reviews, 0) > 0
             THEN ((review_stats.positive_count - review_stats.negative_count)::DECIMAL / review_stats.new_reviews * 100)
             ELSE 0 END,
        COALESCE(topic_data, '{}'::jsonb),
        'completed',
        now()
    )
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER trigger_suggestions_updated_at
    BEFORE UPDATE ON improvement_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

-- RLS Policies
ALTER TABLE review_intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_suggestions ENABLE ROW LEVEL SECURITY;

-- Intelligence reports: org can view their own
CREATE POLICY "Org can view own reports"
    ON review_intelligence_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = review_intelligence_reports.organization_id
            AND user_id = auth.uid()
        )
    );

-- Keywords: org can view for their reviews
CREATE POLICY "Org can view review keywords"
    ON review_keywords FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM reviews r
            JOIN organization_members om ON om.organization_id = r.organization_id
            WHERE r.id = review_keywords.review_id
            AND om.user_id = auth.uid()
        )
    );

-- Benchmarks are public (for comparison)
CREATE POLICY "Benchmarks are public"
    ON category_benchmarks FOR SELECT
    USING (true);

-- Suggestions: org can view and manage their own
CREATE POLICY "Org can view own suggestions"
    ON improvement_suggestions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = improvement_suggestions.organization_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Org managers can update suggestions"
    ON improvement_suggestions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = improvement_suggestions.organization_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin', 'manager')
        )
    );
