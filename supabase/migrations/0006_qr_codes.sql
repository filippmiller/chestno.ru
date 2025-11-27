-- QR codes and analytics

CREATE TABLE IF NOT EXISTS public.qr_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    label text,
    target_type text NOT NULL DEFAULT 'organization',
    target_slug text,
    created_by uuid NOT NULL REFERENCES public.app_users(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qr_events (
    id bigserial PRIMARY KEY,
    qr_code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    ip_hash text,
    user_agent text,
    referer text,
    country text,
    city text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    raw_query text
);

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view qr codes" ON public.qr_codes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.qr_codes.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor', 'analyst', 'viewer')
        )
    );

CREATE POLICY "Org managers manage qr codes" ON public.qr_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.qr_codes.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.qr_codes.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Org analysts view qr events" ON public.qr_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            JOIN public.qr_codes qc ON qc.id = public.qr_events.qr_code_id
            WHERE om.organization_id = qc.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'analyst')
        )
    );

