/**
 * StaffLeaderboard Component
 *
 * Gamified staff engagement leaderboard showing top performers
 * based on customer assists and scan attributions.
 */
import { useEffect, useState } from 'react'
import {
  Award,
  Calendar,
  Crown,
  Medal,
  RefreshCw,
  Store,
  Trophy,
  Users,
  QrCode,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getStoreStaffLeaderboard, getGlobalStaffLeaderboard } from '@/api/staffService'
import type { StaffLeaderboardEntry, StaffLeaderboardResponse } from '@/types/retail'

interface StaffLeaderboardProps {
  storeId?: string
  initialPeriod?: 'all_time' | 'monthly' | 'weekly'
  limit?: number
  showPeriodSelector?: boolean
  highlightStaffId?: string
  className?: string
}

const PERIOD_CONFIG = {
  all_time: { label: 'Все время', icon: Trophy },
  monthly: { label: 'Месяц', icon: Calendar },
  weekly: { label: 'Неделя', icon: Calendar },
}

export function StaffLeaderboard({
  storeId,
  initialPeriod = 'monthly',
  limit = 10,
  showPeriodSelector = true,
  highlightStaffId,
  className = '',
}: StaffLeaderboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'all_time' | 'monthly' | 'weekly'>(initialPeriod)
  const [data, setData] = useState<StaffLeaderboardResponse | null>(null)

  const fetchLeaderboard = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = storeId
        ? await getStoreStaffLeaderboard(storeId, period, limit)
        : await getGlobalStaffLeaderboard(period, limit)
      setData(response)
    } catch (err) {
      console.error('Failed to load leaderboard:', err)
      setError('Не удалось загрузить таблицу лидеров')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [storeId, period, limit])

  // Get rank display (top 3 get special icons)
  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/20">
            <Crown className="h-6 w-6 text-yellow-500" />
          </div>
        )
      case 2:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300/30">
            <Medal className="h-6 w-6 text-gray-400" />
          </div>
        )
      case 3:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600/20">
            <Trophy className="h-6 w-6 text-amber-600" />
          </div>
        )
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center text-xl font-bold text-muted-foreground">
            {rank}
          </div>
        )
    }
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchLeaderboard}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Header */}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            {storeId ? 'Лидеры магазина' : 'Лучшие сотрудники'}
          </CardTitle>

          {showPeriodSelector && (
            <div className="flex gap-1">
              {(Object.keys(PERIOD_CONFIG) as Array<keyof typeof PERIOD_CONFIG>).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod(p)}
                  className="h-8 text-xs"
                >
                  {PERIOD_CONFIG[p].label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Loading state */}
        {loading && (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard entries */}
        {!loading && data && (
          <>
            <div className="divide-y">
              {data.entries.map((entry) => (
                <LeaderboardRow
                  key={entry.staff_id}
                  entry={entry}
                  isHighlighted={entry.staff_id === highlightStaffId}
                  rankDisplay={getRankDisplay(entry.rank)}
                />
              ))}

              {data.entries.length === 0 && (
                <div className="px-4 py-12 text-center text-muted-foreground">
                  <Trophy className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4">Пока нет данных за этот период</p>
                  <p className="text-sm">Станьте первым лидером!</p>
                </div>
              )}
            </div>

            {/* Footer stats */}
            <div className="border-t bg-muted/30 px-4 py-3">
              <p className="text-center text-sm text-muted-foreground">
                {data.total_staff.toLocaleString()} сотрудников в рейтинге
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface LeaderboardRowProps {
  entry: StaffLeaderboardEntry
  isHighlighted: boolean
  rankDisplay: React.ReactNode
}

function LeaderboardRow({ entry, isHighlighted, rankDisplay }: LeaderboardRowProps) {
  const isTopThree = entry.rank <= 3

  return (
    <div
      className={`
        flex items-center gap-4 px-4 py-3 transition-colors
        ${isHighlighted ? 'bg-primary/10' : isTopThree ? 'bg-muted/30' : ''}
      `}
    >
      {/* Rank */}
      {rankDisplay}

      {/* Avatar */}
      {entry.avatar_url ? (
        <img
          src={entry.avatar_url}
          alt={entry.staff_name}
          className="h-10 w-10 rounded-full object-cover ring-2 ring-background"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold ring-2 ring-background">
          {entry.staff_name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name and store */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`
              font-medium truncate
              ${isHighlighted ? 'text-primary' : ''}
              ${isTopThree ? 'font-semibold' : ''}
            `}
          >
            {entry.staff_name}
            {isHighlighted && ' (Вы)'}
          </span>
          {entry.is_certified && (
            <Award className="h-4 w-4 text-green-500" title="Сертифицирован" />
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Store className="h-3 w-3" />
          <span className="truncate">{entry.store_name}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-lg font-bold">{entry.customer_assists}</p>
            <p className="text-xs text-muted-foreground">консультаций</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{entry.scans_assisted}</span>
            </div>
            <p className="text-xs text-muted-foreground">сканирований</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StaffLeaderboard
