/**
 * Geographic Anomaly Detection API Service
 * API calls for gray market detection feature
 */

import { httpClient } from './httpClient'

import type {
  AuthorizedRegion,
  AuthorizedRegionCreate,
  AuthorizedRegionUpdate,
  GeographicAnomaly,
  AnomalyStatusUpdate,
  AnomalyStatistics,
  AnomalyTrendItem,
  CheckLocationRequest,
  CheckLocationResponse,
  AnomalyListResponse,
} from '@/types/geoAnomaly'

// ==================== Authorized Regions ====================

export async function getAuthorizedRegions(
  organizationId: string,
  productId?: string
): Promise<AuthorizedRegion[]> {
  const params = productId ? { product_id: productId } : undefined
  const { data } = await httpClient.get<AuthorizedRegion[]>(
    `/api/organizations/${organizationId}/geo-anomaly/regions`,
    { params }
  )
  return data
}

export async function addAuthorizedRegion(
  organizationId: string,
  payload: AuthorizedRegionCreate
): Promise<AuthorizedRegion> {
  const { data } = await httpClient.post<AuthorizedRegion>(
    `/api/organizations/${organizationId}/geo-anomaly/regions`,
    payload
  )
  return data
}

export async function updateAuthorizedRegion(
  organizationId: string,
  regionId: string,
  payload: AuthorizedRegionUpdate
): Promise<AuthorizedRegion> {
  const { data } = await httpClient.put<AuthorizedRegion>(
    `/api/organizations/${organizationId}/geo-anomaly/regions/${regionId}`,
    payload
  )
  return data
}

export async function deleteAuthorizedRegion(
  organizationId: string,
  regionId: string
): Promise<void> {
  await httpClient.delete(
    `/api/organizations/${organizationId}/geo-anomaly/regions/${regionId}`
  )
}

export async function checkLocation(
  organizationId: string,
  payload: CheckLocationRequest
): Promise<CheckLocationResponse> {
  const { data } = await httpClient.post<CheckLocationResponse>(
    `/api/organizations/${organizationId}/geo-anomaly/check-location`,
    payload
  )
  return data
}

// ==================== Anomaly Alerts ====================

export interface GetAnomaliesParams {
  status?: string
  severity?: string
  product_id?: string
  days?: number
  page?: number
  per_page?: number
}

export async function getAnomalies(
  organizationId: string,
  params?: GetAnomaliesParams
): Promise<AnomalyListResponse> {
  const { data } = await httpClient.get<AnomalyListResponse>(
    `/api/organizations/${organizationId}/geo-anomaly/alerts`,
    { params }
  )
  return data
}

export async function getAnomaly(
  organizationId: string,
  anomalyId: string
): Promise<GeographicAnomaly> {
  const { data } = await httpClient.get<GeographicAnomaly>(
    `/api/organizations/${organizationId}/geo-anomaly/alerts/${anomalyId}`
  )
  return data
}

export async function investigateAnomaly(
  organizationId: string,
  anomalyId: string,
  payload: AnomalyStatusUpdate
): Promise<GeographicAnomaly> {
  const { data } = await httpClient.put<GeographicAnomaly>(
    `/api/organizations/${organizationId}/geo-anomaly/alerts/${anomalyId}/investigate`,
    payload
  )
  return data
}

// ==================== Statistics ====================

export async function getAnomalyStatistics(
  organizationId: string,
  days: number = 30
): Promise<AnomalyStatistics> {
  const { data } = await httpClient.get<AnomalyStatistics>(
    `/api/organizations/${organizationId}/geo-anomaly/stats`,
    { params: { days } }
  )
  return data
}

export async function getAnomalyTrend(
  organizationId: string,
  days: number = 30
): Promise<AnomalyTrendItem[]> {
  const { data } = await httpClient.get<AnomalyTrendItem[]>(
    `/api/organizations/${organizationId}/geo-anomaly/trend`,
    { params: { days } }
  )
  return data
}
