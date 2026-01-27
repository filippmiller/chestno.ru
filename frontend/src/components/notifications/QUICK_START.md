# Status Notifications - Quick Start Guide

Get up and running with status notifications in 5 minutes.

## Prerequisites

✅ React + TypeScript project
✅ shadcn/ui components installed
✅ lucide-react icons installed
✅ Tailwind CSS configured

## Installation

### Step 1: Verify Dependencies

The components use existing dependencies. Verify they're installed:

```bash
# Check package.json includes:
# - react
# - typescript
# - lucide-react
# - tailwindcss
# - clsx
# - tailwind-merge
```

All these are already in your project.

### Step 2: Files Already Created

All files are ready to use in:
- `C:\dev\chestno.ru\frontend\src\types\status-notifications.ts`
- `C:\dev\chestno.ru\frontend\src\components\notifications\*.tsx`

## Quick Usage

### Option A: View Demo (Recommended First Step)

1. **Add demo route to your router**:

```tsx
// In your router config (e.g., App.tsx or routes.tsx)
import { StatusNotificationsDemo } from '@/pages/StatusNotificationsDemo'

// Add this route:
{
  path: '/demo/status-notifications',
  element: <StatusNotificationsDemo />
}
```

2. **Navigate to demo**:
```
http://localhost:3000/demo/status-notifications
```

3. **Interact with all notification types**:
- Click buttons to test interactions
- Add random notifications
- Test filtering and read/unread states

### Option B: Add to Existing Notifications Page

1. **Open your notifications page**:
```tsx
// frontend/src/pages/Notifications.tsx
```

2. **Import components**:
```tsx
import {
  StatusNotificationCard,
  mockStatusNotifications,
} from '@/components/notifications'
```

3. **Add status notifications section**:
```tsx
{/* Add before existing notifications */}
<div className="space-y-3 mb-6">
  <h2 className="text-xl font-semibold">Уведомления о статусах</h2>
  {mockStatusNotifications.map((notification) => (
    <StatusNotificationCard
      key={notification.id}
      notification={notification}
      onRead={(id) => console.log('Read:', id)}
      onDismiss={(id) => console.log('Dismissed:', id)}
      onCtaClick={(id, url) => console.log('Navigate:', url)}
    />
  ))}
</div>
```

### Option C: Add to Navbar

1. **Open navbar component**:
```tsx
// frontend/src/components/ui/navbar.tsx
```

2. **Import**:
```tsx
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { mockStatusNotifications } from '@/components/notifications'
```

3. **Add notification bell with badge**:
```tsx
const unreadCount = mockStatusNotifications.filter(n => !n.read).length

<button className="relative">
  <Bell className="h-5 w-5" />
  {unreadCount > 0 && (
    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500">
      {unreadCount}
    </Badge>
  )}
</button>
```

## Testing

### 1. Run Development Server

```bash
cd C:\dev\chestno.ru\frontend
npm run dev
```

### 2. Open Browser

Navigate to:
- Demo page: `http://localhost:3000/demo/status-notifications`
- Notifications page: `http://localhost:3000/notifications`

### 3. Test All Notification Types

- ✅ Status Granted (green, party popper)
- ✅ Status Expiring (yellow, clock)
- ✅ Status Revoked (red, X circle)
- ✅ Upgrade Request Reviewed (blue, check/X)

### 4. Test Interactions

- Click "Отметить прочитанным" (Mark as read)
- Click "Скрыть" (Dismiss)
- Click CTA buttons (e.g., "Посмотреть профиль")
- Test filtering in list view
- Toggle show/hide read notifications

## Common Use Cases

### Use Case 1: Display Single Notification

```tsx
import { StatusNotificationCard, mockStatusGrantedA } from '@/components/notifications'

<StatusNotificationCard
  notification={mockStatusGrantedA}
  onRead={(id) => handleRead(id)}
  onDismiss={(id) => handleDismiss(id)}
  onCtaClick={(id, url) => navigate(url)}
/>
```

