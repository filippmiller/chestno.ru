/**
 * Moderation Stats Component
 * Displays moderation queue statistics in a dashboard format.
 */
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ModerationStats as ModerationStatsType, ContentType } from '@/types/moderation'
import { CONTENT_TYPE_LABELS } from '@/types/moderation'
import { getModerationStats } from '@/api/moderationService'

interface ModerationStatsProps {
  refreshKey?: number
  onError?: (error: string) => void
}

export function ModerationStats({ refreshKey, onError }: ModerationStatsProps) {
  const [stats, setStats] = useState<ModerationStatsType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  async function loadStats() {
    setLoading(true)
    try {
      const data = await getModerationStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
      onError?.('Не удалось загрузить статистику')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Ожидает"
          value={stats.pending_count}
          color="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          trend={stats.pending_count > 50 ? 'high' : 'normal'}
        />
        <StatCard
          label="На рассмотрении"
          value={stats.in_review_count}
          color="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          label="Эскалировано"
          value={stats.escalated_count}
          color="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
          trend={stats.escalated_count > 10 ? 'warning' : 'normal'}
        />
        <StatCard
          label="Апелляции"
          value={stats.appealed_count}
          color="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
        />
        <StatCard
          label="Решено сегодня"
          value={stats.resolved_today}
          color="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          label="Среднее время (ч)"
          value={stats.avg_resolution_hours.toFixed(1)}
          color="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
          trend={stats.avg_resolution_hours > 24 ? 'warning' : 'normal'}
        />
      </div>

      {/* Pending by Type Breakdown */}
      {stats.pending_by_type && Object.keys(stats.pending_by_type).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ожидающие по типу контента</CardTitle>
            <CardDescription>Распределение элементов в очереди</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.pending_by_type).map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted"
                >
                  <span className="text-sm text-muted-foreground">
                    {CONTENT_TYPE_LABELS[type as ContentType] || type}:
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  color: string
  trend?: 'normal' | 'warning' | 'high'
}

function StatCard({ label, value, color, trend = 'normal' }: StatCardProps) {
  const trendIndicator = trend === 'warning' || trend === 'high'

  return (
    <div className={`rounded-lg p-4 ${color} relative`}>
      {trendIndicator && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              trend === 'high' ? 'bg-red-400' : 'bg-orange-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              trend === 'high' ? 'bg-red-500' : 'bg-orange-500'
            }`} />
          </span>
        </div>
      )}
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  )
}
