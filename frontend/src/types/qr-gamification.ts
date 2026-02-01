/**
 * QR Code Gamification System Types
 *
 * Separate from the review-based loyalty system.
 * This is for consumer engagement through QR scanning.
 */

// =============================================================================
// TIERS
// =============================================================================

export type QrScanTier = 'none' | 'bronze' | 'silver' | 'gold'

export interface TierDefinition {
  tier: QrScanTier
  threshold: number
  name_ru: string
  name_en: string
  color: string
  icon: string
  benefits_ru: string[]
  benefits_en: string[]
}

export const QR_TIER_CONFIG: Record<QrScanTier, TierDefinition> = {
  none: {
    tier: 'none',
    threshold: 0,
    name_ru: 'Новичок',
    name_en: 'Newcomer',
    color: '#6B7280',
    icon: 'user',
    benefits_ru: ['Базовое сканирование'],
    benefits_en: ['Basic scanning'],
  },
  bronze: {
    tier: 'bronze',
    threshold: 5,
    name_ru: 'Бронза',
    name_en: 'Bronze',
    color: '#CD7F32',
    icon: 'award',
    benefits_ru: [
      'Бронзовый сертификат',
      'Доступ к базовым наградам',
      '+10% к очкам за сканирование',
    ],
    benefits_en: [
      'Bronze certificate',
      'Access to basic rewards',
      '+10% scan points',
    ],
  },
  silver: {
    tier: 'silver',
    threshold: 20,
    name_ru: 'Серебро',
    name_en: 'Silver',
    color: '#C0C0C0',
    icon: 'star',
    benefits_ru: [
      'Серебряный сертификат',
      'Ранний доступ к бета-функциям',
      '+25% к очкам за сканирование',
      'Эксклюзивные скидки от партнеров',
    ],
    benefits_en: [
      'Silver certificate',
      'Early access to beta features',
      '+25% scan points',
      'Exclusive partner discounts',
    ],
  },
  gold: {
    tier: 'gold',
    threshold: 50,
    name_ru: 'Золото',
    name_en: 'Gold',
    color: '#FFD700',
    icon: 'trophy',
    benefits_ru: [
      'Золотой сертификат',
      'VIP-доступ к новым функциям',
      '+50% к очкам за сканирование',
      'Премиум-скидки от партнеров',
      'Возможность выиграть призы',
    ],
    benefits_en: [
      'Gold certificate',
      'VIP access to new features',
      '+50% scan points',
      'Premium partner discounts',
      'Prize eligibility',
    ],
  },
}

export const QR_TIER_THRESHOLDS: Record<QrScanTier, number> = {
  none: 0,
  bronze: 5,
  silver: 20,
  gold: 50,
}

// =============================================================================
// SCANNER PROFILE
// =============================================================================

export interface QrScannerProfile {
  id: string
  user_id: string

  // Stats
  total_scans: number
  unique_products_scanned: number
  unique_organizations_scanned: number

  // Tier
  current_tier: QrScanTier
  tier_achieved_at: string | null

  // Monthly
  scans_this_month: number
  month_start: string

  // Streaks
  current_streak_days: number
  longest_streak_days: number
  last_scan_date: string | null

  // Timestamps
  created_at: string
  updated_at: string

  // Computed (added by API)
  next_tier: QrScanTier | null
  scans_to_next_tier: number | null
  tier_progress_percent: number
}

// =============================================================================
// SCAN HISTORY
// =============================================================================

export type ScanType = 'product' | 'organization' | 'marketing' | 'review_request'

export interface QrScanHistoryEntry {
  id: string
  user_id: string
  organization_id: string | null
  product_id: string | null
  qr_code_id: string | null
  scan_type: ScanType
  points_awarded: number
  latitude: number | null
  longitude: number | null
  city: string | null
  scanned_at: string

  // Joined data (optional)
  organization_name?: string
  product_name?: string
}

// =============================================================================
// ACHIEVEMENTS
// =============================================================================

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface AchievementCriteria {
  type:
    | 'total_scans'
    | 'unique_organizations'
    | 'unique_products'
    | 'streak_days'
    | 'category_scans'
    | 'time_based'
    | 'weekend_scans'
    | 'review_after_scan'
  threshold?: number
  category?: string
  condition?: string
}

export interface QrAchievement {
  id: string
  code: string
  name_ru: string
  name_en: string
  description_ru: string
  description_en: string
  icon: string
  badge_color: string
  criteria: AchievementCriteria
  points_reward: number
  rarity: AchievementRarity
  sort_order: number
  is_active: boolean
}

