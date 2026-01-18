import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'

import {
  getImportDetails,
  cancelImportAdmin,
  retryFailedItems,
  deleteImportJob,
} from '@/api/adminImportService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type {
  ImportJobAdmin,
  ImportJobItemAdmin,
  AdminImportDetailsResponse,
  ImportJobStatus,
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
    second: '2-digit',
  })
}

function StatusBadge({ status }: { status: ImportJobStatus }) {
  const config = IMPORT_STATUS_CONFIG[status] || { label: status, color: 'secondary' }
  return <Badge variant={config.color}>{config.label}</Badge>
}

function ItemStatusBadge({ status }: { status: string }) {
  const colors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    processing: 'default',
    completed: 'outline',
    failed: 'destructive',
    skipped: 'secondary',
  }
  return <Badge variant={colors[status] || 'secondary'}>{status}</Badge>
}

// Job Info Card
function JobInfoCard({ job }: { job: ImportJobAdmin }) {
  const progress =
    job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {job.original_filename || 'Импорт без названия'}
            </CardTitle>
            <CardDescription>
              {IMPORT_SOURCE_LABELS[job.source_type] || job.source_type}
            </CardDescription>
          </div>
          <StatusBadge status={job.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Организация</p>
            <p className="font-medium">{job.organization_name || job.organization_id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Создатель</p>
            <p className="font-medium">{job.creator_email || job.created_by}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Создан</p>
            <p className="font-medium">{formatDate(job.created_at)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Обновлён</p>
            <p className="font-medium">{formatDate(job.updated_at)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Прогресс: {progress}%</span>
            <span>
              {job.processed_rows} / {job.total_rows} строк
            </span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Успешно: {job.successful_rows}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>Ошибок: {job.failed_rows}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Ожидает: {job.total_rows - job.processed_rows}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Error Summary Card
function ErrorSummaryCard({ errors }: { errors: Array<{ error: string; count: number }> }) {
  if (errors.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Ошибки ({errors.reduce((sum, e) => sum + e.count, 0)})
        </CardTitle>
        <CardDescription>Наиболее частые ошибки при импорте</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {errors.map((err, idx) => (
            <div key={idx} className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <p className="text-sm">{err.error}</p>
              <Badge variant="destructive">{err.count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Import Items Table
function ImportItemsTable({
  items,
  loading,
  itemsTotal,
  itemsOffset,
  itemsLimit,
  onPageChange,
  onStatusFilter,
  statusFilter,
}: {
  items: ImportJobItemAdmin[]
  loading: boolean
  itemsTotal: number
  itemsOffset: number
  itemsLimit: number
  onPageChange: (offset: number) => void
  onStatusFilter: (status: string | undefined) => void
  statusFilter: string | undefined
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={statusFilter || 'all'}
          onValueChange={(v) => onStatusFilter(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Фильтр по статусу" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все строки</SelectItem>
            <SelectItem value="completed">Успешные</SelectItem>
            <SelectItem value="failed">Ошибки</SelectItem>
            <SelectItem value="pending">Ожидают</SelectItem>
            <SelectItem value="skipped">Пропущены</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          Показано: {items.length} из {itemsTotal}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Нет строк</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Данные</TableHead>
              <TableHead>Результат</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <Collapsible key={item.id} asChild open={expandedRows.has(item.id)}>
                <>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRow(item.id)}
                  >
                    <TableCell className="font-mono text-sm">{item.row_number}</TableCell>
                    <TableCell>
                      <ItemStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      {item.mapped_data ? (
                        <span className="text-sm">
                          {(item.mapped_data as any).name ||
                            Object.values(item.mapped_data)[0] ||
                            '—'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.status === 'completed' && item.product_id ? (
                        <span className="text-xs text-muted-foreground font-mono">
                          {item.product_id.slice(0, 8)}...
                        </span>
                      ) : item.status === 'failed' && item.error_message ? (
                        <span className="text-xs text-destructive truncate max-w-[200px] block">
                          {item.error_message}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={4} className="p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-sm font-medium mb-2">Исходные данные:</p>
                            <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(item.raw_data, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">Сопоставленные данные:</p>
                            <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(item.mapped_data, null, 2)}
                            </pre>
                          </div>
                          {item.error_message && (
                            <div className="md:col-span-2">
                              <p className="text-sm font-medium mb-2 text-destructive">
                                Ошибка:
                              </p>
                              <p className="text-sm bg-destructive/10 p-2 rounded">
                                {item.error_message}
                              </p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {itemsTotal > itemsLimit && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={itemsOffset === 0}
            onClick={() => onPageChange(Math.max(0, itemsOffset - itemsLimit))}
          >
            Назад
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            {itemsOffset + 1}–{Math.min(itemsOffset + itemsLimit, itemsTotal)} из {itemsTotal}
          </span>
          <Button
            variant="outline"
            disabled={itemsOffset + itemsLimit >= itemsTotal}
            onClick={() => onPageChange(itemsOffset + itemsLimit)}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  )
}

// Main Page Component
export const AdminImportDetailsPage = () => {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<AdminImportDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemsOffset, setItemsOffset] = useState(0)
  const [itemsStatus, setItemsStatus] = useState<string | undefined>(undefined)
  const itemsLimit = 50

  const loadData = useCallback(async () => {
    if (!jobId) return

    setLoading(true)
    setError(null)

    try {
      const result = await getImportDetails(jobId, {
        items_limit: itemsLimit,
        items_offset: itemsOffset,
        items_status: itemsStatus,
      })
      setData(result)
    } catch (err) {
      console.error('Error loading import details:', err)
      setError('Не удалось загрузить данные импорта')
    } finally {
      setLoading(false)
    }
  }, [jobId, itemsOffset, itemsStatus])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCancel = async () => {
    if (!jobId || !confirm('Отменить этот импорт?')) return

    try {
      await cancelImportAdmin(jobId)
      void loadData()
    } catch (err) {
      console.error('Error cancelling import:', err)
      setError('Не удалось отменить импорт')
    }
  }

  const handleRetry = async () => {
    if (!jobId || !confirm('Повторить импорт ошибочных строк?')) return

    try {
      const result = await retryFailedItems(jobId)
      alert(`Сброшено ${result.items_reset} строк для повторного импорта`)
      void loadData()
    } catch (err) {
      console.error('Error retrying import:', err)
      setError('Не удалось запустить повтор')
    }
  }

  const handleDelete = async () => {
    if (!jobId || !confirm('Удалить этот импорт? Это действие нельзя отменить.')) return

    try {
      await deleteImportJob(jobId)
      navigate('/admin/imports')
    } catch (err) {
      console.error('Error deleting import:', err)
      setError('Не удалось удалить импорт')
    }
  }

  const handleStatusFilter = (status: string | undefined) => {
    setItemsStatus(status)
    setItemsOffset(0)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link to="/admin/imports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к списку
          </Link>
        </Button>
      </div>
    )
  }

  if (!data) return null

  const { job, items, items_total, error_summary } = data
  const canCancel = ['pending', 'processing', 'mapping', 'validating'].includes(job.status)
  const canRetry =
    (job.status === 'completed' || job.status === 'failed') && job.failed_rows > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/imports">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Import Details</h1>
            <p className="text-sm text-muted-foreground">ID: {jobId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canCancel && (
            <Button variant="outline" onClick={handleCancel}>
              <XCircle className="mr-2 h-4 w-4" />
              Отменить
            </Button>
          )}
          {canRetry && (
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Повторить ошибки
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Удалить
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Job Info */}
      <JobInfoCard job={job} />

      {/* Error Summary */}
      <ErrorSummaryCard errors={error_summary} />

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Строки импорта</CardTitle>
          <CardDescription>
            Нажмите на строку, чтобы увидеть подробности
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportItemsTable
            items={items}
            loading={loading}
            itemsTotal={items_total}
            itemsOffset={itemsOffset}
            itemsLimit={itemsLimit}
            onPageChange={setItemsOffset}
            onStatusFilter={handleStatusFilter}
            statusFilter={itemsStatus}
          />
        </CardContent>
      </Card>
    </div>
  )
}
