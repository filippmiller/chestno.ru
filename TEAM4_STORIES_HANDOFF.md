# TEAM 4: STORIES MVP HANDOFF

**Start Date:** Day 1 (database work) OR when Team 3 Phase 3 complete (API work)
**Duration:** 2 weeks (80 hours)
**Team Size:** 1 developer (Week 1 backend, Week 2 frontend)
**Status:** Database work can start immediately, API needs Payments Phase 3

---

## 🚨 PARTIAL START ALLOWED

**You can start NOW (no blockers):**
- ✅ Days 1-2: Database migrations and seed data
- ✅ Days 3-4: Backend schemas and services (partial)

**MUST WAIT for Payments Phase 3:**
- ⏸️ Day 5: API routes with subscription feature gating
- ⏸️ Week 2: Full Stories MVP frontend

---

## 📋 PREREQUISITES CHECKLIST

**Before starting API work (Day 5):**
- [ ] ✅ Payments Phase 3 complete
- [ ] ✅ `can_create_story(user_id, org_id)` function available
- [ ] ✅ Subscription service has active check

**Before starting database work (Day 1):**
- [ ] ✅ Supabase Storage buckets created:
  - `stories-videos` (100MB limit)
  - `stories-images` (10MB limit)
- [ ] ✅ FFmpeg installed on development machine

---

## 🛠️ SETUP (DO THIS FIRST)

### **1. Verify Supabase Storage**

```bash
# Check if buckets exist
npx supabase storage list

# If not exist, create:
npx supabase storage create stories-videos --public false
npx supabase storage create stories-images --public false
```

**Set Storage Policies:**
```sql
-- Allow authenticated users to upload to their org's folder
CREATE POLICY "Org members can upload stories media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('stories-videos', 'stories-images')
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Allow public read for published stories
CREATE POLICY "Public can view published stories media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('stories-videos', 'stories-images'));
```

### **2. Verify FFmpeg**

```bash
# Check FFmpeg installed
ffmpeg -version
ffprobe -version

# If not installed:
# Windows: choco install ffmpeg
# Mac: brew install ffmpeg
# Linux: apt-get install ffmpeg
```

### **3. Install Python Dependencies**

```bash
cd backend
pip install ffmpeg-python pillow
pip freeze | grep -E "ffmpeg|pillow" >> requirements.txt
```

---

## 🎯 YOUR TASKS (2 WEEKS)

### **WEEK 1: BACKEND (40 hours, 5 days)**

#### **DAY 1-2: Database Foundation (12 hours)**

**Goal:** Create tables and seed data

**Tasks:**

1. **Create migration file:**
   ```bash
   # File: supabase/migrations/0032_stories.sql
   ```