export interface UserQrAchievement {
  id: string
  user_id: string
  achievement_id: string
  earned_at: string
  progress_value: number
  is_seen: boolean

  // Joined data
  achievement?: QrAchievement
}

// =============================================================================
// REWARDS
// =============================================================================

export type RewardType =
  | 'discount_code'
  | 'early_access'
  | 'certification_pdf'
  | 'premium_feature'
  | 'physical_badge'
  | 'partner_offer'

export interface QrReward {
  id: string
  code: string
  name_ru: string
  name_en: string
  description_ru: string
  description_en: string
  reward_type: RewardType
  required_tier: QrScanTier
  points_cost: number
  reward_data: Record<string, unknown>
  total_available: number | null
  claimed_count: number
  available_from: string
  available_until: string | null
  partner_organization_id: string | null
  is_active: boolean

  // Computed
  is_available: boolean
  remaining: number | null

  // Joined data
  partner_name?: string
}

export interface UserClaimedReward {
  id: string
  user_id: string
  reward_id: string
  claimed_at: string
  points_spent: number
  claim_data: Record<string, unknown>
  redeemed_at: string | null
  expires_at: string | null

  // Joined data
  reward?: QrReward
}

// =============================================================================
// LEADERBOARDS
// =============================================================================

export type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly'

export interface QrLeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  avatar_url: string | null
  total_scans: number
  scans_this_period: number
  tier: QrScanTier
  unique_organizations: number
}

export interface QrLeaderboardResponse {
  entries: QrLeaderboardEntry[]
  user_entry: QrLeaderboardEntry | null
  total_participants: number
  period: LeaderboardPeriod
  period_label: string
}

export interface MonthlyLeaderboardEntry {
  year: number
  month: number
  user_id: string
  rank: number
  scans_count: number
  unique_products: number
  unique_organizations: number
  prize_awarded: string | null
  prize_claimed_at: string | null

  // Joined
  display_name?: string
  avatar_url?: string
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ScanResultResponse {
  scan_id: string
  new_tier: QrScanTier
  tier_changed: boolean
  new_achievements: QrAchievement[]
  points_earned: number
  profile: QrScannerProfile
}

export interface GamificationDashboardResponse {
  profile: QrScannerProfile
  recent_scans: QrScanHistoryEntry[]
  achievements: {
    earned: UserQrAchievement[]
    available: QrAchievement[]
    progress: Record<string, { current: number; required: number }>
  }
  available_rewards: QrReward[]
  claimed_rewards: UserClaimedReward[]
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: '#9CA3AF',
  uncommon: '#22C55E',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
}

export const RARITY_LABELS_RU: Record<AchievementRarity, string> = {
  common: 'Обычное',
  uncommon: 'Необычное',
  rare: 'Редкое',
  epic: 'Эпическое',
  legendary: 'Легендарное',
}

export const SCAN_TYPE_LABELS_RU: Record<ScanType, string> = {
  product: 'Товар',
  organization: 'Компания',
  marketing: 'Маркетинг',
  review_request: 'Запрос отзыва',
}

export const REWARD_TYPE_LABELS_RU: Record<RewardType, string> = {
  discount_code: 'Промокод',
  early_access: 'Ранний доступ',
  certification_pdf: 'Сертификат',
  premium_feature: 'Премиум',
  physical_badge: 'Физический значок',
  partner_offer: 'Партнерское предложение',
}

// Helper functions
export function getTierFromScans(scans: number): QrScanTier {
  if (scans >= 50) return 'gold'
  if (scans >= 20) return 'silver'
  if (scans >= 5) return 'bronze'
  return 'none'
}

export function getNextTier(current: QrScanTier): QrScanTier | null {
  const order: QrScanTier[] = ['none', 'bronze', 'silver', 'gold']
  const idx = order.indexOf(current)
  if (idx < order.length - 1) return order[idx + 1]
  return null
}

export function getScansToNextTier(scans: number, currentTier: QrScanTier): number | null {
  const nextTier = getNextTier(currentTier)
  if (!nextTier) return null
  return QR_TIER_THRESHOLDS[nextTier] - scans
}

export function getTierProgress(scans: number, currentTier: QrScanTier): number {
  const nextTier = getNextTier(currentTier)
  if (!nextTier) return 100

  const currentThreshold = QR_TIER_THRESHOLDS[currentTier]
  const nextThreshold = QR_TIER_THRESHOLDS[nextTier]
  const progress = ((scans - currentThreshold) / (nextThreshold - currentThreshold)) * 100

  return Math.min(100, Math.max(0, progress))
}
