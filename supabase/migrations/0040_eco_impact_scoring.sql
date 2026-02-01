-- Migration: Environmental Impact Scoring System
-- Calculates and displays eco-friendliness for products

-- =============================================================================
-- ECO SCORING PARAMETERS (Reference Table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS eco_scoring_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parameter identification
    parameter_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'transport',      -- Carbon footprint from transport
        'packaging',      -- Packaging materials and recyclability
        'production',     -- Production methods and energy
        'certification',  -- Eco certifications bonus
        'sourcing'        -- Raw material sourcing
    )),

    -- Display info
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ru TEXT,
    description_en TEXT,

    -- Scoring
    max_points INTEGER NOT NULL DEFAULT 100,
    weight DECIMAL(4,2) NOT NULL DEFAULT 1.0,  -- Weight in final score

    -- For UI
    icon_name TEXT,  -- Lucide icon name
    display_order INTEGER DEFAULT 100,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed eco scoring parameters
INSERT INTO eco_scoring_parameters (parameter_code, category, name_ru, name_en, description_ru, description_en, max_points, weight, icon_name, display_order) VALUES
    -- Transport (30% of total score)
    ('transport_distance', 'transport', 'Расстояние доставки', 'Transport Distance',
     'Километры от места производства до потребителя', 'Kilometers from production to consumer',
     100, 0.20, 'Truck', 10),
    ('transport_mode', 'transport', 'Способ доставки', 'Transport Mode',
     'Тип транспорта (ж/д, авто, авиа)', 'Transport type (rail, road, air)',
     100, 0.10, 'Train', 20),

    -- Packaging (25% of total score)
    ('packaging_material', 'packaging', 'Материал упаковки', 'Packaging Material',
     'Экологичность материала упаковки', 'Eco-friendliness of packaging material',
     100, 0.15, 'Package', 30),
    ('packaging_recyclable', 'packaging', 'Перерабатываемость', 'Recyclability',
     'Возможность переработки упаковки', 'Packaging recyclability potential',
     100, 0.10, 'Recycle', 40),

    -- Production (30% of total score)
    ('production_energy', 'production', 'Энергоэффективность', 'Energy Efficiency',
     'Источники энергии в производстве', 'Energy sources in production',
     100, 0.15, 'Zap', 50),
    ('production_waste', 'production', 'Управление отходами', 'Waste Management',
     'Методы утилизации производственных отходов', 'Production waste disposal methods',
     100, 0.10, 'Trash2', 60),
    ('production_water', 'production', 'Водопотребление', 'Water Usage',
     'Эффективность использования воды', 'Water usage efficiency',
     100, 0.05, 'Droplets', 70),

    -- Certification bonus (15% of total score)
    ('eco_certifications', 'certification', 'Эко-сертификаты', 'Eco Certifications',
     'Наличие экологических сертификатов', 'Presence of eco certifications',
     100, 0.15, 'Award', 80)
ON CONFLICT (parameter_code) DO NOTHING;

-- =============================================================================
-- TRANSPORT DISTANCE BRACKETS
-- =============================================================================
CREATE TABLE IF NOT EXISTS transport_distance_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    min_distance_km INTEGER NOT NULL,
    max_distance_km INTEGER,  -- NULL means infinity

    -- Score for this bracket (out of 100)
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),

    -- CO2 multiplier for display calculations
    co2_kg_per_km DECIMAL(6,4) NOT NULL DEFAULT 0.1,

    -- Display labels
    label_ru TEXT NOT NULL,
    label_en TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed distance brackets (closer = better)
INSERT INTO transport_distance_scoring (min_distance_km, max_distance_km, score, co2_kg_per_km, label_ru, label_en) VALUES
    (0, 50, 100, 0.05, 'Местное (до 50 км)', 'Local (up to 50 km)'),
    (51, 150, 85, 0.08, 'Региональное (50-150 км)', 'Regional (50-150 km)'),
    (151, 500, 70, 0.10, 'Межрегиональное (150-500 км)', 'Inter-regional (150-500 km)'),
    (501, 1000, 50, 0.12, 'Дальнее (500-1000 км)', 'Long-distance (500-1000 km)'),
    (1001, 3000, 30, 0.15, 'Очень дальнее (1000-3000 км)', 'Very long (1000-3000 km)'),
    (3001, NULL, 10, 0.20, 'Импорт (более 3000 км)', 'Import (over 3000 km)');

