/**
 * Certification & Compliance Hub Types
 *
 * Types for managing producer certifications (GOST, organic, halal, kosher, eco-labels)
 */

// =============================================================================
// Enums
// =============================================================================

export type CertificationCategory =
  | 'quality_standard'  // GOST, ISO
  | 'organic'           // Organic certifications
  | 'religious'         // Halal, Kosher
  | 'eco_label'         // Eco-friendly labels
  | 'safety'            // Sanitary, safety
  | 'origin'            // PDO, PGI, geographic
  | 'other'

export type VerificationStatus =
  | 'pending'        // Awaiting review
  | 'verified'       // Confirmed by chestno.ru
  | 'rejected'       // Failed verification
  | 'expired'        // Past expiry date
  | 'revoked'        // Revoked by issuing body
  | 'auto_verified'  // Verified via API

export type VerificationRequestType =
  | 'authenticity_check'
  | 'dispute'
  | 'renewal_inquiry'

export type VerificationRequestStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'dismissed'

// =============================================================================
// Certification Types (Reference Data)
// =============================================================================

export interface CertificationType {
  id: string
  code: string
  name_ru: string
  name_en: string
  description_ru?: string
  description_en?: string
  category: CertificationCategory
  issuing_body_name_ru?: string
  issuing_body_name_en?: string
  issuing_body_website?: string
  issuing_body_country: string
  logo_url?: string
  badge_color: string
  requires_document: boolean
  auto_verify_enabled: boolean
  is_active: boolean
  display_order: number
}

export interface CertificationTypePublic {
  id: string
  code: string
  name_ru: string
  name_en: string
  category: CertificationCategory
  logo_url?: string
  badge_color: string
}

// =============================================================================
// Producer Certifications
// =============================================================================

export interface ProducerCertificationCreate {
  certification_type_id: string
  certificate_number?: string
  issued_by?: string
  issued_date?: string  // ISO date
  expiry_date?: string  // ISO date
  scope_description?: string
  product_ids?: string[]
  is_public?: boolean
  display_on_products?: boolean
}

export interface ProducerCertificationUpdate {
  certificate_number?: string
  issued_by?: string
  issued_date?: string
  expiry_date?: string
  scope_description?: string
  product_ids?: string[]
  is_public?: boolean
  display_on_products?: boolean
}

export interface ProducerCertification {
  id: string
  organization_id: string
  certification_type_id: string
  certification_type?: CertificationTypePublic

  // Certificate details
  certificate_number?: string
  issued_by?: string
  issued_date?: string
  expiry_date?: string
  scope_description?: string
  product_ids?: string[]

  // Document
  document_url?: string
  document_original_name?: string
  document_uploaded_at?: string

  // Verification
  verification_status: VerificationStatus
  verification_notes?: string
  verified_at?: string

  // Visibility
  is_public: boolean
  display_on_products: boolean

  // Computed
  is_valid: boolean
  days_until_expiry?: number

  created_at: string
  updated_at: string
}

export interface ProducerCertificationPublic {
  id: string
  certification_type: CertificationTypePublic
  certificate_number?: string
  issued_by?: string
  issued_date?: string
  expiry_date?: string
  scope_description?: string
  verification_status: VerificationStatus
  is_valid: boolean
}

// =============================================================================
// Document Management
// =============================================================================

export interface DocumentUploadResponse {
  document_url: string
  original_name: string
  uploaded_at: string
  file_size_bytes: number
}

export interface DocumentVerificationResult {
  is_valid: boolean
  confidence_score: number
  extracted_data: Record<string, unknown>
  warnings: string[]
  errors: string[]
}

// =============================================================================
// Verification
// =============================================================================

export interface VerifyExternalResponse {
  is_verified: boolean
  verification_source: string
  external_id?: string
  verification_date: string
  valid_until?: string
  details: Record<string, unknown>
}

export interface VerificationLogEntry {
  id: string
  certification_id: string
  action: string
  previous_status?: string
  new_status: string
  notes?: string
  performed_by?: string
  performed_at: string
}

// =============================================================================
// Expiry Alerts
// =============================================================================

export interface ExpiryAlert {
  id: string
  certification_id: string
  organization_id: string
  certification_type_name: string
  certificate_number?: string
  expiry_date: string
  alert_days_before: number
  scheduled_at: string
  sent_at?: string
  acknowledged_at?: string
}

export interface ExpiryAlertSettings {
  alert_days: number[]
  email_enabled: boolean
  push_enabled: boolean
}

// =============================================================================
// Consumer Verification Portal
// =============================================================================

export interface ConsumerVerificationRequest {
  certification_id: string
  request_type: VerificationRequestType
  reason?: string
}

