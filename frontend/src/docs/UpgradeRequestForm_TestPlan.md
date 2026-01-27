# UpgradeRequestForm Test Plan

## Test Overview

This document provides detailed test scenarios for the UpgradeRequestForm component, including manual testing steps and expected outcomes.

## Test Environment Setup

### Prerequisites
1. Running backend with `/api/organizations/:orgId/status-upgrade-request` endpoint
2. Frontend dev server running
3. Test organization IDs for different status levels (A, B, C)
4. Browser dev tools open for network inspection

### Test Data

```typescript
// Test Organization IDs
const TEST_ORGS = {
  levelA: 'org-level-a-001',
  levelB: 'org-level-b-001',
  levelC: 'org-level-c-001',
  recentRequest: 'org-recent-request-001', // Has request within 30 days
};

// Test URLs
const VALID_URLS = [
  'https://example.com',
  'https://docs.google.com/document/d/abc123',
  'https://dropbox.com/s/file.pdf',
];

const INVALID_URLS = [
  'not-a-url',
  'htp://invalid',
  'example.com', // Missing protocol
];
```

---

## Test Suite 1: Form Validation

### Test 1.1: Empty Form Submission
**Priority**: High
**Type**: Validation

**Steps**:
1. Open form for Level A organization
2. Click "Отправить запрос" without filling any fields
3. Observe validation errors

**Expected Result**:
- ✅ Error: "Пожалуйста, выберите целевой уровень"
- ✅ Error: "Сообщение должно содержать минимум 10 символов"
- ✅ Error: "Необходимо принять условия"
- ✅ Form does NOT submit
- ✅ No API call made (check Network tab)

**Pass Criteria**: All validation errors appear, no submission occurs

---

### Test 1.2: Message Minimum Length
**Priority**: High
**Type**: Validation

**Steps**:
1. Select target level
2. Enter 9 characters in message field: "Test 1234"
3. Check accept terms
4. Submit form

**Expected Result**:
- ✅ Error appears: "Сообщение должно содержать минимум 10 символов"
- ✅ Error appears immediately on blur or submit
- ✅ Form does not submit

**Pass Criteria**: Minimum length validation works correctly

---

### Test 1.3: Message Maximum Length
**Priority**: High
**Type**: Validation

**Steps**:
1. Fill form with valid data
2. Paste 600 characters into message field
3. Observe character counter and validation

**Expected Result**:
- ✅ Character counter shows "600/500"
- ✅ Counter turns red when over 500
- ✅ Error: "Сообщение должно содержать максимум 500 символов"
- ✅ Submit button remains enabled (validation prevents submission)

**Pass Criteria**: Maximum length enforced, visual feedback correct

---

### Test 1.4: Character Counter Real-time Update
**Priority**: Medium
**Type**: UX

**Steps**:
1. Type characters slowly in message field
2. Observe character counter

**Expected Result**:
- ✅ Counter updates with each keystroke
- ✅ Shows format "X/500"
- ✅ Gray color when under 500
- ✅ Red color when over 500

**Pass Criteria**: Counter is accurate and responsive

---

### Test 1.5: Valid Message Length
**Priority**: High
**Type**: Validation

**Steps**:
1. Enter exactly 10 characters: "Test 12345"
2. Enter 250 characters (mid-range)
3. Enter exactly 500 characters

**Expected Result**:
- ✅ No validation error for 10 chars
- ✅ No validation error for 250 chars
- ✅ No validation error for 500 chars
- ✅ Form can be submitted (with other required fields)

**Pass Criteria**: Valid lengths accepted without error

---

### Test 1.6: URL Validation - Invalid URLs
**Priority**: High
**Type**: Validation

**Steps**:
1. Click "Добавить ссылку"
2. Enter invalid URLs one by one:
   - "not-a-url"
   - "htp://typo"
   - "example.com"
3. Try to submit

**Expected Result**:
- ✅ Error: "Неверный формат URL"
- ✅ Error appears for each invalid URL
- ✅ Form does not submit

**Pass Criteria**: Invalid URLs rejected

---

### Test 1.7: URL Validation - Valid URLs
**Priority**: High
**Type**: Validation

**Steps**:
1. Click "Добавить ссылку" 3 times
2. Enter valid URLs:
   - "https://example.com"
   - "https://docs.google.com/document/d/123"
   - "http://test.com" (HTTP also valid)
3. Submit form (with other required fields)

