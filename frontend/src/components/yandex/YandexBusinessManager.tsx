/**
 * Yandex Business Manager Component
 *
 * Allows organization owners to:
 * - Link their Yandex Business profile
 * - Update rating manually
 * - View verification status
 */
import { useState } from 'react'
import { AlertCircle, CheckCircle, ExternalLink, Link2, RefreshCw, Unlink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { httpClient } from '@/api/httpClient'
import type {
  YandexBusinessProfileLink,
  YandexBusinessProfileResponse,
} from '@/types/yandex-business'
import { YANDEX_STATUS_CONFIG } from '@/types/yandex-business'
import { YandexRatingBadge } from './YandexRatingBadge'

interface YandexBusinessManagerProps {
  organizationId: string
  initialData?: YandexBusinessProfileResponse
  onUpdate?: () => void
  className?: string
}

export function YandexBusinessManager({
  organizationId,
  initialData,
  onUpdate,
  className = '',
}: YandexBusinessManagerProps) {
  const [data, setData] = useState<YandexBusinessProfileResponse | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  // Link form state
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linking, setLinking] = useState(false)

  // Rating update state
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [ratingValue, setRatingValue] = useState('')
  const [reviewCountValue, setReviewCountValue] = useState('')
  const [updatingRating, setUpdatingRating] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await httpClient.get<YandexBusinessProfileResponse>(
        `/api/v1/organizations/${organizationId}/yandex`
      )
      setData(response.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleLink = async () => {
    if (!linkUrl.trim()) return

    try {
      setLinking(true)
      setError(null)
      await httpClient.post<YandexBusinessProfileLink>(
        `/api/v1/organizations/${organizationId}/yandex/link`,
        { yandex_url: linkUrl }
      )
      setShowLinkForm(false)
      setLinkUrl('')
      fetchData()
      onUpdate?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка привязки'
      setError(message)
    } finally {
      setLinking(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('Вы уверены? Это удалит привязку и все импортированные отзывы.')) {
      return
    }

    try {
      setLoading(true)
      await httpClient.delete(`/api/v1/organizations/${organizationId}/yandex/link`)
      setData({ is_linked: false, can_display_badge: false })
      onUpdate?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка отвязки'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRating = async () => {
    const rating = parseFloat(ratingValue)
    const reviewCount = parseInt(reviewCountValue, 10)

    if (isNaN(rating) || rating < 0 || rating > 5) {
      setError('Рейтинг должен быть от 0 до 5')
      return
    }
    if (isNaN(reviewCount) || reviewCount < 0) {
      setError('Количество отзывов должно быть положительным числом')
      return
    }

    try {
      setUpdatingRating(true)
      setError(null)
      await httpClient.put(
        `/api/v1/organizations/${organizationId}/yandex/rating`,
        { rating, review_count: reviewCount }
      )
      setShowRatingForm(false)
      fetchData()
      onUpdate?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка обновления'
      setError(message)
    } finally {
      setUpdatingRating(false)
    }
  }

  // Initial load
  if (loading && !data) {
    return (
      <div className={`rounded-lg border bg-card p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
        </div>
      </div>
    )
  }

  const link = data?.link
  const statusConfig = link ? YANDEX_STATUS_CONFIG[link.status] : null

  return (
    <div className={`rounded-lg border bg-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#FC3F1D">
            <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm9.5-6.5v13h2v-5.5h1.5l2.5 5.5h2.5l-3-6c1.5-.5 2.5-1.7 2.5-3.5 0-2.5-2-4-4.5-4h-3.5zm2 2h1.5c1.5 0 2.5.8 2.5 2s-1 2-2.5 2h-1.5v-4z" />
          </svg>
          <h3 className="font-semibold">Яндекс Бизнес</h3>
        </div>

        {link && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig?.color} ${statusConfig?.bgColor}`}>
            {statusConfig?.label}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!data?.is_linked ? (
          // Not linked - show link form
          <>
            {!showLinkForm ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Привяжите профиль из Яндекс Карт, чтобы отображать рейтинг и импортировать отзывы
                </p>
                <Button onClick={() => setShowLinkForm(true)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Привязать профиль
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="yandex-url">Ссылка на профиль в Яндекс Картах</Label>
                  <Input
                    id="yandex-url"
                    placeholder="https://yandex.ru/maps/org/название/1234567890/"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Найдите свою организацию на Яндекс Картах и скопируйте URL
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleLink} disabled={linking || !linkUrl.trim()}>
                    {linking ? 'Привязываем...' : 'Привязать'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowLinkForm(false)}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          // Linked - show profile info
          <>
            {/* Rating badge */}
            {link?.yandex_rating !== undefined && link.yandex_rating !== null && (
              <div className="flex items-center justify-between">
                <YandexRatingBadge
                  rating={link.yandex_rating}
                  reviewCount={link.yandex_review_count}
                  yandexUrl={link.yandex_url}
                  size="lg"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRatingValue(link.yandex_rating?.toString() || '')
                    setReviewCountValue(link.yandex_review_count?.toString() || '')
                    setShowRatingForm(true)
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Обновить
                </Button>
              </div>
            )}

            {/* Verification status */}
            {link?.status === 'pending' && (
              <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Ожидает проверки</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Добавьте код верификации в описание вашего профиля на Яндекс Бизнесе,
                      затем обратитесь в поддержку для подтверждения.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {link?.status === 'verified' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Профиль подтверждён</span>
              </div>
            )}

            {/* Rating update form */}
            {showRatingForm && (
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Откройте свой профиль на Яндекс Картах и введите текущие данные
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rating">Рейтинг</Label>
                    <Input
                      id="rating"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder="4.5"
                      value={ratingValue}
                      onChange={(e) => setRatingValue(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="review-count">Количество отзывов</Label>
                    <Input
                      id="review-count"
                      type="number"
                      min="0"
                      placeholder="42"
                      value={reviewCountValue}
                      onChange={(e) => setReviewCountValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdateRating} disabled={updatingRating}>
                    {updatingRating ? 'Сохраняем...' : 'Сохранить'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowRatingForm(false)}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}

            {/* Profile link */}
            {link?.yandex_url && (
              <a
                href={link.yandex_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Открыть на Яндекс Картах
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {/* Unlink button */}
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleUnlink}
              >
                <Unlink className="h-4 w-4 mr-1" />
                Отвязать профиль
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default YandexBusinessManager
