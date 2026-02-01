import { httpClient } from './httpClient'

import type { ProductLookupResult, ScannedProduct } from '@/types/scanner'

/**
 * Product Scanner Service
 * Handles product lookup by barcode with offline fallback
 */

interface ApiProductResponse {
  id: string
  barcode?: string
  name: string
  brand?: string
  category?: string
  main_image_url?: string
  price_cents?: number
  currency?: string
  organization_id?: string
  organization?: {
    id: string
    name: string
    slug: string
    is_verified: boolean
    status_level?: 'A' | 'B' | 'C' | null
  }
  trust_score?: number
  slug?: string
}

/**
 * Transform API response to ScannedProduct type
 */
function transformApiProduct(data: ApiProductResponse, barcode: string): ScannedProduct {
  return {
    id: data.id,
    barcode: data.barcode || barcode,
    name: data.name,
    brand: data.brand,
    category: data.category,
    imageUrl: data.main_image_url,
    price: data.price_cents
      ? {
          amount: data.price_cents / 100,
          currency: data.currency || 'RUB',
        }
      : undefined,
    organizationId: data.organization?.id || data.organization_id,
    organizationName: data.organization?.name,
    organizationSlug: data.organization?.slug,
    trustScore: data.trust_score,
    statusLevel: data.organization?.status_level ?? undefined,
    isVerified: data.organization?.is_verified ?? false,
    slug: data.slug,
  }
}

/**
 * Look up a product by barcode
 */
export async function lookupProductByBarcode(barcode: string): Promise<ProductLookupResult> {
  try {
    const response = await httpClient.get<ApiProductResponse>(`/api/products/barcode/${barcode}`)
    
    if (response.data) {
      return {
        found: true,
        product: transformApiProduct(response.data, barcode),
        source: 'api',
      }
    }
    
    return {
      found: false,
      source: 'not-found',
    }
  } catch (error) {
    // Handle 404 - product not found
    if ((error as { response?: { status: number } }).response?.status === 404) {
      return {
        found: false,
        source: 'not-found',
      }
    }
    
    // Network or other errors
    return {
      found: false,
      source: 'not-found',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Search for products by barcode (returns multiple results)
 */
export async function searchProductsByBarcode(
  barcode: string,
): Promise<{ products: ScannedProduct[]; total: number }> {
  try {
    const response = await httpClient.get<{
      products: ApiProductResponse[]
      total: number
    }>(`/api/products/search`, {
      params: { barcode, limit: 10 },
    })
    
    return {
      products: response.data.products.map((p) => transformApiProduct(p, barcode)),
      total: response.data.total,
    }
  } catch {
    return {
      products: [],
      total: 0,
    }
  }
}

/**
 * Report a scanned barcode for analytics (fire and forget)
 */
export function reportScan(
  barcode: string,
  format: string,
  productFound: boolean,
  location?: { latitude: number; longitude: number },
): void {
  // Don't await - this is fire-and-forget analytics
  httpClient
    .post('/api/analytics/scans', {
      barcode,
      format,
      product_found: productFound,
      location,
      scanned_at: new Date().toISOString(),
    })
    .catch(() => {
      // Silently ignore analytics errors
    })
}

/**
 * Submit a missing product suggestion
 */
export async function suggestMissingProduct(data: {
  barcode: string
  name?: string
  brand?: string
  notes?: string
}): Promise<{ success: boolean; message?: string }> {
  try {
    await httpClient.post('/api/products/suggestions', data)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit suggestion',
    }
  }
}