2. **Create stories table:**
   ```sql
   CREATE TYPE story_type AS ENUM (
     'origin',      -- Where things come from
     'process',     -- How things are made
     'people',      -- Who's behind the work
     'failure',     -- Things that went wrong
     'update',      -- News and updates
     'daily',       -- Daily life of business
     'milestone',   -- Achievements
     'response'     -- Responses to feedback
   );

   CREATE TYPE content_origin AS ENUM (
     'self_declared',        -- Producer created
     'platform_assisted',    -- Platform helped create
     'platform_curated',     -- Platform organized content
     'community_sourced'     -- From community input
   );

   CREATE TYPE story_status AS ENUM (
     'incoming',            -- From Telegram bot (v1)
     'draft',               -- Work in progress
     'pending_moderation',  -- Submitted for review
     'published',           -- Live on platform
     'archived'             -- Removed from public view
   );

   CREATE TABLE stories (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
     author_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

     -- Content
     story_type story_type NOT NULL,
     title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
     subtitle TEXT CHECK (length(subtitle) <= 300),
     body TEXT CHECK (length(body) <= 10000),
     gallery JSONB,  -- [{type: 'photo'|'video', url: string, thumbnail_url?: string, sort_order: int}]

     -- Metadata
     source TEXT DEFAULT 'web' CHECK (source IN ('web', 'telegram_bot', 'api')),
     content_origin content_origin NOT NULL DEFAULT 'self_declared',
     status story_status NOT NULL DEFAULT 'draft',

     -- Publishing
     published_at TIMESTAMPTZ,
     featured_until TIMESTAMPTZ,
     featured_priority INT DEFAULT 0,

     -- Moderation
     submitted_for_moderation_at TIMESTAMPTZ,
     moderated_by UUID REFERENCES app_users(id),
     moderated_at TIMESTAMPTZ,
     moderation_notes TEXT,
     rejection_reason TEXT,

     -- Telegram integration (v1)
     telegram_message_id TEXT,
     raw_content JSONB,

     -- Analytics
     view_count INT DEFAULT 0,
     unique_view_count INT DEFAULT 0,

     -- Timestamps
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );

   CREATE INDEX idx_stories_organization ON stories(organization_id);
   CREATE INDEX idx_stories_author ON stories(author_user_id);
   CREATE INDEX idx_stories_status ON stories(status);
   CREATE INDEX idx_stories_type ON stories(story_type);
   CREATE INDEX idx_stories_published ON stories(published_at DESC) WHERE status = 'published';
   CREATE INDEX idx_stories_featured ON stories(featured_until DESC) WHERE featured_until > now();
   ```

3. **Create story_views table:**
   ```sql
   CREATE TABLE story_views (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
     viewer_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,  -- Null if anonymous
     viewer_session_id TEXT,
     referrer TEXT,
     device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
     viewed_at TIMESTAMPTZ DEFAULT now()
   );

   CREATE INDEX idx_story_views_story ON story_views(story_id);
   CREATE INDEX idx_story_views_viewer ON story_views(viewer_user_id);
   CREATE INDEX idx_story_views_session ON story_views(viewer_session_id);
   CREATE INDEX idx_story_views_timestamp ON story_views(viewed_at DESC);
   ```

4. **Create story_activity_log table:**
   ```sql
   CREATE TABLE story_activity_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
     action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'submitted', 'approved', 'rejected', 'published', 'unpublished', 'archived')),
     performed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
     notes TEXT,
     metadata JSONB,
     occurred_at TIMESTAMPTZ DEFAULT now()
   );

   CREATE INDEX idx_story_activity_story ON story_activity_log(story_id);
   CREATE INDEX idx_story_activity_timestamp ON story_activity_log(occurred_at DESC);
   ```

5. **Add RLS policies:**
   ```sql
   ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
   ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
   ALTER TABLE story_activity_log ENABLE ROW LEVEL SECURITY;

   -- Public can view published stories
   CREATE POLICY "Public can view published stories"
   ON stories FOR SELECT
   TO public
   USING (status = 'published');

   -- Org members can view their org's stories
   CREATE POLICY "Org members can view their stories"
   ON stories FOR SELECT
   TO authenticated
   USING (
     organization_id IN (
       SELECT organization_id FROM organization_members
       WHERE user_id = auth.uid() AND status = 'active'
     )
   );

   -- Org editors can create stories
   CREATE POLICY "Org editors can create stories"
   ON stories FOR INSERT
   TO authenticated
   WITH CHECK (
     organization_id IN (
       SELECT organization_id FROM organization_members
       WHERE user_id = auth.uid()
         AND role IN ('owner', 'admin', 'manager', 'editor')
         AND status = 'active'
     )
   );

   -- Org editors can update their org's draft/rejected stories
   CREATE POLICY "Org editors can update draft stories"
   ON stories FOR UPDATE
   TO authenticated
   USING (
     organization_id IN (
       SELECT organization_id FROM organization_members
       WHERE user_id = auth.uid()
         AND role IN ('owner', 'admin', 'manager', 'editor')
         AND status = 'active'
     )
     AND status IN ('draft', 'incoming')
   );

   -- Platform admins can do everything
   CREATE POLICY "Platform admins full access to stories"
   ON stories FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM app_users
       WHERE id = auth.uid() AND role = 'platform_admin'
     )
   );
   ```

