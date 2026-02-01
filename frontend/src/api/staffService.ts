/**
 * Staff Training API Service
 * Handles API calls for retail staff training and certification
 */
import { httpClient } from './httpClient'
import type {
  AssistedScanRequest,
  QuizResult,
  QuizSubmission,
  RetailStaff,
  StaffCertification,
  StaffLeaderboardResponse,
  StaffTrainingProgressResponse,
  TrainingModule,
  TrainingModulesResponse,
  TrainingProgress,
} from '@/types/retail'

// ============================================
// TRAINING MODULES
// ============================================

/**
 * List all available training modules
 */
export async function listTrainingModules(): Promise<TrainingModulesResponse> {
  const response = await httpClient.get<TrainingModulesResponse>('/api/staff/training/modules')
  return response.data
}

/**
 * Get a specific training module with content
 */
export async function getTrainingModule(moduleId: string): Promise<TrainingModule> {
  const response = await httpClient.get<TrainingModule>(`/api/staff/training/modules/${moduleId}`)
  return response.data
}

// ============================================
// TRAINING PROGRESS
// ============================================

/**
 * Get current user's training progress and certification status
 */
export async function getMyTrainingProgress(): Promise<StaffTrainingProgressResponse> {
  const response = await httpClient.get<StaffTrainingProgressResponse>('/api/staff/training/progress')
  return response.data
}

/**
 * Update progress on a training module
 */
export async function updateTrainingProgress(
  moduleId: string,
  data: {
    progress_percent: number
    status?: 'in_progress' | 'completed'
  }
): Promise<TrainingProgress> {
  const response = await httpClient.post<TrainingProgress>('/api/staff/training/progress', {
    module_id: moduleId,
    ...data,
  })
  return response.data
}

/**
 * Submit quiz answers
 */
export async function submitQuiz(submission: QuizSubmission): Promise<QuizResult> {
  const response = await httpClient.post<QuizResult>('/api/staff/training/quiz/submit', submission)
  return response.data
}

// ============================================
// CERTIFICATION
// ============================================

/**
 * Get current user's certification status
 */
export async function getMyCertification(): Promise<StaffCertification> {
  const response = await httpClient.get<StaffCertification>('/api/staff/certification')
  return response.data
}

/**
 * Get certification badge image URL
 */
export function getCertificationBadgeUrl(staffId: string): string {
  return `/api/staff/${staffId}/certification/badge`
}

// ============================================
// ASSISTED SCANS
// ============================================

/**
 * Log a staff-assisted scan
 */
export async function logAssistedScan(data: AssistedScanRequest): Promise<{ success: boolean }> {
  const response = await httpClient.post<{ success: boolean }>('/api/staff/assisted-scan', data)
  return response.data
}

// ============================================
// STAFF MANAGEMENT (STORE ADMIN)
// ============================================

/**
 * List staff members for a store
 */
export async function listStoreStaff(
  storeId: string,
  params?: {
    is_certified?: boolean
    limit?: number
    offset?: number
  }
): Promise<{ staff: RetailStaff[]; total: number }> {
  const response = await httpClient.get<{ staff: RetailStaff[]; total: number }>(
    `/api/retail/stores/${storeId}/staff`,
    { params }
  )
  return response.data
}

/**
 * Get staff member details
 */
export async function getStaffMember(storeId: string, staffId: string): Promise<RetailStaff> {
  const response = await httpClient.get<RetailStaff>(`/api/retail/stores/${storeId}/staff/${staffId}`)
  return response.data
}

/**
 * Add a staff member to a store
 */
export async function addStaffMember(
  storeId: string,
  data: {
    user_id: string
    employee_id?: string
    department?: string
    position?: string
  }
): Promise<RetailStaff> {
  const response = await httpClient.post<RetailStaff>(`/api/retail/stores/${storeId}/staff`, data)
  return response.data
}

/**
 * Update staff member details
 */
export async function updateStaffMember(
  storeId: string,
  staffId: string,
  data: {
    employee_id?: string
    department?: string
    position?: string
  }
): Promise<RetailStaff> {
  const response = await httpClient.put<RetailStaff>(
    `/api/retail/stores/${storeId}/staff/${staffId}`,
    data
  )
  return response.data
}

/**
 * Remove staff member from store
 */
export async function removeStaffMember(storeId: string, staffId: string): Promise<void> {
  await httpClient.delete(`/api/retail/stores/${storeId}/staff/${staffId}`)
}

// ============================================
// LEADERBOARD
// ============================================

/**
 * Get staff leaderboard for a store
 */
export async function getStoreStaffLeaderboard(
  storeId: string,
  period: 'all_time' | 'monthly' | 'weekly' = 'monthly',
  limit: number = 10
): Promise<StaffLeaderboardResponse> {
  const response = await httpClient.get<StaffLeaderboardResponse>(
    `/api/retail/stores/${storeId}/staff/leaderboard`,
    { params: { period, limit } }
  )
  return response.data
}

/**
 * Get global staff leaderboard (all stores)
 */
export async function getGlobalStaffLeaderboard(
  period: 'all_time' | 'monthly' | 'weekly' = 'monthly',
  limit: number = 20
): Promise<StaffLeaderboardResponse> {
  const response = await httpClient.get<StaffLeaderboardResponse>(
    '/api/staff/leaderboard',
    { params: { period, limit } }
  )
  return response.data
}
