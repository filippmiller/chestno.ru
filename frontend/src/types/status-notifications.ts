/**
 * Type definitions for Status Level Notifications
 *
 * These types extend the existing notification system to support
 * status level events (granted, expiring, revoked, upgrade requests).
 */

export type StatusLevel = 'A' | 'B' | 'C'

export type StatusNotificationType =
  | 'status_granted'
  | 'status_expiring'
  | 'status_revoked'
  | 'upgrade_request_reviewed'

export type StatusNotificationSeverity = 'celebration' | 'warning' | 'error' | 'info'

/**
 * Metadata for status granted notifications
 */
export interface StatusGrantedMetadata {
  level: StatusLevel
  benefits?: string[]
  effective_date?: string
}

/**
 * Metadata for status expiring notifications
 */
export interface StatusExpiringMetadata {
  level: StatusLevel
  days_left: number
  expiry_date: string
  renewal_url?: string
  action_required?: string
}

/**
 * Metadata for status revoked notifications
 */
export interface StatusRevokedMetadata {
  level: StatusLevel
  reason: string
  revoked_at: string
  appeal_url?: string
}

/**
 * Metadata for upgrade request reviewed notifications
 */
export interface UpgradeRequestReviewedMetadata {
  target_level: StatusLevel
  approved: boolean
  review_notes?: string
  reviewed_by?: string
  reviewed_at: string
  next_steps?: string
}

/**
 * Union type for all status notification metadata
 */
export type StatusNotificationMetadata =
  | StatusGrantedMetadata
  | StatusExpiringMetadata
  | StatusRevokedMetadata
  | UpgradeRequestReviewedMetadata

/**
 * Complete status notification data structure
 */
export interface StatusNotification {
  id: string
  type: StatusNotificationType
  severity: StatusNotificationSeverity
  title: string
  body: string
  metadata: StatusNotificationMetadata
  created_at: string
  read: boolean
  cta_label?: string
  cta_url?: string
}

/**
 * Props for StatusNotificationCard component
 */
export interface StatusNotificationCardProps {
  notification: StatusNotification
  onRead?: (id: string) => void
  onDismiss?: (id: string) => void
  onCtaClick?: (id: string, url: string) => void
}

/**
 * Helper type guards
 */
export const isStatusGranted = (
  metadata: StatusNotificationMetadata
): metadata is StatusGrantedMetadata => {
  return 'level' in metadata && 'effective_date' in metadata
}

export const isStatusExpiring = (
  metadata: StatusNotificationMetadata
): metadata is StatusExpiringMetadata => {
  return 'days_left' in metadata && 'expiry_date' in metadata
}

export const isStatusRevoked = (
  metadata: StatusNotificationMetadata
): metadata is StatusRevokedMetadata => {
  return 'reason' in metadata && 'revoked_at' in metadata
}

export const isUpgradeRequestReviewed = (
  metadata: StatusNotificationMetadata
): metadata is UpgradeRequestReviewedMetadata => {
  return 'approved' in metadata && 'reviewed_at' in metadata
}
