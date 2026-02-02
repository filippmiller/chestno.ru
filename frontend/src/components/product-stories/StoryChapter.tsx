/**
 * StoryChapter Component
 *
 * Renders a single chapter of a story based on its content type.
 * Supports TEXT, IMAGE, VIDEO, GALLERY, and QUIZ content types.
 */

import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { StoryChapter as StoryChapterType, QuizOption, QuizAnswer } from '@/types/product-stories'

export interface StoryChapterProps {
  /** Chapter data */
  chapter: StoryChapterType
  /** Whether this chapter is currently active */
  isActive?: boolean
  /** Whether chapter is completed */
  isCompleted?: boolean
  /** Callback when quiz is answered */
  onQuizAnswer?: (answer: QuizAnswer) => void
  /** Previously selected quiz answer (if any) */
  selectedQuizAnswer?: string | null
  /** Auto-advance callback when chapter duration expires */
  onAutoAdvance?: () => void
  /** Progress callback (0-1) */
  onProgress?: (progress: number) => void
  /** Additional class names */
  className?: string
}

export function StoryChapter({
  chapter,
  isActive = false,
  isCompleted = false,
  onQuizAnswer,
  selectedQuizAnswer,
  onAutoAdvance,
  onProgress,
  className,
}: StoryChapterProps) {
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0)
  const [localSelectedAnswer, setLocalSelectedAnswer] = useState<string | null>(selectedQuizAnswer || null)
  const [showExplanation, setShowExplanation] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressIntervalRef = useRef<number>()

  // Handle auto-advance for non-video content
  useEffect(() => {
    if (!isActive || chapter.content_type === 'VIDEO' || chapter.content_type === 'QUIZ') {
      return
    }

    const duration = chapter.duration_seconds * 1000
    const startTime = Date.now()

    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      onProgress?.(progress)

      if (progress >= 1) {
        clearInterval(progressIntervalRef.current)
        onAutoAdvance?.()
      }
    }, 100)

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [isActive, chapter.content_type, chapter.duration_seconds, onAutoAdvance, onProgress])

  // Handle video progress
  useEffect(() => {
    if (!isActive || chapter.content_type !== 'VIDEO' || !videoRef.current) {
      return
    }

    const video = videoRef.current

    const handleTimeUpdate = () => {
      if (video.duration) {
        onProgress?.(video.currentTime / video.duration)
      }
    }

    const handleEnded = () => {
      onProgress?.(1)
      onAutoAdvance?.()
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    // Auto-play when active
    video.play().catch(() => {
      // Autoplay blocked
    })

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.pause()
    }
  }, [isActive, chapter.content_type, onAutoAdvance, onProgress])

  // Reset state when chapter changes
  useEffect(() => {
    setCurrentGalleryIndex(0)
    setLocalSelectedAnswer(selectedQuizAnswer || null)
    setShowExplanation(!!selectedQuizAnswer)
  }, [chapter.id, selectedQuizAnswer])

  // Handle quiz answer
  const handleQuizAnswer = (option: QuizOption) => {
    if (localSelectedAnswer) return // Already answered

    setLocalSelectedAnswer(option.id)
    setShowExplanation(true)
    onQuizAnswer?.({
      chapter_id: chapter.id,
      selected_option_id: option.id,
    })

    // Auto-advance after showing explanation
    setTimeout(() => {
      onProgress?.(1)
      onAutoAdvance?.()
    }, 3000)
  }

  // Gallery navigation
  const galleryImages = chapter.media_urls || []
  const nextGalleryImage = () => {
    setCurrentGalleryIndex((prev) => (prev + 1) % galleryImages.length)
  }
  const prevGalleryImage = () => {
    setCurrentGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
  }

  // Styles from chapter
  const containerStyle: React.CSSProperties = {
    backgroundColor: chapter.background_color || undefined,
    color: chapter.text_color || undefined,
  }

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center w-full h-full p-6',
        !isActive && 'pointer-events-none',
        className
      )}
      style={containerStyle}
    >
      {/* TEXT Content */}
      {chapter.content_type === 'TEXT' && (
        <div className="max-w-2xl mx-auto text-center space-y-4">
          {chapter.title && (
            <h2 className="text-2xl md:text-3xl font-bold">{chapter.title}</h2>
          )}
          {chapter.content && (
            <p className="text-lg md:text-xl leading-relaxed whitespace-pre-wrap">
              {chapter.content}
            </p>
          )}
        </div>
      )}

      {/* IMAGE Content */}
      {chapter.content_type === 'IMAGE' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          {chapter.media_url && (
            <img
              src={chapter.media_url}
              alt={chapter.title || 'Story image'}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
            />
          )}
          {(chapter.title || chapter.content) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-12">
              {chapter.title && (
                <h3 className="text-xl font-bold text-white mb-2">{chapter.title}</h3>
              )}
              {chapter.content && (
                <p className="text-white/90">{chapter.content}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIDEO Content */}
      {chapter.content_type === 'VIDEO' && (
        <div className="relative w-full h-full flex items-center justify-center">
          {chapter.media_url && (
            <video
              ref={videoRef}
              src={chapter.media_url}
              className="max-w-full max-h-full rounded-lg"
              playsInline
              muted
              controls={false}
            />
          )}
          {(chapter.title || chapter.content) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-12">
              {chapter.title && (
                <h3 className="text-xl font-bold text-white mb-2">{chapter.title}</h3>
              )}
              {chapter.content && (
                <p className="text-white/90">{chapter.content}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* GALLERY Content */}
      {chapter.content_type === 'GALLERY' && galleryImages.length > 0 && (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <div className="relative w-full max-w-4xl">
            <img
              src={galleryImages[currentGalleryIndex]}
              alt={`${chapter.title || 'Gallery'} - Image ${currentGalleryIndex + 1}`}
              className="w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
            />

            {/* Gallery navigation */}
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={prevGalleryImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextGalleryImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                {/* Gallery dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {galleryImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentGalleryIndex(idx)}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all',
                        idx === currentGalleryIndex ? 'bg-white scale-125' : 'bg-white/50'
                      )}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {(chapter.title || chapter.content) && (
            <div className="mt-4 text-center max-w-2xl">
              {chapter.title && (
                <h3 className="text-xl font-bold mb-2">{chapter.title}</h3>
              )}
              {chapter.content && (
                <p className="text-muted-foreground">{chapter.content}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* QUIZ Content */}
      {chapter.content_type === 'QUIZ' && (
        <div className="max-w-2xl mx-auto w-full space-y-6">
          {chapter.title && (
            <h2 className="text-2xl font-bold text-center">{chapter.title}</h2>
          )}

          {chapter.quiz_question && (
            <p className="text-xl text-center">{chapter.quiz_question}</p>
          )}

          {chapter.quiz_options && (
            <div className="space-y-3">
              {chapter.quiz_options.map((option) => {
                const isSelected = localSelectedAnswer === option.id
                const showResult = !!localSelectedAnswer
                const isCorrect = option.is_correct

                return (
                  <Button
                    key={option.id}
                    variant="outline"
                    onClick={() => handleQuizAnswer(option)}
                    disabled={!!localSelectedAnswer}
                    className={cn(
                      'w-full justify-start text-left py-4 px-6 h-auto text-base transition-all',
                      showResult && isSelected && isCorrect && 'border-green-500 bg-green-50 dark:bg-green-900/20',
                      showResult && isSelected && !isCorrect && 'border-red-500 bg-red-50 dark:bg-red-900/20',
                      showResult && !isSelected && isCorrect && 'border-green-500/50',
                      !showResult && 'hover:bg-primary/5'
                    )}
                  >
                    <span className="mr-3">
                      {showResult ? (
                        isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : isSelected ? (
                          <Circle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </span>
                    {option.text}
                  </Button>
                )
              })}
            </div>
          )}

          {/* Quiz explanation */}
          {showExplanation && chapter.quiz_explanation && (
            <div className="mt-6 p-4 rounded-lg bg-muted/50 animate-in fade-in slide-in-from-bottom-2">
              <p className="text-sm text-muted-foreground">
                <strong>Explanation:</strong> {chapter.quiz_explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Completion indicator */}
      {isCompleted && (
        <div className="absolute top-4 right-4">
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        </div>
      )}
    </div>
  )
}

export default StoryChapter
