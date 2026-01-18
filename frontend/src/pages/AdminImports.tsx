import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'

import {
  listAdminImports,
  getImportStats,
  getOrganizationsImportSummary,
  cancelImportAdmin,
  retryFailedItems,
  deleteImportJob,
} from '@/api/adminImportService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import type {
  ImportJobAdmin,
  ImportStatsResponse,
  OrganizationImportSummary,
  ImportJobStatus,
  AdminImportsFilter,
} from '@/types/adminImport'
import { IMPORT_SOURCE_LABELS, IMPORT_STATUS_CONFIG } from '@/types/adminImport'

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: ImportJobStatus }) {
  const config = IMPORT_STATUS_CONFIG[status] || { label: status, color: 'secondary' }
  return <Badge variant={config.color}>{config.label}</Badge>
}

function SourceBadge({ source }: { source: string }) {
  const label = IMPORT_SOURCE_LABELS[source] || source
  return <Badge variant="outline">{label}</Badge>
}

// Stats Cards Component
function ImportStatsCards({ stats }: { stats: ImportStatsResponse | null }) {
  if (!stats) return null

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего импортов</CardTitle>
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_jobs}</div>
          <p className="text-xs text-muted-foreground">
            {stats.processing_jobs} выполняется
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Успешность</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.success_rate}%</div>
          <Progress value={stats.success_rate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Импортировано</CardTitle>
          <Download className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_rows_imported.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            товаров создано
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">С ошибками</CardTitle>
          <XCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_rows_failed.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            строк не импортировано
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Source Distribution Chart (simple version)
function SourceDistribution({ stats }: { stats: ImportStatsResponse | null }) {
  if (!stats || stats.jobs_by_source.length === 0) return null

  const total = stats.jobs_by_source.reduce((sum, s) => sum + s.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">По источникам</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.jobs_by_source.map((item) => (
          <div key={item.source} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{IMPORT_SOURCE_LABELS[item.source] || item.source}</span>
              <span className="text-muted-foreground">{item.count}</span>
            </div>
            <Progress value={(item.count / total) * 100} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Status Distribution
function StatusDistribution({ stats }: { stats: ImportStatsResponse | null }) {
  if (!stats || stats.jobs_by_status.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">По статусам</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {stats.jobs_by_status.map((item) => (
            <div
              key={item.status}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
            >
              <StatusBadge status={item.status as ImportJobStatus} />
              <span className="font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Recent Activity
function RecentActivity({ stats }: { stats: ImportStatsResponse | null }) {
  if (!stats || stats.recent_activity.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Активность за 7 дней</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.recent_activity.map((day) => (
            <div key={day.date} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(day.date).toLocaleDateString('ru-RU', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <div className="flex gap-4">
                <span>{day.jobs} импортов</span>
                <span className="text-muted-foreground">{day.rows} строк</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Organization Summary Table
function OrganizationsSummary({
  data,
  onSelectOrg,
}: {
  data: OrganizationImportSummary[]
  onSelectOrg: (orgId: string) => void
}) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Нет данных об импортах
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Организация</TableHead>
          <TableHead className="text-right">Импортов</TableHead>
          <TableHead className="text-right">Успешно</TableHead>
          <TableHead className="text-right">Ошибок</TableHead>
          <TableHead className="text-right">Товаров</TableHead>
          <TableHead>Последний</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((org) => (
          <TableRow key={org.organization_id}>
            <TableCell className="font-medium">{org.organization_name}</TableCell>
            <TableCell className="text-right">{org.total_imports}</TableCell>
            <TableCell className="text-right text-green-600">{org.completed}</TableCell>
            <TableCell className="text-right text-destructive">{org.failed}</TableCell>
            <TableCell className="text-right">{org.total_products_imported}</TableCell>
            <TableCell className="text-muted-foreground">
              {org.last_import_at ? formatDate(org.last_import_at) : '—'}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectOrg(org.organization_id)}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// Import Jobs Table
function ImportJobsTable({
  jobs,
  loading,
  onCancel,
  onRetry,
  onDelete,
}: {
  jobs: ImportJobAdmin[]
  loading: boolean
  onCancel: (jobId: string) => void
  onRetry: (jobId: string) => void
  onDelete: (jobId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Нет импортов
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Файл</TableHead>
          <TableHead>Организация</TableHead>
          <TableHead>Источник</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className="text-right">Прогресс</TableHead>
          <TableHead>Создан</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const progress =
            job.total_rows > 0
              ? Math.round((job.processed_rows / job.total_rows) * 100)
              : 0

          return (
            <TableRow key={job.id}>
              <TableCell>
                <div>
                  <p className="font-medium truncate max-w-[200px]">
                    {job.original_filename || 'Без имени'}
                  </p>
                  <p className="text-xs text-muted-foreground">{job.creator_email}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="truncate max-w-[150px] block">
                  {job.organization_name || job.organization_id.slice(0, 8)}
                </span>
              </TableCell>
              <TableCell>
                <SourceBadge source={job.source_type} />
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm">
                    {job.successful_rows}/{job.total_rows}
                  </span>
                  {job.status === 'processing' && (
                    <Progress value={progress} className="w-16 h-2" />
                  )}
                  {job.failed_rows > 0 && (
                    <span className="text-xs text-destructive">
                      ({job.failed_rows} ошибок)
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(job.created_at)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/admin/imports/${job.id}`}>
                        Подробности
                      </Link>
                    </DropdownMenuItem>
                    {['pending', 'processing', 'mapping', 'validating'].includes(job.status) && (
                      <DropdownMenuItem onClick={() => onCancel(job.id)}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Отменить
                      </DropdownMenuItem>
                    )}
                    {(job.status === 'completed' || job.status === 'failed') &&
                      job.failed_rows > 0 && (
                        <DropdownMenuItem onClick={() => onRetry(job.id)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Повторить ошибки
                        </DropdownMenuItem>
                      )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(job.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// Main Page Component
export const AdminImportsPage = () => {
  const [jobs, setJobs] = useState<ImportJobAdmin[]>([])
  const [stats, setStats] = useState<ImportStatsResponse | null>(null)
  const [orgSummary, setOrgSummary] = useState<OrganizationImportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AdminImportsFilter>({ limit: 50 })
  const [total, setTotal] = useState(0)
  const [activeTab, setActiveTab] = useState('jobs')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [jobsRes, statsRes, orgRes] = await Promise.all([
        listAdminImports(filter),
        getImportStats(30),
        getOrganizationsImportSummary(),
      ])

      setJobs(jobsRes.items)
      setTotal(jobsRes.total)
      setStats(statsRes)
      setOrgSummary(orgRes)
    } catch (err) {
      console.error('Error loading admin imports:', err)
      setError('Не удалось загрузить данные импортов')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCancel = async (jobId: string) => {
    if (!confirm('Отменить этот импорт?')) return

    try {
      await cancelImportAdmin(jobId)
      void loadData()
    } catch (err) {
      console.error('Error cancelling import:', err)
      setError('Не удалось отменить импорт')
    }
  }

  const handleRetry = async (jobId: string) => {
    if (!confirm('Повторить импорт ошибочных строк?')) return

    try {
      const result = await retryFailedItems(jobId)
      alert(`Сброшено ${result.items_reset} строк для повторного импорта`)
      void loadData()
    } catch (err) {
      console.error('Error retrying import:', err)
      setError('Не удалось запустить повтор')
    }
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm('Удалить этот импорт? Это действие нельзя отменить.')) return

    try {
      await deleteImportJob(jobId)
      void loadData()
    } catch (err) {
      console.error('Error deleting import:', err)
      setError('Не удалось удалить импорт')
    }
  }

  const handleFilterChange = (key: keyof AdminImportsFilter, value: string | undefined) => {
    setFilter((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      offset: 0,
    }))
  }

  const handleOrgSelect = (orgId: string) => {
    setFilter((prev) => ({ ...prev, organization_id: orgId, offset: 0 }))
    setActiveTab('jobs')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Imports Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage product imports across all organizations
          </p>
        </div>
        <Button onClick={() => loadData()} disabled={loading} size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <ImportStatsCards stats={stats} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="jobs">Импорты ({total})</TabsTrigger>
          <TabsTrigger value="organizations">По организациям</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="flex flex-wrap gap-4 pt-4">
              <Select
                value={filter.status || 'all'}
                onValueChange={(v) => handleFilterChange('status', v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="processing">Выполняется</SelectItem>
                  <SelectItem value="completed">Завершён</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                  <SelectItem value="cancelled">Отменён</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filter.source_type || 'all'}
                onValueChange={(v) => handleFilterChange('source_type', v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Источник" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все источники</SelectItem>
                  <SelectItem value="wildberries">Wildberries</SelectItem>
                  <SelectItem value="ozon">Ozon</SelectItem>
                  <SelectItem value="1c">1C</SelectItem>
                  <SelectItem value="generic_csv">CSV</SelectItem>
                  <SelectItem value="generic_xlsx">Excel</SelectItem>
                </SelectContent>
              </Select>

              {filter.organization_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('organization_id', undefined)}
                >
                  Сбросить орг. фильтр
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Jobs Table */}
          <Card>
            <CardContent className="p-0">
              <ImportJobsTable
                jobs={jobs}
                loading={loading}
                onCancel={handleCancel}
                onRetry={handleRetry}
                onDelete={handleDelete}
              />
            </CardContent>
          </Card>

          {/* Pagination */}
          {total > filter.limit! && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={!filter.offset || filter.offset === 0}
                onClick={() =>
                  setFilter((prev) => ({
                    ...prev,
                    offset: Math.max(0, (prev.offset || 0) - (prev.limit || 50)),
                  }))
                }
              >
                Назад
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                {(filter.offset || 0) + 1}–
                {Math.min((filter.offset || 0) + (filter.limit || 50), total)} из {total}
              </span>
              <Button
                variant="outline"
                disabled={(filter.offset || 0) + (filter.limit || 50) >= total}
                onClick={() =>
                  setFilter((prev) => ({
                    ...prev,
                    offset: (prev.offset || 0) + (prev.limit || 50),
                  }))
                }
              >
                Вперёд
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="organizations">
          <Card>
            <CardHeader>
              <CardTitle>Импорты по организациям</CardTitle>
              <CardDescription>
                Статистика импортов для каждой организации
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <OrganizationsSummary data={orgSummary} onSelectOrg={handleOrgSelect} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SourceDistribution stats={stats} />
            <StatusDistribution stats={stats} />
            <RecentActivity stats={stats} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
