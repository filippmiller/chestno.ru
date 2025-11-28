-- Migration: Media, Reviews, and Posts
-- Adds contacts to organization_profiles, creates organization_posts and reviews tables

-- ============================================
-- 1. Extend organization_profiles with contacts and social links
-- ============================================

ALTER TABLE public.organization_profiles
    ADD COLUMN IF NOT EXISTS contact_email text,
    ADD COLUMN IF NOT EXISTS contact_phone text,
    ADD COLUMN IF NOT EXISTS contact_website text,
    ADD COLUMN IF NOT EXISTS contact_address text,
    ADD COLUMN IF NOT EXISTS contact_telegram text,
    ADD COLUMN IF NOT EXISTS contact_whatsapp text,
    ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '[]'::jsonb;

-- Format for social_links: [{ "type": "instagram" | "vk" | "youtube" | "ok" | "tiktok" | "facebook" | "other", "label": "Instagram", "url": "..." }]

COMMENT ON COLUMN public.organization_profiles.social_links IS 'Array of social media links: [{type, label, url}]';

-- ============================================
-- 2. Create organization_posts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.organization_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    author_user_id uuid NOT NULL REFERENCES public.app_users(id),
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    main_image_url text,
    gallery jsonb DEFAULT '[]'::jsonb,
    video_url text,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_pinned boolean NOT NULL DEFAULT false,
    CONSTRAINT organization_posts_org_slug_uq UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_organization_posts_org_status ON public.organization_posts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_organization_posts_published ON public.organization_posts(organization_id, published_at DESC) WHERE status = 'published';

COMMENT ON TABLE public.organization_posts IS 'News/posts published by organizations';
COMMENT ON COLUMN public.organization_posts.gallery IS 'Array of gallery items: [{url, alt?, sort_order?}]';

-- ============================================
-- 3. Create reviews table
-- ============================================

CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    author_user_id uuid NOT NULL REFERENCES public.app_users(id),
    rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title text,
    body text NOT NULL,
    media jsonb DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderated_by uuid REFERENCES public.app_users(id),
    moderated_at timestamptz,
    moderation_comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_org_status ON public.reviews(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_author ON public.reviews(author_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON public.reviews(created_at DESC);

COMMENT ON TABLE public.reviews IS 'User reviews for organizations and products';
COMMENT ON COLUMN public.reviews.media IS 'Array of media items: [{type: "image"|"video", url, thumbnail_url?, alt?}]';

-- ============================================
-- 4. RLS Policies for organization_posts
-- ============================================

ALTER TABLE public.organization_posts ENABLE ROW LEVEL SECURITY;

-- Public read: published posts for public organizations
CREATE POLICY "Organization posts public read" ON public.organization_posts
    FOR SELECT
    USING (
        status = 'published'
        AND EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = organization_posts.organization_id
              AND o.public_visible = true
        )
    );

-- Internal read: all posts for organization members
CREATE POLICY "Organization posts internal read" ON public.organization_posts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_posts.organization_id
              AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    );

-- Write: organization members with edit rights
CREATE POLICY "Organization posts write" ON public.organization_posts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_posts.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- Update: same as write
CREATE POLICY "Organization posts update" ON public.organization_posts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_posts.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- Delete: same as write
CREATE POLICY "Organization posts delete" ON public.organization_posts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_posts.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- ============================================
-- 5. RLS Policies for reviews
-- ============================================

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public read: approved reviews for public organizations
CREATE POLICY "Reviews public read" ON public.reviews
    FOR SELECT
    USING (
        status = 'approved'
        AND EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = reviews.organization_id
              AND o.public_visible = true
        )
    );

-- Internal read: organization members see all reviews for their org
CREATE POLICY "Reviews organization read" ON public.reviews
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = reviews.organization_id
              AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_admin', 'moderator')
        )
    );

-- Author read: authors see their own reviews regardless of status
CREATE POLICY "Reviews author read" ON public.reviews
    FOR SELECT
    USING (author_user_id = auth.uid());

-- Insert: any authenticated user can create a review
CREATE POLICY "Reviews insert" ON public.reviews
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Update: organization members can moderate, authors can edit pending reviews
CREATE POLICY "Reviews update" ON public.reviews
    FOR UPDATE
    USING (
        -- Organization members can moderate
        (
            EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = reviews.organization_id
                  AND om.user_id = auth.uid()
                  AND om.role IN ('owner', 'admin', 'manager')
            )
            OR EXISTS (
                SELECT 1 FROM public.platform_roles pr
                WHERE pr.user_id = auth.uid()
                  AND pr.role = 'platform_admin'
            )
        )
        -- OR authors can edit their own pending reviews
        OR (
            author_user_id = auth.uid()
            AND status = 'pending'
        )
    );

-- Delete: authors can delete their own pending reviews, org members can delete any
CREATE POLICY "Reviews delete" ON public.reviews
    FOR DELETE
    USING (
        (
            author_user_id = auth.uid()
            AND status = 'pending'
        )
        OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = reviews.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role = 'platform_admin'
        )
    );

-- ============================================
-- 6. Update RLS for organization_profiles contacts
-- ============================================
-- Note: Existing RLS policies for organization_profiles already cover read/write access
-- No changes needed, as contacts are part of the same table

