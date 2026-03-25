-- =============================================================
-- Migration: Add processed_url column to media table
-- Date: 2026-03-25
-- Purpose: WS-08 image processing pipeline - store processed
--          image URLs (square + portrait) as JSON
-- =============================================================

-- Add processed_url column (JSON string with square/portrait URLs)
ALTER TABLE media
  ADD COLUMN IF NOT EXISTS processed_url text;

-- Ensure processing_status has the expected values
COMMENT ON COLUMN media.processing_status IS 'pending | processing | done | error';
COMMENT ON COLUMN media.processed_url IS 'JSON: {"square":"url","portrait":"url"}';

-- Create processed storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('processed', 'processed', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: service_role can manage processed bucket
CREATE POLICY "service_role_processed_all" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'processed')
  WITH CHECK (bucket_id = 'processed');

-- Public read for processed images
CREATE POLICY "public_read_processed" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'processed');
