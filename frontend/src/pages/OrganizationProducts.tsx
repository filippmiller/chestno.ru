import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

import { createProduct, listProducts, updateProduct, archiveProduct } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUserStore } from '@/store/userStore'
import type { Product, ProductPayload } from '@/types/auth'

const defaultForm: ProductPayload & { price?: string } = {
  name: '',
  slug: '',
  short_description: '',
  long_description: '',
  category: '',
  tags: '',
  price_cents: undefined,
  status: 'draft',
  is_featured: false,
  main_image_url: '',
  external_url: '',
  gallery: [],
  currency: 'RUB',
  price: '',
}

const statusOptions = [
  { label: 'Все', value: undefined },
  { label: 'Черновики', value: 'draft' },
  { label: 'Опубликованные', value: 'published' },
  { label: 'Архив', value: 'archived' },
]

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')

export const OrganizationProductsPage = () => {
  const { organizations, selectedOrganizationId, memberships } = useUserStore()
  const [products, setProducts] = useState<Product[]>([])
  const [formState, setFormState] = useState(defaultForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )

  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canEdit =
    membership && ['owner', 'admin', 'manager', 'editor'].includes(membership.role)

  const loadProducts = useCallback(async () => {
    if (!currentOrganization) return
    setLoading(true)
    setError(null)
    try {
      const data = await listProducts(currentOrganization.id, { status: statusFilter })
      setProducts(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить товары')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization, statusFilter])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const resetForm = () => {
    setFormState(defaultForm)
    setEditingId(null)
  }

  const handleInputChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
      slug: field === 'name' && !editingId ? slugify(value) : prev.slug,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentOrganization) return
    if (!canEdit) {
      setError('Недостаточно прав для управления товарами')
      return
    }
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const payload: ProductPayload = {
        ...formState,
        price_cents: formState.price ? Math.round(parseFloat(formState.price) * 100) : undefined,
      }
      if (editingId) {
        await updateProduct(currentOrganization.id, editingId, payload)
        setMessage('Товар обновлён')
      } else {
        await createProduct(currentOrganization.id, payload)
        setMessage('Товар создан')
      }
      resetForm()
      await loadProducts()
    } catch (err) {
      console.error(err)
      if (axios.isAxiosError(err) && err.response?.data?.detail?.code === 'limit_reached') {
        const metric = err.response.data.detail.metric
        setError(
          `Достигнут лимит по "${metric}". Откройте вкладку «Тариф и лимиты», чтобы обновить план или освободить место.`,
        )
      } else {
        setError('Не удалось сохранить товар')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    setFormState({
      name: product.name,
      slug: product.slug,
      short_description: product.short_description ?? '',
      long_description: product.long_description ?? '',
      category: product.category ?? '',
      tags: product.tags ?? '',
      price_cents: product.price_cents ?? undefined,
      price: product.price_cents ? (product.price_cents / 100).toString() : '',
      currency: product.currency ?? 'RUB',
      status: product.status,
      is_featured: product.is_featured,
      main_image_url: product.main_image_url ?? '',
      gallery: product.gallery ?? [],
      external_url: product.external_url ?? '',
    })
  }

  const handleArchive = async (productId: string) => {
    if (!currentOrganization || !canEdit) return
    setLoading(true)
    setError(null)
    try {
      await archiveProduct(currentOrganization.id, productId)
      setMessage('Товар перемещён в архив')
      await loadProducts()
    } catch (err) {
      console.error(err)
      setError('Не удалось архивировать товар')
    } finally {
      setLoading(false)
    }
  }

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Нет организации</AlertTitle>
          <AlertDescription>Сначала создайте организацию или примите приглашение.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Товары и витрина</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">
          Управляйте карточками товаров. Опубликованные товары появятся на публичной странице производителя.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Список товаров</CardTitle>
          <CardDescription>Всего: {products.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <Button
                key={opt.label}
                variant={statusFilter === opt.value ? 'default' : 'outline'}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {loading && <p className="text-sm text-muted-foreground">Загружаем...</p>}
          {!loading && products.length === 0 && <p className="text-muted-foreground">Пока нет товаров.</p>}
          <div className="grid gap-3">
            {products.map((product) => (
              <div key={product.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Статус: {product.status} • Цена:{' '}
                      {product.price_cents ? `${(product.price_cents / 100).toFixed(2)} ${product.currency}` : '—'}
                    </p>
                    {product.short_description && (
                      <p className="text-sm text-muted-foreground">{product.short_description}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                        Редактировать
                      </Button>
                      {product.status !== 'archived' && (
                        <Button variant="destructive" size="sm" onClick={() => handleArchive(product.id)}>
                          В архив
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Редактировать товар' : 'Новый товар'}</CardTitle>
            <CardDescription>Заполните информацию и опубликуйте, когда будете готовы.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Название"
                  value={formState.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
                <Input
                  placeholder="Slug"
                  value={formState.slug}
                  onChange={(e) => handleInputChange('slug', slugify(e.target.value))}
                  required
                />
              </div>
              <Textarea
                placeholder="Краткое описание"
                value={formState.short_description ?? ''}
                onChange={(e) => handleInputChange('short_description', e.target.value)}
              />
              <Textarea
                placeholder="Детальное описание"
                value={formState.long_description ?? ''}
                onChange={(e) => handleInputChange('long_description', e.target.value)}
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  placeholder="Категория"
                  value={formState.category ?? ''}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                />
                <Input
                  placeholder="Теги"
                  value={formState.tags ?? ''}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                />
                <Input
                  placeholder="Цена (руб.)"
                  value={formState.price ?? ''}
                  onChange={(e) => setFormState((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Главное изображение (URL)"
                  value={formState.main_image_url ?? ''}
                  onChange={(e) => handleInputChange('main_image_url', e.target.value)}
                />
                <Input
                  placeholder="Внешняя ссылка"
                  value={formState.external_url ?? ''}
                  onChange={(e) => handleInputChange('external_url', e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formState.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <option value="draft">Черновик</option>
                  <option value="published">Опубликован</option>
                  <option value="archived">Архив</option>
                </select>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formState.is_featured ? 'true' : 'false'}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, is_featured: e.target.value === 'true' }))
                  }
                >
                  <option value="false">Обычный</option>
                  <option value="true">Выделенный товар</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {editingId ? 'Сохранить' : 'Создать'}
                </Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Отменить
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

