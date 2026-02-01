/**
 * Trust Preferences Types
 *
 * Types for personalized trust factor weighting system.
 * Allows users to customize how trust is calculated based on their priorities.
 */

// =============================================================================
// Enums & Categories
// =============================================================================

export type TrustFactorCategory =
  | 'ethical'      // Vegan, fair-trade, cruelty-free
  | 'quality'      // Certifications, standards
  | 'origin'       // Local, regional, country
  | 'environmental' // Eco, sustainable, carbon neutral
  | 'health'       // Organic, allergen-free, dietary
  | 'social'       // Small business, women-owned
  | 'transparency' // Supply chain visibility

// =============================================================================
// Trust Factors (Reference Data)
// =============================================================================

export interface TrustFactor {
  id: string
  code: string
  category: TrustFactorCategory
  name_ru: string
  name_en: string
  description_ru?: string
  description_en?: string
  icon?: string
  color: string
  default_weight: number
  min_weight: number
  max_weight: number
  auto_computable: boolean
  is_active: boolean
  display_order: number
}

// Grouped factors for UI display
export interface TrustFactorGroup {
  category: TrustFactorCategory
  label_ru: string
  label_en: string
  factors: TrustFactor[]
}

// =============================================================================
// Preference Profiles (Presets)
// =============================================================================

export interface TrustPreferenceProfile {
  id: string
  code: string
  name_ru: string
  name_en: string
  description_ru?: string
  description_en?: string
  icon?: string
  color: string
  weights: Record<string, number>  // factor_code -> weight (0-100)
  is_system: boolean
  is_featured: boolean
  usage_count: number
  is_active: boolean
  display_order: number
}

// =============================================================================
// User Preferences
// =============================================================================

export interface UserTrustPreferences {
  id: string
  user_id?: string
  profile_id?: string
  profile?: TrustPreferenceProfile
  custom_weights: Record<string, number>
  use_custom_weights: boolean
  show_trust_scores: boolean
  highlight_matching: boolean
  sort_by_trust_score: boolean
  filter_threshold: number
  active_filters: string[]
  onboarding_completed: boolean
  onboarding_skipped: boolean
  device_fingerprint?: string
  created_at: string
  updated_at: string
}

// Create/Update payloads
export interface UserTrustPreferencesCreate {
  profile_id?: string
  custom_weights?: Record<string, number>
  use_custom_weights?: boolean
  show_trust_scores?: boolean
  highlight_matching?: boolean
  sort_by_trust_score?: boolean
  filter_threshold?: number
  active_filters?: string[]
  device_fingerprint?: string
}

export interface UserTrustPreferencesUpdate {
  profile_id?: string
  custom_weights?: Record<string, number>
  use_custom_weights?: boolean
  show_trust_scores?: boolean
  highlight_matching?: boolean
  sort_by_trust_score?: boolean
  filter_threshold?: number
  active_filters?: string[]
  onboarding_completed?: boolean
  onboarding_skipped?: boolean
}

// =============================================================================
// Anonymous Preferences (localStorage)
// =============================================================================

export interface AnonymousTrustPreferences {
  profile_code?: string
  custom_weights: Record<string, number>
  use_custom_weights: boolean
  show_trust_scores: boolean
  highlight_matching: boolean
  sort_by_trust_score: boolean
  filter_threshold: number
  active_filters: string[]
  onboarding_completed: boolean
  onboarding_skipped: boolean
  device_fingerprint: string
  last_updated: string
}

// =============================================================================
// Trust Scores
// =============================================================================

export interface ProductTrustScore {
  id: string
  product_id: string
  factor_scores: Record<string, number>  // factor_code -> score (0-100)
  overall_score: number
  strong_factors: string[]
  computed_at: string
}

export interface OrganizationTrustScore {
  id: string
  organization_id: string
  factor_scores: Record<string, number>
  overall_score: number
  strong_factors: string[]
  computed_at: string
}

// Personalized score (computed against user preferences)
export interface PersonalizedTrustScore {
  personalized_score: number
  factor_matches: Record<string, {
    product_score: number
    user_weight: number
  }>
  strong_match_count: number
}

// =============================================================================
// UI Components Props
// =============================================================================

// Weight slider with factor details
export interface FactorWeightConfig {
  factor: TrustFactor
  weight: number
  onChange: (weight: number) => void
}

// Profile card
export interface ProfileCardProps {
  profile: TrustPreferenceProfile
  isSelected: boolean
  onSelect: (profile: TrustPreferenceProfile) => void
}

// Trust score badge
export interface TrustScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

// Factor match indicator
export interface FactorMatchProps {
  factor: TrustFactor
  productScore: number
  userWeight: number
  isMatch: boolean
}

// =============================================================================
// Onboarding
// =============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'select_profile'
  | 'customize_weights'
  | 'preview_results'
  | 'complete'

export interface OnboardingState {
  currentStep: OnboardingStep
  selectedProfile?: TrustPreferenceProfile
  customWeights: Record<string, number>
  useCustomWeights: boolean
}

