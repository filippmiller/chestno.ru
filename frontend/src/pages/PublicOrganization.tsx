import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Link } from 'react-router-dom'
import { fetchPublicOrganizationDetailsById } from '@/api/authService'
import { listPublicOrganizationPostsById } from '@/api/postsService'
import { listPublicOrganizationReviewsById } from '@/api/reviewsService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PublicOrganizationDetails } from '@/types/auth'
import type { PublicOrganizationPost } from '@/types/posts'
import type { PublicReview } from '@/types/reviews'

export const PublicOrganizationPage = () => {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PublicOrganizationDetails | null>(null)
  const [posts, setPosts] = useState<PublicOrganizationPost[]>([])
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    let isMounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [orgData, postsData, reviewsData] = await Promise.all([
          fetchPublicOrganizationDetailsById(id),
          listPublicOrganizationPostsById(id, { limit: 5, offset: 0 }),
          listPublicOrganizationReviewsById(id, { limit: 5, offset: 0 }),
        ])
        if (isMounted) {
          setData(orgData)
          setPosts(postsData.items)
          setReviews(reviewsData.items)
          setAvgRating(reviewsData.average_rating || null)
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError('Организация не найдена или ещё находится на модерации')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [id])

  if (!id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Некорректный адрес</AlertTitle>
          <AlertDescription>Проверьте ссылку и попробуйте снова.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Загружаем страницу производителя…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Недоступно</AlertTitle>
          <AlertDescription>{error ?? 'Страница недоступна.'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="space-y-3">
        <p className="text-sm uppercase text-muted-foreground">Производитель</p>
        <h1 className="text-4xl font-semibold">{data.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            {data.city ? `${data.city}, ` : ''}
            {data.country}
          </span>
          {data.primary_category && <span>Категория: {data.primary_category}</span>}
          {data.founded_year && <span>Основан в {data.founded_year} году</span>}
          {data.employee_count && <span>~{data.employee_count} сотрудников</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {data.is_verified && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              Проверено Chestno.ru
            </span>
          )}
          {data.primary_category && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              {data.primary_category}
            </span>
          )}
        </div>
        {data.short_description && <p className="text-lg text-muted-foreground">{data.short_description}</p>}
        {data.buy_links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.buy_links.map((link) => (
              <Button key={link.url} asChild variant="outline" size="sm">
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </Button>
            ))}
          </div>
        )}
      </div>

      {data.video_url && (
        <Card>
          <CardHeader>
            <CardTitle>Видео</CardTitle>
            <CardDescription>Посмотрите, как выглядит производство.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
              <iframe
                src={data.video_url}
                title="Видео производства"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>
      )}

      {data.long_description && (
        <Card>
          <CardHeader>
            <CardTitle>История бренда</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{data.long_description}</p>
          </CardContent>
        </Card>
      )}

      {data.production_description && (
        <Card>
          <CardHeader>
            <CardTitle>Как устроено производство</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{data.production_description}</p>
          </CardContent>
        </Card>
      )}

      {(data.sustainability_practices || data.quality_standards) && (
        <Card>
          <CardHeader>
            <CardTitle>Честные практики</CardTitle>
            <CardDescription>Экология и стандарты качества</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {data.sustainability_practices && (
              <div>
                <p className="font-medium text-foreground">Экологичные решения</p>
                <p className="whitespace-pre-line">{data.sustainability_practices}</p>
              </div>
            )}
            {data.quality_standards && (
              <div>
                <p className="font-medium text-foreground">Стандарты качества</p>
                <p className="whitespace-pre-line">{data.quality_standards}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Сертификаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {data.certifications.map((cert) => (
              <div key={`${cert.name}-${cert.issuer}`} className="rounded-md border border-border p-3">
                <p className="font-medium text-foreground">{cert.name}</p>
                <p>
                  {cert.issuer}
                  {cert.valid_until ? ` • действует до ${new Date(cert.valid_until).toLocaleDateString('ru-RU')}` : ''}
                </p>
                {cert.link && (
                  <a href={cert.link} target="_blank" rel="noreferrer" className="text-primary underline">
                    Подробнее
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Товары</CardTitle>
            <CardDescription>Позиции, доступные к заказу.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {data.products.map((product) => (
              <div key={product.id} className="rounded-lg border border-border p-4">
                <p className="text-lg font-semibold">{product.name}</p>
                {product.short_description && <p className="text-sm text-muted-foreground">{product.short_description}</p>}
                {product.price_cents && (
                  <p className="mt-2 font-medium">
                    {(product.price_cents / 100).toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: product.currency ?? 'RUB',
                    })}
                  </p>
                )}
                {product.external_url && (
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <a href={product.external_url} target="_blank" rel="noreferrer">
                      Где купить
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.gallery.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Галерея</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {data.gallery.map((item, idx) => (
                <figure key={idx} className="space-y-2">
                  <img src={item.url} alt={item.caption ?? `photo-${idx}`} className="w-full rounded-lg border" />
                  {item.caption && <figcaption className="text-xs text-muted-foreground">{item.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.contact_email || data.contact_phone || data.contact_website || data.social_links?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Контакты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.contact_email && (
              <div>
                <span className="text-muted-foreground">Email: </span>
                <a href={`mailto:${data.contact_email}`} className="text-primary underline">
                  {data.contact_email}
                </a>
              </div>
            )}
            {data.contact_phone && (
              <div>
                <span className="text-muted-foreground">Телефон: </span>
                <a href={`tel:${data.contact_phone}`} className="text-primary underline">
                  {data.contact_phone}
                </a>
              </div>
            )}
            {data.contact_website && (
              <div>
                <span className="text-muted-foreground">Сайт: </span>
                <a href={data.contact_website} target="_blank" rel="noreferrer" className="text-primary underline">
                  {data.contact_website}
                </a>
              </div>
            )}
            {data.social_links && data.social_links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.social_links.map((link: { type: string; label: string; url: string }, idx: number) => (
                  <Button key={idx} asChild variant="outline" size="sm">
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {posts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Новости</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to={`/org/${id}/posts`}>Все новости</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="border-b border-border pb-4 last:border-0">
                <h3 className="font-semibold">{post.title}</h3>
                {post.excerpt && <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(post.published_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Отзывы</CardTitle>
          {avgRating && (
            <CardDescription>Средняя оценка: {avgRating.toFixed(1)} / 5</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{review.rating} / 5</span>
                    {review.title && <span className="text-sm font-medium">{review.title}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Пока нет отзывов</p>
          )}
        </CardContent>
      </Card>

      {data.tags && (
        <div className="flex flex-wrap gap-2">
          {data.tags.split(',').map((tag) => (
            <span key={tag.trim()} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
              {tag.trim()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

