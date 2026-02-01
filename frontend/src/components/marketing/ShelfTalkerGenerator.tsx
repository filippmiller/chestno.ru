/**
 * ShelfTalkerGenerator Component
 *
 * Generate printable shelf talkers, hang tags, and digital signage content
 * that display product trust badges and QR codes for easy consumer scanning.
 */
import { useState } from 'react'
import {
  Download,
  Image,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  Settings,
  Tag,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { httpClient } from '@/api/httpClient'
import type {
  ShelfTalkerConfig,
  ShelfTalkerType,
  StatusLevel,
  SHELF_TALKER_PRESETS,
} from '@/types/retail'

interface ShelfTalkerGeneratorProps {
  productId?: string
  productName?: string
  statusLevel?: StatusLevel
  qrCodeUrl?: string
  className?: string
}

const TYPE_CONFIG: Record<ShelfTalkerType, { label: string; icon: React.ElementType; description: string }> = {
  shelf_talker: {
    label: 'Ценник',
    icon: Tag,
    description: 'Для размещения на полке',
  },
  hang_tag: {
    label: 'Подвесной тег',
    icon: Tag,
    description: 'Для подвешивания на товар',
  },
  sticker: {
    label: 'Наклейка',
    icon: Image,
    description: 'Для наклеивания на товар',
  },
  poster: {
    label: 'Постер',
    icon: Printer,
    description: 'Для размещения в магазине',
  },
  digital_sign: {
    label: 'Цифровая вывеска',
    icon: Image,
    description: 'Для цифровых экранов',
  },
}

const SIZE_PRESETS: Record<string, { label: string; width: number; height: number; dpi: number }> = {
  small: { label: 'Малый (52x74мм)', width: 52, height: 74, dpi: 300 },
  medium: { label: 'Средний (70x100мм)', width: 70, height: 100, dpi: 300 },
  large: { label: 'Большой (100x150мм)', width: 100, height: 150, dpi: 300 },
  a4_poster: { label: 'A4 Постер', width: 210, height: 297, dpi: 300 },
  digital_hd: { label: 'HD (1920x1080)', width: 1920, height: 1080, dpi: 72 },
  digital_4k: { label: '4K (3840x2160)', width: 3840, height: 2160, dpi: 72 },
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
}

export function ShelfTalkerGenerator({
  productId,
  productName = 'Название товара',
  statusLevel = 'B',
  qrCodeUrl = 'https://chestno.ru/product/demo',
  className = '',
}: ShelfTalkerGeneratorProps) {
  const [type, setType] = useState<ShelfTalkerType>('shelf_talker')
  const [sizePreset, setSizePreset] = useState('medium')
  const [tagline, setTagline] = useState('Проверено Честно')
  const [showPrice, setShowPrice] = useState(false)
  const [price, setPrice] = useState('')
  const [accentColor, setAccentColor] = useState(STATUS_COLORS[statusLevel])
  const [includeChestnoLogo, setIncludeChestnoLogo] = useState(true)
  const [language, setLanguage] = useState<'ru' | 'en'>('ru')
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const size = SIZE_PRESETS[sizePreset]

  // Generate shelf talker
  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setGeneratedUrl(null)

    const config: ShelfTalkerConfig = {
      type,
      size: {
        width: size.width,
        height: size.height,
        dpi: size.dpi,
      },
      content: {
        productName,
        statusLevel,
        qrCodeUrl,
        tagline,
        showPrice,
        price: showPrice && price ? parseFloat(price) : undefined,
      },
      branding: {
        accentColor,
        includeChestnoLogo,
      },
      language,
    }

    try {
      const response = await httpClient.post<{ download_url: string; preview_url: string }>(
        '/api/marketing/shelf-talker/generate',
        { config, product_id: productId }
      )
      setGeneratedUrl(response.data.preview_url || response.data.download_url)
    } catch (err) {
      console.error('Generation failed:', err)
      setError('Не удалось сгенерировать материал. Попробуйте позже.')
    } finally {
      setGenerating(false)
    }
  }

  // Download generated file
  const handleDownload = () => {
    if (generatedUrl) {
      const link = document.createElement('a')
      link.href = generatedUrl
      link.download = `shelf-talker-${productId || 'demo'}.png`
      link.click()
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Настройки
            </CardTitle>
            <CardDescription>
              Настройте параметры рекламного материала
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label>Тип материала</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.entries(TYPE_CONFIG) as [ShelfTalkerType, typeof TYPE_CONFIG[ShelfTalkerType]][]).map(
                  ([key, config]) => {
                    const Icon = config.icon
                    return (
                      <button
                        key={key}
                        onClick={() => setType(key)}
                        className={`
                          flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors
                          ${type === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}
                        `}
                      >
                        <Icon className={`h-5 w-5 ${type === key ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-medium">{config.label}</span>
                      </button>
                    )
                  }
                )}
              </div>
            </div>

            {/* Size Selection */}
            <div className="space-y-2">
              <Label>Размер</Label>
              <Select value={sizePreset} onValueChange={setSizePreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SIZE_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {size.width}x{size.height}{type.includes('digital') ? 'px' : 'мм'}, {size.dpi} DPI
              </p>
            </div>

            {/* Tagline */}
            <div className="space-y-2">
              <Label>Слоган</Label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Проверено Честно"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPrice"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="showPrice">Показывать цену</Label>
              </div>
              {showPrice && (
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Цена в рублях"
                />
              )}
            </div>

            {/* Branding */}
            <div className="space-y-4">
              <Label>Брендинг</Label>

              <div className="flex items-center gap-4">
                <Label className="text-sm">Акцентный цвет</Label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-8 w-16 cursor-pointer rounded border"
                />
                <div className="flex gap-1">
                  {Object.entries(STATUS_COLORS).map(([level, color]) => (
                    <button
                      key={level}
                      onClick={() => setAccentColor(color)}
                      className={`h-6 w-6 rounded ${accentColor === color ? 'ring-2 ring-offset-2' : ''}`}
                      style={{ backgroundColor: color }}
                      title={`Уровень ${level}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeLogo"
                  checked={includeChestnoLogo}
                  onChange={(e) => setIncludeChestnoLogo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="includeLogo">Включить логотип Честно</Label>
              </div>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>Язык</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as 'ru' | 'en')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Сгенерировать
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Предпросмотр
            </CardTitle>
            <CardDescription>
              Примерный вид материала
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Preview Container */}
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 p-8">
              {generatedUrl ? (
                <img
                  src={generatedUrl}
                  alt="Generated shelf talker"
                  className="max-h-[400px] max-w-full rounded shadow-lg"
                />
              ) : (
                // Mock Preview
                <div
                  className="relative flex flex-col items-center justify-between rounded-lg bg-white p-4 shadow-lg"
                  style={{
                    width: Math.min(size.width * 1.5, 200),
                    minHeight: Math.min(size.height * 1.5, 280),
                    border: `3px solid ${accentColor}`,
                  }}
                >
                  {/* Status Badge */}
                  <Badge
                    className="text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Уровень {statusLevel}
                  </Badge>

                  {/* Product Name */}
                  <div className="my-4 text-center">
                    <p className="text-xs font-bold">{productName}</p>
                    {showPrice && price && (
                      <p className="mt-1 text-lg font-bold">{price} ₽</p>
                    )}
                  </div>

                  {/* QR Code Placeholder */}
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-gray-100">
                    <QrCode className="h-12 w-12 text-gray-400" />
                  </div>

                  {/* Tagline */}
                  <p className="mt-2 text-center text-[8px] text-gray-600">{tagline}</p>

                  {/* Logo */}
                  {includeChestnoLogo && (
                    <p className="mt-1 text-[6px] font-bold text-primary">Честно</p>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="mt-4 text-center text-sm text-destructive">{error}</p>
            )}

            {/* Download Actions */}
            {generatedUrl && (
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setGeneratedUrl(null)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Создать новый
                </Button>
                <Button onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Скачать
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Templates Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Готовые шаблоны</CardTitle>
          <CardDescription>
            Выберите готовый шаблон для быстрого создания материала
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { id: 'minimal', name: 'Минимальный', description: 'Только бейдж и QR' },
              { id: 'informative', name: 'Информативный', description: 'Бейдж + слоган + QR' },
              { id: 'premium', name: 'Премиум', description: 'Полная информация' },
              { id: 'promo', name: 'Промо', description: 'С ценой и акцией' },
            ].map((template) => (
              <button
                key={template.id}
                className="rounded-lg border p-4 text-left transition-colors hover:bg-muted"
                onClick={() => {
                  // Apply template settings
                  if (template.id === 'minimal') {
                    setTagline('')
                    setShowPrice(false)
                    setIncludeChestnoLogo(false)
                  } else if (template.id === 'promo') {
                    setShowPrice(true)
                    setTagline('Специальная цена!')
                  }
                }}
              >
                <div className="flex h-24 items-center justify-center rounded bg-muted">
                  <Tag className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-2 font-medium">{template.name}</p>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ShelfTalkerGenerator
