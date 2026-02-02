/**
 * Product Stories Types
 *
 * TypeScript interfaces for the product stories feature.
 */

// Content types for story chapters
export type StoryContentType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'GALLERY' | 'QUIZ'

// Story status
export type StoryStatus = 'draft' | 'published' | 'archived'

// Quiz option
export interface QuizOption {
  id: string
  text: string
  is_correct: boolean
}

// Quiz answer
export interface QuizAnswer {
  chapter_id: string
  selected_option_id: string
}

// Story chapter
export interface StoryChapter {
  id: string
  story_id: string
  order_index: number
  title?: string | null
  content_type: StoryContentType
  content?: string | null
  media_url?: string | null
  media_urls?: string[] | null
  duration_seconds: number
  quiz_question?: string | null
  quiz_options?: QuizOption[] | null
  quiz_explanation?: string | null
  background_color?: string | null
  text_color?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// Story chapter create/update
export interface StoryChapterCreate {
  order_index?: number
  title?: string | null
  content_type?: StoryContentType
  content?: string | null
  media_url?: string | null
  media_urls?: string[] | null
  duration_seconds?: number
  quiz_question?: string | null
  quiz_options?: QuizOption[] | null
  quiz_explanation?: string | null
  background_color?: string | null
  text_color?: string | null
}

export type StoryChapterUpdate = Partial<StoryChapterCreate>

// Product story
export interface ProductStory {
  id: string
  product_id: string
  organization_id: string
  created_by?: string | null
  title: string
  description?: string | null
  cover_image?: string | null
  status: StoryStatus
  published_at?: string | null
  view_count: number
  completion_count: number
  avg_time_spent_seconds: number
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  chapters?: StoryChapter[]
  // Joined fields
  product_name?: string | null
  product_slug?: string | null
  product_image?: string | null
  chapter_count?: number
}

// Story create payload
export interface ProductStoryCreate {
  product_id: string
  organization_id: string
  title: string
  description?: string | null
  cover_image?: string | null
  chapters?: StoryChapterCreate[] | null
}

// Story update payload
export interface ProductStoryUpdate {
  title?: string | null
  description?: string | null
  cover_image?: string | null
  status?: StoryStatus | null
}

// Story interaction
export interface StoryInteraction {
  id: string
  story_id: string
  user_id?: string | null
  session_id?: string | null
  completed_chapters: number[]
  last_chapter_index: number
  total_time_spent: number
  completed_at?: string | null
  quiz_answers?: Record<string, string> | null
  quiz_score: number
  device_type?: string | null
  referrer?: string | null
  started_at: string
  last_activity_at: string
}

// Interaction tracking payload
export interface StoryInteractionCreate {
  story_id: string
  session_id?: string | null
  chapter_index?: number | null
  time_spent?: number | null
  quiz_answer?: QuizAnswer | null
  completed?: boolean
  device_type?: string | null
  referrer?: string | null
}

// Story list response
export interface StoryListResponse {
  stories: ProductStory[]
  total: number
  page: number
  per_page: number
}

// Story detail response
export interface StoryDetailResponse {
  story: ProductStory
  chapters: StoryChapter[]
  interaction?: StoryInteraction | null
}

// Story analytics
export interface StoryAnalytics {
  story_id: string
  story_title: string
  view_count: number
  completion_count: number
  completion_rate: number
  avg_time_spent_seconds: number
  chapter_drop_off: Array<{ chapter_index: number; view_count: number }>
  device_breakdown: Record<string, number>
  top_referrers: Array<{ referrer: string; count: number }>
  quiz_performance?: {
    avg_score: number
    completion_rate: number
  } | null
}

// Organization stories analytics
export interface OrganizationStoriesAnalytics {
  organization_id: string
  total_stories: number
  published_stories: number
  total_views: number
  total_completions: number
  avg_completion_rate: number
  avg_time_spent_seconds: number
  top_stories: StoryAnalytics[]
  views_over_time: Array<{ date: string; views: number }>
}
