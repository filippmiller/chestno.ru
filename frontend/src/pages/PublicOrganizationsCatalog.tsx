import { useEffect, useState } from 'react'

import { searchPublicOrganizations } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PublicOrganizationSummary } from '@/types/auth'

export const PublicOrganizationsCatalogPage = () => {
  const [items, setItems] = useState<PublicOrganizationSummary[]>([])
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('')
  const [category, setCategory] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await searchPublicOrganizations({
        q: query || undefined,
        country: country || undefined,
        category: category || undefined,
        verified_only: verifiedOnly,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить производителей')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void load()
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Каталог производителей</p>
        <h1 className="text-3xl font-semibold">Производители, работающие честно</h1>
        <p className="text-muted-foreground">
          Фильтруйте по стране, категории или ищите по названию. Найдено {total} производителей.
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border border-border p-3 sm:p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5" onSubmit={handleSubmit}>
        <input
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:col-span-2 md:col-span-1"
          placeholder="Поиск по названию или городу"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">Любая страна</option>
          <option value="Россия">Россия</option>
          <option value="Казахстан">Казахстан</option>
          <option value="Беларусь">Беларусь</option>
        </select>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          <option value="текстиль">Текстиль</option>
          <option value="упаковка">Упаковка</option>
          <option value="пищевое производство">Пищевое производство</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2 md:col-span-1">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="h-4 w-4" />
          <span className="whitespace-nowrap">Только проверенные</span>
        </label>
        <Button type="submit" disabled={loading} className="h-10 min-h-[44px] sm:col-span-2 md:col-span-1 lg:col-span-1">
          Найти
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Загружаем...</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((org) => (
          <Card key={org.slug} className="overflow-hidden">
            {org.main_image_url && (
              <img src={org.main_image_url} alt={org.name} className="h-40 w-full object-cover" loading="lazy" />
            )}
            <CardHeader>
              <CardTitle>{org.name}</CardTitle>
              <CardDescription>
                {org.city ? `${org.city}, ` : ''}
                {org.country}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {org.short_description ?? 'Описание появится позже.'}
              </p>
              <div className="flex flex-wrap gap-2 text-xs uppercase text-muted-foreground">
                {org.primary_category && <span>{org.primary_category}</span>}
                {org.is_verified && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">
                    Проверено
                  </span>
                )}
              </div>
              <Button asChild size="sm" className="mt-2">
                <a href={`/org/${org.id}`}>Посмотреть</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">Производители не найдены.</p>}
    </div>
  )
}

