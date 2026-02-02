/**
 * Type definitions for Producer Scan Notifications
 *
 * Real-time notification system for producers when their products are scanned.
 */

// ============================================
// Enums and Constants
// ============================================

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'telegram' | 'webhook'
export type NotificationType = 'scan' | 'batch_summary' | 'first_scan' | 'suspicious' | 'milestone' | 'new_region'
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped'

export const CHANNEL_CONFIG: Record<NotificationChannel, { label: string; icon: string; description: string }> = {
  in_app: {
    label: 'В приложении',
    icon: 'bell',
    description: 'Уведомления в интерфейсе платформы',
  },
  push: {
    label: 'Push-уведомления',
    icon: 'smartphone',
    description: 'Мгновенные уведомления на устройство',
  },
  email: {
    label: 'Email',
    icon: 'mail',
    description: 'Уведомления на электронную почту',
  },
  telegram: {
    label: 'Telegram',
    icon: 'message-circle',
    description: 'Уведомления в Telegram бот',
  },
  webhook: {
    label: 'Webhook',
    icon: 'webhook',
    description: 'HTTP вызов внешнего сервиса',
  },
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { label: string; description: string; color: string }> = {
  scan: {
    label: 'Сканирование',
    description: 'Обычное сканирование продукта',
    color: 'bg-blue-100 text-blue-800',
  },
  batch_summary: {
    label: 'Сводка',
    description: 'Сводка сканирований за период',
    color: 'bg-gray-100 text-gray-800',
  },
  first_scan: {
    label: 'Первое сканирование',
    description: 'Первое сканирование продукта',
    color: 'bg-green-100 text-green-800',
  },
  suspicious: {
    label: 'Подозрительное',
    description: 'Подозрительная активность',
    color: 'bg-red-100 text-red-800',
  },
  milestone: {
    label: 'Достижение',
    description: 'Достигнут рубеж сканирований',
    color: 'bg-purple-100 text-purple-800',
  },
  new_region: {
    label: 'Новый регион',
    description: 'Сканирование из нового региона',
    color: 'bg-yellow-100 text-yellow-800',
  },
}

export const STATUS_CONFIG: Record<NotificationStatus, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'bg-yellow-500' },
  sent: { label: 'Отправлено', color: 'bg-blue-500' },
  delivered: { label: 'Доставлено', color: 'bg-green-500' },
  failed: { label: 'Ошибка', color: 'bg-red-500' },
  skipped: { label: 'Пропущено', color: 'bg-gray-500' },
}

// ============================================
// Preferences Types
// ============================================

export interface ScanNotificationPreferences {
  id: string
  organization_id: string
  enabled: boolean
  channels: NotificationChannel[]
  regions_filter: string[] | null
  notify_business_hours_only: boolean
  business_hours_start: string | null
  business_hours_end: string | null
  timezone: string
  batch_notifications: boolean
  batch_interval_minutes: number
  min_scans_for_notification: number
  notify_new_regions_only: boolean
  notify_first_scan_per_product: boolean
  notify_on_suspicious_scans: boolean
  product_ids_filter: string[] | null
  created_at: string
  updated_at: string
}

export interface ScanNotificationPreferencesUpdate {
  enabled?: boolean
  channels?: NotificationChannel[]
  regions_filter?: string[] | null
  notify_business_hours_only?: boolean
  business_hours_start?: string | null
  business_hours_end?: string | null
  timezone?: string
  batch_notifications?: boolean
  batch_interval_minutes?: number
  min_scans_for_notification?: number
  notify_new_regions_only?: boolean
  notify_first_scan_per_product?: boolean
  notify_on_suspicious_scans?: boolean
  product_ids_filter?: string[] | null
}

// ============================================
// Notification History Types
// ============================================

export interface ScanNotificationHistory {
  id: string
  organization_id: string
  scan_event_id: string | null
  channel: NotificationChannel
  notification_type: NotificationType
  status: NotificationStatus
  product_id: string | null
  batch_id: string | null
  scan_country: string | null
  scan_city: string | null
  scan_count: number
  aggregated_scan_ids: string[] | null
  error_message: string | null
  notified_at: string
  delivered_at: string | null
  metadata: Record<string, unknown> | null
}

export interface ScanNotificationHistoryListResponse {
  items: ScanNotificationHistory[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ============================================
// Live Scan Feed Types
// ============================================

export interface LiveScanFeedItem {
  id: string
  organization_id: string
  scan_event_id: string | null
  product_id: string | null
  product_name: string | null
  product_slug: string | null
  batch_code: string | null
  country: string | null
  city: string | null
  region: string | null
  device_type: string | null
  is_first_scan: boolean
  is_suspicious: boolean
  is_new_region: boolean
  scanned_at: string
}

export interface LiveScanFeedResponse {
  items: LiveScanFeedItem[]
  total: number
  has_more: boolean
}

// ============================================
// Statistics Types
// ============================================

export interface ScanNotificationStats {
  total_notifications_sent: number
  notifications_today: number
  notifications_this_week: number
  by_channel: Record<string, number>
  by_type: Record<string, number>
  by_status: Record<string, number>
  avg_delivery_time_seconds: number | null
}

export interface LiveScanStats {
  total_scans_today: number
  total_scans_week: number
  unique_products_scanned: number
  unique_regions: number
  suspicious_scans_count: number
  first_scans_count: number
  top_countries: Array<{ country: string; count: number }>
  top_products: Array<{ product_name: string; product_id: string; count: number }>
}

// ============================================
// WebSocket Types
// ============================================

export interface WebSocketScanEvent {
  type: 'scan' | 'connected' | 'pong' | 'heartbeat' | 'error'
  data?: LiveScanFeedItem
  organization_id?: string
  message?: string
  timestamp: string
}

export type WebSocketMessageType = 'subscribe' | 'unsubscribe' | 'ping'

export interface WebSocketOutgoingMessage {
  type: WebSocketMessageType
}

// ============================================
// Form Types
// ============================================

export interface ScanNotificationSettingsFormData {
  enabled: boolean
  channels: NotificationChannel[]
  regions_filter: string[]
  notify_business_hours_only: boolean
  business_hours_start: string
  business_hours_end: string
  timezone: string
  batch_notifications: boolean
  batch_interval_minutes: number
  min_scans_for_notification: number
  notify_new_regions_only: boolean
  notify_first_scan_per_product: boolean
  notify_on_suspicious_scans: boolean
}

// ============================================
// Component Props Types
// ============================================

export interface ScanNotificationSettingsProps {
  preferences: ScanNotificationPreferences
  onSubmit: (data: ScanNotificationPreferencesUpdate) => Promise<void>
  isLoading?: boolean
}

export interface LiveScanFeedProps {
  organizationId: string
  initialItems?: LiveScanFeedItem[]
  autoRefresh?: boolean
  refreshInterval?: number
}

export interface ScanNotificationBadgeProps {
  count: number
  variant?: 'default' | 'pulse' | 'minimal'
  onClick?: () => void
}

// ============================================
// Timezone Constants
// ============================================

export const RUSSIAN_TIMEZONES = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
] as const
