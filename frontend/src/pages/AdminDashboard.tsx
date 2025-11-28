import { useEffect, useState } from 'react'

import { getAdminDashboardSummary } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminDashboardSummary } from '@/types/auth'
import { useUserStore } from '@/store/userStore'

export const AdminDashboardPage = () => {
  const { platformRoles } = useUserStore()
  const [data, setData] = useState<AdminDashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = platformRoles.includes('platform_admin')

  useEffect(() => {
    if (!isAdmin) return
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const summary = await getAdminDashboardSummary()
        if (mounted) setData(summary)
      } catch (err) {
        console.error(err)
        if (mounted) setError('Не удалось загрузить данные платформы')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно прав</AlertTitle>
          <AlertDescription>Дашборд доступен только платформенным администраторам.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Платформа</p>
        <h1 className="text-3xl font-semibold">Ключевые метрики</h1>
        <p className="text-muted-foreground">Сводные цифры по организациям, товарам и QR-активности.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-sm text-muted-foreground">Загружаем данные…</p>}

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Организаций</CardTitle>
              <CardDescription>Всего зарегистрировано</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{data.total_organizations}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Проверено</CardTitle>
              <CardDescription>Организации со статусом verified</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{data.verified_organizations}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Публично</CardTitle>
              <CardDescription>Отображаются в каталоге</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{data.public_organizations}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Товаров</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{data.total_products}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>QR-коды</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{data.total_qr_codes}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Сканов</CardTitle>
              <CardDescription>Накопительно по платформе</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{data.total_qr_events}</CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

