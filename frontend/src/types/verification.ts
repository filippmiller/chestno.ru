// Purchase Verification Types

export type VerificationMethod =
  | 'chestny_znak'     // Честный ЗНАК API verification
  | 'qr_scan'          // QR code scan proof
  | 'receipt_upload'   // Receipt photo upload
  | 'manual_admin'     // Manual admin verification
  | 'loyalty_purchase' // Loyalty program purchase

export type VerificationStatus =
  | 'pending'
  | 'verified'
  | 'failed'
  | 'expired'
  | 'revoked'

export type BadgeType =
  | 'government_verified'  // Честный ЗНАК
  | 'qr_verified'          // QR scan
  | 'receipt_verified'     // Receipt
  | 'admin_verified'       // Manual
  | 'loyalty_verified'     // Loyalty
  | 'verified'             // Generic
  | 'unverified'

// Main verification record
export interface PurchaseVerification {
  id: string
  review_id: string
  user_id: string
  organization_id: string
  product_id?: string | null

  method: VerificationMethod
  status: VerificationStatus

  // Честный ЗНАК fields
  chestny_znak_code?: string | null
  chestny_znak_gtin?: string | null
  chestny_znak_serial?: string | null
  chestny_znak_verified_at?: string | null
  chestny_znak_response?: ChestnyZnakResponse | null

  // QR scan fields
  qr_code_id?: string | null
  qr_scan_event_id?: string | null
  qr_scanned_at?: string | null

  // Receipt fields
  receipt_image_url?: string | null
  receipt_date?: string | null
  receipt_amount_cents?: number | null
  receipt_ocr_result?: ReceiptOCRResult | null
  receipt_verified_by?: string | null
  receipt_verified_at?: string | null

  // Trust scoring
  trust_score: number
  trust_factors: TrustFactors

  verification_notes?: string | null
  verified_by?: string | null
  created_at: string
  updated_at: string
  expires_at?: string | null
}

// Честный ЗНАК API response types
export interface ChestnyZnakResponse {
  cis: string
  gtin: string
  sgtin: string
  status: ChestnyZnakStatus
  producerName?: string
  productName?: string
  productGroupName?: string
  ownerName?: string
  lastOperation?: string
  lastOperationDate?: string
  emissionDate?: string
  packType?: string
}

export type ChestnyZnakStatus =
  | 'EMITTED'           // Эмитирован
  | 'APPLIED'           // Нанесен
  | 'INTRODUCED'        // Введен в оборот
  | 'IN_CIRCULATION'    // В обороте
  | 'RETIRED'           // Выбыл
  | 'WRITTEN_OFF'       // Списан
  | 'DISAGGREGATION'    // Расформирован

// Честный ЗНАК verification request
export interface ChestnyZnakVerifyRequest {
  code: string                    // DataMatrix code (raw or normalized)
  organization_id?: string
  product_id?: string
}

export interface ChestnyZnakVerifyResult {
  is_valid: boolean
  is_sold: boolean
  product_name?: string
  producer_name?: string
  gtin?: string
  serial?: string
  status?: ChestnyZnakStatus
  error_code?: string
  error_message?: string
}

// Receipt OCR result
export interface ReceiptOCRResult {
  vendor_name?: string
  vendor_inn?: string
  date?: string
  time?: string
  total_amount?: number
  items?: ReceiptItem[]
  qr_data?: string
  raw_text?: string
  confidence?: number
}

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
  sum: number
}

// Trust factors breakdown
export interface TrustFactors {
  method_weight: number           // Base weight for verification method
  time_factor?: number            // Recency of verification
  match_confidence?: number       // How well product matches
  cross_verification?: number     // Multiple verification methods
  user_history?: number           // User's verification track record
}

// Verification request for queue
export interface VerificationRequest {
  id: string
  review_id: string
  user_id: string
  method: VerificationMethod
  priority: number
  request_data: VerificationRequestData
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  attempts: number
  max_attempts: number
  last_attempt_at?: string | null
  next_attempt_at?: string | null
  result_data?: unknown | null
  error_message?: string | null
  created_at: string
  updated_at: string
  completed_at?: string | null
}

export type VerificationRequestData =
  | ChestnyZnakRequestData
  | QRScanRequestData
  | ReceiptUploadRequestData
  | ManualRequestData
  | LoyaltyRequestData

export interface ChestnyZnakRequestData {
  type: 'chestny_znak'
  code: string
  gtin?: string
}

export interface QRScanRequestData {
  type: 'qr_scan'
  qr_code_id: string
  scan_timestamp: string
}

export interface ReceiptUploadRequestData {
  type: 'receipt_upload'
  image_url: string
  expected_vendor?: string
  expected_amount?: number
}

export interface ManualRequestData {
  type: 'manual_admin'
  reason: string
  evidence_urls?: string[]
}

export interface LoyaltyRequestData {
  type: 'loyalty_purchase'
  transaction_id: string
  points_earned?: number
}

// Trust config
export interface VerificationTrustConfig {
  id: string
  organization_id?: string | null

  weight_chestny_znak: number
  weight_qr_scan: number
  weight_receipt_upload: number
  weight_manual_admin: number
  weight_loyalty_purchase: number

  verified_review_boost: number
  unverified_penalty: number

  show_verification_badge: boolean
  show_method_icon: boolean
  require_verification_for_featured: boolean

  created_at: string
  updated_at: string
}

// Extended review with verification info
export interface VerifiedReview {
  id: string
  organization_id: string
  product_id?: string | null
  author_user_id: string
  rating: number
  title?: string | null
  body: string
  media: ReviewMediaItem[]
  response?: string | null
  response_at?: string | null
  created_at: string

  // Verification fields
  is_verified_purchase: boolean
  verification_method?: VerificationMethod | null
  trust_weight: number
  verification_status?: VerificationStatus | null
  trust_score?: number | null
  badge_type: BadgeType
  sort_score: number
}

interface ReviewMediaItem {
  type: 'image' | 'video'
  url: string
  thumbnail_url?: string | null
  alt?: string | null
}

// Submit verification request payload
export interface SubmitVerificationPayload {
  review_id: string
  method: VerificationMethod
  data: VerificationRequestData
}

// Badge display props
export interface VerificationBadgeProps {
  badgeType: BadgeType
  method?: VerificationMethod | null
  trustScore?: number | null
  verifiedAt?: string | null
  showTooltip?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// Verification submission form data
export interface ChestnyZnakFormData {
  code: string
}

export interface ReceiptUploadFormData {
  image: File
  date?: string
  amount?: number
}

export interface QRScanFormData {
  qr_code_id: string
}
