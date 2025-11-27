import { useCallback, useEffect, useState } from 'react'

import {
  dismissNotification,
  listNotifications,
  markNotificationRead,
} from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { NotificationDelivery } from '@/types/auth'

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationDelivery[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (reset = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listNotifications({ cursor: reset ? undefined : cursor ?? undefined, limit: 20 })
      if (reset) {
        setNotifications(data.items)
      } else {
        setNotifications((prev) => [...prev, ...data.items])
      }
      setCursor(data.next_cursor ?? null)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить уведомления')
    } finally {
      setLoading(false)
    }
  }, [cursor])

  useEffect(() => {
    void load(true)
  }, [load])

  const handleRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'read', read_at: new Date().toISOString() } : item)),
    )
  }

  const handleDismiss = async (id: string) => {
    await dismissNotification(id)
    setNotifications((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Уведомления</h1>
        <p className="text-muted-foreground">Последние события по вашей организации и платформе.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {notifications.map((notification) => (
          <Card key={notification.id} className={notification.status === 'read' ? 'opacity-70' : ''}>
            <CardHeader>
              <CardTitle>{notification.notification.title}</CardTitle>
              <CardDescription>
                {new Date(notification.notification.created_at).toLocaleString('ru-RU')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>{notification.notification.body}</p>
              <div className="flex flex-wrap gap-2">
                {notification.status !== 'read' && (
                  <Button size="sm" variant="outline" onClick={() => handleRead(notification.id)}>
                    Прочитано
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleDismiss(notification.id)}>
                  Скрыть
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {cursor && (
        <div className="mt-4">
          <Button onClick={() => load()} disabled={loading}>
            Загрузить ещё
          </Button>
        </div>
      )}
    </div>
  )
}

