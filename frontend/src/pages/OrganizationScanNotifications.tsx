/**
 * OrganizationScanNotifications Page
 *
 * Dashboard page for producers to manage real-time scan notifications.
 * Features:
 * - Live scan feed with real-time updates
 * - Notification settings configuration
 * - Scan statistics and history
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Bell,
  Clock,
  History,
  Radio,
  Settings,
  TrendingUp,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserStore } from '@/store/userStore'
import { useToast } from '@/hooks/use-toast'

import {
  ScanNotificationSettings,
  LiveScanFeed,
  ScanActivitySummary,
} from '@/components/scan-notifications'

import type {
  ScanNotificationPreferences,
  ScanNotificationPreferencesUpdate,
  LiveScanStats,
  ScanNotificationStats,
} from '@/types/scan-notifications'

export function OrganizationScanNotificationsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { organizations, selectedOrganizationId } = useUserStore()

  const [activeTab, setActiveTab] = useState('live')
  const [preferences, setPreferences] = useState<ScanNotificationPreferences | null>(null)
  const [liveStats, setLiveStats] = useState<LiveScanStats | null>(null)
  const [notificationStats, setNotificationStats] = useState<ScanNotificationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId]
  )

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!currentOrganization) return

    setLoading(true)
    setError(null)

    try {
      const [prefsRes, liveStatsRes, notifStatsRes] = await Promise.all([
        fetch(`/api/organizations/${currentOrganization.id}/scan-notifications/preferences`, {
          credentials: 'include',
        }),
        fetch(`/api/organizations/${currentOrganization.id}/scan-notifications/live-stats`, {
          credentials: 'include',
        }),
        fetch(`/api/organizations/${currentOrganization.id}/scan-notifications/stats`, {
          credentials: 'include',
        }),
      ])

      if (!prefsRes.ok || !liveStatsRes.ok || !notifStatsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const [prefsData, liveStatsData, notifStatsData] = await Promise.all([
        prefsRes.json(),
        liveStatsRes.json(),
        notifStatsRes.json(),
      ])

      setPreferences(prefsData)
      setLiveStats(liveStatsData)
      setNotificationStats(notifStatsData)
    } catch (err) {
      console.error('Error fetching scan notifications data:', err)
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Save preferences
  const handleSavePreferences = async (data: ScanNotificationPreferencesUpdate) => {
    if (!currentOrganization) return

    setSavingPreferences(true)
    try {
      const response = await fetch(
        `/api/organizations/${currentOrganization.id}/scan-notifications/preferences`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      const updatedPrefs = await response.json()
      setPreferences(updatedPrefs)

      toast({
        title: 'Настройки сохранены',
        description: 'Ваши настройки уведомлений успешно обновлены',
      })
    } catch (err) {
      console.error('Error saving preferences:', err)
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive',
      })
    } finally {
      setSavingPreferences(false)
    }
  }

  // Render loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  // Render no organization state
  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Нет организации</AlertTitle>
          <AlertDescription>
            Сначала создайте организацию или примите приглашение.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <button onClick={() => navigate('/dashboard')} className="hover:underline">
            Главная
          </button>
          <span>/</span>
          <span>Уведомления о сканированиях</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-3">
              <Radio className="h-8 w-8 text-primary" />
              Уведомления о сканированиях
            </h1>
            <p className="text-muted-foreground mt-2">
              Отслеживайте сканирования ваших продуктов в реальном времени
            </p>
          </div>
          <Badge
            variant={preferences?.enabled ? 'default' : 'secondary'}
            className="text-sm py-1 px-3"
          >
            {preferences?.enabled ? 'Включено' : 'Выключено'}
          </Badge>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Сегодня</CardDescription>
            <CardTitle className="text-3xl">{liveStats?.total_scans_today || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">сканирований</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>За неделю</CardDescription>
            <CardTitle className="text-3xl">{liveStats?.total_scans_week || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">сканирований</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Уникальных продуктов</CardDescription>
            <CardTitle className="text-3xl">{liveStats?.unique_products_scanned || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">отсканировано</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Регионов</CardDescription>
            <CardTitle className="text-3xl">{liveStats?.unique_regions || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">география охвата</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Лента
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Настройки
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Статистика
          </TabsTrigger>
        </TabsList>

        {/* Live Feed Tab */}
        <TabsContent value="live" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LiveScanFeed
                organizationId={currentOrganization.id}
                autoRefresh={true}
                showStats={true}
              />
            </div>

            <div className="space-y-4">
              {/* Top Countries */}
              {liveStats && liveStats.top_countries.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Топ регионов</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {liveStats.top_countries.slice(0, 5).map((item, index) => (
                      <div key={item.country} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {index + 1}. {item.country}
                        </span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Top Products */}
              {liveStats && liveStats.top_products.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Топ продуктов</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {liveStats.top_products.slice(0, 5).map((item, index) => (
                      <div key={item.product_id} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                          {index + 1}. {item.product_name}
                        </span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Special Events */}
              {liveStats && (liveStats.suspicious_scans_count > 0 || liveStats.first_scans_count > 0) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">События</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {liveStats.first_scans_count > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-700">Первые сканирования</span>
                        <Badge className="bg-green-100 text-green-800">
                          {liveStats.first_scans_count}
                        </Badge>
                      </div>
                    )}
                    {liveStats.suspicious_scans_count > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-red-700">Подозрительные</span>
                        <Badge variant="destructive">{liveStats.suspicious_scans_count}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          {preferences && (
            <ScanNotificationSettings
              preferences={preferences}
              onSubmit={handleSavePreferences}
              isLoading={savingPreferences}
            />
          )}
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Notification Stats */}
            {notificationStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Статистика уведомлений
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{notificationStats.total_notifications_sent}</p>
                      <p className="text-xs text-muted-foreground">Всего</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{notificationStats.notifications_today}</p>
                      <p className="text-xs text-muted-foreground">Сегодня</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{notificationStats.notifications_this_week}</p>
                      <p className="text-xs text-muted-foreground">За неделю</p>
                    </div>
                  </div>

                  {/* By Channel */}
                  <div>
                    <p className="text-sm font-medium mb-2">По каналам</p>
                    <div className="space-y-2">
                      {Object.entries(notificationStats.by_channel).map(([channel, count]) => (
                        <div key={channel} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground capitalize">{channel}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Status */}
                  <div>
                    <p className="text-sm font-medium mb-2">По статусу</p>
                    <div className="space-y-2">
                      {Object.entries(notificationStats.by_status).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground capitalize">{status}</span>
                          <Badge
                            variant={status === 'failed' ? 'destructive' : 'outline'}
                          >
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scan Stats */}
            {liveStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Статистика сканирований
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{liveStats.total_scans_today}</p>
                      <p className="text-xs text-muted-foreground">Сегодня</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{liveStats.total_scans_week}</p>
                      <p className="text-xs text-muted-foreground">За неделю</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{liveStats.unique_products_scanned}</p>
                      <p className="text-xs text-muted-foreground">Продуктов</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{liveStats.unique_regions}</p>
                      <p className="text-xs text-muted-foreground">Регионов</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-green-50 text-center">
                      <p className="text-xl font-bold text-green-700">{liveStats.first_scans_count}</p>
                      <p className="text-xs text-green-600">Первых сканирований</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 text-center">
                      <p className="text-xl font-bold text-red-700">{liveStats.suspicious_scans_count}</p>
                      <p className="text-xs text-red-600">Подозрительных</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
