// Product types for the public product page

export interface ProductJourneyStep {
  id: string
  stage: 'sourcing' | 'production' | 'quality_check' | 'packaging' | 'distribution' | 'retail'
  title: string
  description?: string | null
  location?: string | null
  date?: string | null
  verified: boolean
  media_url?: string | null
  order: number
}

export interface PublicProductDetails {
  id: string
  slug: string
  name: string
  short_description?: string | null
  long_description?: string | null
  category?: string | null
  tags?: string | null
  price_cents?: number | null
  currency?: string | null
  main_image_url?: string | null
  gallery?: Array<{ url: string; caption?: string | null }> | null
  external_url?: string | null
  sku?: string | null
  barcode?: string | null
  // Producer info
  organization: {
    id: string
    name: string
    slug: string
    is_verified: boolean
    status_level?: 'A' | 'B' | 'C' | null
    main_image_url?: string | null
  }
  // Journey timeline
  journey_steps: ProductJourneyStep[]
  // Trust metrics
  trust_score?: number | null
  verified_claims: string[]
  certifications: Array<{
    name: string
    issuer?: string | null
    valid_until?: string | null
  }>
  // Social
  follower_count: number
  is_followed?: boolean
}

export interface FollowedItem {
  id: string
  type: 'product' | 'organization'
  name: string
  slug: string
  image_url?: string | null
  followed_at: string
  organization_name?: string | null
  last_update?: string | null
}

export interface FollowSubscription {
  id: string
  target_type: 'product' | 'organization'
  target_id: string
  notify_updates: boolean
  notify_price_changes: boolean
  notify_new_content: boolean
  created_at: string
}

export interface NotificationPreferences {
  email_enabled: boolean
  push_enabled: boolean
  digest_frequency: 'instant' | 'daily' | 'weekly' | 'never'
  notify_price_drops: boolean
  notify_new_products: boolean
  notify_stories: boolean
  notify_certifications: boolean
}
