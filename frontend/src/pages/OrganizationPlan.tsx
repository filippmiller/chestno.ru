import { useEffect, useMemo, useState } from 'react'

import { getOrganizationSubscription } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/store/userStore'
import type { OrganizationSubscriptionSummary } from '@/types/auth'

const formatPrice = (price?: number | null) => {
  if (!price) return '0 ₽'
  return `${(price / 100).toLocaleString('ru-RU')} ₽`
}

export const OrganizationPlanPage = () => {
  const { organizations, selectedOrganizationId } = useUserStore()
  const [summary, setSummary] = useState<OrganizationSubscriptionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )

  useEffect(() => {
    const load = async () => {
      if (!currentOrganization) return
      setLoading(true)
      setError(null)
      try {
        const data = await getOrganizationSubscription(currentOrganization.id)
        setSummary(data)
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить данные о тарифе')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [currentOrganization])

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Тариф и лимиты</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">
          Следите за лимитами на товары, QR-коды и участников. Для смены тарифа обратитесь к поддержке платформы.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Загружаем...</p>}

      {summary && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{summary.plan.name}</CardTitle>
              <CardDescription>{summary.plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>Абонентская плата: {formatPrice(summary.plan.price_monthly_cents)} / мес</p>
              <p>Аналитика: {summary.plan.analytics_level === 'advanced' ? 'расширенная' : 'базовая'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Использование</CardTitle>
              <CardDescription>Проверяйте, насколько близки к лимитам.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <UsageItem label="Товары" used={summary.usage.products_used} limit={summary.plan.max_products} />
              <UsageItem label="QR-коды" used={summary.usage.qr_codes_used} limit={summary.plan.max_qr_codes} />
              <UsageItem label="Участники" used={summary.usage.members_used} limit={summary.plan.max_members} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

const UsageItem = ({ label, used, limit }: { label: string; used: number; limit?: number | null }) => {
  const ratio = limit ? Math.min(used / limit, 1) : 0
  const displayLimit = limit ? `${used} / ${limit}` : `${used}`

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{displayLimit}</p>
      {limit && (
        <div className="mt-2 h-2 w-full rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
      {limit && ratio >= 0.8 && <p className="text-xs text-yellow-600">Внимание: лимит почти исчерпан</p>}
    </div>
  )
}

