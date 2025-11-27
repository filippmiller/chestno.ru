-- Products table

CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    slug text NOT NULL,
    name text NOT NULL,
    short_description text,
    long_description text,
    category text,
    tags text,
    price_cents integer,
    currency text DEFAULT 'RUB',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    is_featured boolean NOT NULL DEFAULT false,
    main_image_url text,
    gallery jsonb,
    external_url text,
    created_by uuid NOT NULL REFERENCES public.app_users(id),
    updated_by uuid REFERENCES public.app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_org_slug_uq
    ON public.products (organization_id, slug);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view products" ON public.products
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = products.organization_id
              AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner','platform_admin')
        )
    );

CREATE POLICY "Org editors manage products" ON public.products
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = products.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner','admin','manager','editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = products.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner','admin','manager','editor')
        )
    );

