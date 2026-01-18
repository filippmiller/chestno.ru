import axios from 'axios'
import type {
  ImportJob,
  ImportJobSummary,
  ImportJobSettings,
  FieldMappingInfo,
  ImportPreviewResponse,
  ImportProgressResponse,
  ImportSourceType,
} from '@/types/import'

const API_BASE = '/api'

// Upload file and create import job
export async function uploadImportFile(
  organizationId: string,
  file: File,
  sourceType: ImportSourceType
): Promise<ImportJob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('source_type', sourceType)

  const response = await axios.post<ImportJob>(
    `${API_BASE}/organizations/${organizationId}/imports/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}

// List import jobs for organization
export async function listImportJobs(
  organizationId: string,
  limit = 20,
  offset = 0
): Promise<ImportJobSummary[]> {
  const response = await axios.get<ImportJobSummary[]>(
    `${API_BASE}/organizations/${organizationId}/imports`,
    { params: { limit, offset } }
  )
  return response.data
}

// Get import job details
export async function getImportJob(
  organizationId: string,
  jobId: string
): Promise<ImportJob> {
  const response = await axios.get<ImportJob>(
    `${API_BASE}/organizations/${organizationId}/imports/${jobId}`
  )
  return response.data
}

// Get field mapping information
export async function getFieldMappingInfo(
  organizationId: string,
  jobId: string
): Promise<FieldMappingInfo> {
  const response = await axios.get<FieldMappingInfo>(
    `${API_BASE}/organizations/${organizationId}/imports/${jobId}/mapping`
  )
  return response.data
}

// Save field mapping
export async function saveFieldMapping(
  organizationId: string,
  jobId: string,
  mapping: Record<string, string>
): Promise<ImportJob> {
  const response = await axios.post<ImportJob>(
    `${API_BASE}/organizations/${organizationId}/imports/${jobId}/mapping`,
    { mapping }
  )
  return response.data
}

// Run validation
export async function validateImport(
  organizationId: string,
  jobId: string
): Promise<ImportJob> {
  const response = await axios.post<ImportJob>(
    `${API_BASE}/organizations/${organizationId}/imports/${jobId}/validate`
  )
  return response.data
}

// Get import preview
export async function getImportPreview(
  organizationId: string,
  jobId: string,
  limit = 20,
  offset = 0
): Promise<ImportPreviewResponse> {
  const response = await axios.get<ImportPreviewResponse>(
    `${API_BASE}/organizations/${organizationId}/imports/${jobId}/preview`,
    { params: { limit, offset } }
  )
  return response.data
}

// Execute import
export async function executeImport(
  organizationId: string,
  jobId: string,
  settings?: ImportJobSettings
): Promise<ImportProgressResponse> {
  const response = await axios.post<ImportProgressResponse>(
    `${API_BASE}/organizations/${organizationId}/imports/${jobId}/execute`,
    settings || {}
  )
  return response.data
}

// Cancel import
export async function cancelImport(
  organizationId: string,
  jobId: string
): Promise<ImportJob> {
  const response = await axios.post<ImportJob>(
    `${API_BASE}/organizations/${organizationId}/imports/${jobId}/cancel`
  )
  return response.data
}

// Poll import progress
export async function pollImportProgress(
  organizationId: string,
  jobId: string,
  onProgress: (progress: ImportJob) => void,
  intervalMs = 2000
): Promise<ImportJob> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const job = await getImportJob(organizationId, jobId)
        onProgress(job)

        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          resolve(job)
        } else {
          setTimeout(poll, intervalMs)
        }
      } catch (error) {
        reject(error)
      }
    }

    poll()
  })
}

// Variant-related API calls

export interface ProductVariant {
  id: string
  name: string
  slug: string
  sku?: string | null
  barcode?: string | null
  price_cents?: number | null
  stock_quantity: number
  is_variant: boolean
  parent_product_id?: string | null
}

export interface VariantAttribute {
  id?: string | null
  attribute_name: string
  attribute_value: string
  display_order: number
}

export interface ProductVariantCreate {
  name: string
  slug?: string | null
  sku?: string | null
  barcode?: string | null
  price_cents?: number | null
  stock_quantity?: number
  attributes: Omit<VariantAttribute, 'id'>[]
}

export interface ProductWithVariants {
  id: string
  name: string
  slug: string
  organization_id: string
  variants: ProductVariant[]
  attributes: VariantAttribute[]
  variant_count: number
}

export interface AttributeTemplate {
  id: string
  organization_id: string
  attribute_name: string
  possible_values: string[]
  is_required: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface AttributeTemplateCreate {
  attribute_name: string
  possible_values?: string[]
  is_required?: boolean
  display_order?: number
}

// Get product with variants
export async function getProductWithVariants(
  organizationId: string,
  productId: string
): Promise<ProductWithVariants> {
  const response = await axios.get<ProductWithVariants>(
    `${API_BASE}/organizations/${organizationId}/products/${productId}/with-variants`
  )
  return response.data
}

// List variants
export async function listVariants(
  organizationId: string,
  productId: string
): Promise<ProductVariant[]> {
  const response = await axios.get<ProductVariant[]>(
    `${API_BASE}/organizations/${organizationId}/products/${productId}/variants`
  )
  return response.data
}

// Create variant
export async function createVariant(
  organizationId: string,
  productId: string,
  payload: ProductVariantCreate
): Promise<ProductVariant> {
  const response = await axios.post<ProductVariant>(
    `${API_BASE}/organizations/${organizationId}/products/${productId}/variants`,
    payload
  )
  return response.data
}

// Create bulk variants
export async function createBulkVariants(
  organizationId: string,
  productId: string,
  attributeCombinations: Omit<VariantAttribute, 'id'>[][],
  basePriceCents?: number,
  baseStockQuantity?: number
): Promise<ProductVariant[]> {
  const response = await axios.post<ProductVariant[]>(
    `${API_BASE}/organizations/${organizationId}/products/${productId}/variants/bulk`,
    {
      attribute_combinations: attributeCombinations,
      base_price_cents: basePriceCents,
      base_stock_quantity: baseStockQuantity,
    }
  )
  return response.data
}

// Delete variant
export async function deleteVariant(
  organizationId: string,
  variantId: string
): Promise<void> {
  await axios.delete(
    `${API_BASE}/organizations/${organizationId}/variants/${variantId}`
  )
}

// List attribute templates
export async function listAttributeTemplates(
  organizationId: string
): Promise<AttributeTemplate[]> {
  const response = await axios.get<AttributeTemplate[]>(
    `${API_BASE}/organizations/${organizationId}/attribute-templates`
  )
  return response.data
}

// Create attribute template
export async function createAttributeTemplate(
  organizationId: string,
  payload: AttributeTemplateCreate
): Promise<AttributeTemplate> {
  const response = await axios.post<AttributeTemplate>(
    `${API_BASE}/organizations/${organizationId}/attribute-templates`,
    payload
  )
  return response.data
}

// Delete attribute template
export async function deleteAttributeTemplate(
  organizationId: string,
  templateId: string
): Promise<void> {
  await axios.delete(
    `${API_BASE}/organizations/${organizationId}/attribute-templates/${templateId}`
  )
}
