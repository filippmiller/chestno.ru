/**
 * StoryViewer Component
 *
 * Immersive full-screen story viewer with chapter navigation,
 * progress tracking, and analytics. Similar to Instagram Stories
 * or web story formats.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StoryChapter } from './StoryChapter'
import { StoryProgress } from './StoryProgress'
import type {
  ProductStory,
  StoryChapter as StoryChapterType,
  StoryInteraction,
  QuizAnswer,
} from '@/types/product-stories'

export interface StoryViewerProps {
  /** Story data */
  story: ProductStory
  /** Chapters data */
  chapters: StoryChapterType[]
  /** User's interaction/progress */
  interaction?: StoryInteraction | null
  /** Callback when story is closed */
  onClose?: () => void
  /** Callback to track interaction */
  onTrackInteraction?: (data: {
    chapter_index: number
    time_spent?: number
    quiz_answer?: QuizAnswer
    completed?: boolean
  }) => void
  /** Callback when story is shared */
  onShare?: () => void
  /** Start at specific chapter */
  initialChapterIndex?: number
  /** Additional class names */
  className?: string
}

export function StoryViewer({
  story,
  chapters,
  interaction,
  onClose,
  onTrackInteraction,
  onShare,
  initialChapterIndex = 0,
  className,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(
    interaction?.last_chapter_index ?? initialChapterIndex
  )
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [chapterProgress, setChapterProgress] = useState(0)
  const [completedChapters, setCompletedChapters] = useState<number[]>(
    interaction?.completed_chapters || []
  )
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>(
    interaction?.quiz_answers || {}
  )
  const [startTime, setStartTime] = useState(Date.now())

  const containerRef = useRef<HTMLDivElement>(null)

  // Current chapter
  const currentChapter = chapters[currentIndex]
  const isFirstChapter = currentIndex === 0
  const isLastChapter = currentIndex === chapters.length - 1

  // Navigate to chapter
  const goToChapter = useCallback(
    (index: number) => {
      if (index < 0 || index >= chapters.length) return

      // Track time spent on current chapter
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      onTrackInteraction?.({
        chapter_index: currentIndex,
        time_spent: timeSpent,
      })

      // Update state
      setCurrentIndex(index)
      setChapterProgress(0)
      setStartTime(Date.now())

      // Mark previous chapter as completed if going forward
      if (index > currentIndex && !completedChapters.includes(currentIndex)) {
        setCompletedChapters((prev) => [...prev, currentIndex])
      }
    },
    [chapters.length, currentIndex, startTime, completedChapters, onTrackInteraction]
  )

  // Navigation handlers
  const goNext = useCallback(() => {
    if (isLastChapter) {
      // Story completed
      onTrackInteraction?.({
        chapter_index: currentIndex,
        time_spent: Math.round((Date.now() - startTime) / 1000),
        completed: true,
      })
      onClose?.()
    } else {
      goToChapter(currentIndex + 1)
    }
  }, [isLastChapter, currentIndex, startTime, goToChapter, onTrackInteraction, onClose])

  const goPrev = useCallback(() => {
    if (!isFirstChapter) {
      goToChapter(currentIndex - 1)
    }
  }, [isFirstChapter, currentIndex, goToChapter])

  // Handle quiz answer
  const handleQuizAnswer = useCallback(
    (answer: QuizAnswer) => {
      setQuizAnswers((prev) => ({
        ...prev,
        [answer.chapter_id]: answer.selected_option_id,
      }))
      onTrackInteraction?.({
        chapter_index: currentIndex,
        quiz_answer: answer,
      })
    },
    [currentIndex, onTrackInteraction]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          goNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goPrev()
          break
        case 'Escape':
          e.preventDefault()
          onClose?.()
          break
        case 'p':
          e.preventDefault()
          setIsPaused((prev) => !prev)
          break
        case 'm':
          e.preventDefault()
          setIsMuted((prev) => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, onClose])

  // Click navigation (left/right sides of screen)
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('.interactive-content')) {
        return // Don't navigate when clicking buttons or interactive elements
      }

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const clickX = e.clientX - rect.left
      const third = rect.width / 3

      if (clickX < third) {
        goPrev()
      } else if (clickX > third * 2) {
        goNext()
      } else {
        // Middle third - toggle pause
        setIsPaused((prev) => !prev)
      }
    },
    [goPrev, goNext]
  )

  // Track initial view
  useEffect(() => {
    onTrackInteraction?.({
      chapter_index: currentIndex,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentChapter) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 bg-black flex flex-col',
        className
      )}
      onClick={handleContainerClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 pb-8">
        {/* Progress bar */}
        <StoryProgress
          totalChapters={chapters.length}
          currentIndex={currentIndex}
          completedChapters={completedChapters}
          chapterProgress={isPaused ? chapterProgress : chapterProgress}
          onSegmentClick={goToChapter}
          className="mb-4"
        />

        {/* Story info and controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {story.cover_image && (
              <img
                src={story.cover_image}
                alt=""
                className="w-10 h-10 rounded-full object-cover border-2 border-white"
              />
            )}
            <div className="text-white">
              <h1 className="font-semibold text-sm truncate max-w-[200px]">
                {story.title}
              </h1>
              {story.product_name && (
                <p className="text-xs text-white/70">{story.product_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pause/Play */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                setIsPaused((prev) => !prev)
              }}
              className="text-white hover:bg-white/20"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>

            {/* Mute/Unmute */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                setIsMuted((prev) => !prev)
              }}
              className="text-white hover:bg-white/20"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>

            {/* Share */}
            {onShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onShare()
                }}
                className="text-white hover:bg-white/20"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            )}

            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onClose?.()
              }}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chapter content */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ opacity: isPaused ? 0.7 : 1 }}
        >
          <StoryChapter
            chapter={currentChapter}
            isActive={!isPaused}
            isCompleted={completedChapters.includes(currentIndex)}
            onQuizAnswer={handleQuizAnswer}
            selectedQuizAnswer={quizAnswers[currentChapter.id]}
            onAutoAdvance={goNext}
            onProgress={setChapterProgress}
            className="interactive-content"
          />
        </div>

        {/* Pause overlay */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Pause className="w-10 h-10 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation arrows (larger screens) */}
      <div className="hidden md:flex absolute left-0 right-0 top-1/2 -translate-y-1/2 justify-between px-4 pointer-events-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
          disabled={isFirstChapter}
          className={cn(
            'pointer-events-auto text-white hover:bg-white/20 w-12 h-12',
            isFirstChapter && 'opacity-0'
          )}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
          className="pointer-events-auto text-white hover:bg-white/20 w-12 h-12"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      </div>

      {/* Chapter counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {currentIndex + 1} / {chapters.length}
      </div>
    </div>
  )
}

export default StoryViewer
