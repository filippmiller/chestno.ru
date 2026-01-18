/**
 * Admin import types for managing bulk imports across organizations.
 */

export interface ImportJobAdmin {
  id: string
  organization_id: string
  organization_name: string | null
  created_by: string
  creator_email: string | null
  source_type: string
  original_filename: string | null
  status: ImportJobStatus
  total_rows: number
  processed_rows: number
  successful_rows: number
  failed_rows: number
  created_at: string
  updated_at: string
}

export type ImportJobStatus =
  | 'pending'
  | 'mapping'
  | 'validating'
  | 'preview'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ImportJobItemAdmin {
  id: string
  job_id: string
  row_number: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  raw_data: Record<string, unknown> | null
  mapped_data: Record<string, unknown> | null
  product_id: string | null
  error_message: string | null
  created_at: string
}

export interface ImportStatsResponse {
  total_jobs: number
  pending_jobs: number
  processing_jobs: number
  completed_jobs: number
  failed_jobs: number
  total_rows_imported: number
  total_rows_failed: number
  success_rate: number
  jobs_by_source: Array<{ source: string; count: number }>
  jobs_by_status: Array<{ status: string; count: number }>
  recent_activity: Array<{ date: string; jobs: number; rows: number }>
}

export interface AdminImportsListResponse {
  items: ImportJobAdmin[]
  total: number
  limit: number
  offset: number
}

export interface AdminImportDetailsResponse {
  job: ImportJobAdmin
  items: ImportJobItemAdmin[]
  items_total: number
  error_summary: Array<{ error: string; count: number }>
}

export interface OrganizationImportSummary {
  organization_id: string
  organization_name: string
  total_imports: number
  completed: number
  failed: number
  total_products_imported: number
  last_import_at: string | null
}

// Filter options for the admin imports list
export interface AdminImportsFilter {
  status?: ImportJobStatus
  source_type?: string
  organization_id?: string
  limit?: number
  offset?: number
}

// Source type display info
export const IMPORT_SOURCE_LABELS: Record<string, string> = {
  wildberries: 'Wildberries',
  ozon: 'Ozon',
  '1c': '1C',
  generic_csv: 'CSV',
  generic_xlsx: 'Excel',
}

// Status display info with colors
export const IMPORT_STATUS_CONFIG: Record<
  ImportJobStatus,
  { label: string; color: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Ожидает', color: 'secondary' },
  mapping: { label: 'Настройка', color: 'secondary' },
  validating: { label: 'Проверка', color: 'secondary' },
  preview: { label: 'Предпросмотр', color: 'secondary' },
  processing: { label: 'Выполняется', color: 'default' },
  completed: { label: 'Завершён', color: 'outline' },
  failed: { label: 'Ошибка', color: 'destructive' },
  cancelled: { label: 'Отменён', color: 'destructive' },
}
