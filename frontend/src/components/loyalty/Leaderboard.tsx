/**
 * Leaderboard Component
 *
 * Shows top users by loyalty points with tier badges.
 * Supports different time periods (all-time, monthly, weekly).
 */
import { useEffect, useState } from 'react'
import { Crown, Medal, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { httpClient } from '@/api/httpClient'
import type { LeaderboardEntry, LeaderboardResponse } from '@/types/loyalty'
import { TierBadge } from './TierBadge'

type Period = 'all_time' | 'monthly' | 'weekly'

const PERIOD_LABELS: Record<Period, string> = {
  all_time: 'Все время',
  monthly: 'Месяц',
  weekly: 'Неделя',
}

interface LeaderboardProps {
  initialPeriod?: Period
  limit?: number
  showPeriodSelector?: boolean
  className?: string
}

export function Leaderboard({
  initialPeriod = 'all_time',
  limit = 10,
  showPeriodSelector = true,
  className = '',
}: LeaderboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [data, setData] = useState<LeaderboardResponse | null>(null)

  useEffect(() => {
    fetchLeaderboard()
  }, [period, limit])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await httpClient.get<LeaderboardResponse>(
        '/api/v1/loyalty/leaderboard',
        { params: { period, limit } }
      )
      setData(response.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Trophy className="h-5 w-5 text-amber-600" />
      default:
        return (
          <span className="flex h-5 w-5 items-center justify-center text-sm font-medium text-muted-foreground">
            {rank}
          </span>
        )
    }
  }

  if (error) {
    return (
      <div className={`rounded-lg border bg-card p-6 ${className}`}>
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchLeaderboard}>
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border bg-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Таблица лидеров</h3>

        {showPeriodSelector && (
          <div className="flex gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-5 w-5 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Entries */}
      {!loading && data && (
        <div className="divide-y">
          {data.entries.map((entry) => (
            <LeaderboardRow key={entry.user_id} entry={entry} />
          ))}

          {data.entries.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              Пока нет данных
            </div>
          )}
        </div>
      )}

      {/* User's Rank Footer */}
      {data?.user_rank && (
        <div className="border-t bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Ваша позиция:{' '}
            <span className="font-semibold text-foreground">#{data.user_rank}</span>
            {' '}из {data.total_users}
          </p>
        </div>
      )}
    </div>
  )
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry
}

function LeaderboardRow({ entry }: LeaderboardRowProps) {
  const isTopThree = entry.rank <= 3
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Trophy className="h-5 w-5 text-amber-600" />
      default:
        return (
          <span className="flex h-5 w-5 items-center justify-center text-sm font-medium text-muted-foreground">
            {rank}
          </span>
        )
    }
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        isTopThree ? 'bg-muted/30' : ''
      }`}
    >
      {/* Rank */}
      <div className="w-6">{getRankIcon(entry.rank)}</div>

      {/* Avatar */}
      {entry.avatar_url ? (
        <img
          src={entry.avatar_url}
          alt={entry.display_name}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {entry.display_name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name and Tier */}
      <div className="flex flex-1 items-center gap-2">
        <span className={`font-medium ${isTopThree ? 'text-foreground' : ''}`}>
          {entry.display_name}
        </span>
        <TierBadge tier={entry.tier} size="sm" />
      </div>

      {/* Stats */}
      <div className="text-right">
        <p className="font-semibold">{entry.total_points.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">
          {entry.review_count} отзывов
        </p>
      </div>
    </div>
  )
}

export default Leaderboard
