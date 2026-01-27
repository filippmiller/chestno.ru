# StatusBadge Component - Installation & Setup Guide

## Overview

This document provides complete instructions for installing and configuring the StatusBadge component for displaying organization status levels.

## Prerequisites

- React 18+
- TypeScript
- Tailwind CSS
- shadcn/ui Badge component

## Installation Steps

### Step 1: Install Required Dependencies

Run the following command in the frontend directory:

```bash
npm install @radix-ui/react-tooltip
```

### Step 2: Verify File Structure

Ensure the following files exist:

#### New Files Created
```
frontend/src/
├── components/
│   ├── StatusBadge.tsx              ✅ Created
│   └── ui/
│       ├── badge.tsx                ✅ Existing
│       └── tooltip.tsx              ✅ Created
├── types/
│   └── auth.ts                      ✅ Updated
├── api/
│   └── authService.ts               ✅ Updated (API function exists)
└── pages/
    ├── OrganizationProfile.tsx      ✅ Updated
    └── PublicOrganization.tsx       ✅ Updated
```

### Step 3: Verify Type Definitions

Check that `frontend/src/types/auth.ts` contains:

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

export interface OrganizationStatusResponse {
  status: OrganizationStatus
}
```

### Step 4: Verify API Service Function

Check that `frontend/src/api/authService.ts` includes:

```typescript
export const getOrganizationStatus = async (organizationId: string) => {
  const { data } = await httpClient.get<OrganizationStatusResponse>(
    `/api/organizations/${organizationId}/status`
  )
  return data
}
```

## Backend Requirements

The component requires the following backend API endpoint:

### Endpoint: Get Organization Status
```
GET /api/organizations/:orgId/status
```

**Response:**
```json
{
  "status": {
    "organization_id": "uuid",
    "level": "A" | "B" | "C" | 0,
    "level_name": "Status A" | "Status B" | "Status C" | null,
    "level_description": "Description text",
    "granted_at": "2026-01-27T00:00:00Z",
    "expires_at": null
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Organization not found or no status
- `500 Internal Server Error` - Server error

## Component Usage

### Basic Import

```tsx
import { StatusBadge } from '@/components/StatusBadge'
```

### Example: Organization Profile Page

```tsx
const [statusLevel, setStatusLevel] = useState<StatusLevel | null>(null)

useEffect(() => {
  if (!organizationId) return

  getOrganizationStatus(organizationId)
    .then((data) => {
      if (data?.status && data.status.level !== 0) {
        setStatusLevel(data.status.level)
      } else {
        setStatusLevel(null)
      }
    })
    .catch(() => {
      // Handle error silently - status is optional
      setStatusLevel(null)
    })
}, [organizationId])

return (
  <div>
    <h1>
      {organization.name}
      {statusLevel && statusLevel !== 0 && (
        <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="md" />
      )}
    </h1>
  </div>
)
```

### Example: Public Organization Page

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
  <h1 className="text-4xl font-semibold">{data.name}</h1>
  {statusLevel && statusLevel !== 0 && (
    <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="lg" showTooltip />
  )}
</div>
```

## Testing the Component

### Manual Testing Checklist

1. **Visual Rendering**
   - [ ] Badge displays with correct color for Level A (green)
   - [ ] Badge displays with correct color for Level B (blue)
   - [ ] Badge displays with correct color for Level C (purple)
   - [ ] Badge does not display when level is 0 or null

2. **Tooltip Functionality**
   - [ ] Tooltip appears on hover
   - [ ] Tooltip shows correct level name
   - [ ] Tooltip shows correct description
   - [ ] Tooltip disappears when mouse leaves

3. **Sizing**
   - [ ] Small size works correctly
   - [ ] Medium size works correctly
   - [ ] Large size works correctly

4. **Responsive Design**
   - [ ] Badge displays inline on desktop
   - [ ] Badge stacks properly on mobile
   - [ ] No layout issues on different screen sizes

5. **Dark Mode**
   - [ ] Colors adapt correctly in dark mode
   - [ ] Text remains readable in dark mode

6. **API Integration**
   - [ ] Status fetches correctly on page load
   - [ ] Error handling works when API fails
   - [ ] Loading states work correctly

### Test Data

Create organizations with different status levels:

```sql
-- Set Level A
UPDATE organization_status
SET level = 'A', level_name = 'Status A',
    level_description = 'Highest transparency level'
WHERE organization_id = '<test-org-id>';

-- Set Level B
UPDATE organization_status
SET level = 'B', level_name = 'Status B',
    level_description = 'Advanced transparency'
WHERE organization_id = '<test-org-id>';

-- Set Level C
UPDATE organization_status
SET level = 'C', level_name = 'Status C',
    level_description = 'Basic transparency'
WHERE organization_id = '<test-org-id>';

-- Set No Status
UPDATE organization_status
SET level = 0
WHERE organization_id = '<test-org-id>';
```

## Troubleshooting

### Issue: Tooltip not appearing

**Solution:** Ensure `@radix-ui/react-tooltip` is installed:
```bash
npm install @radix-ui/react-tooltip
npm run dev
```

### Issue: TypeScript errors

**Solution:** Rebuild the project:
```bash
npm run build
```

### Issue: Badge not displaying

**Check:**
1. Status level is not 0
2. Status level is 'A', 'B', or 'C'
3. API endpoint is accessible
4. No network errors in console

### Issue: Styling not correct

**Check:**
1. Tailwind CSS is configured correctly
2. Dark mode classes are working
3. `cn()` utility function exists in `@/lib/utils`

## Configuration

### Customizing Colors

Edit `StatusBadge.tsx`:

```typescript
const levelConfig = {
  A: {
    color: '#10B981', // Change green color
    bgColor: 'bg-green-100 dark:bg-green-950',
    textColor: 'text-green-800 dark:text-green-100',
    // ...
  },
  // ...
}
```

### Customizing Descriptions

Edit the `level_description` field in your backend or update the `levelConfig` object.

### Adding New Status Levels

1. Update `StatusLevel` type in `types/auth.ts`
2. Add new level config in `StatusBadge.tsx`
3. Update backend to support new level

## Performance Considerations

- Status data is fetched only once on page load
- API errors are caught and handled gracefully
- Component uses React.memo internally for optimization
- Tooltip uses Radix UI for accessibility and performance

## Accessibility

The component follows WCAG 2.1 AA standards:

- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- Sufficient color contrast ratios

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Related Documentation

- [StatusBadge Component README](./src/components/StatusBadge.README.md)
- [Status Levels API Documentation](../DELIVERABLE_STATUS_LEVELS_API.md)
- [Implementation Checklist](C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md)

## Support

For issues or questions:
1. Check this documentation
2. Review the component README
3. Check the API documentation
4. Review existing test cases
