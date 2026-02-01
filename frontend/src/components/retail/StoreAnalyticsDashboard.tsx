/**
 * StoreAnalyticsDashboard Component
 *
 * Displays store-level performance metrics including scan counts,
 * top products, daily trends, and scan source breakdown.
 */
import { useEffect, useState } from 'react'
import {
  BarChart3,
  Package,
  QrCode,
  Smartphone,
  Store,
  TrendingUp,
  TrendingDown,
  Calendar,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getStoreAnalytics } from '@/api/retailService'
import type { StoreAnalytics, ScanSource } from '@/types/retail'

interface StoreAnalyticsDashboardProps {
  storeId: string
  storeName?: string
  className?: string
}

const PERIODS = [
  { label: '7 дней', value: 7 },
  { label: '30 дней', value: 30 },
  { label: '90 дней', value: 90 },
]

const SCAN_SOURCE_CONFIG: Record<ScanSource, { label: string; icon: React.ElementType; color: string }> = {
  shelf: { label: 'С полки', icon: Package, color: 'bg-blue-500' },
  kiosk: { label: 'Киоск', icon: Store, color: 'bg-green-500' },
  checkout: { label: 'Касса', icon: QrCode, color: 'bg-purple-500' },
  staff_device: { label: 'Сотрудник', icon: Smartphone, color: 'bg-orange-500' },
  signage: { label: 'Вывеска', icon: BarChart3, color: 'bg-pink-500' },
}

export function StoreAnalyticsDashboard({
  storeId,
  storeName,
  className = '',
}: StoreAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<StoreAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(30)
  const [comparison, setComparison] = useState<{ previous_period_scans: number; change_percent: number } | null>(null)

  useEffect(() => {
    if (!storeId) return

    let mounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await getStoreAnalytics(storeId, { period_days: period })
        if (mounted) {
          setAnalytics(response.analytics)
          setComparison(response.comparison || null)
        }
      } catch (err) {
        console.error('Failed to load store analytics:', err)
        if (mounted) {
          setError('Не удалось загрузить аналитику магазина')
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
  }, [storeId, period])

  if (!storeId) {
    return (
      <Alert>
        <AlertTitle>Выберите магазин</AlertTitle>
        <AlertDescription>
          Выберите магазин на карте или из списка для просмотра аналитики.
        </AlertDescription>
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Calculate max for scan source chart
  const maxScanSource = analytics
    ? Math.max(...Object.values(analytics.scans_by_source), 1)
    : 1

  // Calculate max for daily scans chart
  const maxDailyScans = analytics
    ? Math.max(...analytics.daily_scans.map((d) => d.count), 1)
    : 1

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <BarChart3 className="h-5 w-5" />
            Аналитика магазина
          </h2>
          <p className="text-sm text-muted-foreground">
            {storeName || analytics?.store_name || 'Загрузка...'}
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

      {/* Loading state */}
      {loading && !analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main metrics */}
      {analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total scans */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                  Всего сканирований
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {analytics.total_scans.toLocaleString('ru-RU')}
                  </span>
                  {comparison && (
                    <span
                      className={`flex items-center text-sm ${
                        comparison.change_percent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {comparison.change_percent >= 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3" />
                      )}
                      {comparison.change_percent > 0 ? '+' : ''}
                      {comparison.change_percent.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  за {period} дней
                </p>
              </CardContent>
            </Card>

            {/* Unique products */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Уникальных товаров
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">
                  {analytics.unique_products_scanned.toLocaleString('ru-RU')}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  отсканировано покупателями
                </p>
              </CardContent>
            </Card>

            {/* Unique customers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  Уникальных покупателей
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">
                  {analytics.unique_customers.toLocaleString('ru-RU')}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  использовали сканирование
                </p>
              </CardContent>
            </Card>

            {/* Avg per day */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Среднее в день
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">
                  {(analytics.total_scans / period).toFixed(1)}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  сканирований
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Scan sources breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Источники сканирований</CardTitle>
                <CardDescription>Откуда покупатели сканируют товары</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(Object.entries(analytics.scans_by_source) as [ScanSource, number][]).map(
                  ([source, count]) => {
                    const config = SCAN_SOURCE_CONFIG[source]
                    const Icon = config.icon
                    const percent = (count / analytics.total_scans) * 100

                    return (
                      <div key={source} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{config.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{count.toLocaleString('ru-RU')}</span>
                            <span className="text-muted-foreground">
                              ({percent.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all ${config.color}`}
                            style={{ width: `${(count / maxScanSource) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  }
                )}

                {Object.keys(analytics.scans_by_source).length === 0 && (
                  <p className="py-4 text-center text-muted-foreground">
                    Нет данных о сканированиях
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Top products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Топ товаров</CardTitle>
                <CardDescription>Наиболее часто сканируемые товары</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.top_products.slice(0, 5).map((product, index) => (
                    <div key={product.product_id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{product.product_name}</p>
                        <Progress
                          value={(product.scan_count / analytics.top_products[0].scan_count) * 100}
                          className="mt-1 h-1"
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {product.scan_count.toLocaleString('ru-RU')}
                      </span>
                    </div>
                  ))}

                  {analytics.top_products.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">
                      Нет данных о товарах
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily scans chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Динамика сканирований</CardTitle>
              <CardDescription>Количество сканирований по дням</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                {analytics.daily_scans.length > 0 ? (
                  <div className="flex h-full items-end gap-1">
                    {analytics.daily_scans.map((day) => {
                      const height = (day.count / maxDailyScans) * 100
                      const date = new Date(day.date)
                      const isToday = new Date().toDateString() === date.toDateString()

                      return (
                        <div
                          key={day.date}
                          className="group relative flex-1"
                          title={`${date.toLocaleDateString('ru-RU')}: ${day.count} сканирований`}
                        >
                          <div
                            className={`
                              w-full rounded-t transition-all
                              ${isToday ? 'bg-primary' : 'bg-primary/60 hover:bg-primary/80'}
                            `}
                            style={{ height: `${Math.max(height, 2)}%` }}
                          />
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow-lg group-hover:block">
                            <p className="font-medium">{day.count}</p>
                            <p className="text-muted-foreground">
                              {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Нет данных за выбранный период
                  </div>
                )}
              </div>
              {analytics.daily_scans.length > 0 && (
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {new Date(analytics.daily_scans[0].date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span>
                    {new Date(analytics.daily_scans[analytics.daily_scans.length - 1].date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default StoreAnalyticsDashboard
