/**
 * Type definitions for the Real-time Scan Alert System
 *
 * This module provides comprehensive types for:
 * - Alert rules configuration
 * - Fired alerts with status tracking
 * - Notification delivery channels
 * - Telegram integration
 * - Organization preferences
 */

// ============================================
// Enums and Constants
// ============================================

export type AlertRuleType =
  | 'first_scan'
  | 'scan_spike'
  | 'unusual_location'
  | 'time_anomaly'
  | 'counterfeit_pattern'
  | 'milestone'
  | 'negative_review'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertStatus =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'resolved'
  | 'dismissed'

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'telegram'

export type DigestFrequency = 'instant' | 'daily' | 'weekly' | 'never'

export const ALERT_SEVERITY_CONFIG = {
  info: {
    color: 'bg-blue-50 border-blue-500 text-blue-800',
    icon: 'info',
    label: 'Информация',
  },
  warning: {
    color: 'bg-yellow-50 border-yellow-500 text-yellow-800',
    icon: 'alert-triangle',
    label: 'Предупреждение',
  },
  critical: {
    color: 'bg-red-50 border-red-500 text-red-800',
    icon: 'alert-octagon',
    label: 'Критическое',
  },
} as const

export const ALERT_STATUS_CONFIG = {
  new: { label: 'Новое', color: 'bg-blue-500' },
  acknowledged: { label: 'Принято', color: 'bg-yellow-500' },
  investigating: { label: 'Расследуется', color: 'bg-purple-500' },
  resolved: { label: 'Решено', color: 'bg-green-500' },
  dismissed: { label: 'Отклонено', color: 'bg-gray-500' },
} as const

export const RULE_TYPE_CONFIG: Record<
  AlertRuleType,
  { label: string; description: string; icon: string }
> = {
  first_scan: {
    label: 'Первое сканирование',
    description: 'Уведомление при первом сканировании новой партии',
    icon: 'scan',
  },
  scan_spike: {
    label: 'Всплеск активности',
    description: 'Резкий рост количества сканирований',
    icon: 'trending-up',
  },
  unusual_location: {
    label: 'Необычный регион',
    description: 'Сканирование из неожиданного географического региона',
    icon: 'map-pin',
  },
  time_anomaly: {
    label: 'Временная аномалия',
    description: 'Необычное время сканирования',
    icon: 'clock',
  },
  counterfeit_pattern: {
    label: 'Признаки подделки',
    description: 'Паттерны, указывающие на возможную подделку',
    icon: 'shield-alert',
  },
  milestone: {
    label: 'Достижение рубежа',
    description: 'Уведомление при достижении определённого числа сканирований',
    icon: 'trophy',
  },
  negative_review: {
    label: 'Негативный отзыв',
    description: 'Уведомление о новых негативных отзывах',
    icon: 'thumbs-down',
  },
}

// ============================================
// Product Batch Types
// ============================================

export interface ProductBatch {
  id: string
  organization_id: string
  product_id: string
  batch_code: string
  batch_name?: string | null
  production_date?: string | null
  expiry_date?: string | null
  quantity?: number | null
  metadata?: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  product?: {
    id: string
    name: string
    slug: string
  }
}

// ============================================
// Alert Rule Types
// ============================================

export interface FirstScanRuleConfig {
  notify_for_each_batch: boolean
}

export interface ScanSpikeRuleConfig {
  threshold_multiplier: number
  min_scans: number
  window_minutes: number
}

export interface UnusualLocationRuleConfig {
  expected_countries: string[]
  alert_on_new_country: boolean
}

export interface CounterfeitPatternRuleConfig {
  max_scans_per_hour: number
  geographic_spread_threshold: number
}

export interface MilestoneRuleConfig {
  milestones: number[]
}

export interface NegativeReviewRuleConfig {
  min_rating_threshold: number
  include_no_text: boolean
}

export type AlertRuleConfig =
  | FirstScanRuleConfig
  | ScanSpikeRuleConfig
  | UnusualLocationRuleConfig
  | CounterfeitPatternRuleConfig
  | MilestoneRuleConfig
  | NegativeReviewRuleConfig

export interface ScanAlertRule {
  id: string
  organization_id: string
  rule_type: AlertRuleType
  rule_name: string
  is_enabled: boolean
  priority: number
  config: AlertRuleConfig
  channels: NotificationChannel[]
  cooldown_minutes: number
  escalate_after_minutes?: number | null
  escalate_to_user_ids?: string[] | null
  created_at: string
  updated_at: string
}

export interface ScanAlertRuleFormData {
  rule_type: AlertRuleType
  rule_name: string
  is_enabled: boolean
  priority: number
  config: AlertRuleConfig
  channels: NotificationChannel[]
  cooldown_minutes: number
  escalate_after_minutes?: number
  escalate_to_user_ids?: string[]
}

// ============================================
// Alert Types
// ============================================

export interface ScanAlert {
  id: string
  organization_id: string
  rule_id?: string | null
  alert_type: string
  severity: AlertSeverity
  batch_id?: string | null
  product_id?: string | null
  scan_event_id?: string | null
  title: string
  body: string
  metadata: Record<string, unknown>
  status: AlertStatus
  acknowledged_at?: string | null
  acknowledged_by?: string | null
  resolved_at?: string | null
  resolved_by?: string | null
  resolution_notes?: string | null
  is_escalated: boolean
  escalated_at?: string | null
  escalation_level: number
  created_at: string
  // Joined fields
  batch?: ProductBatch | null
  product?: {
    id: string
    name: string
    slug: string
  } | null
  rule?: ScanAlertRule | null
}

