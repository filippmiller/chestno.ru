// Environmental Impact Scoring Types

export type EcoGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export type EcoCategory =
  | 'transport'
  | 'packaging'
  | 'production'
  | 'certification'
  | 'sourcing'

export interface EcoScoringParameter {
  id: string
  parameter_code: string
  category: EcoCategory
  name_ru: string
  name_en: string
  description_ru?: string | null
  description_en?: string | null
  max_points: number
  weight: number
  icon_name?: string | null
  display_order: number
  is_active: boolean
}

export interface TransportDistanceScoring {
  id: string
  min_distance_km: number
  max_distance_km?: number | null
  score: number
  co2_kg_per_km: number
  label_ru: string
  label_en: string
}

export interface TransportModeScoring {
  id: string
  mode_code: string
  name_ru: string
  name_en: string
  co2_multiplier: number
  score: number
  icon_name?: string | null
}

export interface PackagingMaterialScoring {
  id: string
  material_code: string
  name_ru: string
  name_en: string
  base_score: number
  recyclable_bonus: number
  biodegradable_bonus: number
  co2_equivalent_kg?: number | null
  icon_name?: string | null
  color?: string | null
}

export interface ProductionEnergyScoring {
  id: string
  energy_code: string
  name_ru: string
  name_en: string
  score: number
  co2_kg_per_kwh?: number | null
  icon_name?: string | null
}

export interface ProductEcoData {
  id: string
  product_id: string

  // Transport
  production_location_lat?: number | null
  production_location_lng?: number | null
  production_location_name?: string | null
  production_region?: string | null
  transport_distance_km?: number | null
  transport_mode?: string | null
  uses_local_ingredients: boolean
  local_ingredients_percentage?: number | null

  // Packaging
  packaging_material?: string | null
  packaging_is_recyclable: boolean
  packaging_is_biodegradable: boolean
  packaging_is_reusable: boolean
  packaging_notes?: string | null

  // Production
  primary_energy_source?: string | null
  secondary_energy_source?: string | null
  renewable_energy_percentage?: number | null
  has_waste_recycling: boolean
  waste_recycling_percentage?: number | null
  water_recycling_percentage?: number | null
  uses_organic_materials: boolean

  // Optional detailed data
  carbon_footprint_kg?: number | null
  water_usage_liters?: number | null
  production_notes?: string | null

  // Verification
  data_verified: boolean
  verified_at?: string | null

  last_calculated_at?: string | null
  created_at: string
  updated_at: string
}

export interface ProductEcoScore {
  id: string
  product_id: string

  // Individual scores
  transport_score?: number | null
  packaging_score?: number | null
  production_score?: number | null
  certification_score?: number | null

  // Overall
  total_score?: number | null
  eco_grade?: EcoGrade | null

  // CO2 data
  estimated_co2_kg?: number | null
  co2_vs_import_percentage?: number | null
  co2_saved_kg?: number | null

  // Category comparison
  category_average_score?: number | null
  category_rank?: number | null
  category_total_products?: number | null

  // Meta
  data_completeness_percentage?: number | null
  calculated_at: string
}

export interface EcoComparison {
  eco_grade: EcoGrade | null
  total_score: number | null
  estimated_co2_kg: number | null
  import_avg_co2_kg: number | null
  co2_saved_kg: number | null
  co2_reduction_percentage: number | null
  transport_score: number | null
  packaging_score: number | null
  production_score: number | null
  certification_score: number | null
  data_completeness: number | null
}

export interface OrganizationEcoProfile {
  id: string
  organization_id: string

  // Defaults
  default_production_location_lat?: number | null
  default_production_location_lng?: number | null
  default_production_location_name?: string | null
  default_production_region?: string | null
  default_transport_mode?: string | null
  default_packaging_material?: string | null
  default_energy_source?: string | null

