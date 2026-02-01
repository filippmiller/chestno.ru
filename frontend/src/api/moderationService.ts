/**
 * Moderation Service
 * API calls for content moderation queue operations.
 */
import { httpClient } from './httpClient'
import type {
  ModerationQueueItem,
  ModerationQueueResponse,
  ModerationQueueFilters,
  ModerationStats,
  ModerationDecision,
  ModeratorNote,
  ModeratorNoteCreate,
  ViolationRecord,
  ModerationGuideline,
} from '@/types/moderation'

const API_BASE = '/api/moderation/v2'

// =============================================================================
// QUEUE OPERATIONS
// =============================================================================

/**
 * Get moderation queue statistics.
 */
export async function getModerationStats(): Promise<ModerationStats> {
  const response = await httpClient.get<ModerationStats>(`${API_BASE}/queue/stats`)
  return response.data
}

/**
 * List moderation queue items with optional filters.
 */
export async function listModerationQueue(
  filters?: ModerationQueueFilters
): Promise<ModerationQueueResponse> {
  const response = await httpClient.get<ModerationQueueResponse>(`${API_BASE}/queue`, {
    params: filters,
  })
  return response.data
}

/**
 * Get a single queue item by ID.
 */
export async function getModerationQueueItem(itemId: string): Promise<ModerationQueueItem> {
  const response = await httpClient.get<ModerationQueueItem>(`${API_BASE}/queue/${itemId}`)
  return response.data
}

/**
 * Assign a queue item to the current moderator.
 */
export async function assignQueueItem(itemId: string): Promise<ModerationQueueItem> {
  const response = await httpClient.post<ModerationQueueItem>(`${API_BASE}/queue/${itemId}/assign`)
  return response.data
}

/**
 * Make a decision on a queue item (approve, reject, escalate).
 */
export async function decideQueueItem(
  itemId: string,
  decision: ModerationDecision
): Promise<ModerationQueueItem> {
  const response = await httpClient.post<ModerationQueueItem>(
    `${API_BASE}/queue/${itemId}/decide`,
    decision
  )
  return response.data
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Batch approve multiple queue items.
 */
export async function batchApprove(
  itemIds: string[],
  notes?: string
): Promise<{ processed: number; failed: number }> {
  const response = await httpClient.post<{ processed: number; failed: number }>(
    `${API_BASE}/queue/batch/approve`,
    { item_ids: itemIds, notes }
  )
  return response.data
}

/**
 * Batch reject multiple queue items.
 */
export async function batchReject(
  itemIds: string[],
  violationType: string,
  notes?: string
): Promise<{ processed: number; failed: number }> {
  const response = await httpClient.post<{ processed: number; failed: number }>(
    `${API_BASE}/queue/batch/reject`,
    { item_ids: itemIds, violation_type: violationType, notes }
  )
  return response.data
}

// =============================================================================
// MODERATOR NOTES
// =============================================================================

/**
 * Get moderator notes for a subject.
 */
export async function getModeratorNotes(
  subjectType: string,
  subjectId: string
): Promise<ModeratorNote[]> {
  const response = await httpClient.get<ModeratorNote[]>(
    `${API_BASE}/notes/${subjectType}/${subjectId}`
  )
  return response.data
}

/**
 * Add a moderator note.
 */
export async function addModeratorNote(note: ModeratorNoteCreate): Promise<ModeratorNote> {
  const response = await httpClient.post<ModeratorNote>(`${API_BASE}/notes`, note)
  return response.data
}

// =============================================================================
// VIOLATION HISTORY
// =============================================================================

/**
 * Get violation history for a subject.
 */
export async function getViolationHistory(
  subjectType: string,
  subjectId: string
): Promise<ViolationRecord[]> {
  const response = await httpClient.get<ViolationRecord[]>(
    `${API_BASE}/violations/${subjectType}/${subjectId}`
  )
  return response.data
}

// =============================================================================
// GUIDELINES
// =============================================================================

/**
 * List all moderation guidelines.
 */
export async function listModerationGuidelines(): Promise<ModerationGuideline[]> {
  const response = await httpClient.get<ModerationGuideline[]>(`${API_BASE}/guidelines`)
  return response.data
}

// =============================================================================
// AI PATTERNS
// =============================================================================

export interface AIPattern {
  id: string
  pattern_type: 'text_keywords' | 'text_regex' | 'behavioral' | 'image_hash' | 'document_fingerprint'
  name: string
  description?: string
  pattern_config: Record<string, unknown>
  detects: string
  action: 'flag' | 'auto_reject' | 'shadow_ban'
  priority_boost: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AIPatternCreate {
  pattern_type: AIPattern['pattern_type']
  name: string
  description?: string
  pattern_config: Record<string, unknown>
  detects: string
  action: AIPattern['action']
  priority_boost?: number
  is_active?: boolean
}

export interface AIPatternUpdate {
  name?: string
  description?: string
  pattern_config?: Record<string, unknown>
  detects?: string
  action?: AIPattern['action']
  priority_boost?: number
  is_active?: boolean
}

/**
 * List all AI moderation patterns.
 */
export async function listAIPatterns(): Promise<AIPattern[]> {
  const response = await httpClient.get<AIPattern[]>(`${API_BASE}/patterns`)
  return response.data
}

/**
 * Create a new AI pattern.
 */
export async function createAIPattern(pattern: AIPatternCreate): Promise<AIPattern> {
  const response = await httpClient.post<AIPattern>(`${API_BASE}/patterns`, pattern)
  return response.data
}

/**
 * Update an existing AI pattern.
 */
export async function updateAIPattern(patternId: string, updates: AIPatternUpdate): Promise<AIPattern> {
  const response = await httpClient.patch<AIPattern>(`${API_BASE}/patterns/${patternId}`, updates)
  return response.data
}

/**
 * Delete an AI pattern.
 */
export async function deleteAIPattern(patternId: string): Promise<void> {
  await httpClient.delete(`${API_BASE}/patterns/${patternId}`)
}

/**
 * Toggle AI pattern active status.
 */
export async function toggleAIPatternStatus(patternId: string, isActive: boolean): Promise<AIPattern> {
  const response = await httpClient.patch<AIPattern>(`${API_BASE}/patterns/${patternId}`, {
    is_active: isActive,
  })
  return response.data
}