**Expected Result**:
- ✅ No validation errors
- ✅ All URLs accepted
- ✅ Form submits successfully

**Pass Criteria**: Valid URLs accepted

---

### Test 1.8: Terms Checkbox Validation
**Priority**: High
**Type**: Validation

**Steps**:
1. Fill all fields correctly
2. Leave terms checkbox unchecked
3. Submit form

**Expected Result**:
- ✅ Error: "Необходимо принять условия"
- ✅ Form does not submit

**Pass Criteria**: Terms must be accepted

---

## Test Suite 2: Form Functionality

### Test 2.1: Target Level Dropdown - Level A Organization
**Priority**: High
**Type**: Functionality

**Steps**:
1. Open form for Level A organization
2. Click target level dropdown
3. Observe available options

**Expected Result**:
- ✅ "Уровень B - Верифицированная организация" is enabled
- ✅ "Уровень C (требуется уровень B)" is disabled
- ✅ Can select Level B

**Pass Criteria**: Correct options shown for Level A

---

### Test 2.2: Target Level Dropdown - Level B Organization
**Priority**: High
**Type**: Functionality

**Steps**:
1. Open form for Level B organization
2. Click target level dropdown
3. Observe available options

**Expected Result**:
- ✅ Only "Уровень C - Премиум организация с расширенными возможностями" shown
- ✅ Level B not available (already have it)
- ✅ Can select Level C

**Pass Criteria**: Only Level C available for Level B organizations

---

### Test 2.3: Add Evidence URL Fields
**Priority**: Medium
**Type**: Functionality

**Steps**:
1. Open form
2. Click "Добавить ссылку" button 5 times
3. Count input fields

**Expected Result**:
- ✅ Initially 1 URL field present
- ✅ Each click adds a new field
- ✅ Total 6 fields after 5 clicks
- ✅ Each field has a remove button (X)

**Pass Criteria**: URL fields add correctly

---

### Test 2.4: Remove Evidence URL Fields
**Priority**: Medium
**Type**: Functionality

**Steps**:
1. Add 4 URL fields (total 5)
2. Click X button on 3rd field
3. Click X button on last field
4. Try to remove the last remaining field

**Expected Result**:
- ✅ 3rd field removed
- ✅ Last field removed
- ✅ Remaining fields still show X button
- ✅ Can always remove down to 1 field
- ✅ Cannot remove the last field

**Pass Criteria**: URL fields remove correctly, minimum 1 remains

---

### Test 2.5: Empty Evidence URLs Not Submitted
**Priority**: Medium
**Type**: Functionality

**Steps**:
1. Add 3 URL fields
2. Fill only 1st and 3rd fields with valid URLs
3. Leave 2nd field empty
4. Submit form
5. Check network request payload

**Expected Result**:
- ✅ Only 2 URLs sent in request
- ✅ Empty URL field not included
- ✅ evidence_urls array has 2 items

**Pass Criteria**: Empty URL fields filtered out

---

### Test 2.6: All Evidence URLs Empty
**Priority**: Medium
**Type**: Functionality

**Steps**:
1. Add multiple URL fields
2. Leave all empty
3. Fill other required fields
4. Submit form
5. Check request payload

**Expected Result**:
- ✅ Form submits successfully
- ✅ evidence_urls is undefined or empty array in payload
- ✅ No validation error

**Pass Criteria**: Empty evidence URLs treated as optional

---

### Test 2.7: Form Reset on Close
**Priority**: Medium
**Type**: UX

**Steps**:
1. Fill form partially:
   - Select target level
   - Enter message (100 chars)
   - Add 2 URL fields
   - Check terms
2. Click X to close dialog
3. Reopen form
4. Inspect all fields

**Expected Result**:
- ✅ Target level dropdown reset (no selection)
- ✅ Message field empty
- ✅ Only 1 URL field shown
- ✅ Terms checkbox unchecked
- ✅ Character counter shows "0/500"

**Pass Criteria**: Form completely resets on close

---

### Test 2.8: Cancel Button
**Priority**: Medium
**Type**: UX

**Steps**:
1. Fill form with data
2. Click "Отмена" button
3. Reopen form

**Expected Result**:
- ✅ Dialog closes
- ✅ Form resets (same as Test 2.7)

**Pass Criteria**: Cancel works like X button

---

## Test Suite 3: API Integration & Submission

