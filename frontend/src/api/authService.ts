import axios from 'axios'

import type {
  AfterSignupPayload,
  AiIntegration,
  AiIntegrationPayload,
  DbColumnInfo,
  DbRowsResponse,
  DbTableInfo,
  DevTask,
  DevTaskPayload,
  LoginResponse,
  MigrationDraftPayload,
  ModerationActionPayload,
  ModerationOrganization,
  NotificationListResponse,
  NotificationSetting,
  NotificationSettingUpdate,
  OrganizationInvite,
  OrganizationInvitePayload,
  OrganizationInvitePreview,
  OrganizationProfile,
  OrganizationProfilePayload,
  OnboardingSummary,
  OrganizationSubscription,
  OrganizationSubscriptionSummary,
  Product,
  ProductPayload,
  PublicOrganizationProfile,
  PublicOrganizationDetails,
  PublicOrganizationsResponse,
  PublicProduct,
  QRCode,
  QRCodePayload,
  QRCodeStats,
  QROverviewResponse,
  SessionPayload,
  SubscriptionPlan,
  AdminDashboardSummary,
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
  console.log('[authService.login] Starting login request')
  console.log('[authService.login] baseURL =', httpClient.defaults.baseURL || '(empty - same origin)')
  console.log('[authService.login] URL = /api/auth/login')
  console.log('[authService.login] Full URL will be:', httpClient.defaults.baseURL ? `${httpClient.defaults.baseURL}/api/auth/login` : '/api/auth/login')
  console.log('[authService.login] Email:', email)
  
  try {
    const loginUrl = '/api/auth/login'
    const loginPayload = { email, password }
    
    console.log('[authService.login] Calling httpClient.post...')
    console.log('[authService.login] URL:', loginUrl)
    console.log('[authService.login] baseURL:', httpClient.defaults.baseURL || '(empty)')
    console.log('[authService.login] Full URL will be:', 
      httpClient.defaults.baseURL 
        ? `${httpClient.defaults.baseURL}${loginUrl}`
        : typeof window !== 'undefined'
          ? `${window.location.origin}${loginUrl}`
          : loginUrl
    )
    console.log('[authService.login] Payload:', { email, passwordLength: password.length })
    
    const requestPromise = httpClient.post<LoginResponse>(loginUrl, loginPayload)
    console.log('[authService.login] Request promise created, awaiting response...')
    
    const { data } = await requestPromise
    console.log('[authService.login] Response received successfully')
    console.log('[authService.login] Response data keys:', Object.keys(data))
    return data
  } catch (error) {
    console.error('[authService.login] HTTP error occurred')
    console.error('[authService.login] Error type:', error?.constructor?.name)
    console.error('[authService.login] Error message:', error instanceof Error ? error.message : String(error))
    
    if (axios.isAxiosError(error)) {
      console.error('[authService.login] Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
        headers: error.config?.headers,
        request: error.request ? 'Request object exists' : 'No request object',
      })
      
      if (error.request && !error.response) {
        console.error('[authService.login] Request was made but no response received!')
        console.error('[authService.login] This usually means: network error, CORS issue, or server not reachable')
      }
    } else {
      console.error('[authService.login] Non-Axios error:', error)
    }
    throw error
  }
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

export const fetchPublicOrganizationDetails = async (slug: string) => {
  const { data } = await httpClient.get<PublicOrganizationDetails>(`/api/public/organizations/details/${slug}`)
  return data
}

export const fetchPublicOrganizationDetailsById = async (organizationId: string) => {
  const { data } = await httpClient.get<PublicOrganizationDetails>(`/api/public/organizations/${organizationId}`)
  return data
}

