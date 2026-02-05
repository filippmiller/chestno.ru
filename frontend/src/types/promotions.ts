/**
 * Types for Manufacturer Promotions System
 *
 * Allows manufacturers to create and distribute discount codes to their subscribers.
 */

export type DiscountType = 'percent' | 'fixed' | 'free_shipping' | 'custom'

export type Platform = 'own_website' | 'ozon' | 'wildberries' | 'yandex_market' | 'other'

export type PromotionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'

export type PromoCodeStatus = 'pending' | 'active' | 'used' | 'expired'

// =============================================================================
// Promotion (Manufacturer's view)
// =============================================================================

export interface Promotion {
  id: string
  organization_id: string
  title: string
  description: string | null

  discount_type: DiscountType
  discount_value: number | null
  discount_description: string | null
  min_purchase_amount: number | null

  platform: Platform
  platform_name: string | null
  platform_url: string | null

  code_prefix: string

  starts_at: string
  ends_at: string | null
  status: PromotionStatus

  distributed_at: string | null
  total_codes_generated: number
  total_codes_used: number

  created_at: string
  updated_at: string

  // Computed fields
  subscriber_count?: number
  discount_display?: string
}

export interface PromotionCreatePayload {
  title: string
  description?: string

  discount_type: DiscountType
  discount_value?: number
  discount_description?: string
  min_purchase_amount?: number

  platform: Platform
  platform_name?: string
  platform_url?: string

  code_prefix?: string

  starts_at?: string
  ends_at?: string
}

export interface PromotionUpdatePayload {
  title?: string
  description?: string

  discount_type?: DiscountType
  discount_value?: number
  discount_description?: string
  min_purchase_amount?: number

  platform?: Platform
  platform_name?: string
  platform_url?: string

  code_prefix?: string

  starts_at?: string
  ends_at?: string
  status?: PromotionStatus
}

export interface PromotionListResponse {
  items: Promotion[]
  total: number
  limit: number
  offset: number
}

export interface DistributeRequest {
  notify_email?: boolean
  notify_in_app?: boolean
}

export interface DistributeResponse {
  success: boolean
  codes_created: number
  distributed_at: string
}

export interface SubscriberCountResponse {
  count: number
  organization_id: string
}

// =============================================================================
// Promo Code (User's view)
// =============================================================================

export interface PromoCode {
  id: string
  promotion_id: string
  code: string
  status: PromoCodeStatus
  sent_at: string | null
  viewed_at: string | null
  used_at: string | null
  expires_at: string | null
  created_at: string

  // Promotion details (joined)
  promotion_title?: string
  organization_name?: string
  organization_logo?: string
  discount_type?: DiscountType
  discount_value?: number
  discount_description?: string
  discount_display?: string
  platform?: Platform
  platform_name?: string
  platform_url?: string
}

export interface PromoCodeListResponse {
  items: PromoCode[]
  total: number
  active_count: number
  used_count: number
  expired_count: number
}

// =============================================================================
// Display helpers
// =============================================================================

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percent: 'Процентная скидка',
  fixed: 'Фиксированная скидка',
  free_shipping: 'Бесплатная доставка',
  custom: 'Специальное предложение',
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  own_website: 'Собственный сайт',
  ozon: 'Ozon',
  wildberries: 'Wildberries',
  yandex_market: 'Яндекс Маркет',
  other: 'Другая площадка',
}

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  draft: 'Черновик',
  active: 'Активна',
  paused: 'Приостановлена',
  completed: 'Завершена',
  cancelled: 'Отменена',
}

export const PROMO_CODE_STATUS_LABELS: Record<PromoCodeStatus, string> = {
  pending: 'Ожидает отправки',
  active: 'Активен',
  used: 'Использован',
  expired: 'Истёк',
}

export function formatDiscount(
  type: DiscountType,
  value: number | null | undefined,
  description: string | null | undefined
): string {
  if (type === 'percent' && value) {
    return `${value}% скидка`
  }
  if (type === 'fixed' && value) {
    const rubles = Math.floor(value / 100)
    return `${rubles}₽ скидка`
  }
  if (type === 'free_shipping') {
    return 'Бесплатная доставка'
  }
  if (type === 'custom' && description) {
    return description
  }
  return 'Специальное предложение'
}
