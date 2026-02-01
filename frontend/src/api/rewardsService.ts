/**
 * Rewards API Service
 *
 * Client-side API calls for the "Баллы за отзывы" system.
 */
import { httpClient } from './httpClient'
import type {
  PartnerCategory,
  PointsCalculationRequest,
  PointsCalculationResponse,
  RateLimitStatus,
  RedeemRewardResponse,
  RedemptionHistoryResponse,
  RedemptionStatus,
  ReviewQualityConfig,
  RewardCatalogResponse,
  RewardPartnerListResponse,
  UserRewardsOverview,
} from '@/types/rewards'

const BASE_PATH = '/api/v1/rewards'

/**
 * Get points calculation configuration
 */
export async function getPointsConfig(): Promise<ReviewQualityConfig> {
  const response = await httpClient.get<ReviewQualityConfig>(`${BASE_PATH}/config`)
  return response.data
}

/**
 * Preview points calculation for a review
 */
export async function calculatePoints(
  request: PointsCalculationRequest
): Promise<PointsCalculationResponse> {
  const response = await httpClient.post<PointsCalculationResponse>(
    `${BASE_PATH}/calculate`,
    request
  )
  return response.data
}

/**
 * Get list of reward partners
 */
export async function getPartners(options?: {
  category?: PartnerCategory
  limit?: number
}): Promise<RewardPartnerListResponse> {
  const params = new URLSearchParams()
  if (options?.category) params.set('category', options.category)
  if (options?.limit) params.set('limit', String(options.limit))

  const response = await httpClient.get<RewardPartnerListResponse>(
    `${BASE_PATH}/partners?${params.toString()}`
  )
  return response.data
}

/**
 * Get rewards catalog
 */
export async function getRewardsCatalog(options?: {
  category?: PartnerCategory
  affordableOnly?: boolean
  limit?: number
  offset?: number
}): Promise<RewardCatalogResponse> {
  const params = new URLSearchParams()
  if (options?.category) params.set('category', options.category)
  if (options?.affordableOnly) params.set('affordable_only', 'true')
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))

  const response = await httpClient.get<RewardCatalogResponse>(
    `${BASE_PATH}/catalog?${params.toString()}`
  )
  return response.data
}

/**
 * Get user's rewards overview (dashboard)
 */
export async function getMyRewardsOverview(): Promise<UserRewardsOverview> {
  const response = await httpClient.get<UserRewardsOverview>(`${BASE_PATH}/me/overview`)
  return response.data
}

/**
 * Check user's rate limit status
 */
export async function getMyRateLimit(): Promise<RateLimitStatus> {
  const response = await httpClient.get<RateLimitStatus>(`${BASE_PATH}/me/rate-limit`)
  return response.data
}

/**
 * Redeem a reward using points
 */
export async function redeemReward(rewardId: string): Promise<RedeemRewardResponse> {
  const response = await httpClient.post<RedeemRewardResponse>(`${BASE_PATH}/redeem`, {
    reward_id: rewardId,
  })
  return response.data
}

/**
 * Get user's redemption history
 */
export async function getMyRedemptions(options?: {
  status?: RedemptionStatus
  limit?: number
  offset?: number
}): Promise<RedemptionHistoryResponse> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status_filter', options.status)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))

  const response = await httpClient.get<RedemptionHistoryResponse>(
    `${BASE_PATH}/me/redemptions?${params.toString()}`
  )
  return response.data
}

/**
 * Get voucher details
 */
export async function getVoucherDetails(redemptionId: string): Promise<{
  voucher: RedemptionHistoryResponse['redemptions'][0]
  instructions: {
    code: string
    expires: string
    status: string
    how_to_use: string
  }
}> {
  const response = await httpClient.get(`${BASE_PATH}/me/voucher/${redemptionId}`)
  return response.data
}
