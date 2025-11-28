import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  createAiIntegration,
  createDevTask,
  deleteDevTask,
  listAiIntegrations,
  listDevTasks,
  listModerationOrganizations,
  runAiIntegrationCheck,
  updateAiIntegration,
  updateDevTask,
  verifyOrganizationStatus,
} from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/store/userStore'
import type { AiIntegration, DevTask, ModerationOrganization } from '@/types/auth'

const AI_FORM_SCHEMA = z.object({
  provider: z.string().min(2),
  displayName: z.string().min(2),
  envVarName: z.string().min(2),
})

const DEV_FORM_SCHEMA = z.object({
  title: z.string().min(3),
  category: z.enum(['integration', 'auth', 'ai', 'billing', 'infrastructure', 'other']),
  relatedProvider: z.string().optional(),
  relatedEnvVars: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
})

const ADMIN_TABS = [
  { id: 'pending', label: 'Pending Registrations' },
  { id: 'ai', label: 'AI Integrations' },
  { id: 'dev', label: 'Dev / To-Do' },
]

export const AdminPanelPage = () => {
  const platformRoles = useUserStore((state) => state.platformRoles)
  const [activeTab, setActiveTab] = useState(ADMIN_TABS[0].id)
  const isAdmin = useMemo(() => platformRoles.some((role) => role === 'platform_owner' || role === 'platform_admin'), [platformRoles])

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Нет доступа</AlertTitle>
          <AlertDescription>Эта секция доступна только администраторам платформы.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        {ADMIN_TABS.map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? 'default' : 'outline'} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </Button>
        ))}
        <Button variant="secondary" asChild>
          <Link to="/admin/db">Database Explorer</Link>
        </Button>
      </div>
      {activeTab === 'pending' && <PendingRegistrationsSection />}
      {activeTab === 'ai' && <AiIntegrationsSection />}
      {activeTab === 'dev' && <DevTasksSection />}
    </div>
  )
}

