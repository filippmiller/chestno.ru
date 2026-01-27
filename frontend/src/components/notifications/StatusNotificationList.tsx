/**
 * StatusNotificationList Component
 *
 * Container component for displaying a list of status notifications
 * with filtering, sorting, and pagination support.
 */

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StatusNotification, StatusNotificationType } from '@/types/status-notifications'

import { StatusNotificationCard } from './StatusNotification'

interface StatusNotificationListProps {
  notifications: StatusNotification[]
  onRead?: (id: string) => void
  onDismiss?: (id: string) => void
  onCtaClick?: (id: string, url: string) => void
  loading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
}

type FilterType = 'all' | StatusNotificationType

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'Все',
  status_granted: 'Получено',
  status_expiring: 'Истекает',
  status_revoked: 'Отозвано',
  upgrade_request_reviewed: 'Проверено',
}

export const StatusNotificationList = ({
  notifications,
  onRead,
  onDismiss,
  onCtaClick,
  loading,
  hasMore,
  onLoadMore,
}: StatusNotificationListProps) => {
  const [filter, setFilter] = useState<FilterType>('all')
  const [showRead, setShowRead] = useState(true)

  const filteredNotifications = notifications.filter((notification) => {
    if (filter !== 'all' && notification.type !== filter) return false
    if (!showRead && notification.read) return false
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Уведомления о статусах</h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Нет непрочитанных уведомлений'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRead(!showRead)}
        >
          {showRead ? 'Скрыть прочитанные' : 'Показать все'}
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={filter} className="mt-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Нет уведомлений</p>
            </div>
          ) : (
            <>
              {filteredNotifications.map((notification) => (
                <StatusNotificationCard
                  key={notification.id}
                  notification={notification}
                  onRead={onRead}
                  onDismiss={onDismiss}
                  onCtaClick={onCtaClick}
                />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button onClick={onLoadMore} disabled={loading} variant="outline">
            {loading ? 'Загрузка...' : 'Загрузить ещё'}
          </Button>
        </div>
      )}
    </div>
  )
}
