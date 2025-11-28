import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

import { getNotificationSettings, updateNotificationSettings } from '@/api/authService'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { NotificationSetting, NotificationSettingUpdate } from '@/types/auth'
import {
  getPushSubscription,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '@/utils/pushNotifications'

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export const NotificationSettingsPage = () => {
  const [settings, setSettings] = useState<NotificationSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getNotificationSettings()
      setSettings(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void checkPushSubscription()
  }, [])

  const checkPushSubscription = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const subscription = await getPushSubscription()
      setPushEnabled(!!subscription)
    }
  }

  const handleTogglePush = async () => {
    setPushLoading(true)
    try {
      const hasPermission = await requestNotificationPermission()
      if (!hasPermission) {
        setError('Разрешение на уведомления не предоставлено')
        setPushLoading(false)
        return
      }

      if (pushEnabled) {
        await unsubscribeFromPushNotifications()
        // Удаляем subscription с сервера
        try {
          const supabase = getSupabaseClient()
          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token
          if (token) {
            await fetch('/api/notification-settings/push-subscription', {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })
          }
        } catch (err) {
          console.warn('Failed to delete push subscription:', err)
        }
        setPushEnabled(false)
        setMessage('Push-уведомления отключены')
      } else {
        const subscription = await subscribeToPushNotifications()
        if (subscription) {
          // Отправляем subscription на сервер для сохранения
          try {
            const supabase = getSupabaseClient()
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token
            if (token) {
              await fetch('/api/notification-settings/push-subscription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  subscription: {
                    endpoint: subscription.endpoint,
                    keys: {
                      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                      auth: arrayBufferToBase64(subscription.getKey('auth')),
                    },
                  },
                }),
              })
            }
          } catch (err) {
            console.warn('Failed to save push subscription:', err)
          }
          setPushEnabled(true)
          setMessage('Push-уведомления включены')
        } else {
          setError('Не удалось подписаться на push-уведомления')
        }
      }
    } catch (err) {
      console.error(err)
      setError('Ошибка при настройке push-уведомлений')
    } finally {
      setPushLoading(false)
    }
  }

  const toggleChannel = async (setting: NotificationSetting, channel: string) => {
    const channels = setting.channels.includes(channel)
      ? setting.channels.filter((ch) => ch !== channel)
      : [...setting.channels, channel]
    await save([{ notification_type_id: setting.notification_type_id, channels }])
  }

  const toggleMuted = async (setting: NotificationSetting) => {
    await save([{ notification_type_id: setting.notification_type_id, muted: !setting.muted }])
  }

  const save = async (updates: NotificationSettingUpdate[]) => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const data = await updateNotificationSettings(updates)
      setSettings(data)
      setMessage('Настройки сохранены')
    } catch (err) {
      console.error(err)
      setError('Не удалось сохранить настройки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Настройки уведомлений</h1>
        <p className="text-muted-foreground">Выберите, какие уведомления получать в приложении и по email.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {'serviceWorker' in navigator && 'PushManager' in window && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Push-уведомления в браузере
            </CardTitle>
            <CardDescription>Получайте уведомления даже когда сайт закрыт</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant={pushEnabled ? 'default' : 'outline'}
              onClick={handleTogglePush}
              disabled={pushLoading}
            >
              {pushEnabled ? 'Отключить' : 'Включить'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {settings.map((setting) => (
          <Card key={setting.notification_type_id}>
            <CardHeader>
              <CardTitle>{setting.notification_type.title_template}</CardTitle>
              <CardDescription>{setting.notification_type.body_template}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={setting.channels.includes('in_app')}
                  onChange={() => toggleChannel(setting, 'in_app')}
                  disabled={loading}
                />
                In-app
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={setting.channels.includes('email')}
                  onChange={() => toggleChannel(setting, 'email')}
                  disabled={loading}
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={setting.muted} onChange={() => toggleMuted(setting)} disabled={loading} />
                Отключить
              </label>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Button variant="outline" onClick={() => load()} disabled={loading}>
          Обновить
        </Button>
      </div>
    </div>
  )
}

