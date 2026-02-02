/**
 * StoryProgress Component
 *
 * Progress indicator for story chapters showing current position
 * and completion status. Features animated transitions and
 * clickable segments for navigation.
 */

import { cn } from '@/lib/utils'

export interface StoryProgressProps {
  /** Total number of chapters */
  totalChapters: number
  /** Current chapter index (0-based) */
  currentIndex: number
  /** Indices of completed chapters */
  completedChapters?: number[]
  /** Progress within current chapter (0-1) */
  chapterProgress?: number
  /** Callback when segment is clicked */
  onSegmentClick?: (index: number) => void
  /** Show as vertical instead of horizontal */
  vertical?: boolean
  /** Additional class names */
  className?: string
}

export function StoryProgress({
  totalChapters,
  currentIndex,
  completedChapters = [],
  chapterProgress = 0,
  onSegmentClick,
  vertical = false,
  className,
}: StoryProgressProps) {
  if (totalChapters <= 0) return null

  return (
    <div
      className={cn(
        'flex gap-1',
        vertical ? 'flex-col h-full' : 'flex-row w-full',
        className
      )}
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={totalChapters}
      aria-label={`Chapter ${currentIndex + 1} of ${totalChapters}`}
    >
      {Array.from({ length: totalChapters }).map((_, index) => {
        const isCompleted = completedChapters.includes(index)
        const isCurrent = index === currentIndex
        const isPast = index < currentIndex

        return (
          <button
            key={index}
            type="button"
            onClick={() => onSegmentClick?.(index)}
            disabled={!onSegmentClick}
            className={cn(
              'relative overflow-hidden rounded-full transition-all duration-200',
              vertical ? 'w-1 flex-1' : 'h-1 flex-1',
              onSegmentClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
              // Base background
              'bg-white/30'
            )}
            aria-label={`Go to chapter ${index + 1}`}
          >
            {/* Fill indicator */}
            <div
              className={cn(
                'absolute inset-0 rounded-full transition-all duration-300',
                vertical ? 'origin-top' : 'origin-left',
                // Completed or past chapters
                (isCompleted || isPast) && 'bg-white',
                // Current chapter with progress
                isCurrent && 'bg-white'
              )}
              style={{
                // For current chapter, show progress
                // For completed/past, show full
                // For future, show nothing
                ...(isCurrent
                  ? vertical
                    ? { height: `${chapterProgress * 100}%` }
                    : { width: `${chapterProgress * 100}%` }
                  : isCompleted || isPast
                  ? vertical
                    ? { height: '100%' }
                    : { width: '100%' }
                  : vertical
                  ? { height: '0%' }
                  : { width: '0%' }),
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

export default StoryProgress
