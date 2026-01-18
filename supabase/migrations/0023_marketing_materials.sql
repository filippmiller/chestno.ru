-- Marketing Templates System
-- Global templates (blueprints) and organization-specific materials

-- ============================================
-- Table: marketing_templates (global blueprints)
-- ============================================
CREATE TABLE IF NOT EXISTS public.marketing_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    paper_size text NOT NULL DEFAULT 'A4',
    orientation text NOT NULL DEFAULT 'portrait',
    layout_schema_version integer NOT NULL DEFAULT 1,
    layout_json jsonb NOT NULL DEFAULT '{}',
    thumbnail_url text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT valid_paper_size CHECK (paper_size IN ('A3', 'A4', 'A5')),
    CONSTRAINT valid_orientation CHECK (orientation IN ('portrait', 'landscape'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_templates_active ON public.marketing_templates(is_active, sort_order);

-- ============================================
-- Table: marketing_materials (business instances)
-- ============================================
CREATE TABLE IF NOT EXISTS public.marketing_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    template_id uuid REFERENCES public.marketing_templates(id) ON DELETE SET NULL,
    name text NOT NULL,
    paper_size text NOT NULL DEFAULT 'A4',
    orientation text NOT NULL DEFAULT 'portrait',
    layout_schema_version integer NOT NULL DEFAULT 1,
    layout_json jsonb NOT NULL DEFAULT '{}',
    is_default_for_business boolean NOT NULL DEFAULT false,
    support_notes text,
    created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT valid_material_paper_size CHECK (paper_size IN ('A3', 'A4', 'A5')),
    CONSTRAINT valid_material_orientation CHECK (orientation IN ('portrait', 'landscape'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_materials_business ON public.marketing_materials(business_id);
CREATE INDEX IF NOT EXISTS idx_marketing_materials_template ON public.marketing_materials(template_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_materials ENABLE ROW LEVEL SECURITY;

-- Templates: public read (active only)
CREATE POLICY "Anyone can read active templates" ON public.marketing_templates
    FOR SELECT
    USING (is_active = true);

-- Templates: admin write (handled by service role in backend)

-- Materials: org members can read their own
CREATE POLICY "Org members can read their materials" ON public.marketing_materials
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = marketing_materials.business_id
            AND om.user_id = auth.uid()
        )
    );

-- Materials: org editors can write their own
CREATE POLICY "Org editors can manage their materials" ON public.marketing_materials
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = marketing_materials.business_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = marketing_materials.business_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- ============================================
-- Seed Templates
-- ============================================

INSERT INTO public.marketing_templates (template_key, name, description, paper_size, orientation, layout_json, sort_order)
VALUES
(
    'poster_door',
    'Постер для двери (A4)',
    'Классический постер A4 с QR-кодом для размещения на входной двери или на кассе',
    'A4',
    'portrait',
    '{
        "version": 1,
        "paper": { "size": "A4", "orientation": "portrait", "width_mm": 210, "height_mm": 297 },
        "theme": { "background": "#FFFFFF", "primaryColor": "#1a1a1a", "accentColor": "#2563eb" },
        "blocks": [
            {
                "id": "business-name",
                "type": "text",
                "binding": "business.name",
                "text": "",
                "fontFamily": "Inter",
                "fontSizePt": 32,
                "fontWeight": "bold",
                "align": "center",
                "color": "#1a1a1a",
                "x": 10, "y": 30, "width": 190, "height": 20, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            },
            {
                "id": "short-desc",
                "type": "text",
                "binding": "business.short_description",
                "text": "",
                "fontFamily": "Inter",
                "fontSizePt": 14,
                "fontWeight": "normal",
                "align": "center",
                "color": "#666666",
                "x": 10, "y": 55, "width": 190, "height": 15, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "qr-main",
                "type": "qr",
                "binding": "business.qr.profile",
                "qr_url": "",
                "x": 55, "y": 100, "size": 100, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            },
            {
                "id": "scan-text",
                "type": "text",
                "binding": null,
                "text": "Отсканируйте QR-код, чтобы узнать больше о нас",
                "fontFamily": "Inter",
                "fontSizePt": 12,
                "fontWeight": "normal",
                "align": "center",
                "color": "#666666",
                "x": 10, "y": 210, "width": 190, "height": 10, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "promo-text",
                "type": "text",
                "binding": null,
                "text": "Оставьте отзыв и помогите другим сделать правильный выбор!",
                "fontFamily": "Inter",
                "fontSizePt": 11,
                "fontWeight": "normal",
                "align": "center",
                "color": "#888888",
                "x": 10, "y": 230, "width": 190, "height": 20, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "footer",
                "type": "text",
                "binding": null,
                "text": "chestno.ru",
                "fontFamily": "Inter",
                "fontSizePt": 10,
                "fontWeight": "normal",
                "align": "center",
                "color": "#aaaaaa",
                "x": 10, "y": 280, "width": 190, "height": 8, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            }
        ]
    }'::jsonb,
    1
),
(
    'flyer_a5',
    'Флаер A5',
    'Компактный флаер A5 для раздачи на мероприятиях или вложения в упаковку',
    'A5',
    'portrait',
    '{
        "version": 1,
        "paper": { "size": "A5", "orientation": "portrait", "width_mm": 148, "height_mm": 210 },
        "theme": { "background": "#FFFFFF", "primaryColor": "#1a1a1a", "accentColor": "#2563eb" },
        "blocks": [
            {
                "id": "business-name",
                "type": "text",
                "binding": "business.name",
                "text": "",
                "fontFamily": "Inter",
                "fontSizePt": 24,
                "fontWeight": "bold",
                "align": "center",
                "color": "#1a1a1a",
                "x": 10, "y": 15, "width": 128, "height": 15, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            },
            {
                "id": "short-desc",
                "type": "text",
                "binding": "business.short_description",
                "text": "",
                "fontFamily": "Inter",
                "fontSizePt": 11,
                "fontWeight": "normal",
                "align": "center",
                "color": "#666666",
                "x": 10, "y": 35, "width": 128, "height": 12, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "qr-main",
                "type": "qr",
                "binding": "business.qr.profile",
                "qr_url": "",
                "x": 39, "y": 60, "size": 70, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            },
            {
                "id": "scan-text",
                "type": "text",
                "binding": null,
                "text": "Отсканируйте QR-код",
                "fontFamily": "Inter",
                "fontSizePt": 10,
                "fontWeight": "normal",
                "align": "center",
                "color": "#666666",
                "x": 10, "y": 140, "width": 128, "height": 8, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "promo-text",
                "type": "text",
                "binding": null,
                "text": "Узнайте больше о нас и оставьте отзыв",
                "fontFamily": "Inter",
                "fontSizePt": 9,
                "fontWeight": "normal",
                "align": "center",
                "color": "#888888",
                "x": 10, "y": 155, "width": 128, "height": 15, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "footer",
                "type": "text",
                "binding": null,
                "text": "chestno.ru",
                "fontFamily": "Inter",
                "fontSizePt": 8,
                "fontWeight": "normal",
                "align": "center",
                "color": "#aaaaaa",
                "x": 10, "y": 195, "width": 128, "height": 6, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            }
        ]
    }'::jsonb,
    2
),
(
    'info_a4_landscape',
    'Информационный лист A4 (горизонтальный)',
    'Горизонтальный формат A4 для размещения на столе или стойке',
    'A4',
    'landscape',
    '{
        "version": 1,
        "paper": { "size": "A4", "orientation": "landscape", "width_mm": 297, "height_mm": 210 },
        "theme": { "background": "#FFFFFF", "primaryColor": "#1a1a1a", "accentColor": "#2563eb" },
        "blocks": [
            {
                "id": "business-name",
                "type": "text",
                "binding": "business.name",
                "text": "",
                "fontFamily": "Inter",
                "fontSizePt": 36,
                "fontWeight": "bold",
                "align": "left",
                "color": "#1a1a1a",
                "x": 20, "y": 25, "width": 170, "height": 25, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            },
            {
                "id": "short-desc",
                "type": "text",
                "binding": "business.short_description",
                "text": "",
                "fontFamily": "Inter",
                "fontSizePt": 14,
                "fontWeight": "normal",
                "align": "left",
                "color": "#666666",
                "x": 20, "y": 55, "width": 170, "height": 20, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "promo-text",
                "type": "text",
                "binding": null,
                "text": "Мы производим качественную продукцию с заботой о клиентах.\nОтсканируйте QR-код, чтобы посмотреть наш профиль, прочитать отзывы и связаться с нами.",
                "fontFamily": "Inter",
                "fontSizePt": 12,
                "fontWeight": "normal",
                "align": "left",
                "color": "#444444",
                "x": 20, "y": 85, "width": 170, "height": 50, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "qr-main",
                "type": "qr",
                "binding": "business.qr.profile",
                "qr_url": "",
                "x": 197, "y": 55, "size": 80, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            },
            {
                "id": "scan-text",
                "type": "text",
                "binding": null,
                "text": "Сканируйте →",
                "fontFamily": "Inter",
                "fontSizePt": 11,
                "fontWeight": "normal",
                "align": "right",
                "color": "#666666",
                "x": 100, "y": 140, "width": 90, "height": 10, "unit": "mm",
                "editable_by_business": true,
                "editable_by_support": true
            },
            {
                "id": "footer",
                "type": "text",
                "binding": null,
                "text": "chestno.ru",
                "fontFamily": "Inter",
                "fontSizePt": 10,
                "fontWeight": "normal",
                "align": "left",
                "color": "#aaaaaa",
                "x": 20, "y": 190, "width": 100, "height": 8, "unit": "mm",
                "editable_by_business": false,
                "editable_by_support": true
            }
        ]
    }'::jsonb,
    3
)
ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    paper_size = EXCLUDED.paper_size,
    orientation = EXCLUDED.orientation,
    layout_json = EXCLUDED.layout_json,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