6. **Create seed data:**
   ```sql
   -- File: supabase/seed_stories.sql

   -- Create 3-5 test organizations (if not exist)
   -- Create 10-15 test stories with different types and statuses

   INSERT INTO stories (organization_id, author_user_id, story_type, title, body, status, published_at) VALUES
   ('<org1_id>', '<user1_id>', 'origin', 'Откуда берётся наш кофе', 'Мы работаем напрямую с фермерами...', 'published', now() - interval '7 days'),
   ('<org1_id>', '<user1_id>', 'process', 'Как мы обжариваем зёрна', 'Процесс обжарки начинается...', 'published', now() - interval '5 days'),
   ('<org1_id>', '<user1_id>', 'people', 'Знакомьтесь: наш главный бариста', 'Иван работает с нами...', 'published', now() - interval '3 days'),
   ('<org1_id>', '<user1_id>', 'daily', 'Обновление: новая обжарка', 'Сегодня получили...', 'pending_moderation', null),
   ('<org2_id>', '<user2_id>', 'milestone', 'Нам 5 лет!', 'Сегодня наша пекарня отмечает...', 'published', now() - interval '2 days');
   ```

7. **Test migration:**
   ```bash
   npx supabase db reset
   npx supabase db push
   psql -c "SELECT COUNT(*) FROM stories;"
   ```

**Deliverables:**
- Migration file created and tested
- All 3 tables exist
- RLS policies working
- Seed data inserted

---

#### **DAY 3-4: Backend Schemas & Services (16 hours)**

**Goal:** Implement business logic layer

**Tasks:**

1. **Create Pydantic schemas:**
   ```python
   # File: backend/app/schemas/stories.py

   from pydantic import BaseModel, Field
   from typing import Optional, Literal, List
   from datetime import datetime
   from enum import Enum

   class StoryType(str, Enum):
       origin = "origin"
       process = "process"
       people = "people"
       failure = "failure"
       update = "update"
       daily = "daily"
       milestone = "milestone"
       response = "response"

   class ContentOrigin(str, Enum):
       self_declared = "self_declared"
       platform_assisted = "platform_assisted"
       platform_curated = "platform_curated"
       community_sourced = "community_sourced"

   class StoryStatus(str, Enum):
       incoming = "incoming"
       draft = "draft"
       pending_moderation = "pending_moderation"
       published = "published"
       archived = "archived"

   class GalleryItem(BaseModel):
       type: Literal['photo', 'video']
       url: str
       thumbnail_url: Optional[str] = None
       sort_order: int = 0

   class StoryBase(BaseModel):
       story_type: StoryType
       title: str = Field(..., min_length=3, max_length=200)
       subtitle: Optional[str] = Field(None, max_length=300)
       body: Optional[str] = Field(None, max_length=10000)
       gallery: Optional[List[GalleryItem]] = None
       content_origin: ContentOrigin = ContentOrigin.self_declared

   class StoryCreate(StoryBase):
       organization_id: str

   class StoryUpdate(BaseModel):
       story_type: Optional[StoryType] = None
       title: Optional[str] = Field(None, min_length=3, max_length=200)
       subtitle: Optional[str] = Field(None, max_length=300)
       body: Optional[str] = Field(None, max_length=10000)
       gallery: Optional[List[GalleryItem]] = None

   class StoryResponse(StoryBase):
       id: str
       organization_id: str
       author_user_id: str
       status: StoryStatus
       source: str
       view_count: int
       unique_view_count: int
       published_at: Optional[datetime] = None
       created_at: datetime
       updated_at: datetime

       class Config:
           from_attributes = True
   ```

