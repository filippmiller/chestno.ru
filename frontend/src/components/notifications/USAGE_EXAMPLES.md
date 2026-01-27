# Status Notifications - Usage Examples

Quick reference guide for using status notification components.

## Basic Usage

### 1. Import Components

```tsx
import {
  StatusNotificationCard,
  StatusNotificationList,
  type StatusNotification,
} from '@/components/notifications'
```

### 2. Display Single Notification

```tsx
const MyComponent = () => {
  const notification: StatusNotification = {
    id: '123',
    type: 'status_granted',
    severity: 'celebration',
    title: 'Поздравляем! Вы получили статус A',
    body: 'Ваша организация теперь имеет высший уровень доверия.',
    metadata: {
      level: 'A',
      benefits: ['Приоритет в каталоге', 'Расширенная аналитика'],
      effective_date: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
    read: false,
    cta_label: 'Посмотреть профиль',
    cta_url: '/organization/profile',
  }

  return (
    <StatusNotificationCard
      notification={notification}
      onRead={(id) => console.log('Read:', id)}
      onDismiss={(id) => console.log('Dismissed:', id)}
      onCtaClick={(id, url) => console.log('Navigate to:', url)}
    />
  )
}
```

### 3. Display Notification List

```tsx
import { useStatusNotifications } from './integration-example'

const NotificationsPage = () => {
  const { notifications, markAsRead, dismiss } = useStatusNotifications()

  return (
    <StatusNotificationList
      notifications={notifications}
      onRead={markAsRead}
      onDismiss={dismiss}
      onCtaClick={(id, url) => navigate(url)}
    />
  )
}
```

## Real-World Examples

### Example 1: Notification Dropdown in Navbar

```tsx
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusNotificationCompact } from '@/components/notifications'
import { useStatusNotifications } from './integration-example'

export const NotificationDropdown = () => {
  const { notifications, unreadCount, markAsRead } = useStatusNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-96 overflow-y-auto">
        <div className="p-2 space-y-2">
          {notifications.slice(0, 5).map((notification) => (
            <StatusNotificationCompact
              key={notification.id}
              notification={notification}
              onRead={markAsRead}
              onCtaClick={(id, url) => {
                markAsRead(id)
                window.location.href = url
              }}
            />
          ))}
          {notifications.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Нет уведомлений
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Example 2: Status Dashboard Widget

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusNotificationCard } from '@/components/notifications'
import { useStatusNotifications } from './integration-example'

export const StatusDashboardWidget = () => {
  const { notifications, markAsRead, dismiss } = useStatusNotifications()

  // Show only unread status notifications
  const unreadStatusNotifications = notifications.filter((n) => !n.read)

  if (unreadStatusNotifications.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Важные уведомления о статусе</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {unreadStatusNotifications.map((notification) => (
          <StatusNotificationCard
            key={notification.id}
            notification={notification}
            onRead={markAsRead}
            onDismiss={dismiss}
            onCtaClick={(id, url) => {
              markAsRead(id)
              window.location.href = url
            }}
          />
        ))}
      </CardContent>
    </Card>
  )
}
```

### Example 3: Filter by Notification Type

```tsx
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusNotificationCard, type StatusNotificationType } from '@/components/notifications'
import { useStatusNotifications } from './integration-example'

export const FilteredNotifications = () => {
  const { notifications, markAsRead, dismiss } = useStatusNotifications()
  const [filter, setFilter] = useState<StatusNotificationType | 'all'>('all')

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === filter)

  return (
    <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
      <TabsList>
        <TabsTrigger value="all">Все</TabsTrigger>
        <TabsTrigger value="status_granted">Получено</TabsTrigger>
        <TabsTrigger value="status_expiring">Истекает</TabsTrigger>
        <TabsTrigger value="status_revoked">Отозвано</TabsTrigger>
        <TabsTrigger value="upgrade_request_reviewed">Проверено</TabsTrigger>
      </TabsList>

      <TabsContent value={filter} className="space-y-3">
        {filtered.map((notification) => (
          <StatusNotificationCard
            key={notification.id}
            notification={notification}
            onRead={markAsRead}
            onDismiss={dismiss}
            onCtaClick={(id, url) => window.location.href = url}
          />
        ))}
      </TabsContent>
    </Tabs>
  )
}
```

### Example 4: Building Custom Notifications

```tsx
import { buildStatusNotification } from '@/components/notifications'

// Create a status granted notification
const grantedNotification = buildStatusNotification('status_granted', {
  title: 'Поздравляем! Вы получили статус B',
  body: 'Ваша организация получила статус подтверждённого производителя.',
  metadata: {
    level: 'B',
    benefits: ['Значок верификации', 'Базовая аналитика'],
    effective_date: new Date().toISOString(),
  },
  cta_url: '/organization/profile',
})

// Create an expiring notification
const expiringNotification = buildStatusNotification('status_expiring', {
  title: 'Ваш статус A истекает через 5 дней',
  body: 'Продлите подписку, чтобы сохранить преимущества.',
  metadata: {
    level: 'A',
    days_left: 5,
    expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    renewal_url: '/subscription/renew',
  },
})
```

## API Integration Pattern

### Backend API Structure (Example)