### Test 3.1: Successful Submission
**Priority**: Critical
**Type**: Integration

**Setup**: Mock or use real API with success response

**Steps**:
1. Fill form completely with valid data:
   - Target level: B
   - Message: "Test upgrade request with minimum required length"
   - Evidence URLs: "https://example.com"
   - Check terms
2. Click "Отправить запрос"
3. Observe loading state
4. Wait for success

**Expected Result**:
- ✅ Button shows spinner: "Отправка..."
- ✅ Button disabled during submission
- ✅ Cancel button disabled
- ✅ API call to `/api/organizations/{orgId}/status-upgrade-request`
- ✅ Success screen appears with green checkmark
- ✅ Message: "Запрос успешно отправлен!"
- ✅ Dialog auto-closes after 2 seconds
- ✅ onSuccess callback triggered

**Pass Criteria**: Full success flow works correctly

---

### Test 3.2: Rate Limit Error (429)
**Priority**: High
**Type**: Error Handling

**Setup**: Mock 429 response or use organization with recent request

**Steps**:
1. Fill form with valid data
2. Submit
3. Observe error handling

**Expected Result**:
- ✅ Red error box appears
- ✅ Message: "Вы можете подать запрос раз в 30 дней. Пожалуйста, попробуйте позже."
- ✅ Form remains open for viewing
- ✅ Submit button re-enabled
- ✅ User can close dialog

**Pass Criteria**: Rate limit error displayed clearly

---

### Test 3.3: Validation Error from Backend (400)
**Priority**: High
**Type**: Error Handling

**Setup**: Mock 400 response

**Steps**:
1. Submit form
2. Observe error

**Expected Result**:
- ✅ Error box shows
- ✅ Message: "Неверные данные запроса. Проверьте заполненные поля."
- ✅ Form stays open
- ✅ User can correct and retry

**Pass Criteria**: 400 error handled gracefully

---

### Test 3.4: Permission Error - Level C without Level B (403)
**Priority**: High
**Type**: Error Handling

**Setup**: Level A org trying to request Level C (hack the form or mock response)

**Steps**:
1. Request Level C without having Level B
2. Submit form
3. Observe error

**Expected Result**:
- ✅ Error box shows
- ✅ Message: "Для запроса уровня C необходимо иметь активный уровень B. Сначала получите уровень B."
- ✅ Clear explanation of requirement

**Pass Criteria**: Permission error clear and actionable

---

### Test 3.5: Network Error (500 or timeout)
**Priority**: High
**Type**: Error Handling

**Setup**: Mock 500 response or disable backend

**Steps**:
1. Submit form
2. Wait for error

**Expected Result**:
- ✅ Error box shows
- ✅ Message: "Ошибка отправки запроса. Пожалуйста, попробуйте позже."
- ✅ Generic but helpful error message

**Pass Criteria**: Network errors handled

---

### Test 3.6: Request Payload Correctness
**Priority**: Critical
**Type**: Integration

**Steps**:
1. Fill form with known data:
   - Target: B
   - Message: "Test message for API payload validation"
   - URLs: ["https://example.com", "https://test.com"]
   - Terms: checked
2. Submit
3. Inspect network request in DevTools

**Expected Result**:
- ✅ Method: POST
- ✅ URL: `/api/organizations/{orgId}/status-upgrade-request`
- ✅ Headers: Content-Type: application/json, Authorization: Bearer {token}
- ✅ Body matches:
```json
{
  "target_level": "B",
  "message": "Test message for API payload validation",
  "evidence_urls": ["https://example.com", "https://test.com"],
  "accept_terms": true
}
```

**Pass Criteria**: Request structure matches API spec exactly

---

### Test 3.7: Authorization Header
**Priority**: High
**Type**: Security

**Steps**:
1. Submit form while logged in
2. Check request headers

**Expected Result**:
- ✅ Authorization header present
- ✅ Format: "Bearer {token}"
- ✅ Token is current user's token

**Pass Criteria**: Auth token sent correctly

---

## Test Suite 4: User Experience

### Test 4.1: Loading State During Submission
**Priority**: Medium
**Type**: UX

**Steps**:
1. Submit form
2. Observe UI during API call (may need slow network simulation)

**Expected Result**:
- ✅ Submit button shows spinner icon
- ✅ Button text: "Отправка..."
- ✅ Submit button disabled
- ✅ Cancel button disabled
- ✅ Cannot close dialog by clicking X
- ✅ Cannot close dialog by clicking overlay
- ✅ Form fields remain visible but inactive

