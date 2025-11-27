-- Fix organization update policies for managers and platform moderators

DROP POLICY IF EXISTS "Org managers update orgs" ON public.organizations;
DROP POLICY IF EXISTS "Platform moderators update orgs" ON public.organizations;

CREATE POLICY "Org managers update orgs" ON public.organizations
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

CREATE POLICY "Platform moderators update orgs" ON public.organizations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner', 'platform_admin', 'moderator')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner', 'platform_admin', 'moderator')
        )
    );

