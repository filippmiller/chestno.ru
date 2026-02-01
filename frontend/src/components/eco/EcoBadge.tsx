import { cn } from '@/lib/utils'
import { Leaf, TrendingDown, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { EcoGrade, ProductEcoScore } from '@/types/eco'
import { ECO_GRADE_CONFIG } from '@/types/eco'

export interface EcoBadgeProps {
  grade: EcoGrade
  score?: number | null
  co2ReductionPercent?: number | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  showTooltip?: boolean
  variant?: 'badge' | 'card' | 'minimal'
  className?: string
}

const sizeConfig = {
  sm: {
    badge: 'w-8 h-8 text-xs',
    icon: 'w-3 h-3',
    label: 'text-[10px]',
  },
  md: {
    badge: 'w-10 h-10 text-sm',
    icon: 'w-4 h-4',
    label: 'text-xs',
  },
  lg: {
    badge: 'w-14 h-14 text-lg',
    icon: 'w-5 h-5',
    label: 'text-sm',
  },
  xl: {
    badge: 'w-20 h-20 text-2xl',
    icon: 'w-6 h-6',
    label: 'text-base',
  },
}

export function EcoBadge({
  grade,
  score,
  co2ReductionPercent,
  size = 'md',
  showLabel = false,
  showTooltip = true,
  variant = 'badge',
  className,
}: EcoBadgeProps) {
  const config = ECO_GRADE_CONFIG[grade]
  const sizeClass = sizeConfig[size]

  if (variant === 'minimal') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-medium',
          config.textColor,
          className
        )}
      >
        <Leaf className={sizeClass.icon} />
        <span>{grade}</span>
      </span>
    )
  }

  const badge = (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full border-2 font-bold transition-transform hover:scale-105',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClass.badge,
        className
      )}
      style={{
        boxShadow: `0 0 0 2px ${config.color}20`,
      }}
    >
      <span className="relative z-10">{grade}</span>
      {/* Leaf accent */}
      <Leaf
        className={cn(
          'absolute -top-1 -right-1 opacity-60',
          sizeClass.icon
        )}
        style={{ color: config.color }}
      />
    </div>
  )

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-3 rounded-lg border px-4 py-2',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        {badge}
        <div className="flex flex-col">
          <span className={cn('font-semibold', config.textColor)}>
            {config.label}
          </span>
          {score !== null && score !== undefined && (
            <span className="text-xs text-muted-foreground">
              {score}/100 баллов
            </span>
          )}
          {co2ReductionPercent !== null && co2ReductionPercent !== undefined && co2ReductionPercent > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <TrendingDown className="w-3 h-3" />
              {co2ReductionPercent}% меньше CO2
            </span>
          )}
        </div>
      </div>
    )
  }

  if (!showTooltip) {
    return (
      <div className={cn('inline-flex flex-col items-center gap-1', className)}>
        {badge}
        {showLabel && (
          <span className={cn('font-medium', config.textColor, sizeClass.label)}>
            {config.label}
          </span>
        )}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex flex-col items-center gap-1 cursor-help', className)}>
            {badge}
            {showLabel && (
              <span className={cn('font-medium', config.textColor, sizeClass.label)}>
                {config.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-xs"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn('text-lg font-bold', config.textColor)}>{grade}</span>
              <span className="font-semibold">{config.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {score !== null && score !== undefined && (
              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <span>Эко-рейтинг:</span>
                <span className="font-medium">{score}/100</span>
              </div>
            )}
            {co2ReductionPercent !== null && co2ReductionPercent !== undefined && co2ReductionPercent > 0 && (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <TrendingDown className="w-3 h-3" />
                <span>На {co2ReductionPercent}% меньше CO2, чем у импортных аналогов</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for lists
export function EcoBadgeCompact({
  grade,
  score,
  className,
}: {
  grade: EcoGrade
  score?: number | null
  className?: string
}) {
  const config = ECO_GRADE_CONFIG[grade]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        config.bgColor,
        config.textColor,
        config.borderColor,
        'border',
        className
      )}
    >
      <Leaf className="w-3 h-3" />
      <span>{grade}</span>
      {score !== null && score !== undefined && (
        <>
          <span className="opacity-50">|</span>
          <span>{score}</span>
        </>
      )}
    </div>
  )
}

// Score-only display (like energy rating bars)
export function EcoScoreBar({
  score,
  showAllGrades = true,
  highlightGrade,
  className,
}: {
  score?: number | null
  showAllGrades?: boolean
  highlightGrade?: EcoGrade
  className?: string
}) {
  const grades: EcoGrade[] = ['A+', 'A', 'B', 'C', 'D', 'E', 'F']

  // Determine which grade the score falls into
  const getGradeForScore = (s: number): EcoGrade => {
    if (s >= 90) return 'A+'
    if (s >= 80) return 'A'
    if (s >= 65) return 'B'
    if (s >= 50) return 'C'
    if (s >= 35) return 'D'
    if (s >= 20) return 'E'
    return 'F'
  }

  const currentGrade = score !== null && score !== undefined
    ? getGradeForScore(score)
    : highlightGrade || null

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {grades.map((grade, index) => {
        const config = ECO_GRADE_CONFIG[grade]
        const isActive = grade === currentGrade
        const width = 100 - (index * 10)

        return (
          <div
            key={grade}
            className={cn(
              'flex items-center gap-2 transition-all',
              isActive ? 'scale-105' : showAllGrades ? 'opacity-40' : 'hidden'
            )}
          >
            <span
              className={cn(
                'w-8 text-center text-xs font-bold py-0.5 rounded',
                isActive ? config.bgColor : 'bg-gray-100 dark:bg-gray-800',
                isActive ? config.textColor : 'text-gray-500'
              )}
            >
              {grade}
            </span>
            <div
              className={cn(
                'h-3 rounded transition-all',
                isActive ? 'opacity-100' : 'opacity-30'
              )}
              style={{
                width: `${width}%`,
                backgroundColor: config.color,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
