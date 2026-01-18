# Organization Management

> Last updated: 2026-01-18
> Domain: organizations
> Keywords: organization, org, profile, member, team, invite, membership, role, verification

## Overview

Organizations are the core business entities. Users belong to organizations
via memberships with specific roles. Organizations go through a verification
workflow before becoming publicly visible.

---

## Organization Lifecycle

```
1. User signs up → Creates first organization (as owner)
2. Organization is created with verification_status='pending'
3. Owner completes onboarding (profile, contacts, products, etc.)
4. Organization submits for verification
5. Platform moderator reviews → approved/rejected
6. If approved: public_visible=true, verification_status='verified'
7. Organization appears in public catalog
```

---

## Database Tables

### organizations
**Purpose:** Core organization records
**Key Fields:**
- `name`, `slug` (unique URL identifier)
- `country`, `city`
- `website_url`, `phone`
- `primary_category`, `tags`
- `verification_status`: pending | approved | rejected
- `public_visible`: boolean

### organization_profiles
**Purpose:** Extended rich profile
**Key Fields:**
- `short_description`, `long_description`
- `production_description`, `safety_and_quality`
- `video_url`, `gallery` (JSON array)
- `founded_year`, `employee_count`, `factory_size`
- `certifications` (JSON array)
- `buy_links`, `social_links` (JSON arrays)
- Contact fields: email, phone, website, address, telegram, whatsapp

### organization_members
**Purpose:** User membership tracking
**Key Fields:**
- `organization_id`, `user_id`
- `role`: owner | admin | manager | editor | analyst | viewer
- `invited_by`

---

## Roles & Permissions

| Role | Products | Posts | Reviews | QR | Analytics | Team | Settings |
|------|----------|-------|---------|----|-----------| -----|----------|
| owner | Full | Full | Full | Full | Full | Full | Full |
| admin | Full | Full | Full | Full | Full | Full | Full |
| manager | Full | Full | Moderate | Full | Full | Invite | Edit |
| editor | CRUD | CRUD | View | View | View | - | - |
| analyst | View | View | View | View | Full | - | - |
| viewer | View | View | View | View | View | - | - |

---

## Backend Services

### organization_profiles.py

**Key Functions:**
```python
get_organization_profile(org_id, user_id)
# Fetch profile with permission check

upsert_organization_profile(org_id, user_id, payload)
# Create or update profile, requires Editor+ role

get_public_profile_by_slug(slug)
# Public access, no auth needed

search_public_organizations(q, country, category, verified_only, limit, offset)
# Full-text search on public orgs

get_public_organization_details_by_slug(slug)
# Full details including products and reviews
```

**Permission Helper:**
```python
_require_role(cur, org_id, user_id, allowed_roles)
# Throws 403 if user doesn't have required role
```

---

## API Endpoints

### Private (Authenticated)
- `GET /api/organizations/{org_id}/profile` - Get profile
- `PUT /api/organizations/{org_id}/profile` - Update profile
- `GET /api/organizations/{org_id}/onboarding` - Get progress

### Public
- `GET /api/public/organizations/search` - Search
- `GET /api/public/organizations/by-slug/{slug}` - Get by slug
- `GET /api/public/organizations/details/{slug}` - Full details
- `GET /api/public/organizations/{org_id}` - Get by ID

---

## Frontend Pages

### OrganizationProfile.tsx
**Route:** `/dashboard/organization/profile`
**Purpose:** Edit organization profile
**Sections:**
- Basic info (descriptions)
- Media (images, video)
- Metadata (year, employees, size)
- Certifications
- Buy links
- Social links
- Contacts

### OrganizationOnboarding.tsx
**Route:** `/dashboard/organization/onboarding`
**Purpose:** Track completion progress
**Checklist Items:**
1. Profile completion
2. Contact information
3. Photos uploaded
4. Video added
5. Products added
6. QR code created
7. Verification submitted
8. Team invited
9. First post published

---

## Team Management

### Invitation Flow
```
1. Manager creates invite with email + role
2. System generates unique invite code
3. Invite email sent to recipient
4. Recipient clicks link → /invite/{code}
5. If authenticated: accepts invite, joins org
6. If not authenticated: signs up, then accepts
7. Membership created with specified role
```

### API Endpoints
- `GET /api/organizations/{org_id}/invites` - List invites
- `POST /api/organizations/{org_id}/invites` - Create invite
- `POST /api/invites/{code}/accept` - Accept invite
- `GET /api/invites/{code}/preview` - Preview invite

### Frontend Pages
- `OrganizationInvites.tsx` - Manage team invitations
- `InviteLanding.tsx` - Accept invite public page

---

## Verification Workflow

### Statuses
- `pending` - Awaiting review
- `approved` - Verified, can be public
- `rejected` - Not approved, with comment

### Moderation Endpoints
- `GET /api/moderation/organizations` - List pending
- `POST /api/moderation/organizations/{org_id}/verify` - Approve
- `POST /api/moderation/organizations/{org_id}/reject` - Reject with comment

### Admin Dashboard
- `ModerationDashboard.tsx` - Review pending organizations

---

## Profile Rich Content

### Gallery Format (JSON)
```json
[
  { "url": "https://...", "alt": "Description", "sort_order": 0 }
]
```

### Certifications Format
```json
[
  { "name": "ISO 9001", "year": 2023, "url": "https://..." }
]
```

### Buy Links Format
```json
[
  { "label": "Ozon", "url": "https://ozon.ru/..." }
]
```

### Social Links Format
```json
[
  { "type": "telegram", "label": "@company", "url": "https://t.me/company" }
]
```

---

## Organization Selection

**Frontend Pattern:**
Users with multiple memberships select active org via dropdown.
Selection stored in Zustand store `userStore.selectedOrganizationId`.

```typescript
// userStore.ts
{
  selectedOrganizationId: string | null,
  setSelectedOrganization: (id: string) => void
}
```

All dashboard pages read this value to fetch correct organization data.