-- =============================================================================
-- TRANSPORT MODE SCORING
-- =============================================================================
CREATE TABLE IF NOT EXISTS transport_mode_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mode_code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,

    -- Environmental impact (higher = worse)
    co2_multiplier DECIMAL(4,2) NOT NULL,  -- Base CO2 multiplier
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),

    icon_name TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed transport modes
INSERT INTO transport_mode_scoring (mode_code, name_ru, name_en, co2_multiplier, score, icon_name) VALUES
    ('local_pickup', 'Самовывоз', 'Local Pickup', 0.0, 100, 'MapPin'),
    ('bicycle', 'Велосипед', 'Bicycle', 0.01, 98, 'Bike'),
    ('electric', 'Электротранспорт', 'Electric Vehicle', 0.3, 90, 'BatteryCharging'),
    ('rail', 'Железная дорога', 'Rail', 0.5, 85, 'Train'),
    ('road_hybrid', 'Гибридный авто', 'Hybrid Vehicle', 0.7, 75, 'Car'),
    ('road_standard', 'Автомобильный', 'Standard Road', 1.0, 60, 'Truck'),
    ('sea', 'Морской', 'Sea Freight', 1.2, 55, 'Ship'),
    ('air', 'Авиа', 'Air Freight', 5.0, 15, 'Plane')
ON CONFLICT (mode_code) DO NOTHING;

-- =============================================================================
-- PACKAGING MATERIAL SCORING
-- =============================================================================
CREATE TABLE IF NOT EXISTS packaging_material_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    material_code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,

    -- Eco scores
    base_score INTEGER NOT NULL CHECK (base_score >= 0 AND base_score <= 100),
    recyclable_bonus INTEGER DEFAULT 0,  -- Added if packaging is recyclable
    biodegradable_bonus INTEGER DEFAULT 0,  -- Added if biodegradable

    -- For comparison display
    co2_equivalent_kg DECIMAL(6,3),  -- CO2 equivalent per kg of material

    icon_name TEXT,
    color TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed packaging materials
INSERT INTO packaging_material_scoring (material_code, name_ru, name_en, base_score, recyclable_bonus, biodegradable_bonus, co2_equivalent_kg, icon_name, color) VALUES
    ('none', 'Без упаковки', 'No Packaging', 100, 0, 0, 0.0, 'Package', '#22C55E'),
    ('paper', 'Бумага', 'Paper', 85, 10, 5, 0.9, 'FileText', '#84CC16'),
    ('cardboard', 'Картон', 'Cardboard', 80, 10, 5, 1.1, 'Box', '#A3E635'),
    ('glass', 'Стекло', 'Glass', 70, 15, 0, 1.2, 'GlassWater', '#38BDF8'),
    ('metal_aluminum', 'Алюминий', 'Aluminum', 60, 20, 0, 8.1, 'Circle', '#94A3B8'),
    ('metal_steel', 'Сталь', 'Steel', 55, 15, 0, 2.0, 'Circle', '#64748B'),
    ('bioplastic', 'Биопластик', 'Bioplastic', 75, 5, 15, 2.5, 'Leaf', '#4ADE80'),
    ('plastic_recycled', 'Переработанный пластик', 'Recycled Plastic', 50, 10, 0, 1.5, 'Recycle', '#FACC15'),
    ('plastic_standard', 'Пластик', 'Standard Plastic', 25, 5, 0, 3.5, 'Box', '#F97316'),
    ('styrofoam', 'Пенопласт', 'Styrofoam', 10, 0, 0, 6.0, 'Square', '#EF4444'),
    ('mixed_non_recyclable', 'Смешанная (не перераб.)', 'Mixed Non-recyclable', 5, 0, 0, 4.5, 'XCircle', '#DC2626')
ON CONFLICT (material_code) DO NOTHING;

-- =============================================================================
-- PRODUCTION ENERGY SCORING
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_energy_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    energy_code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,

    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    co2_kg_per_kwh DECIMAL(6,4),  -- CO2 per kWh

    icon_name TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed energy sources
