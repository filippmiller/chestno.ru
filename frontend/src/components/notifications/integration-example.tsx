/**
 * Integration Example for Status Notifications
 *
 * This file shows how to integrate status notifications
 * into the existing Notifications page.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  dismissNotification,
  listNotifications,
  markNotificationRead,
} from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NotificationDelivery } from '@/types/auth'
import type { StatusNotification } from '@/types/status-notifications'
import {
  StatusNotificationCard,
  mockStatusNotifications,
} from '@/components/notifications'

/**
 * Example: Enhanced NotificationsPage with Status Notifications
 *
 * Replace your existing NotificationsPage with this implementation
 * or merge the status notifications section into your current page.
 */
export const EnhancedNotificationsPage = () => {
  // Regular notifications (existing)
  const [notifications, setNotifications] = useState<NotificationDelivery[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Status notifications (new)
  const [statusNotifications, setStatusNotifications] = useState<StatusNotification[]>(
    // In production, fetch from API. For now, using mock data.
    mockStatusNotifications
  )

  const [activeTab, setActiveTab] = useState<'all' | 'status' | 'general'>('all')

  // Load regular notifications
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
  }, [])

  // Handlers for regular notifications
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

  // Handlers for status notifications
  const handleStatusRead = (id: string) => {
    setStatusNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    // TODO: Call API to mark status notification as read
    console.log('Marked status notification as read:', id)
  }

  const handleStatusDismiss = (id: string) => {
    setStatusNotifications((prev) => prev.filter((n) => n.id !== id))
    // TODO: Call API to dismiss status notification
    console.log('Dismissed status notification:', id)
  }

  const handleStatusCtaClick = (id: string, url: string) => {
    // Mark as read on CTA click
    handleStatusRead(id)
    // Navigate to URL (use your router's navigation)
    window.location.href = url
  }

  // Calculate counts
  const statusUnreadCount = statusNotifications.filter((n) => !n.read).length
  const generalUnreadCount = notifications.filter((n) => n.status !== 'read').length
  const totalUnreadCount = statusUnreadCount + generalUnreadCount

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Уведомления</h1>
        <p className="text-muted-foreground">
          Последние события по вашей организации и платформе.
        </p>
        {totalUnreadCount > 0 && (
          <p className="text-sm text-blue-600 mt-1">
            {totalUnreadCount} непрочитанных уведомлений
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-6">
          <TabsTrigger value="all">
            Все {totalUnreadCount > 0 && `(${totalUnreadCount})`}
          </TabsTrigger>
          <TabsTrigger value="status">
            Статусы {statusUnreadCount > 0 && `(${statusUnreadCount})`}
          </TabsTrigger>
          <TabsTrigger value="general">
            Общие {generalUnreadCount > 0 && `(${generalUnreadCount})`}
          </TabsTrigger>
        </TabsList>

        {/* All Notifications */}
        <TabsContent value="all" className="space-y-3">
          {/* Status Notifications First */}
          {statusNotifications.map((notification) => (
            <StatusNotificationCard
              key={notification.id}
              notification={notification}
              onRead={handleStatusRead}
              onDismiss={handleStatusDismiss}
              onCtaClick={handleStatusCtaClick}
            />
          ))}

          {/* Regular Notifications */}
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
        </TabsContent>

        {/* Status Notifications Only */}
        <TabsContent value="status" className="space-y-3">
          {statusNotifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Нет уведомлений о статусах</p>
            </div>
          ) : (
            statusNotifications.map((notification) => (
              <StatusNotificationCard
                key={notification.id}
                notification={notification}
                onRead={handleStatusRead}
                onDismiss={handleStatusDismiss}
                onCtaClick={handleStatusCtaClick}
              />
            ))
          )}
        </TabsContent>

        {/* General Notifications Only */}
        <TabsContent value="general" className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Нет общих уведомлений</p>
            </div>
          ) : (
            notifications.map((notification) => (
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
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Load More */}
      {cursor && activeTab !== 'status' && (
        <div className="mt-4">
          <Button onClick={() => load()} disabled={loading}>
            Загрузить ещё
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Example: Hook for managing status notifications
 *
 * Use this pattern to manage status notifications in your app.
 */
export const useStatusNotifications = () => {
  const [notifications, setNotifications] = useState<StatusNotification[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch status notifications from API
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      // const data = await api.getStatusNotifications()
      // setNotifications(data)

      // For now, use mock data
      setNotifications(mockStatusNotifications)
    } catch (error) {
      console.error('Failed to fetch status notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    // TODO: Call API to mark as read
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    // TODO: Call API to dismiss
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    dismiss,
    refetch: fetchNotifications,
  }
}