2. **Create StoriesService:**
   ```python
   # File: backend/app/services/stories_service.py

   class StoriesService:

       @staticmethod
       async def create_story(
           organization_id: str,
           author_user_id: str,
           data: StoryCreate
       ) -> dict:
           """
           Create new story.

           Validates:
           - User is org member with editor+ role
           - Organization has active subscription (via can_create_story)
           """
           # Verify permissions
           if not await StoryPermissions.can_create(author_user_id, organization_id):
               raise HTTPException(403, "No permission to create stories")

           # Check subscription (NEEDS PAYMENTS PHASE 3)
           # if not can_create_story(author_user_id, organization_id):
           #     raise HTTPException(403, "Active subscription required")

           # Create story
           story = await db.fetch_one("""
               INSERT INTO stories (
                   organization_id, author_user_id, story_type,
                   title, subtitle, body, gallery, content_origin,
                   status, source
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'web')
               RETURNING *
           """, organization_id, author_user_id, data.story_type,
                data.title, data.subtitle, data.body,
                json.dumps([item.dict() for item in data.gallery]) if data.gallery else None,
                data.content_origin)

           # Log activity
           await log_story_activity(story['id'], 'created', author_user_id)

           return story

       @staticmethod
       async def get_story(story_id: str, user_id: str = None) -> dict:
           """Get story by ID."""
           story = await db.fetch_one("SELECT * FROM stories WHERE id = $1", story_id)
           if not story:
               raise HTTPException(404, "Story not found")

           # Check permissions
           if story['status'] != 'published':
               if not user_id or not await StoryPermissions.can_view(user_id, story):
                   raise HTTPException(403, "No permission to view this story")

           return story

       @staticmethod
       async def get_stories(
           organization_id: str = None,
           status: StoryStatus = None,
           story_type: StoryType = None,
           limit: int = 20,
           offset: int = 0,
           user_id: str = None
       ) -> List[dict]:
           """Get stories with filters."""
           # Build query with filters
           # Apply RLS
           # Return paginated results
           pass

       @staticmethod
       async def update_story(
           story_id: str,
           user_id: str,
           data: StoryUpdate
       ) -> dict:
           """Update story."""
           story = await get_story(story_id, user_id)

           if not await StoryPermissions.can_edit(user_id, story):
               raise HTTPException(403, "No permission to edit this story")

           # Only allow editing draft/incoming stories
           if story['status'] not in ['draft', 'incoming']:
               raise HTTPException(400, "Can only edit draft stories")

           # Update
           updated = await db.fetch_one("""
               UPDATE stories SET
                   story_type = COALESCE($1, story_type),
                   title = COALESCE($2, title),
                   subtitle = COALESCE($3, subtitle),
                   body = COALESCE($4, body),
                   gallery = COALESCE($5, gallery),
                   updated_at = now()
               WHERE id = $6
               RETURNING *
           """, data.story_type, data.title, data.subtitle, data.body,
                json.dumps([item.dict() for item in data.gallery]) if data.gallery else None,
                story_id)

           await log_story_activity(story_id, 'updated', user_id)

           return updated

       @staticmethod
       async def delete_story(story_id: str, user_id: str):
           """Delete story."""
           story = await get_story(story_id, user_id)

           if not await StoryPermissions.can_delete(user_id, story):
               raise HTTPException(403, "No permission to delete this story")

           await db.execute("DELETE FROM stories WHERE id = $1", story_id)

       @staticmethod
       async def submit_for_moderation(story_id: str, user_id: str) -> dict:
           """Submit story for moderation."""
           story = await get_story(story_id, user_id)

           if story['status'] not in ['draft', 'incoming']:
               raise HTTPException(400, "Can only submit draft stories")

           updated = await db.fetch_one("""
               UPDATE stories SET
                   status = 'pending_moderation',
                   submitted_for_moderation_at = now(),
                   updated_at = now()
               WHERE id = $1
               RETURNING *
           """, story_id)

           await log_story_activity(story_id, 'submitted', user_id)

           # Notify moderators
           await notify_moderators_new_story(story_id)

           return updated
   ```

