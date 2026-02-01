/**
 * TrustScoreBadge Component
 *
 * Displays a personalized trust score with visual indicator.
 * Shows how well a product/organization matches user preferences.
 */

import { cn } from '@/lib/utils'
import { getTrustScoreColor, getTrustScoreLabel } from '@/types/trust-preferences'

interface TrustScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showPercentage?: boolean
  className?: string
  lang?: 'ru' | 'en'
}

export function TrustScoreBadge({
  score,
  size = 'md',
  showLabel = true,
  showPercentage = true,
  className,
  lang = 'ru',
}: TrustScoreBadgeProps) {
  const color = getTrustScoreColor(score)
  const label = getTrustScoreLabel(score, lang)

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
  }

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Circular score indicator */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full font-semibold text-white',
          sizeClasses[size]
        )}
        style={{ backgroundColor: color }}
      >
        {showPercentage ? score : null}
        {/* Progress ring for visual emphasis */}
        <svg
          className="absolute inset-0"
          viewBox="0 0 36 36"
        >
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white/20"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${score}, 100`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            className="text-white/50"
          />
        </svg>
      </div>

      {/* Label */}
      {showLabel && (
        <span
          className={cn('font-medium', labelSizeClasses[size])}
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

// =============================================================================
// Compact inline version
// =============================================================================

interface TrustScoreInlineProps {
  score: number
  className?: string
}

export function TrustScoreInline({ score, className }: TrustScoreInlineProps) {
  const color = getTrustScoreColor(score)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      {score}%
    </span>
  )
}

// =============================================================================
// Match indicator showing how factors align
// =============================================================================

interface TrustMatchIndicatorProps {
  matchCount: number
  totalFactors: number
  className?: string
  lang?: 'ru' | 'en'
}

export function TrustMatchIndicator({
  matchCount,
  totalFactors,
  className,
  lang = 'ru',
}: TrustMatchIndicatorProps) {
  const percentage = totalFactors > 0 ? Math.round((matchCount / totalFactors) * 100) : 0
  const color = getTrustScoreColor(percentage)

  const matchLabel = lang === 'ru'
    ? `${matchCount} из ${totalFactors} совпадений`
    : `${matchCount} of ${totalFactors} matches`

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Visual dots */}
      <div className="flex gap-0.5">
        {Array.from({ length: Math.min(totalFactors, 5) }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              i < matchCount ? 'opacity-100' : 'opacity-30'
            )}
            style={{ backgroundColor: i < matchCount ? color : '#9CA3AF' }}
          />
        ))}
      </div>

      {/* Label */}
      <span className="text-xs text-gray-500">{matchLabel}</span>
    </div>
  )
}
