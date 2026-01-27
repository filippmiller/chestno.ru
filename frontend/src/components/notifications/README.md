# Status Notifications Components

Comprehensive notification system for status level events in Chestno.ru platform.

## Overview

This module provides React components for displaying status-related notifications:
- **Status Granted**: Celebrate when a new status level is achieved
- **Status Expiring**: Warn users about upcoming status expiration
- **Status Revoked**: Alert users when a status is revoked
- **Upgrade Request Reviewed**: Inform about admin review results

## Components

### StatusNotificationCard

Main notification card component with full styling and interactivity.

```tsx
import { StatusNotificationCard } from '@/components/notifications'

<StatusNotificationCard
  notification={notification}
  onRead={(id) => markAsRead(id)}
  onDismiss={(id) => dismissNotification(id)}
  onCtaClick={(id, url) => navigate(url)}
/>
```

**Props:**
- `notification`: StatusNotification object
- `onRead?`: Callback when user marks notification as read
- `onDismiss?`: Callback when user dismisses notification
- `onCtaClick?`: Callback when user clicks CTA button

### StatusNotificationCompact

Compact variant for dropdown menus or sidebars.

```tsx
import { StatusNotificationCompact } from '@/components/notifications'

<StatusNotificationCompact
  notification={notification}
  onRead={(id) => markAsRead(id)}
  onCtaClick={(id, url) => navigate(url)}
/>
```

### StatusNotificationList

Container component with filtering, sorting, and pagination.

```tsx
import { StatusNotificationList } from '@/components/notifications'

<StatusNotificationList
  notifications={notifications}
  onRead={handleRead}
  onDismiss={handleDismiss}
  onCtaClick={handleCtaClick}
  loading={isLoading}
  hasMore={hasMorePages}
  onLoadMore={loadNextPage}
/>
```

## Notification Types

### 1. Status Granted (Celebration)

Displayed when a user receives a new status level (A, B, or C).

**Visual:**
- Icon: Party popper (🎉)
- Color: Green
- Border: Green, left 4px

**Example:**
```tsx
const notification: StatusNotification = {
  id: 'n1',
  type: 'status_granted',
  severity: 'celebration',
  title: 'Поздравляем! Вы получили статус A',
  body: 'Ваша организация теперь имеет высший уровень доверия...',
  metadata: {
    level: 'A',
    benefits: ['Приоритетное размещение', 'Расширенная аналитика'],
    effective_date: '2026-01-27T10:00:00Z',
  },
  created_at: '2026-01-27T10:00:00Z',
  read: false,
  cta_label: 'Посмотреть профиль',
  cta_url: '/organization/profile',
}
```

### 2. Status Expiring (Warning)

Alert about upcoming status expiration requiring action.

**Visual:**
- Icon: Clock (⏰)
- Color: Yellow/Orange
- Border: Yellow, left 4px

**Example:**
```tsx
const notification: StatusNotification = {
  id: 'n2',
  type: 'status_expiring',
  severity: 'warning',
  title: 'Ваш статус A истекает через 7 дней',
  body: 'Чтобы сохранить все преимущества...',
  metadata: {
    level: 'A',
    days_left: 7,
    expiry_date: '2026-02-03T00:00:00Z',
    renewal_url: '/subscription/renew',
    action_required: 'Продлите подписку Premium',
  },
  created_at: '2026-01-27T10:00:00Z',
  read: false,
  cta_label: 'Продлить сейчас',
  cta_url: '/subscription/renew',
}
```

### 3. Status Revoked (Error)

Critical alert when a status is revoked by admin.

**Visual:**
- Icon: X Circle (❌)
- Color: Red
- Border: Red, left 4px

**Example:**
```tsx
const notification: StatusNotification = {
  id: 'n3',
  type: 'status_revoked',
  severity: 'error',
  title: 'Статус B отозван',
  body: 'К сожалению, ваш статус был отозван...',
  metadata: {
    level: 'B',
    reason: 'Несоответствие требованиям верификации',
    revoked_at: '2026-01-26T15:00:00Z',
    appeal_url: '/support/appeal',
  },
  created_at: '2026-01-26T15:00:00Z',
  read: false,
  cta_label: 'Узнать подробности',
  cta_url: '/support/appeal',
}
```

### 4. Upgrade Request Reviewed (Info)

Result of admin review for status upgrade request.

**Visual:**
- Icon: Check Circle (approved) or X Circle (rejected)
- Color: Blue (approved) or Red (rejected)
- Border: Blue/Red, left 4px

**Example (Approved):**
```tsx
const notification: StatusNotification = {
  id: 'n4',
  type: 'upgrade_request_reviewed',
  severity: 'info',
  title: 'Ваш запрос на повышение до статуса A одобрен',
  body: 'Отличные новости! Ваша заявка одобрена...',
  metadata: {
    target_level: 'A',
    approved: true,
    review_notes: 'Все требования выполнены',
    reviewed_by: 'Модератор Алексей',
    reviewed_at: '2026-01-27T09:00:00Z',
    next_steps: 'Статус будет активирован в течение 24 часов',
  },
  created_at: '2026-01-27T09:00:00Z',
  read: false,
  cta_label: 'Посмотреть статус',
  cta_url: '/status-dashboard',
}
```