### Use Case 2: Display List with Filtering

```tsx
import { StatusNotificationList, mockStatusNotifications } from '@/components/notifications'

<StatusNotificationList
  notifications={mockStatusNotifications}
  onRead={handleRead}
  onDismiss={handleDismiss}
  onCtaClick={handleCtaClick}
/>
```

### Use Case 3: Compact Dropdown

```tsx
import { StatusNotificationCompact } from '@/components/notifications'

<DropdownMenuContent className="w-96">
  {mockStatusNotifications.slice(0, 3).map((notification) => (
    <StatusNotificationCompact
      key={notification.id}
      notification={notification}
      onRead={handleRead}
    />
  ))}
</DropdownMenuContent>
```

## Customization

### Change Colors

Edit color schemes in `StatusNotification.tsx`:

```tsx
const NOTIFICATION_COLORS = {
  celebration: {
    border: 'border-green-500',  // Change to your color
    bg: 'bg-green-50',
    icon: 'text-green-600',
    badge: 'bg-green-100 text-green-800',
  },
  // ... other colors
}
```

### Change Icons

Replace icons in `NOTIFICATION_ICONS`:

```tsx
import { Star } from 'lucide-react'

const NOTIFICATION_ICONS = {
  status_granted: Star,  // Changed from PartyPopper
  // ... other icons
}
```

### Change Text

Modify labels in `NOTIFICATION_LABELS`:

```tsx
const NOTIFICATION_LABELS = {
  status_granted: 'Новый статус',  // Change text
  // ... other labels
}
```

## Troubleshooting

### Issue: Components not found

**Solution**: Check import paths
```tsx
// Correct:
import { StatusNotificationCard } from '@/components/notifications'

// Incorrect:
import { StatusNotificationCard } from './components/notifications'
```

### Issue: Icons not rendering

**Solution**: Verify lucide-react is installed
```bash
npm list lucide-react
```

### Issue: Styling not applied

**Solution**: Check Tailwind config includes components folder
```js
// tailwind.config.js
content: [
  './src/**/*.{js,jsx,ts,tsx}',
]
```

### Issue: TypeScript errors

**Solution**: Verify tsconfig paths
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Next Steps

### 1. Review Documentation
- 📖 [README.md](./README.md) - Complete component reference
- 💡 [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) - Real-world examples
- 📋 [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details

### 2. Backend Integration
When ready to connect to backend:
- Create API endpoints for notifications
- Replace mock data with API calls
- Implement real-time updates (WebSocket/SSE)
- Add read/dismiss API calls

### 3. Production Deployment
Before deploying:
- Replace mock data with real API
- Test all notification types
- Verify responsive design
- Check accessibility
- Test cross-browser compatibility

## Support

### Need Help?

1. **Check demo page**: `/demo/status-notifications`
2. **Review examples**: `USAGE_EXAMPLES.md`
3. **Read docs**: `README.md`
4. **Inspect code**: All components are well-commented

### Report Issues

If you find bugs or have questions:
1. Check existing documentation
2. Review implementation spec
3. Verify dependencies
4. Test with mock data first

## Checklist

Before marking this task complete:

- [ ] Demo page opens and displays all notification types
- [ ] All 4 notification variants render correctly
- [ ] Icons and colors match specifications
- [ ] Read/dismiss buttons work
- [ ] CTA buttons trigger actions
- [ ] Filtering works in list view
- [ ] Timestamps display correctly
- [ ] Responsive design works
- [ ] No TypeScript errors
- [ ] No console errors

## Success Criteria

✅ All notification types implemented
✅ Components are fully typed
✅ Mock data covers all scenarios
✅ Documentation is complete
✅ Demo page is interactive
✅ Integration examples provided
✅ Ready for backend integration

---

**You're all set!** 🎉

Start with the demo page to see everything in action, then integrate into your app using the examples provided.