INSERT INTO production_energy_scoring (energy_code, name_ru, name_en, score, co2_kg_per_kwh, icon_name) VALUES
    ('solar', 'Солнечная энергия', 'Solar Power', 100, 0.02, 'Sun'),
    ('wind', 'Ветровая энергия', 'Wind Power', 98, 0.01, 'Wind'),
    ('hydro', 'Гидроэнергия', 'Hydropower', 95, 0.02, 'Waves'),
    ('geothermal', 'Геотермальная', 'Geothermal', 92, 0.04, 'Thermometer'),
    ('nuclear', 'Атомная', 'Nuclear', 80, 0.01, 'Atom'),
    ('biomass', 'Биомасса', 'Biomass', 70, 0.23, 'TreeDeciduous'),
    ('natural_gas', 'Природный газ', 'Natural Gas', 50, 0.45, 'Flame'),
    ('grid_mixed', 'Сеть (смешанная)', 'Grid (Mixed)', 40, 0.50, 'Plug'),
    ('coal', 'Уголь', 'Coal', 15, 1.00, 'Factory'),
    ('diesel', 'Дизель', 'Diesel Generator', 20, 0.85, 'Fuel')
ON CONFLICT (energy_code) DO NOTHING;

-- =============================================================================
-- ECO CERTIFICATION BONUSES
-- =============================================================================
-- Map existing certification_types to eco bonus points
CREATE TABLE IF NOT EXISTS eco_certification_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    certification_type_code TEXT NOT NULL,  -- References certification_types.code

    -- Bonus points for having this certification
    eco_bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (eco_bonus_points >= 0 AND eco_bonus_points <= 30),

    -- Display priority
    display_order INTEGER DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(certification_type_code)
);

-- Map eco-relevant certifications to bonus points
INSERT INTO eco_certification_bonuses (certification_type_code, eco_bonus_points, display_order) VALUES
    -- Strong eco certifications (max bonus)
    ('leaf_of_life', 30, 10),
    ('eco_product_ru', 28, 20),
    ('fsc', 25, 30),
    ('rainforest_alliance', 25, 40),

    -- Organic certifications (high bonus)
    ('organic_ru', 25, 50),
    ('organic_eu', 25, 60),
    ('usda_organic', 25, 70),
    ('ecocert', 25, 80),

    -- Quality standards with environmental component
    ('iso_22000', 10, 90),
    ('roskachestvo', 8, 100),

    -- Geographic origin (supports local production)
    ('pdo_ru', 15, 110),
    ('pgi_ru', 12, 120)
ON CONFLICT (certification_type_code) DO NOTHING;

-- =============================================================================
-- PRODUCT ECO DATA (Producer Input)
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_eco_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Transport data
    production_location_lat DECIMAL(10, 7),
    production_location_lng DECIMAL(10, 7),
    production_location_name TEXT,
    production_region TEXT,  -- Russian federal subject
    transport_distance_km INTEGER,
    transport_mode TEXT REFERENCES transport_mode_scoring(mode_code),
    uses_local_ingredients BOOLEAN DEFAULT false,
    local_ingredients_percentage INTEGER CHECK (local_ingredients_percentage >= 0 AND local_ingredients_percentage <= 100),

    -- Packaging data
    packaging_material TEXT REFERENCES packaging_material_scoring(material_code),
    packaging_is_recyclable BOOLEAN DEFAULT false,
    packaging_is_biodegradable BOOLEAN DEFAULT false,
    packaging_is_reusable BOOLEAN DEFAULT false,
    packaging_notes TEXT,

    -- Production data
    primary_energy_source TEXT REFERENCES production_energy_scoring(energy_code),
    secondary_energy_source TEXT REFERENCES production_energy_scoring(energy_code),
    renewable_energy_percentage INTEGER CHECK (renewable_energy_percentage >= 0 AND renewable_energy_percentage <= 100),
    has_waste_recycling BOOLEAN DEFAULT false,
    waste_recycling_percentage INTEGER CHECK (waste_recycling_percentage >= 0 AND waste_recycling_percentage <= 100),
    water_recycling_percentage INTEGER CHECK (water_recycling_percentage >= 0 AND water_recycling_percentage <= 100),
    uses_organic_materials BOOLEAN DEFAULT false,

    -- Optional detailed data (for advanced producers)
    carbon_footprint_kg DECIMAL(10, 3),  -- If producer has calculated this
    water_usage_liters DECIMAL(10, 3),
    production_notes TEXT,

    -- Verification
    data_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,

    -- Last update tracking
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(product_id)
);

