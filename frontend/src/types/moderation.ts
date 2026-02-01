/**
 * Content Moderation Types
 * Types for moderation queue, reports, appeals, and tools.
 */

// =============================================================================
// QUEUE TYPES
// =============================================================================

export type ContentType = 
  | 'organization' 
  | 'product' 
  | 'review' 
  | 'post' 
  | 'media' 
  | 'document' 
  | 'certification';

export type QueueStatus = 
  | 'pending' 
  | 'in_review' 
  | 'approved' 
  | 'rejected' 
  | 'escalated' 
  | 'appealed' 
  | 'resolved';

export type QueueSource = 
  | 'auto_flag' 
  | 'user_report' 
  | 'new_content' 
  | 'edit' 
  | 'appeal';

export type ResolutionAction = 
  | 'approved' 
  | 'rejected' 
  | 'modified' 
  | 'deleted' 
  | 'no_action';

export interface AIFlag {
  pattern_id: string;
  pattern_name: string;
  detects: string;
  action: string;
}

export interface ModerationQueueItem {
  id: string;
  content_type: ContentType;
  content_id: string;
  content_snapshot?: Record<string, unknown>;
  priority_score: number;
  priority_reason: string[];
  status: QueueStatus;
  source: QueueSource;
  ai_flags: { flags?: AIFlag[] };
  ai_confidence_score?: number;
  ai_recommended_action?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_at?: string;
  escalation_level: number;
  escalated_by?: string;
  escalated_at?: string;
  escalation_reason?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_action?: ResolutionAction;
  resolution_notes?: string;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface ModerationQueueFilters {
  status?: QueueStatus;
  content_type?: ContentType;
  source?: QueueSource;
  assigned_to?: string;
  min_priority?: number;
  escalation_level?: number;
  order_by?: 'priority' | 'created_at' | 'updated_at';
  limit?: number;
  offset?: number;
}

export interface ModerationQueueResponse {
  items: ModerationQueueItem[];
  total: number;
}

export interface ModerationStats {
  pending_count: number;
  in_review_count: number;
  escalated_count: number;
  appealed_count: number;
  resolved_today: number;
  avg_resolution_hours: number;
  pending_by_type: Record<ContentType, number>;
}


// =============================================================================
// DECISION TYPES
// =============================================================================

export type DecisionAction = 
  | 'approve' 
  | 'reject' 
  | 'escalate' 
  | 'request_changes' 
  | 'delete';

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ModerationDecision {
  action: DecisionAction;
  reason?: string;
  notes?: string;
  violation_type?: string;
  guideline_code?: string;
  severity?: ViolationSeverity;
}


// =============================================================================
// REPORT TYPES
// =============================================================================

export type ReportReason =
  | 'fake_business'
  | 'misleading_claims'
  | 'counterfeit_cert'
  | 'offensive_content'
  | 'spam'
  | 'competitor_sabotage'
  | 'copyright'
  | 'privacy_violation'
  | 'other';

export type ReportStatus = 'new' | 'reviewing' | 'valid' | 'invalid' | 'duplicate';

export interface ContentReportCreate {
  content_type: ContentType | 'user';
  content_id: string;
  reason: ReportReason;
  reason_details?: string;
  evidence_urls?: string[];
}

export interface ContentReport {
  id: string;
  content_type: string;
  content_id: string;
  reporter_user_id?: string;
  reason: ReportReason;
  reason_details?: string;
  evidence_urls: string[];
  status: ReportStatus;
  linked_queue_item?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
}

export interface ContentReportsResponse {
  items: ContentReport[];
  total: number;
}


// =============================================================================
// APPEAL TYPES
// =============================================================================

export type AppealStatus = 
  | 'pending' 
  | 'under_review' 
  | 'upheld' 
  | 'overturned' 
  | 'partially_overturned';

export interface ModerationAppealCreate {
  content_type: ContentType;
  content_id: string;
  organization_id?: string;
  appeal_reason: string;
  supporting_evidence?: string[];
  additional_context?: string;
}

export interface ModerationAppeal {
  id: string;
  content_type: ContentType;
  content_id: string;
  appellant_user_id: string;
  organization_id?: string;
  original_queue_item_id?: string;
  appeal_reason: string;
  supporting_evidence: string[];
  additional_context?: string;
  status: AppealStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_decision?: string;
  review_notes?: string;
  new_queue_item_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface ModerationAppealsResponse {
  items: ModerationAppeal[];
  total: number;
}


// =============================================================================
// NOTES & HISTORY
// =============================================================================

export type NoteType = 'observation' | 'warning' | 'context' | 'follow_up' | 'evidence';

export interface ModeratorNoteCreate {
  subject_type: string;
  subject_id: string;
  note_type?: NoteType;
  content: string;
  attachments?: Record<string, unknown>;
}

export interface ModeratorNote {
  id: string;
  subject_type: string;
  subject_id: string;
  note_type: NoteType;
  content: string;
  attachments?: Record<string, unknown>;
  created_by: string;
  author_name?: string;
  created_at: string;
}

export type ViolationConsequence =
  | 'warning'
  | 'content_removed'
  | 'temporary_restriction'
  | 'permanent_restriction'
  | 'account_suspended'
  | 'account_banned';

export interface ViolationRecord {
  id: string;
  violator_type: 'user' | 'organization';
  violator_id: string;
  violation_type: string;
  guideline_code?: string;
  guideline_title?: string;
  severity: ViolationSeverity;
  content_type?: ContentType;
  content_id?: string;
  queue_item_id?: string;
  consequence?: ViolationConsequence;
  notes?: string;
  created_at: string;
}


// =============================================================================
// GUIDELINES
// =============================================================================

export type GuidelineCategory = 
  | 'authenticity' 
  | 'accuracy' 
  | 'quality' 
  | 'safety' 
  | 'legal' 
  | 'community';

export interface ModerationGuideline {
  id: string;
  code: string;
  category: GuidelineCategory;
  title_ru: string;
  title_en?: string;
  description_ru: string;
  description_en?: string;
  examples?: {
    good?: string[];
    bad?: string[];
  };
  applies_to: ContentType[];
  severity: ViolationSeverity;
  auto_flag: boolean;
  auto_reject: boolean;
  is_active: boolean;
}


// =============================================================================
// UI HELPERS
// =============================================================================

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fake_business: 'Поддельный бизнес',
  misleading_claims: 'Вводящие в заблуждение заявления',
  counterfeit_cert: 'Поддельные сертификаты',
  offensive_content: 'Оскорбительный контент',
  spam: 'Спам',
  competitor_sabotage: 'Саботаж конкурента',
  copyright: 'Нарушение авторских прав',
  privacy_violation: 'Нарушение конфиденциальности',
  other: 'Другое',
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  organization: 'Организация',
  product: 'Продукт',
  review: 'Отзыв',
  post: 'Публикация',
  media: 'Медиа',
  document: 'Документ',
  certification: 'Сертификат',
};

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  pending: 'Ожидает',
  in_review: 'На рассмотрении',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  escalated: 'Эскалировано',
  appealed: 'Обжаловано',
  resolved: 'Решено',
};

export const SEVERITY_COLORS: Record<ViolationSeverity, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export const PRIORITY_COLORS = {
  high: 'bg-red-500',    // 80-100
  medium: 'bg-yellow-500', // 50-79
  low: 'bg-green-500',   // 0-49
};

export function getPriorityColor(score: number): string {
  if (score >= 80) return PRIORITY_COLORS.high;
  if (score >= 50) return PRIORITY_COLORS.medium;
  return PRIORITY_COLORS.low;
}

export function getPriorityLabel(score: number): string {
  if (score >= 80) return 'Высокий';
  if (score >= 50) return 'Средний';
  return 'Низкий';
}
