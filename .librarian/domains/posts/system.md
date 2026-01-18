# Posts System

> Last updated: 2026-01-18
> Domain: posts
> Keywords: post, blog, news, article, content, publish, draft, editor

## Overview

Organization blog posts/news system with draft/published/archived lifecycle.
Supports rich content with galleries, videos, and pinned posts.

---

## Post Lifecycle

```
1. Editor creates post with status='draft'
2. Editor adds content: title, body (rich text), images, video
3. Editor sets slug for URL
4. When ready: status='published', published_at set
5. Published posts visible on public org page
6. Can archive later: status='archived'
7. Pinned posts appear first in listings
```

---

## Database Table

### organization_posts
**File:** `supabase/migrations/0016_reviews_posts.sql`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| organization_id | uuid | Owner organization |
| author_user_id | uuid | Post author |
| slug | text | URL identifier |
| title | text | Required |
| excerpt | text | Short summary |
| body | text | Full content (HTML/Markdown) |
| status | text | 'draft', 'published', 'archived' |
| main_image_url | text | Featured image |
| gallery | jsonb | [{url, alt, sort_order}] |
| video_url | text | Embedded video |
| published_at | timestamptz | When published |
| is_pinned | boolean | Featured at top |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraint:** UNIQUE(organization_id, slug)

**Indexes:**
- `idx_organization_posts_org_status` - Org + status filter
- `idx_organization_posts_published` - Published posts only

---

## Backend Service

### posts.py
**File:** `backend/app/services/posts.py`

**Organization Functions:**
```python
list_organization_posts(org_id, user_id, status, search, limit, offset)
# List posts with filters
# Requires org membership

get_organization_post(org_id, post_id, user_id)
# Get single post
# Requires org membership

create_organization_post(org_id, user_id, payload)
# Create new post
# Requires editor+ role

update_organization_post(org_id, post_id, user_id, payload)
# Update post, checks slug uniqueness
# Requires editor+ role

delete_organization_post(org_id, post_id, user_id)
# Delete post
# Requires editor+ role
```

**Public Functions:**
```python
list_public_organization_posts(slug, limit, offset)
# List published posts for public org page

get_public_organization_post(slug, post_slug)
# Get single published post by slug
```

---

## API Endpoints

### Organization (Authenticated)
| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| GET | `/api/organizations/{org_id}/posts` | List posts | Member |
| POST | `/api/organizations/{org_id}/posts` | Create post | Editor+ |
| GET | `/api/organizations/{org_id}/posts/{post_id}` | Get post | Member |
| PATCH | `/api/organizations/{org_id}/posts/{post_id}` | Update post | Editor+ |
| DELETE | `/api/organizations/{org_id}/posts/{post_id}` | Delete post | Editor+ |

### Public
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/public/organizations/by-slug/{slug}/posts` | Published posts |
| GET | `/api/public/organizations/{org_id}/posts` | Published posts by ID |
| GET | `/api/public/organizations/by-slug/{slug}/posts/{post_slug}` | Single post |

---

## Frontend Pages

### OrganizationPosts.tsx
**Route:** `/dashboard/organization/posts`
**Purpose:** Post list management
**Features:**
- List with status tabs
- Search functionality
- Create new button
- Edit/delete actions

### OrganizationPostEdit.tsx
**Routes:**
- `/dashboard/organization/posts/new` - Create
- `/dashboard/organization/posts/:postId` - Edit

**Features:**
- Slug field (URL identifier)
- Title field
- Excerpt (short summary)
- Body (rich text editor)
- Main image upload
- Gallery management
- Video URL field
- Pin toggle
- Status selector (draft/published/archived)

### PublicOrganizationPosts.tsx
**Route:** `/org/:slug/posts`
**Purpose:** Public posts listing for organization

---

## Types

### Post Schema
```typescript
interface OrganizationPost {
  id: string;
  organization_id: string;
  author_user_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  status: 'draft' | 'published' | 'archived';
  main_image_url: string | null;
  gallery: GalleryItem[];
  video_url: string | null;
  published_at: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface GalleryItem {
  url: string;
  alt?: string;
  sort_order?: number;
}
```

### Create/Update Request
```typescript
interface OrganizationPostCreate {
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  status?: 'draft' | 'published' | 'archived';
  main_image_url?: string;
  gallery?: GalleryItem[];
  video_url?: string;
  is_pinned?: boolean;
}
```

---

## Rich Text Editor

### RichTextEditor.tsx
**File:** `frontend/src/components/RichTextEditor.tsx`
**Purpose:** WYSIWYG editor for post body

**Features:**
- Bold, italic, underline
- Headings (H1, H2, H3)
- Lists (ordered, unordered)
- Links
- Blockquotes
- Code blocks

---

## Media Management

### Main Image
- Bucket: `org-media`
- Path: `posts/{org_id}/{post_id}/main.{ext}`
- Upload: `uploadPostImage()`

### Gallery Images
- Bucket: `org-media`
- Path: `posts/{org_id}/{post_id}/gallery/{filename}`
- Stored as JSON array with sort_order

### Video
- External URL (YouTube, Vimeo, etc.)
- Embedded in post display

---

## Slug Handling

Slugs must be unique within organization:
- Generated from title (slugify)
- Can be manually edited
- Checked on create/update
- Error if duplicate exists

**Example URL:**
```
/org/my-company/posts/introducing-new-product-line
```

---

## RLS Policies

**Public read:** Published posts from public organizations
**Internal read:** All posts for organization members
**Write/Update/Delete:** Editor+ roles only
