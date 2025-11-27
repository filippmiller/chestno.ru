-- Dev / Integration checklist tasks

CREATE TYPE public.dev_task_category AS ENUM ('integration', 'auth', 'ai', 'billing', 'infrastructure', 'other');
CREATE TYPE public.dev_task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
CREATE TYPE public.dev_task_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE IF NOT EXISTS public.dev_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    category public.dev_task_category NOT NULL DEFAULT 'integration',
    related_provider text,
    related_env_vars text[] NOT NULL DEFAULT '{}',
    status public.dev_task_status NOT NULL DEFAULT 'todo',
    priority public.dev_task_priority NOT NULL DEFAULT 'medium',
    external_link text,
    notes_internal text,
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dev_tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_dev_tasks_updated ON public.dev_tasks;
CREATE TRIGGER trg_dev_tasks_updated
BEFORE UPDATE ON public.dev_tasks
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Platform admins manage dev tasks" ON public.dev_tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner', 'platform_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.platform_roles pr
            WHERE pr.user_id = auth.uid()
              AND pr.role IN ('platform_owner', 'platform_admin')
        )
    );

