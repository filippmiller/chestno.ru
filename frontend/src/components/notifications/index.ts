/**
 * Status Notifications Module
 *
 * Export all notification components, types, and utilities
 */

export {
  StatusNotificationCard,
  StatusNotificationCompact,
  buildStatusNotification,
} from './StatusNotification'

export { StatusNotificationList } from './StatusNotificationList'

export {
  mockStatusNotifications,
  mockStatusGrantedA,
  mockStatusGrantedB,
  mockStatusGrantedC,
  mockStatusExpiring7Days,
  mockStatusExpiring2Days,
  mockStatusRevoked,
  mockUpgradeApproved,
  mockUpgradeRejected,
  generateRandomMockNotification,
} from './mock-data'

export type {
  StatusNotification,
  StatusNotificationCardProps,
  StatusNotificationType,
  StatusNotificationSeverity,
  StatusLevel,
  StatusGrantedMetadata,
  StatusExpiringMetadata,
  StatusRevokedMetadata,
  UpgradeRequestReviewedMetadata,
  StatusNotificationMetadata,
} from '@/types/status-notifications'