3. **Create ModerationService:**
   ```python
   # File: backend/app/services/moderation_service.py

   class ModerationService:

       @staticmethod
       async def get_pending_stories(
           limit: int = 50,
           offset: int = 0
       ) -> List[dict]:
           """Get stories pending moderation."""
           stories = await db.fetch_all("""
               SELECT s.*, o.name as org_name, u.email as author_email
               FROM stories s
               JOIN organizations o ON s.organization_id = o.id
               JOIN app_users u ON s.author_user_id = u.id
               WHERE s.status = 'pending_moderation'
               ORDER BY s.submitted_for_moderation_at ASC
               LIMIT $1 OFFSET $2
           """, limit, offset)

           return stories

       @staticmethod
       async def approve_story(
           story_id: str,
           moderator_user_id: str,
           notes: str = None
       ) -> dict:
           """Approve story and publish."""
           story = await db.fetch_one("SELECT * FROM stories WHERE id = $1", story_id)

           if story['status'] != 'pending_moderation':
               raise HTTPException(400, "Story is not pending moderation")

           updated = await db.fetch_one("""
               UPDATE stories SET
                   status = 'published',
                   published_at = now(),
                   moderated_by = $1,
                   moderated_at = now(),
                   moderation_notes = $2,
                   updated_at = now()
               WHERE id = $3
               RETURNING *
           """, moderator_user_id, notes, story_id)

           await log_story_activity(story_id, 'approved', moderator_user_id, notes)
           await notify_producer_story_approved(story_id)

           return updated

       @staticmethod
       async def reject_story(
           story_id: str,
           moderator_user_id: str,
           reason: str
       ) -> dict:
           """Reject story."""
           story = await db.fetch_one("SELECT * FROM stories WHERE id = $1", story_id)

           if story['status'] != 'pending_moderation':
               raise HTTPException(400, "Story is not pending moderation")

           updated = await db.fetch_one("""
               UPDATE stories SET
                   status = 'draft',
                   moderated_by = $1,
                   moderated_at = now(),
                   rejection_reason = $2,
                   updated_at = now()
               WHERE id = $3
               RETURNING *
           """, moderator_user_id, reason, story_id)

           await log_story_activity(story_id, 'rejected', moderator_user_id, reason)
           await notify_producer_story_rejected(story_id, reason)

           return updated
   ```

4. **Create VideoService:**
   ```python
   # File: backend/app/services/video_service.py

   import ffmpeg
   from PIL import Image
   import io

   class VideoService:

       MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB

       @staticmethod
       async def upload_video(
           file: UploadFile,
           organization_id: str
       ) -> dict:
           """
           Upload video to Supabase Storage.

           Validates:
           - Size <= 100MB
           - Format: MP4, MOV, AVI
           - Duration <= 5 minutes
           """
           # Validate size
           file_bytes = await file.read()
           if len(file_bytes) > VideoService.MAX_VIDEO_SIZE:
               raise HTTPException(400, "Video exceeds 100MB limit")

           # Validate format
           # Extract metadata with ffprobe
           # Generate thumbnail
           # Upload to Supabase Storage bucket stories-videos
           # Return URL
           pass

       @staticmethod
       def extract_metadata(video_bytes: bytes) -> dict:
           """Extract video duration, resolution, codec."""
           probe = ffmpeg.probe(io.BytesIO(video_bytes))
           video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')

           return {
               'duration': float(probe['format']['duration']),
               'width': int(video_info['width']),
               'height': int(video_info['height']),
               'codec': video_info['codec_name']
           }

       @staticmethod
       def generate_thumbnail(video_bytes: bytes) -> bytes:
           """Generate thumbnail from first frame."""
           # Use ffmpeg to extract frame at 1 second
           # Resize to 400x300
           # Return JPEG bytes
           pass

       @staticmethod
       def validate_video(video_bytes: bytes) -> bool:
           """Validate video format and duration."""
           try:
               metadata = VideoService.extract_metadata(video_bytes)
               if metadata['duration'] > 300:  # 5 minutes
                   return False
               return True
           except Exception:
               return False
   ```

