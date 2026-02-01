-- Migration 0041: Story Videos for Producer Journey
-- Date: 2026-02-01
-- Description: Video content for producer stories at key journey stages
-- Features: Video metadata, subtitles/captions, thumbnail generation tracking

BEGIN;

-- ============================================================
-- TABLE: story_videos
-- ============================================================
-- Stores video content for producer stories
-- Optimized for short-form (30-60 sec) storytelling at journey stages

CREATE TABLE IF NOT EXISTS public.story_videos (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Optional link to journey step (can be standalone or attached to journey)
  journey_step_id uuid
    REFERENCES public.product_journey_steps(id) ON DELETE SET NULL,
  
  -- Optional link to product
  product_id uuid
    REFERENCES public.products(id) ON DELETE SET NULL,

  -- Video metadata
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (length(description) <= 2000),
  
  -- Video file information
  video_url text NOT NULL,
  video_path text NOT NULL,  -- Storage path for deletion
  thumbnail_url text,
  thumbnail_path text,
  
  -- Technical metadata
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 300),
  width integer,
  height integer,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('video/mp4', 'video/webm', 'video/quicktime')),
  codec text,
  
  -- Processing status
  processing_status text NOT NULL DEFAULT 'uploaded' 
    CHECK (processing_status IN (
      'uploaded',      -- Raw upload complete
      'processing',    -- Being transcoded/compressed
      'ready',         -- Ready for playback
      'failed'         -- Processing failed
    )),
  processing_error text,
  processed_at timestamptz,
  
  -- Playback settings
  autoplay_on_hover boolean NOT NULL DEFAULT true,
  loop_playback boolean NOT NULL DEFAULT false,
  muted_by_default boolean NOT NULL DEFAULT true,
  
  -- Visibility
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  
  -- Analytics
  view_count integer NOT NULL DEFAULT 0,
  unique_view_count integer NOT NULL DEFAULT 0,
  watch_time_seconds bigint NOT NULL DEFAULT 0,
  completion_rate numeric(5,2),  -- Percentage of video watched on average

  -- Audit
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: story_video_subtitles
-- ============================================================
-- VTT-style subtitle tracks for accessibility

CREATE TABLE IF NOT EXISTS public.story_video_subtitles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  video_id uuid NOT NULL
    REFERENCES public.story_videos(id) ON DELETE CASCADE,
  
  -- Language code (ISO 639-1)
  language_code text NOT NULL CHECK (length(language_code) = 2),
  language_name text NOT NULL,  -- e.g., "Русский", "English"
  
  -- Subtitle content
  subtitle_url text,  -- URL to VTT file in storage
  subtitle_path text, -- Storage path
  
  -- Inline subtitles (for simpler cases)
  subtitle_data jsonb,
    -- Array format: [{ "start": 0.5, "end": 2.5, "text": "Привет!" }, ...]
  
  -- Metadata
  is_auto_generated boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Only one subtitle track per language per video
  CONSTRAINT unique_video_language UNIQUE (video_id, language_code)
);

-- ============================================================
-- TABLE: story_video_views
-- ============================================================
-- Analytics for video engagement

CREATE TABLE IF NOT EXISTS public.story_video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  video_id uuid NOT NULL
    REFERENCES public.story_videos(id) ON DELETE CASCADE,
  
  -- Viewer info (nullable for anonymous)
  viewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  
  -- View details
  watched_seconds integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  device_type text CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  referrer text,
  
  -- Interaction
  was_muted boolean,
  entered_fullscreen boolean NOT NULL DEFAULT false,
  
  viewed_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Story videos by organization
CREATE INDEX idx_story_videos_org ON public.story_videos(organization_id);

-- Story videos by journey step
CREATE INDEX idx_story_videos_journey ON public.story_videos(journey_step_id)
  WHERE journey_step_id IS NOT NULL;

-- Story videos by product
CREATE INDEX idx_story_videos_product ON public.story_videos(product_id)
  WHERE product_id IS NOT NULL;

-- Published videos for public queries
CREATE INDEX idx_story_videos_published ON public.story_videos(organization_id, is_published, created_at DESC)
  WHERE is_published = true AND processing_status = 'ready';

-- Processing queue
CREATE INDEX idx_story_videos_processing ON public.story_videos(processing_status, created_at)
  WHERE processing_status IN ('uploaded', 'processing');

-- Subtitles by video
CREATE INDEX idx_subtitles_video ON public.story_video_subtitles(video_id);

-- View analytics
CREATE INDEX idx_video_views_video ON public.story_video_views(video_id);
CREATE INDEX idx_video_views_viewer ON public.story_video_views(viewer_user_id)
  WHERE viewer_user_id IS NOT NULL;
CREATE INDEX idx_video_views_time ON public.story_video_views(viewed_at DESC);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.story_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_video_subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_video_views ENABLE ROW LEVEL SECURITY;

-- Public can view published videos
DROP POLICY IF EXISTS "Public view published videos" ON public.story_videos;
CREATE POLICY "Public view published videos"
ON public.story_videos
FOR SELECT
USING (
  is_published = true 
  AND processing_status = 'ready'
);

-- Org editors can manage their videos
DROP POLICY IF EXISTS "Org editors manage videos" ON public.story_videos;
CREATE POLICY "Org editors manage videos"
ON public.story_videos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = story_videos.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = story_videos.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
);

-- Public can view subtitles for published videos
DROP POLICY IF EXISTS "Public view subtitles" ON public.story_video_subtitles;
CREATE POLICY "Public view subtitles"
ON public.story_video_subtitles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.story_videos v
    WHERE v.id = story_video_subtitles.video_id
      AND v.is_published = true
      AND v.processing_status = 'ready'
  )
);

