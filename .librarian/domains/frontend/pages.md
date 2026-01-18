# Frontend Pages

> Last updated: 2026-01-18
> Domain: frontend
> Keywords: page, react, component, tsx, view, route, screen

## Overview

34 pages in `frontend/src/pages/`. React functional components with TypeScript.
Uses React Router for routing, Zustand for state, Axios for API calls.

---

## Public Pages

### ProducersLanding.tsx
**Route:** `/`
**Purpose:** Main landing page with platform features and CTA

### ProductsCatalog.tsx
**Route:** `/products`
**Purpose:** Browse all public products from verified organizations

### PublicOrganizationsCatalog.tsx
**Route:** `/orgs`
**Purpose:** Searchable directory of all organizations

### PublicOrganization.tsx
**Route:** `/org/:id`
**Purpose:** Public organization profile by ID

### PublicOrganizationPosts.tsx
**Route:** `/org/:slug/posts`
**Purpose:** View published posts from organizations by slug

### CreateReview.tsx
**Route:** `/org/:id/review`
**Purpose:** Public review submission form for organizations

### StoriesPage.tsx
**Route:** `/stories`
**Purpose:** Organization stories and testimonials

### AboutPage.tsx
**Route:** `/about`
**Purpose:** Platform information

### PricingPage.tsx
**Route:** `/pricing`
**Purpose:** Subscription plans and features

### InviteLanding.tsx
**Route:** `/invite/:code`
**Purpose:** Accept organization invites (public, no auth)

---

## Authentication Pages

### AuthCallback.tsx
**Route:** `/auth/callback`
**Purpose:** OAuth callback handler for Google/Yandex

### ForgotPassword.tsx
**Route:** `/auth/forgot`
**Purpose:** Password reset request form

### ResetPassword.tsx
**Route:** `/auth/reset`
**Purpose:** Password reset completion form

---

## Dashboard Pages (Protected)

### Dashboard.tsx
**Route:** `/dashboard`
**Purpose:** Main dashboard hub with quick navigation
**Features:**
- User profile display
- Organization list and selection
- Membership roles display
- Onboarding status
- Quick-access buttons to all sections
- Admin/moderation links for privileged users

### OrganizationProfile.tsx
**Route:** `/dashboard/organization/profile`
**Purpose:** Comprehensive profile editor
**Sections:**
- Basic info (descriptions, production details)
- Media (main image, gallery, video)
- Advanced metadata (founded year, employees, factory size)
- Certifications and quality standards
- Buy links
- Social media accounts
- Contact details
**Roles:** Editor+ can edit

### OrganizationPosts.tsx
**Route:** `/dashboard/organization/posts`
**Purpose:** Manage blog posts/news
**Features:** List, create, edit, delete, status filtering

### OrganizationPostEdit.tsx
**Routes:** `/dashboard/organization/posts/new`, `/dashboard/organization/posts/:postId`
**Purpose:** Create/edit individual posts
**Fields:**
- Slug, title, excerpt
- Body (rich text editor)
- Main image, gallery, video
- Pin/unpin, publish/draft/archive

### OrganizationReviews.tsx
**Route:** `/dashboard/organization/reviews`
**Purpose:** Manage customer reviews
**Features:**
- List with status filtering (pending/approved/rejected)
- Moderation controls
- Organization responses
- Rating distribution stats

### OrganizationProducts.tsx
**Route:** `/dashboard/organization/products`
**Purpose:** Product catalog management
**Fields:**
- Name, descriptions, pricing
- Categories, images, gallery
- Featured/draft/published/archived status

### OrganizationQr.tsx
**Route:** `/dashboard/organization/qr`
**Purpose:** QR code management
**Features:**
- Generate and manage QR codes
- View scan statistics
- Detailed geo and UTM breakdown

### OrganizationQrPoster.tsx
**Route:** `/dashboard/organization/marketing/qr-poster`
**Purpose:** Design QR code marketing posters
**Features:**
- Template selection
- Layout customization (blocks)
- Paper size and orientation

### OrganizationMarketing.tsx
**Route:** `/dashboard/organization/marketing`
**Purpose:** Marketing materials list and creation

### OrganizationMarketingEdit.tsx
**Route:** `/dashboard/organization/marketing/:materialId`
**Purpose:** Visual editor for marketing material layouts

### OrganizationPlan.tsx
**Route:** `/dashboard/organization/plan`
**Purpose:** Subscription and usage limits
**Shows:**
- Current plan details
- Usage (products, QR codes, members)
- Team member management

### OrganizationInvites.tsx
**Route:** `/dashboard/organization/invites`
**Purpose:** Team member invitations
**Features:**
- Send invites by email
- Set roles
- Revoke/resend invites
- Track status (pending/accepted/revoked/expired)

### OrganizationAnalytics.tsx
**Route:** `/dashboard/organization/analytics`
**Purpose:** QR scan analytics
**Charts:**
- Timeline of scan activity
- Geographic breakdown
- UTM parameter analysis
- Export as CSV/JSON

### OrganizationOnboarding.tsx
**Route:** `/dashboard/organization/onboarding`
**Purpose:** Onboarding progress tracker
**Checklist:**
- Profile completion
- Contacts
- Photos/video
- Products
- QR code
- Verification
- Invites
- Posts

---

## Settings Pages

### Notifications.tsx
**Route:** `/dashboard/notifications`
**Purpose:** Notification inbox
**Features:**
- List with pagination
- Mark read/dismissed
- Filter by status

### NotificationSettings.tsx
**Route:** `/dashboard/settings/notifications`
**Purpose:** Notification preferences
**Settings:**
- Per-type muted/enabled
- Channel selection (push, email, in-app)

### LinkedAccounts.tsx
**Route:** `/settings/linked-accounts`
**Purpose:** Manage OAuth provider links

---

## Admin Pages (Platform Admin Only)

### AdminPanel.tsx
**Route:** `/admin`
**Purpose:** Admin control panel
**Sections:**
- User management (list, search, roles, block)
- Organization management (list, verify/reject, block)
- Subscription plan management
- Database explorer

### AdminDashboard.tsx
**Route:** `/dashboard/admin`
**Purpose:** Admin metrics dashboard
**Metrics:**
- Total organizations
- Verified/public counts
- Total products, QR codes, scans

### ModerationDashboard.tsx
**Route:** `/dashboard/moderation/organizations`
**Purpose:** Organization verification moderation
**Actions:**
- List pending/verified/rejected
- Verify or reject with comments
- Search and filter

### DatabaseExplorer.tsx
**Route:** `/admin/db`
**Purpose:** View and browse database tables
**Features:**
- List all tables
- View column info
- Browse data with pagination
- Create migration drafts
