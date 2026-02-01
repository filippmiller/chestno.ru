/**
 * AlertPreferencesForm Component
 *
 * Comprehensive settings form for organization-wide alert preferences.
 * Handles quiet hours, default channels, escalation, and digest settings.
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bell,
  BellOff,
  Clock,
  Mail,
  MessageCircle,
  Smartphone,
  Shield,
  TrendingUp,
  Calendar,
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
  AlertPreferencesFormData,
  OrganizationAlertPreferences,
  NotificationChannel,
} from '@/types/scan-alerts'

const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (MSK)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (EET)' },
  { value: 'Europe/Samara', label: 'Самара (SAMT)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (YEKT)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (NOVT)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (KRAT)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (IRKT)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (YAKT)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (VLAT)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (PETT)' },
]

const CHANNELS: Array<{ value: NotificationChannel; label: string; icon: typeof Bell }> = [
  { value: 'in_app', label: 'В приложении', icon: Bell },
  { value: 'push', label: 'Push-уведомления', icon: Smartphone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'telegram', label: 'Telegram', icon: MessageCircle },
]

const formSchema = z.object({
  alerts_enabled: z.boolean(),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  quiet_hours_timezone: z.string(),
  default_channels: z.array(z.enum(['in_app', 'push', 'email', 'telegram'])).min(1, {
    message: 'Выберите хотя бы один канал доставки',
  }),
  auto_escalate_critical: z.boolean(),
  escalation_delay_minutes: z.number().min(5).max(120),
  send_daily_digest: z.boolean(),
  digest_time: z.string().optional(),
  scan_spike_threshold: z.number().min(10).max(1000),
  scan_spike_window_minutes: z.number().min(15).max(240),
})

interface AlertPreferencesFormProps {
  preferences: OrganizationAlertPreferences
  onSubmit: (data: AlertPreferencesFormData) => Promise<void>
  isLoading?: boolean
}

export function AlertPreferencesForm({
  preferences,
  onSubmit,
  isLoading = false,
}: AlertPreferencesFormProps) {
  const form = useForm<AlertPreferencesFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      alerts_enabled: preferences.alerts_enabled,
      quiet_hours_enabled: !!preferences.quiet_hours_start,
      quiet_hours_start: preferences.quiet_hours_start || '22:00',
      quiet_hours_end: preferences.quiet_hours_end || '08:00',
      quiet_hours_timezone: preferences.quiet_hours_timezone || 'Europe/Moscow',
      default_channels: preferences.default_channels || ['in_app', 'email'],
      auto_escalate_critical: preferences.auto_escalate_critical,
      escalation_delay_minutes: preferences.escalation_delay_minutes,
      send_daily_digest: preferences.send_daily_digest,
      digest_time: preferences.digest_time || '09:00',
      scan_spike_threshold: preferences.scan_spike_threshold,
      scan_spike_window_minutes: preferences.scan_spike_window_minutes,
    },
  })

  const alertsEnabled = form.watch('alerts_enabled')
  const quietHoursEnabled = form.watch('quiet_hours_enabled')
  const sendDigest = form.watch('send_daily_digest')

  const handleSubmit = async (data: AlertPreferencesFormData) => {
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
                {alertsEnabled ? (
                  <Bell className="h-5 w-5 text-green-600" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle>Оповещения о сканированиях</CardTitle>
                  <CardDescription>
                    Получайте уведомления о важных событиях сканирования
                  </CardDescription>
                </div>
              </div>
              <FormField
                control={form.control}
                name="alerts_enabled"
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

        {alertsEnabled && (
          <>
            {/* Notification Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Каналы доставки
                </CardTitle>
                <CardDescription>
                  Выберите способы получения уведомлений по умолчанию
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="default_channels"
                  render={() => (
                    <FormItem>
                      <div className="grid grid-cols-2 gap-4">
                        {CHANNELS.map((channel) => (
                          <FormField
                            key={channel.value}
                            control={form.control}
                            name="default_channels"
                            render={({ field }) => {
                              const Icon = channel.icon
                              return (
                                <FormItem
                                  className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors"
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
                                      checked={field.value?.includes(channel.value)}
                                    />
                                  </FormControl>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <FormLabel className="cursor-pointer font-normal">
                                      {channel.label}
                                    </FormLabel>
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

            {/* Quiet Hours */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5" />
                    <div>
                      <CardTitle>Тихие часы</CardTitle>
                      <CardDescription>
                        Не отправлять уведомления в определённое время
                        (кроме критических)
                      </CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="quiet_hours_enabled"
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
              {quietHoursEnabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quiet_hours_start"
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
                      name="quiet_hours_end"
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
                    name="quiet_hours_timezone"
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
                            {TIMEZONES.map((tz) => (
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

            {/* Escalation Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Эскалация критических оповещений
                </CardTitle>
                <CardDescription>
                  Автоматически эскалировать необработанные критические
                  оповещения
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="auto_escalate_critical"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Автоматическая эскалация</FormLabel>
                        <FormDescription>
                          Повторно уведомлять, если критическое оповещение не
                          обработано
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
                  name="escalation_delay_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Задержка эскалации: {field.value} минут
                      </FormLabel>
                      <FormControl>
                        <Slider
                          min={5}
                          max={120}
                          step={5}
                          value={[field.value]}
                          onValueChange={([value]) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormDescription>
                        Время ожидания перед эскалацией необработанного
                        оповещения
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Daily Digest */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5" />
                    <div>
                      <CardTitle>Ежедневный дайджест</CardTitle>
                      <CardDescription>
                        Сводка событий за день на email
                      </CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="send_daily_digest"
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
              {sendDigest && (
                <CardContent>
                  <FormField
                    control={form.control}
                    name="digest_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Время отправки</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="w-32" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* Spike Detection Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Порог обнаружения всплесков
                </CardTitle>
                <CardDescription>
                  Настройте чувствительность определения всплесков активности
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="scan_spike_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Минимальное количество сканирований: {field.value}
                      </FormLabel>
                      <FormControl>
                        <Slider
                          min={10}
                          max={1000}
                          step={10}
                          value={[field.value]}
                          onValueChange={([value]) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormDescription>
                        Минимальное число сканирований для определения всплеска
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scan_spike_window_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Временное окно: {field.value} минут
                      </FormLabel>
                      <FormControl>
                        <Slider
                          min={15}
                          max={240}
                          step={15}
                          value={[field.value]}
                          onValueChange={([value]) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormDescription>
                        Период времени для анализа всплеска
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
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
