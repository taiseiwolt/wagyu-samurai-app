-- =============================================================
-- Migration: Add followup_email_sent to bookings
-- Date: 2026-03-25
-- Purpose: WS-13 Follow-up email tracking
-- =============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS followup_email_sent boolean NOT NULL DEFAULT false;

-- Index for cron query: find bookings needing followup
CREATE INDEX idx_bookings_followup_pending
  ON bookings (reservation_date)
  WHERE status = 'confirmed' AND followup_email_sent = false;
