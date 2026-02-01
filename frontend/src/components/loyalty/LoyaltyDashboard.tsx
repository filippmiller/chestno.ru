/**
 * Loyalty Dashboard Component
 *
 * Displays user's loyalty profile including:
 * - Current tier badge and points
 * - Progress bar to next tier
 * - Stats (reviews, helpful votes, streaks)
 * - Recent transactions
 */
import { useEffect, useState } from 'react'
import {
  Award,
  Flame,
  Star,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { httpClient } from '@/api/httpClient'
import type {
  LoyaltyTier,
  PointsTransaction,
  UserLoyaltyProfile,
  UserLoyaltyResponse,
} from '@/types/loyalty'
import { ACTION_DISPLAY_NAMES, TIER_CONFIG } from '@/types/loyalty'

// Tier icons
const TIER_ICONS: Record<LoyaltyTier, typeof Trophy> = {
  bronze: Award,
  silver: Star,
  gold: Trophy,
  platinum: Zap,
}

interface LoyaltyDashboardProps {
  className?: string
}

export function LoyaltyDashboard({ className }: LoyaltyDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserLoyaltyProfile | null>(null)
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])

  useEffect(() => {
    fetchLoyaltyData()
  }, [])

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await httpClient.get<UserLoyaltyResponse>('/api/v1/loyalty/me')
      setProfile(response.data.profile)
      setTransactions(response.data.recent_transactions)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки данных'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`rounded-lg border bg-card p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 rounded bg-muted" />
            <div className="h-20 rounded bg-muted" />
            <div className="h-20 rounded bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-lg border bg-card p-6 ${className}`}>
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchLoyaltyData}>
          Повторить
        </Button>
      </div>
    )
  }

  if (!profile) return null

  const tierConfig = TIER_CONFIG[profile.current_tier]
  const TierIcon = TIER_ICONS[profile.current_tier]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Tier Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Tier Badge */}
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${tierConfig.badge_color}20` }}
            >
              <TierIcon
                className="h-8 w-8"
                style={{ color: tierConfig.badge_color }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{tierConfig.badge_name_ru}</h2>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: tierConfig.badge_color }}
                >
                  ×{tierConfig.points_multiplier}
                </span>
              </div>
              <p className="text-3xl font-bold text-primary">
                {profile.total_points.toLocaleString()} баллов
              </p>
            </div>
          </div>

          <div className="text-right text-sm text-muted-foreground">
            <p>Всего заработано</p>
            <p className="text-lg font-semibold text-foreground">
              {profile.lifetime_points.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress to Next Tier */}
        {profile.next_tier && (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">
                До уровня {TIER_CONFIG[profile.next_tier].badge_name_ru}
              </span>
              <span className="font-medium">
                {profile.points_to_next_tier} баллов
              </span>
            </div>
            <Progress value={profile.tier_progress_percent} className="h-2" />
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Star className="h-5 w-5 text-yellow-500" />}
          label="Отзывов"
          value={profile.review_count}
        />
        <StatCard
          icon={<ThumbsUp className="h-5 w-5 text-blue-500" />}
          label="Полезных"
          value={profile.helpful_votes_received}
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          label="Текущий стрик"
          value={`${profile.current_streak_weeks} нед.`}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          label="Лучший стрик"
          value={`${profile.longest_streak_weeks} нед.`}
        />
      </div>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Последние начисления</h3>
          </div>
          <div className="divide-y">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

interface TransactionRowProps {
  transaction: PointsTransaction
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const isPositive = transaction.points > 0
  const displayName =
    transaction.description ||
    ACTION_DISPLAY_NAMES[transaction.action_type] ||
    transaction.action_type

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="font-medium">{displayName}</p>
        <p className="text-sm text-muted-foreground">
          {new Date(transaction.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <span
        className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}
      >
        {isPositive ? '+' : ''}
        {transaction.points}
      </span>
    </div>
  )
}

export default LoyaltyDashboard
