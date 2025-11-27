-- Social auth provider links

CREATE TABLE IF NOT EXISTS public.auth_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    email text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_providers ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS auth_providers_provider_user_idx
    ON public.auth_providers (provider, provider_user_id);

-- Service role only (no end-user access)
CREATE POLICY "Service role manages auth providers" ON public.auth_providers
    USING (false);

