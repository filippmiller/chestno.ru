/**
 * Retail Store System Types
 * Types for retail stores, kiosks, staff training, and marketing materials
 */

// ============================================
// RETAIL STORE TYPES
// ============================================

export type StoreStatus = 'active' | 'pending' | 'inactive'
export type ScanSource = 'shelf' | 'kiosk' | 'checkout' | 'staff_device' | 'signage'
export type StatusLevel = 'A' | 'B' | 'C'

export interface RetailStore {
  id: string
  store_code: string
  name: string
  chain_name?: string
  address: string
  city: string
  region?: string
  postal_code?: string
  latitude?: number
  longitude?: number
  manager_name?: string
  manager_email?: string
  manager_phone?: string
  is_active: boolean
  verified_at?: string
  created_at: string
  updated_at: string
}

export interface StoreProduct {
  id: string
  store_id: string
  product_id: string
  organization_id: string
  aisle?: string
  shelf_position?: string
  store_price_cents?: number
  in_stock: boolean
  last_stock_check?: string
  created_at: string
  updated_at: string
  // Joined data
  product?: {
    name: string
    brand?: string
    status_level?: StatusLevel
  }
}

export interface StoreScanEvent {
  id: string
  qr_scan_event_id?: string
  store_id?: string
  product_id?: string
  organization_id: string
  scan_source: ScanSource
  store_staff_id?: string
  scanned_at: string
}

export interface StoreAnalytics {
  store_id: string
  store_name: string
  total_scans: number
  unique_products_scanned: number
  unique_customers: number
  scans_by_source: Record<ScanSource, number>
  top_products: Array<{
    product_id: string
    product_name: string
    scan_count: number
  }>
  daily_scans: Array<{
    date: string
    count: number
  }>
  period_days: number
}

export interface StoreRegistration {
  name: string
  chain_name?: string
  address: string
  city: string
  region?: string
  postal_code?: string
  latitude?: number
  longitude?: number
  manager_name?: string
  manager_email?: string
  manager_phone?: string
}

export interface StoresListResponse {
  stores: RetailStore[]
  total: number
  has_more: boolean
}

export interface StoreAnalyticsResponse {
  analytics: StoreAnalytics
  comparison?: {
    previous_period_scans: number
    change_percent: number
  }
}

// ============================================
// KIOSK TYPES
// ============================================

export interface KioskConfig {
  storeId: string
  storeName: string
  brandingColor?: string
  logoUrl?: string
  idleVideoUrl?: string
  language: 'ru' | 'en'
  features: {
    priceComparison: boolean
    reviews: boolean
    loyaltySignup: boolean
    printReceipt: boolean
  }
}

export interface Kiosk {
  id: string
  store_id: string
  device_code: string
  device_name?: string
  location_in_store?: string
  config: KioskConfig
  last_heartbeat?: string
  is_online: boolean
  created_at: string
  updated_at: string
}

export interface KioskSession {
  id: string
  kiosk_id: string
  session_token: string
  started_at: string
  ended_at?: string
  products_scanned: number
  reviews_submitted: number
  loyalty_signups: number
}

export interface KioskScanResult {
  product: {
    id: string
    name: string
    brand?: string
    statusLevel: StatusLevel
    trustScore: number
    verificationDate: string
    certifications: string[]
    origin?: string
    ingredients?: string[]
    imageUrl?: string
  }
  priceComparison?: {
    currentPrice: number
    averagePrice: number
    lowestPrice: number
    priceHistory: Array<{ date: string; price: number }>
  }
  reviews?: {
    averageRating: number
    totalReviews: number
    recentReviews: Array<{
      text: string
      rating: number
      date: string
      author?: string
    }>
  }
}

export interface KioskAuthResponse {
  success: boolean
  session_token?: string
  config?: KioskConfig
  error?: string
}

export type KioskState = 'idle' | 'scanning' | 'loading' | 'result' | 'error'

// ============================================
// SHELF TALKER / MARKETING TYPES
// ============================================

export type ShelfTalkerType = 'shelf_talker' | 'hang_tag' | 'sticker' | 'poster' | 'digital_sign'

