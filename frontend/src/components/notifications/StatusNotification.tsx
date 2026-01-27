/**
 * StatusNotification Component
 *
 * Displays status level notifications with appropriate styling, icons, and CTAs.
 * Supports 4 notification types:
 * - status_granted (celebration)
 * - status_expiring (warning)
 * - status_revoked (error)
 * - upgrade_request_reviewed (info)
 */

import { AlertTriangle, CheckCircle, Clock, PartyPopper, Trophy, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type {
  StatusNotification,
  StatusNotificationCardProps,
  StatusNotificationType,
} from '@/types/status-notifications'
import { cn } from '@/lib/utils'

/**
 * Icon mapping for each notification type
 */
const NOTIFICATION_ICONS: Record<StatusNotificationType, LucideIcon> = {
  status_granted: PartyPopper,
  status_expiring: Clock,
  status_revoked: XCircle,
  upgrade_request_reviewed: CheckCircle,
}

/**
 * Color scheme mapping for each notification type
 */
const NOTIFICATION_COLORS = {
  celebration: {
    border: 'border-green-500',
    bg: 'bg-green-50',
    icon: 'text-green-600',
    badge: 'bg-green-100 text-green-800',
  },
  warning: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  error: {
    border: 'border-red-500',
    bg: 'bg-red-50',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-800',
  },
  info: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800',
  },
}

/**
 * Russian labels for notification types
 */
const NOTIFICATION_LABELS: Record<StatusNotificationType, string> = {
  status_granted: 'Новый статус',
  status_expiring: 'Истекает срок',
  status_revoked: 'Статус отозван',
  upgrade_request_reviewed: 'Результат проверки',
}

/**
 * Format timestamp to Russian locale
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'только что'
  if (diffMins < 60) return `${diffMins} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays < 7) return `${diffDays} дн. назад`

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/**
 * Main StatusNotificationCard Component
 */
export const StatusNotificationCard = ({
  notification,
  onRead,
  onDismiss,
  onCtaClick,
}: StatusNotificationCardProps) => {
  const Icon = NOTIFICATION_ICONS[notification.type]
  const colors = NOTIFICATION_COLORS[notification.severity]
  const label = NOTIFICATION_LABELS[notification.type]

  const handleCtaClick = () => {
    if (notification.cta_url && onCtaClick) {
      onCtaClick(notification.id, notification.cta_url)
    }
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300 hover:shadow-md',
        'border-l-4',
        colors.border,
        notification.read && 'opacity-60'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {/* Icon */}
            <div className={cn('p-2 rounded-full', colors.bg)}>
              <Icon className={cn('h-5 w-5', colors.icon)} />
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('text-xs', colors.badge)} variant="secondary">
                  {label}
                </Badge>
                {!notification.read && (
                  <Badge className="bg-blue-500 text-white text-xs" variant="default">
                    Новое
                  </Badge>
                )}
              </div>
              <AlertTitle className="text-lg font-semibold leading-tight">
                {notification.title}
              </AlertTitle>
              <p className="text-sm text-muted-foreground">
                {formatTimestamp(notification.created_at)}
              </p>
            </div>

            {/* Dismiss button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-destructive/10"
              onClick={() => onDismiss?.(notification.id)}
            >
              <XCircle className="h-4 w-4" />
              <span className="sr-only">Скрыть</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4 space-y-4">
        {/* Body text */}
        <AlertDescription className="text-sm leading-relaxed">
          {notification.body}
        </AlertDescription>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {notification.cta_label && notification.cta_url && (
            <Button
              size="sm"
              className={cn(
                notification.severity === 'celebration' && 'bg-green-600 hover:bg-green-700',
                notification.severity === 'warning' && 'bg-yellow-600 hover:bg-yellow-700',
                notification.severity === 'error' && 'bg-red-600 hover:bg-red-700',
                notification.severity === 'info' && 'bg-blue-600 hover:bg-blue-700'
              )}
              onClick={handleCtaClick}
            >
              {notification.cta_label}
            </Button>
          )}
          {!notification.read && onRead && (
            <Button size="sm" variant="outline" onClick={() => onRead(notification.id)}>
              Отметить прочитанным
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Compact variant for dropdown notifications
 */
export const StatusNotificationCompact = ({
  notification,
  onRead,
  onCtaClick,
}: StatusNotificationCardProps) => {
  const Icon = NOTIFICATION_ICONS[notification.type]
  const colors = NOTIFICATION_COLORS[notification.severity]

  const handleCtaClick = () => {
    if (notification.cta_url && onCtaClick) {
      onCtaClick(notification.id, notification.cta_url)
    }
  }

  return (
    <Alert
      className={cn(
        'relative cursor-pointer transition-all hover:bg-accent',
        'border-l-4',
        colors.border,
        notification.read && 'opacity-60'
      )}
      onClick={() => onRead?.(notification.id)}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5', colors.icon)} />
        <div className="flex-1 space-y-1">
          <AlertTitle className="text-sm font-semibold leading-tight">
            {notification.title}
          </AlertTitle>
          <AlertDescription className="text-xs line-clamp-2">
            {notification.body}
          </AlertDescription>
          <p className="text-xs text-muted-foreground">
            {formatTimestamp(notification.created_at)}
          </p>
        </div>
      </div>
    </Alert>
  )
}

/**
 * Notification builder helper function
 */
export const buildStatusNotification = (
  type: StatusNotificationType,
  data: Partial<StatusNotification>
): StatusNotification => {
  const defaults: Record<StatusNotificationType, Partial<StatusNotification>> = {
    status_granted: {
      severity: 'celebration',
      cta_label: 'Посмотреть профиль',
    },
    status_expiring: {
      severity: 'warning',
      cta_label: 'Продлить сейчас',
    },
    status_revoked: {
      severity: 'error',
      cta_label: 'Узнать подробности',
    },
    upgrade_request_reviewed: {
      severity: 'info',
      cta_label: 'Посмотреть статус',
    },
  }

  return {
    id: data.id || crypto.randomUUID(),
    type,
    title: data.title || '',
    body: data.body || '',
    created_at: data.created_at || new Date().toISOString(),
    read: data.read || false,
    metadata: data.metadata || ({} as any),
    ...defaults[type],
    ...data,
  } as StatusNotification
}
