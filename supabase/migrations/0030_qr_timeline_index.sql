-- Migration: Add index for QR code timeline queries
-- Purpose: Optimize date-aggregated queries on qr_events table
-- Date: 2026-01-27

-- Add composite index on qr_code_id and occurred_at
-- This index will significantly speed up timeline queries that filter by
-- qr_code_id and aggregate by date range
CREATE INDEX IF NOT EXISTS idx_qr_events_timeline
ON qr_events (qr_code_id, occurred_at DESC);

-- Add comment explaining index purpose
COMMENT ON INDEX idx_qr_events_timeline IS
'Optimizes timeline queries that filter by qr_code_id and aggregate by occurred_at date. Used by GET /organizations/{id}/qr-codes/{id}/timeline endpoint.';