## Integration with Existing System

### Adding to Notifications Page

```tsx
// In frontend/src/pages/Notifications.tsx
import { StatusNotificationList } from '@/components/notifications'
import { useStatusNotifications } from '@/hooks/useStatusNotifications'

export const NotificationsPage = () => {
  const { notifications, handleRead, handleDismiss, handleCtaClick } = useStatusNotifications()

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <StatusNotificationList
        notifications={notifications}
        onRead={handleRead}
        onDismiss={handleDismiss}
        onCtaClick={handleCtaClick}
      />
    </div>
  )
}
```

### Adding to Navbar Badge

```tsx
// In frontend/src/components/ui/navbar.tsx
import { useStatusNotifications } from '@/hooks/useStatusNotifications'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'

export const Navbar = () => {
  const { unreadCount } = useStatusNotifications()

  return (
    <nav>
      <button className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">
            {unreadCount}
          </Badge>
        )}
      </button>
    </nav>
  )
}
```

## Mock Data for Testing

Use the provided mock data during development:

```tsx
import {
  mockStatusNotifications,
  mockStatusGrantedA,
  generateRandomMockNotification,
} from '@/components/notifications'

// Use all mocks
<StatusNotificationList notifications={mockStatusNotifications} />

// Use specific mock
<StatusNotificationCard notification={mockStatusGrantedA} />

// Generate random mock
const randomNotification = generateRandomMockNotification()
```

## Type Definitions

All TypeScript types are available from `@/types/status-notifications`:

- `StatusNotification` - Main notification interface
- `StatusNotificationType` - Union of notification types
- `StatusNotificationSeverity` - Visual severity levels
- `StatusLevel` - 'A' | 'B' | 'C'
- `StatusGrantedMetadata` - Metadata for granted notifications
- `StatusExpiringMetadata` - Metadata for expiring notifications
- `StatusRevokedMetadata` - Metadata for revoked notifications
- `UpgradeRequestReviewedMetadata` - Metadata for review notifications

## Styling & Theming

Components use shadcn/ui and Tailwind CSS. Color schemes are defined in `NOTIFICATION_COLORS`:

- **Celebration**: Green theme
- **Warning**: Yellow/Orange theme
- **Error**: Red theme
- **Info**: Blue theme

All components support dark mode through Tailwind classes.

## Animation

Components include smooth transitions:
- Fade in/out on mount/unmount
- Hover effects on cards
- Smooth color transitions
- Badge animations

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus indicators

## Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusNotificationCard, mockStatusGrantedA } from '@/components/notifications'

test('renders notification and handles click', () => {
  const onRead = jest.fn()
  const onDismiss = jest.fn()

  render(
    <StatusNotificationCard
      notification={mockStatusGrantedA}
      onRead={onRead}
      onDismiss={onDismiss}
    />
  )

  expect(screen.getByText(/Поздравляем!/)).toBeInTheDocument()

  fireEvent.click(screen.getByText('Отметить прочитанным'))
  expect(onRead).toHaveBeenCalledWith(mockStatusGrantedA.id)
})
```

## API Integration

To integrate with backend notifications:

1. Extend `NotificationItem` type in `@/types/auth` with status notification fields
2. Create API endpoints for status-specific notifications
3. Implement webhook/polling for real-time updates
4. Map backend notifications to `StatusNotification` type

Example mapper:

```tsx
import type { NotificationItem } from '@/types/auth'
import type { StatusNotification } from '@/types/status-notifications'

export const mapToStatusNotification = (
  item: NotificationItem
): StatusNotification | null => {
  if (!item.payload?.type || !['status_granted', 'status_expiring', 'status_revoked', 'upgrade_request_reviewed'].includes(item.payload.type)) {
    return null
  }

  return {
    id: item.id,
    type: item.payload.type,
    severity: item.severity as StatusNotificationSeverity,
    title: item.title,
    body: item.body,
    metadata: item.payload.metadata,
    created_at: item.created_at,
    read: false, // Determine from delivery status
    cta_label: item.payload.cta_label,
    cta_url: item.payload.cta_url,
  }
}
```

## Next Steps

1. **Backend Integration**: Implement notification creation in backend
2. **Real-time Updates**: Add WebSocket or SSE support
3. **Push Notifications**: Integrate browser push notifications
4. **Email Templates**: Create email versions of notifications
5. **Mobile Support**: Ensure responsive design on mobile devices
6. **Analytics**: Track notification engagement metrics

## Support

For questions or issues, contact the frontend team or refer to:
- Main docs: `C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md`
- Existing notification system: `frontend/src/pages/Notifications.tsx`
