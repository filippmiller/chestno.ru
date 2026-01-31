import { useEffect, useMemo, useState, useCallback } from 'react'
import { Copy, Check, Code, ExternalLink, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserStore } from '@/store/userStore'

type WidgetSize = 'small' | 'medium' | 'large'
type WidgetTheme = 'light' | 'dark' | 'auto'
type WidgetLanguage = 'ru' | 'en'

interface WidgetConfig {
  size: WidgetSize
  theme: WidgetTheme
  primaryColor: string
  showLogo: boolean
  showReviews: boolean
  showRating: boolean
  language: WidgetLanguage
  borderRadius: number
}

const DEFAULT_CONFIG: WidgetConfig = {
  size: 'medium',
  theme: 'light',
  primaryColor: '',
  showLogo: true,
  showReviews: true,
  showRating: true,
  language: 'ru',
  borderRadius: 8,
}

const SIZE_LABELS: Record<WidgetSize, { ru: string; description: string }> = {
  small: { ru: 'Компактный', description: 'Только значок статуса' },
  medium: { ru: 'Средний', description: 'Значок + рейтинг' },
  large: { ru: 'Полный', description: 'Значок + рейтинг + количество отзывов' },
}

const THEME_LABELS: Record<WidgetTheme, string> = {
  light: 'Светлая',
  dark: 'Темная',
  auto: 'Автоматическая',
}

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager'])

