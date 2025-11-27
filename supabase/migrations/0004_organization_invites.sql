-- Organization invites

CREATE TABLE IF NOT EXISTS public.organization_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'manager', 'editor', 'analyst', 'viewer')),
    code text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at timestamptz,
    created_by uuid NOT NULL REFERENCES public.app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    accepted_by uuid REFERENCES public.app_users(id),
    accepted_at timestamptz
);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org managers view invites" ON public.organization_invites
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = organization_invites.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Org managers create invites" ON public.organization_invites
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = organization_invites.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Org managers update invites" ON public.organization_invites
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = organization_invites.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = organization_invites.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Org managers delete invites" ON public.organization_invites
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = organization_invites.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