// =============================================================================
// API Responses
// =============================================================================

export interface TrustFactorsResponse {
  factors: TrustFactor[]
  groups: TrustFactorGroup[]
}

export interface TrustProfilesResponse {
  profiles: TrustPreferenceProfile[]
  featured: TrustPreferenceProfile[]
}

export interface TrustScoreSearchParams {
  category?: string
  min_score?: number
  factors?: string[]  // Required factors
  sort_by?: 'score' | 'relevance' | 'date'
  limit?: number
  offset?: number
}

export interface TrustScoreSearchResult {
  product_id: string
  product_name: string
  product_slug: string
  product_image?: string
  organization_name: string
  personalized_score: number
  matching_factors: string[]
  strong_match_count: number
}

export interface TrustScoreSearchResponse {
  results: TrustScoreSearchResult[]
  total: number
  limit: number
  offset: number
}

// =============================================================================
// Category Display Config
// =============================================================================

export const TRUST_CATEGORY_CONFIG: Record<TrustFactorCategory, {
  label_ru: string
  label_en: string
  icon: string
  color: string
  description_ru: string
  description_en: string
}> = {
  ethical: {
    label_ru: 'Этика',
    label_en: 'Ethics',
    icon: 'heart',
    color: '#EC4899',
    description_ru: 'Веганские, справедливые и гуманные продукты',
    description_en: 'Vegan, fair-trade, and humane products',
  },
  quality: {
    label_ru: 'Качество',
    label_en: 'Quality',
    icon: 'badge-check',
    color: '#3B82F6',
    description_ru: 'Сертификаты и стандарты качества',
    description_en: 'Quality certifications and standards',
  },
  origin: {
    label_ru: 'Происхождение',
    label_en: 'Origin',
    icon: 'map-pin',
    color: '#8B5CF6',
    description_ru: 'Местное и региональное производство',
    description_en: 'Local and regional production',
  },
  environmental: {
    label_ru: 'Экология',
    label_en: 'Environmental',
    icon: 'globe',
    color: '#22C55E',
    description_ru: 'Экологичность и устойчивость',
    description_en: 'Eco-friendly and sustainable',
  },
  health: {
    label_ru: 'Здоровье',
    label_en: 'Health',
    icon: 'heart',
    color: '#EF4444',
    description_ru: 'Диетические и здоровые продукты',
    description_en: 'Dietary and healthy products',
  },
  social: {
    label_ru: 'Социальное',
    label_en: 'Social',
    icon: 'users',
    color: '#F59E0B',
    description_ru: 'Поддержка малого бизнеса',
    description_en: 'Support for small businesses',
  },
  transparency: {
    label_ru: 'Прозрачность',
    label_en: 'Transparency',
    icon: 'eye',
    color: '#0EA5E9',
    description_ru: 'Открытость и прослеживаемость',
    description_en: 'Openness and traceability',
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compute weighted score from factor scores and user weights
 */
export function computePersonalizedScore(
  factorScores: Record<string, number>,
  userWeights: Record<string, number>
): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const [factorCode, userWeight] of Object.entries(userWeights)) {
    if (userWeight > 0) {
      const factorScore = factorScores[factorCode] ?? 0
      totalWeight += userWeight
      weightedSum += factorScore * userWeight
    }
  }

  if (totalWeight === 0) return 0
  return Math.round(weightedSum / totalWeight)
}

/**
 * Get score color based on value
 */
export function getTrustScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'  // Green
  if (score >= 60) return '#84CC16'  // Lime
  if (score >= 40) return '#F59E0B'  // Amber
  if (score >= 20) return '#F97316'  // Orange
  return '#EF4444'  // Red
}

/**
 * Get score label
 */
export function getTrustScoreLabel(score: number, lang: 'ru' | 'en' = 'ru'): string {
  if (score >= 80) return lang === 'ru' ? 'Отлично' : 'Excellent'
  if (score >= 60) return lang === 'ru' ? 'Хорошо' : 'Good'
  if (score >= 40) return lang === 'ru' ? 'Средне' : 'Average'
  if (score >= 20) return lang === 'ru' ? 'Ниже среднего' : 'Below Average'
  return lang === 'ru' ? 'Низкий' : 'Low'
}

/**
 * Generate device fingerprint for anonymous user tracking
 */
export function generateDeviceFingerprint(): string {
  const nav = window.navigator
  const screen = window.screen

  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || 0,
    (nav as any).deviceMemory || 0,
  ].join('|')

  // Simple hash
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`
}

/**
 * Default anonymous preferences
 */
export function getDefaultAnonymousPreferences(): AnonymousTrustPreferences {
  return {
    custom_weights: {},
    use_custom_weights: false,
    show_trust_scores: true,
    highlight_matching: true,
    sort_by_trust_score: false,
    filter_threshold: 80,
    active_filters: [],
    onboarding_completed: false,
    onboarding_skipped: false,
    device_fingerprint: generateDeviceFingerprint(),
    last_updated: new Date().toISOString(),
  }
}
