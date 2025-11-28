import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, Star } from 'lucide-react'

import { listOrganizationReviews, getReviewStats, moderateReview } from '@/api/reviewsService'
import type { Review, ReviewStats } from '@/types/reviews'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '@/store/userStore'

const STATUS_LABELS: Record<string, string> = {
  pending: 'На модерации',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
}

export const OrganizationReviewsPage = () => {
  const { selectedOrganizationId } = useUserStore()
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const loadReviews = async () => {
    if (!selectedOrganizationId) return

    setLoading(true)
    setError(null)
    try {
      const [reviewsResponse, statsResponse] = await Promise.all([
        listOrganizationReviews(selectedOrganizationId, {
          status: statusFilter as 'pending' | 'approved' | 'rejected' | undefined,
          limit: 50,
          offset: 0,
        }),
        getReviewStats(selectedOrganizationId),
      ])
      setReviews(reviewsResponse.items)
      setStats(statsResponse)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить отзывы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganizationId, statusFilter])

  const handleModerate = async (reviewId: string, status: 'approved' | 'rejected') => {
    if (!selectedOrganizationId) return

    try {
      await moderateReview(selectedOrganizationId, reviewId, {
        status,
        moderation_comment: status === 'approved' ? 'Одобрено модератором' : 'Отклонено модератором',
      })
      await loadReviews()
    } catch (err) {
      console.error(err)
      setError('Не удалось изменить статус отзыва')
    }
  }

  if (!selectedOrganizationId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Alert>
          <AlertDescription>Выберите организацию</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Отзывы</h1>
        <p className="text-muted-foreground">Управляйте отзывами о вашей организации и товарах</p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Всего отзывов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_reviews}</div>
              {stats.average_rating && (
                <div className="mt-2 flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm text-muted-foreground">{stats.average_rating.toFixed(1)} / 5</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Одобрено</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.rating_distribution[5] + stats.rating_distribution[4]}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">На модерации</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {reviews.filter((r) => r.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === undefined ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(undefined)}
        >
          Все
        </Button>
        <Button
          variant={statusFilter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('pending')}
        >
          На модерации
        </Button>
        <Button
          variant={statusFilter === 'approved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('approved')}
        >
          Одобрено
        </Button>
        <Button
          variant={statusFilter === 'rejected' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('rejected')}
        >
          Отклонено
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Пока нет отзывов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const StatusIcon = STATUS_ICONS[review.status]
            return (
              <Card key={review.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-5 w-5" />
                        <CardTitle className="text-lg">{review.title || 'Без заголовка'}</CardTitle>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <CardDescription className="mt-2">{review.body}</CardDescription>
                    </div>
                    <Badge variant={review.status === 'approved' ? 'default' : 'secondary'}>
                      {STATUS_LABELS[review.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {review.created_at && (
                        <span>Создано: {new Date(review.created_at).toLocaleDateString('ru-RU')}</span>
                      )}
                      {review.product_id && <span className="ml-4">Отзыв о товаре</span>}
                    </div>
                    {review.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleModerate(review.id, 'approved')}
                        >
                          Одобрить
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleModerate(review.id, 'rejected')}
                        >
                          Отклонить
                        </Button>
                      </div>
                    )}
                  </div>
                  {review.media && review.media.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {review.media.map((item, idx) => (
                        <div key={idx}>
                          {item.type === 'video' ? (
                            <video src={item.url} className="h-20 w-full rounded object-cover" />
                          ) : (
                            <img src={item.url} alt={item.alt || ''} className="h-20 w-full rounded object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

