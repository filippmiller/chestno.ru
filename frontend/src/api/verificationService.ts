/**
 * Purchase Verification Service
 *
 * Handles all verification-related API calls for the verified purchase badge system.
 */

import { httpClient } from './httpClient'
import type {
  PurchaseVerification,
  VerificationRequest,
  SubmitVerificationPayload,
  VerifiedReview,
  VerificationTrustConfig,
  VerificationMethod,
  VerificationStatus,
} from '@/types/verification'

// ============================================
// Verification Submission
// ============================================

/**
 * Submit a verification request for a review
 */
export async function submitVerification(
  payload: SubmitVerificationPayload
): Promise<VerificationRequest> {
  const response = await httpClient.post<VerificationRequest>(
    '/api/verification/submit',
    payload
  )
  return response.data
}

/**
 * Submit Честный ЗНАК verification
 */
export async function submitChestnyZnakVerification(
  reviewId: string,
  code: string,
  productId?: string
): Promise<VerificationRequest> {
  return submitVerification({
    review_id: reviewId,
    method: 'chestny_znak',
    data: {
      type: 'chestny_znak',
      code,
    },
  })
}

/**
 * Submit QR scan verification
 */
export async function submitQRScanVerification(
  reviewId: string,
  qrCodeId: string
): Promise<VerificationRequest> {
  return submitVerification({
    review_id: reviewId,
    method: 'qr_scan',
    data: {
      type: 'qr_scan',
      qr_code_id: qrCodeId,
      scan_timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Submit receipt upload verification
 */
export async function submitReceiptVerification(
  reviewId: string,
  imageUrl: string,
  options?: {
    expectedVendor?: string
    expectedAmount?: number
    date?: string
  }
): Promise<VerificationRequest> {
  return submitVerification({
    review_id: reviewId,
    method: 'receipt_upload',
    data: {
      type: 'receipt_upload',
      image_url: imageUrl,
      expected_vendor: options?.expectedVendor,
      expected_amount: options?.expectedAmount,
    },
  })
}

/**
 * Upload a receipt image and get URL
 */
export async function uploadReceiptImage(
  reviewId: string,
  file: File
): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('review_id', reviewId)

  const response = await httpClient.post<{ url: string }>(
    '/api/verification/receipt/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}

// ============================================
// Verification Status & Results
// ============================================

/**
 * Get verification status for a review
 */
export async function getReviewVerification(
  reviewId: string
): Promise<PurchaseVerification | null> {
  try {
    const response = await httpClient.get<PurchaseVerification>(
      `/api/verification/review/${reviewId}`
    )
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Get all verification requests for current user
 */
export async function getMyVerificationRequests(params?: {
  status?: VerificationRequest['status']
  limit?: number
  offset?: number
}): Promise<{ items: VerificationRequest[]; total: number }> {
  const response = await httpClient.get<{ items: VerificationRequest[]; total: number }>(
    '/api/verification/requests',
    { params }
  )
  return response.data
}

/**
 * Cancel a pending verification request
 */
export async function cancelVerificationRequest(
  requestId: string
): Promise<VerificationRequest> {
  const response = await httpClient.post<VerificationRequest>(
    `/api/verification/requests/${requestId}/cancel`
  )
  return response.data
}

/**
 * Retry a failed verification request
 */
export async function retryVerificationRequest(
  requestId: string
): Promise<VerificationRequest> {
  const response = await httpClient.post<VerificationRequest>(
    `/api/verification/requests/${requestId}/retry`
  )
  return response.data
}

// ============================================
// Reviews with Verification
// ============================================

export interface VerifiedReviewsParams {
  organizationId?: string
  productId?: string
  verifiedOnly?: boolean
  minTrustScore?: number
  sortBy?: 'newest' | 'highest_rating' | 'most_trusted' | 'most_helpful'
  limit?: number
  offset?: number
}

export interface VerifiedReviewsResponse {
  items: VerifiedReview[]
  total: number
  verified_count: number
  average_rating?: number | null
  average_trust_score?: number | null
}

/**
 * Get public reviews with verification info
 */
export async function getVerifiedReviews(
  params: VerifiedReviewsParams
): Promise<VerifiedReviewsResponse> {
  const response = await httpClient.get<VerifiedReviewsResponse>(
    '/api/public/reviews/verified',
    { params }
  )
  return response.data
}

/**
 * Get verified reviews for an organization
 */
export async function getOrganizationVerifiedReviews(
  organizationId: string,
  params?: Omit<VerifiedReviewsParams, 'organizationId'>
): Promise<VerifiedReviewsResponse> {
  return getVerifiedReviews({ ...params, organizationId })
}

/**
 * Get verified reviews for a product
 */
export async function getProductVerifiedReviews(
  productId: string,
  params?: Omit<VerifiedReviewsParams, 'productId'>
): Promise<VerifiedReviewsResponse> {
  return getVerifiedReviews({ ...params, productId })
}

// ============================================
// Organization Verification Management
// ============================================

/**
 * Get all verifications for an organization (org admin view)
 */
export async function getOrganizationVerifications(
  organizationId: string,
  params?: {
    status?: VerificationStatus
    method?: VerificationMethod
    limit?: number
    offset?: number
  }
): Promise<{ items: PurchaseVerification[]; total: number }> {
  const response = await httpClient.get<{ items: PurchaseVerification[]; total: number }>(
    `/api/organizations/${organizationId}/verifications`,
    { params }
  )
  return response.data
}

/**
 * Get verification trust config for organization
 */
export async function getVerificationConfig(
  organizationId?: string
): Promise<VerificationTrustConfig> {
  const url = organizationId
    ? `/api/organizations/${organizationId}/verification-config`
    : '/api/verification/config/default'

  const response = await httpClient.get<VerificationTrustConfig>(url)
  return response.data
}

/**
 * Update verification trust config for organization
 */
export async function updateVerificationConfig(
  organizationId: string,
  config: Partial<Omit<VerificationTrustConfig, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>
): Promise<VerificationTrustConfig> {
  const response = await httpClient.patch<VerificationTrustConfig>(
    `/api/organizations/${organizationId}/verification-config`,
    config
  )
  return response.data
}

// ============================================
// Admin Functions
// ============================================

/**
 * Manually verify a review (admin only)
 */
export async function adminManualVerify(
  reviewId: string,
  payload: {
    reason: string
    evidence_urls?: string[]
  }
): Promise<PurchaseVerification> {
  const response = await httpClient.post<PurchaseVerification>(
    `/api/admin/reviews/${reviewId}/verify`,
    payload
  )
  return response.data
}

/**
 * Revoke a verification (admin only)
 */
export async function adminRevokeVerification(
  verificationId: string,
  reason: string
): Promise<PurchaseVerification> {
  const response = await httpClient.post<PurchaseVerification>(
    `/api/admin/verifications/${verificationId}/revoke`,
    { reason }
  )
  return response.data
}

/**
 * Get all pending verification requests (admin view)
 */
export async function adminGetPendingVerifications(params?: {
  method?: VerificationMethod
  limit?: number
  offset?: number
}): Promise<{ items: VerificationRequest[]; total: number }> {
  const response = await httpClient.get<{ items: VerificationRequest[]; total: number }>(
    '/api/admin/verifications/pending',
    { params }
  )
  return response.data
}

/**
 * Process a receipt verification manually (admin)
 */
export async function adminProcessReceiptVerification(
  verificationId: string,
  decision: {
    approved: boolean
    notes?: string
  }
): Promise<PurchaseVerification> {
  const response = await httpClient.post<PurchaseVerification>(
    `/api/admin/verifications/${verificationId}/process-receipt`,
    decision
  )
  return response.data
}

// ============================================
// Verification Stats
// ============================================

export interface VerificationStats {
  total_verifications: number
  by_method: Record<VerificationMethod, number>
  by_status: Record<VerificationStatus, number>
  average_trust_score: number
  verification_rate: number  // % of reviews that are verified
}

/**
 * Get verification statistics for an organization
 */
export async function getVerificationStats(
  organizationId: string
): Promise<VerificationStats> {
  const response = await httpClient.get<VerificationStats>(
    `/api/organizations/${organizationId}/verification-stats`
  )
  return response.data
}

/**
 * Get platform-wide verification statistics (admin)
 */
export async function getAdminVerificationStats(): Promise<VerificationStats> {
  const response = await httpClient.get<VerificationStats>(
    '/api/admin/verification-stats'
  )
  return response.data
}
