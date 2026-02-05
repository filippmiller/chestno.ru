-- Migration 0107: Product Stories
-- Date: 2026-02-03
-- Description: Creates tables for interactive product stories feature

BEGIN;

-- ============================================================
-- ENUM: story_content_type
-- ============================================================
-- Types of content that can appear in story chapters

CREATE TYPE story_content_type AS ENUM (
  'TEXT',
  'IMAGE',
  'VIDEO',
  'GALLERY',
  'QUIZ'
);

-- ============================================================
-- ENUM: story_status
-- ============================================================
-- Status of a product story

CREATE TYPE story_status AS ENUM (
  'draft',
  'published',
  'archived'
);

-- ============================================================
-- TABLE: product_stories
-- ============================================================
-- Main table for product stories - rich multimedia content about products

CREATE TABLE IF NOT EXISTS public.product_stories (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  product_id uuid NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Content fields
  title text NOT NULL,
  description text,
  cover_image text,

  -- Status and publishing
  status story_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,

  -- Metrics
  view_count integer NOT NULL DEFAULT 0,
  completion_count integer NOT NULL DEFAULT 0,
  avg_time_spent_seconds integer DEFAULT 0,

  -- Metadata
  metadata jsonb DEFAULT '{}',

  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_product_stories_product
ON public.product_stories(product_id);

CREATE INDEX idx_product_stories_org
ON public.product_stories(organization_id);

CREATE INDEX idx_product_stories_status
ON public.product_stories(status, published_at DESC)
WHERE status = 'published';

CREATE INDEX idx_product_stories_created_by
ON public.product_stories(created_by)
WHERE created_by IS NOT NULL;

-- Constraint: one published story per product (can have multiple drafts)
CREATE UNIQUE INDEX unique_published_story_per_product
ON public.product_stories(product_id)
WHERE status = 'published';

-- ============================================================
-- TABLE: story_chapters
-- ============================================================
-- Individual chapters/slides within a story

CREATE TABLE IF NOT EXISTS public.story_chapters (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key
  story_id uuid NOT NULL
    REFERENCES public.product_stories(id) ON DELETE CASCADE,

  -- Order and identification
  order_index integer NOT NULL DEFAULT 0,

  -- Content
  title text,
  content_type story_content_type NOT NULL DEFAULT 'TEXT',
  content text, -- Main content (text, or JSON for complex types)
  media_url text, -- URL for images/videos
  media_urls text[], -- For gallery type (multiple images)

  -- Duration
  duration_seconds integer DEFAULT 5, -- Auto-advance time (for TEXT/IMAGE)

  -- Quiz-specific fields (when content_type = 'QUIZ')
  quiz_question text,
  quiz_options jsonb, -- Array of {id, text, is_correct}
  quiz_explanation text,

  -- Styling
  background_color text,
  text_color text,

  -- Metadata
  metadata jsonb DEFAULT '{}',

  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_story_chapters_story
ON public.story_chapters(story_id, order_index);

-- Constraint: order_index must be unique within a story
CREATE UNIQUE INDEX unique_chapter_order_per_story
ON public.story_chapters(story_id, order_index);

-- ============================================================
-- TABLE: story_interactions
-- ============================================================
-- Tracks user interactions with stories (views, progress, completions)

CREATE TABLE IF NOT EXISTS public.story_interactions (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  story_id uuid NOT NULL
    REFERENCES public.product_stories(id) ON DELETE CASCADE,
  user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Session tracking (for anonymous users)
  session_id text,

  -- Progress tracking
  completed_chapters integer[] DEFAULT '{}', -- Array of chapter order_indexes
  last_chapter_index integer DEFAULT 0,
  total_time_spent integer DEFAULT 0, -- in seconds

  -- Completion
  completed_at timestamptz,

  -- Quiz answers (if applicable)
  quiz_answers jsonb DEFAULT '{}', -- {chapter_id: selected_option_id}
  quiz_score integer DEFAULT 0,

  -- Device info
  device_type text,
  referrer text,

  -- Timestamps
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_story_interactions_story
ON public.story_interactions(story_id);

CREATE INDEX idx_story_interactions_user
ON public.story_interactions(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX idx_story_interactions_session
ON public.story_interactions(session_id)
WHERE session_id IS NOT NULL;

CREATE INDEX idx_story_interactions_completed
ON public.story_interactions(story_id, completed_at)
WHERE completed_at IS NOT NULL;

-- Constraint: one interaction per user/session per story
CREATE UNIQUE INDEX unique_user_story_interaction
ON public.story_interactions(story_id, user_id)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX unique_session_story_interaction
ON public.story_interactions(story_id, session_id)
WHERE session_id IS NOT NULL AND user_id IS NULL;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update story metrics when interaction is updated
CREATE OR REPLACE FUNCTION update_story_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update view count
  UPDATE public.product_stories
  SET
    view_count = (
      SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id))
      FROM public.story_interactions
      WHERE story_id = NEW.story_id
    ),
    completion_count = (
      SELECT COUNT(*)
      FROM public.story_interactions
      WHERE story_id = NEW.story_id AND completed_at IS NOT NULL
    ),
    avg_time_spent_seconds = (
      SELECT COALESCE(AVG(total_time_spent), 0)::integer
      FROM public.story_interactions
      WHERE story_id = NEW.story_id AND total_time_spent > 0
    ),
    updated_at = now()
  WHERE id = NEW.story_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating metrics
CREATE TRIGGER trigger_update_story_metrics
AFTER INSERT OR UPDATE ON public.story_interactions
FOR EACH ROW
EXECUTE FUNCTION update_story_metrics();

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_story_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_product_stories_updated_at
BEFORE UPDATE ON public.product_stories
FOR EACH ROW
EXECUTE FUNCTION update_story_updated_at();

CREATE TRIGGER trigger_story_chapters_updated_at
BEFORE UPDATE ON public.story_chapters
FOR EACH ROW
EXECUTE FUNCTION update_story_updated_at();

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.product_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_interactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Product Stories: Public read for published, org members can manage
CREATE POLICY "product_stories_select_published"
ON public.product_stories
FOR SELECT
USING (status = 'published');

CREATE POLICY "product_stories_select_org_member"
ON public.product_stories
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()   )
);

