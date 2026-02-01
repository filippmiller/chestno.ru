/**
 * Kiosk Mode API Service
 * Handles API calls for in-store kiosk devices
 */
import { httpClient } from './httpClient'
import type {
  Kiosk,
  KioskAuthResponse,
  KioskConfig,
  KioskScanResult,
  KioskSession,
} from '@/types/retail'

// ============================================
// KIOSK AUTHENTICATION
// ============================================

/**
 * Authenticate a kiosk device
 */
export async function authenticateKiosk(deviceCode: string): Promise<KioskAuthResponse> {
  const response = await httpClient.post<KioskAuthResponse>('/api/kiosk/authenticate', {
    device_code: deviceCode,
  })
  return response.data
}

/**
 * Get kiosk configuration
 */
export async function getKioskConfig(sessionToken: string): Promise<KioskConfig> {
  const response = await httpClient.get<KioskConfig>('/api/kiosk/config', {
    headers: { 'X-Kiosk-Token': sessionToken },
  })
  return response.data
}

// ============================================
// PRODUCT SCANNING
// ============================================

/**
 * Process a product scan from kiosk
 */
export async function processKioskScan(
  sessionToken: string,
  barcode: string
): Promise<KioskScanResult> {
  const response = await httpClient.post<KioskScanResult>(
    '/api/kiosk/scan',
    { barcode },
    { headers: { 'X-Kiosk-Token': sessionToken } }
  )
  return response.data
}

/**
 * Lookup product by barcode or QR code
 */
export async function lookupProduct(
  sessionToken: string,
  code: string
): Promise<KioskScanResult> {
  const response = await httpClient.get<KioskScanResult>(`/api/kiosk/product/${code}`, {
    headers: { 'X-Kiosk-Token': sessionToken },
  })
  return response.data
}

// ============================================
// DEVICE HEALTH
// ============================================

/**
 * Send kiosk heartbeat
 */
export async function sendHeartbeat(sessionToken: string): Promise<{ status: 'ok' }> {
  const response = await httpClient.post<{ status: 'ok' }>(
    '/api/kiosk/heartbeat',
    {},
    { headers: { 'X-Kiosk-Token': sessionToken } }
  )
  return response.data
}

// ============================================
// PRINT & ACTIONS
// ============================================

/**
 * Generate printable product summary
 */
export async function generatePrintSummary(
  sessionToken: string,
  productId: string
): Promise<{ print_url: string; expires_at: string }> {
  const response = await httpClient.post<{ print_url: string; expires_at: string }>(
    '/api/kiosk/print',
    { product_id: productId },
    { headers: { 'X-Kiosk-Token': sessionToken } }
  )
  return response.data
}

/**
 * Submit review from kiosk
 */
export async function submitKioskReview(
  sessionToken: string,
  data: {
    product_id: string
    rating: number
    comment?: string
    customer_name?: string
  }
): Promise<{ success: boolean; review_id?: string }> {
  const response = await httpClient.post<{ success: boolean; review_id?: string }>(
    '/api/kiosk/review',
    data,
    { headers: { 'X-Kiosk-Token': sessionToken } }
  )
  return response.data
}

/**
 * Register for loyalty program from kiosk
 */
export async function kioskLoyaltySignup(
  sessionToken: string,
  data: {
    phone?: string
    email?: string
    name?: string
  }
): Promise<{ success: boolean; loyalty_id?: string }> {
  const response = await httpClient.post<{ success: boolean; loyalty_id?: string }>(
    '/api/kiosk/loyalty-signup',
    data,
    { headers: { 'X-Kiosk-Token': sessionToken } }
  )
  return response.data
}

// ============================================
// ADMIN: KIOSK MANAGEMENT
// ============================================

/**
 * List kiosks for a store
 */
export async function listStoreKiosks(storeId: string): Promise<Kiosk[]> {
  const response = await httpClient.get<Kiosk[]>(`/api/retail/stores/${storeId}/kiosks`)
  return response.data
}

/**
 * Register a new kiosk
 */
export async function registerKiosk(
  storeId: string,
  data: {
    device_code: string
    device_name?: string
    location_in_store?: string
    config?: Partial<KioskConfig>
  }
): Promise<Kiosk> {
  const response = await httpClient.post<Kiosk>(`/api/retail/stores/${storeId}/kiosks`, data)
  return response.data
}

/**
 * Update kiosk configuration
 */
export async function updateKiosk(
  storeId: string,
  kioskId: string,
  data: {
    device_name?: string
    location_in_store?: string
    config?: Partial<KioskConfig>
  }
): Promise<Kiosk> {
  const response = await httpClient.put<Kiosk>(
    `/api/retail/stores/${storeId}/kiosks/${kioskId}`,
    data
  )
  return response.data
}

/**
 * Delete a kiosk
 */
export async function deleteKiosk(storeId: string, kioskId: string): Promise<void> {
  await httpClient.delete(`/api/retail/stores/${storeId}/kiosks/${kioskId}`)
}

/**
 * Get kiosk session history
 */
export async function getKioskSessions(
  storeId: string,
  kioskId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ sessions: KioskSession[]; total: number }> {
  const response = await httpClient.get<{ sessions: KioskSession[]; total: number }>(
    `/api/retail/stores/${storeId}/kiosks/${kioskId}/sessions`,
    { params }
  )
  return response.data
}
