-- Moderation fields and policies

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS verification_comment text,
    ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT false;

CREATE POLICY IF NOT EXISTS "Org managers update orgs" ON public.organizations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = public.organizations.id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = public.organizations.id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY IF NOT EXISTS "Platform moderators update orgs" ON public.organizations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    );

