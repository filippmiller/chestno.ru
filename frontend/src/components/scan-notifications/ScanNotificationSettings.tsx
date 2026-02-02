/**
 * ScanNotificationSettings Component
 *
 * Comprehensive settings form for producer scan notification preferences.
 * Allows configuration of channels, filters, and notification behavior.
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bell,
  BellOff,
  Clock,
  Filter,
  Globe,
  Mail,
  MessageCircle,
  Smartphone,
  Webhook,
  AlertTriangle,
  Sparkles,
  MapPin,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import type {
  ScanNotificationPreferences,
  ScanNotificationPreferencesUpdate,
  NotificationChannel,
} from '@/types/scan-notifications'
import { RUSSIAN_TIMEZONES } from '@/types/scan-notifications'

const CHANNELS: Array<{ value: NotificationChannel; label: string; icon: typeof Bell; description: string }> = [
  { value: 'in_app', label: 'В приложении', icon: Bell, description: 'Уведомления в интерфейсе' },
  { value: 'push', label: 'Push', icon: Smartphone, description: 'На мобильное устройство' },
  { value: 'email', label: 'Email', icon: Mail, description: 'На электронную почту' },
  { value: 'telegram', label: 'Telegram', icon: MessageCircle, description: 'В Telegram бот' },
  { value: 'webhook', label: 'Webhook', icon: Webhook, description: 'HTTP запрос' },
]

const formSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.enum(['in_app', 'push', 'email', 'telegram', 'webhook'])).min(1, {
    message: 'Выберите хотя бы один канал доставки',
  }),
  notify_business_hours_only: z.boolean(),
  business_hours_start: z.string().optional(),
  business_hours_end: z.string().optional(),
  timezone: z.string(),
  batch_notifications: z.boolean(),
  batch_interval_minutes: z.number().min(1).max(60),
  min_scans_for_notification: z.number().min(1).max(100),
  notify_new_regions_only: z.boolean(),
  notify_first_scan_per_product: z.boolean(),
  notify_on_suspicious_scans: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

interface ScanNotificationSettingsProps {
  preferences: ScanNotificationPreferences
  onSubmit: (data: ScanNotificationPreferencesUpdate) => Promise<void>
  isLoading?: boolean
}

export function ScanNotificationSettings({
  preferences,
  onSubmit,
  isLoading = false,
}: ScanNotificationSettingsProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: preferences.enabled,
      channels: preferences.channels || ['in_app'],
      notify_business_hours_only: preferences.notify_business_hours_only,
      business_hours_start: preferences.business_hours_start || '09:00',
      business_hours_end: preferences.business_hours_end || '18:00',
      timezone: preferences.timezone || 'Europe/Moscow',
      batch_notifications: preferences.batch_notifications,
      batch_interval_minutes: preferences.batch_interval_minutes,
      min_scans_for_notification: preferences.min_scans_for_notification,
      notify_new_regions_only: preferences.notify_new_regions_only,
      notify_first_scan_per_product: preferences.notify_first_scan_per_product,
      notify_on_suspicious_scans: preferences.notify_on_suspicious_scans,
    },
  })

  const enabled = form.watch('enabled')
  const businessHoursOnly = form.watch('notify_business_hours_only')
  const batchNotifications = form.watch('batch_notifications')

  const handleSubmit = async (data: FormData) => {
    await onSubmit(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Master Switch */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {enabled ? (
                  <Bell className="h-5 w-5 text-green-600" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle>Уведомления о сканированиях</CardTitle>
                  <CardDescription>
                    Получайте уведомления когда ваши продукты сканируют
                  </CardDescription>
                </div>
              </div>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardHeader>
        </Card>

        {enabled && (
          <>
            {/* Notification Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Каналы уведомлений
                </CardTitle>
                <CardDescription>
                  Выберите как вы хотите получать уведомления
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="channels"
                  render={() => (
                    <FormItem>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {CHANNELS.map((channel) => (
                          <FormField
                            key={channel.value}
                            control={form.control}
                            name="channels"
                            render={({ field }) => {
                              const Icon = channel.icon
                              const isSelected = field.value?.includes(channel.value)
                              return (
                                <FormItem
                                  className={`flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer transition-colors ${
                                    isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-accent'
                                  }`}
                                  onClick={() => {
                                    const current = field.value || []
                                    const updated = current.includes(channel.value)
                                      ? current.filter((v) => v !== channel.value)
                                      : [...current, channel.value]
                                    field.onChange(updated)
                                  }}
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={isSelected}
                                    />
                                  </FormControl>
                                  <div className="flex items-center gap-3 flex-1">
                                    <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                      <FormLabel className="cursor-pointer font-medium">
                                        {channel.label}
                                      </FormLabel>
                                      <p className="text-xs text-muted-foreground">
                                        {channel.description}
                                      </p>
                                    </div>
                                  </div>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Notification Triggers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Типы уведомлений
                </CardTitle>
                <CardDescription>
                  Настройте какие события вызывают уведомления
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="notify_first_scan_per_product"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-green-600" />
                          Первое сканирование продукта
                        </FormLabel>
                        <FormDescription>
                          Уведомлять когда продукт сканируют впервые
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notify_new_regions_only"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          Новые регионы
                        </FormLabel>
                        <FormDescription>
                          Уведомлять только о сканированиях из новых регионов
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notify_on_suspicious_scans"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          Подозрительная активность
                        </FormLabel>
                        <FormDescription>
                          Всегда уведомлять о подозрительных сканированиях
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Batching Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Filter className="h-5 w-5" />
                    <div>
                      <CardTitle>Группировка уведомлений</CardTitle>
                      <CardDescription>
                        Объединяйте несколько сканирований в одно уведомление
                      </CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="batch_notifications"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {batchNotifications && (
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="batch_interval_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Интервал группировки: {field.value} мин
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={60}
                            step={1}
                            value={[field.value]}
                            onValueChange={([value]) => field.onChange(value)}
                          />
                        </FormControl>
                        <FormDescription>
                          Сканирования за этот период будут объединены в одно уведомление
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="min_scans_for_notification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Минимум сканирований: {field.value}
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={100}
                            step={1}
                            value={[field.value]}
                            onValueChange={([value]) => field.onChange(value)}
                          />
                        </FormControl>
                        <FormDescription>
                          Уведомление отправится только при достижении этого количества
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* Business Hours */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5" />
                    <div>
                      <CardTitle>Рабочие часы</CardTitle>
                      <CardDescription>
                        Уведомлять только в рабочее время (кроме критических)
                      </CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="notify_business_hours_only"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {businessHoursOnly && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="business_hours_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Начало</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="business_hours_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Конец</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Часовой пояс</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите часовой пояс" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RUSSIAN_TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>
          </>
        )}

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
