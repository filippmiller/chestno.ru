-- Migration 0036: Product Pages Enhancement
-- Date: 2026-02-01
-- Description: Add global_slug for public product URLs and featured_at for featured products

BEGIN;

-- ============================================================
-- ALTER: products table enhancements
-- ============================================================

-- Add global_slug: unique across ALL products for /product/:slug URLs
-- This is different from existing 'slug' which is unique per organization
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS global_slug text;

-- Add featured_at: timestamp for when product was featured (NULL = not featured)
-- This is more useful than is_featured boolean as it provides ordering capability
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS featured_at timestamptz;

-- Create unique index for global_slug
-- Partial index: only index non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_global_slug_unique
ON public.products(global_slug)
WHERE global_slug IS NOT NULL;

-- Performance index for featured products (sorted by featured_at DESC)
CREATE INDEX IF NOT EXISTS idx_products_featured_at
ON public.products(featured_at DESC NULLS LAST)
WHERE featured_at IS NOT NULL AND status = 'published';

-- Combined index for public product discovery
CREATE INDEX IF NOT EXISTS idx_products_public_discovery
ON public.products(status, featured_at DESC NULLS LAST, created_at DESC)
WHERE status = 'published';

-- ============================================================
-- RLS POLICIES: Public product access
-- ============================================================

-- Allow anyone to view published products (for public product pages)
DROP POLICY IF EXISTS "Public can view published products" ON public.products;
CREATE POLICY "Public can view published products"
ON public.products
FOR SELECT
USING (status = 'published');

-- ============================================================
-- FUNCTION: Generate unique global slug
-- ============================================================

-- Function to generate a unique global slug from product name
CREATE OR REPLACE FUNCTION public.generate_product_global_slug(
  p_product_id uuid,
  p_base_name text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug text;
  v_counter integer := 0;
  v_final_slug text;
BEGIN
  -- Generate base slug (transliterate Russian to Latin, lowercase, replace spaces)
  v_slug := lower(regexp_replace(
    translate(
      p_base_name,
      'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
      'abvgdeejziiklmnoprstufhcchshshyyyeuaaABVGDEEJZIIKLMNOPRSTUFHCCHSHSHYYYEUAA'
    ),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ));

  -- Remove leading/trailing hyphens
  v_slug := trim(both '-' from v_slug);

  -- Start with base slug
  v_final_slug := v_slug;

  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (
    SELECT 1 FROM public.products
    WHERE global_slug = v_final_slug
    AND id != p_product_id
  ) LOOP
    v_counter := v_counter + 1;
    v_final_slug := v_slug || '-' || v_counter;
  END LOOP;

  RETURN v_final_slug;
END;
$$;

-- ============================================================
-- TRIGGER: Auto-generate global_slug on insert/update if null
-- ============================================================

CREATE OR REPLACE FUNCTION public.products_auto_global_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate if global_slug is not provided and status is published
  IF NEW.global_slug IS NULL AND NEW.status = 'published' THEN
    NEW.global_slug := public.generate_product_global_slug(NEW.id, NEW.name);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_auto_global_slug_trigger ON public.products;
CREATE TRIGGER products_auto_global_slug_trigger
BEFORE INSERT OR UPDATE OF status, name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.products_auto_global_slug();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON COLUMN public.products.global_slug IS
  'Globally unique slug for public product URLs (/product/:global_slug). Auto-generated from name when product is published.';

COMMENT ON COLUMN public.products.featured_at IS
  'Timestamp when product was featured. NULL means not featured. Used for ordering featured products.';

COMMENT ON FUNCTION public.generate_product_global_slug IS
  'Generates a unique global slug from product name with Russian transliteration support.';

COMMIT;
