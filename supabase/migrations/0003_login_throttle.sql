-- Login throttling table for exponential backoff

CREATE TABLE IF NOT EXISTS public.login_throttle (
    email text PRIMARY KEY,
    failed_attempts integer NOT NULL DEFAULT 0,
    last_failed_at timestamptz,
    locked_until timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- This table is only accessed via the backend service role, so RLS is not required at the moment.

