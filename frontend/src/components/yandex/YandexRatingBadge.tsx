/**
 * Yandex Rating Badge Component
 *
 * Displays Yandex Maps rating for an organization.
 * Shows only when the Yandex profile is verified and has a rating.
 */
import { ExternalLink, Star } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface YandexRatingBadgeProps {
  rating: number
  reviewCount?: number
  yandexUrl?: string
  size?: 'sm' | 'md' | 'lg'
  showReviewCount?: boolean
  className?: string
}

// Yandex brand colors
const YANDEX_RED = '#FC3F1D'

export function YandexRatingBadge({
  rating,
  reviewCount,
  yandexUrl,
  size = 'md',
  showReviewCount = true,
  className = '',
}: YandexRatingBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const badge = (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border bg-white shadow-sm ${sizeClasses[size]} ${className}`}
      style={{ borderColor: `${YANDEX_RED}30` }}
    >
      {/* Yandex Logo */}
      <svg
        viewBox="0 0 24 24"
        className={iconSizes[size]}
        fill={YANDEX_RED}
      >
        <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm9.5-6.5v13h2v-5.5h1.5l2.5 5.5h2.5l-3-6c1.5-.5 2.5-1.7 2.5-3.5 0-2.5-2-4-4.5-4h-3.5zm2 2h1.5c1.5 0 2.5.8 2.5 2s-1 2-2.5 2h-1.5v-4z" />
      </svg>

      {/* Rating */}
      <div className="flex items-center gap-0.5">
        <Star className={`${iconSizes[size]} fill-yellow-400 text-yellow-400`} />
        <span className="font-semibold">{rating.toFixed(1)}</span>
      </div>

      {/* Review count */}
      {showReviewCount && reviewCount !== undefined && (
        <span className="text-muted-foreground">
          ({reviewCount})
        </span>
      )}

      {/* External link indicator */}
      {yandexUrl && (
        <ExternalLink className={`${iconSizes[size]} text-muted-foreground`} />
      )}
    </div>
  )

  if (yandexUrl) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={yandexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block hover:opacity-80 transition-opacity"
            >
              {badge}
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>Открыть на Яндекс Картах</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}

export default YandexRatingBadge
