import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { fetchPublicOrganization, fetchPublicOrganizationProducts } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PublicOrganizationProfile, PublicProduct } from '@/types/auth'

export const PublicOrganizationPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<PublicOrganizationProfile | null>(null)
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!slug) return
    let isMounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchPublicOrganization(slug)
        if (!isMounted) return
        setData(result)
        const goods = await fetchPublicOrganizationProducts(slug)
        if (isMounted) {
          setProducts(goods)
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
      <div className="space-y-2">
        <p className="text-sm uppercase text-muted-foreground">Производитель</p>
        <h1 className="text-4xl font-semibold">{data.name}</h1>
        <p className="text-muted-foreground">
          {data.city ? `${data.city}, ` : ''}
          {data.country}
        </p>
        {data.is_verified && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            Проверено Chestno.ru
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Кратко о производстве</CardTitle>
          <CardDescription>Основные факты и ценности.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base">{data.short_description ?? 'Описание появится позже.'}</p>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>История бренда</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {data.long_description ?? 'История будет добавлена позже.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Как устроено производство</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {data.production_description ?? 'Информация будет добавлена позже.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Безопасность и качество</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {data.safety_and_quality ?? 'Компания подготовит информацию о стандартах.'}
          </p>
        </CardContent>
      </Card>

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

      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Товары производителя</CardTitle>
            <CardDescription>Небольшая витрина продукции.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {products.map((product) => (
              <div key={product.id} className="rounded-lg border border-border p-4">
                <p className="text-lg font-semibold">{product.name}</p>
                {product.short_description && <p className="text-sm text-muted-foreground">{product.short_description}</p>}
                {product.price_cents && (
                  <p className="mt-2 font-medium">
                    {(product.price_cents / 100).toLocaleString('ru-RU', { style: 'currency', currency: product.currency ?? 'RUB' })}
                  </p>
                )}
                {product.external_url && (
                  <a
                    className="mt-2 inline-block text-sm text-primary underline"
                    href={product.external_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Подробнее
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

