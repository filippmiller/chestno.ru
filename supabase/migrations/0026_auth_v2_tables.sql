-- Auth V2 tables: app_profiles and sessions
-- These tables are required for cookie-based session authentication

-- Create app_profiles table (user profiles with roles)
CREATE TABLE IF NOT EXISTS public.app_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'business_owner', 'user')),
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_profiles_email ON public.app_profiles(email);
CREATE INDEX IF NOT EXISTS idx_app_profiles_role ON public.app_profiles(role);

-- Create sessions table (for cookie-based auth)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_profiles(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- Enable RLS
ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.app_profiles;
CREATE POLICY "Users can read own profile" ON public.app_profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.app_profiles;
CREATE POLICY "Users can update own profile" ON public.app_profiles
    FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Platform admins can read all profiles" ON public.app_profiles;
CREATE POLICY "Platform admins can read all profiles" ON public.app_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.app_profiles ap
            WHERE ap.id = auth.uid() AND ap.role = 'admin'
        )
    );

-- RLS policies for sessions
DROP POLICY IF EXISTS "Users can read own sessions" ON public.sessions;
CREATE POLICY "Users can read own sessions" ON public.sessions
    FOR SELECT
    USING (auth.uid() = user_id);
