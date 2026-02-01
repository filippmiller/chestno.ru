/**
 * Review Rewards System Types
 *
 * Types for the "Баллы за отзывы" system including:
 * - Partner rewards catalog
 * - Points calculation
 * - Redemption tracking
 */

// =============================================================================
// ENUMS
// =============================================================================

export type PartnerCategory =
  | 'ecommerce'
  | 'food'
  | 'entertainment'
  | 'services'
  | 'travel'
  | 'education'

export type RewardType =
  | 'discount_percent'
  | 'discount_fixed'
  | 'freebie'
  | 'subscription'
  | 'cashback'
  | 'exclusive_access'

export type RedemptionStatus = 'active' | 'used' | 'expired' | 'cancelled'

// =============================================================================
// QUALITY SCORING
// =============================================================================

export interface ReviewQualityConfig {
  config_version: number
  base_points: number
  min_words_for_bonus: number
  words_tier_1: number
  words_tier_1_bonus: number
  words_tier_2: number
  words_tier_2_bonus: number
  words_tier_3: number
  words_tier_3_bonus: number
  photo_bonus: number
  photo_max_count: number
  video_bonus: number
  verified_purchase_bonus: number
  helpful_vote_bonus: number
  helpful_vote_max: number
  daily_review_limit: number
  weekly_review_limit: number
  min_account_age_days: number
  min_words_for_points: number
}

export interface ReviewQualityBreakdown {
  word_count: number
  photo_count: number
  video_count: number
  is_verified_purchase: boolean
  helpful_votes: number
  quality_score: number
  base_points: number
  length_bonus: number
  photo_bonus: number
  video_bonus: number
  verified_bonus: number
  helpful_bonus: number
  total_points: number
  length_tier: 'none' | 'minimal' | 'basic' | 'medium' | 'detailed'
}

export interface PointsCalculationRequest {
  word_count: number
  photo_count?: number
  video_count?: number
  is_verified_purchase?: boolean
  helpful_votes?: number
}

export interface PointsCalculationResponse {
  breakdown: ReviewQualityBreakdown
  config: ReviewQualityConfig
}

// =============================================================================
// PARTNERS
// =============================================================================

export interface RewardPartner {
  id: string
  name: string
  slug: string
  logo_url?: string
  description?: string
  website_url?: string
  category: PartnerCategory
  is_active: boolean
  priority: number
}

export interface RewardPartnerListResponse {
  partners: RewardPartner[]
  total: number
}

// =============================================================================
// REWARDS CATALOG
// =============================================================================

export interface RewardItem {
  id: string
  partner_id: string
  partner_name: string
  partner_logo_url?: string
  title: string
  description?: string
  terms?: string
  reward_type: RewardType
  discount_percent?: number
  discount_amount?: number // In kopeks
  min_purchase_amount?: number
  points_cost: number
  is_active: boolean
  stock_remaining?: number
  max_per_user: number
  valid_days: number
  image_url?: string
  available_from?: string
  available_until?: string
  // User context
  user_can_afford: boolean
  user_redemptions_count: number
  user_can_redeem: boolean
}

export interface RewardCatalogResponse {
  rewards: RewardItem[]
  total: number
  categories: PartnerCategory[]
}

// =============================================================================
// REDEMPTIONS
// =============================================================================

export interface RewardRedemption {
  id: string
  user_id: string
  reward_id: string
  reward_title: string
  partner_name: string
  partner_logo_url?: string
  reward_type: RewardType
  points_spent: number
  voucher_code: string
  status: RedemptionStatus
  used_at?: string
  expires_at: string
  created_at: string
}

export interface RedemptionHistoryResponse {
  redemptions: RewardRedemption[]
  total: number
  has_more: boolean
}

export interface RedeemRewardResponse {
  success: boolean
  redemption?: RewardRedemption
  error?: string
  new_balance: number
}

// =============================================================================
// RATE LIMITING
// =============================================================================

export interface RateLimitStatus {
  allowed: boolean
  reason?: 'cooldown' | 'daily_limit' | 'weekly_limit' | 'flagged' | 'account_too_new'
  daily_remaining?: number
  weekly_remaining?: number
  daily_limit: number
  weekly_limit: number
  cooldown_until?: string
  is_flagged: boolean
  flag_reason?: string
}

// =============================================================================
// USER OVERVIEW
// =============================================================================

export interface UserRewardsOverview {
  current_points: number
  lifetime_points: number
  points_spent: number
  total_reviews: number
  reviews_earning_points: number
  average_quality_score: number
  active_vouchers: number
  used_vouchers: number
  expired_vouchers: number
  rate_limit_status: RateLimitStatus
  recent_redemptions: RewardRedemption[]
  suggested_rewards: RewardItem[]
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  ecommerce: 'Маркетплейсы',
  food: 'Еда и рестораны',
  entertainment: 'Развлечения',
  services: 'Сервисы',
  travel: 'Путешествия',
  education: 'Образование',
}

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  discount_percent: 'Скидка %',
  discount_fixed: 'Скидка',
  freebie: 'Подарок',
  subscription: 'Подписка',
  cashback: 'Кэшбэк',
  exclusive_access: 'Эксклюзив',
}

export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  active: 'Активен',
  used: 'Использован',
  expired: 'Истёк',
  cancelled: 'Отменён',
}

export const LENGTH_TIER_LABELS: Record<string, string> = {
  none: 'Слишком коротко',
  minimal: 'Минимальный',
  basic: 'Базовый',
  medium: 'Средний',
  detailed: 'Подробный',
}

/**
 * Format kopeks as rubles
 */
export function formatRubles(kopeks: number): string {
  const rubles = kopeks / 100
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(rubles)
}

/**
 * Get reward value display string
 */
export function getRewardValueDisplay(reward: RewardItem): string {
  switch (reward.reward_type) {
    case 'discount_percent':
      return `-${reward.discount_percent}%`
    case 'discount_fixed':
      return reward.discount_amount ? formatRubles(reward.discount_amount) : 'Скидка'
    case 'subscription':
      return 'Подписка'
    case 'freebie':
      return 'Бесплатно'
    case 'cashback':
      return reward.discount_percent ? `${reward.discount_percent}% кэшбэк` : 'Кэшбэк'
    case 'exclusive_access':
      return 'Эксклюзив'
    default:
      return 'Награда'
  }
}