const PendingRegistrationsSection = () => {
  const [organizations, setOrganizations] = useState<ModerationOrganization[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listModerationOrganizations('pending')
      setOrganizations(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить заявки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleAction = async (org: ModerationOrganization, action: 'verify' | 'reject') => {
    const comment = window.prompt('Комментарий к решению', org.verification_comment ?? '')
    if (comment === null) return // Пользователь отменил

    setLoading(true)
    setError(null)
    try {
      await verifyOrganizationStatus(org.id, { action, comment: comment || undefined })
      await load() // Перезагружаем список
    } catch (err) {
      console.error(err)
      setError('Не удалось обновить статус')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Registrations</CardTitle>
        <CardDescription>Список заявок на регистрацию производителей, ожидающих модерации.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && organizations.length === 0 && <p className="text-sm text-muted-foreground">Загружаем...</p>}

        {!loading && organizations.length === 0 && (
          <p className="text-sm text-muted-foreground">Нет заявок на модерацию</p>
        )}

        <div className="space-y-3">
          {organizations.map((org) => (
            <div key={org.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {org.city ? `${org.city}, ` : ''}
                      {org.country}
                    </p>
                    {org.website_url && (
                      <a
                        href={org.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        {org.website_url}
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Заявка от: {new Date(org.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <span className="text-xs uppercase text-muted-foreground">{org.verification_status}</span>
                </div>
                {org.verification_comment && (
                  <p className="text-sm text-muted-foreground">Комментарий: {org.verification_comment}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" asChild size="sm">
                    <a href={`/org/${org.id}`} target="_blank" rel="noreferrer">
                      Открыть профиль
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => handleAction(org, 'verify')} disabled={loading}>
                    Подтвердить
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleAction(org, 'reject')} disabled={loading}>
                    Отклонить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const AiIntegrationsSection = () => {
  const [items, setItems] = useState<AiIntegration[]>([])
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof AI_FORM_SCHEMA>>({
    resolver: zodResolver(AI_FORM_SCHEMA),
    defaultValues: { provider: '', displayName: '', envVarName: '' },
  })

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await listAiIntegrations()
      setItems(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить интеграции')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const onSubmit = async (values: z.infer<typeof AI_FORM_SCHEMA>) => {
    try {
      await createAiIntegration({
        provider: values.provider,
        display_name: values.displayName,
        env_var_name: values.envVarName,
      })
      form.reset()
      await load()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать интеграцию')
    }
  }

  const toggleEnabled = async (integration: AiIntegration) => {
    try {
      await updateAiIntegration(integration.id, { is_enabled: !integration.is_enabled })
      await load()
    } catch (err) {
      console.error(err)
      setError('Не удалось обновить запись')
    }
  }

  const runCheck = async (integration: AiIntegration) => {
    try {
      await runAiIntegrationCheck(integration.id)
      await load()
    } catch (err) {
      console.error(err)
      setError('Health-check завершился ошибкой')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Integrations</CardTitle>
        <CardDescription>Управляйте подключениями к AI-провайдерам и проверяйте конфигурацию.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2 rounded-md border border-border p-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-3">
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider ID</FormLabel>
                    <FormControl>
                      <Input placeholder="openai" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input placeholder="OpenAI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="envVarName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ENV variable</FormLabel>
                    <FormControl>
                      <Input placeholder="OPENAI_API_KEY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-3">
                <Button type="submit">Добавить интеграцию</Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="space-y-3">
          {items.map((integration) => (
            <div key={integration.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{integration.display_name}</p>
                  <p className="text-sm text-muted-foreground">{integration.provider}</p>
                  <p className="text-xs text-muted-foreground">ENV: {integration.env_var_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Last check: {integration.last_check_status ?? 'never'}{' '}
                    {integration.last_check_at ? `(${new Date(integration.last_check_at).toLocaleString()})` : ''}
                    {integration.last_check_message ? ` — ${integration.last_check_message}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleEnabled(integration)}>
                    {integration.is_enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" onClick={() => runCheck(integration)}>
                    Run check
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">Нет интеграций</p>}
        </div>
      </CardContent>
    </Card>
  )
}

type DevFilters = { status: string; category: string; provider: string }

const DevTasksSection = () => {
  const [tasks, setTasks] = useState<DevTask[]>([])
  const [filters, setFilters] = useState<DevFilters>({ status: '', category: '', provider: '' })
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof DEV_FORM_SCHEMA>>({
    resolver: zodResolver(DEV_FORM_SCHEMA),
    defaultValues: {
      title: '',
      category: 'integration',
      relatedProvider: '',
      relatedEnvVars: '',
      priority: 'medium',
    },
  })

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await listDevTasks({
        status: filters.status || undefined,
        category: filters.category || undefined,
        provider: filters.provider || undefined,
      })
      setTasks(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить задачи')
    }
  }, [filters])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const onSubmit = async (values: z.infer<typeof DEV_FORM_SCHEMA>) => {
    try {
      await createDevTask({
        title: values.title,
        category: values.category,
        related_provider: values.relatedProvider || undefined,
        related_env_vars: values.relatedEnvVars ? values.relatedEnvVars.split(',').map((v) => v.trim()) : [],
        priority: values.priority,
      })
      form.reset({
        title: '',
        category: 'integration',
        relatedProvider: '',
        relatedEnvVars: '',
        priority: 'medium',
      })
      await load()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать задачу')
    }
  }

  const updateField = async (task: DevTask, field: string, value: string) => {
    try {
      await updateDevTask(task.id, { [field]: value })
      await load()
    } catch (err) {
      console.error(err)
      setError('Не удалось обновить задачу')
    }
  }

  const removeTask = async (task: DevTask) => {
    try {
      await deleteDevTask(task.id)
      await load()
    } catch (err) {
      console.error(err)
      setError('Не удалось удалить задачу')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dev / Integration To-Do</CardTitle>
        <CardDescription>Фиксируйте шаги интеграций, env конфиги и прогресс.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {(['status', 'category', 'provider'] as Array<keyof DevFilters>).map((filterKey) => (
            <select
              key={filterKey}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters[filterKey]}
              onChange={(e) => setFilters((prev) => ({ ...prev, [filterKey]: e.target.value }))}
            >
              <option value="">{filterKey}</option>
              {filterKey === 'status' &&
                ['todo', 'in_progress', 'blocked', 'done'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              {filterKey === 'category' &&
                ['integration', 'auth', 'ai', 'billing', 'infrastructure', 'other'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              {filterKey === 'provider' &&
                ['google', 'yandex', 'openai', ''].map((option) => (
                  <option key={option || 'any'} value={option}>
                    {option || 'any'}
                  </option>
                ))}
            </select>
          ))}
        </div>

        <div className="rounded-md border border-border p-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Название задачи</FormLabel>
                    <FormControl>
                      <Input placeholder="Например, Подготовить Яндекс OAuth" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Категория</FormLabel>
                    <FormControl>
                      <select className="h-10 w-full rounded-md border border-input px-3 text-sm" {...field}>
                        {['integration', 'auth', 'ai', 'billing', 'infrastructure', 'other'].map((option) => (
                          <option key={option} value={option}>
                            {option}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Приоритет</FormLabel>
                    <FormControl>
                      <select className="h-10 w-full rounded-md border border-input px-3 text-sm" {...field}>
                        {['low', 'medium', 'high', 'critical'].map((option) => (
                          <option key={option} value={option}>
                            {option}
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
                name="relatedProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Провайдер</FormLabel>
                    <FormControl>
                      <Input placeholder="yandex" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="relatedEnvVars"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>ENV vars (через запятую)</FormLabel>
                    <FormControl>
                      <Input placeholder="YANDEX_CLIENT_ID,YANDEX_CLIENT_SECRET" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-2">
                <Button type="submit">Добавить задачу</Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {task.category} • provider: {task.related_provider ?? '-'} • envs:{' '}
                    {task.related_env_vars.join(', ') || '-'}
                  </p>
                  {task.description && <p className="text-sm">{task.description}</p>}
                  {task.external_link && (
                    <a href={task.external_link} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                      Документация
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <div className="flex gap-2">
                    <select
                      className="h-9 rounded-md border border-input px-2 text-sm"
                      value={task.status}
                      onChange={(e) => updateField(task, 'status', e.target.value)}
                    >
                      {['todo', 'in_progress', 'blocked', 'done'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 rounded-md border border-input px-2 text-sm"
                      value={task.priority}
                      onChange={(e) => updateField(task, 'priority', e.target.value)}
                    >
                      {['low', 'medium', 'high', 'critical'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => removeTask(task)}>
                    Удалить
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">Нет задач</p>}
        </div>
      </CardContent>
    </Card>
  )
}

