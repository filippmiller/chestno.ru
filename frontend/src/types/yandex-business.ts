/**
 * Yandex Business Integration Types
 */

export type YandexBusinessStatus = 'pending' | 'verified' | 'unverified' | 'rejected'

export interface YandexBusinessProfileLink {
  id: string
  organization_id: string
  yandex_permalink: string
  yandex_url?: string
  business_name?: string
  business_address?: string
  yandex_rating?: number
  yandex_review_count?: number
  status: YandexBusinessStatus
  last_synced_at?: string
  created_at: string
  updated_at: string
}

export interface YandexBusinessProfileResponse {
  link?: YandexBusinessProfileLink
  is_linked: boolean
  can_display_badge: boolean
}

export interface LinkYandexBusinessRequest {
  yandex_url: string
}

export interface UpdateYandexRatingRequest {
  rating: number
  review_count: number
}

export interface YandexReviewImportRow {
  author_name: string
  rating: number
  text: string
  date: string
  response_text?: string
  response_date?: string
}

export interface YandexReviewImportRequest {
  reviews: YandexReviewImportRow[]
}

export interface YandexReviewImportResult {
  total_submitted: number
  imported: number
  skipped_duplicates: number
  skipped_errors: number
  errors: string[]
}

export interface YandexImportedReview {
  id: string
  organization_id: string
  author_name: string
  rating: number
  review_text: string
  review_date: string
  response_text?: string
  response_date?: string
  imported_at: string
}

// Status display config
export const YANDEX_STATUS_CONFIG: Record<YandexBusinessStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  pending: {
    label: 'Ожидает проверки',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  verified: {
    label: 'Подтверждён',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  unverified: {
    label: 'Не подтверждён',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  rejected: {
    label: 'Отклонён',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
}
