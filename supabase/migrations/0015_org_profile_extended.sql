-- Stage 5: extended organization profile metadata
SET client_encoding = 'UTF8';

ALTER TABLE public.organization_profiles
    ADD COLUMN IF NOT EXISTS founded_year integer,
    ADD COLUMN IF NOT EXISTS employee_count integer,
    ADD COLUMN IF NOT EXISTS factory_size text,
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS sustainability_practices text,
    ADD COLUMN IF NOT EXISTS quality_standards text,
    ADD COLUMN IF NOT EXISTS buy_links jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.organization_profiles
    ALTER COLUMN gallery SET DEFAULT '[]'::jsonb;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS primary_category text,
    ADD COLUMN IF NOT EXISTS tags text;

