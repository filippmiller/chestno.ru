import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { getOnboardingSummary } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OnboardingSummary } from '@/types/auth'
import { useUserStore } from '@/store/userStore'

const STEP_LINKS: Record<string, string> = {
  profile: '/dashboard/organization/profile',
  products: '/dashboard/organization/products',
  qr_codes: '/dashboard/organization/qr',
  verification: '/dashboard/moderation/organizations',
  invites: '/dashboard/organization/invites',
}

export const OrganizationOnboardingPage = () => {
  const { organizations, selectedOrganizationId } = useUserStore()
  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId],
  )
  const [summary, setSummary] = useState<OnboardingSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganization) return
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getOnboardingSummary(currentOrganization.id)
        if (mounted) setSummary(data)
      } catch (err) {
        console.error(err)
        if (mounted) setError('Не удалось загрузить прогресс онбординга')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [currentOrganization])

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Alert>
          <AlertTitle>Выберите организацию</AlertTitle>
          <AlertDescription>Чтобы увидеть прогресс, выберите организацию на главной странице кабинета.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Онбординг</p>
        <h1 className="text-3xl font-semibold">Прогресс заполнения профиля</h1>
        <p className="text-muted-foreground">
          Выполните шаги, чтобы профиль {currentOrganization.name} стал полностью готов для публикации.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Готовность</CardTitle>
          <CardDescription>Дополните недостающие блоки, чтобы повысить доверие покупателей.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Прогресс</span>
              <span>{summary?.completion_percent ?? 0}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-primary transition-all"
                style={{ width: `${summary?.completion_percent ?? 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Загружаем шаги…</p>}
        {summary?.steps.map((step) => (
          <Card key={step.key} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">{step.label}</p>
              <p className="text-sm text-muted-foreground">
                {step.completed ? 'Выполнено' : 'Требуется внимание'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold ${
                  step.completed ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                {step.completed ? 'Готово' : 'В работе'}
              </span>
              <Button asChild variant={step.completed ? 'secondary' : 'default'} size="sm">
                <Link to={STEP_LINKS[step.key] ?? '/dashboard'}>Перейти</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

