-- Migration: Scan Alert Trigger Functions
-- PostgreSQL functions for real-time alert detection

SET client_encoding = 'UTF8';

-- ============================================
-- 1. Helper: Check if within quiet hours
-- ============================================

CREATE OR REPLACE FUNCTION public.is_within_quiet_hours(org_id uuid)
RETURNS boolean AS $$
DECLARE
    prefs public.organization_alert_preferences;
    current_time_in_tz time;
BEGIN
    SELECT * INTO prefs FROM public.organization_alert_preferences
    WHERE organization_id = org_id;

    IF prefs IS NULL OR prefs.quiet_hours_start IS NULL THEN
        RETURN false;
    END IF;

    current_time_in_tz := (now() AT TIME ZONE COALESCE(prefs.quiet_hours_timezone, 'Europe/Moscow'))::time;

    IF prefs.quiet_hours_start < prefs.quiet_hours_end THEN
        RETURN current_time_in_tz >= prefs.quiet_hours_start
           AND current_time_in_tz < prefs.quiet_hours_end;
    ELSE
        RETURN current_time_in_tz >= prefs.quiet_hours_start
            OR current_time_in_tz < prefs.quiet_hours_end;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2. Helper: Check rule cooldown
-- ============================================

CREATE OR REPLACE FUNCTION public.is_rule_in_cooldown(
    rule_id uuid,
    batch_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    rule public.scan_alert_rules;
    last_alert timestamptz;
BEGIN
    SELECT * INTO rule FROM public.scan_alert_rules WHERE id = rule_id;

    IF rule IS NULL THEN
        RETURN false;
    END IF;

    SELECT MAX(created_at) INTO last_alert
    FROM public.scan_alerts
    WHERE scan_alerts.rule_id = is_rule_in_cooldown.rule_id
      AND (batch_id IS NULL OR scan_alerts.batch_id = is_rule_in_cooldown.batch_id);

    IF last_alert IS NULL THEN
        RETURN false;
    END IF;

    RETURN last_alert > (now() - (rule.cooldown_minutes || ' minutes')::interval);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 3. Create Alert Function
-- ============================================

CREATE OR REPLACE FUNCTION public.create_scan_alert(
    p_org_id uuid,
    p_rule_id uuid,
    p_alert_type text,
    p_severity text,
    p_title text,
    p_body text,
    p_batch_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_scan_event_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
    alert_id uuid;
    rule public.scan_alert_rules;
    notification_type_id uuid;
    notification_id uuid;
    member record;
BEGIN
    -- Check quiet hours
    IF public.is_within_quiet_hours(p_org_id) AND p_severity != 'critical' THEN
        RETURN NULL;
    END IF;

    -- Check cooldown
    IF p_rule_id IS NOT NULL AND public.is_rule_in_cooldown(p_rule_id, p_batch_id) THEN
        RETURN NULL;
    END IF;

    -- Get rule for channels
    SELECT * INTO rule FROM public.scan_alert_rules WHERE id = p_rule_id;

    -- Insert alert
    INSERT INTO public.scan_alerts (
        organization_id, rule_id, alert_type, severity,
        batch_id, product_id, scan_event_id,
        title, body, metadata
    ) VALUES (
        p_org_id, p_rule_id, p_alert_type, p_severity,
        p_batch_id, p_product_id, p_scan_event_id,
        p_title, p_body, p_metadata
    ) RETURNING id INTO alert_id;

    -- Get notification type
    SELECT id INTO notification_type_id
    FROM public.notification_types
    WHERE key = 'scan.' || p_alert_type
    LIMIT 1;

    -- Create notification for each org member with appropriate role
    FOR member IN
        SELECT om.user_id
        FROM public.organization_members om
        WHERE om.organization_id = p_org_id
          AND om.role IN ('owner', 'admin', 'manager')
    LOOP
        -- Insert notification
        INSERT INTO public.notifications (
            notification_type_id, org_id, recipient_user_id,
            recipient_scope, title, body, payload, severity, category
        ) VALUES (
            notification_type_id, p_org_id, member.user_id,
            'user', p_title, p_body,
            jsonb_build_object(
                'alert_id', alert_id,
                'batch_id', p_batch_id,
                'product_id', p_product_id
            ) || p_metadata,
            p_severity, 'scan'
        ) RETURNING id INTO notification_id;

        -- Create delivery records for each channel
        IF rule IS NOT NULL THEN
            INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status)
            SELECT notification_id, member.user_id, unnest(rule.channels), 'pending';
        ELSE
            INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status)
            VALUES (notification_id, member.user_id, 'in_app', 'pending');
        END IF;
    END LOOP;

    RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. First Scan Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_first_batch_scan(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    previous_scans integer;
    location_text text;
BEGIN
    -- Get batch info
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
    IF batch IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO product FROM public.products WHERE id = batch.product_id;

    -- Check if this is truly the first scan
    SELECT COUNT(*) INTO previous_scans
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND id != scan_event.id;

    IF previous_scans > 0 THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'first_scan'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    -- Build location text
    location_text := COALESCE(scan_event.city, '') ||
                     CASE WHEN scan_event.city IS NOT NULL AND scan_event.country IS NOT NULL
                          THEN ', ' ELSE '' END ||
                     COALESCE(scan_event.country, 'неизвестное место');

    -- Create alert
    PERFORM public.create_scan_alert(
        scan_event.organization_id,
        rule.id,
        'first_batch_scan',
        'info',
        'Первое сканирование партии ' || batch.batch_code,
        'Партия ' || batch.batch_code || ' продукта "' ||
            COALESCE(product.name, 'Неизвестный продукт') ||
            '" впервые отсканирована в ' || location_text || '.',
        scan_event.batch_id,
        batch.product_id,
        scan_event.id,
        jsonb_build_object(
            'batch_code', batch.batch_code,
            'product_name', product.name,
            'location', location_text,
            'scan_time', scan_event.created_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Scan Spike Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_scan_spike(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    window_minutes integer;
    min_scans integer;
    threshold_multiplier numeric;
    recent_count integer;
    historical_avg numeric;
    org_prefs public.organization_alert_preferences;
BEGIN
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'scan_spike'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    window_minutes := COALESCE((config->>'window_minutes')::integer, 60);
    min_scans := COALESCE((config->>'min_scans')::integer, 50);
    threshold_multiplier := COALESCE((config->>'threshold_multiplier')::numeric, 3);

    -- Count recent scans
    SELECT COUNT(*) INTO recent_count
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND created_at > (now() - (window_minutes || ' minutes')::interval);

    IF recent_count < min_scans THEN
        RETURN;
    END IF;

    -- Get historical average (last 7 days, same time window)
    SELECT AVG(bucket_count)::numeric INTO historical_avg
    FROM (
        SELECT COUNT(*) as bucket_count
        FROM public.qr_scan_events
        WHERE batch_id = scan_event.batch_id
          AND created_at > (now() - interval '7 days')
          AND created_at < (now() - (window_minutes || ' minutes')::interval)
        GROUP BY date_trunc('hour', created_at)
    ) hourly_counts;

    IF historical_avg IS NULL OR historical_avg = 0 THEN
        historical_avg := 10;
    END IF;

    -- Check if spike
    IF recent_count > (historical_avg * threshold_multiplier) THEN
        SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
        SELECT * INTO product FROM public.products WHERE id = batch.product_id;

        PERFORM public.create_scan_alert(
            scan_event.organization_id,
            rule.id,
            'viral_spike',
            'info',
            'Резкий рост сканирований!',
            'Партия ' || batch.batch_code || ' набирает популярность: ' ||
                recent_count || ' сканирований за последний час.',
            scan_event.batch_id,
            batch.product_id,
            scan_event.id,
            jsonb_build_object(
                'batch_code', batch.batch_code,
                'scan_count', recent_count,
                'time_period', window_minutes || ' минут',
                'historical_avg', round(historical_avg, 1),
                'multiplier', round(recent_count / historical_avg, 1)
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Counterfeit Pattern Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_counterfeit_pattern(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    max_scans_per_hour integer;
    geographic_threshold integer;
    recent_scans_count integer;
    distinct_locations integer;
    suspicious_reasons text[];
BEGIN
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'counterfeit_pattern'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    max_scans_per_hour := COALESCE((config->>'max_scans_per_hour')::integer, 10);
    geographic_threshold := COALESCE((config->>'geographic_spread_threshold')::integer, 3);

    suspicious_reasons := ARRAY[]::text[];

    -- Check rapid scanning from same IP
    SELECT COUNT(*) INTO recent_scans_count
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND ip_hash = scan_event.ip_hash
      AND created_at > (now() - interval '1 hour')
      AND ip_hash IS NOT NULL;

    IF recent_scans_count > max_scans_per_hour THEN
        suspicious_reasons := array_append(suspicious_reasons,
            recent_scans_count || ' сканирований с одного IP за час');
    END IF;

    -- Check geographic spread in short time
    SELECT COUNT(DISTINCT country) INTO distinct_locations
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id
      AND created_at > (now() - interval '30 minutes')
      AND country IS NOT NULL;

    IF distinct_locations >= geographic_threshold THEN
        suspicious_reasons := array_append(suspicious_reasons,
            'Сканирования из ' || distinct_locations || ' разных стран за 30 минут');
    END IF;

    -- If suspicious patterns found
    IF array_length(suspicious_reasons, 1) > 0 THEN
        SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
        SELECT * INTO product FROM public.products WHERE id = batch.product_id;

        -- Mark scan as suspicious
        UPDATE public.qr_scan_events
        SET is_suspicious = true,
            suspicious_reason = array_to_string(suspicious_reasons, '; ')
        WHERE id = scan_event.id;

        PERFORM public.create_scan_alert(
            scan_event.organization_id,
            rule.id,
            'potential_counterfeit',
            'critical',
            'Возможная подделка обнаружена!',
            'ВНИМАНИЕ: Партия ' || batch.batch_code ||
                ' показывает признаки подделки. ' ||
                array_to_string(suspicious_reasons, '. ') || '.',
            scan_event.batch_id,
            batch.product_id,
            scan_event.id,
            jsonb_build_object(
                'batch_code', batch.batch_code,
                'reasons', suspicious_reasons,
                'ip_hash', scan_event.ip_hash,
                'location', COALESCE(scan_event.city, '') || ', ' || COALESCE(scan_event.country, '')
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Geographic Anomaly Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_geographic_anomaly(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    expected_countries text[];
    alert_on_new boolean;
    is_expected boolean;
    first_from_country boolean;
BEGIN
    IF scan_event.country IS NULL OR scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'unusual_location'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    expected_countries := ARRAY(SELECT jsonb_array_elements_text(config->'expected_countries'));
    alert_on_new := COALESCE((config->>'alert_on_new_country')::boolean, true);

    -- Check if country is in expected list
    is_expected := scan_event.country = ANY(expected_countries);

    -- Check if this is first scan from this country for this batch
    SELECT NOT EXISTS (
        SELECT 1 FROM public.qr_scan_events
        WHERE batch_id = scan_event.batch_id
          AND country = scan_event.country
          AND id != scan_event.id
    ) INTO first_from_country;

    -- Alert if unexpected country OR first from new country
    IF (NOT is_expected) OR (alert_on_new AND first_from_country AND array_length(expected_countries, 1) > 0) THEN
        SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
        SELECT * INTO product FROM public.products WHERE id = batch.product_id;

        PERFORM public.create_scan_alert(
            scan_event.organization_id,
            rule.id,
            'geographic_anomaly',
            CASE WHEN NOT is_expected THEN 'warning' ELSE 'info' END,
            CASE WHEN NOT is_expected
                THEN 'Географическая аномалия сканирования'
                ELSE 'Ваш продукт увидели из новой страны'
            END,
            'Партия ' || batch.batch_code ||
                CASE WHEN NOT is_expected
                    THEN ' сканируется из неожиданного региона: '
                    ELSE ' впервые сканируется из: '
                END ||
                COALESCE(scan_event.city, '') ||
                CASE WHEN scan_event.city IS NOT NULL THEN ', ' ELSE '' END ||
                scan_event.country || '.',
            scan_event.batch_id,
            batch.product_id,
            scan_event.id,
            jsonb_build_object(
                'batch_code', batch.batch_code,
                'country', scan_event.country,
                'city', scan_event.city,
                'expected_countries', expected_countries,
                'is_unexpected', NOT is_expected,
                'is_first_from_country', first_from_country
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Milestone Detection
-- ============================================

CREATE OR REPLACE FUNCTION public.check_scan_milestone(scan_event public.qr_scan_events)
RETURNS void AS $$
DECLARE
    batch public.product_batches;
    product public.products;
    rule public.scan_alert_rules;
    config jsonb;
    milestones integer[];
    total_scans integer;
    milestone integer;
BEGIN
    IF scan_event.batch_id IS NULL THEN
        RETURN;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = scan_event.organization_id
      AND rule_type = 'milestone'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN;
    END IF;

    config := rule.config;
    milestones := ARRAY(SELECT (jsonb_array_elements_text(config->'milestones'))::integer);

    -- Get total scans for batch
    SELECT COUNT(*) INTO total_scans
    FROM public.qr_scan_events
    WHERE batch_id = scan_event.batch_id;

    -- Check if we just hit a milestone
    FOREACH milestone IN ARRAY milestones
    LOOP
        IF total_scans = milestone THEN
            SELECT * INTO batch FROM public.product_batches WHERE id = scan_event.batch_id;
            SELECT * INTO product FROM public.products WHERE id = batch.product_id;

            PERFORM public.create_scan_alert(
                scan_event.organization_id,
                rule.id,
                'milestone_reached',
                'info',
                'Достигнут рубеж сканирований!',
                'Поздравляем! Партия ' || batch.batch_code ||
                    ' достигла ' || milestone || ' сканирований.',
                scan_event.batch_id,
                batch.product_id,
                scan_event.id,
                jsonb_build_object(
                    'batch_code', batch.batch_code,
                    'milestone', milestone,
                    'total_scans', total_scans
                )
            );
            EXIT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Main Scan Event Trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_scan_event_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Run all alert checks
    PERFORM public.check_first_batch_scan(NEW);
    PERFORM public.check_scan_spike(NEW);
    PERFORM public.check_counterfeit_pattern(NEW);
    PERFORM public.check_geographic_anomaly(NEW);
    PERFORM public.check_scan_milestone(NEW);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_scan_event_check_alerts ON public.qr_scan_events;
CREATE TRIGGER on_scan_event_check_alerts
    AFTER INSERT ON public.qr_scan_events
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_scan_event_alerts();

-- ============================================
-- 10. Review Alert Trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_review_alerts()
RETURNS TRIGGER AS $$
DECLARE
    rule public.scan_alert_rules;
    config jsonb;
    min_rating integer;
    include_no_text boolean;
    product public.products;
BEGIN
    -- Only for new approved reviews
    IF TG_OP != 'INSERT' OR NEW.status != 'approved' THEN
        RETURN NEW;
    END IF;

    -- Get rule
    SELECT * INTO rule FROM public.scan_alert_rules
    WHERE organization_id = NEW.organization_id
      AND rule_type = 'negative_review'
      AND is_enabled = true
    LIMIT 1;

    IF rule IS NULL THEN
        RETURN NEW;
    END IF;

    config := rule.config;
    min_rating := COALESCE((config->>'min_rating_threshold')::integer, 3);
    include_no_text := COALESCE((config->>'include_no_text')::boolean, false);

    -- Check if this is a negative review
    IF NEW.rating > min_rating THEN
        RETURN NEW;
    END IF;

    -- Check text requirement
    IF NOT include_no_text AND (NEW.body IS NULL OR length(trim(NEW.body)) < 10) THEN
        RETURN NEW;
    END IF;

    -- Get product name if exists
    IF NEW.product_id IS NOT NULL THEN
        SELECT * INTO product FROM public.products WHERE id = NEW.product_id;
    END IF;

    PERFORM public.create_scan_alert(
        NEW.organization_id,
        rule.id,
        'negative_review',
        CASE WHEN NEW.rating <= 2 THEN 'warning' ELSE 'info' END,
        'Получен негативный отзыв',
        'Пользователь оставил отзыв с оценкой ' || NEW.rating || '/5' ||
            CASE WHEN product IS NOT NULL
                THEN ' о продукте "' || product.name || '"'
                ELSE ''
            END || '. Рекомендуем ответить.',
        NULL,
        NEW.product_id,
        NULL,
        jsonb_build_object(
            'review_id', NEW.id,
            'rating', NEW.rating,
            'product_name', product.name,
            'has_text', length(COALESCE(NEW.body, '')) > 10
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_check_alerts ON public.reviews;
CREATE TRIGGER on_review_check_alerts
    AFTER INSERT OR UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_review_alerts();

-- ============================================
-- 11. Escalation Function (called by cron)
-- ============================================

CREATE OR REPLACE FUNCTION public.process_alert_escalations()
RETURNS integer AS $$
DECLARE
    alert_record record;
    rule public.scan_alert_rules;
    escalated_count integer := 0;
BEGIN
    FOR alert_record IN
        SELECT a.*
        FROM public.scan_alerts a
        JOIN public.scan_alert_rules r ON r.id = a.rule_id
        WHERE a.status = 'new'
          AND a.severity IN ('warning', 'critical')
          AND a.is_escalated = false
          AND r.escalate_after_minutes IS NOT NULL
          AND a.created_at < (now() - (r.escalate_after_minutes || ' minutes')::interval)
    LOOP
        SELECT * INTO rule FROM public.scan_alert_rules WHERE id = alert_record.rule_id;

        -- Mark as escalated
        UPDATE public.scan_alerts
        SET is_escalated = true,
            escalated_at = now(),
            escalation_level = escalation_level + 1
        WHERE id = alert_record.id;

        -- Create notifications for escalation targets
        IF rule.escalate_to_user_ids IS NOT NULL THEN
            INSERT INTO public.notifications (
                notification_type_id, org_id, recipient_user_id,
                recipient_scope, title, body, payload, severity, category
            )
            SELECT
                (SELECT id FROM public.notification_types WHERE key = 'scan.' || alert_record.alert_type LIMIT 1),
                alert_record.organization_id,
                user_id,
                'user',
                'ЭСКАЛАЦИЯ: ' || alert_record.title,
                'Оповещение не было обработано в течение ' ||
                    rule.escalate_after_minutes || ' минут. ' || alert_record.body,
                jsonb_build_object('alert_id', alert_record.id, 'escalated', true),
                alert_record.severity,
                'scan'
            FROM unnest(rule.escalate_to_user_ids) AS user_id;
        END IF;

        escalated_count := escalated_count + 1;
    END LOOP;

    RETURN escalated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. Statistics Aggregation Function
-- ============================================

CREATE OR REPLACE FUNCTION public.aggregate_scan_statistics(p_bucket_type text DEFAULT 'hour')
RETURNS integer AS $$
DECLARE
    bucket_interval interval;
    bucket_start_time timestamptz;
    inserted_count integer := 0;
BEGIN
    bucket_interval := CASE p_bucket_type
        WHEN 'hour' THEN interval '1 hour'
        WHEN 'day' THEN interval '1 day'
        WHEN 'week' THEN interval '1 week'
        ELSE interval '1 hour'
    END;

    bucket_start_time := date_trunc(p_bucket_type, now() - bucket_interval);

    INSERT INTO public.scan_statistics (
        organization_id, batch_id, product_id,
        bucket_start, bucket_type,
        scan_count, unique_users, unique_locations, suspicious_count,
        top_countries, top_cities
    )
    SELECT
        organization_id,
        batch_id,
        product_id,
        bucket_start_time,
        p_bucket_type,
        COUNT(*),
        COUNT(DISTINCT user_id),
        COUNT(DISTINCT country),
        COUNT(*) FILTER (WHERE is_suspicious),
        COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('country', country, 'count', 1))
            FILTER (WHERE country IS NOT NULL),
            '[]'::jsonb
        ),
        COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('city', city, 'count', 1))
            FILTER (WHERE city IS NOT NULL),
            '[]'::jsonb
        )
    FROM public.qr_scan_events
    WHERE created_at >= bucket_start_time
      AND created_at < bucket_start_time + bucket_interval
    GROUP BY organization_id, batch_id, product_id
    ON CONFLICT (organization_id, batch_id, product_id, bucket_start, bucket_type)
    DO UPDATE SET
        scan_count = EXCLUDED.scan_count,
        unique_users = EXCLUDED.unique_users,
        unique_locations = EXCLUDED.unique_locations,
        suspicious_count = EXCLUDED.suspicious_count,
        top_countries = EXCLUDED.top_countries,
        top_cities = EXCLUDED.top_cities;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.trigger_scan_event_alerts IS 'Main trigger for processing scan events and generating alerts';
COMMENT ON FUNCTION public.process_alert_escalations IS 'Called by cron to escalate unacknowledged alerts';
COMMENT ON FUNCTION public.aggregate_scan_statistics IS 'Called by cron to aggregate scan statistics';
