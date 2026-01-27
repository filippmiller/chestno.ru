import { useState, useEffect } from 'react'
import { HexColorPicker } from 'react-colorful'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { QRCustomizationSettings, QRCustomizationUpdate } from '@/types/auth'

interface QRCustomizerProps {
  qrUrl: string
  currentSettings: QRCustomizationSettings | null
  onSave: (payload: QRCustomizationUpdate) => Promise<void>
  onCancel: () => void
}

export const QRCustomizer = ({ qrUrl, currentSettings, onSave, onCancel }: QRCustomizerProps) => {
  const [fgColor, setFgColor] = useState(currentSettings?.foreground_color || '#000000')
  const [bgColor, setBgColor] = useState(currentSettings?.background_color || '#FFFFFF')
  const [style, setStyle] = useState<'squares' | 'dots' | 'rounded'>(currentSettings?.style || 'squares')
  const [saving, setSaving] = useState(false)
  const [contrastRatio, setContrastRatio] = useState<number | null>(null)

  // Calculate contrast ratio whenever colors change
  useEffect(() => {
    const ratio = calculateContrastRatio(fgColor, bgColor)
    setContrastRatio(ratio)
  }, [fgColor, bgColor])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: QRCustomizationUpdate = {
        foreground_color: fgColor,
        background_color: bgColor,
        style,
      }
      await onSave(payload)
    } finally {
      setSaving(false)
    }
  }

  const isValid = contrastRatio !== null && contrastRatio >= 3.0

  return (
    <div className="space-y-6">
      {/* Preview */}
      <div className="flex justify-center p-6 bg-gray-50 rounded-lg">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <QRCodeSVG
            value={qrUrl}
            size={200}
            level="M"
            fgColor={fgColor}
            bgColor={bgColor}
          />
        </div>
      </div>

      {/* Contrast Warning */}
      {contrastRatio !== null && (
        <Alert variant={isValid ? 'default' : 'destructive'}>
          <AlertDescription>
            {isValid ? (
              <span className="text-green-700">
                ✓ Контрастность: {contrastRatio.toFixed(2)}:1 (соответствует WCAG AA)
              </span>
            ) : (
              <span>
                ⚠ Контрастность: {contrastRatio.toFixed(2)}:1 (требуется минимум 3.0:1 для хорошей сканируемости)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Foreground Color */}
        <div className="space-y-3">
          <Label>Цвет QR-кода</Label>
          <HexColorPicker color={fgColor} onChange={setFgColor} style={{ width: '100%' }} />
          <input
            type="text"
            value={fgColor}
            onChange={(e) => setFgColor(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="#000000"
          />
        </div>

        {/* Background Color */}
        <div className="space-y-3">
          <Label>Цвет фона</Label>
          <HexColorPicker color={bgColor} onChange={setBgColor} style={{ width: '100%' }} />
          <input
            type="text"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="#FFFFFF"
          />
        </div>
      </div>

      {/* Style Selection */}
      <div className="space-y-3">
        <Label>Стиль</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={style === 'squares' ? 'default' : 'outline'}
            onClick={() => setStyle('squares')}
          >
            Квадраты
          </Button>
          <Button
            type="button"
            size="sm"
            variant={style === 'dots' ? 'default' : 'outline'}
            onClick={() => setStyle('dots')}
          >
            Точки
          </Button>
          <Button
            type="button"
            size="sm"
            variant={style === 'rounded' ? 'default' : 'outline'}
            onClick={() => setStyle('rounded')}
          >
            Скруглённые
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
        <Button type="button" onClick={handleSave} disabled={!isValid || saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  )
}

// Helper function to calculate contrast ratio (client-side validation)
function calculateContrastRatio(fg: string, bg: string): number {
  const hexToRgb = (hex: string): [number, number, number] => {
    const cleaned = hex.replace('#', '')
    return [
      parseInt(cleaned.substring(0, 2), 16),
      parseInt(cleaned.substring(2, 4), 16),
      parseInt(cleaned.substring(4, 6), 16),
    ]
  }

  const relativeLuminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map((val) => {
      const normalized = val / 255
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  try {
    const l1 = relativeLuminance(hexToRgb(fg))
    const l2 = relativeLuminance(hexToRgb(bg))
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  } catch {
    return 0
  }
}
