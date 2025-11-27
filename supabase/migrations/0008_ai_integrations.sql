-- AI integrations metadata

CREATE TABLE IF NOT EXISTS public.ai_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    display_name text NOT NULL,
    env_var_name text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    last_check_at timestamptz,
    last_check_status text DEFAULT 'never',
    last_check_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_integrations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS ai_integrations_provider_idx ON public.ai_integrations (provider);

-- trigger to update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_integrations_updated ON public.ai_integrations;
CREATE TRIGGER trg_ai_integrations_updated
BEFORE UPDATE ON public.ai_integrations
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Platform admins manage ai integrations" ON public.ai_integrations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner', 'platform_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner', 'platform_admin')
        )
    );

