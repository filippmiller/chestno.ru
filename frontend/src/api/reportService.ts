/**
 * Report Service
 * API calls for community content reports.
 */
import { httpClient } from './httpClient'
import type {
  ContentReport,
  ContentReportCreate,
  ContentReportsResponse,
  ModerationAppeal,
  ModerationAppealCreate,
  ModerationAppealsResponse,
} from '@/types/moderation'

const API_BASE = '/api/moderation/v2'

// =============================================================================
// COMMUNITY REPORTS
// =============================================================================

/**
 * Submit a content report.
 * Any authenticated user can submit reports.
 */
export async function createReport(report: ContentReportCreate): Promise<ContentReport> {
  const response = await httpClient.post<ContentReport>(`${API_BASE}/reports`, report)
  return response.data
}

/**
 * Get user's own reports.
 */
export async function getMyReports(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<ContentReportsResponse> {
  const response = await httpClient.get<ContentReportsResponse>(`${API_BASE}/reports/me`, {
    params,
  })
  return response.data
}

/**
 * List all reports (moderator only).
 */
export async function listReports(params?: {
  status?: string
  content_type?: string
  reason?: string
  limit?: number
  offset?: number
}): Promise<ContentReportsResponse> {
  const response = await httpClient.get<ContentReportsResponse>(`${API_BASE}/reports`, {
    params,
  })
  return response.data
}

/**
 * Update report status (moderator only).
 */
export async function updateReportStatus(
  reportId: string,
  status: 'reviewing' | 'valid' | 'invalid' | 'duplicate',
  notes?: string
): Promise<ContentReport> {
  const response = await httpClient.patch<ContentReport>(`${API_BASE}/reports/${reportId}`, {
    status,
    review_notes: notes,
  })
  return response.data
}

// =============================================================================
// APPEALS
// =============================================================================

/**
 * Submit an appeal (producer only).
 */
export async function createAppeal(appeal: ModerationAppealCreate): Promise<ModerationAppeal> {
  const response = await httpClient.post<ModerationAppeal>(`${API_BASE}/appeals`, appeal)
  return response.data
}

/**
 * Get user's own appeals.
 */
export async function getMyAppeals(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<ModerationAppealsResponse> {
  const response = await httpClient.get<ModerationAppealsResponse>(`${API_BASE}/appeals/me`, {
    params,
  })
  return response.data
}

/**
 * List all appeals (moderator only).
 */
export async function listAppeals(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<ModerationAppealsResponse> {
  const response = await httpClient.get<ModerationAppealsResponse>(`${API_BASE}/appeals`, {
    params,
  })
  return response.data
}

/**
 * Decide on an appeal (senior moderator only).
 */
export async function decideAppeal(
  appealId: string,
  decision: 'upheld' | 'overturned' | 'partially_overturned',
  notes: string
): Promise<ModerationAppeal> {
  const response = await httpClient.post<ModerationAppeal>(`${API_BASE}/appeals/${appealId}/decide`, {
    decision,
    review_notes: notes,
  })
  return response.data
}