export interface ScanAlertListFilters {
  status?: AlertStatus[]
  severity?: AlertSeverity[]
  alert_type?: string[]
  batch_id?: string
  product_id?: string
  date_from?: string
  date_to?: string
  is_escalated?: boolean
}

export interface ScanAlertStats {
  total: number
  by_status: Record<AlertStatus, number>
  by_severity: Record<AlertSeverity, number>
  unacknowledged_count: number
  escalated_count: number
  avg_resolution_time_hours?: number
}

// ============================================
// Telegram Integration Types
// ============================================

export interface UserTelegramLink {
  id: string
  user_id: string
  telegram_chat_id: string
  telegram_username?: string | null
  is_verified: boolean
  verification_code?: string | null
  verification_expires_at?: string | null
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface TelegramVerificationRequest {
  verification_code: string
}

export interface TelegramBotMessage {
  chat_id: string
  text: string
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disable_notification?: boolean
  reply_markup?: TelegramInlineKeyboard
}

export interface TelegramInlineKeyboard {
  inline_keyboard: Array<
    Array<{
      text: string
      url?: string
      callback_data?: string
    }>
  >
}

// ============================================
// Organization Alert Preferences
// ============================================

export interface OrganizationAlertPreferences {
  id: string
  organization_id: string
  alerts_enabled: boolean
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
  quiet_hours_timezone: string
  default_channels: NotificationChannel[]
  auto_escalate_critical: boolean
  escalation_delay_minutes: number
  send_daily_digest: boolean
  digest_time?: string | null
  scan_spike_threshold: number
  scan_spike_window_minutes: number
  created_at: string
  updated_at: string
}

export interface AlertPreferencesFormData {
  alerts_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  quiet_hours_timezone: string
  default_channels: NotificationChannel[]
  auto_escalate_critical: boolean
  escalation_delay_minutes: number
  send_daily_digest: boolean
  digest_time?: string
  scan_spike_threshold: number
  scan_spike_window_minutes: number
}

// ============================================
// Scan Statistics Types
// ============================================

export interface ScanStatistics {
  id: string
  organization_id: string
  batch_id?: string | null
  product_id?: string | null
  bucket_start: string
  bucket_type: 'hour' | 'day' | 'week'
  scan_count: number
  unique_users: number
  unique_locations: number
  suspicious_count: number
  top_countries: Array<{ country: string; count: number }>
  top_cities: Array<{ city: string; count: number }>
  avg_scans_per_hour?: number | null
  deviation_from_normal?: number | null
  created_at: string
}

// ============================================
// Real-time Subscription Types
// ============================================

export interface ScanAlertRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: ScanAlert | null
  old: ScanAlert | null
}

export interface ScanEventRealtimePayload {
  eventType: 'INSERT'
  new: {
    id: string
    organization_id: string
    batch_id?: string
    product_id?: string
    country?: string
    city?: string
    created_at: string
    is_suspicious: boolean
  }
}

// ============================================
// API Response Types
// ============================================

export interface AlertsListResponse {
  alerts: ScanAlert[]
  total: number
  page: number
  per_page: number
  stats: ScanAlertStats
}

export interface AlertActionResponse {
  success: boolean
  alert: ScanAlert
  message?: string
}

// ============================================
// Component Props Types
// ============================================

export interface AlertCardProps {
  alert: ScanAlert
  onAcknowledge?: (id: string) => void
  onResolve?: (id: string, notes?: string) => void
  onDismiss?: (id: string) => void
  onViewDetails?: (id: string) => void
  isCompact?: boolean
}

export interface AlertRuleFormProps {
  rule?: ScanAlertRule
  onSubmit: (data: ScanAlertRuleFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export interface AlertPreferencesFormProps {
  preferences: OrganizationAlertPreferences
  onSubmit: (data: AlertPreferencesFormData) => Promise<void>
  isLoading?: boolean
}

export interface TelegramLinkFormProps {
  link?: UserTelegramLink
  onVerify: (code: string) => Promise<void>
  onUnlink: () => Promise<void>
  isLoading?: boolean
}

// ============================================
// Utility Types
// ============================================

export type AlertRuleConfigByType<T extends AlertRuleType> = T extends 'first_scan'
  ? FirstScanRuleConfig
  : T extends 'scan_spike'
    ? ScanSpikeRuleConfig
    : T extends 'unusual_location'
      ? UnusualLocationRuleConfig
      : T extends 'counterfeit_pattern'
        ? CounterfeitPatternRuleConfig
        : T extends 'milestone'
          ? MilestoneRuleConfig
          : T extends 'negative_review'
            ? NegativeReviewRuleConfig
            : never

export function getDefaultRuleConfig<T extends AlertRuleType>(
  type: T
): AlertRuleConfigByType<T> {
  const defaults: Record<AlertRuleType, AlertRuleConfig> = {
    first_scan: { notify_for_each_batch: true },
    scan_spike: { threshold_multiplier: 3, min_scans: 50, window_minutes: 60 },
    unusual_location: { expected_countries: ['RU'], alert_on_new_country: true },
    time_anomaly: { expected_hours_start: 6, expected_hours_end: 22 } as unknown as AlertRuleConfig,
    counterfeit_pattern: { max_scans_per_hour: 10, geographic_spread_threshold: 3 },
    milestone: { milestones: [100, 500, 1000, 5000, 10000] },
    negative_review: { min_rating_threshold: 3, include_no_text: false },
  }
  return defaults[type] as AlertRuleConfigByType<T>
}