-- Org editors can manage subtitles
DROP POLICY IF EXISTS "Org editors manage subtitles" ON public.story_video_subtitles;
CREATE POLICY "Org editors manage subtitles"
ON public.story_video_subtitles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.story_videos v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE v.id = story_video_subtitles.video_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.story_videos v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE v.id = story_video_subtitles.video_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager', 'editor')
  )
);

-- Anyone can create view records
DROP POLICY IF EXISTS "Insert video views" ON public.story_video_views;
CREATE POLICY "Insert video views"
ON public.story_video_views
FOR INSERT
WITH CHECK (true);

-- Users can view their own view history
DROP POLICY IF EXISTS "View own video history" ON public.story_video_views;
CREATE POLICY "View own video history"
ON public.story_video_views
FOR SELECT
USING (
  viewer_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.story_videos v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE v.id = story_video_views.video_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
  )
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Record video view and update counters
CREATE OR REPLACE FUNCTION public.record_video_view(
  p_video_id uuid,
  p_session_id text DEFAULT NULL,
  p_watched_seconds integer DEFAULT 0,
  p_completed boolean DEFAULT false,
  p_device_type text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_was_muted boolean DEFAULT NULL,
  p_entered_fullscreen boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_view_id uuid;
  v_viewer_id uuid;
  v_is_unique boolean := false;
BEGIN
  -- Get current user if authenticated
  v_viewer_id := auth.uid();
  
  -- Check if this is a unique view
  IF v_viewer_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.story_video_views
      WHERE video_id = p_video_id AND viewer_user_id = v_viewer_id
    ) INTO v_is_unique;
  ELSIF p_session_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.story_video_views
      WHERE video_id = p_video_id AND session_id = p_session_id
    ) INTO v_is_unique;
  ELSE
    v_is_unique := true; -- Anonymous views are always counted as unique
  END IF;
  
  -- Insert view record
  INSERT INTO public.story_video_views (
    video_id,
    viewer_user_id,
    session_id,
    watched_seconds,
    completed,
    device_type,
    referrer,
    was_muted,
    entered_fullscreen
  ) VALUES (
    p_video_id,
    v_viewer_id,
    p_session_id,
    p_watched_seconds,
    p_completed,
    p_device_type,
    p_referrer,
    p_was_muted,
    p_entered_fullscreen
  )
  RETURNING id INTO v_view_id;
  
  -- Update video counters
  UPDATE public.story_videos
  SET 
    view_count = view_count + 1,
    unique_view_count = unique_view_count + (CASE WHEN v_is_unique THEN 1 ELSE 0 END),
    watch_time_seconds = watch_time_seconds + p_watched_seconds,
    updated_at = now()
  WHERE id = p_video_id;
  
  RETURN v_view_id;
END;
$$;

-- Get video analytics summary
CREATE OR REPLACE FUNCTION public.get_video_analytics(
  p_video_id uuid
)
RETURNS TABLE (
  total_views bigint,
  unique_views bigint,
  total_watch_time bigint,
  avg_watch_time numeric,
  completion_rate numeric,
  mobile_views bigint,
  tablet_views bigint,
  desktop_views bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v.view_count::bigint,
    v.unique_view_count::bigint,
    v.watch_time_seconds,
    CASE WHEN v.view_count > 0 
      THEN (v.watch_time_seconds::numeric / v.view_count)
      ELSE 0 
    END,
    v.completion_rate,
    (SELECT COUNT(*) FROM story_video_views WHERE video_id = p_video_id AND device_type = 'mobile'),
    (SELECT COUNT(*) FROM story_video_views WHERE video_id = p_video_id AND device_type = 'tablet'),
    (SELECT COUNT(*) FROM story_video_views WHERE video_id = p_video_id AND device_type = 'desktop')
  FROM public.story_videos v
  WHERE v.id = p_video_id;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.story_videos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS story_videos_updated_at_trigger ON public.story_videos;
CREATE TRIGGER story_videos_updated_at_trigger
BEFORE UPDATE ON public.story_videos
FOR EACH ROW
EXECUTE FUNCTION public.story_videos_updated_at();

DROP TRIGGER IF EXISTS story_video_subtitles_updated_at_trigger ON public.story_video_subtitles;
CREATE TRIGGER story_video_subtitles_updated_at_trigger
BEFORE UPDATE ON public.story_video_subtitles
FOR EACH ROW
EXECUTE FUNCTION public.story_videos_updated_at();

-- ============================================================
-- STORAGE BUCKET SETUP
-- ============================================================
-- Note: Run these in Supabase Dashboard or via supabase CLI

-- CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "extensions";

-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('story-videos', 'story-videos', true, 104857600)  -- 100MB
-- ON CONFLICT DO NOTHING;

-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('story-thumbnails', 'story-thumbnails', true, 5242880)  -- 5MB
-- ON CONFLICT DO NOTHING;

-- Storage policies would go here (see TEAM4_STORIES_HANDOFF.md for examples)

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.story_videos IS
  'Short-form video content (30-60 sec) for producer storytelling at journey stages.';

COMMENT ON TABLE public.story_video_subtitles IS
  'VTT-style subtitle tracks for video accessibility. Supports multiple languages.';

COMMENT ON TABLE public.story_video_views IS
  'Analytics tracking for video engagement including watch time and completion.';

COMMENT ON FUNCTION public.record_video_view IS
  'Records a video view and updates aggregate counters. Handles unique view detection.';

COMMENT ON FUNCTION public.get_video_analytics IS
  'Returns aggregated analytics for a video including device breakdown.';

COMMIT;