-- =============================================================================
-- PRODUCT ECO SCORES (Calculated)
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_eco_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Individual scores (0-100 each)
    transport_score INTEGER CHECK (transport_score >= 0 AND transport_score <= 100),
    packaging_score INTEGER CHECK (packaging_score >= 0 AND packaging_score <= 100),
    production_score INTEGER CHECK (production_score >= 0 AND production_score <= 100),
    certification_score INTEGER CHECK (certification_score >= 0 AND certification_score <= 100),

    -- Weighted final score (0-100)
    total_score INTEGER CHECK (total_score >= 0 AND total_score <= 100),

    -- Eco grade (A-F like energy labels)
    eco_grade TEXT CHECK (eco_grade IN ('A+', 'A', 'B', 'C', 'D', 'E', 'F')),

    -- CO2 comparison data
    estimated_co2_kg DECIMAL(10, 3),  -- Total estimated CO2
    co2_vs_import_percentage DECIMAL(5, 2),  -- e.g., -40 means 40% less than import
    co2_saved_kg DECIMAL(10, 3),  -- CO2 saved vs typical import

    -- Category benchmarks
    category_average_score INTEGER,
    category_rank INTEGER,  -- Rank within category
    category_total_products INTEGER,  -- Total products in category

    -- Calculation metadata
    calculation_version INTEGER NOT NULL DEFAULT 1,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_completeness_percentage INTEGER,  -- How much eco data was provided

    UNIQUE(product_id)
);

-- =============================================================================
-- ORGANIZATION ECO PROFILE
-- =============================================================================
CREATE TABLE IF NOT EXISTS organization_eco_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Default values for new products
    default_production_location_lat DECIMAL(10, 7),
    default_production_location_lng DECIMAL(10, 7),
    default_production_location_name TEXT,
    default_production_region TEXT,

    default_transport_mode TEXT REFERENCES transport_mode_scoring(mode_code),
    default_packaging_material TEXT REFERENCES packaging_material_scoring(material_code),
    default_energy_source TEXT REFERENCES production_energy_scoring(energy_code),

    -- Organization-wide eco initiatives
    has_carbon_offset_program BOOLEAN DEFAULT false,
    has_sustainability_report BOOLEAN DEFAULT false,
    sustainability_report_url TEXT,
    eco_commitment_statement TEXT,

    -- Aggregate scores
    average_product_eco_score INTEGER,
    total_products_with_eco_data INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(organization_id)
);

-- =============================================================================
-- ECO COMPARISON BENCHMARKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS eco_category_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    category TEXT NOT NULL,  -- Product category

    -- Benchmark values (for comparison)
    avg_import_distance_km INTEGER DEFAULT 5000,
    avg_import_co2_kg DECIMAL(10, 3),
    avg_local_distance_km INTEGER DEFAULT 200,
    avg_local_co2_kg DECIMAL(10, 3),

    -- Score thresholds for grades
    grade_a_plus_min INTEGER DEFAULT 90,
    grade_a_min INTEGER DEFAULT 80,
    grade_b_min INTEGER DEFAULT 65,
    grade_c_min INTEGER DEFAULT 50,
    grade_d_min INTEGER DEFAULT 35,
    grade_e_min INTEGER DEFAULT 20,
    -- Below grade_e_min = F

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(category)
);

-- Seed some category benchmarks
INSERT INTO eco_category_benchmarks (category, avg_import_distance_km, avg_import_co2_kg, avg_local_distance_km, avg_local_co2_kg) VALUES
    ('food_dairy', 3000, 2.5, 150, 0.3),
    ('food_meat', 4000, 8.0, 200, 1.2),
    ('food_vegetables', 5000, 1.5, 50, 0.1),
    ('food_fruit', 6000, 2.0, 100, 0.2),
    ('food_bakery', 2000, 0.8, 30, 0.05),
    ('food_beverages', 4000, 1.2, 100, 0.15),
    ('food_honey', 3000, 0.5, 80, 0.08),
    ('cosmetics', 5000, 1.0, 300, 0.25),
    ('textiles', 8000, 15.0, 500, 3.0),
    ('crafts', 4000, 2.0, 200, 0.4)
