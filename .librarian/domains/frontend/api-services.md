# Frontend API Services

> Last updated: 2026-01-18
> Domain: frontend
> Keywords: api, service, axios, http, client, fetch, request

## Overview

API service modules in `frontend/src/api/`. Use Axios with cookie-based auth.
All requests include `withCredentials: true` for session cookies.

---

## HTTP Client

### httpClient.ts
**Purpose:** Configured Axios instance

**Base URL Logic:**
- Development: `window.location.origin` (Vite proxy)
- Production: `VITE_BACKEND_URL` or `window.location.origin`

**Request Interceptor:**
- Detects public auth endpoints, skips token injection
- Fetches Supabase auth token for protected endpoints
- Injects Bearer token header

**Response Interceptor:**
- Logs responses and errors for debugging

---

## Auth Service

### authService.ts (~700 lines)
**Purpose:** Authentication and session management

**Session Functions:**
- `fetchSession()` - Get current session from backend
- `afterSignup()` - Post-signup profile completion
- `login()` - Email/password login (legacy)
- `startYandexLogin()` - OAuth redirect for Yandex

**Organization Functions:**
- `getOrganizationProfile(orgId)` - Fetch org profile
- `upsertOrganizationProfile(orgId, profile)` - Create/update
- `listOrganizationInvites(orgId)` - Team invitations
- `createOrganizationInvite(orgId, email, role)` - Send invite
- `acceptInvite(code)` - Join via invite
- `previewInvite(code)` - Preview invite details

**Public Organization Functions:**
- `fetchPublicOrganization(slug)` - Get by slug
- `fetchPublicOrganizationDetails(slug)` - Full details
- `searchPublicOrganizations(query, filters)` - Search

**QR Functions:**
- `listQrCodes(orgId)` - List QR codes
- `createQrCode(orgId, label)` - Create new
- `getQrCodeStats(orgId, qrId)` - Basic stats
- `getQrCodeDetailedStats(orgId, qrId)` - Geo/UTM breakdown
- `getQrOverview(orgId)` - Analytics dashboard data
- `exportQrData(orgId, qrId, format)` - Download CSV/JSON

**Product Functions:**
- `listProducts(orgId, status)` - List by org
- `createProduct(orgId, product)` - Create
- `updateProduct(orgId, productId, product)` - Update
- `archiveProduct(orgId, productId)` - Archive
- `fetchPublicOrganizationProducts(slug)` - Public list
- `fetchPublicProduct(slug)` - Single public product
- `getOrganizationSubscription(orgId)` - Plan + usage

**Notification Functions:**
- `listNotifications(cursor, limit)` - Paginated list
- `getUnreadNotificationsCount()` - Quick count
- `markNotificationRead(deliveryId)` - Mark read
- `dismissNotification(deliveryId)` - Dismiss
- `getNotificationSettings()` - User preferences
- `updateNotificationSettings(updates)` - Update prefs

**Admin Functions:**
- `listAllUsers(search, page)` - User list
- `updateUserRole(userId, role)` - Change role
- `blockUser(userId)` - Block user
- `listAllOrganizations(search, status, page)` - Org list
- `updateOrganizationStatus(orgId, status)` - Change status
- `blockOrganization(orgId)` - Block org
- `listSubscriptionPlans()` - Plans
- `createSubscriptionPlan(plan)` - Create plan
- `updateSubscriptionPlan(planId, plan)` - Update plan
- `getAdminDashboardSummary()` - Metrics
- `listDbTables()` - DB explorer
- `getDbTableColumns(table)` - Table schema
- `getDbTableRows(table, page)` - Table data
- `listAiIntegrations()` - AI providers
- `runAiIntegrationCheck(id)` - Test AI
- `listDevTasks()` - Dev tasks
- `createDevTask(task)` - Create task

**Moderation Functions:**
- `listModerationOrganizations()` - Pending orgs
- `verifyOrganizationStatus(orgId, status, comment)` - Approve/reject

---

## Posts Service

### postsService.ts
**Purpose:** Blog post management

**Organization Posts (Internal):**
- `listOrganizationPosts(orgId, status, search, limit, offset)` - List
- `getOrganizationPost(orgId, postId)` - Get single
- `createOrganizationPost(orgId, post)` - Create
- `updateOrganizationPost(orgId, postId, post)` - Update

**Public Posts:**
- `listPublicOrganizationPosts(slug, limit, offset)` - By slug
- `listPublicOrganizationPostsById(orgId, limit, offset)` - By ID
- `getPublicOrganizationPost(slug, postSlug)` - Single post

---

## Reviews Service

### reviewsService.ts
**Purpose:** Customer review management

**Organization Reviews (Internal):**
- `listOrganizationReviews(orgId, status, productId, limit, offset)` - List
- `getReviewStats(orgId)` - Rating distribution
- `moderateReview(orgId, reviewId, status, comment)` - Approve/reject
- `respondToReview(orgId, reviewId, response)` - Reply

**Public Reviews:**
- `listPublicOrganizationReviews(slug, order, limit, offset)` - Approved reviews
- `listPublicOrganizationReviewsById(orgId, order, limit, offset)` - By ID
- `createPublicReview(slug, review)` - Submit review

**Admin:**
- `listAllReviews(status, search, page)` - Global list
- `adminModerateReview(reviewId, status, comment)` - Global moderation

---

## Marketing Service

### marketingService.ts
**Purpose:** Marketing material management

**Templates:**
- `listMarketingTemplates()` - Available templates
- `getMarketingTemplate(templateId)` - Template details

**Materials:**
- `listMarketingMaterials(orgId)` - Org's materials
- `getMarketingMaterial(orgId, materialId)` - Single material
- `createMarketingMaterial(orgId, templateId, name)` - Create from template
- `updateMarketingMaterial(orgId, materialId, layout)` - Update layout
- `deleteMarketingMaterial(orgId, materialId)` - Delete

---

## API Patterns

### Standard Request
```typescript
export const getResource = async (id: string): Promise<ResourceType> => {
  const response = await httpClient.get(`/api/resources/${id}`);
  return response.data;
};
```

### With Error Handling
```typescript
export const createResource = async (data: CreateRequest): Promise<Resource> => {
  try {
    const response = await httpClient.post('/api/resources', data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || 'Request failed');
    }
    throw error;
  }
};
```

### With Query Parameters
```typescript
export const searchResources = async (
  query: string,
  filters: Filters
): Promise<Resource[]> => {
  const response = await httpClient.get('/api/resources/search', {
    params: { q: query, ...filters }
  });
  return response.data;
};
```
