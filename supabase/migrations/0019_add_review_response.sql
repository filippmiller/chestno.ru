-- Add response fields to reviews table
SET client_encoding = 'UTF8';

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS response text,
    ADD COLUMN IF NOT EXISTS response_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS response_at timestamptz;

COMMENT ON COLUMN public.reviews.response IS 'Organization response to the review';
COMMENT ON COLUMN public.reviews.response_by IS 'User who responded (organization member)';
COMMENT ON COLUMN public.reviews.response_at IS 'When the response was created';