export const WidgetConfiguratorPage = () => {
  const { organizations, memberships, selectedOrganizationId, user } = useUserStore()
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG)
  const [copied, setCopied] = useState<'script' | 'iframe' | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )

  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canManage = membership ? MANAGER_ROLES.has(membership.role) : false
  const orgSlug = currentOrganization?.slug

  const backendUrl = useMemo(() => {
    const envUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim()
    if (envUrl) return envUrl.replace(/\/$/, '')
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }, [])

  // Build widget URL with parameters
  const buildWidgetUrl = useCallback((type: 'badge' | 'iframe' | 'preview') => {
    if (!orgSlug) return ''

    const params = new URLSearchParams()

    if (config.size !== 'medium') params.set('size', config.size)
    if (config.theme !== 'light') params.set('theme', config.theme)
    if (config.primaryColor) params.set('color', config.primaryColor.replace('#', ''))
    if (!config.showLogo) params.set('logo', 'false')
    if (!config.showReviews) params.set('reviews', 'false')
    if (!config.showRating) params.set('rating', 'false')
    if (config.language !== 'ru') params.set('lang', config.language)
    if (config.borderRadius !== 8) params.set('radius', config.borderRadius.toString())

    const queryString = params.toString()
    const baseUrl = `${backendUrl}/api/v1/widgets/${type}/${orgSlug}`

    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [orgSlug, config, backendUrl])

  // Generate embed codes
  const scriptCode = useMemo(() => {
    if (!orgSlug) return ''
    const widgetUrl = buildWidgetUrl('badge')
    return `<!-- Честно.ru Trust Badge -->
<div data-chestno-widget="${orgSlug}"></div>
<script src="${widgetUrl}" async></script>`
  }, [orgSlug, buildWidgetUrl])

  const iframeCode = useMemo(() => {
    if (!orgSlug) return ''
    const widgetUrl = buildWidgetUrl('iframe')

    // Determine dimensions based on size
    let width = 280
    let height = 70
    if (config.size === 'small') {
      width = 180
      height = 50
    } else if (config.size === 'large') {
      width = 300
      height = 100
    }

    return `<!-- Честно.ru Trust Badge (iframe) -->
<iframe
  src="${widgetUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  scrolling="no"
  style="border: none; overflow: hidden;">
</iframe>`
  }, [orgSlug, config.size, buildWidgetUrl])

  const previewUrl = useMemo(() => buildWidgetUrl('preview'), [buildWidgetUrl])

  // Refresh preview when config changes
  useEffect(() => {
    setPreviewKey((prev) => prev + 1)
  }, [config])

  const handleCopy = async (type: 'script' | 'iframe') => {
    const code = type === 'script' ? scriptCode : iframeCode
    try {
      await navigator.clipboard.writeText(code)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const updateConfig = <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  if (!user || !currentOrganization || !orgSlug) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно данных</AlertTitle>
          <AlertDescription>Сначала войдите и выберите организацию.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Доступ ограничен</AlertTitle>
          <AlertDescription>
            Только владельцы, администраторы и менеджеры могут настраивать виджет.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Виджет доверия</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">
          Настройте и разместите виджет на своем сайте, чтобы показать посетителям ваш статус доверия.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Настройки виджета</CardTitle>
            <CardDescription>Выберите внешний вид виджета</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Size */}
            <div className="space-y-2">
              <Label htmlFor="size">Размер</Label>
              <Select
                value={config.size}
                onValueChange={(value) => updateConfig('size', value as WidgetSize)}
              >
                <SelectTrigger id="size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SIZE_LABELS) as WidgetSize[]).map((size) => (
                    <SelectItem key={size} value={size}>
                      <div className="flex flex-col">
                        <span>{SIZE_LABELS[size].ru}</span>
                        <span className="text-xs text-muted-foreground">
                          {SIZE_LABELS[size].description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label htmlFor="theme">Тема</Label>
              <Select
                value={config.theme}
                onValueChange={(value) => updateConfig('theme', value as WidgetTheme)}
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(THEME_LABELS) as WidgetTheme[]).map((theme) => (
                    <SelectItem key={theme} value={theme}>
                      {THEME_LABELS[theme]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config.theme === 'auto' && (
                <p className="text-xs text-muted-foreground">
                  Виджет автоматически подстроится под тему сайта посетителя
                </p>
              )}
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">Язык</Label>
              <Select
                value={config.language}
                onValueChange={(value) => updateConfig('language', value as WidgetLanguage)}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="color">Цвет акцента (необязательно)</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={config.primaryColor || '#3B82F6'}
                  onChange={(e) => updateConfig('primaryColor', e.target.value)}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  placeholder="#3B82F6"
                  value={config.primaryColor}
                  onChange={(e) => updateConfig('primaryColor', e.target.value)}
                  className="flex-1"
                />
                {config.primaryColor && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateConfig('primaryColor', '')}
                  >
                    Сбросить
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Оставьте пустым, чтобы использовать цвет по умолчанию для вашего уровня статуса
              </p>
            </div>

            {/* Border Radius */}
            <div className="space-y-2">
              <Label htmlFor="radius">Скругление углов: {config.borderRadius}px</Label>
              <input
                id="radius"
                type="range"
                min="0"
                max="24"
                value={config.borderRadius}
                onChange={(e) => updateConfig('borderRadius', parseInt(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0px</span>
                <span>24px</span>
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <Label>Показывать</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showLogo}
                    onChange={(e) => updateConfig('showLogo', e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Логотип Честно.ru</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showRating}
                    onChange={(e) => updateConfig('showRating', e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Звездный рейтинг</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showReviews}
                    onChange={(e) => updateConfig('showReviews', e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Количество отзывов</span>
                </label>
              </div>
            </div>

            {/* Reset Button */}
            <Button
              variant="outline"
              onClick={() => setConfig(DEFAULT_CONFIG)}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Сбросить настройки
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Предпросмотр</CardTitle>
                  <CardDescription>Так виджет будет выглядеть на сайте</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewKey((prev) => prev + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`flex items-center justify-center p-8 rounded-lg border-2 border-dashed ${
                  config.theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                }`}
              >
                <iframe
                  key={previewKey}
                  src={previewUrl}
                  title="Widget Preview"
                  className="border-none"
                  style={{
                    width: config.size === 'small' ? 200 : config.size === 'medium' ? 300 : 320,
                    height: config.size === 'small' ? 60 : config.size === 'medium' ? 80 : 110,
                    overflow: 'hidden',
                  }}
                />
              </div>
              <div className="mt-4 flex justify-center">
                <a
                  href={`/org/${orgSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Открыть публичную страницу
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle>Код для встраивания</CardTitle>
              <CardDescription>Скопируйте и вставьте на ваш сайт</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="script">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="script">
                    <Code className="mr-2 h-4 w-4" />
                    JavaScript
                  </TabsTrigger>
                  <TabsTrigger value="iframe">iFrame</TabsTrigger>
                </TabsList>

                <TabsContent value="script" className="space-y-3">
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                      <code>{scriptCode}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute right-2 top-2"
                      onClick={() => handleCopy('script')}
                    >
                      {copied === 'script' ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Скопировано
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Копировать
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Рекомендуемый способ. Виджет загрузится асинхронно и не замедлит ваш сайт.
                  </p>
                </TabsContent>

                <TabsContent value="iframe" className="space-y-3">
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                      <code>{iframeCode}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute right-2 top-2"
                      onClick={() => handleCopy('iframe')}
                    >
                      {copied === 'iframe' ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Скопировано
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Копировать
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Альтернативный способ для сайтов, где JavaScript ограничен.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Tips */}
          <Alert>
            <AlertTitle>Подсказка</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                <li>Разместите виджет в футере или боковой панели сайта</li>
                <li>Виджет кешируется на 5 минут для быстрой загрузки</li>
                <li>При клике пользователь перейдет на вашу страницу на Честно.ru</li>
                <li>Виджет автоматически обновится при изменении вашего статуса</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
