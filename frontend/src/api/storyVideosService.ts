// Story Videos API Service
// Handles fetching and managing producer story videos

import { supabase } from '@/lib/supabaseClient'
import type { SubtitleTrack } from '@/components/story-video/StoryVideoPlayer'

export interface StoryVideo {
  id: string
  organizationId: string
  journeyStepId?: string | null
  productId?: string | null
  title: string
  description?: string | null
  videoUrl: string
  thumbnailUrl?: string | null
  durationSeconds: number
  width?: number | null
  height?: number | null
  processingStatus: 'uploaded' | 'processing' | 'ready' | 'failed'
  autoplayOnHover: boolean
  loopPlayback: boolean
  mutedByDefault: boolean
  isPublished: boolean
  publishedAt?: string | null
  viewCount: number
  uniqueViewCount: number
  createdAt: string
  updatedAt: string
  subtitles?: SubtitleTrack[]
}

interface RawStoryVideoRow {
  id: string
  organization_id: string
  journey_step_id?: string | null
  product_id?: string | null
  title: string
  description?: string | null
  video_url: string
  thumbnail_url?: string | null
  duration_seconds: number
  width?: number | null
  height?: number | null
  processing_status: string
  autoplay_on_hover: boolean
  loop_playback: boolean
  muted_by_default: boolean
  is_published: boolean
  published_at?: string | null
  view_count: number
  unique_view_count: number
  created_at: string
  updated_at: string
  story_video_subtitles?: Array<{
    id: string
    language_code: string
    language_name: string
    subtitle_url?: string | null
    subtitle_data?: Array<{ start: number; end: number; text: string }> | null
    is_default: boolean
  }>
}

function mapStoryVideo(row: RawStoryVideoRow): StoryVideo {
  return {
    id: row.id,
    organizationId: row.organization_id,
    journeyStepId: row.journey_step_id,
    productId: row.product_id,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    width: row.width,
    height: row.height,
    processingStatus: row.processing_status as StoryVideo['processingStatus'],
    autoplayOnHover: row.autoplay_on_hover,
    loopPlayback: row.loop_playback,
    mutedByDefault: row.muted_by_default,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    viewCount: row.view_count,
    uniqueViewCount: row.unique_view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtitles: row.story_video_subtitles?.map((sub) => ({
      id: sub.id,
      languageCode: sub.language_code,
      languageName: sub.language_name,
      subtitleUrl: sub.subtitle_url ?? undefined,
      subtitleData: sub.subtitle_data ?? undefined,
      isDefault: sub.is_default,
    })),
  }
}

/**
 * Fetch published story videos for an organization
 */
export async function getOrganizationStoryVideos(
  organizationId: string,
  options?: {
    limit?: number
    productId?: string | null
    journeyStepId?: string | null
  }
): Promise<StoryVideo[]> {
  const { limit = 10, productId, journeyStepId } = options ?? {}

  let query = supabase
    .from('story_videos')
    .select(`
      *,
      story_video_subtitles (
        id,
        language_code,
        language_name,
        subtitle_url,
        subtitle_data,
        is_default
      )
    `)
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .eq('processing_status', 'ready')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (productId) {
    query = query.eq('product_id', productId)
  }

  if (journeyStepId) {
    query = query.eq('journey_step_id', journeyStepId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching story videos:', error)
    return []
  }

  return (data as RawStoryVideoRow[] || []).map(mapStoryVideo)
}

/**
 * Fetch a single story video by ID
 */
export async function getStoryVideo(videoId: string): Promise<StoryVideo | null> {
  const { data, error } = await supabase
    .from('story_videos')
    .select(`
      *,
      story_video_subtitles (
        id,
        language_code,
        language_name,
        subtitle_url,
        subtitle_data,
        is_default
      )
    `)
    .eq('id', videoId)
    .eq('is_published', true)
    .eq('processing_status', 'ready')
    .single()

  if (error) {
    console.error('Error fetching story video:', error)
    return null
  }

  return mapStoryVideo(data as RawStoryVideoRow)
}

/**
 * Fetch story videos for a product
 */
export async function getProductStoryVideos(productId: string): Promise<StoryVideo[]> {
  const { data, error } = await supabase
    .from('story_videos')
    .select(`
      *,
      story_video_subtitles (
        id,
        language_code,
        language_name,
        subtitle_url,
        subtitle_data,
        is_default
      )
    `)
    .eq('product_id', productId)
    .eq('is_published', true)
    .eq('processing_status', 'ready')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching product story videos:', error)
    return []
  }

  return (data as RawStoryVideoRow[] || []).map(mapStoryVideo)
}

/**
 * Fetch featured/latest story videos across all organizations
 */
export async function getFeaturedStoryVideos(limit = 6): Promise<StoryVideo[]> {
  const { data, error } = await supabase
    .from('story_videos')
    .select(`
      *,
      story_video_subtitles (
        id,
        language_code,
        language_name,
        subtitle_url,
        subtitle_data,
        is_default
      )
    `)
    .eq('is_published', true)
    .eq('processing_status', 'ready')
    .order('view_count', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching featured story videos:', error)
    return []
  }

  return (data as RawStoryVideoRow[] || []).map(mapStoryVideo)
}
