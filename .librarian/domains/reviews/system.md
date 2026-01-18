# Review System

> Last updated: 2026-01-18
> Domain: reviews
> Keywords: review, rating, moderation, moderate, approve, reject, response, feedback

## Overview

Customer reviews with moderation workflow. Reviews require approval before
public visibility. Organizations can respond to reviews.

---

## Review Lifecycle

```
1. User submits review on public organization page
2. Review created with status='pending'
3. Notification sent to organization managers
4. Organization moderator reviews
5. Approve → status='approved', visible publicly
   OR Reject → status='rejected' with comment
6. Organization can add response (optional)
7. Author can edit pending reviews
8. Author can delete pending reviews
9. Managers can delete any review
```

---

## Database Table

### reviews
**File:** `supabase/migrations/0016_reviews_posts.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| organization_id | uuid | Target organization |
| product_id | uuid | Optional, specific product |
| author_user_id | uuid | Review author |
| rating | smallint | 1-5 stars, required |
| title | text | Optional |
| body | text | Review content, required |
| media | jsonb | [{type, url, thumbnail_url, alt}] |
| status | text | 'pending', 'approved', 'rejected' |
| moderated_by | uuid | Moderator user |
| moderated_at | timestamptz | |
| moderation_comment | text | Reason for rejection |
| response | text | Organization's response |
| response_by | uuid | Responder user |
| response_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Indexes:**
- `idx_reviews_org_status` - Organization + status filter
- `idx_reviews_product` - Product reviews
- `idx_reviews_author` - User's reviews
- `idx_reviews_created` - Chronological order

---

## Backend Service

### reviews.py
**File:** `backend/app/services/reviews.py`

**Organization Functions (Authenticated):**
```python
list_organization_reviews(org_id, user_id, status, product_id, limit, offset)
# List reviews with filters, requires org membership

get_review_stats(org_id)
# Returns: { total_reviews, average_rating, rating_distribution }

moderate_review(org_id, review_id, user_id, payload)
# Approve or reject with comment
# Requires manager+ role

respond_to_review(org_id, review_id, user_id, response_text)
# Add organization response
# Requires manager+ role

delete_review(org_id, review_id, user_id)
# Author can delete own pending
# Manager+ can delete any
```

**Public Functions:**
```python
list_public_organization_reviews(slug, product_slug, limit, offset, order)
# List approved reviews only
# order: 'newest' or 'highest_rating'

create_review(org_id, user_id, payload)
# Create new review (pending status)
# Emits notification to org managers
```

---

## API Endpoints

### Organization (Authenticated)
| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| GET | `/api/organizations/{org_id}/reviews` | List reviews | Member |
| GET | `/api/organizations/{org_id}/reviews/stats` | Rating stats | Member |
| PATCH | `/api/organizations/{org_id}/reviews/{id}/moderate` | Moderate | Manager+ |
| POST | `/api/organizations/{org_id}/reviews/{id}/respond` | Respond | Manager+ |
| DELETE | `/api/organizations/{org_id}/reviews/{id}` | Delete | Author/Manager+ |

### Public
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/public/organizations/by-slug/{slug}/reviews` | Approved reviews |
| GET | `/api/public/organizations/{org_id}/reviews` | Approved reviews by ID |
| POST | `/api/public/organizations/by-slug/{slug}/reviews` | Create review |
| POST | `/api/public/organizations/{org_id}/reviews` | Create review by ID |

---

## Frontend Pages

### OrganizationReviews.tsx
**Route:** `/dashboard/organization/reviews`
**Purpose:** Manage customer reviews
**Features:**
- List with status tabs (pending/approved/rejected)
- Moderation buttons (approve/reject)
- Response form
- Rating distribution chart
- Delete action

### CreateReview.tsx
**Route:** `/org/:id/review`
**Purpose:** Public review submission
**Fields:**
- Rating (1-5 stars, required)
- Title (optional)
- Body (required)
- Media upload (images/videos)
- Product selection (optional)

---

## Types

### Review Schema
```typescript
interface Review {
  id: string;
  organization_id: string;
  product_id: string | null;
  author_user_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string | null;
  body: string;
  media: ReviewMediaItem[];
  status: 'pending' | 'approved' | 'rejected';
  moderated_by: string | null;
  moderated_at: string | null;
  moderation_comment: string | null;
  response: string | null;
  response_by: string | null;
  response_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewMediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  alt?: string;
}
```

### Review Stats
```typescript
interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
```

---

## Moderation Workflow

### Approve
```json
{
  "status": "approved"
}
```

### Reject
```json
{
  "status": "rejected",
  "moderation_comment": "Review contains inappropriate content"
}
```

---

## Media Upload

Reviews support image and video attachments:
- Bucket: `review-media`
- Path: `reviews/{review_id}/{filename}`
- Max image size: 10MB
- Max video size: 3GB

**Utility:** `frontend/src/utils/mediaUploader.ts` → `uploadReviewMedia()`

---

## Notification Integration

When review is created, notification sent:
```python
emit_notification(
    NotificationEmitRequest(
        type_key='business.new_review',
        org_id=org_id,
        recipient_scope='organization',
        payload={
            'author_name': user.full_name,
            'rating': review.rating,
            'review_excerpt': review.body[:100]
        }
    ),
    actor_user_id=user_id
)
```

---

## RLS Policies

**Public read:** Approved reviews from public organizations
**Author read:** Authors see their own reviews (any status)
**Organization read:** Members see all reviews for their org
**Insert:** Any authenticated user
**Update (moderate):** Organization managers only
**Update (edit):** Authors can edit pending reviews
**Delete:** Authors can delete pending; managers can delete any
