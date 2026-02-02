/**
 * Geographic Anomaly Detection Types
 * Types for gray market detection feature
 */

export interface AuthorizedRegion {
  id: string
  organization_id: string
  product_id: string | null
  region_code: string
  region_name: string
  is_exclusive: boolean
  center_lat: number | null
  center_lng: number | null
  radius_km: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AuthorizedRegionCreate {
  region_code: string
  region_name: string
  product_id?: string
  is_exclusive?: boolean
  center_lat?: number
  center_lng?: number
  radius_km?: number
  notes?: string
}

export interface AuthorizedRegionUpdate {
  region_name?: string
  is_exclusive?: boolean
  center_lat?: number
  center_lng?: number
  radius_km?: number
  notes?: string
}

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'
export type AnomalyStatus = 'new' | 'under_review' | 'confirmed' | 'false_positive' | 'resolved'
export type AnomalyType = 'region_mismatch' | 'country_mismatch' | 'suspicious_pattern' | 'velocity_anomaly'

export interface GeographicAnomaly {
  id: string
  organization_id: string
  product_id: string | null
  product_name: string | null
  product_sku: string | null
  qr_code_id: string | null
  scan_event_id: string | null
  expected_region: string
  actual_region: string
  actual_region_name: string | null
  scan_lat: number | null
  scan_lng: number | null
  distance_from_authorized_km: number | null
  severity: AnomalySeverity
  anomaly_type: AnomalyType
  status: AnomalyStatus
  investigated_at: string | null
  investigated_by: string | null
  investigation_notes: string | null
  resolution: string | null
  scan_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AnomalyStatusUpdate {
  status: AnomalyStatus
  investigation_notes?: string
  resolution?: string
}

export interface AnomalyStatistics {
  period_days: number
  total_anomalies: number
  by_status: {
    new: number
    under_review: number
    confirmed: number
    false_positive: number
    resolved: number
  }
  by_severity: {
    low: number
    medium: number
    high: number
    critical: number
  }
  top_anomaly_regions: Array<{
    region: string
    region_name: string
    count: number
  }>
}

export interface AnomalyTrendItem {
  date: string
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

export interface CheckLocationRequest {
  product_id?: string
  latitude: number
  longitude: number
}

export interface CheckLocationResponse {
  is_authorized: boolean
  nearest_region_code: string
  nearest_region_name: string
  distance_km: number
  severity: string
}

export interface AnomalyListResponse {
  anomalies: GeographicAnomaly[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}
