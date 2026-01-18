/**
 * Admin import API service for managing bulk imports.
 */

import api from './axios'
import type {
  AdminImportsListResponse,
  AdminImportDetailsResponse,
  ImportStatsResponse,
  AdminImportsFilter,
  OrganizationImportSummary,
} from '@/types/adminImport'

const BASE_URL = '/api/admin/imports'

/**
 * List all import jobs with optional filters.
 */
export async function listAdminImports(
  filter: AdminImportsFilter = {}
): Promise<AdminImportsListResponse> {
  const params = new URLSearchParams()

  if (filter.status) params.append('status', filter.status)
  if (filter.source_type) params.append('source_type', filter.source_type)
  if (filter.organization_id) params.append('organization_id', filter.organization_id)
  if (filter.limit) params.append('limit', filter.limit.toString())
  if (filter.offset) params.append('offset', filter.offset.toString())

  const response = await api.get<AdminImportsListResponse>(
    `${BASE_URL}?${params.toString()}`
  )
  return response.data
}

/**
 * Get import statistics.
 */
export async function getImportStats(days: number = 30): Promise<ImportStatsResponse> {
  const response = await api.get<ImportStatsResponse>(`${BASE_URL}/stats?days=${days}`)
  return response.data
}

/**
 * Get detailed import job info.
 */
export async function getImportDetails(
  jobId: string,
  options: {
    items_limit?: number
    items_offset?: number
    items_status?: string
  } = {}
): Promise<AdminImportDetailsResponse> {
  const params = new URLSearchParams()

  if (options.items_limit) params.append('items_limit', options.items_limit.toString())
  if (options.items_offset) params.append('items_offset', options.items_offset.toString())
  if (options.items_status) params.append('items_status', options.items_status)

  const response = await api.get<AdminImportDetailsResponse>(
    `${BASE_URL}/${jobId}?${params.toString()}`
  )
  return response.data
}

/**
 * Cancel an import job (admin override).
 */
export async function cancelImportAdmin(
  jobId: string
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(
    `${BASE_URL}/${jobId}/cancel`
  )
  return response.data
}

/**
 * Retry failed items in an import job.
 */
export async function retryFailedItems(
  jobId: string
): Promise<{ success: boolean; items_reset: number }> {
  const response = await api.post<{ success: boolean; items_reset: number }>(
    `${BASE_URL}/${jobId}/retry-failed`
  )
  return response.data
}

/**
 * Delete an import job and all its items.
 */
export async function deleteImportJob(
  jobId: string
): Promise<{ success: boolean; message: string; items_deleted: number }> {
  const response = await api.delete<{
    success: boolean
    message: string
    items_deleted: number
  }>(`${BASE_URL}/${jobId}`)
  return response.data
}

/**
 * Get import summary per organization.
 */
export async function getOrganizationsImportSummary(): Promise<OrganizationImportSummary[]> {
  const response = await api.get<OrganizationImportSummary[]>(
    `${BASE_URL}/organizations/summary`
  )
  return response.data
}
