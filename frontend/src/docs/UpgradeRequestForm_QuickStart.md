# UpgradeRequestForm - Quick Start Guide

## 5-Minute Integration Guide

### Step 1: Import the Component (30 seconds)

```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { useState } from 'react';
```

### Step 2: Add State Management (30 seconds)

```tsx
function MyDashboard() {
  const [upgradeFormOpen, setUpgradeFormOpen] = useState(false);
  const organizationId = "org-123"; // Your org ID
  const currentLevel = "A"; // Current status level

  // Rest of your component...
}
```

### Step 3: Add the Component (1 minute)

```tsx
return (
  <div>
    {/* Your existing dashboard code */}

    <Button onClick={() => setUpgradeFormOpen(true)}>
      Request Upgrade
    </Button>

    <UpgradeRequestForm
      organizationId={organizationId}
      currentLevel={currentLevel}
      open={upgradeFormOpen}
      onOpenChange={setUpgradeFormOpen}
      onSuccess={() => {
        // Refresh your data here
        console.log('Upgrade request submitted!');
      }}
    />
  </div>
);
```

### Step 4: Test It (3 minutes)

1. Click the button to open the form
2. Fill in the fields:
   - Select target level
   - Enter a message (10-500 characters)
   - Optionally add evidence URLs
   - Check the terms checkbox
3. Click submit and observe the success message

**Done!** The form is now integrated.

---

## Common Use Cases

### Use Case 1: Simple Button Integration

```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function SimpleIntegration() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Upgrade Status
      </Button>
      <UpgradeRequestForm
        organizationId="org-123"
        currentLevel="A"
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
```

### Use Case 2: Conditional Display (Only Show if Eligible)

```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { getOrganizationStatus } from '@/api/organizationsService';
import { useEffect, useState } from 'react';

export function ConditionalDisplay({ organizationId }) {
  const [status, setStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    getOrganizationStatus(organizationId).then(setStatus);
  }, [organizationId]);

  if (!status || !status.can_request_upgrade) {
    return null; // Don't show button if can't request
  }

  return (
    <>
      <Button onClick={() => setFormOpen(true)}>
        Request Upgrade
      </Button>
      <UpgradeRequestForm
        organizationId={organizationId}
        currentLevel={status.current_level}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          // Reload status
          getOrganizationStatus(organizationId).then(setStatus);
        }}
      />
    </>
  );
}
```

### Use Case 3: With Success Notification

```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { useState } from 'react';
import { toast } from 'sonner'; // Or your notification library

export function WithNotification({ organizationId, currentLevel }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Request Upgrade
      </Button>
      <UpgradeRequestForm
        organizationId={organizationId}
        currentLevel={currentLevel}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          toast.success('Upgrade request submitted successfully!');
          // Refresh your data
        }}
      />
    </>
  );
}
```

### Use Case 4: In a Card/Section

```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export function StatusCard({ organizationId, currentLevel }) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Organization Status
            <Badge>Level {currentLevel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Your current status level: {currentLevel}
          </p>
          <Button onClick={() => setFormOpen(true)} variant="outline">
            Request Upgrade
          </Button>
        </CardContent>
      </Card>

      <UpgradeRequestForm
        organizationId={organizationId}
        currentLevel={currentLevel}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}
```

---

## Props Reference

```typescript
interface UpgradeRequestFormProps {
  organizationId: string;      // REQUIRED: The organization ID
  currentLevel: StatusLevel;   // REQUIRED: 'A' | 'B' | 'C'
  open: boolean;               // REQUIRED: Dialog open state
  onOpenChange: (open: boolean) => void;  // REQUIRED: State setter
  onSuccess?: () => void;      // OPTIONAL: Success callback
}
```

---

## API Endpoint Requirements

Your backend must implement:

```
POST /api/organizations/:orgId/status-upgrade-request
```

**Request Body**:
```typescript
{
  target_level: 'B' | 'C',
  message: string,           // 10-500 characters
  evidence_urls?: string[],  // Optional
  accept_terms: boolean      // Must be true
}
```

**Success Response (200)**:
```typescript
{
  success: true,
  request: {
    id: string,
    organization_id: string,
    target_level: 'B' | 'C',
    message: string,
    evidence_urls?: string[],
    status: 'pending',
    submitted_at: string
  },
  message: string
}
```

**Error Responses**:
- `400`: Invalid data
- `403`: Not authorized (e.g., requesting C without B)
- `429`: Rate limit exceeded (1 request per 30 days)
- `500`: Server error

---

## Troubleshooting

### Problem: Form doesn't submit

**Check**:
1. All required fields filled?
2. Message 10-500 characters?
3. Terms checkbox checked?
4. Valid URLs if provided?
5. Check browser console for errors

### Problem: 429 Rate Limit Error

**Solution**: Organization already submitted a request within 30 days. User must wait.

### Problem: 403 Permission Error

**Solution**: Trying to request Level C without having Level B. User must first get Level B.

### Problem: Form doesn't close after success

**Check**: `onOpenChange` prop is connected to your state setter correctly.

### Problem: Success callback not firing

**Check**: `onSuccess` prop is provided and is a valid function.

---

## Next Steps

1. ✅ Copy integration code above
2. ✅ Replace `organizationId` and `currentLevel` with your data
3. ✅ Test the form with valid data
4. ✅ Test error cases (rate limit, validation errors)
5. ✅ Style the trigger button to match your design
6. ✅ Add success notifications if desired
7. ✅ Deploy to production

---

## Additional Resources

- **Full Documentation**: `frontend/src/docs/UpgradeRequestForm.md`
- **Test Plan**: `frontend/src/docs/UpgradeRequestForm_TestPlan.md`
- **Complete Examples**: `frontend/src/examples/UpgradeRequestFormIntegration.tsx`
- **API Service**: `frontend/src/api/organizationsService.ts`
- **Type Definitions**: `frontend/src/types/organizations.ts`

---

## Support

Questions? Check:
1. Component documentation (link above)
2. Test plan for expected behavior
3. Integration examples for working code
4. Console errors in browser DevTools
5. Network tab for API request/response

For bugs, create an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots
- Console errors
- Network request details
