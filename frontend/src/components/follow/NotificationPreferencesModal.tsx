import { useState } from 'react'
import { Bell, Mail, Smartphone, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { NotificationPreferences } from '@/types/product'

export interface NotificationPreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: NotificationPreferences
  onSave: (preferences: NotificationPreferences) => Promise<void> | void
  targetName?: string
  targetType?: 'product' | 'organization'
}

const digestOptions = [
  { value: 'instant', label: 'Мгновенно' },
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
  { value: 'never', label: 'Никогда' },
] as const

export function NotificationPreferencesModal({
  open,
  onOpenChange,
  preferences: initialPreferences,
  onSave,
  targetName,
  targetType = 'product',
}: NotificationPreferencesModalProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(initialPreferences)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(preferences)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Настройки уведомлений
          </DialogTitle>
          <DialogDescription>
            {targetName
              ? `Настройте уведомления для "${targetName}"`
              : 'Настройте, как вы хотите получать уведомления'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Channels Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Каналы доставки</CardTitle>
              <CardDescription>Выберите, как получать уведомления</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="email-enabled" className="cursor-pointer">
                    Email-уведомления
                  </Label>
                </div>
                <Checkbox
                  id="email-enabled"
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) =>
                    updatePreference('email_enabled', checked === true)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="push-enabled" className="cursor-pointer">
                    Push-уведомления
                  </Label>
                </div>
                <Checkbox
                  id="push-enabled"
                  checked={preferences.push_enabled}
                  onCheckedChange={(checked) =>
                    updatePreference('push_enabled', checked === true)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="digest-frequency">Частота дайджеста</Label>
                </div>
                <Select
                  value={preferences.digest_frequency}
                  onValueChange={(value: NotificationPreferences['digest_frequency']) =>
                    updatePreference('digest_frequency', value)
                  }
                >
                  <SelectTrigger id="digest-frequency" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {digestOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Types Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Типы уведомлений</CardTitle>
              <CardDescription>
                Выберите, о чем вас уведомлять
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NotificationToggle
                id="price-drops"
                label="Снижение цены"
                description="Когда цена становится ниже"
                checked={preferences.notify_price_drops}
                onCheckedChange={(checked) =>
                  updatePreference('notify_price_drops', checked)
                }
              />

              {targetType === 'organization' && (
                <NotificationToggle
                  id="new-products"
                  label="Новые товары"
                  description="Когда появляются новые продукты"
                  checked={preferences.notify_new_products}
                  onCheckedChange={(checked) =>
                    updatePreference('notify_new_products', checked)
                  }
                />
              )}

              <NotificationToggle
                id="stories"
                label="Новости и истории"
                description="Публикации от производителя"
                checked={preferences.notify_stories}
                onCheckedChange={(checked) =>
                  updatePreference('notify_stories', checked)
                }
              />

              <NotificationToggle
                id="certifications"
                label="Сертификаты"
                description="Новые подтверждения качества"
                checked={preferences.notify_certifications}
                onCheckedChange={(checked) =>
                  updatePreference('notify_certifications', checked)
                }
              />
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface NotificationToggleProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function NotificationToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: NotificationToggleProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between rounded-lg border p-3 transition-colors',
        checked && 'border-primary/50 bg-primary/5'
      )}
    >
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
      />
    </div>
  )
}
