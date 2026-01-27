# Status Notifications - Visual Reference Guide

Visual documentation of all notification types and their appearances.

---

## Notification Type 1: Status Granted (Celebration)

### When to Use
- User receives a new status level (A, B, or C)
- Positive milestone achievement
- Welcome message for new status

### Visual Appearance

```
┌─────────────────────────────────────────────────────────────┐
│ ┃ [🎉] [Новый статус] [Новое]                      [×]      │
│ ┃                                                             │
│ ┃ Поздравляем! Вы получили статус A                         │
│ ┃ только что                                                  │
│ ┃                                                             │
│ ┃ Ваша организация теперь имеет высший уровень доверия.     │
│ ┃ Вы получаете приоритетное размещение в каталоге,          │
│ ┃ расширенную аналитику и специальный значок верификации.   │
│ ┃                                                             │
│ ┃ [Посмотреть профиль] [Отметить прочитанным]               │
└─────────────────────────────────────────────────────────────┘
```

**Color Scheme:**
- Border: Green (left, 4px thick)
- Background: Light green tint
- Icon: Party popper 🎉 (green)
- Badges: Green background
- CTA Button: Green

**Icon**: PartyPopper from lucide-react

**Example Metadata:**
```typescript
{
  level: 'A',
  benefits: [
    'Приоритетное размещение в каталоге',
    'Расширенная аналитика',
    'Специальный значок верификации'
  ],
  effective_date: '2026-01-27T10:00:00Z'
}
```

---

## Notification Type 2: Status Expiring (Warning)

### When to Use
- Status is about to expire (7 days, 3 days, 1 day)
- Action required to maintain status
- Subscription renewal needed

### Visual Appearance

```
┌─────────────────────────────────────────────────────────────┐
│ ║ [⏰] [Истекает срок] [Новое]                      [×]      │
│ ║                                                             │
│ ║ Ваш статус A истекает через 7 дней                        │
│ ║ 2 ч. назад                                                  │
│ ║                                                             │
│ ║ Чтобы сохранить все преимущества статуса A,               │
│ ║ необходимо продлить подписку до истечения срока            │
│ ║ действия. После истечения статус будет понижен до B.      │
│ ║                                                             │
│ ║ [Продлить сейчас] [Отметить прочитанным]                  │
└─────────────────────────────────────────────────────────────┘
```

**Color Scheme:**
- Border: Yellow/Orange (left, 4px thick)
- Background: Light yellow tint
- Icon: Clock ⏰ (yellow/orange)
- Badges: Yellow background
- CTA Button: Yellow/Orange

**Icon**: Clock from lucide-react

**Example Metadata:**
```typescript
{
  level: 'A',
  days_left: 7,
  expiry_date: '2026-02-03T00:00:00Z',
  renewal_url: '/subscription/renew',
  action_required: 'Продлите подписку Premium'
}
```

**Urgency Levels:**
- 7+ days: Standard yellow
- 3-6 days: Darker yellow/orange
- 1-2 days: Orange/red tint, more urgent styling

---

## Notification Type 3: Status Revoked (Error)

### When to Use
- Admin revokes user's status
- Compliance violation
- Terms of service breach
- Critical issue requiring immediate attention

### Visual Appearance

```
┌─────────────────────────────────────────────────────────────┐
│ ┃ [❌] [Статус отозван] [Новое]                     [×]      │
│ ┃                                                             │
│ ┃ Статус B отозван                                           │
│ ┃ 1 дн. назад                                                 │
│ ┃                                                             │
│ ┃ К сожалению, ваш статус B был отозван из-за               │
│ ┃ несоответствия требованиям платформы. Вы можете           │
│ ┃ подать апелляцию или обратиться в службу поддержки.       │
│ ┃                                                             │
│ ┃ Причина: Несоответствие требованиям верификации:          │
│ ┃ отсутствие актуальных документов о сертификации.          │
│ ┃                                                             │
│ ┃ [Узнать подробности] [Отметить прочитанным]               │
└─────────────────────────────────────────────────────────────┘
```

**Color Scheme:**
- Border: Red (left, 4px thick)
- Background: Light red tint
- Icon: X Circle ❌ (red)
- Badges: Red background
- CTA Button: Red

**Icon**: XCircle from lucide-react

**Example Metadata:**
```typescript
{
  level: 'B',
  reason: 'Несоответствие требованиям верификации: отсутствие актуальных документов',
  revoked_at: '2026-01-26T15:00:00Z',
  appeal_url: '/support/appeal'
}
```