  // Initiatives
  has_carbon_offset_program: boolean
  has_sustainability_report: boolean
  sustainability_report_url?: string | null
  eco_commitment_statement?: string | null

  // Aggregates
  average_product_eco_score?: number | null
  total_products_with_eco_data?: number | null

  created_at: string
  updated_at: string
}

// Form input types
export interface ProductEcoDataInput {
  production_location_lat?: number
  production_location_lng?: number
  production_location_name?: string
  production_region?: string
  transport_distance_km?: number
  transport_mode?: string
  uses_local_ingredients?: boolean
  local_ingredients_percentage?: number

  packaging_material?: string
  packaging_is_recyclable?: boolean
  packaging_is_biodegradable?: boolean
  packaging_is_reusable?: boolean
  packaging_notes?: string

  primary_energy_source?: string
  secondary_energy_source?: string
  renewable_energy_percentage?: number
  has_waste_recycling?: boolean
  waste_recycling_percentage?: number
  water_recycling_percentage?: number
  uses_organic_materials?: boolean

  carbon_footprint_kg?: number
  water_usage_liters?: number
  production_notes?: string
}

// Display helpers
export const ECO_GRADE_CONFIG: Record<EcoGrade, {
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  label: string
  description: string
}> = {
  'A+': {
    color: '#059669',
    bgColor: 'bg-emerald-100 dark:bg-emerald-950',
    textColor: 'text-emerald-800 dark:text-emerald-100',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    label: 'Превосходно',
    description: 'Минимальный экологический след',
  },
  'A': {
    color: '#10B981',
    bgColor: 'bg-green-100 dark:bg-green-950',
    textColor: 'text-green-800 dark:text-green-100',
    borderColor: 'border-green-300 dark:border-green-700',
    label: 'Отлично',
    description: 'Очень низкое воздействие на окружающую среду',
  },
  'B': {
    color: '#84CC16',
    bgColor: 'bg-lime-100 dark:bg-lime-950',
    textColor: 'text-lime-800 dark:text-lime-100',
    borderColor: 'border-lime-300 dark:border-lime-700',
    label: 'Хорошо',
    description: 'Низкий углеродный след',
  },
  'C': {
    color: '#EAB308',
    bgColor: 'bg-yellow-100 dark:bg-yellow-950',
    textColor: 'text-yellow-800 dark:text-yellow-100',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    label: 'Удовлетворительно',
    description: 'Средний уровень воздействия',
  },
  'D': {
    color: '#F97316',
    bgColor: 'bg-orange-100 dark:bg-orange-950',
    textColor: 'text-orange-800 dark:text-orange-100',
    borderColor: 'border-orange-300 dark:border-orange-700',
    label: 'Ниже среднего',
    description: 'Повышенный экологический след',
  },
  'E': {
    color: '#EF4444',
    bgColor: 'bg-red-100 dark:bg-red-950',
    textColor: 'text-red-800 dark:text-red-100',
    borderColor: 'border-red-300 dark:border-red-700',
    label: 'Плохо',
    description: 'Высокое воздействие на окружающую среду',
  },
  'F': {
    color: '#DC2626',
    bgColor: 'bg-red-200 dark:bg-red-900',
    textColor: 'text-red-900 dark:text-red-100',
    borderColor: 'border-red-400 dark:border-red-600',
    label: 'Очень плохо',
    description: 'Максимальный экологический след',
  },
}

export const RUSSIAN_REGIONS = [
  'Москва',
  'Московская область',
  'Санкт-Петербург',
  'Ленинградская область',
  'Краснодарский край',
  'Ростовская область',
  'Татарстан',
  'Свердловская область',
  'Новосибирская область',
  'Воронежская область',
  'Нижегородская область',
  'Самарская область',
  'Челябинская область',
  'Башкортостан',
  'Пермский край',
  'Волгоградская область',
  'Красноярский край',
  'Саратовская область',
  'Тюменская область',
  'Алтайский край',
  // Add more as needed
] as const