5. **Create StoryPermissions:**
   ```python
   # File: backend/app/services/story_permissions.py

   class StoryPermissions:

       EDITOR_ROLES = ['owner', 'admin', 'manager', 'editor']

       @staticmethod
       async def can_create(user_id: str, organization_id: str) -> bool:
           """Check if user can create stories."""
           member = await db.fetch_one("""
               SELECT role FROM organization_members
               WHERE user_id = $1 AND organization_id = $2 AND status = 'active'
           """, user_id, organization_id)

           return member and member['role'] in StoryPermissions.EDITOR_ROLES

       @staticmethod
       async def can_edit(user_id: str, story: dict) -> bool:
           """Check if user can edit story."""
           # Author can edit their own draft stories
           if story['author_user_id'] == user_id and story['status'] in ['draft', 'incoming']:
               return True

           # Org admins can edit
           member = await db.fetch_one("""
               SELECT role FROM organization_members
               WHERE user_id = $1 AND organization_id = $2 AND status = 'active'
           """, user_id, story['organization_id'])

           return member and member['role'] in ['owner', 'admin', 'manager']

       @staticmethod
       async def can_delete(user_id: str, story: dict) -> bool:
           """Check if user can delete story."""
           # Similar to can_edit
           pass

       @staticmethod
       async def can_view(user_id: str, story: dict) -> bool:
           """Check if user can view non-published story."""
           # Org members can view their org's stories
           member = await db.fetch_one("""
               SELECT 1 FROM organization_members
               WHERE user_id = $1 AND organization_id = $2 AND status = 'active'
           """, user_id, story['organization_id'])

           return member is not None
   ```

**Deliverables:**
- All schemas defined
- All services implemented
- Permission checks working
- Video upload/validation ready

---

#### **DAY 5: API Routes (8 hours)**

**⚠️ WAIT FOR PAYMENTS PHASE 3 BEFORE STARTING**

**Goal:** Expose HTTP API

**Tasks:**

1. **Create API router:**
   ```python
   # File: backend/app/api/routes/stories.py

   from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
   from app.core.session_deps import get_current_user_id_from_session
   from app.services.stories_service import StoriesService
   from app.services.video_service import VideoService
   from app.schemas.stories import StoryCreate, StoryUpdate, StoryResponse

   router = APIRouter(prefix="/stories", tags=["stories"])

   @router.get('/', response_model=List[StoryResponse])
   async def get_stories(
       organization_id: str = None,
       status: StoryStatus = None,
       story_type: StoryType = None,
       limit: int = Query(20, le=100),
       offset: int = Query(0, ge=0),
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Get stories with filters."""
       stories = await StoriesService.get_stories(
           organization_id=organization_id,
           status=status,
           story_type=story_type,
           limit=limit,
           offset=offset,
           user_id=current_user_id
       )
       return stories

   @router.get('/{story_id}', response_model=StoryResponse)
   async def get_story(
       story_id: str,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Get story by ID."""
       story = await StoriesService.get_story(story_id, current_user_id)
       return story

   @router.post('/', response_model=StoryResponse, status_code=201)
   async def create_story(
       data: StoryCreate,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Create new story."""
       story = await StoriesService.create_story(
           organization_id=data.organization_id,
           author_user_id=current_user_id,
           data=data
       )
       return story

   @router.patch('/{story_id}', response_model=StoryResponse)
   async def update_story(
       story_id: str,
       data: StoryUpdate,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Update story."""
       story = await StoriesService.update_story(story_id, current_user_id, data)
       return story

   @router.delete('/{story_id}', status_code=204)
   async def delete_story(
       story_id: str,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Delete story."""
       await StoriesService.delete_story(story_id, current_user_id)

   @router.post('/{story_id}/submit', response_model=StoryResponse)
   async def submit_for_moderation(
       story_id: str,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Submit story for moderation."""
       story = await StoriesService.submit_for_moderation(story_id, current_user_id)
       return story

   @router.post('/{story_id}/view')
   async def record_view(
       story_id: str,
       referrer: str = None,
       device_type: str = None,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Record story view for analytics."""
       # Create view record
       # Increment view counters
       pass

   @router.get('/{story_id}/analytics')
   async def get_analytics(
       story_id: str,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Get story analytics."""
       # Return view counts, referrers, devices
       pass

   @router.post('/upload-video')
   async def upload_video(
       file: UploadFile = File(...),
       organization_id: str = Form(...),
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Upload video file."""
       result = await VideoService.upload_video(file, organization_id)
       return result

   @router.post('/upload-image')
   async def upload_image(
       file: UploadFile = File(...),
       organization_id: str = Form(...),
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Upload image file."""
       # Similar to upload_video but simpler
       pass
   ```

