import { useEffect, useState } from 'react'

import { listModerationOrganizations, verifyOrganizationStatus } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/store/userStore'
import type { ModerationOrganization } from '@/types/auth'

const MODERATOR_ROLES = new Set(['platform_admin', 'moderator'])

export const ModerationDashboardPage = () => {
  const { platformRoles } = useUserStore()
  const [organizations, setOrganizations] = useState<ModerationOrganization[]>([])
  const [status, setStatus] = useState<'pending' | 'verified' | 'rejected'>('pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canModerate = platformRoles.some((role) => MODERATOR_ROLES.has(role))

  useEffect(() => {
    if (!canModerate) return
    setLoading(true)
    setError(null)
    listModerationOrganizations(status)
      .then(setOrganizations)
      .catch(() => setError('Не удалось загрузить организации'))
      .finally(() => setLoading(false))
  }, [status, canModerate])

  const handleAction = async (org: ModerationOrganization, action: 'verify' | 'reject') => {
    const comment = window.prompt('Комментарий к решению', org.verification_comment ?? '')
    setLoading(true)
    setError(null)
    try {
      await verifyOrganizationStatus(org.id, { action, comment: comment ?? undefined })
      const updated = await listModerationOrganizations(status)
      setOrganizations(updated)
    } catch (err) {
      console.error(err)
      setError('Не удалось обновить статус')
    } finally {
      setLoading(false)
    }
  }

  if (!canModerate) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно прав</AlertTitle>
          <AlertDescription>Эта страница доступна только администраторам и модераторам платформы.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Модерация производителей</p>
        <h1 className="text-3xl font-semibold">Организации ({status})</h1>
        <div className="flex gap-2">
          {['pending', 'verified', 'rejected'].map((value) => (
            <Button
              key={value}
              variant={status === value ? 'default' : 'outline'}
              onClick={() => setStatus(value as typeof status)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Список организаций</CardTitle>
          <CardDescription>Проверьте профиль и обновите статус.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Загружаем…</p>}
          {!loading && organizations.length === 0 && (
            <p className="text-sm text-muted-foreground">Нет организаций со статусом {status}</p>
          )}
          {!loading &&
            organizations.map((org) => (
              <div key={org.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold">{org.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {org.city ? `${org.city}, ` : ''}
                        {org.country}
                      </p>
                    </div>
                    <span className="text-xs uppercase text-muted-foreground">{org.verification_status}</span>
                  </div>
                  {org.verification_comment && (
                    <p className="text-sm text-muted-foreground">Комментарий: {org.verification_comment}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" asChild>
                      <a href={`/org/${org.slug}`} target="_blank" rel="noreferrer">
                        Открыть профиль
                      </a>
                    </Button>
                    {status === 'pending' && (
                      <>
                        <Button onClick={() => handleAction(org, 'verify')} disabled={loading}>
                          Подтвердить
                        </Button>
                        <Button variant="destructive" onClick={() => handleAction(org, 'reject')} disabled={loading}>
                          Отклонить
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}

