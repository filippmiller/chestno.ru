import { useEffect, useState } from 'react'

import { getNotificationSettings, updateNotificationSettings } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { NotificationSetting, NotificationSettingUpdate } from '@/types/auth'

export const NotificationSettingsPage = () => {
  const [settings, setSettings] = useState<NotificationSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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
  }, [])

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
                  onCheckedChange={() => toggleChannel(setting, 'in_app')}
                  disabled={loading}
                />
                In-app
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={setting.channels.includes('email')}
                  onCheckedChange={() => toggleChannel(setting, 'email')}
                  disabled={loading}
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={setting.muted} onCheckedChange={() => toggleMuted(setting)} disabled={loading} />
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

