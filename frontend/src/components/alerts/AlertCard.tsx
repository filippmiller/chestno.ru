/**
 * AlertCard Component
 *
 * Displays a single scan alert with severity styling, status badge,
 * and action buttons for acknowledgment/resolution.
 */

'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle,
  Clock,
  Eye,
  Info,
  MapPin,
  MoreVertical,
  Package,
  X,
  MessageSquare,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ScanAlert, AlertCardProps } from '@/types/scan-alerts'
import { ALERT_SEVERITY_CONFIG, ALERT_STATUS_CONFIG } from '@/types/scan-alerts'

const SeverityIcon = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
}

export function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onDismiss,
  onViewDetails,
  isCompact = false,
}: AlertCardProps) {
  const [showResolveDialog, setShowResolveDialog] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const severityConfig = ALERT_SEVERITY_CONFIG[alert.severity]
  const statusConfig = ALERT_STATUS_CONFIG[alert.status]
  const Icon = SeverityIcon[alert.severity]

  const handleResolve = async () => {
    setIsSubmitting(true)
    try {
      await onResolve?.(alert.id, resolutionNotes)
      setShowResolveDialog(false)
      setResolutionNotes('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(alert.created_at), {
    addSuffix: true,
    locale: ru,
  })

  if (isCompact) {
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg border-l-4 cursor-pointer hover:bg-accent transition-colors',
          severityConfig.color.split(' ')[1], // border color
          alert.status !== 'new' && 'opacity-60'
        )}
        onClick={() => onViewDetails?.(alert.id)}
      >
        <Icon className={cn('h-5 w-5 mt-0.5', severityConfig.color.split(' ')[2])} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{alert.title}</p>
          <p className="text-xs text-muted-foreground truncate">{alert.body}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {alert.is_escalated && (
              <Badge variant="destructive" className="text-xs h-5">
                Эскалировано
              </Badge>
            )}
          </div>
        </div>
        {alert.status === 'new' && (
          <Badge className="bg-blue-500 text-white text-xs">Новое</Badge>
        )}
      </div>
    )
  }

  return (
    <>
      <Card
        className={cn(
          'relative overflow-hidden border-l-4 transition-all duration-200 hover:shadow-md',
          severityConfig.color.split(' ')[1],
          alert.status !== 'new' && 'opacity-75'
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              {/* Severity Icon */}
              <div
                className={cn(
                  'p-2 rounded-full',
                  severityConfig.color.split(' ')[0]
                )}
              >
                <Icon
                  className={cn('h-5 w-5', severityConfig.color.split(' ')[2])}
                />
              </div>

              {/* Title & Meta */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn('text-xs', severityConfig.color)}
                  >
                    {severityConfig.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn('text-xs', statusConfig.color, 'text-white')}
                  >
                    {statusConfig.label}
                  </Badge>
                  {alert.is_escalated && (
                    <Badge variant="destructive" className="text-xs">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      Эскалировано
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg leading-tight">
                  {alert.title}
                </h3>
                <p className="text-sm text-muted-foreground">{timeAgo}</p>
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewDetails?.(alert.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Подробнее
                  </DropdownMenuItem>
                  {alert.status === 'new' && (
                    <DropdownMenuItem onClick={() => onAcknowledge?.(alert.id)}>
                      <Check className="h-4 w-4 mr-2" />
                      Принять
                    </DropdownMenuItem>
                  )}
                  {alert.status !== 'resolved' && alert.status !== 'dismissed' && (
                    <DropdownMenuItem onClick={() => setShowResolveDialog(true)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Решить
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDismiss?.(alert.id)}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Отклонить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {alert.body}
          </p>

          {/* Context Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {alert.batch && (
              <Badge variant="outline" className="text-xs">
                <Package className="h-3 w-3 mr-1" />
                {alert.batch.batch_code}
              </Badge>
            )}
            {alert.metadata?.location && (
              <Badge variant="outline" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                {alert.metadata.location as string}
              </Badge>
            )}
            {alert.metadata?.scan_count && (
              <Badge variant="outline" className="text-xs">
                {alert.metadata.scan_count as number} сканирований
              </Badge>
            )}
          </div>

          {/* Resolution Notes */}
          {alert.resolution_notes && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MessageSquare className="h-4 w-4" />
                Комментарий к решению
              </div>
              <p className="text-sm">{alert.resolution_notes}</p>
            </div>
          )}
        </CardContent>

        {alert.status === 'new' && (
          <CardFooter className="pt-0 gap-2">
            <Button
              size="sm"
              onClick={() => onAcknowledge?.(alert.id)}
              className={cn(
                alert.severity === 'critical' && 'bg-red-600 hover:bg-red-700',
                alert.severity === 'warning' && 'bg-yellow-600 hover:bg-yellow-700',
                alert.severity === 'info' && 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              <Check className="h-4 w-4 mr-1" />
              Принять
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowResolveDialog(true)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Решить
            </Button>
          </CardFooter>
        )}

        {/* Timestamp footer */}
        {alert.acknowledged_at && (
          <div className="px-6 pb-4 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-1" />
            Принято{' '}
            {formatDistanceToNow(new Date(alert.acknowledged_at), {
              addSuffix: true,
              locale: ru,
            })}
          </div>
        )}
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отметить как решённое</DialogTitle>
            <DialogDescription>
              Опишите, как была решена проблема (необязательно)
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Например: Проверили партию, подделки не обнаружены..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResolveDialog(false)}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
            <Button onClick={handleResolve} disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Решить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * AlertList Component - renders a list of alerts
 */
export function AlertList({
  alerts,
  onAcknowledge,
  onResolve,
  onDismiss,
  onViewDetails,
  isCompact = false,
  emptyMessage = 'Нет оповещений',
}: {
  alerts: ScanAlert[]
  onAcknowledge?: (id: string) => void
  onResolve?: (id: string, notes?: string) => void
  onDismiss?: (id: string) => void
  onViewDetails?: (id: string) => void
  isCompact?: boolean
  emptyMessage?: string
}) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', isCompact && 'space-y-2')}>
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onAcknowledge={onAcknowledge}
          onResolve={onResolve}
          onDismiss={onDismiss}
          onViewDetails={onViewDetails}
          isCompact={isCompact}
        />
      ))}
    </div>
  )
}
