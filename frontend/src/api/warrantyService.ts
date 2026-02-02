import { httpClient } from './httpClient'
import type {
  WarrantyRegistrationWithProduct,
  WarrantyRegistrationCreate,
  WarrantyRegistrationsResponse,
  WarrantyClaim,
  WarrantyClaimCreate,
  WarrantyClaimUpdate,
  WarrantyClaimWithDetails,
  WarrantyClaimsResponse,
  WarrantyValidityResponse,
  WarrantyPolicy,
  WarrantyPolicyCreate,
  WarrantyStatsResponse,
  WarrantyClaimHistoryEntry,
  WarrantyStatus,
  ClaimStatus,
} from '@/types/warranty'

// ==================== Consumer API ====================

/**
 * Register a warranty for a product
 */
export async function registerWarranty(
  payload: WarrantyRegistrationCreate
): Promise<WarrantyRegistrationWithProduct> {
  const response = await httpClient.post<WarrantyRegistrationWithProduct>(
    '/api/warranty/register',
    payload
  )
  return response.data
}

/**
 * Get all warranties for the current user
 */
export async function getMyWarranties(params?: {
  status?: WarrantyStatus
  page?: number
  per_page?: number
}): Promise<WarrantyRegistrationsResponse> {
  const response = await httpClient.get<WarrantyRegistrationsResponse>(
    '/api/warranty/my',
    { params }
  )
  return response.data
}

/**
 * Get warranty details by ID
 */
export async function getWarrantyDetails(
  registrationId: string
): Promise<WarrantyRegistrationWithProduct> {
  const response = await httpClient.get<WarrantyRegistrationWithProduct>(
    `/api/warranty/${registrationId}`
  )
  return response.data
}

/**
 * Check warranty validity
 */
export async function checkWarrantyValidity(
  registrationId: string
): Promise<WarrantyValidityResponse> {
  const response = await httpClient.get<WarrantyValidityResponse>(
    `/api/warranty/${registrationId}/validity`
  )
  return response.data
}

/**
 * Submit a warranty claim
 */
export async function submitClaim(
  registrationId: string,
  payload: WarrantyClaimCreate
): Promise<WarrantyClaimWithDetails> {
  const response = await httpClient.post<WarrantyClaimWithDetails>(
    `/api/warranty/${registrationId}/claim`,
    payload
  )
  return response.data
}

/**
 * Get all claims for the current user
 */
export async function getMyClaims(params?: {
  status?: ClaimStatus
  page?: number
  per_page?: number
}): Promise<WarrantyClaimsResponse> {
  const response = await httpClient.get<WarrantyClaimsResponse>(
    '/api/warranty/claims/my',
    { params }
  )
  return response.data
}

/**
 * Get claim history
 */
export async function getClaimHistory(
  claimId: string
): Promise<WarrantyClaimHistoryEntry[]> {
  const response = await httpClient.get<WarrantyClaimHistoryEntry[]>(
    `/api/warranty/claims/${claimId}/history`
  )
  return response.data
}

// ==================== Organization API ====================

/**
 * Get all warranty claims for an organization's products
 */
export async function getOrganizationClaims(
  organizationId: string,
  params?: {
    status?: ClaimStatus
    page?: number
    per_page?: number
  }
): Promise<WarrantyClaimsResponse> {
  const response = await httpClient.get<WarrantyClaimsResponse>(
    `/api/organizations/${organizationId}/warranty/claims`,
    { params }
  )
  return response.data
}

/**
 * Update a warranty claim (business side)
 */
export async function updateClaim(
  organizationId: string,
  claimId: string,
  payload: WarrantyClaimUpdate
): Promise<WarrantyClaim> {
  const response = await httpClient.put<WarrantyClaim>(
    `/api/organizations/${organizationId}/warranty/claims/${claimId}`,
    payload
  )
  return response.data
}

/**
 * Get warranty statistics for an organization
 */
export async function getWarrantyStats(
  organizationId: string
): Promise<WarrantyStatsResponse> {
  const response = await httpClient.get<WarrantyStatsResponse>(
    `/api/organizations/${organizationId}/warranty/stats`
  )
  return response.data
}

/**
 * List warranty policies for an organization
 */
export async function listWarrantyPolicies(
  organizationId: string,
  includeInactive = false
): Promise<WarrantyPolicy[]> {
  const response = await httpClient.get<WarrantyPolicy[]>(
    `/api/organizations/${organizationId}/warranty/policies`,
    { params: { include_inactive: includeInactive } }
  )
  return response.data
}

/**
 * Create a warranty policy
 */
export async function createWarrantyPolicy(
  organizationId: string,
  payload: WarrantyPolicyCreate
): Promise<WarrantyPolicy> {
  const response = await httpClient.post<WarrantyPolicy>(
    `/api/organizations/${organizationId}/warranty/policies`,
    payload
  )
  return response.data
}
