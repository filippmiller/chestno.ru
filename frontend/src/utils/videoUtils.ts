/**
 * Video Utilities for Story Video Feature
 * 
 * Handles:
 * - Client-side video compression (using browser APIs)
 * - Thumbnail generation from video frames
 * - Video metadata extraction
 * - Duration validation
 */

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  aspectRatio: number
  fileSize: number
  mimeType: string
}

export interface ThumbnailResult {
  blob: Blob
  dataUrl: string
  width: number
  height: number
}

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  videoBitrate?: number  // in bps
  audioBitrate?: number  // in bps
}

// Default compression settings for story videos
export const DEFAULT_COMPRESSION: CompressionOptions = {
  maxWidth: 1080,
  maxHeight: 1920,
  videoBitrate: 2_000_000,  // 2 Mbps
  audioBitrate: 128_000,    // 128 kbps
}

// Maximum durations
export const MAX_STORY_DURATION = 60  // 60 seconds for story videos
export const MAX_EXTENDED_DURATION = 300  // 5 minutes for extended content

/**
 * Extract metadata from a video file
 */
export function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
        fileSize: file.size,
        mimeType: file.type,
      })
    }
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Failed to load video metadata'))
    }
    
    video.src = URL.createObjectURL(file)
  })
}

/**
 * Validate video file for story upload
 */
export async function validateStoryVideo(file: File): Promise<{
  valid: boolean
  error?: string
  metadata?: VideoMetadata
}> {
  // Check file type
  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime']
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Разрешены только форматы MP4, WebM и MOV',
    }
  }
  
  // Check file size (100 MB max)
  const maxSize = 100 * 1024 * 1024
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Максимальный размер видео: 100 МБ',
    }
  }
  
  try {
    const metadata = await extractVideoMetadata(file)
    
    // Check duration
    if (metadata.duration > MAX_EXTENDED_DURATION) {
      return {
        valid: false,
        error: `Максимальная длительность видео: ${MAX_EXTENDED_DURATION / 60} минут`,
        metadata,
      }
    }
    
    // Warn about long videos (but allow)
    if (metadata.duration > MAX_STORY_DURATION) {
      console.warn(`Video duration ${metadata.duration}s exceeds recommended ${MAX_STORY_DURATION}s for stories`)
    }
    
    return { valid: true, metadata }
  } catch (error) {
    return {
      valid: false,
      error: 'Не удалось прочитать видеофайл. Проверьте, что файл не поврежден.',
    }
  }
}

/**
 * Generate thumbnail from video at specified time
 */
export function generateThumbnail(
  videoFile: File,
  timeSeconds: number = 1,
  maxWidth: number = 640,
  maxHeight: number = 360
): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    
    video.onloadedmetadata = () => {
      // Seek to specified time (or 10% into video if time is invalid)
      const seekTime = Math.min(timeSeconds, video.duration * 0.1)
      video.currentTime = seekTime
    }
    
    video.onseeked = () => {
      // Calculate scaled dimensions maintaining aspect ratio
      let width = video.videoWidth
      let height = video.videoHeight
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }
      
      // Draw frame to canvas
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width)
      canvas.height = Math.round(height)
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(video.src)
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(video.src)
          
          if (!blob) {
            reject(new Error('Failed to create thumbnail blob'))
            return
          }
          
          resolve({
            blob,
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            width: canvas.width,
            height: canvas.height,
          })
        },
        'image/jpeg',
        0.85
      )
    }
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Failed to load video for thumbnail generation'))
    }
    
    video.src = URL.createObjectURL(videoFile)
  })
}

/**
 * Generate multiple thumbnail options from a video
 */
export async function generateThumbnailOptions(
  videoFile: File,
  count: number = 4
): Promise<ThumbnailResult[]> {
  const metadata = await extractVideoMetadata(videoFile)
  const thumbnails: ThumbnailResult[] = []
  
  // Generate thumbnails at evenly spaced intervals
  for (let i = 0; i < count; i++) {
    const time = (metadata.duration * (i + 1)) / (count + 1)
    try {
      const thumbnail = await generateThumbnail(videoFile, time)
      thumbnails.push(thumbnail)
    } catch (error) {
      console.warn(`Failed to generate thumbnail at ${time}s:`, error)
    }
  }
  
  return thumbnails
}

/**
 * Format duration for display (MM:SS)
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Check if video can autoplay (browser restrictions)
 * Most browsers require muted autoplay
 */
export function canAutoplay(): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAABZYiEBDwK3AAAB9AABgKTnwKdAAJ/AA+gLZ'
    
    video.play()
      .then(() => {
        video.pause()
        resolve(true)
      })
      .catch(() => {
        resolve(false)
      })
  })
}

/**
 * Detect device type for analytics
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet'
  }
  
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile'
  }
  
  return 'desktop'
}

/**
 * Generate a unique session ID for anonymous view tracking
 */
export function getOrCreateSessionId(): string {
  const key = 'chestno_video_session'
  let sessionId = sessionStorage.getItem(key)
  
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    sessionStorage.setItem(key, sessionId)
  }
  
  return sessionId
}
