-- ============================================================================
-- Feature 6: Manufacturing Defect Early Warning System
-- AI clusters review complaints, alerts on spikes
-- ============================================================================

-- Predefined complaint topics (keyword-based)
CREATE TABLE IF NOT EXISTS complaint_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name_ru VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,

    -- Keywords for matching (Russian)
    keywords TEXT[] NOT NULL,

    -- Display
    icon VARCHAR(50),
    color VARCHAR(7),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed complaint topics with Russian keywords
INSERT INTO complaint_topics (code, name_ru, name_en, keywords, icon, color, display_order) VALUES
    ('packaging', 'Упаковка', 'Packaging',
     ARRAY['упаковка', 'пакет', 'коробка', 'тара', 'вскрыт', 'помят', 'порван', 'течет', 'протекает', 'открыт'],
     'package', '#F59E0B', 1),

    ('freshness', 'Свежесть', 'Freshness',
     ARRAY['свежесть', 'просрочен', 'испорчен', 'тухлый', 'плесень', 'запах', 'гнилой', 'несвежий', 'старый'],
     'clock', '#EF4444', 2),

    ('taste', 'Вкус', 'Taste',
     ARRAY['вкус', 'невкусно', 'горький', 'кислый', 'соленый', 'странный вкус', 'привкус', 'не такой'],
     'utensils', '#8B5CF6', 3),

    ('quality', 'Качество', 'Quality',
     ARRAY['качество', 'плохое', 'низкое', 'брак', 'дефект', 'не работает', 'сломано', 'хуже'],
     'star', '#3B82F6', 4),

    ('quantity', 'Количество', 'Quantity',
     ARRAY['количество', 'мало', 'меньше', 'не полный', 'недовес', 'обман', 'не соответствует'],
     'scale', '#10B981', 5),

    ('foreign_objects', 'Посторонние предметы', 'Foreign Objects',
     ARRAY['волос', 'насекомое', 'посторонн', 'мусор', 'грязь', 'что-то', 'инородн', 'жук', 'муха'],
     'alert-triangle', '#DC2626', 6),

    ('labeling', 'Маркировка', 'Labeling',
     ARRAY['этикетка', 'маркировка', 'срок годности', 'состав', 'не указан', 'неправильн', 'ложн'],
     'tag', '#6366F1', 7),

    ('allergies', 'Аллергены', 'Allergens',
     ARRAY['аллерг', 'реакция', 'высыпа', 'не указан аллерген', 'скрыт', 'орехи', 'молоко', 'глютен'],
     'alert-circle', '#F43F5E', 8),

    ('delivery', 'Доставка', 'Delivery',
     ARRAY['доставка', 'привезли', 'курьер', 'опоздал', 'разбит', 'повреждён при доставке'],
     'truck', '#0EA5E9', 9),

    ('service', 'Сервис', 'Service',
     ARRAY['обслуживание', 'сервис', 'персонал', 'грубо', 'не ответили', 'игнорир', 'отказ'],
     'headphones', '#14B8A6', 10)
ON CONFLICT (code) DO NOTHING;

-- Review topic classifications (auto-populated by analysis)
CREATE TABLE IF NOT EXISTS review_topic_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES complaint_topics(id) ON DELETE CASCADE,

    -- Match confidence
    confidence DECIMAL(5,2) NOT NULL DEFAULT 100,    -- 0-100
    matched_keywords TEXT[],                          -- Which keywords matched

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(review_id, topic_id)
);

-- Topic aggregation per organization per day
CREATE TABLE IF NOT EXISTS daily_topic_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES complaint_topics(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,

    -- Counts
    mention_count INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    percentage DECIMAL(5,2) NOT NULL DEFAULT 0,       -- % of reviews mentioning this topic

    -- Products most affected
    top_product_ids UUID[],

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(organization_id, topic_id, stat_date)
);

-- Defect alerts (when spike detected)
CREATE TABLE IF NOT EXISTS defect_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES complaint_topics(id),

    -- Alert details
    alert_type VARCHAR(50) NOT NULL DEFAULT 'spike',  -- spike, new_issue, critical
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',   -- low, medium, high, critical

    -- Spike detection
    baseline_percentage DECIMAL(5,2),                 -- Normal % for this topic
    current_percentage DECIMAL(5,2),                  -- Current % triggering alert
    spike_factor DECIMAL(5,2),                        -- current / baseline

    -- Time window
    detection_window_start DATE NOT NULL,
    detection_window_end DATE NOT NULL,

    -- Affected reviews
    affected_review_ids UUID[],
    affected_product_ids UUID[],

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'new',        -- new, acknowledged, investigating, resolved, dismissed
    acknowledged_by UUID REFERENCES app_users(id),
    acknowledged_at TIMESTAMPTZ,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_topic_classifications_review ON review_topic_classifications(review_id);
CREATE INDEX idx_topic_classifications_topic ON review_topic_classifications(topic_id);

CREATE INDEX idx_daily_topic_stats_org ON daily_topic_stats(organization_id, stat_date DESC);
CREATE INDEX idx_daily_topic_stats_topic ON daily_topic_stats(topic_id, stat_date DESC);

