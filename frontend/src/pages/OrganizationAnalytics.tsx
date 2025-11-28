import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'

import { exportQrData, getQrOverview } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { QROverviewResponse } from '@/types/auth'
import { useUserStore } from '@/store/userStore'

const PERIODS = [
  { label: '7 дней', value: 7 },
  { label: '30 дней', value: 30 },
  { label: '90 дней', value: 90 },
]

export const OrganizationAnalyticsPage = () => {
  const { organizations, selectedOrganizationId } = useUserStore()
  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId],
  )
  const [period, setPeriod] = useState(30)
  const [stats, setStats] = useState<QROverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganization) return
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getQrOverview(currentOrganization.id, period)
        if (mounted) setStats(data)
      } catch (err) {
        console.error(err)
        if (mounted) setError('Не удалось загрузить аналитику')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [currentOrganization, period])

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Выберите организацию</AlertTitle>
          <AlertDescription>Перейдите в дашборд и выберите организацию, чтобы увидеть аналитику.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Аналитика QR-кодов</p>
        <h1 className="text-3xl font-semibold">Статистика по сканам</h1>
        <p className="text-muted-foreground">Следите за динамикой и источниками интереса к {currentOrganization.name}.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((option) => (
          <Button
            key={option.value}
            variant={period === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(option.value)}
          >
            {option.label}
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => currentOrganization && exportQrData(currentOrganization.id, period, 'csv')}
            disabled={loading || !stats}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => currentOrganization && exportQrData(currentOrganization.id, period, 'json')}
            disabled={loading || !stats}
          >
            <Download className="mr-2 h-4 w-4" />
            JSON
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Всего сканов</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats?.total_scans ?? '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Первый скан</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {stats?.first_scan_at ? new Date(stats.first_scan_at).toLocaleDateString('ru-RU') : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Последний скан</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {stats?.last_scan_at ? new Date(stats.last_scan_at).toLocaleDateString('ru-RU') : '—'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сканы по дням</CardTitle>
          <CardDescription>Диапазон: последние {period} дней.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Загружаем данные…</p>}
          {!loading && (!stats || stats.daily.length === 0) && (
            <p className="text-sm text-muted-foreground">Данных пока нет — делитесь QR-кодами, чтобы увидеть статистику.</p>
          )}
          <div className="space-y-3">
            {stats?.daily.map((metric) => (
              <div key={metric.date} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{new Date(metric.date).toLocaleDateString('ru-RU')}</span>
                  <span>{metric.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (metric.count / (stats.total_scans || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {stats && (stats.by_country.length > 0 || stats.by_source.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.by_country.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>По странам</CardTitle>
                <CardDescription>Топ-10 стран по количеству сканов</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.by_country.map((metric, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{metric.country || 'Неизвестно'}</span>
                      <span className="font-semibold">{metric.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {stats.by_source.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>По источникам</CardTitle>
                <CardDescription>Топ-10 источников (UTM)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.by_source.map((metric, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{metric.source || 'Прямой'}</span>
                      <span className="font-semibold">{metric.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