**Pass Criteria**: Clear loading feedback, actions blocked

---

### Test 4.2: Success Animation
**Priority**: Low
**Type**: UX

**Steps**:
1. Submit form successfully
2. Observe success screen

**Expected Result**:
- ✅ Green checkmark icon (CheckCircle2) displayed
- ✅ Title: "Запрос успешно отправлен!"
- ✅ Message: "Мы рассмотрим ваш запрос в течение 3-5 рабочих дней и свяжемся с вами."
- ✅ Form content hidden
- ✅ Success content centered
- ✅ Auto-closes after exactly 2 seconds

**Pass Criteria**: Success state is clear and reassuring

---

### Test 4.3: Error Message Visibility
**Priority**: Medium
**Type**: UX

**Steps**:
1. Trigger various errors (rate limit, validation, network)
2. Observe error display

**Expected Result**:
- ✅ Error appears below form fields
- ✅ Red background (bg-red-50)
- ✅ Red border
- ✅ Red text
- ✅ Error message is readable
- ✅ Error box has adequate padding
- ✅ Error doesn't overlap form content

**Pass Criteria**: Errors are prominent and clear

---

### Test 4.4: Keyboard Navigation
**Priority**: Medium
**Type**: Accessibility

**Steps**:
1. Open form
2. Use Tab key to navigate
3. Use Enter/Space to interact
4. Use Escape to close

**Expected Result**:
- ✅ Tab moves through all interactive elements in logical order
- ✅ Focus indicators visible
- ✅ Enter opens dropdown
- ✅ Space checks checkbox
- ✅ Escape closes dialog (when not submitting)

**Pass Criteria**: Full keyboard accessibility

---

### Test 4.5: Mobile Responsiveness
**Priority**: Medium
**Type**: Responsive Design

**Steps**:
1. Open form on mobile viewport (375px width)
2. Test on tablet (768px)
3. Test on desktop (1920px)

**Expected Result**:
- ✅ Dialog scales to viewport
- ✅ max-height: 90vh prevents overflow
- ✅ Content scrolls if too tall
- ✅ Buttons stack on mobile
- ✅ Text remains readable
- ✅ Touch targets adequate (44px min)

**Pass Criteria**: Works on all screen sizes

---

### Test 4.6: Dialog Scrolling with Long Content
**Priority**: Medium
**Type**: UX

**Steps**:
1. Open form on short viewport (e.g., 800px height)
2. Add multiple evidence URLs to increase height
3. Observe scrolling

**Expected Result**:
- ✅ Dialog content scrolls
- ✅ Dialog header remains visible
- ✅ Dialog footer (buttons) remains visible
- ✅ Scrollbar appears in content area only

**Pass Criteria**: Long forms scroll correctly

---

## Test Suite 5: Edge Cases

### Test 5.1: Special Characters in Message
**Priority**: Low
**Type**: Edge Case

**Steps**:
1. Enter message with special characters:
   - Emoji: "Test message 😀🎉"
   - Cyrillic: "Тестовое сообщение на русском языке"
   - HTML: "Test <script>alert('xss')</script>"
2. Submit

**Expected Result**:
- ✅ All characters accepted
- ✅ Character count accurate
- ✅ Submission successful
- ✅ No XSS vulnerability

**Pass Criteria**: Special characters handled safely

---

### Test 5.2: Very Long URL
**Priority**: Low
**Type**: Edge Case

**Steps**:
1. Enter extremely long but valid URL (2000+ chars)
2. Submit

**Expected Result**:
- ✅ URL accepted if valid format
- ✅ May be limited by backend (check API spec)

**Pass Criteria**: Long URLs handled

---

### Test 5.3: Multiple Rapid Submissions
**Priority**: Medium
**Type**: Edge Case

**Steps**:
1. Submit form
2. Immediately try to submit again (during loading)
3. Check for duplicate requests

**Expected Result**:
- ✅ Second submission blocked (button disabled)
- ✅ Only one API call made
- ✅ No race conditions

**Pass Criteria**: Duplicate submissions prevented

---

### Test 5.4: Network Timeout
**Priority**: Low
**Type**: Edge Case

**Setup**: Simulate slow network (Chrome DevTools: Slow 3G)

**Steps**:
1. Submit form
2. Wait for timeout

