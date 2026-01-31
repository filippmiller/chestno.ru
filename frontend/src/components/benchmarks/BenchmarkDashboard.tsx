/**
 * BenchmarkDashboard - Dashboard widget for competitor benchmarking.
 * Shows organization metrics vs category averages with percentile rankings and trends.
 */
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart3, Users, Star, MessageSquare, Clock } from 'lucide-react'

import { getOrganizationBenchmarks } from '@/api/benchmarksService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { BenchmarkResponse, MetricComparison, TrendData } from '@/types/benchmarks'

interface BenchmarkDashboardProps {
  organizationId: string
  organizationName?: string
}

const PERIODS = [
  { label: '7 дней', value: 7 },
  { label: '30 дней', value: 30 },
  { label: '90 дней', value: 90 },
]

/**
 * Format a metric value for display.
 */
function formatValue(value: number | null, type: 'rating' | 'count' | 'percent' | 'hours'): string {
  if (value === null) return '—'

  switch (type) {
    case 'rating':
      return value.toFixed(1)
    case 'count':
      return Math.round(value).toLocaleString('ru-RU')
    case 'percent':
      return `${value.toFixed(0)}%`
    case 'hours':
      return `${value.toFixed(1)} ч`
    default:
      return String(value)
  }
}

/**
 * Get CSS class for percentile indicator.
 */
function getPercentileColor(percentile: number | null): string {
  if (percentile === null) return 'bg-muted'
  if (percentile >= 75) return 'bg-green-500'
  if (percentile >= 50) return 'bg-blue-500'
  if (percentile >= 25) return 'bg-yellow-500'
  return 'bg-red-500'
}

/**
 * Get CSS class for diff indicator.
 */
function getDiffColor(diff: number | null): string {
  if (diff === null) return 'text-muted-foreground'
  if (diff > 0) return 'text-green-600'
  if (diff < 0) return 'text-red-600'
  return 'text-muted-foreground'
}

/**
 * Trend indicator component.
 */
function TrendIndicator({ trend }: { trend: TrendData }) {
  const Icon = trend.trend === 'up' ? TrendingUp : trend.trend === 'down' ? TrendingDown : Minus
  const colorClass = trend.trend === 'up' ? 'text-green-600' : trend.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  return (
    <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {trend.change_percent !== null && (
        <span>{trend.change_percent > 0 ? '+' : ''}{trend.change_percent.toFixed(1)}%</span>
      )}
    </div>
  )
}

/**
 * Single metric card component.
 */
