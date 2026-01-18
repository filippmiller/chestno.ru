-- Migration: Product Variants System
-- Adds support for parent/child products with variant attributes

-- 1. Extend products table with variant columns
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES products(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_variant boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sku text,
ADD COLUMN IF NOT EXISTS barcode text,
ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_products_parent_product_id ON public.products(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_variant ON public.products(is_variant) WHERE is_variant = true;

-- 2. Create product variant attributes table
CREATE TABLE IF NOT EXISTS public.product_variant_attributes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_name text NOT NULL,
    attribute_value text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(product_id, attribute_name)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_variant_attrs_product ON public.product_variant_attributes(product_id);

-- 3. Create organization-level attribute templates
CREATE TABLE IF NOT EXISTS public.product_attribute_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    attribute_name text NOT NULL,
    possible_values text[] DEFAULT '{}',
    is_required boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(organization_id, attribute_name)
);

-- Create index for organization lookups
CREATE INDEX IF NOT EXISTS idx_attr_templates_org ON public.product_attribute_templates(organization_id);

-- 4. Enable RLS on new tables
ALTER TABLE public.product_variant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_templates ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for product_variant_attributes
-- Read: Organization members can read
CREATE POLICY "product_variant_attrs_select" ON public.product_variant_attributes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM products p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = product_variant_attributes.product_id
            AND om.user_id = auth.uid()
        )
    );

-- Insert: Editors can insert
CREATE POLICY "product_variant_attrs_insert" ON public.product_variant_attributes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM products p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = product_variant_attributes.product_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Update: Editors can update
CREATE POLICY "product_variant_attrs_update" ON public.product_variant_attributes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM products p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = product_variant_attributes.product_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Delete: Editors can delete
CREATE POLICY "product_variant_attrs_delete" ON public.product_variant_attributes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM products p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = product_variant_attributes.product_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- 6. RLS Policies for product_attribute_templates
-- Read: Organization members can read
CREATE POLICY "attr_templates_select" ON public.product_attribute_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = product_attribute_templates.organization_id
            AND om.user_id = auth.uid()
        )
    );

-- Insert: Editors can insert
CREATE POLICY "attr_templates_insert" ON public.product_attribute_templates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = product_attribute_templates.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Update: Editors can update
CREATE POLICY "attr_templates_update" ON public.product_attribute_templates
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = product_attribute_templates.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Delete: Editors can delete
CREATE POLICY "attr_templates_delete" ON public.product_attribute_templates
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = product_attribute_templates.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- 7. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_variant_attrs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_variant_attrs_updated
    BEFORE UPDATE ON public.product_variant_attributes
    FOR EACH ROW EXECUTE FUNCTION update_variant_attrs_timestamp();

CREATE TRIGGER attr_templates_updated
    BEFORE UPDATE ON public.product_attribute_templates
    FOR EACH ROW EXECUTE FUNCTION update_variant_attrs_timestamp();

-- 8. Add comments for documentation
COMMENT ON TABLE public.product_variant_attributes IS 'Stores variant-specific attributes like size, color, material';
COMMENT ON TABLE public.product_attribute_templates IS 'Organization-level attribute definitions with allowed values';
COMMENT ON COLUMN public.products.parent_product_id IS 'Reference to parent product for variants';
COMMENT ON COLUMN public.products.is_variant IS 'True if this product is a variant of another product';
COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit - unique product identifier';
COMMENT ON COLUMN public.products.barcode IS 'Product barcode (EAN, UPC, etc.)';
COMMENT ON COLUMN public.products.stock_quantity IS 'Current stock quantity';
