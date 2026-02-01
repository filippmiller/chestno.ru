/**
 * Retail Store API Service
 * Handles API calls for retail store management and analytics
 */
import { httpClient } from './httpClient'
import type {
  RetailStore,
  StoreAnalytics,
  StoreAnalyticsResponse,
  StoreListParams,
  StoreProduct,
  StoreRegistration,
  StoresListResponse,
  StoreAnalyticsParams,
} from '@/types/retail'

// ============================================
// STORE MANAGEMENT
// ============================================

/**
 * List retail stores with optional filtering
 */
export async function listStores(params?: StoreListParams): Promise<StoresListResponse> {
  const response = await httpClient.get<StoresListResponse>('/api/retail/stores', { params })
  return response.data
}

/**
 * Get a single store by ID
 */
export async function getStore(storeId: string): Promise<RetailStore> {
  const response = await httpClient.get<RetailStore>(`/api/retail/stores/${storeId}`)
  return response.data
}

/**
 * Register a new retail store
 */
export async function registerStore(data: StoreRegistration): Promise<RetailStore> {
  const response = await httpClient.post<RetailStore>('/api/retail/stores', data)
  return response.data
}

/**
 * Update a retail store
 */
export async function updateStore(storeId: string, data: Partial<StoreRegistration>): Promise<RetailStore> {
  const response = await httpClient.put<RetailStore>(`/api/retail/stores/${storeId}`, data)
  return response.data
}

/**
 * Deactivate (soft delete) a retail store
 */
export async function deactivateStore(storeId: string): Promise<void> {
  await httpClient.delete(`/api/retail/stores/${storeId}`)
}

// ============================================
// STORE PRODUCTS
// ============================================

/**
 * List products in a specific store
 */
export async function listStoreProducts(
  storeId: string,
  params?: { in_stock?: boolean; limit?: number; offset?: number }
): Promise<{ products: StoreProduct[]; total: number }> {
  const response = await httpClient.get<{ products: StoreProduct[]; total: number }>(
    `/api/retail/stores/${storeId}/products`,
    { params }
  )
  return response.data
}

/**
 * Add a product to a store
 */
export async function addStoreProduct(
  storeId: string,
  data: {
    product_id: string
    aisle?: string
    shelf_position?: string
    store_price_cents?: number
  }
): Promise<StoreProduct> {
  const response = await httpClient.post<StoreProduct>(`/api/retail/stores/${storeId}/products`, data)
  return response.data
}

/**
 * Update a store product
 */
export async function updateStoreProduct(
  storeId: string,
  productId: string,
  data: {
    aisle?: string
    shelf_position?: string
    store_price_cents?: number
    in_stock?: boolean
  }
): Promise<StoreProduct> {
  const response = await httpClient.put<StoreProduct>(
    `/api/retail/stores/${storeId}/products/${productId}`,
    data
  )
  return response.data
}

/**
 * Remove a product from a store
 */
export async function removeStoreProduct(storeId: string, productId: string): Promise<void> {
  await httpClient.delete(`/api/retail/stores/${storeId}/products/${productId}`)
}

// ============================================
// STORE ANALYTICS
// ============================================

/**
 * Get analytics for all stores (ranking)
 */
export async function getStoresAnalytics(
  params?: StoreAnalyticsParams
): Promise<{ stores: StoreAnalytics[]; total: number }> {
  const response = await httpClient.get<{ stores: StoreAnalytics[]; total: number }>(
    '/api/retail/analytics/stores',
    { params }
  )
  return response.data
}

/**
 * Get analytics for a specific store
 */
export async function getStoreAnalytics(
  storeId: string,
  params?: StoreAnalyticsParams
): Promise<StoreAnalyticsResponse> {
  const response = await httpClient.get<StoreAnalyticsResponse>(
    `/api/retail/analytics/stores/${storeId}`,
    { params }
  )
  return response.data
}

/**
 * Get retail analytics for an organization's products
 */
export async function getOrganizationRetailAnalytics(
  organizationId: string,
  params?: StoreAnalyticsParams
): Promise<{
  total_store_scans: number
  stores_count: number
  top_stores: Array<{
    store_id: string
    store_name: string
    scan_count: number
  }>
  scans_by_day: Array<{ date: string; count: number }>
}> {
  const response = await httpClient.get<{
    total_store_scans: number
    stores_count: number
    top_stores: Array<{
      store_id: string
      store_name: string
      scan_count: number
    }>
    scans_by_day: Array<{ date: string; count: number }>
  }>(`/api/organizations/${organizationId}/retail-analytics`, { params })
  return response.data
}

// ============================================
// STORE MAP DATA
// ============================================

/**
 * Get stores with coordinates for map display
 */
export async function getStoresForMap(params?: {
  chain_name?: string
  city?: string
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
}): Promise<Array<{
  id: string
  name: string
  latitude: number
  longitude: number
  chain_name?: string
  scan_count: number
  is_verified: boolean
}>> {
  const response = await httpClient.get<Array<{
    id: string
    name: string
    latitude: number
    longitude: number
    chain_name?: string
    scan_count: number
    is_verified: boolean
  }>>('/api/retail/stores/map', { params })
  return response.data
}