ON CONFLICT (category) DO NOTHING;

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_eco_data_product ON product_eco_data(product_id);
CREATE INDEX idx_eco_scores_product ON product_eco_scores(product_id);
CREATE INDEX idx_eco_scores_grade ON product_eco_scores(eco_grade);
CREATE INDEX idx_eco_scores_total ON product_eco_scores(total_score DESC);
CREATE INDEX idx_org_eco_profile ON organization_eco_profile(organization_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to calculate eco score for a product
CREATE OR REPLACE FUNCTION calculate_product_eco_score(p_product_id UUID)
RETURNS product_eco_scores AS $$
DECLARE
    v_eco_data product_eco_data%ROWTYPE;
    v_product products%ROWTYPE;
    v_result product_eco_scores%ROWTYPE;
    v_transport_score INTEGER := 0;
    v_packaging_score INTEGER := 0;
    v_production_score INTEGER := 0;
    v_certification_score INTEGER := 0;
    v_total_score INTEGER := 0;
    v_eco_grade TEXT;
    v_estimated_co2 DECIMAL := 0;
    v_benchmark eco_category_benchmarks%ROWTYPE;
    v_data_completeness INTEGER := 0;
    v_cert_bonus INTEGER := 0;
BEGIN
    -- Get product and eco data
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    SELECT * INTO v_eco_data FROM product_eco_data WHERE product_id = p_product_id;

    IF v_eco_data.id IS NULL THEN
        -- No eco data, return empty score
        RETURN v_result;
    END IF;

    -- Calculate transport score
    IF v_eco_data.transport_distance_km IS NOT NULL THEN
        SELECT score INTO v_transport_score
        FROM transport_distance_scoring
        WHERE v_eco_data.transport_distance_km >= min_distance_km
          AND (max_distance_km IS NULL OR v_eco_data.transport_distance_km <= max_distance_km)
        LIMIT 1;

        v_data_completeness := v_data_completeness + 20;
    END IF;

    IF v_eco_data.transport_mode IS NOT NULL THEN
        SELECT (v_transport_score * score / 100) INTO v_transport_score
        FROM transport_mode_scoring
        WHERE mode_code = v_eco_data.transport_mode;

        v_data_completeness := v_data_completeness + 10;
    END IF;

    -- Calculate packaging score
    IF v_eco_data.packaging_material IS NOT NULL THEN
        SELECT
            base_score +
            CASE WHEN v_eco_data.packaging_is_recyclable THEN recyclable_bonus ELSE 0 END +
            CASE WHEN v_eco_data.packaging_is_biodegradable THEN biodegradable_bonus ELSE 0 END
        INTO v_packaging_score
        FROM packaging_material_scoring
        WHERE material_code = v_eco_data.packaging_material;

        -- Cap at 100
        v_packaging_score := LEAST(v_packaging_score, 100);
        v_data_completeness := v_data_completeness + 25;
    END IF;

    -- Calculate production score
    IF v_eco_data.primary_energy_source IS NOT NULL THEN
        SELECT score INTO v_production_score
        FROM production_energy_scoring
        WHERE energy_code = v_eco_data.primary_energy_source;

        v_data_completeness := v_data_completeness + 20;
    END IF;

    -- Add waste management bonus
    IF v_eco_data.has_waste_recycling THEN
        v_production_score := v_production_score + COALESCE(v_eco_data.waste_recycling_percentage, 50) / 5;
        v_data_completeness := v_data_completeness + 10;
    END IF;

    -- Cap production score at 100
    v_production_score := LEAST(v_production_score, 100);

    -- Calculate certification bonus
    SELECT COALESCE(SUM(ecb.eco_bonus_points), 0)
    INTO v_cert_bonus
    FROM producer_certifications pc
    JOIN certification_types ct ON ct.id = pc.certification_type_id
    LEFT JOIN eco_certification_bonuses ecb ON ecb.certification_type_code = ct.code
    WHERE pc.organization_id = v_product.organization_id
      AND pc.verification_status IN ('verified', 'auto_verified')
      AND (pc.expiry_date IS NULL OR pc.expiry_date >= CURRENT_DATE);

    -- Cap certification score at 100
    v_certification_score := LEAST(v_cert_bonus, 100);
    IF v_certification_score > 0 THEN
        v_data_completeness := v_data_completeness + 15;
    END IF;

    -- Calculate weighted total score
    v_total_score := (
        v_transport_score * 0.30 +
        v_packaging_score * 0.25 +
        v_production_score * 0.30 +
        v_certification_score * 0.15
    )::INTEGER;

    -- Determine eco grade
    SELECT
        CASE
            WHEN v_total_score >= COALESCE(grade_a_plus_min, 90) THEN 'A+'
            WHEN v_total_score >= COALESCE(grade_a_min, 80) THEN 'A'
            WHEN v_total_score >= COALESCE(grade_b_min, 65) THEN 'B'
            WHEN v_total_score >= COALESCE(grade_c_min, 50) THEN 'C'
            WHEN v_total_score >= COALESCE(grade_d_min, 35) THEN 'D'
            WHEN v_total_score >= COALESCE(grade_e_min, 20) THEN 'E'
            ELSE 'F'
        END
    INTO v_eco_grade
    FROM eco_category_benchmarks
    WHERE category = COALESCE(v_product.category, 'default')
    LIMIT 1;

    -- Default grade if no benchmark
    IF v_eco_grade IS NULL THEN
        v_eco_grade := CASE
            WHEN v_total_score >= 90 THEN 'A+'
            WHEN v_total_score >= 80 THEN 'A'
            WHEN v_total_score >= 65 THEN 'B'
            WHEN v_total_score >= 50 THEN 'C'
            WHEN v_total_score >= 35 THEN 'D'
            WHEN v_total_score >= 20 THEN 'E'
            ELSE 'F'
        END;
    END IF;

    -- Estimate CO2
    IF v_eco_data.carbon_footprint_kg IS NOT NULL THEN
        v_estimated_co2 := v_eco_data.carbon_footprint_kg;
    ELSIF v_eco_data.transport_distance_km IS NOT NULL THEN
        SELECT v_eco_data.transport_distance_km * co2_kg_per_km
        INTO v_estimated_co2
        FROM transport_distance_scoring
        WHERE v_eco_data.transport_distance_km >= min_distance_km
          AND (max_distance_km IS NULL OR v_eco_data.transport_distance_km <= max_distance_km)
        LIMIT 1;
    END IF;

    -- Upsert the score
    INSERT INTO product_eco_scores (
        product_id,
        transport_score,
        packaging_score,
        production_score,
        certification_score,
        total_score,
        eco_grade,
        estimated_co2_kg,
        data_completeness_percentage,
        calculated_at
    ) VALUES (
        p_product_id,
        v_transport_score,
        v_packaging_score,
        v_production_score,
        v_certification_score,
        v_total_score,
        v_eco_grade,
        v_estimated_co2,
        v_data_completeness,
        now()
    )
    ON CONFLICT (product_id) DO UPDATE SET
        transport_score = EXCLUDED.transport_score,
        packaging_score = EXCLUDED.packaging_score,
        production_score = EXCLUDED.production_score,
        certification_score = EXCLUDED.certification_score,
        total_score = EXCLUDED.total_score,
        eco_grade = EXCLUDED.eco_grade,
        estimated_co2_kg = EXCLUDED.estimated_co2_kg,
        data_completeness_percentage = EXCLUDED.data_completeness_percentage,
        calculated_at = EXCLUDED.calculated_at
    RETURNING * INTO v_result;

    -- Update eco data last calculated timestamp
    UPDATE product_eco_data
    SET last_calculated_at = now(), updated_at = now()
    WHERE product_id = p_product_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get eco comparison with imports
CREATE OR REPLACE FUNCTION get_eco_comparison(p_product_id UUID)
RETURNS TABLE (
    eco_grade TEXT,
    total_score INTEGER,
    estimated_co2_kg DECIMAL,
    import_avg_co2_kg DECIMAL,
    co2_saved_kg DECIMAL,
    co2_reduction_percentage INTEGER,
    transport_score INTEGER,
    packaging_score INTEGER,
    production_score INTEGER,
    certification_score INTEGER,
    data_completeness INTEGER
) AS $$
DECLARE
    v_product products%ROWTYPE;
    v_eco_score product_eco_scores%ROWTYPE;
    v_benchmark eco_category_benchmarks%ROWTYPE;
BEGIN
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    SELECT * INTO v_eco_score FROM product_eco_scores WHERE product_id = p_product_id;

    SELECT * INTO v_benchmark
    FROM eco_category_benchmarks
    WHERE category = COALESCE(v_product.category, 'default')
    LIMIT 1;

    RETURN QUERY SELECT
        v_eco_score.eco_grade,
        v_eco_score.total_score,
        v_eco_score.estimated_co2_kg,
        COALESCE(v_benchmark.avg_import_co2_kg, 5.0),
        COALESCE(v_benchmark.avg_import_co2_kg, 5.0) - COALESCE(v_eco_score.estimated_co2_kg, 0),
        CASE
            WHEN v_benchmark.avg_import_co2_kg > 0 AND v_eco_score.estimated_co2_kg IS NOT NULL
            THEN ((v_benchmark.avg_import_co2_kg - v_eco_score.estimated_co2_kg) / v_benchmark.avg_import_co2_kg * 100)::INTEGER
            ELSE NULL
        END,
        v_eco_score.transport_score,
        v_eco_score.packaging_score,
        v_eco_score.production_score,
        v_eco_score.certification_score,
        v_eco_score.data_completeness_percentage;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate score when eco data changes
CREATE OR REPLACE FUNCTION trigger_recalculate_eco_score()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_product_eco_score(NEW.product_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER eco_data_changed
    AFTER INSERT OR UPDATE ON product_eco_data
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_eco_score();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE eco_scoring_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_distance_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_mode_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_material_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_energy_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco_certification_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_eco_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_eco_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_eco_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco_category_benchmarks ENABLE ROW LEVEL SECURITY;

-- Reference tables: Public read
CREATE POLICY "Anyone can view eco scoring parameters"
    ON eco_scoring_parameters FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view transport distance scoring"
    ON transport_distance_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view transport mode scoring"
    ON transport_mode_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view packaging material scoring"
    ON packaging_material_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view production energy scoring"
    ON production_energy_scoring FOR SELECT USING (true);

CREATE POLICY "Anyone can view eco certification bonuses"
    ON eco_certification_bonuses FOR SELECT USING (true);

CREATE POLICY "Anyone can view category benchmarks"
    ON eco_category_benchmarks FOR SELECT USING (true);

-- Product eco data: Org members can manage, public can view
CREATE POLICY "Public can view product eco data"
    ON product_eco_data FOR SELECT USING (true);

CREATE POLICY "Org members can manage product eco data"
    ON product_eco_data FOR ALL USING (
        product_id IN (
            SELECT id FROM products
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'editor')
            )
        )
    );

