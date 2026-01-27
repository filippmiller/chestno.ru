/**
 * Type definitions for StatusBadge component and related functionality
 *
 * These types are also exported from @/types/auth for convenience
 */

export type StatusLevel = 'A' | 'B' | 'C' | 0

export interface StatusBadgeProps {
  level: 'A' | 'B' | 'C'
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

export interface StatusLevelConfig {
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  name: string
  description: string
}

export type StatusLevelConfigMap = {
  [K in 'A' | 'B' | 'C']: StatusLevelConfig
}

export interface OrganizationStatus {
  organization_id: string
  level: StatusLevel
  level_name?: string | null
  level_description?: string | null
  granted_at?: string | null
  expires_at?: string | null
}

export interface OrganizationStatusResponse {
  status: OrganizationStatus
}

export interface StatusHistoryItem {
  id: string
  organization_id: string
  level: StatusLevel
  action: 'granted' | 'revoked' | 'expired' | 'upgraded' | 'downgraded'
  comment?: string | null
  created_by?: string | null
  created_at: string
}

export interface StatusHistoryResponse {
  items: StatusHistoryItem[]
  total: number
}
