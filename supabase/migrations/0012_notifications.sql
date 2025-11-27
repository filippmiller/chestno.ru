-- Notifications & Reminders
SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS public.notification_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    category text NOT NULL,
    severity text NOT NULL,
    title_template text NOT NULL,
    body_template text NOT NULL,
    default_channels text[] NOT NULL DEFAULT ARRAY['in_app'],
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type_id uuid NOT NULL REFERENCES public.notification_types(id) ON DELETE RESTRICT,
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_scope text NOT NULL DEFAULT 'user',
    title text NOT NULL,
    body text NOT NULL,
    payload jsonb,
    severity text NOT NULL,
    category text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    is_dismissed boolean NOT NULL DEFAULT false,
    dismissed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel text NOT NULL DEFAULT 'in_app',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','read','dismissed')),
    scheduled_at timestamptz,
    sent_at timestamptz,
    read_at timestamptz,
    dismissed_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_notification_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type_id uuid NOT NULL REFERENCES public.notification_types(id) ON DELETE CASCADE,
    channels text[] NOT NULL DEFAULT ARRAY['in_app'],
    muted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, notification_type_id)
);

CREATE TABLE IF NOT EXISTS public.reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    notification_type_id uuid NOT NULL REFERENCES public.notification_types(id) ON DELETE CASCADE,
    payload jsonb,
    first_run_at timestamptz NOT NULL,
    next_run_at timestamptz NOT NULL,
    last_run_at timestamptz,
    recurrence text NOT NULL DEFAULT 'once',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- notification_types: everyone can SELECT, modifications only platform admins
CREATE POLICY "Notification types readable" ON public.notification_types
    FOR SELECT USING (true);

CREATE POLICY "Notification types managed by platform" ON public.notification_types
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner','platform_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner','platform_admin')
        )
    );

-- notifications table: only service/admin can access directly; end users via deliveries
CREATE POLICY "Notifications accessible to platform" ON public.notifications
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner','platform_admin')
        )
    );

-- deliveries: users only see their own
CREATE POLICY "User sees own deliveries" ON public.notification_deliveries
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "User updates own deliveries" ON public.notification_deliveries
    FOR UPDATE USING (user_id = auth.uid());

-- user settings
CREATE POLICY "User manages notification settings" ON public.user_notification_settings
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- reminders: platform admins only
CREATE POLICY "Reminders platform only" ON public.reminders
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner','platform_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner','platform_admin')
        )
    );

-- Seed notification types
INSERT INTO public.notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES
    ('business.new_review', 'review', 'info', 'У вас новый отзыв', 'Пользователь {{user_name}} оставил отзыв о {{business_name}}.', ARRAY['in_app','email']),
    ('business.new_views', 'engagement', 'info', 'Новые просмотры вашего бизнеса', 'Ваш бизнес посмотрели {{views_count}} раз за последние {{period}}.', ARRAY['in_app']),
    ('business.new_country_view', 'engagement', 'info', 'Ваш бизнес увидели из новой страны', 'Ваш бизнес впервые посмотрели из {{country_name}}.', ARRAY['in_app']),
    ('billing.invoice_unpaid', 'billing', 'warning', 'У вас есть неоплаченный счёт', 'Счёт №{{invoice_number}} на сумму {{amount}} ещё не оплачен.', ARRAY['in_app','email']),
    ('billing.subscription_expiring', 'billing', 'warning', 'Скоро истекает ваш оплаченный период', 'Подписка на план {{plan_name}} истекает {{date}}.', ARRAY['in_app','email']),
    ('platform.new_pending_registration', 'system', 'info', 'Новая заявка на регистрацию бизнеса', 'Поступила заявка от {{company_name}} ({{email}}).', ARRAY['in_app','email']),
    ('system.integration_failed', 'system', 'critical', 'Ошибка интеграции {{integration_name}}', 'Провайдер {{integration_name}} вернул ошибку: {{error}}.', ARRAY['in_app','email'])
ON CONFLICT (key) DO NOTHING;

