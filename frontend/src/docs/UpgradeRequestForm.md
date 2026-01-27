# UpgradeRequestForm Component Documentation

## Overview

The `UpgradeRequestForm` component is a production-ready React form for organizations to request status level upgrades (from A to B, or B to C). It includes comprehensive validation, error handling, and a polished user experience.

## Component Location

- **Component**: `frontend/src/components/UpgradeRequestForm.tsx`
- **Types**: `frontend/src/types/organizations.ts`
- **API Service**: `frontend/src/api/organizationsService.ts`
- **Integration Example**: `frontend/src/examples/UpgradeRequestFormIntegration.tsx`

## Features

### Form Fields

1. **Target Level Dropdown** (required)
   - Options: Level B or Level C
   - Smart filtering based on current level
   - Disabled options when prerequisites not met

2. **Message Textarea** (required)
   - Character limit: 10-500 characters
   - Real-time character counter
   - Validation feedback

3. **Evidence URLs** (optional)
   - Dynamic add/remove fields
   - URL validation
   - Multiple links supported

4. **Terms Acceptance Checkbox** (required)
   - Must be checked to submit
   - Clear terms description

### Validation Rules

- **Target Level**: Required, must be 'B' or 'C'
- **Message**: 10-500 characters, required
- **Evidence URLs**: Must be valid URLs if provided
- **Terms**: Must be accepted (true)
- **Business Logic**: Backend validates level C requires active level B

### Error Handling

The component handles multiple error scenarios:

| Error Case | HTTP Status | User Message |
|-----------|-------------|--------------|
| Rate limit exceeded | 429 | "Вы можете подать запрос раз в 30 дней. Пожалуйста, попробуйте позже." |
| Invalid data | 400 | "Неверные данные запроса. Проверьте заполненные поля." |
| Unauthorized (no level B) | 403 | "Для запроса уровня C необходимо иметь активный уровень B. Сначала получите уровень B." |
| Network error | 500 | "Ошибка отправки запроса. Пожалуйста, попробуйте позже." |

### UI States

1. **Form Input** - Default state with all fields enabled
2. **Validation Errors** - Red borders and error messages
3. **Submitting** - Loading spinner, disabled fields
4. **Success** - Green checkmark with confirmation message
5. **Error** - Red alert box with retry option

## Usage

### Basic Integration

```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';

function MyDashboard() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setFormOpen(true)}>
        Request Upgrade
      </Button>

      <UpgradeRequestForm
        organizationId="org-123"
        currentLevel="A"
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          // Refresh data, show notification, etc.
          console.log('Success!');
        }}
      />
    </>
  );
}
```

### Props

```typescript
interface UpgradeRequestFormProps {
  organizationId: string;      // Organization ID
  currentLevel: StatusLevel;   // Current status level ('A' | 'B' | 'C')
  open: boolean;               // Dialog open state
  onOpenChange: (open: boolean) => void;  // Dialog state handler
  onSuccess?: () => void;      // Optional success callback
}
```

### Full Dashboard Integration

See `frontend/src/examples/UpgradeRequestFormIntegration.tsx` for complete examples including:
- Full status dashboard with active requests
- Minimal integration for existing pages
- Status badges and UI helpers

## API Integration

### Endpoint

```
POST /api/organizations/:orgId/status-upgrade-request
```

### Request Payload

```typescript
{
  target_level: 'B' | 'C',
  message: string,           // 10-500 chars
  evidence_urls?: string[],  // Optional array of URLs
  accept_terms: boolean      // Must be true
}
```

### Response

```typescript
{
  success: boolean,
  request: UpgradeRequest,
  message: string
}
```

### Rate Limiting

- **Limit**: 1 request per 30 days per organization
- **Tracking**: Based on `last_request_date` in database
- **Response**: 429 status code when limit exceeded

## Test Scenarios

### 1. Form Validation Tests

#### Test 1.1: Required Fields
- **Steps**: Open form, click submit without filling
- **Expected**: Error messages for all required fields
- **Fields to check**: target_level, message, accept_terms

#### Test 1.2: Message Length Validation
- **Steps**:
  - Enter 5 characters in message field
  - Enter 600 characters in message field
- **Expected**:
  - "Minimum 10 characters" error
  - "Maximum 500 characters" error

#### Test 1.3: Character Counter
- **Steps**: Type in message field
- **Expected**:
  - Counter updates in real-time
  - Shows "X/500"
  - Turns red when over 500