---

## Notification Type 4: Upgrade Request Reviewed (Info)

### When to Use
- Admin reviews upgrade request
- Request approved or rejected
- Feedback provided on application

### Visual Appearance (Approved)

```
┌─────────────────────────────────────────────────────────────┐
│ ┃ [✓] [Результат проверки] [Новое]                  [×]      │
│ ┃                                                             │
│ ┃ Ваш запрос на повышение до статуса A одобрен              │
│ ┃ только что                                                  │
│ ┃                                                             │
│ ┃ Отличные новости! Ваша заявка на повышение статуса        │
│ ┃ была одобрена модератором. Статус A будет присвоен        │
│ ┃ в течение 24 часов.                                        │
│ ┃                                                             │
│ ┃ Комментарий модератора: Все требования выполнены.         │
│ ┃ Документы проверены и подтверждены.                       │
│ ┃                                                             │
│ ┃ [Посмотреть статус] [Отметить прочитанным]                │
└─────────────────────────────────────────────────────────────┘
```

**Color Scheme (Approved):**
- Border: Blue (left, 4px thick)
- Background: Light blue tint
- Icon: Check Circle ✓ (blue)
- Badges: Blue background
- CTA Button: Blue

**Icon**: CheckCircle from lucide-react

### Visual Appearance (Rejected)

```
┌─────────────────────────────────────────────────────────────┐
│ ┃ [❌] [Результат проверки] [Новое]                  [×]      │
│ ┃                                                             │
│ ┃ Ваш запрос на повышение до статуса A отклонён             │
│ ┃ 1 дн. назад                                                 │
│ ┃                                                             │
│ ┃ К сожалению, ваша заявка на повышение статуса была        │
│ ┃ отклонена. Пожалуйста, ознакомьтесь с комментариями       │
│ ┃ модератора и устраните указанные недостатки.              │
│ ┃                                                             │
│ ┃ Комментарий модератора: Требуется дополнить               │
│ ┃ документацию: отсутствуют сертификаты ISO.                │
│ ┃                                                             │
│ ┃ [Посмотреть детали] [Отметить прочитанным]                │
└─────────────────────────────────────────────────────────────┘
```

**Color Scheme (Rejected):**
- Border: Red (left, 4px thick)
- Background: Light red tint
- Icon: X Circle ❌ (red)
- Badges: Red background
- CTA Button: Red

**Icon**: XCircle from lucide-react

**Example Metadata:**
```typescript
// Approved
{
  target_level: 'A',
  approved: true,
  review_notes: 'Все требования выполнены. Документы проверены.',
  reviewed_by: 'Модератор Алексей',
  reviewed_at: '2026-01-27T09:00:00Z',
  next_steps: 'Статус будет активирован в течение 24 часов'
}

// Rejected
{
  target_level: 'A',
  approved: false,
  review_notes: 'Требуется дополнить документацию: отсутствуют сертификаты ISO',
  reviewed_by: 'Модератор Мария',
  reviewed_at: '2026-01-26T10:00:00Z',
  next_steps: 'Дополните информацию и повторите заявку через 30 дней'
}
```

---

## Compact Variant

All notification types also have a compact variant for dropdowns and sidebars.

### Compact Appearance Example

```
┌───────────────────────────────────────┐
│ [🎉] Поздравляем! Вы получили         │
│      статус A                          │
│      Ваша организация теперь...        │
│      только что                        │
└───────────────────────────────────────┘
```

**Features:**
- Smaller footprint (suitable for 320px-400px width)
- Icon + title + body (line-clamped to 2 lines)
- Timestamp
- Click anywhere to mark as read
- No action buttons (click to navigate)

---

## State Variations

### Unread State
- Full opacity
- "Новое" badge visible (blue)
- "Отметить прочитанным" button visible
- Slight shadow on hover

### Read State
- 60% opacity
- No "Новое" badge
- No "Отметить прочитанным" button
- Dismiss button still available

### Hover State
- Slightly elevated shadow
- Smooth transition (300ms)
- Cursor: pointer on clickable areas

---

## Responsive Behavior

### Desktop (> 768px)
- Full card width
- All elements visible
- Icons at normal size (20px)
- Comfortable padding

### Tablet (480px - 768px)
- Slightly reduced padding
- Buttons may wrap to new line
- Icons at normal size

### Mobile (< 480px)
- Stacked layout
- Buttons stack vertically
- Reduced padding
- Slightly smaller icons (16px)
- Text line-height adjusted

