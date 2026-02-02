/**
 * StoryCard Component
 *
 * Preview card for a story, showing cover image, title,
 * and basic metrics. Used in listings and grids.
 */

import { Play, Eye, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ProductStory } from '@/types/product-stories'

export interface StoryCardProps {
  /** Story data */
  story: ProductStory
  /** Click handler */
  onClick?: () => void
  /** Show edit controls */
  showEditControls?: boolean
  /** Edit handler */
  onEdit?: () => void
  /** Delete handler */
  onDelete?: () => void
  /** Card size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional class names */
  className?: string
}

export function StoryCard({
  story,
  onClick,
  showEditControls = false,
  onEdit,
  onDelete,
  size = 'md',
  className,
}: StoryCardProps) {
  const sizeClasses = {
    sm: 'w-32 h-44',
    md: 'w-48 h-64',
    lg: 'w-64 h-80',
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m`
  }

  const completionRate =
    story.view_count > 0
      ? Math.round((story.completion_count / story.view_count) * 100)
      : 0

  return (
    <div
      className={cn(
        'relative group rounded-xl overflow-hidden cursor-pointer transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-xl',
        sizeClasses[size],
        className
      )}
      onClick={onClick}
    >
      {/* Background image */}
      {story.cover_image ? (
        <img
          src={story.cover_image}
          alt={story.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Status badge */}
      <div className="absolute top-2 left-2">
        {story.status === 'published' ? (
          <Badge className="bg-green-500/90 text-white text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Опубликовано
          </Badge>
        ) : story.status === 'draft' ? (
          <Badge variant="secondary" className="text-xs">
            Черновик
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-black/50 text-white">
            В архиве
          </Badge>
        )}
      </div>

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <Play className="w-6 h-6 text-black ml-1" />
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">
          {story.title}
        </h3>

        {story.product_name && (
          <p className="text-white/70 text-xs truncate mb-2">
            {story.product_name}
          </p>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-3 text-white/60 text-xs">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {story.view_count}
          </span>
          {story.avg_time_spent_seconds > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(story.avg_time_spent_seconds)}
            </span>
          )}
          {completionRate > 0 && (
            <span className="text-green-400">
              {completionRate}% завершено
            </span>
          )}
        </div>
      </div>

      {/* Ring indicator (like Instagram stories) */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl ring-2 ring-inset pointer-events-none',
          story.status === 'published' ? 'ring-primary/50' : 'ring-transparent'
        )}
      />

      {/* Edit controls */}
      {showEditControls && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white text-black transition-colors"
              aria-label="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1.5 rounded-full bg-red-500/90 hover:bg-red-500 text-white transition-colors"
              aria-label="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default StoryCard
