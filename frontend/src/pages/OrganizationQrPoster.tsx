/**
 * Страница генерации рекламного PDF-документа с QR-кодом
 * 
 * Позволяет владельцу бизнеса:
 * - Просмотреть превью рекламного листа A4
 * - Отредактировать тексты (название компании readonly, описание и промо-текст редактируемые)
 * - Скачать PDF для печати
 * 
 * TODO: Добавить форматы A3, A5, наклейки
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Copy, Download } from 'lucide-react'

import { getOrganizationProfile } from '@/api/authService'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUserStore } from '@/store/userStore'
import type { OrganizationProfile } from '@/types/auth'

// Дефолтные тексты (на русском, т.к. проект русскоязычный)
const DEFAULT_SHORT_DESCRIPTION = 'Надёжный местный производитель в вашем регионе.'
const DEFAULT_PROMO_TEXT = `Мы производим качественную продукцию с заботой о клиентах. 
Отсканируйте QR-код, чтобы посмотреть наш профиль, прочитать отзывы и связаться с нами в один клик.`

export const OrganizationQrPosterPage = () => {
  const { organizations, selectedOrganizationId } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setProfile] = useState<OrganizationProfile | null>(null)
  
  // Редактируемые поля
  const [shortDescription, setShortDescription] = useState('')
  const [promoText, setPromoText] = useState('')
  
  const previewRef = useRef<HTMLDivElement>(null)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )

  const organizationId = currentOrganization?.id

  // Формируем публичный URL организации
  const publicUrl = useMemo(() => {
    if (!organizationId) return ''
    // Используем текущий origin для формирования публичного URL
    const baseUrl = window.location.origin
    return `${baseUrl}/org/${organizationId}`
  }, [organizationId])

  // Загружаем профиль организации
  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    getOrganizationProfile(organizationId)
      .then((profileData) => {
        setProfile(profileData)
        // Устанавливаем значения по умолчанию
        setShortDescription(profileData?.short_description || DEFAULT_SHORT_DESCRIPTION)
        setPromoText(DEFAULT_PROMO_TEXT)
      })
      .catch((err) => {
        console.error(err)
        setError('Не удалось загрузить профиль организации')
        // Устанавливаем дефолтные значения даже при ошибке
        setShortDescription(DEFAULT_SHORT_DESCRIPTION)
        setPromoText(DEFAULT_PROMO_TEXT)
      })
      .finally(() => setLoading(false))
  }, [organizationId])

  // Копирование URL
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl)
    // Можно добавить toast-уведомление, но пока просто копируем
  }

  // Генерация и скачивание PDF
  const handleDownloadPdf = async () => {
    if (!previewRef.current || !currentOrganization) return

    setLoading(true)
    try {
      // Рендерим превью в canvas с высоким разрешением
      const canvas = await html2canvas(previewRef.current, {
        scale: 3, // Высокое разрешение для печати
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      // Создаем PDF формата A4 (210x297 мм)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Добавляем изображение в PDF
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)

      // Сохраняем файл
      const fileName = `qr-poster-${currentOrganization.slug || currentOrganization.id}.pdf`
      pdf.save(fileName)
    } catch (err) {
      console.error('Ошибка генерации PDF:', err)
      setError('Не удалось сгенерировать PDF. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  if (!currentOrganization || !organizationId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Alert>
          <AlertDescription>Выберите организацию для генерации постера</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">QR Poster / Рекламный лист с QR-кодом</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Скачайте этот лист и распечатайте его. Разместите в вашем офисе, на входной двери или рядом с кассой — клиенты
          смогут сканировать QR-код и попадать на ваш профиль в нашей системе.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Левая колонка: Настройки */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Настройки постера</CardTitle>
              <CardDescription>Отредактируйте тексты для вашего рекламного листа</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Название компании (readonly) */}
              <div className="space-y-2">
                <Label htmlFor="company-name">Название компании</Label>
                <Input id="company-name" value={currentOrganization.name} readOnly className="bg-muted" />
              </div>

              {/* Краткое описание (редактируемое) */}
              <div className="space-y-2">
                <Label htmlFor="short-description">Краткое описание</Label>
                <Textarea
                  id="short-description"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  rows={3}
                  placeholder={DEFAULT_SHORT_DESCRIPTION}
                />
              </div>

              {/* Рекламный текст (редактируемое) */}
              <div className="space-y-2">
                <Label htmlFor="promo-text">Рекламный текст (основной)</Label>
                <Textarea
                  id="promo-text"
                  value={promoText}
                  onChange={(e) => setPromoText(e.target.value)}
                  rows={5}
                  placeholder={DEFAULT_PROMO_TEXT}
                />
              </div>

              {/* Информация о QR */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
                <Label>Целевой URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={publicUrl} readOnly className="bg-background font-mono text-xs" />
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  QR-код ведёт на публичную страницу вашей организации
                </p>
              </div>

              {/* Кнопка скачивания */}
              <Button onClick={handleDownloadPdf} disabled={loading} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" />
                {loading ? 'Генерация PDF...' : 'Download PDF (A4)'}
              </Button>

              {/* TODO: Другие форматы */}
              <div className="text-xs text-muted-foreground">
                <p>Форматы A3, A5 и наклейки будут добавлены позже</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Правая колонка: Превью */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Превью (A4)</CardTitle>
              <CardDescription>Так будет выглядеть ваш рекламный лист</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                {/* Превью постера A4 */}
                <div
                  ref={previewRef}
                  className="aspect-[210/297] w-full max-w-[210mm] bg-white p-8 shadow-lg print:shadow-none"
                  style={{
                    // A4 размеры в пикселях (при 96 DPI: 210mm = 794px, 297mm = 1123px)
                    // Используем aspect-ratio для правильных пропорций
                    minHeight: '400px',
                  }}
                >
                  <div className="flex h-full flex-col">
                    {/* Название компании */}
                    <div className="mb-4">
                      <h2 className="text-3xl font-bold text-gray-900">{currentOrganization.name}</h2>
                    </div>

                    {/* Краткое описание */}
                    {shortDescription && (
                      <div className="mb-4">
                        <p className="text-lg text-gray-700">{shortDescription}</p>
                      </div>
                    )}

                    {/* Рекламный текст */}
                    {promoText && (
                      <div className="mb-6 flex-1">
                        <p className="whitespace-pre-line text-base leading-relaxed text-gray-600">{promoText}</p>
                      </div>
                    )}

                    {/* QR-код внизу справа */}
                    <div className="mt-auto flex justify-end">
                      <div className="flex flex-col items-end gap-2">
                        <div className="rounded-lg border-2 border-gray-300 bg-white p-2">
                          <QRCodeSVG
                            value={publicUrl}
                            size={120}
                            level="M"
                            includeMargin={false}
                            fgColor="#000000"
                            bgColor="#ffffff"
                          />
                        </div>
                        <p className="text-xs text-gray-500">Отсканируйте QR-код</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

