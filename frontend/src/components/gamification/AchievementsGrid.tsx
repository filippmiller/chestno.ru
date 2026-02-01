/**
 * Achievements Grid Component
 *
 * Displays all achievements in a categorized grid,
 * showing earned vs locked status with progress.
 */
import { useState } from 'react'
import { Filter, Lock, Trophy, Unlock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type {
  AchievementRarity,
  QrAchievement,
  UserQrAchievement,
} from '@/types/qr-gamification'
import { RARITY_COLORS, RARITY_LABELS_RU } from '@/types/qr-gamification'
import { AchievementBadge } from './AchievementBadge'

type FilterOption = 'all' | 'earned' | 'locked' | AchievementRarity

interface AchievementsGridProps {
  achievements: QrAchievement[]
  userAchievements: UserQrAchievement[]
  progress: Record<string, { current: number; required: number }>
  onAchievementClick?: (achievement: QrAchievement) => void
  className?: string
}

export function AchievementsGrid({
  achievements,
  userAchievements,
  progress,
  onAchievementClick,
  className = '',
}: AchievementsGridProps) {
  const [filter, setFilter] = useState<FilterOption>('all')

  // Create lookup for earned achievements
  const earnedMap = new Map(
    userAchievements.map((ua) => [ua.achievement_id, ua])
  )

  // Filter achievements
  const filteredAchievements = achievements.filter((a) => {
    const isEarned = earnedMap.has(a.id)

    switch (filter) {
      case 'earned':
        return isEarned
      case 'locked':
        return !isEarned
      case 'common':
      case 'uncommon':
      case 'rare':
      case 'epic':
      case 'legendary':
        return a.rarity === filter
      default:
        return true
    }
  })

  // Sort: earned first, then by sort_order
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aEarned = earnedMap.has(a.id)
    const bEarned = earnedMap.has(b.id)
    if (aEarned !== bEarned) return bEarned ? 1 : -1
    return a.sort_order - b.sort_order
  })

  // Stats
  const earnedCount = userAchievements.length
  const totalCount = achievements.length
  const progressPercent = Math.round((earnedCount / totalCount) * 100)

  // Group by category for display
  const tierAchievements = sortedAchievements.filter((a) =>
    a.code.startsWith('tier_')
  )
  const explorerAchievements = sortedAchievements.filter((a) =>
    a.code.includes('explorer')
  )
  const streakAchievements = sortedAchievements.filter((a) =>
    a.code.includes('streak')
  )
  const specialAchievements = sortedAchievements.filter(
    (a) =>
      !a.code.startsWith('tier_') &&
      !a.code.includes('explorer') &&
      !a.code.includes('streak')
  )

  const filterOptions: { value: FilterOption; label: string; color?: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'earned', label: 'Получено' },
    { value: 'locked', label: 'Заблокировано' },
    { value: 'common', label: 'Обычные', color: RARITY_COLORS.common },
    { value: 'uncommon', label: 'Необычные', color: RARITY_COLORS.uncommon },
    { value: 'rare', label: 'Редкие', color: RARITY_COLORS.rare },
    { value: 'epic', label: 'Эпические', color: RARITY_COLORS.epic },
    { value: 'legendary', label: 'Легендарные', color: RARITY_COLORS.legendary },
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Достижения</h3>
          <p className="text-sm text-muted-foreground">
            {earnedCount} из {totalCount} ({progressPercent}%)
          </p>
        </div>

        {/* Overall progress bar */}
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <Trophy className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(option.value)}
            className="h-7 text-xs"
            style={
              option.color && filter === option.value
                ? { borderColor: option.color, color: option.color }
                : undefined
            }
          >
            {option.value === 'earned' && <Unlock className="mr-1 h-3 w-3" />}
            {option.value === 'locked' && <Lock className="mr-1 h-3 w-3" />}
            {option.label}
          </Button>
        ))}
      </div>

      {/* Achievement sections */}
      {tierAchievements.length > 0 && (
        <AchievementSection
          title="Уровни сканера"
          description="Достигайте новых уровней, сканируя больше QR-кодов"
          achievements={tierAchievements}
          earnedMap={earnedMap}
          progress={progress}
          onAchievementClick={onAchievementClick}
        />
      )}

      {explorerAchievements.length > 0 && (
        <AchievementSection
          title="Исследователь"
          description="Открывайте товары разных компаний"
          achievements={explorerAchievements}
          earnedMap={earnedMap}
          progress={progress}
          onAchievementClick={onAchievementClick}
        />
      )}

      {streakAchievements.length > 0 && (
        <AchievementSection
          title="Стрики"
          description="Сканируйте регулярно, чтобы поддерживать стрик"
          achievements={streakAchievements}
          earnedMap={earnedMap}
          progress={progress}
          onAchievementClick={onAchievementClick}
        />
      )}

      {specialAchievements.length > 0 && (
        <AchievementSection
          title="Особые"
          description="Уникальные достижения за особые действия"
          achievements={specialAchievements}
          earnedMap={earnedMap}
          progress={progress}
          onAchievementClick={onAchievementClick}
        />
      )}

      {sortedAchievements.length === 0 && (
        <div className="rounded-lg border bg-muted/30 py-12 text-center">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">
            Нет достижений по выбранному фильтру
          </p>
        </div>
      )}
    </div>
  )
}

interface AchievementSectionProps {
  title: string
  description: string
  achievements: QrAchievement[]
  earnedMap: Map<string, UserQrAchievement>
  progress: Record<string, { current: number; required: number }>
  onAchievementClick?: (achievement: QrAchievement) => void
}

function AchievementSection({
  title,
  description,
  achievements,
  earnedMap,
  progress,
  onAchievementClick,
}: AchievementSectionProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-4">
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        {achievements.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
            userAchievement={earnedMap.get(achievement.id)}
            progress={progress[achievement.id]}
            size="md"
            onClick={
              onAchievementClick
                ? () => onAchievementClick(achievement)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}

export default AchievementsGrid
