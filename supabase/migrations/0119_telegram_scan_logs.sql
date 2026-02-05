-- Telegram Scan Logs for tracking product verifications via Telegram bot
-- This adds to the existing telegram bot infrastructure

-- Table for logging Telegram product scans
CREATE TABLE IF NOT EXISTS telegram_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(telegram_id, qr_code_id, scanned_at)
);

-- Create index for querying scan history
CREATE INDEX idx_telegram_scan_logs_telegram_id ON telegram_scan_logs(telegram_id);
CREATE INDEX idx_telegram_scan_logs_scanned_at ON telegram_scan_logs(scanned_at DESC);

-- RLS Policies
ALTER TABLE telegram_scan_logs ENABLE ROW LEVEL SECURITY;

-- Service can insert scan logs
CREATE POLICY telegram_scan_logs_insert ON telegram_scan_logs
    FOR INSERT
    WITH CHECK (true);

-- Service can read scan logs
CREATE POLICY telegram_scan_logs_select ON telegram_scan_logs
    FOR SELECT
    USING (true);

COMMENT ON TABLE telegram_scan_logs IS 'Logs of product scans performed through Telegram bot';
COMMENT ON COLUMN telegram_scan_logs.telegram_id IS 'Telegram user ID who performed the scan';
COMMENT ON COLUMN telegram_scan_logs.qr_code_id IS 'QR code that was scanned';
