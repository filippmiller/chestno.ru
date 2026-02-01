/**
 * Story Video Uploader
 * 
 * Handles uploading story videos to Supabase Storage
 * with progress tracking and thumbnail generation.
 */

import { getSupabaseClient } from '@/lib/supabaseClient'
import {
  validateStoryVideo,
  generateThumbnail,
  extractVideoMetadata,
  type VideoMetadata,
  type ThumbnailResult,
} from './videoUtils'

const supabase = getSupabaseClient()

export interface UploadProgress {
  phase: 'validating' | 'generating-thumbnail' | 'uploading-video' | 'uploading-thumbnail' | 'saving' | 'complete' | 'error'
  progress: number  // 0-100
  message: string
  error?: string
}

export interface StoryVideoUploadResult {
  videoId: string
  videoUrl: string
  videoPath: string
  thumbnailUrl: string
  thumbnailPath: string
  metadata: VideoMetadata
}

export interface StoryVideoUploadOptions {
  organizationId: string
  title: string
  description?: string
  journeyStepId?: string
  productId?: string
  thumbnailTime?: number  // Seconds into video for thumbnail
  autoPublish?: boolean
  onProgress?: (progress: UploadProgress) => void
}

/**
 * Upload a story video with thumbnail generation
 */
export async function uploadStoryVideo(
  file: File,
  options: StoryVideoUploadOptions
): Promise<StoryVideoUploadResult> {
  const {
    organizationId,
    title,
    description,
    journeyStepId,
    productId,
    thumbnailTime = 1,
    autoPublish = false,
    onProgress,
  } = options

  const reportProgress = (update: UploadProgress) => {
    onProgress?.(update)
  }

  try {
    // Phase 1: Validate
    reportProgress({
      phase: 'validating',
      progress: 5,
      message: 'Проверка видеофайла...',
    })

    const validation = await validateStoryVideo(file)
    if (!validation.valid || !validation.metadata) {
      throw new Error(validation.error || 'Validation failed')
    }

    const metadata = validation.metadata

    // Phase 2: Generate thumbnail
    reportProgress({
      phase: 'generating-thumbnail',
      progress: 15,
      message: 'Создание превью...',
    })

    let thumbnail: ThumbnailResult
    try {
      thumbnail = await generateThumbnail(file, thumbnailTime)
    } catch (error) {
      console.warn('Thumbnail generation failed, using fallback')
      // Try at 0 seconds as fallback
      thumbnail = await generateThumbnail(file, 0)
    }

    // Generate unique file names
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const fileExt = file.name.split('.').pop() || 'mp4'
    
    const videoFileName = `${timestamp}-${randomSuffix}.${fileExt}`
    const thumbnailFileName = `${timestamp}-${randomSuffix}-thumb.jpg`
    
    const videoPath = `${organizationId}/videos/${videoFileName}`
    const thumbnailPath = `${organizationId}/thumbnails/${thumbnailFileName}`

    // Phase 3: Upload video
    reportProgress({
      phase: 'uploading-video',
      progress: 25,
      message: 'Загрузка видео...',
    })

    const { data: videoData, error: videoError } = await supabase.storage
      .from('story-videos')
      .upload(videoPath, file, {
        cacheControl: '86400',  // 24 hours
        upsert: false,
      })

    if (videoError) {
      throw new Error(`Video upload failed: ${videoError.message}`)
    }

    reportProgress({
      phase: 'uploading-video',
      progress: 70,
      message: 'Видео загружено, сохраняем превью...',
    })

    // Phase 4: Upload thumbnail
    reportProgress({
      phase: 'uploading-thumbnail',
      progress: 75,
      message: 'Загрузка превью...',
    })

    const { data: thumbnailData, error: thumbnailError } = await supabase.storage
      .from('story-thumbnails')
      .upload(thumbnailPath, thumbnail.blob, {
        cacheControl: '604800',  // 7 days
        upsert: false,
        contentType: 'image/jpeg',
      })

    if (thumbnailError) {
      console.warn('Thumbnail upload failed:', thumbnailError.message)
      // Continue without thumbnail - not critical
    }

    // Get public URLs
    const { data: { publicUrl: videoUrl } } = supabase.storage
      .from('story-videos')
      .getPublicUrl(videoPath)

    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from('story-thumbnails')
      .getPublicUrl(thumbnailPath)

    // Phase 5: Save to database
    reportProgress({
      phase: 'saving',
      progress: 85,
      message: 'Сохранение информации о видео...',
    })

    const { data: videoRecord, error: dbError } = await supabase
      .from('story_videos')
      .insert({
        organization_id: organizationId,
        journey_step_id: journeyStepId || null,
        product_id: productId || null,
        title,
        description: description || null,
        video_url: videoUrl,
        video_path: videoPath,
        thumbnail_url: thumbnailData ? thumbnailUrl : null,
        thumbnail_path: thumbnailData ? thumbnailPath : null,
        duration_seconds: Math.round(metadata.duration),
        width: metadata.width,
        height: metadata.height,
        file_size_bytes: metadata.fileSize,
        mime_type: metadata.mimeType,
        processing_status: 'ready',  // No server-side processing for now
        is_published: autoPublish,
        published_at: autoPublish ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (dbError) {
      // Try to clean up uploaded files
      await supabase.storage.from('story-videos').remove([videoPath])
      if (thumbnailData) {
        await supabase.storage.from('story-thumbnails').remove([thumbnailPath])
      }
      throw new Error(`Database save failed: ${dbError.message}`)
    }

    reportProgress({
      phase: 'complete',
      progress: 100,
      message: 'Видео успешно загружено!',
    })

    return {
      videoId: videoRecord.id,
      videoUrl,
      videoPath,
      thumbnailUrl: thumbnailData ? thumbnailUrl : '',
      thumbnailPath: thumbnailData ? thumbnailPath : '',
      metadata,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    reportProgress({
      phase: 'error',
      progress: 0,
      message: 'Ошибка загрузки',
      error: errorMessage,
    })
    throw error
  }
}

/**
 * Update thumbnail for an existing video
 */
export async function updateVideoThumbnail(
  videoId: string,
  thumbnailBlob: Blob,
  organizationId: string
): Promise<string> {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const thumbnailPath = `${organizationId}/thumbnails/${timestamp}-${randomSuffix}-thumb.jpg`

  const { error: uploadError } = await supabase.storage
    .from('story-thumbnails')
    .upload(thumbnailPath, thumbnailBlob, {
      cacheControl: '604800',
      upsert: false,
      contentType: 'image/jpeg',
    })

  if (uploadError) {
    throw new Error(`Thumbnail upload failed: ${uploadError.message}`)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('story-thumbnails')
    .getPublicUrl(thumbnailPath)

  const { error: updateError } = await supabase
    .from('story_videos')
    .update({
      thumbnail_url: publicUrl,
      thumbnail_path: thumbnailPath,
    })
    .eq('id', videoId)

  if (updateError) {
    throw new Error(`Database update failed: ${updateError.message}`)
  }

  return publicUrl
}

/**
 * Delete a story video and its assets
 */
export async function deleteStoryVideo(videoId: string): Promise<void> {
  // First get the video to find file paths
  const { data: video, error: fetchError } = await supabase
    .from('story_videos')
    .select('video_path, thumbnail_path')
    .eq('id', videoId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch video: ${fetchError.message}`)
  }

  // Delete from storage
  const pathsToDelete: string[] = []
  if (video.video_path) pathsToDelete.push(video.video_path)
  
  if (pathsToDelete.length > 0) {
    await supabase.storage.from('story-videos').remove(pathsToDelete)
  }

  if (video.thumbnail_path) {
    await supabase.storage.from('story-thumbnails').remove([video.thumbnail_path])
  }

  // Delete database record (cascade will handle views, subtitles)
  const { error: deleteError } = await supabase
    .from('story_videos')
    .delete()
    .eq('id', videoId)

  if (deleteError) {
    throw new Error(`Failed to delete video record: ${deleteError.message}`)
  }
}

/**
 * Publish or unpublish a story video
 */
export async function setVideoPublished(
  videoId: string,
  published: boolean
): Promise<void> {
  const { error } = await supabase
    .from('story_videos')
    .update({
      is_published: published,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq('id', videoId)

  if (error) {
    throw new Error(`Failed to update video: ${error.message}`)
  }
}

/**
 * Get videos for an organization
 */
export async function getOrganizationVideos(
  organizationId: string,
  options?: {
    productId?: string
    journeyStepId?: string
    publishedOnly?: boolean
    limit?: number
    offset?: number
  }
) {
  let query = supabase
    .from('story_videos')
    .select('*, story_video_subtitles(*)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (options?.productId) {
    query = query.eq('product_id', options.productId)
  }

  if (options?.journeyStepId) {
    query = query.eq('journey_step_id', options.journeyStepId)
  }

  if (options?.publishedOnly) {
    query = query.eq('is_published', true).eq('processing_status', 'ready')
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit || 10) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`)
  }

  return data
}