-- Product eco scores: Public read
CREATE POLICY "Public can view product eco scores"
    ON product_eco_scores FOR SELECT USING (true);

CREATE POLICY "Service role manages eco scores"
    ON product_eco_scores FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Organization eco profile
CREATE POLICY "Public can view org eco profile"
    ON organization_eco_profile FOR SELECT USING (true);

CREATE POLICY "Org admins can manage eco profile"
    ON organization_eco_profile FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE eco_scoring_parameters IS 'Configuration for eco score calculation weights and parameters';
COMMENT ON TABLE transport_distance_scoring IS 'Distance brackets and their eco scores';
COMMENT ON TABLE transport_mode_scoring IS 'Transport modes and their environmental impact';
COMMENT ON TABLE packaging_material_scoring IS 'Packaging materials and their eco scores';
COMMENT ON TABLE production_energy_scoring IS 'Energy sources and their environmental impact';
COMMENT ON TABLE eco_certification_bonuses IS 'Maps certifications to eco bonus points';
COMMENT ON TABLE product_eco_data IS 'Producer-entered environmental data for products';
COMMENT ON TABLE product_eco_scores IS 'Calculated eco scores for products';
COMMENT ON TABLE organization_eco_profile IS 'Organization-level eco settings and defaults';
COMMENT ON TABLE eco_category_benchmarks IS 'Category benchmarks for eco comparisons';
COMMENT ON FUNCTION calculate_product_eco_score IS 'Calculates and stores eco score for a product';
COMMENT ON FUNCTION get_eco_comparison IS 'Returns eco score with import comparison data';
