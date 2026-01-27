import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createQrCode, getQrCodeStats, getQrCodeDetailedStats, getBusinessPublicUrl, listQrCodes, getQrTimeline, getQrCustomization, updateQrCustomization, bulkCreateQrCodes, exportQrCodes } from '@/api/authService'
import { BusinessQrCode } from '@/components/qr/BusinessQrCode'
import { QRGeoMap } from '@/components/qr/QRGeoMap'
import { QRTimelineChart } from '@/components/qr/QRTimelineChart'
import { QRCustomizer } from '@/components/qr/QRCustomizer'
import { BulkCreateModal } from '@/components/qr/BulkCreateModal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/store/userStore'
import type { QRCode, QRCodePayload, QRCodeStats, QRCodeDetailedStats, QRCodeTimeline, QRCustomizationSettings, QRCustomizationUpdate } from '@/types/auth'

const qrSchema = z.object({
  label: z.string().min(2, 'Введите название'),
})

type QRFormValues = z.infer<typeof qrSchema>

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager'])

export const OrganizationQrPage = () => {
  const { organizations, memberships, selectedOrganizationId, user } = useUserStore()
  const [qrCodes, setQrCodes] = useState<QRCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, QRCodeStats>>({})
  const [detailedStatsMap, setDetailedStatsMap] = useState<Record<string, QRCodeDetailedStats>>({})
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null)
  const [businessPublicUrl, setBusinessPublicUrl] = useState<string | null>(null)
  const [timelineMap, setTimelineMap] = useState<Record<string, QRCodeTimeline>>({})
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [customizationMap, setCustomizationMap] = useState<Record<string, QRCustomizationSettings | null>>({})
  const [editingCustomizationQrId, setEditingCustomizationQrId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedQrIds, setSelectedQrIds] = useState<Set<string>>(new Set())
  const [bulkCreateModalOpen, setBulkCreateModalOpen] = useState(false)
  const form = useForm<QRFormValues>({ resolver: zodResolver(qrSchema), defaultValues: { label: '' } })
  const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000'

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )
  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canCreate = membership ? MANAGER_ROLES.has(membership.role) : false

  const organizationId = currentOrganization?.id

  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    Promise.all([
      listQrCodes(organizationId).catch(() => []),
      getBusinessPublicUrl(organizationId)
        .then((data) => setBusinessPublicUrl(data.public_url))
        .catch(() => setBusinessPublicUrl(null)),
    ])
      .then(([codes]) => setQrCodes(codes))
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false))
  }, [organizationId])

  if (!user || !currentOrganization || !organizationId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно данных</AlertTitle>
          <AlertDescription>Сначала войдите и выберите организацию.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const apiCreate = async (values: QRFormValues) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const payload: QRCodePayload = { label: values.label }
      await createQrCode(organizationId, payload)
      const list = await listQrCodes(organizationId)
      setQrCodes(list)
      form.reset({ label: '' })
    } catch (err) {
      console.error(err)
      setError('Не удалось создать QR-код')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (code: QRCode) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const stats = await getQrCodeStats(organizationId, code.id)
      setStatsMap((prev) => ({ ...prev, [code.id]: stats }))
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить статистику')
    } finally {
      setLoading(false)
    }
  }

  const loadDetailedStats = async (code: QRCode) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const stats = await getQrCodeDetailedStats(organizationId, code.id)
      setDetailedStatsMap((prev) => ({ ...prev, [code.id]: stats }))
      setExpandedQrId(code.id)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить детальную статистику')
    } finally {
      setLoading(false)
    }
  }

  const loadTimeline = async (code: QRCode, period: '7d' | '30d' | '90d' | '1y') => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const timeline = await getQrTimeline(organizationId, code.id, period)
      setTimelineMap((prev) => ({ ...prev, [code.id]: timeline }))
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить данные временной шкалы')
    } finally {
      setLoading(false)
    }
  }

  const openCustomizer = async (code: QRCode) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const customization = await getQrCustomization(organizationId, code.id)
      setCustomizationMap((prev) => ({ ...prev, [code.id]: customization }))
      setEditingCustomizationQrId(code.id)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCustomization = async (payload: QRCustomizationUpdate) => {
    if (!organizationId || !editingCustomizationQrId) return
    setLoading(true)
    setError(null)
    try {
      const updated = await updateQrCustomization(organizationId, editingCustomizationQrId, payload)
      setCustomizationMap((prev) => ({ ...prev, [editingCustomizationQrId]: updated }))
      setEditingCustomizationQrId(null)
    } catch (err) {
      console.error(err)
      setError('Не удалось сохранить настройки')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleBulkCreate = async (labels: string[]) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      await bulkCreateQrCodes(organizationId, labels)
      const list = await listQrCodes(organizationId)
      setQrCodes(list)
    } catch (err) {
      console.error(err)
      setError('Не удалось создать QR-коды')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleExportSelected = async () => {
    if (!organizationId || selectedQrIds.size === 0) return
    setLoading(true)
    setError(null)
    try {
      const blob = await exportQrCodes(organizationId, Array.from(selectedQrIds))
      // Trigger download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'qr-codes-export.zip'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setSelectedQrIds(new Set())
      setSelectionMode(false)
    } catch (err) {
      console.error(err)
      setError('Не удалось экспортировать QR-коды')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = (qrId: string) => {
    setSelectedQrIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(qrId)) {
        newSet.delete(qrId)
      } else {
        newSet.add(qrId)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedQrIds(new Set(qrCodes.map((qr) => qr.id)))
  }

  const deselectAll = () => {
    setSelectedQrIds(new Set())
  }

  const toggleDetailedStats = (code: QRCode) => {
    if (expandedQrId === code.id) {
      setExpandedQrId(null)
    } else if (detailedStatsMap[code.id]) {
      setExpandedQrId(code.id)
    } else {
      loadDetailedStats(code)
    }
  }

  const qrLink = (code: string) => {
    const base = backendUrl.replace(/\/$/, '')
    return `${base}/q/${code}`
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">QR-коды</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">Генерируйте QR для продукции и отслеживайте сканы.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Business QR Code */}
      {businessPublicUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Ваш QR-код</CardTitle>
            <CardDescription>
              Распечатайте QR-код и разместите его на входе, на кассе, на упаковке или флаерах. Покупатели смогут
              просканировать код, перейти на вашу страницу на платформе и оставить отзыв.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessQrCode publicUrl={businessPublicUrl} businessName={currentOrganization.name} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Список QR-кодов</CardTitle>
              <CardDescription>Используйте эти ссылки на упаковке или в презентациях.</CardDescription>
            </div>
            {canCreate && qrCodes.length > 0 && (
              <div className="flex gap-2">
                {!selectionMode ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setBulkCreateModalOpen(true)}>
                      Массовое создание
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectionMode(true)}>
                      Выбрать несколько
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={selectAll}>
                      Выбрать все
                    </Button>
                    <Button size="sm" variant="outline" onClick={deselectAll}>
                      Снять выбор
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExportSelected}
                      disabled={selectedQrIds.size === 0 || loading}
                    >
                      Экспортировать ({selectedQrIds.size})
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectionMode(false); deselectAll() }}>
                      Отмена
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Загружаем…</p>}
          {!loading && qrCodes.length === 0 && (
            <p className="text-sm text-muted-foreground">Ещё нет QR-кодов</p>
          )}
          {!loading &&
            qrCodes.map((code) => (
              <div key={code.id} className="rounded-md border border-border p-4">
                <div className="flex gap-3">
                  {selectionMode && (
                    <div className="flex items-start pt-1">
                      <input
                        type="checkbox"
                        checked={selectedQrIds.has(code.id)}
                        onChange={() => toggleSelection(code.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col gap-1">
                    <p className="text-lg font-semibold">{code.label ?? code.code}</p>
                    <p className="text-sm text-muted-foreground">{qrLink(code.code)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(qrLink(code.code))}>
                      Скопировать URL
                    </Button>
                    <Button size="sm" onClick={() => loadStats(code)} disabled={loading}>
                      Показать статистику
                    </Button>
                    {canCreate && (
                      <Button size="sm" variant="outline" onClick={() => openCustomizer(code)} disabled={loading}>
                        Настроить вид
                      </Button>
                    )}
                  </div>
                  {statsMap[code.id] && (
                    <div className="mt-2 rounded-md border border-dashed border-border p-2 text-sm text-muted-foreground">
                      <p>Всего сканов: {statsMap[code.id].total}</p>
                      <p>За 7 дней: {statsMap[code.id].last_7_days}</p>
                      <p>За 30 дней: {statsMap[code.id].last_30_days}</p>
                      <Button
                        size="sm"
                        variant="link"
                        className="mt-1 h-auto p-0"
                        onClick={() => toggleDetailedStats(code)}
                      >
                        {expandedQrId === code.id ? 'Скрыть детали' : 'Показать детали'}
                      </Button>
                    </div>
                  )}
                  {expandedQrId === code.id && detailedStatsMap[code.id] && (
                    <div className="mt-3 space-y-4 rounded-md border border-border p-3">
                      <div>
                        <h4 className="mb-2 text-sm font-medium">География сканирований</h4>
                        <QRGeoMap geoBreakdown={detailedStatsMap[code.id].geo_breakdown} />
                        {detailedStatsMap[code.id].geo_breakdown.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {detailedStatsMap[code.id].geo_breakdown.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{item.city ?? 'Неизвестно'}, {item.country ?? 'N/A'}</span>
                                <span className="font-medium">{item.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {detailedStatsMap[code.id].utm_breakdown.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-sm font-medium">UTM-метки</h4>
                          <div className="space-y-1">
                            {detailedStatsMap[code.id].utm_breakdown.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>
                                  {item.utm_source && `source: ${item.utm_source}`}
                                  {item.utm_medium && `, medium: ${item.utm_medium}`}
                                  {item.utm_campaign && `, campaign: ${item.utm_campaign}`}
                                </span>
                                <span className="font-medium">{item.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium">Временная шкала</h4>
                          <div className="flex gap-1">
                            {(['7d', '30d', '90d', '1y'] as const).map((period) => (
                              <Button
                                key={period}
                                size="sm"
                                variant={selectedPeriod === period ? 'default' : 'outline'}
                                onClick={() => {
                                  setSelectedPeriod(period)
                                  loadTimeline(code, period)
                                }}
                                disabled={loading}
                              >
                                {period === '7d' && '7 дней'}
                                {period === '30d' && '30 дней'}
                                {period === '90d' && '90 дней'}
                                {period === '1y' && '1 год'}
                              </Button>
                            ))}
                          </div>
                        </div>
                        {timelineMap[code.id] ? (
                          <QRTimelineChart timeline={timelineMap[code.id]} />
                        ) : (
                          <div className="flex h-80 items-center justify-center border border-dashed">
                            <Button
                              variant="outline"
                              onClick={() => loadTimeline(code, selectedPeriod)}
                              disabled={loading}
                            >
                              Загрузить временную шкалу
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Создать новый QR-код</CardTitle>
            <CardDescription>Каждый QR-код ведёт на публичную страницу вашей организации.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(apiCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Например, Наклейка для ведра" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={loading}>
                  Создать
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>Только владельцы и менеджеры могут создавать QR-коды</AlertTitle>
          <AlertDescription>Обратитесь к администратору организации.</AlertDescription>
        </Alert>
      )}

      {/* Customizer Dialog */}
      <Dialog open={editingCustomizationQrId !== null} onOpenChange={(open) => !open && setEditingCustomizationQrId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Настройка внешнего вида QR-кода</DialogTitle>
            <DialogDescription>
              Измените цвета и стиль QR-кода. Убедитесь, что контрастность достаточна для хорошей сканируемости.
            </DialogDescription>
          </DialogHeader>
          {editingCustomizationQrId && (
            <QRCustomizer
              qrUrl={qrLink(qrCodes.find((c) => c.id === editingCustomizationQrId)?.code || '')}
              currentSettings={customizationMap[editingCustomizationQrId] || null}
              onSave={handleSaveCustomization}
              onCancel={() => setEditingCustomizationQrId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Create Modal */}
      <BulkCreateModal
        open={bulkCreateModalOpen}
        onClose={() => setBulkCreateModalOpen(false)}
        onSubmit={handleBulkCreate}
      />
    </div>
  )
}

