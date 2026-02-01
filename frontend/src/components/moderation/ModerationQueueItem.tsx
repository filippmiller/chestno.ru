/**
 * Moderation Queue Item
 * Individual card component for a moderation queue item.
 */
import type { ModerationQueueItem as QueueItemType } from '@/types/moderation'
import {
  CONTENT_TYPE_LABELS,
  QUEUE_STATUS_LABELS,
  getPriorityColor,
  getPriorityLabel,
} from '@/types/moderation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ModerationQueueItemProps {
  item: QueueItemType
  isSelected?: boolean
  onSelect?: () => void
  onAssign?: () => void
  onQuickApprove?: () => void
  onQuickReject?: () => void
  showQuickActions?: boolean
}

export function ModerationQueueItem({
  item,
  isSelected,
  onSelect,
  onAssign,
  onQuickApprove,
  onQuickReject,
  showQuickActions = false,
}: ModerationQueueItemProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Priority and Info */}
          <div className="flex items-start gap-3">
            {/* Priority Indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getPriorityColor(
                  item.priority_score
                )}`}
              >
                {item.priority_score}
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {getPriorityLabel(item.priority_score)}
              </span>
            </div>

            {/* Content Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">
                  {CONTENT_TYPE_LABELS[item.content_type] || item.content_type}
                </Badge>
                <SourceBadge source={item.source} />
                <StatusBadge status={item.status} />
              </div>

              <p className="text-sm text-muted-foreground">
                ID: {item.content_id.slice(0, 8)}...
              </p>

              {/* AI Flags */}
              {item.ai_flags?.flags && item.ai_flags.flags.length > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-orange-600 font-medium">
                    AI: {item.ai_flags.flags.length} флаг(ов)
                  </span>
                  {item.ai_confidence_score && (
                    <span className="text-muted-foreground">
                      ({Math.round(item.ai_confidence_score * 100)}%)
                    </span>
                  )}
                </div>
              )}

              {/* Report Count */}
              {item.report_count > 0 && (
                <p className="text-sm text-red-600">
                  {item.report_count} жалоб(а)
                </p>
              )}

              {/* Assigned To */}
              {item.assigned_to_name && (
                <p className="text-sm text-muted-foreground">
                  Модератор: {item.assigned_to_name}
                </p>
              )}

              {/* Date */}
              <p className="text-xs text-muted-foreground">
                {formatRelativeDate(item.created_at)}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            {!item.assigned_to && onAssign && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onAssign()
                }}
              >
                Взять
              </Button>
            )}

            {showQuickActions && item.assigned_to && (
              <>
                {onQuickApprove && (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickApprove()
                    }}
                  >
                    Одобрить
                  </Button>
                )}
                {onQuickReject && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickReject()
                    }}
                  >
                    Отклонить
                  </Button>
                )}
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.()
              }}
            >
              Открыть
            </Button>
          </div>
        </div>

        {/* Priority Reasons */}
        {item.priority_reason && item.priority_reason.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex flex-wrap gap-1">
              {item.priority_reason.slice(0, 3).map((reason, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {reason}
                </Badge>
              ))}
              {item.priority_reason.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{item.priority_reason.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    auto_flag: { variant: 'secondary', label: 'AI' },
    user_report: { variant: 'destructive', label: 'Жалоба' },
    new_content: { variant: 'default', label: 'Новый' },
    edit: { variant: 'outline', label: 'Изменение' },
    appeal: { variant: 'secondary', label: 'Апелляция' },
  }

  const style = config[source] || { variant: 'outline' as const, label: source }

  return <Badge variant={style.variant}>{style.label}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    pending: { variant: 'outline', className: 'border-yellow-500 text-yellow-700' },
    in_review: { variant: 'outline', className: 'border-blue-500 text-blue-700' },
    approved: { variant: 'outline', className: 'border-green-500 text-green-700' },
    rejected: { variant: 'outline', className: 'border-red-500 text-red-700' },
    escalated: { variant: 'outline', className: 'border-orange-500 text-orange-700' },
    appealed: { variant: 'outline', className: 'border-purple-500 text-purple-700' },
    resolved: { variant: 'outline', className: 'border-gray-500 text-gray-700' },
  }

  const style = config[status] || { variant: 'outline' as const }
  const label = QUEUE_STATUS_LABELS[status as keyof typeof QUEUE_STATUS_LABELS] || status

  return (
    <Badge variant={style.variant} className={style.className}>
      {label}
    </Badge>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (hours < 1) return 'Только что'
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}
