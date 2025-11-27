
create extension if not exists "pgcrypto";

create table if not exists public.app_users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    full_name text,
    locale text default 'ru',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    legal_name text,
    country text,
    city text,
    website_url text,
    phone text,
    is_verified boolean not null default false,
    verification_status text not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references public.app_users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
    invited_by uuid references public.app_users(id),
    created_at timestamptz not null default now(),
    unique (organization_id, user_id)
);

create table if not exists public.platform_roles (
    user_id uuid primary key references public.app_users(id) on delete cascade,
    role text not null check (role in ('platform_admin', 'moderator', 'support')),
    created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.platform_roles enable row level security;

create policy "Users can view their profile" on public.app_users
    for select using (auth.uid() = id);

create policy "Platform admins manage app_users" on public.app_users
    using (exists (select 1 from public.platform_roles pr where pr.user_id = auth.uid() and pr.role = 'platform_admin'));

create policy "Members can view their memberships" on public.organization_members
    for select using (auth.uid() = user_id);

create policy "Organization members can view orgs" on public.organizations
    for select using (
        exists (
            select 1 from public.organization_members om
            where om.organization_id = id and om.user_id = auth.uid()
        )
    );

create policy "Platform admins view organizations" on public.organizations
    for select using (
        exists (
            select 1 from public.platform_roles pr
            where pr.user_id = auth.uid() and pr.role = 'platform_admin'
        )
    );

create policy "Platform admins manage memberships" on public.organization_members
    using (
        exists (
            select 1 from public.platform_roles pr
            where pr.user_id = auth.uid() and pr.role = 'platform_admin'
        )
    );

create policy "Platform admins manage platform roles" on public.platform_roles
    using (
        exists (
            select 1 from public.platform_roles pr
            where pr.user_id = auth.uid() and pr.role = 'platform_admin'
        )
    );

comment on policy "Users can view their profile" on public.app_users is 'Allow app users to access only their own profile';
comment on policy "Members can view their memberships" on public.organization_members is 'Each user sees their organization memberships';
comment on policy "Organization members can view orgs" on public.organizations is 'Only members of an organization may view its record';

