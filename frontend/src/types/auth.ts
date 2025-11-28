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

export interface SocialLink {
  type: 'instagram' | 'vk' | 'youtube' | 'ok' | 'tiktok' | 'facebook' | 'other'
  label: string
  url: string
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
  // Contacts
  contact_email?: string | null
  contact_phone?: string | null
  contact_website?: string | null
  contact_address?: string | null
  contact_telegram?: string | null
  contact_whatsapp?: string | null
  social_links?: SocialLink[]
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

export interface DbTableInfo {
  table_name: string
  schema_name: string
  approx_rows: number
  comment?: string | null
}

export interface DbColumnInfo {
  column_name: string
  data_type: string
  is_nullable: boolean
  column_default?: string | null
  comment?: string | null
  is_primary_key: boolean
  is_foreign_key: boolean
}

export interface DbRowsResponse {
  columns: string[]
  rows: Array<Record<string, unknown>>
  limit: number
  offset: number
  count: number
}

export interface MigrationDraftPayload {
  table_name: string
  column_name: string
  column_type: string
  default_value?: string | null
  is_nullable?: boolean
}

export interface Product {
  id: string
  organization_id: string
  slug: string
  name: string
  short_description?: string | null
  long_description?: string | null
  category?: string | null
  tags?: string | null
  price_cents?: number | null
  currency?: string | null
  status: 'draft' | 'published' | 'archived'
  is_featured: boolean
  main_image_url?: string | null
  gallery?: Array<{ url: string; caption?: string | null }> | null
  external_url?: string | null
  created_at: string
  updated_at: string
}

export interface ProductPayload {
  name: string
  slug: string
  short_description?: string | null
  long_description?: string | null
  category?: string | null
  tags?: string | null
  price_cents?: number | null
  currency?: string | null
  status?: 'draft' | 'published' | 'archived'
  is_featured?: boolean
  main_image_url?: string | null
  gallery?: Array<{ url: string; caption?: string | null }> | null
  external_url?: string | null
}

export interface PublicProduct {
  id: string
  organization_id: string
  slug: string
  name: string
  short_description?: string | null
  price_cents?: number | null
  currency?: string | null
  main_image_url?: string | null
  external_url?: string | null
}

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  description?: string | null
  price_monthly_cents?: number | null
  price_yearly_cents?: number | null
  currency: string
  max_products?: number | null
  max_qr_codes?: number | null
  max_members?: number | null
  analytics_level: 'basic' | 'advanced'
  is_default: boolean
  is_active: boolean
}

export interface OrganizationUsage {
  products_used: number
  qr_codes_used: number
  members_used: number
}

export interface OrganizationSubscriptionSummary {
  plan: SubscriptionPlan
  usage: OrganizationUsage
}

export interface OrganizationSubscription {
  id: string
  organization_id: string
  plan_id: string
  status: string
  current_period_start: string
  current_period_end?: string | null
  cancel_at?: string | null
  created_at: string
  updated_at: string
  plan: SubscriptionPlan
}

export interface NotificationItem {
  id: string
  notification_type_id: string
  org_id?: string | null
  title: string
  body: string
  payload?: Record<string, unknown> | null
  severity: string
  category: string
  created_at: string
}

export interface NotificationDelivery {
  id: string
  notification_id: string
  channel: string
  status: 'pending' | 'sent' | 'failed' | 'read' | 'dismissed'
  read_at?: string | null
  dismissed_at?: string | null
  created_at: string
  notification: NotificationItem
}

export interface NotificationListResponse {
  items: NotificationDelivery[]
  next_cursor?: string | null
}

export interface NotificationSetting {
  id?: string | null
  notification_type_id: string
  notification_type: {
    id: string
    key: string
    category: string
    severity: string
    title_template: string
    body_template: string
    default_channels: string[]
  }
  channels: string[]
  muted: boolean
}

export interface NotificationSettingUpdate {
  notification_type_id: string
  channels?: string[]
  muted?: boolean
}

export interface PublicOrganizationSummary {
  name: string
  slug: string
  country?: string | null
  city?: string | null
  primary_category?: string | null
  is_verified: boolean
  verification_status?: string | null
  short_description?: string | null
  main_image_url?: string | null
}

export interface PublicOrganizationsResponse {
  items: PublicOrganizationSummary[]
  total: number
}

export interface CertificationItem {
  name: string
  issuer?: string | null
  valid_until?: string | null
  link?: string | null
}

export interface BuyLinkItem {
  label: string
  url: string
}

export interface PublicOrganizationDetails extends PublicOrganizationProfile {
  primary_category?: string | null
  founded_year?: number | null
  employee_count?: number | null
  factory_size?: string | null
  category?: string | null
  certifications: CertificationItem[]
  sustainability_practices?: string | null
  quality_standards?: string | null
  buy_links: BuyLinkItem[]
  products: PublicProduct[]
}

export interface OnboardingStep {
  key:
    | 'profile_basic'
    | 'contacts'
    | 'story_and_photos'
    | 'video_presentation'
    | 'products'
    | 'qr_codes'
    | 'verification'
    | 'invites'
    | 'first_post'
  label: string
  completed: boolean
  description?: string | null
  link?: string | null
}

export interface OnboardingSummary {
  organization_id: string
  completion_percent: number
  steps: OnboardingStep[]
}

export interface DailyMetric {
  date: string
  count: number
}

export interface CountryMetric {
  country: string | null
  count: number
}

export interface SourceMetric {
  source: string | null
  count: number
}

export interface QROverviewResponse {
  total_scans: number
  first_scan_at?: string | null
  last_scan_at?: string | null
  daily: DailyMetric[]
  by_country: CountryMetric[]
  by_source: SourceMetric[]
}

export interface AdminDashboardSummary {
  total_organizations: number
  verified_organizations: number
  public_organizations: number
  total_products: number
  total_qr_codes: number
  total_qr_events: number
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

