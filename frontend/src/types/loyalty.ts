/**
 * Loyalty Points System Types
 */

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export type PointsActionType =
  | 'review_submitted'
  | 'review_approved'
  | 'review_with_photo'
  | 'review_with_video'
  | 'review_helpful_vote'
  | 'first_review'
  | 'streak_bonus'
  | 'profile_completed'
  | 'referral_bonus'
  | 'points_redeemed'
  | 'admin_adjustment'
  | 'points_expired'

export interface TierBenefits {
  points_multiplier: number
  badge_color: string
  badge_name_ru: string
  badge_name_en: string
}

export interface PointsTransaction {
  id: string
  user_id: string
  action_type: PointsActionType
  points: number
  balance_after: number
  description?: string
  reference_id?: string
  reference_type?: string
  created_at: string
}

export interface UserLoyaltyProfile {
  user_id: string
  total_points: number
  lifetime_points: number
  current_tier: LoyaltyTier
  next_tier?: LoyaltyTier
  points_to_next_tier?: number
  tier_progress_percent: number
  review_count: number
  helpful_votes_received: number
  current_streak_weeks: number
  longest_streak_weeks: number
  tier_benefits: TierBenefits
  created_at: string
  updated_at: string
}

export interface UserLoyaltyResponse {
  profile: UserLoyaltyProfile
  recent_transactions: PointsTransaction[]
}

export interface PointsHistoryResponse {
  transactions: PointsTransaction[]
  total: number
  has_more: boolean
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  avatar_url?: string
  total_points: number
  tier: LoyaltyTier
  review_count: number
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  user_rank?: number
  total_users: number
  period: 'all_time' | 'monthly' | 'weekly'
}

// Tier configuration
export const TIER_CONFIG: Record<LoyaltyTier, TierBenefits> = {
  bronze: {
    points_multiplier: 1.0,
    badge_color: '#CD7F32',
    badge_name_ru: 'Бронза',
    badge_name_en: 'Bronze',
  },
  silver: {
    points_multiplier: 1.25,
    badge_color: '#C0C0C0',
    badge_name_ru: 'Серебро',
    badge_name_en: 'Silver',
  },
  gold: {
    points_multiplier: 1.5,
    badge_color: '#FFD700',
    badge_name_ru: 'Золото',
    badge_name_en: 'Gold',
  },
  platinum: {
    points_multiplier: 2.0,
    badge_color: '#E5E4E2',
    badge_name_ru: 'Платина',
    badge_name_en: 'Platinum',
  },
}

export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 100,
  gold: 500,
  platinum: 1500,
}

// Action display names
export const ACTION_DISPLAY_NAMES: Record<PointsActionType, string> = {
  review_submitted: 'Отзыв отправлен',
  review_approved: 'Отзыв одобрен',
  review_with_photo: 'Отзыв с фото',
  review_with_video: 'Отзыв с видео',
  review_helpful_vote: 'Отзыв отмечен полезным',
  first_review: 'Первый отзыв',
  streak_bonus: 'Бонус за стрик',
  profile_completed: 'Профиль заполнен',
  referral_bonus: 'Реферальный бонус',
  points_redeemed: 'Баллы использованы',
  admin_adjustment: 'Корректировка админа',
  points_expired: 'Баллы истекли',
}
