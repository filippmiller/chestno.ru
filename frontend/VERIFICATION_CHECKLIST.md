# UpgradeRequestForm - Verification Checklist

## Pre-Integration Verification

Use this checklist before integrating the component into your application.

---

## ✅ File Verification

Check that all required files exist:

```bash
# Core files
[ ] frontend/src/components/UpgradeRequestForm.tsx
[ ] frontend/src/types/organizations.ts
[ ] frontend/src/api/organizationsService.ts

# Documentation
[ ] frontend/src/docs/UpgradeRequestForm.md
[ ] frontend/src/docs/UpgradeRequestForm_QuickStart.md
[ ] frontend/src/docs/UpgradeRequestForm_TestPlan.md

# Examples
[ ] frontend/src/examples/UpgradeRequestFormIntegration.tsx

# Summary
[ ] frontend/DELIVERABLE_UpgradeRequestForm.md
```

**Quick Check Command**:
```bash
ls -la frontend/src/components/UpgradeRequestForm.tsx \
       frontend/src/types/organizations.ts \
       frontend/src/api/organizationsService.ts \
       frontend/src/docs/UpgradeRequestForm*.md \
       frontend/src/examples/UpgradeRequestFormIntegration.tsx
```

---

## ✅ Dependency Verification

Verify required npm packages are installed:

```bash
cd frontend
npm list react-hook-form zod @hookform/resolvers
```

**Expected Output**:
```
├── react-hook-form@7.66.1
├── zod@3.25.76
└── @hookform/resolvers@3.10.0
```

If missing, install:
```bash
npm install react-hook-form zod @hookform/resolvers
```

---

## ✅ UI Components Verification

Check that all shadcn/ui components exist:

```bash
[ ] frontend/src/components/ui/button.tsx
[ ] frontend/src/components/ui/dialog.tsx
[ ] frontend/src/components/ui/select.tsx
[ ] frontend/src/components/ui/input.tsx
[ ] frontend/src/components/ui/textarea.tsx
[ ] frontend/src/components/ui/checkbox.tsx
[ ] frontend/src/components/ui/label.tsx
[ ] frontend/src/components/ui/card.tsx (for integration example)
```

**Quick Check**:
```bash
ls frontend/src/components/ui/{button,dialog,select,input,textarea,checkbox,label}.tsx
```

If any are missing, add them:
```bash
npx shadcn-ui@latest add button dialog select input textarea checkbox label
```

---

## ✅ Import Path Verification

Verify that the `@/` import alias is configured:

**Check `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Check `vite.config.ts`** (or `vite.config.js`):
```typescript
import path from 'path'

export default {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}
```

---

## ✅ Backend API Verification

Verify the backend endpoint is implemented:

**Endpoint**: `POST /api/organizations/:orgId/status-upgrade-request`

**Test with curl**:
```bash
curl -X POST http://localhost:8000/api/organizations/test-org/status-upgrade-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "target_level": "B",
    "message": "Test message with required minimum length",
    "accept_terms": true
  }'
```

**Expected Response (200)**:
```json
{
  "success": true,
  "request": {
    "id": "req-123",
    "organization_id": "test-org",
    "target_level": "B",
    "message": "Test message...",
    "status": "pending",
    "submitted_at": "2026-01-27T..."
  },
  "message": "Upgrade request submitted successfully"
}
```

**Check for error responses**:
- [ ] 400 - Invalid data
- [ ] 403 - Not authorized (e.g., requesting C without B)
- [ ] 429 - Rate limit exceeded
- [ ] 500 - Server error

---

## ✅ Code Quality Verification

Run linting and type checking:

```bash
cd frontend

# TypeScript type checking
npm run type-check
# OR
npx tsc --noEmit

# ESLint
npm run lint
# OR
npx eslint src/components/UpgradeRequestForm.tsx

# Build test
npm run build
```

**Expected**: No errors in UpgradeRequestForm.tsx

---

## ✅ Component Import Test

Create a test file to verify the component imports correctly:

**`frontend/src/test-upgrade-form.tsx`**:
```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { submitUpgradeRequest, getOrganizationStatus } from '@/api/organizationsService';
import type { StatusLevel } from '@/types/organizations';

// If this compiles without errors, imports are correct
console.log('Component imported successfully');
```

Run:
```bash
npx tsc --noEmit frontend/src/test-upgrade-form.tsx
```

---

## ✅ Visual Verification

Start the dev server and manually verify:

```bash
cd frontend
npm run dev
```

**Test Steps**:
1. Navigate to a page where you can add the component
2. Add the component to a test page
3. Open the form dialog
4. Verify:
   - [ ] Dialog opens correctly
   - [ ] All fields are visible
   - [ ] Dropdown works
   - [ ] Textarea has character counter
   - [ ] Can add/remove evidence URLs
   - [ ] Checkbox works
   - [ ] Submit button is present

---

## ✅ Functional Verification

Test basic functionality:

### Test 1: Form Validation
1. [ ] Open form
2. [ ] Click submit without filling anything
3. [ ] Verify error messages appear
4. [ ] Verify form does not submit

### Test 2: Character Counter
1. [ ] Type in message field
2. [ ] Verify counter updates (e.g., "25/500")
3. [ ] Type over 500 characters
4. [ ] Verify counter turns red

### Test 3: URL Fields
1. [ ] Click "Добавить ссылку"
2. [ ] Verify new field appears
3. [ ] Click X to remove
4. [ ] Verify field is removed

### Test 4: Successful Submission
1. [ ] Fill all required fields correctly
2. [ ] Check terms checkbox
3. [ ] Click submit
4. [ ] Verify loading spinner appears
5. [ ] Verify success message appears
6. [ ] Verify dialog closes after 2 seconds

### Test 5: Error Handling
1. [ ] Trigger an error (e.g., disconnect backend)
2. [ ] Submit form
3. [ ] Verify error message appears
4. [ ] Verify form remains open

---

## ✅ Integration Verification

Test integration with dashboard:

1. [ ] Import component in status dashboard
2. [ ] Add button to trigger form
3. [ ] Verify organizationId is passed correctly
4. [ ] Verify currentLevel is passed correctly
5. [ ] Verify onSuccess callback works
6. [ ] Verify dashboard refreshes after submission

**Example Integration Code**:
```tsx
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { useState } from 'react';

