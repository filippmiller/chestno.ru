import { useEffect, useMemo, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { AuthorizedRegionsMap } from '@/components/geo-anomaly/AuthorizedRegionsMap'
import { RegionEditor, RegionList } from '@/components/geo-anomaly/RegionEditor'
import { AnomalyList } from '@/components/geo-anomaly/AnomalyAlert'
import { AnomalyMap, AnomalyHeatmap } from '@/components/geo-anomaly/AnomalyMap'
import { AnomalyStatsDashboard, CompactAnomalyStats } from '@/components/geo-anomaly/AnomalyStats'

import {
  getAuthorizedRegions,
  addAuthorizedRegion,
  deleteAuthorizedRegion,
  getAnomalies,
  investigateAnomaly,
  getAnomalyStatistics,
  getAnomalyTrend,
} from '@/api/geoAnomalyService'

import { useUserStore } from '@/store/userStore'

import type {
  AuthorizedRegion,
  AuthorizedRegionCreate,
  GeographicAnomaly,
  AnomalyStatusUpdate,
  AnomalyStatistics,
  AnomalyTrendItem,
} from '@/types/geoAnomaly'

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager'])

export function OrganizationGeoSecurityPage() {
  const { organizations, memberships, selectedOrganizationId, user } = useUserStore()

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<AuthorizedRegion[]>([])
  const [anomalies, setAnomalies] = useState<GeographicAnomaly[]>([])
  const [stats, setStats] = useState<AnomalyStatistics | null>(null)
  const [trend, setTrend] = useState<AnomalyTrendItem[]>([])
  const [totalAnomalies, setTotalAnomalies] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [daysFilter, setDaysFilter] = useState(30)

  // Dialogs
  const [regionEditorOpen, setRegionEditorOpen] = useState(false)
  const [editingRegion, setEditingRegion] = useState<AuthorizedRegion | undefined>()

  // Current organization
  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId]
  )
  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canManage = membership ? MANAGER_ROLES.has(membership.role) : false
  const organizationId = currentOrganization?.id

  // Load data
  useEffect(() => {
    if (!organizationId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const [regionsData, anomaliesData, statsData, trendData] = await Promise.all([
          getAuthorizedRegions(organizationId),
          getAnomalies(organizationId, {
            status: statusFilter === 'all' ? undefined : statusFilter,
            severity: severityFilter === 'all' ? undefined : severityFilter,
            days: daysFilter,
            page: currentPage,
            per_page: 20,
          }),
          getAnomalyStatistics(organizationId, daysFilter),
          getAnomalyTrend(organizationId, daysFilter),
        ])

        setRegions(regionsData)
        setAnomalies(anomaliesData.anomalies)
        setTotalAnomalies(anomaliesData.pagination.total)
        setStats(statsData)
        setTrend(trendData)
      } catch (err) {
        console.error('Failed to load geo security data:', err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [organizationId, statusFilter, severityFilter, daysFilter, currentPage])

  // Handlers
  const handleAddRegion = async (data: AuthorizedRegionCreate) => {
    if (!organizationId) return

    const newRegion = await addAuthorizedRegion(organizationId, data)
    setRegions((prev) => [...prev, newRegion])
  }

  const handleDeleteRegion = async (regionId: string) => {
    if (!organizationId) return

    if (!confirm('Удалить этот регион?')) return

    try {
      await deleteAuthorizedRegion(organizationId, regionId)
      setRegions((prev) => prev.filter((r) => r.id !== regionId))
    } catch (err) {
      console.error('Failed to delete region:', err)
      setError('Не удалось удалить регион')
    }
  }

  const handleInvestigateAnomaly = async (anomalyId: string, update: AnomalyStatusUpdate) => {
    if (!organizationId) return

    const updated = await investigateAnomaly(organizationId, anomalyId, update)
    setAnomalies((prev) =>
      prev.map((a) => (a.id === anomalyId ? updated : a))
    )

    // Refresh stats
    const newStats = await getAnomalyStatistics(organizationId, daysFilter)
    setStats(newStats)
  }

  // Guards
  if (!user || !currentOrganization || !organizationId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно данных</AlertTitle>
          <AlertDescription>Сначала войдите и выберите организацию.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">Геобезопасность</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">
          Обнаружение серого рынка: контролируйте, где продается ваша продукция
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Обзор</CardTitle>
          </CardHeader>
          <CardContent>
            <CompactAnomalyStats stats={stats} />
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">
            Аномалии
            {stats && stats.by_status.new > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {stats.by_status.new}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="regions">Авторизованные регионы</TabsTrigger>
          <TabsTrigger value="statistics">Статистика</TabsTrigger>
          <TabsTrigger value="map">Карта аномалий</TabsTrigger>
        </TabsList>

        {/* Anomalies Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="new">Новые</SelectItem>
                <SelectItem value="under_review">На рассмотрении</SelectItem>
                <SelectItem value="confirmed">Подтверждены</SelectItem>
                <SelectItem value="false_positive">Ложные</SelectItem>
                <SelectItem value="resolved">Решены</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Критичность" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Любая критичность</SelectItem>
                <SelectItem value="critical">Критическая</SelectItem>
                <SelectItem value="high">Высокая</SelectItem>
                <SelectItem value="medium">Средняя</SelectItem>
                <SelectItem value="low">Низкая</SelectItem>
              </SelectContent>
            </Select>

            <Select value={daysFilter.toString()} onValueChange={(v) => setDaysFilter(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="30">30 дней</SelectItem>
                <SelectItem value="90">90 дней</SelectItem>
                <SelectItem value="365">1 год</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AnomalyList
            anomalies={anomalies}
            onInvestigate={canManage ? handleInvestigateAnomaly : undefined}
            loading={loading}
          />

          {/* Pagination */}
          {totalAnomalies > 20 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Назад
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Страница {currentPage} из {Math.ceil(totalAnomalies / 20)}
              </span>
              <Button
                variant="outline"
                disabled={currentPage >= Math.ceil(totalAnomalies / 20)}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Вперед
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Regions Tab */}
        <TabsContent value="regions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Авторизованные регионы</CardTitle>
                  <CardDescription>
                    Регионы, в которых разрешена продажа вашей продукции.
                    Сканирования за их пределами будут помечены как аномалии.
                  </CardDescription>
                </div>
                {canManage && (
                  <Button onClick={() => {
                    setEditingRegion(undefined)
                    setRegionEditorOpen(true)
                  }}>
                    Добавить регион
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {regions.length > 0 && (
                <AuthorizedRegionsMap
                  regions={regions}
                  height="300px"
                />
              )}
              <RegionList
                regions={regions}
                onEdit={(region) => {
                  setEditingRegion(region)
                  setRegionEditorOpen(true)
                }}
                onDelete={handleDeleteRegion}
                loading={loading}
              />
            </CardContent>
          </Card>

          {!canManage && (
            <Alert>
              <AlertTitle>Только для менеджеров</AlertTitle>
              <AlertDescription>
                Управление регионами доступно только владельцам, администраторам и менеджерам.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics">
          {stats && trend && (
            <AnomalyStatsDashboard
              stats={stats}
              trend={trend}
              loading={loading}
            />
          )}
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Карта аномалий</CardTitle>
              <CardDescription>
                Географическое распределение обнаруженных аномалий
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnomalyMap
                anomalies={anomalies}
                height="500px"
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <AnomalyHeatmap anomalies={anomalies} height="250px" />
            {regions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Авторизованные регионы</CardTitle>
                </CardHeader>
                <CardContent>
                  <AuthorizedRegionsMap
                    regions={regions}
                    height="200px"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Region Editor Dialog */}
      <RegionEditor
        open={regionEditorOpen}
        onClose={() => {
          setRegionEditorOpen(false)
          setEditingRegion(undefined)
        }}
        onSave={handleAddRegion}
        existingRegion={editingRegion}
        existingRegionCodes={regions.map((r) => r.region_code)}
      />
    </div>
  )
}

export default OrganizationGeoSecurityPage
