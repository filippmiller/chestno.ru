CREATE TABLE IF NOT EXISTS public.migration_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    column_name text NOT NULL,
    column_type text NOT NULL,
    default_value text,
    is_nullable boolean DEFAULT true,
    sql_text text NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.migration_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage migration drafts" ON public.migration_drafts
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

