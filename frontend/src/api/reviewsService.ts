import { httpClient } from './httpClient'
import type {
  Review,
  ReviewCreate,
  ReviewModeration,
  ReviewsResponse,
  PublicReviewsResponse,
  ReviewStats,
} from '@/types/reviews'

export async function listOrganizationReviews(
  organizationId: string,
  params?: {
    status?: 'pending' | 'approved' | 'rejected'
    productId?: string
    limit?: number
    offset?: number
  },
): Promise<ReviewsResponse> {
  const response = await httpClient.get<ReviewsResponse>(`/api/organizations/${organizationId}/reviews`, { params })
  return response.data
}

export async function getReviewStats(organizationId: string): Promise<ReviewStats> {
  const response = await httpClient.get<ReviewStats>(`/api/organizations/${organizationId}/reviews/stats`)
  return response.data
}

export async function moderateReview(
  organizationId: string,
  reviewId: string,
  payload: ReviewModeration,
): Promise<Review> {
  const response = await httpClient.patch<Review>(
    `/api/organizations/${organizationId}/reviews/${reviewId}/moderate`,
    payload,
  )
  return response.data
}

// Public API
export async function listPublicOrganizationReviews(
  slug: string,
  params?: {
    productSlug?: string
    limit?: number
    offset?: number
    order?: 'newest' | 'highest_rating'
  },
): Promise<PublicReviewsResponse> {
  const response = await httpClient.get<PublicReviewsResponse>(`/api/public/organizations/by-slug/${slug}/reviews`, {
    params,
  })
  return response.data
}

export async function createPublicReview(slug: string, payload: ReviewCreate): Promise<Review> {
  const response = await httpClient.post<Review>(`/api/public/organizations/by-slug/${slug}/reviews`, payload)
  return response.data
}