export interface CertificationSearchFilters {
  certification_types?: string[]
  categories?: CertificationCategory[]
  verified_only?: boolean
  include_expired?: boolean
}

export interface CertificationSearchResult {
  product_id: string
  product_name: string
  organization_id: string
  organization_name: string
  certifications: ProducerCertificationPublic[]
}

export interface CertificationSearchResponse {
  results: CertificationSearchResult[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

// =============================================================================
// Organization Summary
// =============================================================================

export interface OrganizationCertificationSummary {
  organization_id: string
  total_certifications: number
  verified_count: number
  pending_count: number
  expiring_soon_count: number
  expired_count: number
  certifications_by_category: Record<string, number>
  certifications: ProducerCertificationPublic[]
}

// =============================================================================
// Admin Dashboard
// =============================================================================

export interface CertificationAdminStats {
  total_certifications: number
  pending_verification: number
  verified_today: number
  expiring_this_week: number
  open_disputes: number
  by_status: Record<string, number>
  by_category: Record<string, number>
  recent_submissions: ProducerCertification[]
}

export interface PendingVerificationItem {
  certification: ProducerCertification
  organization_name: string
  submitted_at: string
  days_pending: number
  document_available: boolean
}

// =============================================================================
// Display Configuration
// =============================================================================

export const VERIFICATION_STATUS_CONFIG: Record<VerificationStatus, {
  label_ru: string
  label_en: string
  color: string
  bgColor: string
  icon: string
}> = {
  pending: {
    label_ru: 'На проверке',
    label_en: 'Pending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: 'clock',
  },
  verified: {
    label_ru: 'Подтверждён',
    label_en: 'Verified',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'check-circle',
  },
  auto_verified: {
    label_ru: 'Автоподтверждён',
    label_en: 'Auto-verified',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'check-badge',
  },
  rejected: {
    label_ru: 'Отклонён',
    label_en: 'Rejected',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'x-circle',
  },
  expired: {
    label_ru: 'Истёк',
    label_en: 'Expired',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: 'exclamation-circle',
  },
  revoked: {
    label_ru: 'Отозван',
    label_en: 'Revoked',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'ban',
  },
}

export const CATEGORY_CONFIG: Record<CertificationCategory, {
  label_ru: string
  label_en: string
  icon: string
  color: string
}> = {
  quality_standard: {
    label_ru: 'Стандарт качества',
    label_en: 'Quality Standard',
    icon: 'badge-check',
    color: '#1E40AF',
  },
  organic: {
    label_ru: 'Органик',
    label_en: 'Organic',
    icon: 'leaf',
    color: '#22C55E',
  },
  religious: {
    label_ru: 'Религиозный',
    label_en: 'Religious',
    icon: 'star',
    color: '#10B981',
  },
  eco_label: {
    label_ru: 'Эко-маркировка',
    label_en: 'Eco Label',
    icon: 'globe',
    color: '#84CC16',
  },
  safety: {
    label_ru: 'Безопасность',
    label_en: 'Safety',
    icon: 'shield-check',
    color: '#EF4444',
  },
  origin: {
    label_ru: 'Происхождение',
    label_en: 'Origin',
    icon: 'map-pin',
    color: '#8B5CF6',
  },
  other: {
    label_ru: 'Другое',
    label_en: 'Other',
    icon: 'document-text',
    color: '#6B7280',
  },
}

// Common Russian certifications with their codes
export const COMMON_CERTIFICATIONS = {
  // Quality Standards
  GOST_R: 'gost_r',
  GOST_ISO: 'gost_iso',
  ISO_9001: 'iso_9001',
  ISO_22000: 'iso_22000',
  ROSKACHESTVO: 'roskachestvo',

  // Organic
  ORGANIC_RU: 'organic_ru',
  ORGANIC_EU: 'organic_eu',
  USDA_ORGANIC: 'usda_organic',
  ECOCERT: 'ecocert',

  // Religious
  HALAL_RU: 'halal_ru',
  HALAL_ISWA: 'halal_iswa',
  KOSHER_RU: 'kosher_ru',
  KOSHER_OU: 'kosher_ou',

  // Eco Labels
  LEAF_OF_LIFE: 'leaf_of_life',
  ECO_PRODUCT_RU: 'eco_product_ru',
  FSC: 'fsc',
  RAINFOREST_ALLIANCE: 'rainforest_alliance',

  // Safety
  SANITARY_RU: 'sanitary_ru',
  DECLARATION_CONFORMITY: 'declaration_conformity',
  FIRE_SAFETY: 'fire_safety',

  // Origin
  PDO_RU: 'pdo_ru',
  PGI_RU: 'pgi_ru',
} as const
