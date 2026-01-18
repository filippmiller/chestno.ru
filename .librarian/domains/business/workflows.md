# Business Workflows

> Last updated: 2026-01-18
> Domain: business
> Keywords: workflow, process, flow, business logic, lifecycle

## Overview

Key business workflows and processes in the platform, describing
the end-to-end flows from user perspective.

---

## Organization Registration Flow

```
1. User visits /auth
2. Signs up with email/password
3. Email confirmation sent
4. User confirms email
5. Logs in → redirected to /dashboard
6. Prompted to create organization
7. Fills basic org info (name, slug, category)
8. Organization created with status='pending'
9. Redirected to onboarding
```

---

## Organization Onboarding Flow

**Page:** `/dashboard/organization/onboarding`

### Checklist Steps
1. **Profile** - Complete basic profile
2. **Contacts** - Add contact information
3. **Photos** - Upload profile photos
4. **Video** - Add profile video (optional)
5. **Products** - Add at least one product
6. **QR Code** - Create QR code
7. **Verification** - Submit for verification
8. **Team** - Invite team members (optional)
9. **Posts** - Publish first post (optional)

### Progress Tracking
```typescript
interface OnboardingProgress {
  profile_complete: boolean;
  contacts_complete: boolean;
  photos_uploaded: boolean;
  video_added: boolean;
  products_added: boolean;
  qr_created: boolean;
  verification_submitted: boolean;
  team_invited: boolean;
  posts_published: boolean;
  percentage: number;
}
```

---

## Verification Workflow

```
1. Organization completes onboarding
2. Submits for verification
3. Notification sent to platform moderators
4. Moderator reviews:
   - Profile completeness
   - Content quality
   - Legitimacy check
5. Decision:
   a. APPROVE:
      - verification_status = 'approved'
      - public_visible = true
      - Notification to org owner
   b. REJECT:
      - verification_status = 'rejected'
      - verification_comment = 'Reason...'
      - Notification to org owner
6. If rejected, org can fix issues and resubmit
```

---

## Review Submission Flow

```
1. Customer visits public org page
2. Clicks "Leave Review"
3. Redirected to /org/:id/review
4. If not logged in → redirect to /auth
5. Fills review form:
   - Rating (1-5 stars, required)
   - Title (optional)
   - Body (required)
   - Media (optional images/videos)
   - Product (optional)
6. Submits review
7. Review created with status='pending'
8. Notification sent to org managers
9. Review awaits moderation
```

---

## Review Moderation Flow

```
1. Org receives notification of new review
2. Manager opens review dashboard
3. Views review details
4. Decision:
   a. APPROVE:
      - status = 'approved'
      - Review visible publicly
   b. REJECT:
      - status = 'rejected'
      - moderation_comment set
      - Review hidden from public
5. Optionally: Add organization response
```

---

## QR Code Analytics Flow

```
1. Organization creates QR code
2. Prints on marketing material
3. Customer scans QR code
4. Request hits /q/{code}
5. System logs:
   - Timestamp
   - IP (hashed)
   - User agent
   - Referer
   - UTM parameters
   - Country/city (GeoIP)
6. Redirects to organization page
7. Organization views analytics in dashboard
8. Can export data as CSV/JSON
```

---

## Team Invitation Flow

```
1. Manager opens /dashboard/organization/invites
2. Clicks "Invite Team Member"
3. Enters:
   - Email address
   - Role (admin/manager/editor/analyst/viewer)
4. System generates unique invite code
5. Email sent to recipient
6. Recipient clicks link → /invite/{code}
7. If not registered:
   - Signs up
   - Returns to invite link
8. If registered:
   - Logs in
   - Accepts invite
9. Membership created with specified role
10. User appears in organization member list
```

---

## Content Publication Flow (Posts/Products)

```
1. Editor opens content page (posts or products)
2. Creates new item with status='draft'
3. Fills details:
   - Name/title
   - Description
   - Images/media
   - Category/tags
4. Saves draft
5. Reviews and edits
6. When ready: changes status to 'published'
7. Content appears on public pages
8. Can later archive: status='archived'
```

---

## Subscription & Limits Flow

```
1. Organization on free plan
2. Hits limit (e.g., max products)
3. System blocks action: "Upgrade plan to add more"
4. Admin assigns higher plan
5. Limits increased
6. Organization can continue
```

### Limit Checks
```python
allowed, current, max = check_org_limit(org_id, 'products')
if not allowed:
    raise HTTPException(403, f"Product limit reached ({current}/{max})")
```

---

## Notification Delivery Flow

```
1. Event triggers notification
2. System calls emit_notification()
3. Resolves recipients based on scope:
   - user: Single user
   - organization: All org members
   - platform: Platform admins
4. For each recipient:
   - Check user notification settings
   - Create delivery for enabled channels
5. Background workers process:
   - in_app: Mark as ready
   - email: Send via SMTP
   - push: Send via Web Push
   - telegram: Send via Bot API
6. User sees notification in inbox
```

---

## Authentication Session Flow

```
1. User logs in (email/password or OAuth)
2. Backend validates credentials
3. Creates session record in DB
4. Sets httpOnly session cookie
5. Returns user data + redirect URL
6. On subsequent requests:
   - Browser sends cookie
   - Backend validates session
   - Returns user context
7. On logout:
   - Session deleted from DB
   - Cookie cleared
```

---

## Data Export Flow

```
1. User opens analytics page
2. Selects export format (CSV/JSON)
3. Frontend requests /api/.../export
4. Backend queries data
5. Formats as CSV or JSON
6. Returns file for download
7. Browser saves file
```

---

## Error Recovery Flows

### Failed Login
```
1. User enters wrong password
2. System records failed attempt
3. After 3 failures: temporary lockout
4. User waits or resets password
5. Lockout expires
6. User can try again
```

### Failed Upload
```
1. User selects file
2. Validation fails (size/type)
3. Error message displayed
4. User selects valid file
5. Upload succeeds
```

### Failed API Request
```
1. Frontend makes request
2. Backend returns error (4xx/5xx)
3. Frontend displays error message
4. User can retry or fix input
5. Request succeeds
```
