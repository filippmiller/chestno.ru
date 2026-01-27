import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface BulkCreateModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (labels: string[]) => Promise<void>
  maxAllowed?: number
}

export const BulkCreateModal = ({ open, onClose, onSubmit, maxAllowed }: BulkCreateModalProps) => {
  const [labelsText, setLabelsText] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labels = labelsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const count = labels.length
  const isValid = count > 0 && count <= 50
  const quotaExceeded = maxAllowed !== undefined && count > maxAllowed

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      // Parse CSV (simple version - assumes one label per line)
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      setLabelsText(lines.join('\n'))
    }
    reader.readAsText(file)
  }

  const handleSubmit = async () => {
    if (!isValid || quotaExceeded) return

    setCreating(true)
    setError(null)
    try {
      await onSubmit(labels)
      setLabelsText('')
      onClose()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать QR-коды')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    if (!creating) {
      setLabelsText('')
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Массовое создание QR-кодов</DialogTitle>
          <DialogDescription>
            Введите названия QR-кодов (одно на строку) или загрузите CSV файл.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-upload">Загрузить CSV файл</Label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={creating}
            />
          </div>

          {/* Text Area */}
          <div className="space-y-2">
            <Label htmlFor="labels-input">Названия QR-кодов</Label>
            <textarea
              id="labels-input"
              value={labelsText}
              onChange={(e) => setLabelsText(e.target.value)}
              placeholder="Наклейка для ведра&#10;Флаер для магазина&#10;QR для упаковки..."
              className="w-full h-64 px-3 py-2 border rounded-md text-sm font-mono"
              disabled={creating}
            />
          </div>

          {/* Count and Quota Info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Будет создано: <strong>{count}</strong> QR-кодов</span>
            {maxAllowed !== undefined && (
              <span className={quotaExceeded ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                {quotaExceeded ? '⚠ Превышен лимит!' : `Доступно: ${maxAllowed}`}
              </span>
            )}
          </div>

          {/* Validation Warnings */}
          {count > 50 && (
            <Alert variant="destructive">
              <AlertDescription>Максимум 50 QR-кодов за раз. Удалите лишние строки.</AlertDescription>
            </Alert>
          )}

          {quotaExceeded && maxAllowed !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>
                Вы можете создать максимум {maxAllowed} QR-кодов. Обновите подписку для увеличения лимита.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview Table (first 5) */}
          {count > 0 && count <= 50 && (
            <div className="border rounded-md p-3">
              <p className="text-sm font-medium mb-2">Предпросмотр:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {labels.slice(0, 5).map((label, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    {idx + 1}. {label}
                  </div>
                ))}
                {count > 5 && <div className="text-sm text-gray-500 italic">...и ещё {count - 5}</div>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={creating}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || quotaExceeded || creating}
            >
              {creating ? 'Создаём...' : `Создать (${count})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
