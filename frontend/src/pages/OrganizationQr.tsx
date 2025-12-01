import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createQrCode, getQrCodeStats, getBusinessPublicUrl, listQrCodes } from '@/api/authService'
import { BusinessQrCode } from '@/components/qr/BusinessQrCode'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/store/userStore'
import type { QRCode, QRCodePayload, QRCodeStats } from '@/types/auth'

const qrSchema = z.object({
  label: z.string().min(2, 'Введите название'),
})

type QRFormValues = z.infer<typeof qrSchema>

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager'])

export const OrganizationQrPage = () => {
  const { organizations, memberships, selectedOrganizationId, user } = useUserStore()
  const [qrCodes, setQrCodes] = useState<QRCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, QRCodeStats>>({})
  const [businessPublicUrl, setBusinessPublicUrl] = useState<string | null>(null)
  const form = useForm<QRFormValues>({ resolver: zodResolver(qrSchema), defaultValues: { label: '' } })
  const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000'

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )
  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canCreate = membership ? MANAGER_ROLES.has(membership.role) : false

  const organizationId = currentOrganization?.id

  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    Promise.all([
      listQrCodes(organizationId).catch(() => []),
      getBusinessPublicUrl(organizationId)
        .then((data) => setBusinessPublicUrl(data.public_url))
        .catch(() => setBusinessPublicUrl(null)),
    ])
      .then(([codes]) => setQrCodes(codes))
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false))
  }, [organizationId])

  if (!user || !currentOrganization || !organizationId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно данных</AlertTitle>
          <AlertDescription>Сначала войдите и выберите организацию.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const apiCreate = async (values: QRFormValues) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const payload: QRCodePayload = { label: values.label }
      await createQrCode(organizationId, payload)
      const list = await listQrCodes(organizationId)
      setQrCodes(list)
      form.reset({ label: '' })
    } catch (err) {
      console.error(err)
      setError('Не удалось создать QR-код')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (code: QRCode) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const stats = await getQrCodeStats(organizationId, code.id)
      setStatsMap((prev) => ({ ...prev, [code.id]: stats }))
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить статистику')
    } finally {
      setLoading(false)
    }
  }

  const qrLink = (code: string) => {
    const base = backendUrl.replace(/\/$/, '')
    return `${base}/q/${code}`
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">QR-коды</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">Генерируйте QR для продукции и отслеживайте сканы.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Business QR Code */}
      {businessPublicUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Ваш QR-код</CardTitle>
            <CardDescription>
              Распечатайте QR-код и разместите его на входе, на кассе, на упаковке или флаерах. Покупатели смогут
              просканировать код, перейти на вашу страницу на платформе и оставить отзыв.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessQrCode publicUrl={businessPublicUrl} businessName={currentOrganization.name} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Список QR-кодов</CardTitle>
          <CardDescription>Используйте эти ссылки на упаковке или в презентациях.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Загружаем…</p>}
          {!loading && qrCodes.length === 0 && (
            <p className="text-sm text-muted-foreground">Ещё нет QR-кодов</p>
          )}
          {!loading &&
            qrCodes.map((code) => (
              <div key={code.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-semibold">{code.label ?? code.code}</p>
                  <p className="text-sm text-muted-foreground">{qrLink(code.code)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(qrLink(code.code))}>
                      Скопировать URL
                    </Button>
                    <Button size="sm" onClick={() => loadStats(code)} disabled={loading}>
                      Показать статистику
                    </Button>
                  </div>
                  {statsMap[code.id] && (
                    <div className="mt-2 rounded-md border border-dashed border-border p-2 text-sm text-muted-foreground">
                      <p>Всего сканов: {statsMap[code.id].total}</p>
                      <p>За 7 дней: {statsMap[code.id].last_7_days}</p>
                      <p>За 30 дней: {statsMap[code.id].last_30_days}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Создать новый QR-код</CardTitle>
            <CardDescription>Каждый QR-код ведёт на публичную страницу вашей организации.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(apiCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Например, Наклейка для ведра" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={loading}>
                  Создать
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>Только владельцы и менеджеры могут создавать QR-коды</AlertTitle>
          <AlertDescription>Обратитесь к администратору организации.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

