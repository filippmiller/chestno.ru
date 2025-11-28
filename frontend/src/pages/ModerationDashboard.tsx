import { useEffect, useState } from 'react'

import {
  getOrganizationSubscription,
  listModerationOrganizations,
  listSubscriptionPlans,
  setOrganizationSubscription,
  verifyOrganizationStatus,
} from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/store/userStore'
import type { ModerationOrganization, SubscriptionPlan } from '@/types/auth'

const MODERATOR_ROLES = new Set(['platform_admin', 'moderator'])

type OrgSubscriptionMap = Record<string, { planName: string; planCode: string }>

export const ModerationDashboardPage = () => {
  const { platformRoles } = useUserStore()
  const [organizations, setOrganizations] = useState<ModerationOrganization[]>([])
  const [status, setStatus] = useState<'pending' | 'verified' | 'rejected'>('pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [orgSubscriptions, setOrgSubscriptions] = useState<OrgSubscriptionMap>({})
  const [changingPlanFor, setChangingPlanFor] = useState<string | null>(null)
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({})

  const canModerate = platformRoles.some((role) => MODERATOR_ROLES.has(role))

  useEffect(() => {
    if (!canModerate) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [orgs, plansList] = await Promise.all([
          listModerationOrganizations(status),
          listSubscriptionPlans(true),
        ])
        setOrganizations(orgs)
        const activePlans = plansList.filter((p) => p.is_active)
        setPlans(activePlans)
        // Загружаем тарифы для всех организаций
        const subscriptions: OrgSubscriptionMap = {}
        await Promise.all(
          orgs.map(async (org) => {
            try {
              const sub = await getOrganizationSubscription(org.id)
              subscriptions[org.id] = {
                planName: sub.plan.name,
                planCode: sub.plan.code,
              }
            } catch {
              // Игнорируем ошибки для отдельных организаций
            }
          }),
        )
        setOrgSubscriptions(subscriptions)
        // Инициализируем выбранные планы
        const initialSelected: Record<string, string> = {}
        orgs.forEach((org) => {
          const sub = subscriptions[org.id]
          if (sub) {
            const plan = activePlans.find((p) => p.code === sub.planCode)
            if (plan) {
              initialSelected[org.id] = plan.id
            } else if (activePlans.length > 0) {
              // Если текущий план не найден среди активных, выбираем первый активный
              initialSelected[org.id] = activePlans[0].id
            }
          } else if (activePlans.length > 0) {
            // Если тарифа нет, выбираем первый активный план
            initialSelected[org.id] = activePlans[0].id
          }
        })
        setSelectedPlans(initialSelected)
      } catch {
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    void load()
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

  const handleChangePlan = async (orgId: string, planId: string) => {
    setChangingPlanFor(orgId)
    setError(null)
    try {
      await setOrganizationSubscription(orgId, planId)
      // Обновляем локальное состояние
      const plan = plans.find((p) => p.id === planId)
      if (plan) {
        setOrgSubscriptions((prev) => ({
          ...prev,
          [orgId]: { planName: plan.name, planCode: plan.code },
        }))
        setSelectedPlans((prev) => ({
          ...prev,
          [orgId]: planId,
        }))
      }
    } catch (err) {
      console.error(err)
      setError('Не удалось изменить тариф')
    } finally {
      setChangingPlanFor(null)
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
            organizations.map((org) => {
              const currentSubscription = orgSubscriptions[org.id]
              const isChangingPlan = changingPlanFor === org.id
              const selectedPlanId = selectedPlans[org.id] ?? ''

              return (
                <div key={org.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold">{org.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {org.city ? `${org.city}, ` : ''}
                          {org.country}
                        </p>
                        {currentSubscription && (
                          <p className="text-xs text-muted-foreground">Тариф: {currentSubscription.planName}</p>
                        )}
                      </div>
                      <span className="text-xs uppercase text-muted-foreground">{org.verification_status}</span>
                    </div>
                    {org.verification_comment && (
                      <p className="text-sm text-muted-foreground">Комментарий: {org.verification_comment}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" asChild>
                        <a href={`/org/${org.id}`} target="_blank" rel="noreferrer">
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
                      <div className="flex items-center gap-2">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={selectedPlanId}
                          onChange={(e) =>
                            setSelectedPlans((prev) => ({
                              ...prev,
                              [org.id]: e.target.value,
                            }))
                          }
                          disabled={isChangingPlan || loading}
                        >
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} ({plan.code})
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={() => selectedPlanId && handleChangePlan(org.id, selectedPlanId)}
                          disabled={isChangingPlan || loading || !selectedPlanId}
                        >
                          {isChangingPlan ? 'Сохранение...' : 'Изменить тариф'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </CardContent>
      </Card>
    </div>
  )
}

