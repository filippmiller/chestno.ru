import type {
  AfterSignupPayload,
  AiIntegration,
  AiIntegrationPayload,
  LoginResponse,
  ModerationActionPayload,
  ModerationOrganization,
  OrganizationInvite,
  OrganizationInvitePayload,
  OrganizationInvitePreview,
  OrganizationProfile,
  OrganizationProfilePayload,
  PublicOrganizationProfile,
  QRCode,
  QRCodePayload,
  QRCodeStats,
  SessionPayload,
  DevTask,
  DevTaskPayload,
} from '@/types/auth'

import { httpClient } from './httpClient'

export const afterSignup = async (payload: AfterSignupPayload) => {
  const { data } = await httpClient.post<SessionPayload>('/api/auth/after-signup', payload)
  return data
}

export const fetchSession = async () => {
  const { data } = await httpClient.get<SessionPayload>('/api/auth/session')
  return data
}

export const login = async (email: string, password: string) => {
  const { data } = await httpClient.post<LoginResponse>('/api/auth/login', { email, password })
  return data
}

export const getOrganizationProfile = async (organizationId: string) => {
  const { data } = await httpClient.get<OrganizationProfile | null>(`/api/organizations/${organizationId}/profile`)
  return data
}

export const upsertOrganizationProfile = async (organizationId: string, payload: OrganizationProfilePayload) => {
  const { data } = await httpClient.put<OrganizationProfile>(`/api/organizations/${organizationId}/profile`, payload)
  return data
}

export const fetchPublicOrganization = async (slug: string) => {
  const { data } = await httpClient.get<PublicOrganizationProfile>(`/api/public/organizations/by-slug/${slug}`)
  return data
}

export const listOrganizationInvites = async (organizationId: string, status?: string) => {
  const params = status ? { status } : undefined
  const { data } = await httpClient.get<OrganizationInvite[]>(`/api/organizations/${organizationId}/invites`, { params })
  return data
}

export const createOrganizationInvite = async (organizationId: string, payload: OrganizationInvitePayload) => {
  const { data } = await httpClient.post<OrganizationInvite>(`/api/organizations/${organizationId}/invites`, payload)
  return data
}

export const previewInvite = async (code: string) => {
  const { data } = await httpClient.get<OrganizationInvitePreview>(`/api/invites/${code}`)
  return data
}

export const acceptInvite = async (code: string) => {
  const { data } = await httpClient.post<SessionPayload | OrganizationInvitePreview>(`/api/invites/${code}/accept`)
  return data
}

export const startYandexLogin = async (redirectTo?: string) => {
  const { data } = await httpClient.get<{ redirect_url: string }>('/api/auth/yandex/start', {
    params: { redirect_to: redirectTo },
  })
  return data.redirect_url
}

export const listModerationOrganizations = async (status: string = 'pending') => {
  const { data } = await httpClient.get<ModerationOrganization[]>('/api/moderation/organizations', {
    params: { status },
  })
  return data
}

export const verifyOrganizationStatus = async (organizationId: string, payload: ModerationActionPayload) => {
  const { data } = await httpClient.post<ModerationOrganization>(
    `/api/moderation/organizations/${organizationId}/verify`,
    payload,
  )
  return data
}

export const listQrCodes = async (organizationId: string) => {
  const { data } = await httpClient.get<QRCode[]>(`/api/organizations/${organizationId}/qr-codes`)
  return data
}

export const createQrCode = async (organizationId: string, payload: QRCodePayload) => {
  const { data } = await httpClient.post<QRCode>(`/api/organizations/${organizationId}/qr-codes`, payload)
  return data
}

export const getQrCodeStats = async (organizationId: string, qrCodeId: string) => {
  const { data } = await httpClient.get<QRCodeStats>(
    `/api/organizations/${organizationId}/qr-codes/${qrCodeId}/stats`,
  )
  return data
}

export const listAiIntegrations = async () => {
  const { data } = await httpClient.get<AiIntegration[]>('/api/admin/ai/integrations')
  return data
}

export const createAiIntegration = async (payload: AiIntegrationPayload) => {
  const { data } = await httpClient.post<AiIntegration>('/api/admin/ai/integrations', payload)
  return data
}

export const updateAiIntegration = async (id: string, payload: Partial<AiIntegrationPayload>) => {
  const { data } = await httpClient.patch<AiIntegration>(`/api/admin/ai/integrations/${id}`, payload)
  return data
}

export const runAiIntegrationCheck = async (id: string) => {
  const { data } = await httpClient.post<AiIntegration>(`/api/admin/ai/integrations/${id}/check`)
  return data
}

export const listDevTasks = async (params: Record<string, string | number | undefined> = {}) => {
  const { data } = await httpClient.get<DevTask[]>('/api/admin/dev-tasks', { params })
  return data
}

export const createDevTask = async (payload: DevTaskPayload) => {
  const { data } = await httpClient.post<DevTask>('/api/admin/dev-tasks', payload)
  return data
}

export const updateDevTask = async (taskId: string, payload: Partial<DevTaskPayload>) => {
  const { data } = await httpClient.patch<DevTask>(`/api/admin/dev-tasks/${taskId}`, payload)
  return data
}

export const deleteDevTask = async (taskId: string) => {
  const { data } = await httpClient.delete<DevTask>(`/api/admin/dev-tasks/${taskId}`)
  return data
}