2. **Create admin moderation router:**
   ```python
   # File: backend/app/api/routes/admin/stories_moderation.py

   from app.services.moderation_service import ModerationService

   router = APIRouter(prefix="/admin/stories", tags=["admin-moderation"])

   @router.get('/pending')
   async def get_pending_stories(
       limit: int = Query(50, le=100),
       offset: int = Query(0, ge=0),
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Get stories pending moderation."""
       # Verify platform_admin role
       assert_platform_admin(current_user_id)

       stories = await ModerationService.get_pending_stories(limit, offset)
       return {"stories": stories}

   @router.post('/{story_id}/approve')
   async def approve_story(
       story_id: str,
       notes: str = None,
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Approve story."""
       assert_platform_admin(current_user_id)

       story = await ModerationService.approve_story(story_id, current_user_id, notes)
       return story

   @router.post('/{story_id}/reject')
   async def reject_story(
       story_id: str,
       reason: str = Body(..., embed=True),
       current_user_id: str = Depends(get_current_user_id_from_session)
   ):
       """Reject story."""
       assert_platform_admin(current_user_id)

       story = await ModerationService.reject_story(story_id, current_user_id, reason)
       return story
   ```

3. **Register routers:**
   ```python
   # File: backend/app/main.py

   from app.api.routes import stories
   from app.api.routes.admin import stories_moderation

   app.include_router(stories.router, prefix="/api")
   app.include_router(stories_moderation.router, prefix="/api")
   ```

4. **Unit tests:**
   ```python
   # File: backend/tests/test_stories_service.py

   @pytest.mark.asyncio
   async def test_create_story():
       story = await StoriesService.create_story(
           organization_id=test_org_id,
           author_user_id=test_user_id,
           data=StoryCreate(
               story_type='origin',
               title='Test Story',
               body='Test body',
               content_origin='self_declared'
           )
       )

       assert story['id'] is not None
       assert story['status'] == 'draft'
   ```

**Deliverables:**
- All API endpoints implemented
- Unit tests passing
- Integration with Payments subscription check

---

### **WEEK 2: FRONTEND (40 hours, 5 days)**

**Full frontend implementation details in:** `IMPL_Stories_v1.md Phase 1 Week 2-3`

**Summary:**
- Day 1-2: Core components (StoryCard, StoryPlayer, ContentOriginBadge, StoryTypeIcon, StoryCreationWizard)
- Day 3: Public pages (Organization Stories tab, Story detail page)
- Day 4: Producer dashboard (Stories list, Create page, Edit page)
- Day 5: Admin moderation dashboard, Mobile responsive

---

## 📁 FILES YOU'LL CREATE/MODIFY

