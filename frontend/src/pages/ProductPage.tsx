import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Award, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductHero } from '@/components/product/ProductHero'
import { ProductJourney } from '@/components/product/ProductJourney'
import { ShareModal } from '@/components/share/ShareModal'
import { ShareCard } from '@/components/share/ShareCard'
import { DiscoveryCard } from '@/components/share/DiscoveryCard'
import type { PublicProductDetails } from '@/types/product'

// Mock data for demonstration - will be replaced with API calls
const mockProduct: PublicProductDetails = {
  id: '1',
  slug: 'organic-honey-flower',
  name: 'Мед цветочный органический',
  short_description: 'Натуральный цветочный мед с собственной пасеки в экологически чистом районе Алтайского края.',
  long_description: `Наш цветочный мед собирается с разнотравья горных лугов Алтая. 
  
Пчелы собирают нектар с дикорастущих цветов: чабреца, душицы, иван-чая и многих других. Мы не используем искусственные подкормки и химические обработки.

Мед проходит минимальную обработку - только фильтрацию от механических примесей. Это позволяет сохранить все полезные свойства: ферменты, витамины и микроэлементы.`,
  category: 'Продукты питания',
  tags: 'мед, органик, алтай, натуральное, без добавок',
  price_cents: 85000,
  currency: 'RUB',
  main_image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800',
  gallery: [
    { url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800', caption: 'Пасека на Алтае' },
    { url: 'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=800', caption: 'Сбор меда' },
  ],
  external_url: 'https://example.com/buy',
  sku: 'HON-FLW-500',
  barcode: '4600123456789',
  organization: {
    id: 'org-1',
    name: 'Алтайская пасека',
    slug: 'altai-paseka',
    is_verified: true,
    status_level: 'A',
    main_image_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200',
  },
  journey_steps: [
    {
      id: '1',
      stage: 'sourcing',
      title: 'Сбор нектара',
      description: 'Пчелы собирают нектар с горных лугов Алтайского края',
      location: 'Алтайский край, Россия',
      date: '2024-06-15',
      verified: true,
      media_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600',
      order: 1,
    },
    {
      id: '2',
      stage: 'production',
      title: 'Созревание меда',
      description: 'Мед созревает в ульях естественным путем',
      location: 'Пасека "Алтайская"',
      date: '2024-07-01',
      verified: true,
      order: 2,
    },
    {
      id: '3',
      stage: 'quality_check',
      title: 'Лабораторная проверка',
      description: 'Проверка на соответствие ГОСТ и отсутствие примесей',
      location: 'Сертифицированная лаборатория',
      date: '2024-07-15',
      verified: true,
      order: 3,
    },
    {
      id: '4',
      stage: 'packaging',
      title: 'Фасовка',
      description: 'Ручная фасовка в стеклянные банки',
      location: 'Цех фасовки',
      date: '2024-07-20',
      verified: true,
      order: 4,
    },
    {
      id: '5',
      stage: 'distribution',
      title: 'Доставка',
      description: 'Отправка партии в розничные точки',
      date: '2024-07-25',
      verified: false,
      order: 5,
    },
  ],
  trust_score: 92,
  verified_claims: ['Органическое производство', 'Без ГМО', 'Местное производство'],
  certifications: [
    { name: 'ГОСТ 19792-2017', issuer: 'Росстандарт', valid_until: '2025-12-31' },
    { name: 'Органический сертификат', issuer: 'Роскачество', valid_until: '2025-06-30' },
  ],
  follower_count: 234,
  is_followed: false,
}

// Mock related products
const mockRelatedProducts = [
  {
    id: '2',
    type: 'product' as const,
    name: 'Мед липовый',
    slug: 'lipa-honey',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400',
    description: 'Ароматный липовый мед с пасеки',
    category: 'Продукты питания',
    price: { cents: 95000, currency: 'RUB' },
    producer: { name: 'Алтайская пасека', slug: 'altai-paseka' },
    isVerified: true,
  },
  {
    id: '3',
    type: 'product' as const,
    name: 'Прополис',
    slug: 'propolis',
    imageUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400',
    description: 'Натуральный прополис для здоровья',
    category: 'Продукты пчеловодства',
    price: { cents: 45000, currency: 'RUB' },
    producer: { name: 'Алтайская пасека', slug: 'altai-paseka' },
    isVerified: true,
  },
]

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<PublicProductDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isFollowed, setIsFollowed] = useState(false)

  useEffect(() => {
    const loadProduct = async () => {
      if (!slug) return
      
      setLoading(true)
      setError(null)
      
      try {
        // TODO: Replace with actual API call
        // const data = await fetchPublicProductBySlug(slug)
        await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate API delay
        setProduct(mockProduct)
        setIsFollowed(mockProduct.is_followed ?? false)
      } catch (err) {
        console.error(err)
        setError('Товар не найден')
      } finally {
        setLoading(false)
      }
    }

    void loadProduct()
  }, [slug])

  const handleFollowChange = useCallback(async (newFollowState: boolean) => {
    // TODO: Replace with actual API call
    // await updateProductFollow(product.id, newFollowState)
    setIsFollowed(newFollowState)
  }, [])

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/product/${slug}`
    : ''

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
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square bg-muted rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 w-24 bg-muted rounded" />
              <div className="h-12 w-3/4 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Недоступно</AlertTitle>
          <AlertDescription>{error ?? 'Страница недоступна.'}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Вернуться к каталогу
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/products" className="hover:text-foreground transition-colors">
            Каталог
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <Link
                to={`/products?category=${encodeURIComponent(product.category)}`}
                className="hover:text-foreground transition-colors"
              >
                {product.category}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground">{product.name}</span>
        </nav>
      </div>

      {/* Hero Section */}
      <ProductHero
        name={product.name}
        imageUrl={product.main_image_url}
        gallery={product.gallery}
        description={product.short_description}
        category={product.category}
        tags={product.tags}
        price={product.price_cents ? { cents: product.price_cents, currency: product.currency ?? 'RUB' } : null}
        externalUrl={product.external_url}
        producer={{
          id: product.organization.id,
          name: product.organization.name,
          slug: product.organization.slug,
          isVerified: product.organization.is_verified,
          statusLevel: product.organization.status_level,
          imageUrl: product.organization.main_image_url,
        }}
        trustScore={product.trust_score}
        verifiedClaims={product.verified_claims}
        followerCount={product.follower_count}
        isFollowed={isFollowed}
        onFollowChange={handleFollowChange}
        onShare={() => setIsShareModalOpen(true)}
      />

      {/* Content Sections */}
      <div className="mx-auto max-w-7xl px-4 pb-16 space-y-8">
        {/* Product Journey */}
        {product.journey_steps.length > 0 && (
          <ProductJourney
            steps={product.journey_steps}
            title="Путь продукта"
            description="Отслеживайте каждый этап от сырья до прилавка"
          />
        )}

        {/* Long Description */}
        {product.long_description && (
          <Card>
            <CardHeader>
              <CardTitle>О товаре</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                {product.long_description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Certifications */}
        {product.certifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Сертификаты
              </CardTitle>
              <CardDescription>Официальные подтверждения качества</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {product.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{cert.name}</p>
                      {cert.issuer && (
                        <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                      )}
                      {cert.valid_until && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Действителен до {new Date(cert.valid_until).toLocaleDateString('ru-RU')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Share Card Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Поделитесь находкой</CardTitle>
            <CardDescription>
              Расскажите друзьям о честном товаре
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <ShareCard
                name={product.name}
                type="product"
                imageUrl={product.main_image_url}
                description={product.short_description}
                statusLevel={product.organization.status_level}
                producerName={product.organization.name}
                isVerified={product.organization.is_verified}
                trustScore={product.trust_score}
                price={product.price_cents ? { cents: product.price_cents, currency: product.currency ?? 'RUB' } : null}
                onShare={() => setIsShareModalOpen(true)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Related Products */}
        <Card>
          <CardHeader>
            <CardTitle>Другие товары производителя</CardTitle>
            <CardDescription>
              Также от {product.organization.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mockRelatedProducts.map((related) => (
                <DiscoveryCard
                  key={related.id}
                  id={related.id}
                  type={related.type}
                  name={related.name}
                  slug={related.slug}
                  imageUrl={related.imageUrl}
                  description={related.description}
                  category={related.category}
                  price={related.price}
                  producer={related.producer}
                  isVerified={related.isVerified}
                  size="sm"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share Modal */}
      <ShareModal
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        url={shareUrl}
        title={`${product.name} - ${product.organization.name}`}
        description={product.short_description ?? undefined}
      />
    </div>
  )
}
