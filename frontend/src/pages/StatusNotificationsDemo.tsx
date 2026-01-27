/**
 * Status Notifications Demo Page
 *
 * This page demonstrates all status notification types and variants.
 * Use this for development, testing, and design review.
 *
 * To view: Add route in your router configuration:
 * { path: '/demo/status-notifications', element: <StatusNotificationsDemo /> }
 */

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  StatusNotificationCard,
  StatusNotificationCompact,
  StatusNotificationList,
  mockStatusNotifications,
  mockStatusGrantedA,
  mockStatusGrantedB,
  mockStatusGrantedC,
  mockStatusExpiring7Days,
  mockStatusExpiring2Days,
  mockStatusRevoked,
  mockUpgradeApproved,
  mockUpgradeRejected,
  generateRandomMockNotification,
  type StatusNotification,
} from '@/components/notifications'

export const StatusNotificationsDemo = () => {
  const [notifications, setNotifications] = useState<StatusNotification[]>(mockStatusNotifications)
  const [activeTab, setActiveTab] = useState('all')

  const handleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    console.log('Read notification:', id)
  }

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    console.log('Dismissed notification:', id)
  }

  const handleCtaClick = (id: string, url: string) => {
    console.log('CTA clicked:', { id, url })
    alert(`Navigating to: ${url}`)
  }

  const addRandomNotification = () => {
    const newNotification = generateRandomMockNotification()
    setNotifications((prev) => [newNotification, ...prev])
  }

  const resetNotifications = () => {
    setNotifications(mockStatusNotifications)
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-4xl font-bold">Status Notifications Demo</h1>
        <p className="text-muted-foreground text-lg">
          Showcase of all notification types and variants
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
          <CardDescription>Interact with notifications for testing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addRandomNotification}>Add Random Notification</Button>
            <Button variant="outline" onClick={resetNotifications}>Reset to Default</Button>
            <Button variant="outline" onClick={markAllAsRead}>Mark All as Read</Button>
            <Button
              variant="outline"
              onClick={() => console.log('Current notifications:', notifications)}
            >
              Log State
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-6">
          <TabsTrigger value="all">All Types</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="compact">Compact</TabsTrigger>
          <TabsTrigger value="individual">Individual</TabsTrigger>
        </TabsList>

        {/* Tab: All Types Together */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Notification Types</CardTitle>
              <CardDescription>
                Display all notification variants in sequence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.map((notification) => (
                <StatusNotificationCard
                  key={notification.id}
                  notification={notification}
                  onRead={handleRead}
                  onDismiss={handleDismiss}
                  onCtaClick={handleCtaClick}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: List View */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>List View Component</CardTitle>
              <CardDescription>
                StatusNotificationList with filtering and controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationList
                notifications={notifications}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
                loading={false}
                hasMore={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Compact View */}
        <TabsContent value="compact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compact Notifications</CardTitle>
              <CardDescription>
                Suitable for dropdowns and sidebars
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-w-md">
              {notifications.slice(0, 5).map((notification) => (
                <StatusNotificationCompact
                  key={notification.id}
                  notification={notification}
                  onRead={handleRead}
                  onCtaClick={handleCtaClick}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Individual Types */}
        <TabsContent value="individual" className="space-y-6">
          {/* Status Granted A */}
          <Card>
            <CardHeader>
              <CardTitle>Status Granted - Level A</CardTitle>
              <CardDescription>Celebration notification</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockStatusGrantedA}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>

          {/* Status Granted B */}
          <Card>
            <CardHeader>
              <CardTitle>Status Granted - Level B</CardTitle>
              <CardDescription>Celebration notification (read state)</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockStatusGrantedB}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>

          {/* Status Granted C */}
          <Card>
            <CardHeader>
              <CardTitle>Status Granted - Level C</CardTitle>
              <CardDescription>First level welcome notification</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockStatusGrantedC}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>

          {/* Status Expiring 7 Days */}
          <Card>
            <CardHeader>
              <CardTitle>Status Expiring - 7 Days</CardTitle>
              <CardDescription>Warning notification</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockStatusExpiring7Days}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>

          {/* Status Expiring 2 Days */}
          <Card>
            <CardHeader>
              <CardTitle>Status Expiring - 2 Days (Urgent)</CardTitle>
              <CardDescription>Urgent warning notification</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockStatusExpiring2Days}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>

          {/* Status Revoked */}
          <Card>
            <CardHeader>
              <CardTitle>Status Revoked</CardTitle>
              <CardDescription>Error notification</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockStatusRevoked}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>

          {/* Upgrade Request Approved */}
          <Card>
            <CardHeader>
              <CardTitle>Upgrade Request Approved</CardTitle>
              <CardDescription>Info notification (positive)</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockUpgradeApproved}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>

          {/* Upgrade Request Rejected */}
          <Card>
            <CardHeader>
              <CardTitle>Upgrade Request Rejected</CardTitle>
              <CardDescription>Error notification (negative)</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusNotificationCard
                notification={mockUpgradeRejected}
                onRead={handleRead}
                onDismiss={handleDismiss}
                onCtaClick={handleCtaClick}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stats */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Current State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{notifications.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unread</p>
              <p className="text-2xl font-bold text-blue-600">
                {notifications.filter((n) => !n.read).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Read</p>
              <p className="text-2xl font-bold text-gray-600">
                {notifications.filter((n) => n.read).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Tab</p>
              <p className="text-2xl font-bold">{activeTab}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