---

## Animation Specifications

### Entry Animation
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```
- Duration: 300ms
- Easing: ease-out

### Exit Animation
```css
@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(20px);
  }
}
```
- Duration: 200ms
- Easing: ease-in

### Hover Animation
- Shadow increase
- Slight scale (1.01)
- Duration: 150ms
- Easing: ease-in-out

---

## Icon Reference

All icons from **lucide-react**:

| Type | Icon Component | Visual | Color |
|------|---------------|---------|-------|
| Status Granted | `PartyPopper` | 🎉 | Green (#22c55e) |
| Status Expiring | `Clock` | ⏰ | Yellow (#eab308) |
| Status Revoked | `XCircle` | ❌ | Red (#ef4444) |
| Upgrade Approved | `CheckCircle` | ✓ | Blue (#3b82f6) |
| Upgrade Rejected | `XCircle` | ❌ | Red (#ef4444) |
| Dismiss | `XCircle` | × | Gray (#6b7280) |

---

## Color Palette

### Green (Celebration)
- Border: `#22c55e` (green-500)
- Background: `#f0fdf4` (green-50)
- Icon: `#16a34a` (green-600)
- Badge: `#dcfce7` bg, `#166534` text (green-100/800)

### Yellow/Orange (Warning)
- Border: `#eab308` (yellow-500)
- Background: `#fefce8` (yellow-50)
- Icon: `#ca8a04` (yellow-600)
- Badge: `#fef9c3` bg, `#854d0e` text (yellow-100/800)

### Red (Error)
- Border: `#ef4444` (red-500)
- Background: `#fef2f2` (red-50)
- Icon: `#dc2626` (red-600)
- Badge: `#fee2e2` bg, `#991b1b` text (red-100/800)

### Blue (Info)
- Border: `#3b82f6` (blue-500)
- Background: `#eff6ff` (blue-50)
- Icon: `#2563eb` (blue-600)
- Badge: `#dbeafe` bg, `#1e40af` text (blue-100/800)

---

## Accessibility

### Color Contrast
All color combinations meet **WCAG AA** standards:
- Text on background: ≥ 4.5:1
- Icons on background: ≥ 3:1
- Badges: ≥ 4.5:1

### Screen Readers
- All icons have `aria-label`
- Dismiss buttons have "Скрыть" label
- Time stamps are formatted for readability
- Notification type is announced

### Keyboard Navigation
- Tab order: Dismiss → CTA → Mark as Read
- Enter/Space activates buttons
- Escape closes dropdown notifications
- Focus indicators visible

---

## Best Practices

### Do's ✅
- Use appropriate notification type for the event
- Provide clear, actionable CTAs
- Keep body text concise (2-3 sentences max)
- Include relevant metadata
- Show timestamps for context
- Allow dismissal of all notifications
- Group similar notifications

### Don'ts ❌
- Don't use multiple colors in one notification
- Don't overload with too much text
- Don't hide critical information
- Don't autoclose error notifications
- Don't use generic CTAs like "OK" or "Close"
- Don't spam users with duplicates

---

## Testing Checklist

Visual testing checklist:

- [ ] All 4 notification types render correctly
- [ ] Colors match specifications
- [ ] Icons are correct and visible
- [ ] Badges display properly
- [ ] Timestamps format correctly
- [ ] Buttons are properly aligned
- [ ] Hover states work smoothly
- [ ] Animations are smooth
- [ ] Read/unread states are clear
- [ ] Responsive design works on all screen sizes
- [ ] Dark mode (if applicable) works
- [ ] High contrast mode works

---

## Design Tokens

For design system integration:

```typescript
const notificationTokens = {
  spacing: {
    padding: '16px',
    gap: '12px',
    iconSize: '20px',
    badgeGap: '8px',
  },
  borderRadius: {
    card: '8px',
    badge: '12px',
    button: '6px',
  },
  typography: {
    title: {
      fontSize: '18px',
      fontWeight: '600',
      lineHeight: '1.4',
    },
    body: {
      fontSize: '14px',
      fontWeight: '400',
      lineHeight: '1.5',
    },
    timestamp: {
      fontSize: '12px',
      fontWeight: '400',
    },
  },
  shadows: {
    default: '0 1px 3px rgba(0, 0, 0, 0.1)',
    hover: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  transitions: {
    duration: '300ms',
    easing: 'ease-out',
  },
}
```

---

This visual reference guide provides all the information needed to understand how notifications look and behave in the UI.