```typescript
// Expected backend response
interface ApiStatusNotification {
  id: string
  type: 'status_granted' | 'status_expiring' | 'status_revoked' | 'upgrade_request_reviewed'
  title: string
  body: string
  metadata: Record<string, any>
  created_at: string
  read_at?: string | null
}

// API service
export const statusNotificationsApi = {
  // Fetch all status notifications
  async getAll(): Promise<StatusNotification[]> {
    const response = await fetch('/api/v2/notifications/status')
    const data: ApiStatusNotification[] = await response.json()

    return data.map((item) => ({
      id: item.id,
      type: item.type,
      severity: getSeverityFromType(item.type),
      title: item.title,
      body: item.body,
      metadata: item.metadata,
      created_at: item.created_at,
      read: !!item.read_at,
      ...getCtaFromType(item.type, item.metadata),
    }))
  },

  // Mark as read
  async markAsRead(id: string): Promise<void> {
    await fetch(`/api/v2/notifications/status/${id}/read`, {
      method: 'POST',
    })
  },

  // Dismiss notification
  async dismiss(id: string): Promise<void> {
    await fetch(`/api/v2/notifications/status/${id}/dismiss`, {
      method: 'DELETE',
    })
  },
}

// Helper functions
function getSeverityFromType(type: string): StatusNotificationSeverity {
  switch (type) {
    case 'status_granted': return 'celebration'
    case 'status_expiring': return 'warning'
    case 'status_revoked': return 'error'
    case 'upgrade_request_reviewed': return 'info'
    default: return 'info'
  }
}

function getCtaFromType(type: string, metadata: any) {
  switch (type) {
    case 'status_granted':
      return { cta_label: 'Посмотреть профиль', cta_url: '/organization/profile' }
    case 'status_expiring':
      return { cta_label: 'Продлить сейчас', cta_url: metadata.renewal_url || '/subscription' }
    case 'status_revoked':
      return { cta_label: 'Узнать подробности', cta_url: metadata.appeal_url || '/support' }
    case 'upgrade_request_reviewed':
      return { cta_label: 'Посмотреть статус', cta_url: '/status-dashboard' }
    default:
      return {}
  }
}
```

### React Query Integration

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { statusNotificationsApi } from '@/api/status-notifications'

export const useStatusNotifications = () => {
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['status-notifications'],
    queryFn: statusNotificationsApi.getAll,
    refetchInterval: 60000, // Refetch every minute
  })

  const markAsReadMutation = useMutation({
    mutationFn: statusNotificationsApi.markAsRead,
    onSuccess: (_, id) => {
      queryClient.setQueryData(['status-notifications'], (old: StatusNotification[]) =>
        old.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    },
  })

  const dismissMutation = useMutation({
    mutationFn: statusNotificationsApi.dismiss,
    onSuccess: (_, id) => {
      queryClient.setQueryData(['status-notifications'], (old: StatusNotification[]) =>
        old.filter((n) => n.id !== id)
      )
    },
  })

  return {
    notifications,
    isLoading,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead: markAsReadMutation.mutate,
    dismiss: dismissMutation.mutate,
  }
}
```

## Testing Examples

### Unit Test

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusNotificationCard, mockStatusGrantedA } from '@/components/notifications'

describe('StatusNotificationCard', () => {
  it('renders notification correctly', () => {
    render(<StatusNotificationCard notification={mockStatusGrantedA} />)

    expect(screen.getByText(/Поздравляем!/)).toBeInTheDocument()
    expect(screen.getByText(/статус A/)).toBeInTheDocument()
  })

  it('calls onRead when mark as read button is clicked', () => {
    const onRead = jest.fn()

    render(
      <StatusNotificationCard
        notification={mockStatusGrantedA}
        onRead={onRead}
      />
    )

    fireEvent.click(screen.getByText('Отметить прочитанным'))
    expect(onRead).toHaveBeenCalledWith(mockStatusGrantedA.id)
  })

  it('calls onCtaClick when CTA button is clicked', () => {
    const onCtaClick = jest.fn()

    render(
      <StatusNotificationCard
        notification={mockStatusGrantedA}
        onCtaClick={onCtaClick}
      />
    )

    fireEvent.click(screen.getByText('Посмотреть профиль'))
    expect(onCtaClick).toHaveBeenCalledWith(
      mockStatusGrantedA.id,
      mockStatusGrantedA.cta_url
    )
  })
})
```

## Performance Tips

1. **Memoize callbacks**: Use `useCallback` for event handlers
2. **Virtual scrolling**: For long lists, consider react-window
3. **Lazy loading**: Load notifications on demand
4. **Optimistic updates**: Update UI immediately, sync with backend later
5. **Cache invalidation**: Refresh notifications after status changes

## Accessibility Checklist

- ✅ Semantic HTML structure
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation support
- ✅ Focus indicators visible
- ✅ Screen reader friendly
- ✅ Color contrast meets WCAG AA standards
- ✅ Animations respect `prefers-reduced-motion`

## Next Steps

1. Add WebSocket support for real-time notifications
2. Implement browser push notifications
3. Create email notification templates
4. Add notification preferences/settings
5. Track notification engagement analytics