**Expected Result**:
- ✅ Loading state persists
- ✅ Eventually shows timeout error
- ✅ User can retry

**Pass Criteria**: Timeouts handled gracefully

---

### Test 5.5: Token Expiration During Submission
**Priority**: Medium
**Type**: Edge Case

**Setup**: Use expired or invalid token

**Steps**:
1. Submit form with expired auth token
2. Observe error

**Expected Result**:
- ✅ 401 error from backend
- ✅ Error message displayed
- ✅ Ideally: redirect to login (depending on app auth flow)

**Pass Criteria**: Auth errors handled

---

## Test Suite 6: Integration with Dashboard

### Test 6.1: Open Form from Dashboard Button
**Priority**: High
**Type**: Integration

**Steps**:
1. Navigate to organization status dashboard
2. Click "Запросить повышение" button
3. Observe form opening

**Expected Result**:
- ✅ Form opens in dialog
- ✅ Current level correctly displayed
- ✅ Organization ID correctly passed

**Pass Criteria**: Dashboard integration works

---

### Test 6.2: Dashboard Refresh After Success
**Priority**: High
**Type**: Integration

**Steps**:
1. Submit upgrade request successfully
2. Observe dashboard after dialog closes

**Expected Result**:
- ✅ onSuccess callback triggered
- ✅ Dashboard calls getOrganizationStatus()
- ✅ New request appears in dashboard
- ✅ Status shows "На рассмотрении"

**Pass Criteria**: Dashboard updates automatically

---

### Test 6.3: Multiple Organizations Switch
**Priority**: Medium
**Type**: Integration

**Steps**:
1. Open form for Organization A
2. Close form
3. Switch to Organization B
4. Open form for Organization B

**Expected Result**:
- ✅ Correct organizationId used for each
- ✅ Correct currentLevel shown for each
- ✅ No data leakage between organizations

**Pass Criteria**: Multi-org handling correct

---

## Test Execution Checklist

Use this checklist to track test execution:

### Critical Tests (Must Pass)
- [ ] Test 1.1: Empty Form Submission
- [ ] Test 1.2: Message Minimum Length
- [ ] Test 1.3: Message Maximum Length
- [ ] Test 1.8: Terms Checkbox Validation
- [ ] Test 2.1: Target Level - Level A Org
- [ ] Test 2.2: Target Level - Level B Org
- [ ] Test 3.1: Successful Submission
- [ ] Test 3.6: Request Payload Correctness
- [ ] Test 6.1: Open Form from Dashboard
- [ ] Test 6.2: Dashboard Refresh After Success

### High Priority Tests (Should Pass)
- [ ] Test 1.4: Character Counter Real-time
- [ ] Test 1.6: URL Validation - Invalid
- [ ] Test 1.7: URL Validation - Valid
- [ ] Test 3.2: Rate Limit Error
- [ ] Test 3.3: Validation Error (400)
- [ ] Test 3.4: Permission Error (403)
- [ ] Test 3.5: Network Error (500)
- [ ] Test 3.7: Authorization Header
- [ ] Test 4.1: Loading State

### Medium Priority Tests (Nice to Have)
- [ ] Test 2.3: Add Evidence URLs
- [ ] Test 2.4: Remove Evidence URLs
- [ ] Test 2.7: Form Reset on Close
- [ ] Test 4.4: Keyboard Navigation
- [ ] Test 4.5: Mobile Responsiveness
- [ ] Test 5.3: Rapid Submissions
- [ ] Test 5.5: Token Expiration

### Low Priority Tests (Optional)
- [ ] Test 4.2: Success Animation
- [ ] Test 5.1: Special Characters
- [ ] Test 5.2: Very Long URL
- [ ] Test 5.4: Network Timeout

---

## Bug Report Template

When issues are found, use this template:

```markdown
### Bug Report: [Brief Description]

**Test Case**: Test X.Y - [Test Name]
**Priority**: Critical/High/Medium/Low
**Environment**: [Browser, OS, Screen Size]

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshots**:
[Attach if applicable]

**Console Errors**:
[Paste any errors]

**Network Request**:
[Paste request/response if relevant]
```

---

## Test Sign-off

**Tester**: _______________
**Date**: _______________
**Total Tests**: _______________
**Passed**: _______________
**Failed**: _______________
**Blocked**: _______________

**Release Recommendation**: ✅ Approved / ❌ Not Approved

**Notes**:
