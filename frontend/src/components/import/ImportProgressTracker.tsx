import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { ImportJob, ImportJobStatus } from '@/types/import'

interface ImportProgressTrackerProps {
  job: ImportJob
}

export function ImportProgressTracker({ job }: ImportProgressTrackerProps) {
  const percentage =
    job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0

  const isComplete = ['completed', 'failed', 'cancelled'].includes(job.status)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {isComplete ? 'Импорт завершён' : 'Импорт выполняется...'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {getStatusDescription(job.status)}
        </p>
      </div>

      {/* Progress bar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Прогресс</CardTitle>
            <span className="text-2xl font-bold">{percentage}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={percentage} className="h-3" />
          <p className="mt-2 text-sm text-muted-foreground">
            Обработано {job.processed_rows} из {job.total_rows} строк
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Успешно"
          value={job.successful_rows}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          className="border-green-200 bg-green-50"
        />
        <StatCard
          title="Ошибки"
          value={job.failed_rows}
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          className="border-red-200 bg-red-50"
        />
        <StatCard
          title="Всего"
          value={job.total_rows}
          icon={
            isComplete ? (
              <CheckCircle className="h-5 w-5 text-blue-600" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            )
          }
          className="border-blue-200 bg-blue-50"
        />
      </div>

      {/* Status indicator */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <StatusIcon status={job.status} />
            <div>
              <p className="font-medium">{getStatusLabel(job.status)}</p>
              {job.error_message && (
                <p className="text-sm text-red-600">{job.error_message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation errors preview */}
      {job.validation_errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ошибки валидации</CardTitle>
            <CardDescription>Первые {Math.min(job.validation_errors.length, 10)} ошибок</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {job.validation_errors.slice(0, 10).map((err, i) => (
                <li key={i} className="text-red-600">
                  Строка {err.row_number}: {err.message}
                  {err.field && ` (поле: ${err.field})`}
                </li>
              ))}
              {job.validation_errors.length > 10 && (
                <li className="text-muted-foreground">
                  ... и ещё {job.validation_errors.length - 10} ошибок
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  icon: React.ReactNode
  className?: string
}

function StatCard({ title, value, icon, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 py-4">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusIcon({ status }: { status: ImportJobStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-6 w-6 text-green-600" />
    case 'failed':
    case 'cancelled':
      return <XCircle className="h-6 w-6 text-red-600" />
    default:
      return <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
  }
}

function getStatusLabel(status: ImportJobStatus): string {
  const labels: Record<ImportJobStatus, string> = {
    pending: 'Ожидает обработки',
    mapping: 'Настройка сопоставления',
    validating: 'Проверка данных',
    preview: 'Готов к импорту',
    processing: 'Импорт выполняется',
    completed: 'Импорт успешно завершён',
    failed: 'Импорт завершился с ошибкой',
    cancelled: 'Импорт отменён',
  }
  return labels[status] || status
}

function getStatusDescription(status: ImportJobStatus): string {
  const descriptions: Record<ImportJobStatus, string> = {
    pending: 'Файл загружен, ожидает настройки',
    mapping: 'Настройте сопоставление колонок',
    validating: 'Проверяем данные перед импортом',
    preview: 'Проверьте данные и запустите импорт',
    processing: 'Создаём товары в системе...',
    completed: 'Все товары успешно импортированы',
    failed: 'Произошла ошибка при импорте',
    cancelled: 'Импорт был отменён пользователем',
  }
  return descriptions[status] || ''
}
