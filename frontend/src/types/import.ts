// Import system types

export type ImportSourceType = 'wildberries' | 'ozon' | '1c' | 'generic_csv' | 'generic_xlsx'

export type ImportJobStatus =
  | 'pending'
  | 'mapping'
  | 'validating'
  | 'preview'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ImportItemStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'

export interface ImportJob {
  id: string
  organization_id: string
  created_by: string
  source_type: ImportSourceType
  source_filename?: string | null
  status: ImportJobStatus
  field_mapping: Record<string, string>
  total_rows: number
  processed_rows: number
  successful_rows: number
  failed_rows: number
  validation_errors: ValidationError[]
  error_message?: string | null
  skip_duplicates: boolean
  update_existing: boolean
  download_images: boolean
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface ImportJobSummary {
  id: string
  source_type: ImportSourceType
  source_filename?: string | null
  status: ImportJobStatus
  total_rows: number
  processed_rows: number
  successful_rows: number
  failed_rows: number
  created_at: string
}

export interface ValidationError {
  row_number: number
  field?: string | null
  message: string
  value?: unknown
}

export interface ImportPreviewRow {
  row_number: number
  raw_data: Record<string, unknown>
  mapped_data: Record<string, unknown>
  errors: string[]
  is_valid: boolean
}

export interface ImportPreviewResponse {
  job_id: string
  source_type: ImportSourceType
  total_rows: number
  rows: ImportPreviewRow[]
  columns: string[]
  suggested_mapping: Record<string, string>
  validation_summary: {
    valid: number
    invalid: number
    warnings: number
  }
}

export interface SourceColumnInfo {
  name: string
  sample_values: string[]
  data_type: string
  non_empty_count: number
}

export interface TargetField {
  name: string
  label: string
  required: boolean
}

export interface FieldMappingInfo {
  source_columns: SourceColumnInfo[]
  target_fields: TargetField[]
  suggested_mapping: Record<string, string>
  current_mapping: Record<string, string>
}

export interface ImportJobSettings {
  skip_duplicates: boolean
  update_existing: boolean
  download_images: boolean
}

export interface ImportProgressResponse {
  job_id: string
  status: ImportJobStatus
  total_rows: number
  processed_rows: number
  successful_rows: number
  failed_rows: number
  percentage: number
  current_operation?: string | null
  eta_seconds?: number | null
}

export interface ImportResultResponse {
  job_id: string
  status: ImportJobStatus
  total_rows: number
  successful_rows: number
  failed_rows: number
  skipped_rows: number
  created_products: string[]
  updated_products: string[]
  errors: ValidationError[]
  duration_seconds?: number | null
  images_queued: number
}

// Import source info for UI
export interface ImportSourceInfo {
  type: ImportSourceType
  name: string
  description: string
  acceptedFormats: string[]
  icon: string
}

export const IMPORT_SOURCES: ImportSourceInfo[] = [
  {
    type: 'wildberries',
    name: 'Wildberries',
    description: 'Импорт товаров из выгрузки Wildberries (XLSX)',
    acceptedFormats: ['.xlsx'],
    icon: 'wildberries',
  },
  {
    type: 'ozon',
    name: 'Ozon',
    description: 'Импорт товаров из выгрузки Ozon (XLS, XLSX, CSV)',
    acceptedFormats: ['.xls', '.xlsx', '.csv'],
    icon: 'ozon',
  },
  {
    type: '1c',
    name: '1С',
    description: 'Импорт из 1С:Предприятие (XML, CSV)',
    acceptedFormats: ['.xml', '.csv'],
    icon: '1c',
  },
  {
    type: 'generic_csv',
    name: 'CSV файл',
    description: 'Импорт из CSV файла любого формата',
    acceptedFormats: ['.csv'],
    icon: 'csv',
  },
  {
    type: 'generic_xlsx',
    name: 'Excel файл',
    description: 'Импорт из Excel файла (XLSX)',
    acceptedFormats: ['.xlsx', '.xls'],
    icon: 'excel',
  },
]

// Wizard step types
export type ImportWizardStep = 'source' | 'upload' | 'mapping' | 'preview' | 'processing' | 'result'

export interface WizardState {
  currentStep: ImportWizardStep
  selectedSource: ImportSourceType | null
  job: ImportJob | null
  mappingInfo: FieldMappingInfo | null
  preview: ImportPreviewResponse | null
  progress: ImportProgressResponse | null
  result: ImportResultResponse | null
}
