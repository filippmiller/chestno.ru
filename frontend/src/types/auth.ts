export type PlatformRole = 'platform_admin' | 'moderator' | 'support'

export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'editor' | 'analyst' | 'viewer'

export interface AppUser {
  id: string
  email: string
  full_name?: string | null
  locale?: string | null
}

export interface Organization {
  id: string
  name: string
  slug: string
  city?: string | null
  country?: string | null
  website_url?: string | null
  phone?: string | null
  verification_status?: 'pending' | 'verified' | 'rejected'
}

export interface OrganizationMembership {
  id: string
  role: OrganizationRole
  organization_id: string
  user_id: string
  organization?: Organization
}

export interface AfterSignupPayload {
  auth_user_id: string
  email: string
  contact_name: string
  account_type: 'producer' | 'user'
  company_name?: string
  country?: string
  city?: string
  website_url?: string
  phone?: string
  invite_code?: string
}

export interface OrganizationProfile {
  id: string
  organization_id: string
  short_description?: string | null
  long_description?: string | null
  production_description?: string | null
  safety_and_quality?: string | null
  video_url?: string | null
  gallery: Array<{ url: string; caption?: string | null }>
  tags?: string | null
  language: string
  created_at?: string | null
  updated_at?: string | null
}

export type OrganizationProfilePayload = Partial<Omit<OrganizationProfile, 'id' | 'organization_id' | 'created_at' | 'updated_at'>> & {
  gallery?: Array<{ url: string; caption?: string | null }>
}

export interface OrganizationInvite {
  id: string
  organization_id: string
  email: string
  role: OrganizationRole
  code: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at?: string | null
  created_by: string
  created_at: string
  accepted_by?: string | null
  accepted_at?: string | null
}

export interface OrganizationInvitePayload {
  email: string
  role: OrganizationRole
  expires_at?: string
}

export interface OrganizationInvitePreview {
  organization_name: string
  organization_slug: string
  role: OrganizationRole
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  requires_auth: boolean
}

export interface ModerationOrganization {
  id: string
  name: string
  slug: string
  country?: string | null
  city?: string | null
  website_url?: string | null
  verification_status: 'pending' | 'verified' | 'rejected'
  verification_comment?: string | null
  is_verified: boolean
  created_at: string
}

export type ModerationAction = 'verify' | 'reject'

export interface ModerationActionPayload {
  action: ModerationAction
  comment?: string
}

export interface QRCode {
  id: string
  organization_id: string
  code: string
  label?: string | null
  target_type: string
  target_slug?: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface QRCodePayload {
  label?: string
  target_type?: 'organization'
}

export interface QRCodeStats {
  total: number
  last_7_days: number
  last_30_days: number
}

export interface PublicOrganizationProfile {
  name: string
  slug: string
  country?: string | null
  city?: string | null
  website_url?: string | null
  is_verified: boolean
  verification_status: string
  short_description?: string | null
  long_description?: string | null
  production_description?: string | null
  safety_and_quality?: string | null
  video_url?: string | null
  gallery: Array<{ url: string; caption?: string | null }>
  tags?: string | null
}

export interface AiIntegration {
  id: string
  provider: string
  display_name: string
  env_var_name: string
  is_enabled: boolean
  last_check_at?: string | null
  last_check_status?: string | null
  last_check_message?: string | null
  created_at: string
  updated_at: string
}

export interface AiIntegrationPayload {
  provider: string
  display_name: string
  env_var_name: string
  is_enabled?: boolean
}

export interface DevTask {
  id: string
  title: string
  description?: string | null
  category: 'integration' | 'auth' | 'ai' | 'billing' | 'infrastructure' | 'other'
  related_provider?: string | null
  related_env_vars: string[]
  status: 'todo' | 'in_progress' | 'blocked' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  external_link?: string | null
  notes_internal?: string | null
  created_at: string
  updated_at: string
}

export interface DevTaskPayload {
  title: string
  description?: string
  category?: DevTask['category']
  related_provider?: string
  related_env_vars?: string[]
  status?: DevTask['status']
  priority?: DevTask['priority']
  external_link?: string
  notes_internal?: string
}

export interface SessionPayload {
  user: AppUser
  memberships: OrganizationMembership[]
  organizations: Organization[]
  platform_roles: PlatformRole[]
}

export interface LoginResponse extends SessionPayload {
  access_token: string
  refresh_token: string
  expires_in?: number
  token_type: string
}

