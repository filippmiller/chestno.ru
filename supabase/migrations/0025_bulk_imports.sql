-- Migration: Bulk Import System
-- Adds support for importing products from various sources (CSV, Excel, Wildberries, Ozon, 1C)

-- 1. Create import_jobs table
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by uuid NOT NULL REFERENCES app_users(id),

    -- Source information
    source_type text NOT NULL CHECK (source_type IN ('wildberries', 'ozon', '1c', 'generic_csv', 'generic_xlsx')),
    source_filename text,

    -- Processing status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',        -- Just uploaded, waiting for mapping
        'mapping',        -- User is mapping fields
        'validating',     -- Running validation
        'preview',        -- Ready for user preview
        'processing',     -- Importing products
        'completed',      -- Successfully completed
        'failed',         -- Failed with errors
        'cancelled'       -- Cancelled by user
    )),

    -- Field mapping configuration
    field_mapping jsonb DEFAULT '{}',

    -- Progress tracking
    total_rows integer DEFAULT 0,
    processed_rows integer DEFAULT 0,
    successful_rows integer DEFAULT 0,
    failed_rows integer DEFAULT 0,

    -- Error information
    validation_errors jsonb DEFAULT '[]',
    error_message text,

    -- Settings
    skip_duplicates boolean DEFAULT true,
    update_existing boolean DEFAULT false,
    download_images boolean DEFAULT true,

    -- Timestamps
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON public.import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON public.import_jobs(created_at DESC);

-- 2. Create import_job_items table for individual rows
CREATE TABLE IF NOT EXISTS public.import_job_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_number integer NOT NULL,

    -- Data storage
    raw_data jsonb NOT NULL,           -- Original data from file
    mapped_data jsonb DEFAULT '{}',    -- Data after mapping applied

    -- Processing status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Not yet processed
        'valid',        -- Passed validation
        'invalid',      -- Failed validation
        'processing',   -- Currently being processed
        'completed',    -- Successfully imported
        'failed',       -- Failed to import
        'skipped'       -- Skipped (duplicate, etc.)
    )),

    -- Result information
    product_id uuid REFERENCES products(id) ON DELETE SET NULL,
    error_message text,
    validation_errors jsonb DEFAULT '[]',

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_items_job ON public.import_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON public.import_job_items(status);
CREATE INDEX IF NOT EXISTS idx_import_items_row ON public.import_job_items(job_id, row_number);

-- 3. Create import_image_queue for async image downloads
CREATE TABLE IF NOT EXISTS public.import_image_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    item_id uuid REFERENCES import_job_items(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,

    -- Source and target
    source_url text NOT NULL,
    target_type text NOT NULL CHECK (target_type IN ('main', 'gallery')),
    display_order integer DEFAULT 0,

    -- Processing status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Not yet processed
        'downloading',  -- Currently downloading
        'uploading',    -- Uploading to storage
        'completed',    -- Successfully processed
        'failed'        -- Failed
    )),

    -- Result
    result_url text,
    error_message text,
    retry_count integer DEFAULT 0,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_image_queue_job ON public.import_image_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_image_queue_status ON public.import_image_queue(status);
CREATE INDEX IF NOT EXISTS idx_image_queue_product ON public.import_image_queue(product_id);

-- 4. Enable RLS on all tables
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_image_queue ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for import_jobs
-- Read: Organization members can read
CREATE POLICY "import_jobs_select" ON public.import_jobs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = import_jobs.organization_id
            AND om.user_id = auth.uid()
        )
    );

-- Insert: Editors can create imports
CREATE POLICY "import_jobs_insert" ON public.import_jobs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = import_jobs.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Update: Editors can update their imports
CREATE POLICY "import_jobs_update" ON public.import_jobs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = import_jobs.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

-- Delete: Admins can delete imports
CREATE POLICY "import_jobs_delete" ON public.import_jobs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = import_jobs.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- 6. RLS Policies for import_job_items (via job)
CREATE POLICY "import_items_select" ON public.import_job_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_job_items.job_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "import_items_insert" ON public.import_job_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_job_items.job_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

CREATE POLICY "import_items_update" ON public.import_job_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_job_items.job_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

CREATE POLICY "import_items_delete" ON public.import_job_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_job_items.job_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- 7. RLS Policies for import_image_queue (via job)
CREATE POLICY "image_queue_select" ON public.import_image_queue
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_image_queue.job_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "image_queue_insert" ON public.import_image_queue
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_image_queue.job_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

CREATE POLICY "image_queue_update" ON public.import_image_queue
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_image_queue.job_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager', 'editor')
        )
    );

CREATE POLICY "image_queue_delete" ON public.import_image_queue
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            JOIN organization_members om ON om.organization_id = ij.organization_id
            WHERE ij.id = import_image_queue.job_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- 8. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_import_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER import_jobs_updated
    BEFORE UPDATE ON public.import_jobs
    FOR EACH ROW EXECUTE FUNCTION update_import_timestamp();

CREATE TRIGGER import_items_updated
    BEFORE UPDATE ON public.import_job_items
    FOR EACH ROW EXECUTE FUNCTION update_import_timestamp();

CREATE TRIGGER image_queue_updated
    BEFORE UPDATE ON public.import_image_queue
    FOR EACH ROW EXECUTE FUNCTION update_import_timestamp();

-- 9. Add comments for documentation
COMMENT ON TABLE public.import_jobs IS 'Tracks bulk product import jobs from various sources';
COMMENT ON TABLE public.import_job_items IS 'Individual rows within an import job';
COMMENT ON TABLE public.import_image_queue IS 'Queue for downloading and processing product images';

COMMENT ON COLUMN public.import_jobs.source_type IS 'Source platform: wildberries, ozon, 1c, generic_csv, generic_xlsx';
COMMENT ON COLUMN public.import_jobs.field_mapping IS 'JSON mapping of source columns to product fields';
COMMENT ON COLUMN public.import_jobs.validation_errors IS 'Array of validation error objects';
COMMENT ON COLUMN public.import_job_items.raw_data IS 'Original data from import file';
COMMENT ON COLUMN public.import_job_items.mapped_data IS 'Data after field mapping applied';
