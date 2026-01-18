import { httpClient } from './httpClient'
import type {
  MarketingMaterial,
  MarketingMaterialCreate,
  MarketingMaterialsResponse,
  MarketingMaterialUpdate,
  MarketingTemplate,
  MarketingTemplatesResponse,
} from '@/types/marketing'

// ============================================
// Templates (public)
// ============================================

export async function listMarketingTemplates(): Promise<MarketingTemplatesResponse> {
  const response = await httpClient.get<MarketingTemplatesResponse>('/api/marketing/templates')
  return response.data
}

export async function getMarketingTemplate(templateId: string): Promise<MarketingTemplate> {
  const response = await httpClient.get<MarketingTemplate>(`/api/marketing/templates/${templateId}`)
  return response.data
}

// ============================================
// Materials (organization-scoped)
// ============================================

export async function listMarketingMaterials(organizationId: string): Promise<MarketingMaterialsResponse> {
  const response = await httpClient.get<MarketingMaterialsResponse>(
    `/api/organizations/${organizationId}/marketing/materials`,
  )
  return response.data
}

export async function getMarketingMaterial(organizationId: string, materialId: string): Promise<MarketingMaterial> {
  const response = await httpClient.get<MarketingMaterial>(
    `/api/organizations/${organizationId}/marketing/materials/${materialId}`,
  )
  return response.data
}

export async function createMarketingMaterial(
  organizationId: string,
  payload: MarketingMaterialCreate,
): Promise<MarketingMaterial> {
  const response = await httpClient.post<MarketingMaterial>(
    `/api/organizations/${organizationId}/marketing/materials`,
    payload,
  )
  return response.data
}

export async function updateMarketingMaterial(
  organizationId: string,
  materialId: string,
  payload: MarketingMaterialUpdate,
): Promise<MarketingMaterial> {
  const response = await httpClient.patch<MarketingMaterial>(
    `/api/organizations/${organizationId}/marketing/materials/${materialId}`,
    payload,
  )
  return response.data
}

export async function deleteMarketingMaterial(organizationId: string, materialId: string): Promise<void> {
  await httpClient.delete(`/api/organizations/${organizationId}/marketing/materials/${materialId}`)
}
