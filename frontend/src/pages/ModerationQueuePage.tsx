/**
 * Moderation Queue Page
 * Main moderation dashboard for content moderators.
 */
import { useState, useCallback } from 'react'
import { useAuthV2 } from '@/auth/AuthProviderV2'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModerationStats } from '@/components/moderation/ModerationStats'
import { ModerationQueue } from '@/components/moderation/ModerationQueue'
import { ModerationItemDetail } from '@/components/moderation/ModerationItemDetail'
import type { ModerationQueueItem } from '@/types/moderation'
import { decideQueueItem, assignQueueItem } from '@/api/moderationService'

const MODERATOR_ROLES = new Set(['platform_admin', 'moderator'])

export function ModerationQueuePage() {
  const { platformRoles } = useAuthV2()
  const canModerate = platformRoles.some((role) => MODERATOR_ROLES.has(role))

  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleAssign = async (itemId: string) => {
    try {
      const updated = await assignQueueItem(itemId)
      setSelectedItem(updated)
      refresh()
    } catch (err) {
      console.error('Failed to assign item:', err)
      setError('Не удалось взять элемент')
    }
  }

  const handleDecision = async (
    itemId: string,
    action: string,
    notes?: string,
    violationType?: string,
    guidelineCode?: string
  ) => {
    try {
      await decideQueueItem(itemId, {
        action: action as 'approve' | 'reject' | 'escalate',
        notes,
        violation_type: violationType,
        guideline_code: guidelineCode,
      })
      setSelectedItem(null)
      refresh()
    } catch (err) {
      console.error('Failed to make decision:', err)
      setError('Не удалось принять решение')
    }
  }

  if (!canModerate) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно прав</AlertTitle>
          <AlertDescription>
            Эта страница доступна только администраторам и модераторам платформы.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <h1 className="text-2xl font-bold">Модерация контента</h1>
          <p className="text-muted-foreground mt-1">
            Очередь на проверку и инструменты модератора
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="queue" className="space-y-6">
          <TabsList>
            <TabsTrigger value="queue">Очередь</TabsTrigger>
            <TabsTrigger value="reports">Жалобы</TabsTrigger>
            <TabsTrigger value="appeals">Апелляции</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-6">
            {/* Stats */}
            <ModerationStats refreshKey={refreshKey} onError={setError} />

            {/* Queue */}
            <ModerationQueue
              onItemSelect={setSelectedItem}
              selectedItemId={selectedItem?.id}
              onRefresh={refresh}
              showBatchActions
            />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsTab />
          </TabsContent>

          <TabsContent value="appeals" className="space-y-6">
            <AppealsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ModerationItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDecision={(id, action, notes, violationType, guidelineCode) =>
            handleDecision(id, action, notes, violationType, guidelineCode)
          }
          onAssign={() => handleAssign(selectedItem.id)}
        />
      )}
    </div>
  )
}

/**
 * Reports Tab Component
 */
import { useEffect, useState as useStateReports } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listReports, updateReportStatus } from '@/api/reportService'
import type { ContentReport } from '@/types/moderation'
import { REPORT_REASON_LABELS, CONTENT_TYPE_LABELS } from '@/types/moderation'

function ReportsTab() {
  const [reports, setReports] = useStateReports<ContentReport[]>([])
  const [loading, setLoading] = useStateReports(true)
  const [total, setTotal] = useStateReports(0)

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    setLoading(true)
    try {
      const data = await listReports({ limit: 50 })
      setReports(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(reportId: string, status: 'valid' | 'invalid' | 'duplicate') {
    try {
      await updateReportStatus(reportId, status)
      loadReports()
    } catch (err) {
      console.error('Failed to update report:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Всего жалоб: {total}</span>
        <Button variant="outline" size="sm" onClick={loadReports}>
          Обновить
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Нет активных жалоб
          </CardContent>
        </Card>
      ) : (
        reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">
                    {CONTENT_TYPE_LABELS[report.content_type as keyof typeof CONTENT_TYPE_LABELS] ||
                      report.content_type}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    ID: {report.content_id.slice(0, 8)}...
                  </p>
                </div>
                <Badge
                  variant={
                    report.status === 'valid'
                      ? 'default'
                      : report.status === 'invalid'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {report.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Причина:</span>{' '}
                  {REPORT_REASON_LABELS[report.reason] || report.reason}
                </p>
                {report.reason_details && (
                  <p className="text-sm text-muted-foreground">{report.reason_details}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(report.created_at).toLocaleString('ru-RU')}
                </p>

                {report.status === 'new' && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => handleStatusChange(report.id, 'valid')}>
                      Подтвердить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(report.id, 'invalid')}
                    >
                      Отклонить
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(report.id, 'duplicate')}
                    >
                      Дубликат
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

/**
 * Appeals Tab Component
 */
import { listAppeals, decideAppeal } from '@/api/reportService'
import type { ModerationAppeal } from '@/types/moderation'

function AppealsTab() {
  const [appeals, setAppeals] = useStateReports<ModerationAppeal[]>([])
  const [loading, setLoading] = useStateReports(true)
  const [total, setTotal] = useStateReports(0)

  useEffect(() => {
    loadAppeals()
  }, [])

  async function loadAppeals() {
    setLoading(true)
    try {
      const data = await listAppeals({ limit: 50 })
      setAppeals(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load appeals:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDecision(
    appealId: string,
    decision: 'upheld' | 'overturned' | 'partially_overturned'
  ) {
    const notes = window.prompt('Комментарий к решению:')
    if (notes === null) return

    try {
      await decideAppeal(appealId, decision, notes)
      loadAppeals()
    } catch (err) {
      console.error('Failed to decide appeal:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Всего апелляций: {total}</span>
        <Button variant="outline" size="sm" onClick={loadAppeals}>
          Обновить
        </Button>
      </div>

      {appeals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Нет активных апелляций
          </CardContent>
        </Card>
      ) : (
        appeals.map((appeal) => (
          <Card key={appeal.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">
                    Апелляция на{' '}
                    {CONTENT_TYPE_LABELS[appeal.content_type] || appeal.content_type}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    ID контента: {appeal.content_id.slice(0, 8)}...
                  </p>
                </div>
                <Badge
                  variant={
                    appeal.status === 'overturned'
                      ? 'default'
                      : appeal.status === 'upheld'
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {appeal.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Причина апелляции:</span> {appeal.appeal_reason}
                </p>
                {appeal.additional_context && (
                  <p className="text-sm text-muted-foreground">{appeal.additional_context}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(appeal.created_at).toLocaleString('ru-RU')}
                </p>

                {appeal.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => handleDecision(appeal.id, 'overturned')}>
                      Удовлетворить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecision(appeal.id, 'partially_overturned')}
                    >
                      Частично
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDecision(appeal.id, 'upheld')}
                    >
                      Отклонить
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