export const searchPublicOrganizations = async (params: {
  q?: string
  country?: string
  category?: string
  verified_only?: boolean
  limit?: number
  offset?: number
}) => {
  const { data } = await httpClient.get<PublicOrganizationsResponse>('/api/public/organizations/search', {
    params,
  })
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

export const listDbTables = async () => {
  const { data } = await httpClient.get<DbTableInfo[]>('/api/admin/db/tables')
  return data
}

export const getDbTableColumns = async (tableName: string) => {
  const { data } = await httpClient.get<DbColumnInfo[]>(`/api/admin/db/tables/${tableName}/columns`)
  return data
}

export const getDbTableRows = async (
  tableName: string,
  params: { limit?: number; offset?: number; search?: string; order_by?: string } = {},
) => {
  const { data } = await httpClient.get<DbRowsResponse>(`/api/admin/db/tables/${tableName}/rows`, { params })
  return data
}

export const createMigrationDraft = async (payload: MigrationDraftPayload) => {
  const { data } = await httpClient.post('/api/admin/db/migration-draft', payload)
  return data
}

export const listNotifications = async (params: { limit?: number; cursor?: string; status?: 'unread' | 'all' } = {}) => {
  const query = {
    limit: params.limit ?? 20,
    cursor: params.cursor,
    status: params.status,
  }
  const { data } = await httpClient.get<NotificationListResponse>('/api/notifications', { params: query })
  return data
}

export const getUnreadNotificationsCount = async () => {
  const { data } = await httpClient.get<{ count: number }>('/api/notifications/unread-count')
  return data.count
}

export const markNotificationRead = async (deliveryId: string) => {
  await httpClient.post(`/api/notifications/${deliveryId}/read`)
}

export const dismissNotification = async (deliveryId: string) => {
  await httpClient.post(`/api/notifications/${deliveryId}/dismiss`)
}

export const getNotificationSettings = async () => {
  const { data } = await httpClient.get<NotificationSetting[]>('/api/notification-settings')
  return data
}

export const updateNotificationSettings = async (payload: NotificationSettingUpdate[]) => {
  const { data } = await httpClient.patch<NotificationSetting[]>('/api/notification-settings', payload)
  return data
}

export const listProducts = async (
  organizationId: string,
  params: { status?: string; limit?: number; offset?: number } = {},
) => {
  const { data } = await httpClient.get<Product[]>(`/api/organizations/${organizationId}/products`, { params })
  return data
}

export const createProduct = async (organizationId: string, payload: ProductPayload) => {
  const { data } = await httpClient.post<Product>(`/api/organizations/${organizationId}/products`, payload)
  return data
}

export const updateProduct = async (organizationId: string, productId: string, payload: Partial<ProductPayload>) => {
  const { data } = await httpClient.put<Product>(`/api/organizations/${organizationId}/products/${productId}`, payload)
  return data
}

export const archiveProduct = async (organizationId: string, productId: string) => {
  const { data } = await httpClient.post<Product>(`/api/organizations/${organizationId}/products/${productId}/archive`)
  return data
}

export const fetchPublicOrganizationProducts = async (slug: string) => {
  const { data } = await httpClient.get<PublicProduct[]>(`/api/public/organizations/${slug}/products`)
  return data
}

export const fetchPublicProduct = async (slug: string) => {
  const { data } = await httpClient.get<PublicProduct>(`/api/public/products/${slug}`)
  return data
}

export const getOrganizationSubscription = async (organizationId: string) => {
  const { data } = await httpClient.get<OrganizationSubscriptionSummary>(`/api/organizations/${organizationId}/subscription`)
  return data
}

export const listSubscriptionPlans = async (includeInactive = false) => {
  const { data } = await httpClient.get<SubscriptionPlan[]>('/api/admin/subscriptions/plans', {
    params: { include_inactive: includeInactive },
  })
  return data
}

export const createSubscriptionPlan = async (payload: SubscriptionPlan) => {
  const { data } = await httpClient.post<SubscriptionPlan>('/api/admin/subscriptions/plans', payload)
  return data
}

export const updateSubscriptionPlan = async (planId: string, payload: Partial<SubscriptionPlan>) => {
  const { data } = await httpClient.patch<SubscriptionPlan>(`/api/admin/subscriptions/plans/${planId}`, payload)
  return data
}

export const setOrganizationSubscription = async (organizationId: string, planId: string) => {
  const { data } = await httpClient.post<OrganizationSubscription>(
    `/api/admin/subscriptions/organizations/${organizationId}/subscription`,
    undefined,
    { params: { plan_id: planId } },
  )
  return data
}

export const getOnboardingSummary = async (organizationId: string) => {
  const { data } = await httpClient.get<OnboardingSummary>(`/api/organizations/${organizationId}/onboarding`)
  return data
}

export const getQrOverview = async (organizationId: string, days = 30) => {
  const { data } = await httpClient.get<QROverviewResponse>(
    `/api/analytics/organizations/${organizationId}/qr-overview`,
    { params: { days } },
  )
  return data
}

export const exportQrData = async (organizationId: string, days = 30, format: 'csv' | 'json' = 'csv') => {
  const response = await httpClient.get(`/api/analytics/organizations/${organizationId}/qr-export`, {
    params: { days, format },
    responseType: 'blob',
  })
  const blob = new Blob([response.data])
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `qr-analytics-${organizationId.slice(0, 8)}.${format}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export interface LinkedAccount {
  provider: string
  provider_user_id: string
  email: string | null
  created_at: string | null
}

export const getLinkedAccounts = async () => {
  const { data } = await httpClient.get<LinkedAccount[]>('/api/auth/linked-accounts')
  return data
}

export const getAdminDashboardSummary = async () => {
  const { data } = await httpClient.get<AdminDashboardSummary>('/api/admin/dashboard/summary')
  return data
}
