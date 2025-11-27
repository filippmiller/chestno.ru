-- Extend organization member roles and add organization profiles

ALTER TABLE public.organization_members
    DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE public.organization_members
    ADD CONSTRAINT organization_members_role_check CHECK (
        role IN ('owner', 'admin', 'manager', 'editor', 'analyst', 'viewer')
    );

CREATE TABLE IF NOT EXISTS public.organization_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    short_description text,
    long_description text,
    production_description text,
    safety_and_quality text,
    video_url text,
    gallery jsonb DEFAULT '[]'::jsonb,
    tags text,
    language text NOT NULL DEFAULT 'ru',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org profile read" ON public.organization_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_profiles.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor', 'analyst', 'viewer')
        )
    );

CREATE POLICY "Org profile write" ON public.organization_profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_profiles.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

CREATE POLICY "Org profile update" ON public.organization_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_profiles.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_profiles.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

