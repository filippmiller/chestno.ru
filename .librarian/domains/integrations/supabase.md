# Supabase Integration

> Last updated: 2026-01-18
> Domain: integrations
> Keywords: supabase, database, storage, auth, bucket, rls, policy

## Overview

Supabase provides PostgreSQL database, authentication, and storage for the platform.
All tables use Row Level Security (RLS) for access control.

---

## Services Used

### PostgreSQL Database
- Managed PostgreSQL with auto-backups
- Accessed via psycopg (Python) with connection pooling
- All queries use parameterized SQL

### Supabase Auth
- Handles email/password registration and login
- OAuth providers (Google, Yandex)
- Email confirmation and password reset
- JWT tokens for API access

### Supabase Storage
- File storage with buckets
- Public and private access control
- Image and video uploads

---

## Configuration

### Environment Variables
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://...
```

### Backend Config
**File:** `backend/app/core/config.py`
```python
supabase_url: str
supabase_anon_key: str
supabase_service_role_key: str
supabase_jwt_secret: str
database_url: str
```

### Frontend Config
**File:** `.env` or `frontend/src/lib/supabaseClient.ts`
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## Storage Buckets

### org-media
**Purpose:** Organization content (profiles, posts, products)
**Access:** Public read, authenticated write

**Paths:**
- `profiles/{org_id}/main.{ext}` - Main profile image
- `profiles/{org_id}/gallery/{filename}` - Profile gallery
- `profiles/{org_id}/video.{ext}` - Profile video
- `posts/{org_id}/{post_id}/main.{ext}` - Post images
- `products/{org_id}/{product_id}/main.{ext}` - Product images
- `products/{org_id}/{product_id}/gallery/{filename}` - Product gallery

### review-media
**Purpose:** Customer review attachments
**Access:** Public read, authenticated write

**Paths:**
- `reviews/{review_id}/{filename}` - Review images/videos

---

## Database Connection

### Connection Pool
**File:** `backend/app/core/db.py`

```python
from psycopg_pool import AsyncConnectionPool

pool = AsyncConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=8,
    timeout=10
)

async def get_connection():
    async with pool.connection() as conn:
        yield conn
```

### Usage Pattern
```python
from app.core.db import get_connection

async def get_data():
    async with get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT * FROM table WHERE id = %s", (id,))
            return await cur.fetchone()
```

---

## Row Level Security (RLS)

All tables have RLS enabled with policies like:

### User Data
```sql
CREATE POLICY "Users can view own profile"
ON app_users FOR SELECT
USING (auth.uid() = id);
```

### Organization Data
```sql
CREATE POLICY "Members can view org data"
ON organizations FOR SELECT
USING (
    id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
    )
);
```

### Public Data
```sql
CREATE POLICY "Public can view published products"
ON products FOR SELECT
USING (
    status = 'published'
    AND organization_id IN (
        SELECT id FROM organizations
        WHERE public_visible = true
    )
);
```

---

## Auth Integration

### Supabase Auth Client
**File:** `backend/app/core/supabase.py`

```python
from supabase import create_client

supabase = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key  # Service role for admin operations
)
```

### Token Verification
```python
from jose import jwt

def verify_token(token: str):
    payload = jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated"
    )
    return payload
```

### Frontend Auth
**File:** `frontend/src/lib/supabaseClient.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

---

## Media Upload Utility

### Frontend Helper
**File:** `frontend/src/utils/mediaUploader.ts`

```typescript
export async function uploadFile(
    bucket: string,
    path: string,
    file: File,
    cacheControl?: string
): Promise<string> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
            cacheControl: cacheControl || '3600',
            upsert: true
        });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return publicUrl;
}
```

---

## File Validation

### Images
- Max size: 10MB
- Types: image/jpeg, image/png, image/gif, image/webp

### Videos
- Max size: 3GB
- Types: video/mp4, video/webm, video/quicktime

```typescript
export function validateImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    return validTypes.includes(file.type) && file.size <= maxSize;
}
```

---

## Migrations

**Location:** `supabase/migrations/`

Migrations are numbered SQL files applied in order:
- `0001_initial.sql` - Core tables
- `0002_org_profiles.sql` - Organization profiles
- ...
- `0023_marketing_materials.sql` - Marketing system

**Apply Script:** `scripts/apply_migrations.ps1`

---

## Health Check

**Endpoint:** `GET /api/health/supabase`

Verifies Supabase connectivity:
1. Tests database connection
2. Tests storage access
3. Returns status and latency
