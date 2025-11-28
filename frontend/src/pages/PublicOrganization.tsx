import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { fetchPublicOrganizationDetails } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PublicOrganizationDetails } from '@/types/auth'

export const PublicOrganizationPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<PublicOrganizationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!slug) return
    let isMounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchPublicOrganizationDetails(slug)
        if (isMounted) {
          setData(result)
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
  }, [slug])

  if (!slug) {
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