function Dashboard() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <button onClick={() => setFormOpen(true)}>
        Request Upgrade
      </button>
      <UpgradeRequestForm
        organizationId="org-123"
        currentLevel="A"
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => console.log('Success!')}
      />
    </>
  );
}
```

---

## ✅ Documentation Verification

Review all documentation files:

1. [ ] Read `UpgradeRequestForm_QuickStart.md`
2. [ ] Read `UpgradeRequestForm.md`
3. [ ] Review `UpgradeRequestForm_TestPlan.md`
4. [ ] Review `UpgradeRequestFormIntegration.tsx` example
5. [ ] Ensure all links and references are correct
6. [ ] Verify code examples compile

---

## ✅ Accessibility Verification

Test accessibility features:

1. [ ] Navigate form using only keyboard (Tab, Enter, Space)
2. [ ] Use screen reader to verify labels are announced
3. [ ] Verify focus indicators are visible
4. [ ] Verify error messages are announced
5. [ ] Test with browser zoom (150%, 200%)
6. [ ] Check color contrast (DevTools)

---

## ✅ Browser Compatibility Verification

Test on multiple browsers:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, if on Mac)
- [ ] Edge (latest)

**For each browser**:
1. Open form
2. Fill fields
3. Submit
4. Verify no console errors
5. Verify UI renders correctly

---

## ✅ Mobile Responsiveness Verification

Test on different screen sizes:

**Chrome DevTools Device Mode**:
- [ ] iPhone SE (375px)
- [ ] iPhone 12 Pro (390px)
- [ ] iPad (768px)
- [ ] iPad Pro (1024px)
- [ ] Desktop (1920px)

**For each size**:
1. [ ] Dialog fits viewport
2. [ ] Text is readable
3. [ ] Buttons are accessible
4. [ ] Form is usable

---

## ✅ Performance Verification

Check performance metrics:

```bash
# Build size
npm run build
du -sh dist/assets/*.js
```

1. [ ] Component doesn't significantly increase bundle size
2. [ ] No console warnings in production build
3. [ ] Form is responsive (no lag when typing)

---

## ✅ Security Verification

Review security aspects:

1. [ ] XSS: Special characters in message field are escaped
2. [ ] CSRF: Backend has CSRF protection
3. [ ] Auth: Authorization header is sent with requests
4. [ ] Validation: Both frontend and backend validate input
5. [ ] Rate limiting: Backend enforces 30-day limit

---

## Verification Sign-off

**Verifier Name**: _________________
**Date**: _________________
**Version**: v1.0

### Results Summary

| Category | Pass/Fail | Notes |
|----------|-----------|-------|
| File Verification | ☐ Pass ☐ Fail | |
| Dependencies | ☐ Pass ☐ Fail | |
| UI Components | ☐ Pass ☐ Fail | |
| Import Paths | ☐ Pass ☐ Fail | |
| Backend API | ☐ Pass ☐ Fail | |
| Code Quality | ☐ Pass ☐ Fail | |
| Visual | ☐ Pass ☐ Fail | |
| Functional | ☐ Pass ☐ Fail | |
| Integration | ☐ Pass ☐ Fail | |
| Documentation | ☐ Pass ☐ Fail | |
| Accessibility | ☐ Pass ☐ Fail | |
| Browser Compatibility | ☐ Pass ☐ Fail | |
| Mobile Responsive | ☐ Pass ☐ Fail | |
| Performance | ☐ Pass ☐ Fail | |
| Security | ☐ Pass ☐ Fail | |

**Overall Status**: ☐ Approved ☐ Rejected ☐ Needs Fixes

**Issues Found**:
1.
2.
3.

**Recommendations**:
1.
2.
3.

---

## Quick Verification Script

Run this script for a quick automated check:

```bash
#!/bin/bash

echo "=== UpgradeRequestForm Verification ==="
echo ""

# Check files exist
echo "Checking files..."
FILES=(
  "frontend/src/components/UpgradeRequestForm.tsx"
  "frontend/src/types/organizations.ts"
  "frontend/src/api/organizationsService.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file MISSING"
  fi
done

echo ""
echo "Checking UI components..."
UI_COMPONENTS=(
  "button" "dialog" "select" "input" "textarea" "checkbox" "label"
)

for component in "${UI_COMPONENTS[@]}"; do
  if [ -f "frontend/src/components/ui/${component}.tsx" ]; then
    echo "✅ ${component}.tsx"
  else
    echo "❌ ${component}.tsx MISSING"
  fi
done

echo ""
echo "Checking dependencies..."
cd frontend
npm list react-hook-form zod @hookform/resolvers 2>&1 | grep -E "(react-hook-form|zod|resolvers)"

echo ""
echo "=== Verification Complete ==="
```

Save as `verify-upgrade-form.sh` and run:
```bash
chmod +x verify-upgrade-form.sh
./verify-upgrade-form.sh
```

---

## Next Steps After Verification

1. ✅ All checks pass → Proceed with integration
2. ❌ Some checks fail → Fix issues and re-verify
3. 📝 Document any custom configuration needed
4. 🚀 Deploy to staging for QA testing
5. 📊 Monitor error logs in production
