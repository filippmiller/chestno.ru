import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createOrganizationInvite, listOrganizationInvites } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/store/userStore'
import type { OrganizationInvite, OrganizationInvitePayload } from '@/types/auth'

const inviteSchema = z.object({
  email: z.string().email('Введите корректный email'),
  role: z.enum(['admin', 'manager', 'editor', 'analyst', 'viewer']),
  expiresAt: z.string().optional(),
})

type InviteFormValues = z.infer<typeof inviteSchema>

const INVITE_ROLES: InviteFormValues['role'][] = ['admin', 'manager', 'editor', 'analyst', 'viewer']
const CAN_MANAGE_ROLES = new Set(['owner', 'admin', 'manager'])

export const OrganizationInvitesPage = () => {
  const { organizations, selectedOrganizationId, memberships, user } = useUserStore()
  const [invites, setInvites] = useState<OrganizationInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )
  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canManage = membership ? CAN_MANAGE_ROLES.has(membership.role) : false

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'editor',
      expiresAt: '',
    },
  })

  const organizationId = currentOrganization?.id

  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    listOrganizationInvites(organizationId)
      .then(setInvites)
      .catch(() => setError('Не удалось загрузить приглашения'))
      .finally(() => setLoading(false))
  }, [organizationId])

  const onSubmit = async (values: InviteFormValues) => {
    if (!currentOrganization) return
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const payload: OrganizationInvitePayload = {
        email: values.email,
        role: values.role,
        expires_at: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      }
      await createOrganizationInvite(currentOrganization.id, payload)
      const list = await listOrganizationInvites(currentOrganization.id)
      setInvites(list)
      setSuccess('Приглашение создано')
      form.reset({ email: '', role: values.role, expiresAt: '' })
    } catch (err) {
      console.error(err)
      setError('Не удалось создать приглашение')
    } finally {
      setLoading(false)
    }
  }

  const copyInviteLink = async (code: string) => {
    const origin = window.location.origin
    const link = `${origin}/invite/${code}`
    await navigator.clipboard.writeText(link)
    setSuccess('Ссылка приглашения скопирована')
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Требуется вход</AlertTitle>
          <AlertDescription>Авторизуйтесь, чтобы управлять приглашениями.</AlertDescription>
        </Alert>
      </div>
    )
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Приглашения в организацию</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">Приглашайте коллег и назначайте роли.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Текущие приглашения</CardTitle>
          <CardDescription>Статусы pending можно отправить гостям для присоединения.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Загружаем…</p>}
          {!loading && invites.length === 0 && (
            <p className="text-sm text-muted-foreground">Пока нет приглашений</p>
          )}
          {!loading &&
            invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Роль: {invite.role} • Статус: {invite.status}
                  </p>
                  {invite.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Действительно до {new Date(invite.expires_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.code)}>
                  Скопировать ссылку
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Создать приглашение</CardTitle>
            <CardDescription>Укажите email коллеги и выберите роль.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="teammate@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Роль</FormLabel>
                      <FormControl>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          {...field}
                        >
                          {INVITE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Срок действия (опционально)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={loading}>
                  Создать приглашение
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>Недостаточно прав</AlertTitle>
          <AlertDescription>
            Приглашения могут создавать владельцы, администраторы и менеджеры организации.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

