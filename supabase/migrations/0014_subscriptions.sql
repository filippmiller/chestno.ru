-- Subscription plans and organization subscriptions
SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    price_monthly_cents integer DEFAULT 0,
    price_yearly_cents integer,
    currency text NOT NULL DEFAULT 'RUB',
    max_products integer,
    max_qr_codes integer,
    max_members integer,
    analytics_level text NOT NULL DEFAULT 'basic',
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','past_due')),
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz,
    cancel_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_subscriptions_active_uq
    ON public.organization_subscriptions (organization_id)
    WHERE status = 'active';

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans are public for reading
CREATE POLICY "Plans are readable" ON public.subscription_plans
    FOR SELECT USING (true);

CREATE POLICY "Plans managed by platform" ON public.subscription_plans
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

-- Organization subscriptions
CREATE POLICY "Org members view subscription" ON public.organization_subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_subscriptions.organization_id
              AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner','platform_admin','support')
        )
    );

CREATE POLICY "Platform manages subscriptions" ON public.organization_subscriptions
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

-- seed plans
INSERT INTO public.subscription_plans (code, name, description, price_monthly_cents, max_products, max_qr_codes, max_members, analytics_level, is_default)
VALUES
  ('free', 'Бесплатный', 'До 5 товаров и 3 QR-кодов', 0, 5, 3, 5, 'basic', true),
  ('standard', 'Стандарт', 'До 50 товаров, расширенная аналитика', 4900, 50, 25, 20, 'advanced', false),
  ('pro', 'Профессиональный', 'Без лимитов по товарам и QR', 14900, NULL, NULL, NULL, 'advanced', false)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly_cents = EXCLUDED.price_monthly_cents,
    max_products = EXCLUDED.max_products,
    max_qr_codes = EXCLUDED.max_qr_codes,
    max_members = EXCLUDED.max_members,
    analytics_level = EXCLUDED.analytics_level,
    is_default = EXCLUDED.is_default,
    updated_at = now();

