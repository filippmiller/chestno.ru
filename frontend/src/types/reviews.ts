export interface ReviewMediaItem {
  type: 'image' | 'video'
  url: string
  thumbnail_url?: string | null
  alt?: string | null
}

export interface Review {
  id: string
  organization_id: string
  product_id?: string | null
  author_user_id: string
  rating: number
  title?: string | null
  body: string
  media: ReviewMediaItem[]
  status: 'pending' | 'approved' | 'rejected'
  moderated_by?: string | null
  moderated_at?: string | null
  moderation_comment?: string | null
  response?: string | null
  response_by?: string | null
  response_at?: string | null
  created_at: string
  updated_at: string
}

export interface ReviewCreate {
  product_id?: string | null
  rating: number
  title?: string | null
  body: string
  media?: ReviewMediaItem[]
}

export interface ReviewUpdate {
  title?: string | null
  body?: string | null
  media?: ReviewMediaItem[]
}

export interface ReviewModeration {
  status: 'pending' | 'approved' | 'rejected'
  moderation_comment?: string | null
}

export interface ReviewResponse {
  response: string
}

export interface PublicReview {
  id: string
  product_id?: string | null
  author_user_id: string
  rating: number
  title?: string | null
  body: string
  media: ReviewMediaItem[]
  response?: string | null
  response_at?: string | null
  created_at: string
}

export interface ReviewsResponse {
  items: Review[]
  total: number
}

export interface PublicReviewsResponse {
  items: PublicReview[]
  total: number
  average_rating?: number | null
}

export interface ReviewStats {
  total_reviews: number
  average_rating?: number | null
  rating_distribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
}

// AI Response Generation Types
export type ResponseTone = 'professional' | 'friendly' | 'apologetic'
export type ReviewSentiment = 'positive' | 'neutral' | 'negative'

export interface AIResponseSuggestion {
  tone: ResponseTone
  text: string
  confidence: number
}

export interface AIResponseResult {
  sentiment: ReviewSentiment
  topics: string[]
  suggestions: AIResponseSuggestion[]
}