function MetricCard({
  title,
  icon: Icon,
  metric,
  valueType,
  trend,
  description,
}: {
  title: string
  icon: React.ElementType
  metric: MetricComparison
  valueType: 'rating' | 'count' | 'percent' | 'hours'
  trend?: TrendData
  description?: string
}) {
  const hasComparison = metric.category_avg !== null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          {trend && <TrendIndicator trend={trend} />}
        </div>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main value */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {formatValue(metric.value, valueType)}
          </span>
          {hasComparison && metric.diff_percent !== null && (
            <span className={`text-sm ${getDiffColor(metric.diff_percent)}`}>
              {metric.diff_percent > 0 ? '+' : ''}{metric.diff_percent.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Category comparison */}
        {hasComparison && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Среднее по категории</span>
              <span>{formatValue(metric.category_avg, valueType)}</span>
            </div>
          </div>
        )}

        {/* Percentile bar */}
        {metric.percentile !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Позиция в категории</span>
              <span>топ {100 - metric.percentile}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${getPercentileColor(metric.percentile)}`}
                style={{ width: `${metric.percentile}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Main BenchmarkDashboard component.
 */
export function BenchmarkDashboard({ organizationId, organizationName }: BenchmarkDashboardProps) {
  const [data, setData] = useState<BenchmarkResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    if (!organizationId) return

    let mounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await getOrganizationBenchmarks(organizationId, period)
        if (mounted) {
          setData(response)
        }
      } catch (err) {
        console.error('Failed to load benchmarks:', err)
        if (mounted) {
          setError('Не удалось загрузить данные бенчмарка')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      mounted = false
    }
  }, [organizationId, period])

  if (!organizationId) {
    return (
      <Alert>
        <AlertTitle>Выберите организацию</AlertTitle>
        <AlertDescription>
          Перейдите в дашборд и выберите организацию для просмотра сравнительного анализа.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Сравнение с конкурентами
          </h2>
          <p className="text-sm text-muted-foreground">
            {organizationName || 'Ваша организация'} vs {data?.category.name || 'категория'}
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.value)}
              disabled={loading}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded mb-2" />
                <div className="h-2 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data display */}
      {data && (
        <>
          {/* Category info */}
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Категория:</span>{' '}
                  <span className="font-medium">{data.category.name || 'Все организации'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Организаций в категории:</span>{' '}
                  <span className="font-medium">{data.category.total_organizations}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Всего отзывов:</span>{' '}
                  <span className="font-medium">{data.category.total_reviews.toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Средний рейтинг"
              icon={Star}
              metric={data.metrics.average_rating}
              valueType="rating"
              trend={data.trends.rating_trend}
              description="Оценка по 5-балльной шкале"
            />

            <MetricCard
              title="Количество отзывов"
              icon={MessageSquare}
              metric={data.metrics.total_reviews}
              valueType="count"
              trend={data.trends.reviews_trend}
              description="Всего одобренных отзывов"
            />

            <MetricCard
              title="Отклик на отзывы"
              icon={Users}
              metric={data.metrics.response_rate}
              valueType="percent"
              trend={data.trends.response_rate_trend}
              description="Процент отзывов с ответом"
            />

            {data.metrics.avg_response_time_hours && (
              <MetricCard
                title="Время ответа"
                icon={Clock}
                metric={data.metrics.avg_response_time_hours}
                valueType="hours"
                description="Среднее время ответа на отзыв"
              />
            )}
          </div>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Рекомендации</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {data.metrics.response_rate.value !== null &&
                  data.metrics.response_rate.value < 50 && (
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-500">!</span>
                      <span>
                        Отвечайте на большее количество отзывов. Компании с высоким откликом получают
                        больше доверия клиентов.
                      </span>
                    </li>
                  )}
                {data.metrics.average_rating.percentile !== null &&
                  data.metrics.average_rating.percentile < 50 && (
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-500">!</span>
                      <span>
                        Ваш рейтинг ниже среднего по категории. Обратите внимание на качество сервиса
                        и работу с негативными отзывами.
                      </span>
                    </li>
                  )}
                {data.metrics.total_reviews.percentile !== null &&
                  data.metrics.total_reviews.percentile < 25 && (
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500">i</span>
                      <span>
                        У вас меньше отзывов, чем у большинства конкурентов. Попросите довольных
                        клиентов оставить отзыв.
                      </span>
                    </li>
                  )}
                {data.trends.rating_trend.trend === 'up' && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">+</span>
                    <span>
                      Отлично! Ваш рейтинг растет. Продолжайте в том же духе.
                    </span>
                  </li>
                )}
                {data.trends.rating_trend.trend === 'down' && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">!</span>
                    <span>
                      Ваш рейтинг снижается. Проанализируйте последние отзывы и примите меры.
                    </span>
                  </li>
                )}
                {data.metrics.average_rating.percentile !== null &&
                  data.metrics.average_rating.percentile >= 75 &&
                  data.metrics.response_rate.value !== null &&
                  data.metrics.response_rate.value >= 70 && (
                    <li className="flex items-start gap-2">
                      <span className="text-green-500">+</span>
                      <span>
                        Вы в топе категории! Продолжайте поддерживать высокий уровень сервиса.
                      </span>
                    </li>
                  )}
              </ul>
            </CardContent>
          </Card>

          {/* Generated timestamp */}
          <p className="text-xs text-muted-foreground text-right">
            Данные обновлены: {new Date(data.generated_at).toLocaleString('ru-RU')}
          </p>
        </>
      )}
    </div>
  )
}

export default BenchmarkDashboard
