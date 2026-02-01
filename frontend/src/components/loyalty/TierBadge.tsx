/**
 * Compact Tier Badge Component
 *
 * Shows user's loyalty tier as a small badge.
 * Used in review cards, comments, user profiles.
 */
import { Award, Star, Trophy, Zap } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { LoyaltyTier } from '@/types/loyalty'
import { TIER_CONFIG } from '@/types/loyalty'

const TIER_ICONS: Record<LoyaltyTier, typeof Trophy> = {
  bronze: Award,
  silver: Star,
  gold: Trophy,
  platinum: Zap,
}

interface TierBadgeProps {
  tier: LoyaltyTier
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function TierBadge({
  tier,
  size = 'sm',
  showLabel = false,
  className = '',
}: TierBadgeProps) {
  const config = TIER_CONFIG[tier]
  const Icon = TIER_ICONS[tier]

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  const containerSizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  const badge = (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      style={{ color: config.badge_color }}
    >
      <div
        className={`flex items-center justify-center rounded-full ${containerSizes[size]}`}
        style={{ backgroundColor: `${config.badge_color}20` }}
      >
        <Icon className={sizeClasses[size]} />
      </div>
      {showLabel && (
        <span className="text-xs font-medium">{config.badge_name_ru}</span>
      )}
    </div>
  )

  if (showLabel) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.badge_name_ru}</p>
          <p className="text-xs text-muted-foreground">
            Множитель баллов: ×{config.points_multiplier}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default TierBadge