CREATE INDEX idx_defect_alerts_org ON defect_alerts(organization_id);
CREATE INDEX idx_defect_alerts_status ON defect_alerts(status);
CREATE INDEX idx_defect_alerts_severity ON defect_alerts(severity);

-- Function to classify a review by topics
CREATE OR REPLACE FUNCTION classify_review_topics(p_review_id UUID)
RETURNS INTEGER AS $$
DECLARE
    review_text TEXT;
    topic RECORD;
    matched_count INTEGER := 0;
    matched_words TEXT[];
    word TEXT;
BEGIN
    -- Get review text
    SELECT LOWER(COALESCE(title, '') || ' ' || COALESCE(body, ''))
    INTO review_text
    FROM reviews WHERE id = p_review_id;

    IF review_text IS NULL THEN
        RETURN 0;
    END IF;

    -- Check each topic
    FOR topic IN SELECT * FROM complaint_topics WHERE is_active = true LOOP
        matched_words := ARRAY[]::TEXT[];

        -- Check each keyword
        FOREACH word IN ARRAY topic.keywords LOOP
            IF review_text LIKE '%' || word || '%' THEN
                matched_words := array_append(matched_words, word);
            END IF;
        END LOOP;

        -- If any keywords matched, create classification
        IF array_length(matched_words, 1) > 0 THEN
            INSERT INTO review_topic_classifications (review_id, topic_id, matched_keywords)
            VALUES (p_review_id, topic.id, matched_words)
            ON CONFLICT (review_id, topic_id) DO UPDATE SET
                matched_keywords = EXCLUDED.matched_keywords;

            matched_count := matched_count + 1;
        END IF;
    END LOOP;

    RETURN matched_count;
END;
$$ LANGUAGE plpgsql;

-- Function to detect spikes (run daily by cron)
CREATE OR REPLACE FUNCTION detect_topic_spikes(
    p_org_id UUID,
    p_baseline_days INTEGER DEFAULT 30,
    p_spike_threshold DECIMAL DEFAULT 3.0
)
RETURNS TABLE (
    topic_id UUID,
    topic_name VARCHAR,
    baseline_pct DECIMAL,
    current_pct DECIMAL,
    spike_factor DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH baseline AS (
        SELECT
            dts.topic_id,
            AVG(dts.percentage) as avg_percentage
        FROM daily_topic_stats dts
        WHERE dts.organization_id = p_org_id
        AND dts.stat_date >= CURRENT_DATE - p_baseline_days
        AND dts.stat_date < CURRENT_DATE - 1
        GROUP BY dts.topic_id
    ),
    current_day AS (
        SELECT
            dts.topic_id,
            dts.percentage
        FROM daily_topic_stats dts
        WHERE dts.organization_id = p_org_id
        AND dts.stat_date = CURRENT_DATE - 1
    )
    SELECT
        cd.topic_id,
        ct.name_ru as topic_name,
        COALESCE(b.avg_percentage, 0)::DECIMAL as baseline_pct,
        cd.percentage as current_pct,
        CASE WHEN COALESCE(b.avg_percentage, 0) > 0
             THEN (cd.percentage / b.avg_percentage)::DECIMAL
             ELSE 100::DECIMAL END as spike_factor
    FROM current_day cd
    JOIN complaint_topics ct ON ct.id = cd.topic_id
    LEFT JOIN baseline b ON b.topic_id = cd.topic_id
    WHERE (cd.percentage / GREATEST(COALESCE(b.avg_percentage, 0.1), 0.1)) >= p_spike_threshold;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER trigger_defect_alerts_updated_at
    BEFORE UPDATE ON defect_alerts
    FOR EACH ROW EXECUTE FUNCTION update_challenge_updated_at();

-- RLS Policies
ALTER TABLE complaint_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_topic_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_topic_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_alerts ENABLE ROW LEVEL SECURITY;

-- Topics are public
CREATE POLICY "Complaint topics are public"
    ON complaint_topics FOR SELECT USING (true);

-- Classifications: org can view for their reviews
CREATE POLICY "Org can view review classifications"
    ON review_topic_classifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM reviews r
            JOIN organization_members om ON om.organization_id = r.organization_id
            WHERE r.id = review_topic_classifications.review_id
            AND om.user_id = auth.uid()
        )
    );

-- Daily stats: org can view their own
CREATE POLICY "Org can view own topic stats"
    ON daily_topic_stats FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = daily_topic_stats.organization_id
            AND user_id = auth.uid()
        )
    );

-- Alerts: org can view and manage their own
CREATE POLICY "Org can view own alerts"
    ON defect_alerts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = defect_alerts.organization_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Org managers can update alerts"
    ON defect_alerts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = defect_alerts.organization_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin', 'manager')
        )
    );

-- Notification type for defect alerts
INSERT INTO notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('business.defect_alert', 'business', 'high',
     'Обнаружена проблема: {{topic_name}}',
     'Замечен рост жалоб на {{topic_name}} ({{spike_factor}}x от нормы). Затронуто {{review_count}} отзывов.',
     ARRAY['in_app', 'email', 'push'])
ON CONFLICT (key) DO NOTHING;
