import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

import type { GeographicAnomaly, AnomalyStatusUpdate } from '@/types/geoAnomaly'

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  high: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-red-200 text-red-900 border-red-300',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критическая',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  under_review: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-red-100 text-red-800',
  false_positive: 'bg-gray-100 text-gray-800',
  resolved: 'bg-green-100 text-green-800',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  under_review: 'На рассмотрении',
  confirmed: 'Подтверждена',
  false_positive: 'Ложная',
  resolved: 'Решена',
}

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  region_mismatch: 'Несоответствие региона',
  country_mismatch: 'Несоответствие страны',
  suspicious_pattern: 'Подозрительный паттерн',
  velocity_anomaly: 'Аномалия скорости',
}

interface AnomalyAlertProps {
  anomaly: GeographicAnomaly
  onInvestigate?: (anomalyId: string, update: AnomalyStatusUpdate) => Promise<void>
  expanded?: boolean
}

export function AnomalyAlert({ anomaly, onInvestigate, expanded = false }: AnomalyAlertProps) {
  const [showDetails, setShowDetails] = useState(expanded)
  const [investigateDialogOpen, setInvestigateDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>(anomaly.status)
  const [notes, setNotes] = useState('')
  const [resolution, setResolution] = useState('')
  const [loading, setLoading] = useState(false)

  const handleInvestigate = async () => {
    if (!onInvestigate) return

    setLoading(true)
    try {
      await onInvestigate(anomaly.id, {
        status: selectedStatus as AnomalyStatusUpdate['status'],
        investigation_notes: notes || undefined,
        resolution: resolution || undefined,
      })
      setInvestigateDialogOpen(false)
      setNotes('')
      setResolution('')
    } catch (err) {
      console.error('Failed to update anomaly:', err)
    } finally {
      setLoading(false)
    }
  }

  const createdAt = new Date(anomaly.created_at)
  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true, locale: ru })

  return (
    <>
      <Card className={`border-l-4 ${SEVERITY_COLORS[anomaly.severity]?.split(' ')[0] || 'border-gray-200'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={SEVERITY_COLORS[anomaly.severity]}>
                {SEVERITY_LABELS[anomaly.severity] || anomaly.severity}
              </Badge>
              <Badge variant="outline" className={STATUS_COLORS[anomaly.status]}>
                {STATUS_LABELS[anomaly.status] || anomaly.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Скрыть' : 'Подробнее'}
            </Button>
          </div>
          <CardTitle className="text-base mt-2">
            {ANOMALY_TYPE_LABELS[anomaly.anomaly_type] || anomaly.anomaly_type}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Обнаружен в:</span>
              <span className="font-medium">{anomaly.actual_region_name || anomaly.actual_region}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ожидался:</span>
              <span>{anomaly.expected_region}</span>
            </div>
            {anomaly.distance_from_authorized_km && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Расстояние:</span>
                <span>{anomaly.distance_from_authorized_km} км от авторизованной зоны</span>
              </div>
            )}

            {showDetails && (
              <div className="mt-4 space-y-3 border-t pt-3">
                {anomaly.product_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Продукт:</span>
                    <span>{anomaly.product_name}</span>
                  </div>
                )}
                {anomaly.product_sku && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SKU:</span>
                    <span className="font-mono text-xs">{anomaly.product_sku}</span>
                  </div>
                )}
                {anomaly.scan_lat && anomaly.scan_lng && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Координаты:</span>
                    <span className="font-mono text-xs">
                      {anomaly.scan_lat.toFixed(4)}, {anomaly.scan_lng.toFixed(4)}
                    </span>
                  </div>
                )}
                {anomaly.investigated_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Расследовано:</span>
                    <span>
                      {formatDistanceToNow(new Date(anomaly.investigated_at), {
                        addSuffix: true,
                        locale: ru
                      })}
                    </span>
                  </div>
                )}
                {anomaly.investigation_notes && (
                  <div>
                    <span className="text-muted-foreground">Заметки:</span>
                    <p className="mt-1 text-sm bg-muted p-2 rounded">
                      {anomaly.investigation_notes}
                    </p>
                  </div>
                )}
                {anomaly.resolution && (
                  <div>
                    <span className="text-muted-foreground">Решение:</span>
                    <p className="mt-1 text-sm bg-muted p-2 rounded">
                      {anomaly.resolution}
                    </p>
                  </div>
                )}

                {onInvestigate && anomaly.status !== 'resolved' && anomaly.status !== 'false_positive' && (
                  <Button
                    className="w-full mt-2"
                    onClick={() => setInvestigateDialogOpen(true)}
                  >
                    Расследовать
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Investigation Dialog */}
      <Dialog open={investigateDialogOpen} onOpenChange={setInvestigateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Расследование аномалии</DialogTitle>
            <DialogDescription>
              Обновите статус аномалии и добавьте заметки о расследовании.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Новый статус</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_review">На рассмотрении</SelectItem>
                  <SelectItem value="confirmed">Подтверждена (серый рынок)</SelectItem>
                  <SelectItem value="false_positive">Ложное срабатывание</SelectItem>
                  <SelectItem value="resolved">Решена</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Заметки о расследовании</Label>
              <Textarea
                placeholder="Опишите результаты расследования..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {(selectedStatus === 'resolved' || selectedStatus === 'confirmed') && (
              <div className="space-y-2">
                <Label>Принятые меры</Label>
                <Textarea
                  placeholder="Опишите принятые меры..."
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestigateDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleInvestigate} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface AnomalyListProps {
  anomalies: GeographicAnomaly[]
  onInvestigate?: (anomalyId: string, update: AnomalyStatusUpdate) => Promise<void>
  loading?: boolean
}

export function AnomalyList({ anomalies, onInvestigate, loading }: AnomalyListProps) {
  if (loading) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Загрузка аномалий...
      </div>
    )
  }

  if (anomalies.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="text-green-600 text-lg font-medium mb-2">
            Аномалий не обнаружено
          </div>
          <p className="text-sm text-muted-foreground">
            Все сканирования происходят в авторизованных регионах.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly) => (
        <AnomalyAlert
          key={anomaly.id}
          anomaly={anomaly}
          onInvestigate={onInvestigate}
        />
      ))}
    </div>
  )
}
