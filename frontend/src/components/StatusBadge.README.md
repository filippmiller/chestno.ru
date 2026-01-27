# StatusBadge Component

A React component for displaying organization status levels (A, B, C) with visual styling and tooltip information.

## Features

- Color-coded badges for status levels A, B, and C
- Responsive sizing (sm, md, lg)
- Interactive tooltips with status descriptions
- Smooth hover animations
- Accessibility support with ARIA labels
- Dark mode support

## Installation

### Required Dependencies

This component requires the following dependencies to be installed:

```bash
npm install @radix-ui/react-tooltip
```

Ensure you have the shadcn/ui Badge component installed at `frontend/src/components/ui/badge.tsx`.

## Usage

### Basic Usage

```tsx
import { StatusBadge } from '@/components/StatusBadge'

function MyComponent() {
  return <StatusBadge level="B" />
}
```

### With Custom Sizing

```tsx
<StatusBadge level="A" size="lg" />
<StatusBadge level="B" size="md" />
<StatusBadge level="C" size="sm" />
```

### Without Tooltip

```tsx
<StatusBadge level="A" showTooltip={false} />
```

### With Custom Styling

```tsx
<StatusBadge level="B" className="ml-2 shadow-lg" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | `'A' \| 'B' \| 'C'` | Required | The status level to display |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | The size of the badge |
| `showTooltip` | `boolean` | `true` | Whether to show tooltip on hover |
| `className` | `string` | `undefined` | Additional CSS classes |

## Status Level Configuration

### Level A (Green)
- **Color**: `#10B981` (Emerald)
- **Name**: Статус A
- **Description**: Высшая степень честности — полная открытость производства

### Level B (Blue)
- **Color**: `#3B82F6` (Blue)
- **Name**: Статус B
- **Description**: Продвинутая честность — расширенная информация о производстве

### Level C (Purple)
- **Color**: `#8B5CF6` (Purple)
- **Name**: Статус C
- **Description**: Базовая честность — проверенная организация

## Integration Examples

### Organization Profile Page

```tsx
import { StatusBadge } from '@/components/StatusBadge'
import { getOrganizationStatus } from '@/api/authService'

function OrganizationProfile({ organizationId }) {
  const [statusLevel, setStatusLevel] = useState(null)

  useEffect(() => {
    getOrganizationStatus(organizationId)
      .then((data) => {
        if (data?.status && data.status.level !== 0) {
          setStatusLevel(data.status.level)
        }
      })
      .catch(console.error)
  }, [organizationId])

  return (
    <div>
      <h1>
        Organization Name
        {statusLevel && statusLevel !== 0 && (
          <StatusBadge level={statusLevel} size="md" />
        )}
      </h1>
    </div>
  )
}
```

### Public Organization Page

```tsx
<div className="flex items-center gap-3">
  <h1 className="text-4xl font-semibold">{data.name}</h1>
  {statusLevel && statusLevel !== 0 && (
    <StatusBadge level={statusLevel} size="lg" />
  )}
</div>
```

## API Integration

### Fetching Organization Status

The component is designed to work with the backend API endpoint:

```
GET /api/organizations/:orgId/status
```

Response format:
```json
{
  "status": {
    "organization_id": "uuid",
    "level": "A" | "B" | "C" | 0,
    "level_name": "string",
    "level_description": "string",
    "granted_at": "ISO8601 timestamp",
    "expires_at": "ISO8601 timestamp | null"
  }
}
```

### API Service Function

Use the provided API client function:

```tsx
import { getOrganizationStatus } from '@/api/authService'

const statusData = await getOrganizationStatus(organizationId)
```

## Styling

The component uses Tailwind CSS classes and is fully responsive:

- **Mobile**: Badges stack below the organization name
- **Desktop**: Badges appear inline next to the organization name

### Hover Effects

- Scale animation: `1.05` on hover
- Smooth transition with `transition-transform`

### Dark Mode

The component automatically adapts to dark mode using Tailwind's dark mode classes:
- Light mode: Lighter backgrounds with darker text
- Dark mode: Darker backgrounds with lighter text

## Accessibility

- ARIA labels provide context for screen readers
- Keyboard navigation support through Radix UI Tooltip
- Focus states are properly styled

## Type Definitions

The component uses TypeScript types defined in `@/types/auth`:

```typescript
export type StatusLevel = 'A' | 'B' | 'C' | 0

export interface OrganizationStatus {
  organization_id: string
  level: StatusLevel
  level_name?: string | null
  level_description?: string | null
  granted_at?: string | null
  expires_at?: string | null
}
```

## Files Created/Modified

### New Files
- `frontend/src/components/StatusBadge.tsx` - Main component
- `frontend/src/components/ui/tooltip.tsx` - Tooltip UI component

### Modified Files
- `frontend/src/types/auth.ts` - Added StatusLevel and OrganizationStatus types
- `frontend/src/api/authService.ts` - Added getOrganizationStatus function
- `frontend/src/pages/OrganizationProfile.tsx` - Integrated StatusBadge
- `frontend/src/pages/PublicOrganization.tsx` - Integrated StatusBadge

## Testing Checklist

- [ ] Badge renders with correct colors for each level (A, B, C)
- [ ] Tooltip appears on hover with correct information
- [ ] Badge sizes work correctly (sm, md, lg)
- [ ] Badge does not render when level is 0 or null
- [ ] Responsive layout works on mobile and desktop
- [ ] Dark mode colors are correct
- [ ] ARIA labels are present
- [ ] Hover animation is smooth
- [ ] API integration works correctly

## Future Enhancements

- Add animation when status changes
- Support for expired status display
- Click-through to status details page
- Status history timeline view