**New Files:**
```
supabase/migrations/0032_stories.sql
supabase/seed_stories.sql
backend/app/schemas/stories.py
backend/app/services/stories_service.py
backend/app/services/moderation_service.py
backend/app/services/video_service.py
backend/app/services/story_permissions.py
backend/app/api/routes/stories.py
backend/app/api/routes/admin/stories_moderation.py
backend/tests/test_stories_service.py
backend/tests/test_moderation_service.py

(Week 2: Frontend files - see IMPL_Stories_v1.md)
```

---

## 🚀 READY TO START PROMPT (DATABASE ONLY - Day 1)

**Copy this into PowerShell to start database work:**

```powershell
Stories MVP database foundation (Day 1-2 only). Tasks: Create migration 0032_stories.sql with stories table (story_type enum [origin, process, people, failure, update, daily, milestone, response], content_origin enum [self_declared, platform_assisted, platform_curated, community_sourced], story_status enum [incoming, draft, pending_moderation, published, archived], columns: organization_id, author_user_id, title 3-200 chars, subtitle max 300, body max 10000, gallery JSONB array, source web/telegram_bot/api, published_at, featured_until, moderated_by, telegram_message_id, view_count, created_at, updated_at), create story_views table (story_id, viewer_user_id nullable, viewer_session_id, referrer, device_type mobile/tablet/desktop, viewed_at), create story_activity_log table (story_id, action enum [created, updated, submitted, approved, rejected, published, unpublished, archived], performed_by, notes, metadata JSONB, occurred_at), add indexes on organization_id, status, type, published_at DESC, add RLS policies (public can view published, org members can view their stories, org editors can create/update draft stories, platform_admins full access), create seed data 3-5 test orgs with 10-15 test stories different types and statuses. Verify Supabase Storage buckets stories-videos and stories-images exist with 100MB and 10MB limits. Install FFmpeg if not present. Read IMPL_Stories_v1.md Phase 1 Week 1 Day 1-2. Duration: 12 hours. DATABASE ONLY - independent work.
```

---

## 🚀 READY TO START PROMPT (FULL BACKEND - Day 1-5)

**Copy this when Payments Phase 3 complete:**

```powershell
Stories MVP backend complete (Week 1). PREREQUISITES: Verify Payments Phase 3 complete, can_create_story function available, Supabase Storage buckets configured, FFmpeg installed. Tasks: Day 1-2 (database as above), Day 3-4 (implement Pydantic schemas StoryType/ContentOrigin/StoryStatus enums, StoryBase/StoryCreate/StoryUpdate/StoryResponse models with GalleryItem, implement StoriesService create_story with subscription check/get_story with permissions/get_stories with filters/update_story draft only/delete_story/submit_for_moderation with moderator notification, implement ModerationService get_pending_stories/approve_story publish and notify/reject_story return to draft and notify, implement VideoService upload_video 100MB limit with ffprobe metadata extraction/generate_thumbnail first frame/validate_video format and duration, implement StoryPermissions can_create editor roles/can_edit author or admins/can_delete/can_view org members), Day 5 (implement API routes GET/POST /stories with filters, GET/PATCH/DELETE /stories/:id, POST /stories/:id/submit, POST /stories/:id/view analytics, GET /stories/:id/analytics, POST /stories/upload-video and /stories/upload-image multipart form, implement admin routes GET /admin/stories/pending, POST /admin/stories/:id/approve with notes, POST /admin/stories/:id/reject with reason, unit tests test_create_story, test_submit_for_moderation, test_approve_story, test_reject_story). CRITICAL: Integrate with Payments can_create_story subscription check. Read IMPL_Stories_v1.md Phase 1 Week 1 complete. Duration: 40 hours (5 days).
```

---

**Status:** Database work can start immediately, API work blocked until Payments Phase 3
**Expected Completion:** 2 weeks after full start
**Estimated Hours:** 80 hours (Week 1 backend 40h, Week 2 frontend 40h)