CREATE POLICY "product_stories_insert_org_member"
ON public.product_stories
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
  )
);

CREATE POLICY "product_stories_update_org_member"
ON public.product_stories
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
  )
);

CREATE POLICY "product_stories_delete_org_admin"
ON public.product_stories
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
  )
);

-- Story Chapters: Follow story permissions
CREATE POLICY "story_chapters_select"
ON public.story_chapters
FOR SELECT
USING (
  story_id IN (
    SELECT id FROM public.product_stories
    WHERE status = 'published'
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()     )
  )
);

CREATE POLICY "story_chapters_insert"
ON public.story_chapters
FOR INSERT
WITH CHECK (
  story_id IN (
    SELECT id FROM public.product_stories
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'editor')
    )
  )
);

CREATE POLICY "story_chapters_update"
ON public.story_chapters
FOR UPDATE
USING (
  story_id IN (
    SELECT id FROM public.product_stories
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'editor')
    )
  )
);

CREATE POLICY "story_chapters_delete"
ON public.story_chapters
FOR DELETE
USING (
  story_id IN (
    SELECT id FROM public.product_stories
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
    )
  )
);

-- Story Interactions: Users can manage their own interactions
CREATE POLICY "story_interactions_select_own"
ON public.story_interactions
FOR SELECT
USING (
  user_id = auth.uid()
  OR session_id IS NOT NULL -- Allow anonymous session reads
);

CREATE POLICY "story_interactions_insert"
ON public.story_interactions
FOR INSERT
WITH CHECK (
  user_id IS NULL -- Anonymous
  OR user_id = auth.uid() -- Authenticated user
);

CREATE POLICY "story_interactions_update_own"
ON public.story_interactions
FOR UPDATE
USING (
  user_id = auth.uid()
  OR (user_id IS NULL AND session_id IS NOT NULL)
);

-- Org members can view all interactions for their stories
CREATE POLICY "story_interactions_select_org"
ON public.story_interactions
FOR SELECT
USING (
  story_id IN (
    SELECT id FROM public.product_stories
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()     )
  )
);

COMMIT;
