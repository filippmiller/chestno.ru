/**
 * StoryVideoPlayer Component
 * 
 * Features:
 * - Auto-play on hover (muted, for desktop)
 * - Full-screen on click
 * - Mobile-optimized with play button overlay
 * - Subtitle/caption support
 * - Progress indicator
 * - Analytics tracking
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Subtitles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, getDeviceType, getOrCreateSessionId } from '@/utils/videoUtils'
import { getSupabaseClient } from '@/lib/supabaseClient'

const supabase = getSupabaseClient()

export interface SubtitleTrack {
  id: string
  languageCode: string
  languageName: string
  subtitleUrl?: string
  subtitleData?: Array<{ start: number; end: number; text: string }>
  isDefault?: boolean
}

export interface StoryVideoPlayerProps {
  videoId: string
  videoUrl: string
  thumbnailUrl?: string
  duration: number
  title?: string
  subtitles?: SubtitleTrack[]
  autoplayOnHover?: boolean
  loop?: boolean
  mutedByDefault?: boolean
  className?: string
  aspectRatio?: 'video' | 'square' | 'portrait'
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onProgress?: (currentTime: number, duration: number) => void
}

export function StoryVideoPlayer({
  videoId,
  videoUrl,
  thumbnailUrl,
  duration,
  title,
  subtitles = [],
  autoplayOnHover = true,
  loop = false,
  mutedByDefault = true,
  className,
  aspectRatio = 'video',
  onPlay,
  onPause,
  onEnded,
  onProgress,
}: StoryVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // State
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(mutedByDefault)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleTrack | null>(
    subtitles.find(s => s.isDefault) || null
  )
  const [currentCaption, setCurrentCaption] = useState<string>('')
  
  // Device detection
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    setIsMobile(getDeviceType() !== 'desktop')
  }, [])

  // Aspect ratio classes
  const aspectRatioClass = {
    video: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[9/16]',
  }[aspectRatio]

  // Control visibility timer
  const controlsTimerRef = useRef<number>()
  
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current)
    }
    if (isPlaying && !isMobile) {
      controlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false)
      }, 2500)
    }
  }, [isPlaying, isMobile])

  // Analytics tracking
  const trackViewRef = useRef({
    startTime: 0,
    hasTracked: false,
    maxWatched: 0,
    enteredFullscreen: false,
  })

  const trackVideoView = useCallback(async (completed: boolean = false) => {
    if (trackViewRef.current.hasTracked && !completed) return
    
    const watchedSeconds = Math.round(trackViewRef.current.maxWatched)
    if (watchedSeconds < 1) return

    try {
      await supabase.rpc('record_video_view', {
        p_video_id: videoId,
        p_session_id: getOrCreateSessionId(),
        p_watched_seconds: watchedSeconds,
        p_completed: completed,
        p_device_type: getDeviceType(),
        p_referrer: document.referrer || null,
        p_was_muted: isMuted,
        p_entered_fullscreen: trackViewRef.current.enteredFullscreen,
      })
      trackViewRef.current.hasTracked = true
    } catch (error) {
      console.warn('Failed to track video view:', error)
    }
  }, [videoId, isMuted])

  // Subtitle handling
  useEffect(() => {
    if (!activeSubtitle?.subtitleData || !isPlaying) {
      setCurrentCaption('')
      return
    }

    const updateCaption = () => {
      const time = videoRef.current?.currentTime || 0
      const caption = activeSubtitle.subtitleData?.find(
        c => time >= c.start && time <= c.end
      )
      setCurrentCaption(caption?.text || '')
    }

    const interval = setInterval(updateCaption, 100)
    return () => clearInterval(interval)
  }, [activeSubtitle, isPlaying])

  // Video event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    setHasInteracted(true)
    if (trackViewRef.current.startTime === 0) {
      trackViewRef.current.startTime = Date.now()
    }
    onPlay?.()
  }, [onPlay])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    setShowControls(true)
    onPause?.()
  }, [onPause])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    setShowControls(true)
    trackVideoView(true)
    onEnded?.()
  }, [onEnded, trackVideoView])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    
    setCurrentTime(video.currentTime)
    trackViewRef.current.maxWatched = Math.max(
      trackViewRef.current.maxWatched,
      video.currentTime
    )
    onProgress?.(video.currentTime, video.duration)
  }, [onProgress])

  const handleLoadedData = useCallback(() => {
    setIsLoaded(true)
  }, [])

  // User interaction handlers
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play().catch(console.warn)
    }
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    
    video.muted = !video.muted
    setIsMuted(!isMuted)
  }, [isMuted])

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    try {
      if (!isFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen()
        }
        trackViewRef.current.enteredFullscreen = true
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch (error) {
      console.warn('Fullscreen toggle failed:', error)
    }
  }, [isFullscreen])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Hover autoplay (desktop only)
  useEffect(() => {
    if (isMobile || !autoplayOnHover || hasInteracted) return

    const video = videoRef.current
    if (!video) return

    if (isHovering && !isPlaying) {
      video.muted = true
      setIsMuted(true)
      video.play().catch(() => {
        // Autoplay failed - browser restrictions
      })
    } else if (!isHovering && isPlaying && !hasInteracted) {
      video.pause()
      video.currentTime = 0
    }
  }, [isHovering, isPlaying, autoplayOnHover, isMobile, hasInteracted])

  // Track view on unmount
  useEffect(() => {
    return () => {
      if (trackViewRef.current.maxWatched > 1) {
        trackVideoView(false)
      }
    }
  }, [trackVideoView])

  // Progress bar calculation
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  // Cycle through subtitles
  const cycleSubtitles = useCallback(() => {
    if (subtitles.length === 0) return
    
    const currentIndex = activeSubtitle 
      ? subtitles.findIndex(s => s.id === activeSubtitle.id)
      : -1
    
    if (currentIndex === subtitles.length - 1) {
      setActiveSubtitle(null)
    } else {
      setActiveSubtitle(subtitles[currentIndex + 1])
    }
  }, [subtitles, activeSubtitle])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-lg bg-neutral-900 group',
        aspectRatioClass,
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      onMouseEnter={() => {
        setIsHovering(true)
        showControlsTemporarily()
      }}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={showControlsTemporarily}
      onClick={(e) => {
        // Don't toggle on control clicks
        if ((e.target as HTMLElement).closest('.controls-area')) return
        togglePlay()
        showControlsTemporarily()
      }}
    >
      {/* Thumbnail (shows before play) */}
      {thumbnailUrl && !isPlaying && !isLoaded && (
        <img
          src={thumbnailUrl}
          alt={title || 'Video thumbnail'}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        loop={loop}
        muted={isMuted}
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedData={handleLoadedData}
      />

      {/* Caption overlay */}
      {currentCaption && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center px-4 pointer-events-none">
          <span className="bg-black/75 text-white px-3 py-1.5 rounded text-sm md:text-base max-w-[90%] text-center">
            {currentCaption}
          </span>
        </div>
      )}

      {/* Play button overlay (mobile or not playing) */}
      {(!isPlaying || isMobile) && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-opacity duration-200',
            isPlaying && 'opacity-0 pointer-events-none'
          )}
        >
          <button
            className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-neutral-900" />
            ) : (
              <Play className="w-8 h-8 text-neutral-900 ml-1" />
            )}
          </button>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          'controls-area absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-3 px-3 transition-opacity duration-200',
          !showControls && isPlaying && !isMobile && 'opacity-0'
        )}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer group/progress"
          onClick={(e) => {
            const video = videoRef.current
            if (!video) return
            const rect = e.currentTarget.getBoundingClientRect()
            const percent = (e.clientX - rect.left) / rect.width
            video.currentTime = percent * duration
          }}
        >
          <div
            className="h-full bg-white rounded-full transition-all group-hover/progress:h-1.5"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              className="text-white hover:text-white/80 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            {/* Mute/Unmute */}
            <button
              className="text-white hover:text-white/80 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                toggleMute()
              }}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {/* Time display */}
            <span className="text-white text-xs font-mono">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Subtitles toggle */}
            {subtitles.length > 0 && (
              <button
                className={cn(
                  'text-white hover:text-white/80 transition-colors',
                  activeSubtitle && 'text-blue-400'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  cycleSubtitles()
                }}
                aria-label="Toggle subtitles"
                title={activeSubtitle ? `Subtitles: ${activeSubtitle.languageName}` : 'Subtitles off'}
              >
                <Subtitles className="w-5 h-5" />
              </button>
            )}

            {/* Fullscreen */}
            <button
              className="text-white hover:text-white/80 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                toggleFullscreen()
              }}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Title overlay (top) */}
      {title && showControls && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-3 pt-2">
          <h3 className="text-white text-sm font-medium truncate">{title}</h3>
        </div>
      )}
    </div>
  )
}

export default StoryVideoPlayer