#### Test 1.4: Evidence URL Validation
- **Steps**:
  - Add evidence URL
  - Enter invalid URL (e.g., "not-a-url")
  - Enter valid URL (e.g., "https://example.com")
- **Expected**:
  - Error for invalid URL
  - No error for valid URL

#### Test 1.5: Terms Acceptance
- **Steps**: Try to submit without checking terms
- **Expected**: "Необходимо принять условия" error

### 2. Functionality Tests

#### Test 2.1: Add/Remove Evidence URLs
- **Steps**:
  - Click "Добавить ссылку" button multiple times
  - Click X button to remove fields
- **Expected**:
  - New input fields appear
  - Fields are removed correctly
  - At least one field always remains

#### Test 2.2: Target Level Selection
- **Steps**:
  - For Level A org: Check dropdown options
  - For Level B org: Check dropdown options
- **Expected**:
  - Level A sees B enabled, C disabled
  - Level B sees only C option

#### Test 2.3: Form Reset on Close
- **Steps**:
  - Fill form partially
  - Close dialog
  - Reopen dialog
- **Expected**: All fields are empty/reset

### 3. Submission Tests

#### Test 3.1: Successful Submission
- **Steps**:
  - Fill all required fields correctly
  - Submit form
- **Expected**:
  - Loading spinner appears
  - Success message displays
  - Dialog closes after 2 seconds
  - onSuccess callback triggered

#### Test 3.2: Rate Limit Error
- **Setup**: Mock 429 response
- **Steps**: Submit valid form
- **Expected**: "Вы можете подать запрос раз в 30 дней" error message

#### Test 3.3: Validation Error from Backend
- **Setup**: Mock 400 response
- **Steps**: Submit form
- **Expected**: "Неверные данные запроса" error message

#### Test 3.4: Permission Error (Level C without B)
- **Setup**: Mock 403 response
- **Steps**: Request level C without having B
- **Expected**: "Для запроса уровня C необходимо иметь активный уровень B" error

#### Test 3.5: Network Error
- **Setup**: Mock 500 response or network failure
- **Steps**: Submit form
- **Expected**: "Ошибка отправки запроса" error message

### 4. UX Tests

#### Test 4.1: Loading State
- **Steps**: Submit form, observe during processing
- **Expected**:
  - Submit button shows spinner
  - Submit button disabled
  - Cancel button disabled
  - Dialog cannot be closed

#### Test 4.2: Success Animation
- **Steps**: Successfully submit form
- **Expected**:
  - Green checkmark icon displays
  - Success message shows
  - Auto-closes after 2 seconds

#### Test 4.3: Error Display
- **Steps**: Trigger any error condition
- **Expected**:
  - Red error box appears
  - Error message is clear and actionable
  - Form remains open for retry

#### Test 4.4: Responsive Design
- **Steps**: Open form on mobile, tablet, desktop
- **Expected**:
  - Form is readable on all screen sizes
  - Dialog scrolls if content too tall
  - Buttons are accessible

### 5. Integration Tests

#### Test 5.1: Dashboard Integration
- **Steps**:
  - Open upgrade form from dashboard
  - Submit successfully
  - Check dashboard updates
- **Expected**:
  - Dashboard refreshes with new request
  - Status shows "На рассмотрении"

#### Test 5.2: Multiple Organizations
- **Steps**:
  - Switch between different organizations
  - Open upgrade form for each
- **Expected**:
  - Correct organizationId sent in request
  - Correct current level displayed

## Accessibility

- All form fields have proper labels
- Error messages are announced to screen readers
- Keyboard navigation fully supported
- Focus management in dialog
- ARIA attributes on interactive elements

## Dependencies

```json
{
  "react-hook-form": "^7.66.1",
  "zod": "^3.25.76",
  "@hookform/resolvers": "^3.10.0",
  "lucide-react": "latest",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-select": "latest"
}
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Form validation is debounced for optimal performance
- Minimal re-renders using React Hook Form
- Lazy loading of dialog content
- Optimized bundle size

## Future Enhancements

- [ ] File upload support for evidence documents
- [ ] Draft saving (localStorage)
- [ ] Email notification on submission
- [ ] Real-time status updates via WebSocket
- [ ] Multi-language support
- [ ] Admin review interface

## Support

For questions or issues, contact the frontend team or refer to:
- Implementation spec: `C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Status_Levels_v1.md`
- Backend API docs: `/docs/api/organizations.md`
