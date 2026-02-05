/**
 * API Service for Manufacturer Promotions
 *
 * Handles creating, managing, and distributing promotional codes.
 */
import { httpClient } from './httpClient'
import type {
  DistributeRequest,
  DistributeResponse,
  PromoCode,
  PromoCodeListResponse,
  PromoCodeStatus,
  Promotion,
  PromotionCreatePayload,
  PromotionListResponse,
  PromotionStatus,
  PromotionUpdatePayload,
  SubscriberCountResponse,
} from '@/types/promotions'

// =============================================================================
// Organization Endpoints (for manufacturers)
// =============================================================================

/**
 * Create a new promotion for an organization.
 */
export async function createPromotion(
  organizationId: string,
  payload: PromotionCreatePayload
): Promise<Promotion> {
  const response = await httpClient.post<Promotion>(
    `/api/v1/organizations/${organizationId}/promotions`,
    payload
  )
  return response.data
}

/**
 * List all promotions for an organization.
 */
export async function listPromotions(
  organizationId: string,
  options?: {
    status?: PromotionStatus
    limit?: number
    offset?: number
  }
): Promise<PromotionListResponse> {
  const params = new URLSearchParams()
  if (options?.status) params.append('status', options.status)
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())

  const response = await httpClient.get<PromotionListResponse>(
    `/api/v1/organizations/${organizationId}/promotions?${params.toString()}`
  )
  return response.data
}

/**
 * Get a single promotion by ID.
 */
export async function getPromotion(
  organizationId: string,
  promotionId: string
): Promise<Promotion> {
  const response = await httpClient.get<Promotion>(
    `/api/v1/organizations/${organizationId}/promotions/${promotionId}`
  )
  return response.data
}

/**
 * Update an existing promotion.
 */
export async function updatePromotion(
  organizationId: string,
  promotionId: string,
  payload: PromotionUpdatePayload
): Promise<Promotion> {
  const response = await httpClient.put<Promotion>(
    `/api/v1/organizations/${organizationId}/promotions/${promotionId}`,
    payload
  )
  return response.data
}

/**
 * Delete a promotion.
 */
export async function deletePromotion(
  organizationId: string,
  promotionId: string
): Promise<void> {
  await httpClient.delete(
    `/api/v1/organizations/${organizationId}/promotions/${promotionId}`
  )
}

/**
 * Get subscriber count for an organization.
 */
export async function getSubscriberCount(
  organizationId: string
): Promise<SubscriberCountResponse> {
  const response = await httpClient.get<SubscriberCountResponse>(
    `/api/v1/organizations/${organizationId}/subscribers/count`
  )
  return response.data
}

/**
 * Distribute promo codes to all subscribers.
 */
export async function distributePromotion(
  organizationId: string,
  promotionId: string,
  options?: DistributeRequest
): Promise<DistributeResponse> {
  const response = await httpClient.post<DistributeResponse>(
    `/api/v1/organizations/${organizationId}/promotions/${promotionId}/distribute`,
    options || { notify_email: true, notify_in_app: true }
  )
  return response.data
}

// =============================================================================
// User Endpoints (for consumers)
// =============================================================================

/**
 * List all promo codes received by the current user.
 */
export async function listMyPromoCodes(options?: {
  status?: PromoCodeStatus
  limit?: number
}): Promise<PromoCodeListResponse> {
  const params = new URLSearchParams()
  if (options?.status) params.append('status', options.status)
  if (options?.limit) params.append('limit', options.limit.toString())

  const response = await httpClient.get<PromoCodeListResponse>(
    `/api/v1/me/promo-codes?${params.toString()}`
  )
  return response.data
}

/**
 * Mark a promo code as viewed.
 */
export async function markCodeViewed(codeId: string): Promise<PromoCode> {
  const response = await httpClient.post<PromoCode>(
    `/api/v1/me/promo-codes/${codeId}/view`
  )
  return response.data
}

/**
 * Mark a promo code as used.
 */
export async function markCodeUsed(codeId: string): Promise<PromoCode> {
  const response = await httpClient.post<PromoCode>(
    `/api/v1/me/promo-codes/${codeId}/use`,
    {}
  )
  return response.data
}

/**
 * Look up a promo code by its code string.
 */
export async function lookupPromoCode(code: string): Promise<PromoCode> {
  const response = await httpClient.get<PromoCode>(
    `/api/v1/promo-codes/lookup?code=${encodeURIComponent(code)}`
  )
  return response.data
}
