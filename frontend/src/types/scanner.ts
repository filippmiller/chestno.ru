// Barcode Scanner Types

/**
 * Supported barcode formats for retail product scanning
 */
export type BarcodeFormat =
  | 'QR_CODE'
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'CODE_128'
  | 'CODE_39'
  | 'ITF'

/**
 * Scanner operational states
 */
export type ScannerState =
  | 'idle'
  | 'requesting-permission'
  | 'permission-denied'
  | 'permission-granted'
  | 'scanning'
  | 'paused'
  | 'processing'
  | 'error'

/**
 * Camera permission status
 */
export type CameraPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable'

/**
 * Raw scan result from the scanner
 */
export interface ScanResult {
  code: string
  format: BarcodeFormat
  timestamp: number
}

/**
 * Product data retrieved from scan
 */
export interface ScannedProduct {
  id: string
  barcode: string
  name: string
  brand?: string
  category?: string
  imageUrl?: string
  price?: {
    amount: number
    currency: string
  }
  organizationId?: string
  organizationName?: string
  organizationSlug?: string
  trustScore?: number
  statusLevel?: 'A' | 'B' | 'C'
  isVerified: boolean
  slug?: string
}

/**
 * Cached product for offline access
 */
export interface CachedProduct extends ScannedProduct {
  cachedAt: number
  expiresAt: number
}

/**
 * Product lookup result
 */
export interface ProductLookupResult {
  found: boolean
  product?: ScannedProduct
  source: 'api' | 'cache' | 'not-found'
  error?: string
}

/**
 * Scanner configuration
 */
export interface ScannerConfig {
  /** Frames per second for scanning */
  fps: number
  /** Size of the scanning box */
  qrbox: {
    width: number
    height: number
  }
  /** Aspect ratio for camera feed */
  aspectRatio: number
  /** Supported barcode formats */
  formatsToSupport: BarcodeFormat[]
  /** Whether to disable image flip */
  disableFlip: boolean
  /** Show torch button if supported */
  showTorchButton: boolean
  /** Remember last used camera */
  rememberLastUsedCamera: boolean
}

/**
 * Scanner error types
 */
export type ScannerErrorType =
  | 'camera-not-found'
  | 'camera-permission-denied'
  | 'camera-in-use'
  | 'scan-failed'
  | 'api-error'
  | 'unknown'

export interface ScannerError {
  type: ScannerErrorType
  message: string
  originalError?: unknown
}

/**
 * Scan history entry
 */
export interface ScanHistoryEntry {
  id: string
  code: string
  format: BarcodeFormat
  product?: ScannedProduct
  scannedAt: number
  location?: {
    latitude: number
    longitude: number
  }
}
