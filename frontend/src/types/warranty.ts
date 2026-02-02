// Warranty Management Types

export type WarrantyStatus = 'pending' | 'active' | 'expired' | 'voided' | 'transferred'
export type ClaimType = 'repair' | 'replacement' | 'refund' | 'inspection' | 'other'
export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'resolved' | 'closed'
export type ClaimPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ResolutionType = 'repaired' | 'replaced' | 'refunded' | 'no_fault_found' | 'out_of_warranty' | 'user_error' | 'other'

// Warranty Policy
export interface WarrantyPolicy {
  id: string
  organization_id: string
  product_category: string
  duration_months: number
  coverage_description: string
  terms?: string | null
  is_transferable: boolean
  requires_registration: boolean
  registration_deadline_days?: number | null
  is_active: boolean
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface WarrantyPolicyCreate {
  product_category: string
  duration_months: number
  coverage_description: string
  terms?: string | null
  is_transferable?: boolean
  requires_registration?: boolean
  registration_deadline_days?: number | null
}

// Warranty Registration
export interface WarrantyRegistration {
  id: string
  product_id: string
  user_id: string
  qr_code_id?: string | null
  policy_id?: string | null
  serial_number?: string | null
  purchase_date: string
  purchase_location?: string | null
  purchase_proof_url?: string | null
  warranty_start: string
  warranty_end: string
  status: WarrantyStatus
  contact_email?: string | null
  contact_phone?: string | null
  registered_at: string
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  days_remaining?: number
  is_valid?: boolean
}

export interface WarrantyRegistrationWithProduct extends WarrantyRegistration {
  product_name?: string | null
  product_image_url?: string | null
  organization_name?: string | null
  organization_id?: string | null
  coverage_description?: string | null
  warranty_terms?: string | null
}

export interface WarrantyRegistrationCreate {
  product_id: string
  qr_code_id?: string | null
  serial_number?: string | null
  purchase_date: string
  purchase_location?: string | null
  purchase_proof_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

// Warranty Claims
export interface WarrantyClaim {
  id: string
  registration_id: string
  claim_type: ClaimType
  description: string
  photos?: string[] | null
  status: ClaimStatus
  priority: ClaimPriority
  assigned_to?: string | null
  resolution_notes?: string | null
  resolution_type?: ResolutionType | null
  created_at: string
  updated_at: string
  resolved_at?: string | null
  metadata?: Record<string, unknown> | null
}

export interface WarrantyClaimWithDetails extends WarrantyClaim {
  product_name?: string | null
  product_id?: string | null
  customer_name?: string | null
  customer_email?: string | null
  warranty_end?: string | null
}

export interface WarrantyClaimCreate {
  claim_type: ClaimType
  description: string
  photos?: string[] | null
}

export interface WarrantyClaimUpdate {
  status?: ClaimStatus
  priority?: ClaimPriority
  assigned_to?: string | null
  resolution_notes?: string | null
  resolution_type?: ResolutionType | null
}

export interface WarrantyClaimHistoryEntry {
  id: string
  claim_id: string
  performed_by?: string | null
  old_status?: string | null
  new_status: string
  comment?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

// API Responses
export interface WarrantyRegistrationsResponse {
  items: WarrantyRegistrationWithProduct[]
  total: number
}

export interface WarrantyClaimsResponse {
  items: WarrantyClaimWithDetails[]
  total: number
}

export interface WarrantyValidityResponse {
  registration_id: string
  is_valid: boolean
  status: string
  warranty_end: string
  days_remaining: number
  message: string
}

export interface WarrantyStatsResponse {
  total_registrations: number
  active_registrations: number
  expiring_soon: number
  total_claims: number
  pending_claims: number
  resolved_claims: number
  avg_resolution_days?: number | null
}

// Labels for UI (Russian)
export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  repair: 'Ремонт',
  replacement: 'Замена',
  refund: 'Возврат',
  inspection: 'Диагностика',
  other: 'Другое',
}

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  submitted: 'Подана',
  under_review: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  in_progress: 'В работе',
  resolved: 'Решена',
  closed: 'Закрыта',
}

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  pending: 'Ожидает подтверждения',
  active: 'Активна',
  expired: 'Истекла',
  voided: 'Аннулирована',
  transferred: 'Передана',
}

export const RESOLUTION_TYPE_LABELS: Record<ResolutionType, string> = {
  repaired: 'Отремонтировано',
  replaced: 'Заменено',
  refunded: 'Возврат средств',
  no_fault_found: 'Неисправность не обнаружена',
  out_of_warranty: 'Вне гарантии',
  user_error: 'Ошибка пользователя',
  other: 'Другое',
}

export const PRIORITY_LABELS: Record<ClaimPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
}
