-- Migration: QR Customization Feature
-- Purpose: Allow organizations to customize QR code appearance (colors, logo, style)
-- Author: Team (Alex, Sam, Jamie)
-- Date: 2026-01-27

-- Create qr_customization_settings table
CREATE TABLE IF NOT EXISTS qr_customization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id UUID NOT NULL UNIQUE REFERENCES qr_codes(id) ON DELETE CASCADE,

    -- Color customization
    foreground_color TEXT NOT NULL DEFAULT '#000000',
    background_color TEXT NOT NULL DEFAULT '#FFFFFF',

    -- Logo customization
    logo_url TEXT,  -- URL to logo in Supabase Storage
    logo_size_percent INT DEFAULT 20 CHECK (logo_size_percent BETWEEN 10 AND 30),

    -- Style customization
    style TEXT NOT NULL DEFAULT 'squares' CHECK (style IN ('squares', 'dots', 'rounded')),

    -- Accessibility validation
    contrast_ratio DECIMAL(4,2),  -- WCAG contrast ratio (1.0 - 21.0)
    is_valid BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_qr_customization_qr_code_id
ON qr_customization_settings (qr_code_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qr_customization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_qr_customization_updated_at
BEFORE UPDATE ON qr_customization_settings
FOR EACH ROW
EXECUTE FUNCTION update_qr_customization_updated_at();

-- Create storage bucket for QR logos (if not exists)
-- Note: This requires Supabase dashboard access or supabase CLI
-- Run manually: insert into storage.buckets (id, name, public) values ('qr-logos', 'qr-logos', true);

-- RLS Policies for qr_customization_settings
ALTER TABLE qr_customization_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view customization for QR codes in their organization
CREATE POLICY qr_customization_select_policy ON qr_customization_settings
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_customization_settings.qr_code_id
        AND om.user_id = auth.uid()
    )
);

-- Policy: Managers can insert/update customization for their organization's QR codes
CREATE POLICY qr_customization_insert_policy ON qr_customization_settings
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_customization_settings.qr_code_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

CREATE POLICY qr_customization_update_policy ON qr_customization_settings
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_customization_settings.qr_code_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

CREATE POLICY qr_customization_delete_policy ON qr_customization_settings
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM qr_codes qc
        JOIN organization_members om ON om.organization_id = qc.organization_id
        WHERE qc.id = qr_customization_settings.qr_code_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

-- Comments for documentation
COMMENT ON TABLE qr_customization_settings IS 'Stores custom appearance settings for QR codes (colors, logo, style)';
COMMENT ON COLUMN qr_customization_settings.foreground_color IS 'QR code foreground color (hex format)';
COMMENT ON COLUMN qr_customization_settings.background_color IS 'QR code background color (hex format)';
COMMENT ON COLUMN qr_customization_settings.logo_url IS 'URL to logo image in Supabase Storage bucket qr-logos';
COMMENT ON COLUMN qr_customization_settings.contrast_ratio IS 'WCAG AA contrast ratio between foreground and background (minimum 3.0 for readability)';
COMMENT ON COLUMN qr_customization_settings.is_valid IS 'Whether the customization meets WCAG AA contrast requirements';
