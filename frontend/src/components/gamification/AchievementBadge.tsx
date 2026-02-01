/**
 * Achievement Badge Component
 *
 * Displays a single achievement with its rarity, icon, and status.
 * Can show locked/unlocked states and progress toward earning.
 */
import {
  Award,
  Calendar,
  Compass,
  Crown,
  Flame,
  Globe,
  Map,
  MessageSquare,
  Moon,
  Scan,
  Star,
  Sunrise,
  Trophy,
  Zap,
} from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  AchievementRarity,
  QrAchievement,
  UserQrAchievement,
} from '@/types/qr-gamification'
import { RARITY_COLORS, RARITY_LABELS_RU } from '@/types/qr-gamification'

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  award: Award,
  star: Star,
  trophy: Trophy,
  scan: Scan,
  'message-square': MessageSquare,
  compass: Compass,
  map: Map,
  globe: Globe,
  flame: Flame,
  zap: Zap,
  crown: Crown,
  moon: Moon,
  sunrise: Sunrise,
  calendar: Calendar,
}

interface AchievementBadgeProps {
  achievement: QrAchievement
  userAchievement?: UserQrAchievement
  progress?: { current: number; required: number }
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  onClick?: () => void
  className?: string
}

export function AchievementBadge({
  achievement,
  userAchievement,
  progress,
  size = 'md',
  showTooltip = true,
  onClick,
  className = '',
}: AchievementBadgeProps) {
  const isEarned = !!userAchievement
  const isNew = userAchievement && !userAchievement.is_seen
  const Icon = ICON_MAP[achievement.icon] || Trophy

  const sizeConfig = {
    sm: { container: 'h-12 w-12', icon: 'h-5 w-5', ring: 2 },
    md: { container: 'h-16 w-16', icon: 'h-7 w-7', ring: 3 },
    lg: { container: 'h-20 w-20', icon: 'h-9 w-9', ring: 4 },
  }

  const sizes = sizeConfig[size]
  const rarityColor = RARITY_COLORS[achievement.rarity]

  const badge = (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        group relative flex flex-col items-center gap-1
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${className}
      `}
    >
      {/* Badge container */}
      <div
        className={`
          relative flex items-center justify-center rounded-full
          ${sizes.container}
          ${isEarned ? '' : 'grayscale opacity-40'}
          transition-all duration-200
          ${onClick ? 'group-hover:scale-105' : ''}
        `}
        style={{
          backgroundColor: isEarned ? `${achievement.badge_color}20` : '#6B728015',
          boxShadow: isEarned
            ? `0 0 0 ${sizes.ring}px ${achievement.badge_color}40, 0 4px 12px ${achievement.badge_color}20`
            : undefined,
        }}
      >
        {/* Rarity ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${sizes.ring}px solid ${isEarned ? rarityColor : '#6B728030'}`,
          }}
        />

        {/* Icon */}
        <Icon
          className={sizes.icon}
          style={{ color: isEarned ? achievement.badge_color : '#6B7280' }}
        />

        {/* New indicator */}
        {isNew && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            !
          </span>
        )}

        {/* Progress ring (for unearned) */}
        {!isEarned && progress && progress.required > 0 && (
          <svg
            className="absolute inset-0 -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={achievement.badge_color}
              strokeWidth="4"
              strokeDasharray={`${(progress.current / progress.required) * 289} 289`}
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
        )}
      </div>

      {/* Points reward indicator */}
      {achievement.points_reward > 0 && (
        <span
          className={`
            text-[10px] font-medium
            ${isEarned ? 'text-muted-foreground' : 'text-muted-foreground/50'}
          `}
        >
          +{achievement.points_reward}
        </span>
      )}
    </button>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{achievement.name_ru}</p>
                <p
                  className="text-xs font-medium"
                  style={{ color: rarityColor }}
                >
                  {RARITY_LABELS_RU[achievement.rarity]}
                </p>
              </div>
              {achievement.points_reward > 0 && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  +{achievement.points_reward}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground">
              {achievement.description_ru}
            </p>

            {/* Status */}
            {isEarned ? (
              <p className="text-xs text-green-600">
                Получено{' '}
                {new Date(userAchievement.earned_at).toLocaleDateString('ru-RU')}
              </p>
            ) : progress ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Прогресс</span>
                  <span className="font-medium">
                    {progress.current} / {progress.required}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (progress.current / progress.required) * 100)}%`,
                      backgroundColor: achievement.badge_color,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Еще не получено</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default AchievementBadge