export interface ShelfTalkerSize {
  width: number  // mm
  height: number // mm
  dpi: number
}

export interface ShelfTalkerConfig {
  type: ShelfTalkerType
  size: ShelfTalkerSize
  content: {
    productName: string
    statusLevel: StatusLevel
    qrCodeUrl: string
    tagline?: string
    certifications?: string[]
    showPrice?: boolean
    price?: number
  }
  branding: {
    brandLogo?: string
    accentColor?: string
    includeChestnoLogo: boolean
  }
  language: 'ru' | 'en'
}

export const SHELF_TALKER_PRESETS: Record<string, ShelfTalkerSize> = {
  small: { width: 52, height: 74, dpi: 300 },
  medium: { width: 70, height: 100, dpi: 300 },
  large: { width: 100, height: 150, dpi: 300 },
  a4_poster: { width: 210, height: 297, dpi: 300 },
  digital_hd: { width: 1920, height: 1080, dpi: 72 },
  digital_4k: { width: 3840, height: 2160, dpi: 72 },
}

export interface ShelfTalkerTemplate {
  id: string
  name: string
  description: string
  preview_url: string
  type: ShelfTalkerType
  default_size: string
}

export interface ShelfTalkerGenerateResponse {
  download_url: string
  preview_url: string
  expires_at: string
}

// ============================================
// STAFF TRAINING TYPES
// ============================================

export type TrainingModuleType = 'video' | 'interactive' | 'quiz'
export type TrainingStatus = 'not_started' | 'in_progress' | 'completed' | 'failed'
export type AssistanceType = 'helped_scan' | 'explained_badge' | 'answered_question'

export interface TrainingModule {
  id: string
  title: string
  description?: string
  duration_minutes: number
  content_type: TrainingModuleType
  content_url?: string
  content_data?: Record<string, unknown>
  prerequisite_module_id?: string
  passing_score: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RetailStaff {
  id: string
  user_id: string
  store_id: string
  employee_id?: string
  department?: string
  position?: string
  is_certified: boolean
  certified_at?: string
  certification_expires_at?: string
  customer_assists: number
  scans_assisted: number
  created_at: string
  updated_at: string
  // Joined data
  user?: {
    full_name?: string
    email?: string
    avatar_url?: string
  }
  store?: {
    name: string
    chain_name?: string
  }
}

export interface TrainingProgress {
  id: string
  staff_id: string
  module_id: string
  status: TrainingStatus
  progress_percent: number
  quiz_attempts: number
  best_score?: number
  started_at?: string
  completed_at?: string
  // Joined data
  module?: TrainingModule
}

export interface StaffCertification {
  staff_id: string
  staff_name: string
  store_name: string
  is_certified: boolean
  certified_at?: string
  expires_at?: string
  modules_completed: number
  total_modules: number
  badge_url?: string
}

export interface StaffLeaderboardEntry {
  rank: number
  staff_id: string
  staff_name: string
  avatar_url?: string
  store_name: string
  customer_assists: number
  scans_assisted: number
  is_certified: boolean
}

export interface StaffLeaderboardResponse {
  entries: StaffLeaderboardEntry[]
  total_staff: number
  period: 'all_time' | 'monthly' | 'weekly'
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correct_index?: number // Only sent after submission
}

export interface QuizSubmission {
  module_id: string
  answers: Array<{
    question_id: string
    selected_index: number
  }>
}

export interface QuizResult {
  passed: boolean
  score: number
  passing_score: number
  correct_answers: number
  total_questions: number
  feedback?: Array<{
    question_id: string
    correct: boolean
    correct_index: number
    explanation?: string
  }>
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface StoreListParams {
  chain_name?: string
  city?: string
  is_active?: boolean
  limit?: number
  offset?: number
}

export interface StoreAnalyticsParams {
  period_days?: number
}

export interface TrainingModulesResponse {
  modules: TrainingModule[]
  total: number
}

export interface StaffTrainingProgressResponse {
  progress: TrainingProgress[]
  certification: StaffCertification
}

export interface AssistedScanRequest {
  scan_event_id: string
  assistance_type: AssistanceType
}
