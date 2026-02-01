/**
 * Scan Leaderboard Component
 *
 * Monthly and all-time leaderboards for QR scanning.
 * Shows top scanners with tier badges and stats.
 */
import { useEffect, useState } from 'react'
import { Calendar, Crown, Medal, RefreshCw, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { httpClient } from '@/api/httpClient'
import type {
  LeaderboardPeriod,
  QrLeaderboardEntry,
  QrLeaderboardResponse,
} from '@/types/qr-gamification'
import { ScanTierBadge } from './ScanTierBadge'

const PERIOD_CONFIG: Record<
  LeaderboardPeriod,
  { label: string; icon: React.ElementType }
> = {
  all_time: { label: 'Все время', icon: Trophy },
  monthly: { label: 'Месяц', icon: Calendar },
  weekly: { label: 'Неделя', icon: Calendar },
}

interface ScanLeaderboardProps {
  initialPeriod?: LeaderboardPeriod
  limit?: number
  showPeriodSelector?: boolean
  highlightUserId?: string
  className?: string
}

export function ScanLeaderboard({
  initialPeriod = 'monthly',
  limit = 10,
  showPeriodSelector = true,
  highlightUserId,
  className = '',
}: ScanLeaderboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod)
  const [data, setData] = useState<QrLeaderboardResponse | null>(null)

  useEffect(() => {
    fetchLeaderboard()
  }, [period, limit])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await httpClient.get<QrLeaderboardResponse>(
        '/api/v1/gamification/leaderboard',
        { params: { period, limit } }
      )
      setData(response.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
            <Crown className="h-5 w-5 text-yellow-500" />
          </div>
        )
      case 2:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-400/20">
            <Medal className="h-5 w-5 text-gray-400" />
          </div>
        )
      case 3:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600/20">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
        )
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center text-lg font-bold text-muted-foreground">
            {rank}
          </div>
        )
    }
  }

  if (error) {
    return (
      <div className={`rounded-xl border bg-card p-6 ${className}`}>
        <p className="text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={fetchLeaderboard}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Таблица лидеров</h3>
        </div>

        {showPeriodSelector && (
          <div className="flex gap-1">
            {(Object.keys(PERIOD_CONFIG) as LeaderboardPeriod[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p)}
                className="h-7 text-xs"
              >
                {PERIOD_CONFIG[p].label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded bg-muted" />
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
                key={entry.user_id}
                entry={entry}
                isCurrentUser={entry.user_id === highlightUserId}
                rankDisplay={getRankDisplay(entry.rank)}
              />
            ))}

            {data.entries.length === 0 && (
              <div className="px-4 py-12 text-center text-muted-foreground">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4">Пока нет данных за этот период</p>
                <p className="text-sm">Станьте первым!</p>
              </div>
            )}
          </div>

          {/* Current user position (if not in top) */}
          {data.user_entry && !data.entries.some((e) => e.user_id === highlightUserId) && (
            <div className="border-t bg-primary/5">
              <LeaderboardRow
                entry={data.user_entry}
                isCurrentUser={true}
                rankDisplay={getRankDisplay(data.user_entry.rank)}
              />
            </div>
          )}

          {/* Footer stats */}
          <div className="border-t bg-muted/30 px-4 py-3">
            <p className="text-center text-sm text-muted-foreground">
              {data.total_participants.toLocaleString()} участников
              {data.user_entry && (
                <>
                  {' '}
                  | Ваша позиция:{' '}
                  <span className="font-semibold text-foreground">
                    #{data.user_entry.rank}
                  </span>
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

interface LeaderboardRowProps {
  entry: QrLeaderboardEntry
  isCurrentUser: boolean
  rankDisplay: React.ReactNode
}

function LeaderboardRow({ entry, isCurrentUser, rankDisplay }: LeaderboardRowProps) {
  const isTopThree = entry.rank <= 3

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 transition-colors
        ${isCurrentUser ? 'bg-primary/10' : isTopThree ? 'bg-muted/30' : ''}
      `}
    >
      {/* Rank */}
      {rankDisplay}

      {/* Avatar */}
      {entry.avatar_url ? (
        <img
          src={entry.avatar_url}
          alt={entry.display_name}
          className="h-10 w-10 rounded-full object-cover ring-2 ring-background"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold ring-2 ring-background">
          {entry.display_name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name and tier */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`
              font-medium truncate
              ${isCurrentUser ? 'text-primary' : ''}
              ${isTopThree ? 'font-semibold' : ''}
            `}
          >
            {entry.display_name}
            {isCurrentUser && ' (Вы)'}
          </span>
          <ScanTierBadge tier={entry.tier} size="sm" />
        </div>
        <p className="text-xs text-muted-foreground">
          {entry.unique_organizations} компаний
        </p>
      </div>

      {/* Scans count */}
      <div className="text-right">
        <p className="text-lg font-bold">{entry.scans_this_period}</p>
        <p className="text-xs text-muted-foreground">сканирований</p>
      </div>
    </div>
  )
}

export default ScanLeaderboard
