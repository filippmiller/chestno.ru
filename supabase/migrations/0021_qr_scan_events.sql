-- QR scan events table for simple business QR codes (without qr_codes table entry)

CREATE TABLE IF NOT EXISTS public.qr_scan_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    qr_type text NOT NULL DEFAULT 'business_main',
    user_id uuid REFERENCES public.app_profiles(id) ON DELETE SET NULL,
    ip_hash text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_events_org_id ON public.qr_scan_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_created_at ON public.qr_scan_events(created_at);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_qr_type ON public.qr_scan_events(qr_type);

ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;

-- Policy: Organization members can view their own scan events
CREATE POLICY "Org members view qr scan events" ON public.qr_scan_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.qr_scan_events.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager', 'editor', 'analyst', 'viewer')
        )
    );

-- Policy: Platform admins can view all scan events
CREATE POLICY "Platform admins view all qr scan events" ON public.qr_scan_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.app_profiles ap
            WHERE ap.id = auth.uid()
              AND ap.role = 'admin'
        )
    );


