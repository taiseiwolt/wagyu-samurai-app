-- =============================================================
-- Migration: Create posts & bookings tables
-- Date: 2026-03-24
-- Purpose: WS-07 posts table with SNS/blog columns,
--          WS-11 bookings table with anon INSERT for public form
-- =============================================================

-- ─── posts ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'draft',
  memo          text,
  media_ids     text[],
  ghost_post_id text,

  -- WS-07: platform-specific generated content
  ig_caption       text,
  ig_hashtags      text,
  ghost_title      text,
  ghost_body       text,
  ghost_meta_desc  text,
  medium_body      text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: service_role only (admin manages posts)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON posts
  TO service_role USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();

-- Index for store lookups
CREATE INDEX idx_posts_store_id ON posts(store_id);


-- ─── bookings ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source                  text NOT NULL DEFAULT 'form',
  status                  text NOT NULL DEFAULT 'new',
  plan                    text,
  customer_name           text NOT NULL,
  customer_email          text,
  travel_start_date       date,
  travel_end_date         date,
  preferred_area          text,
  preferred_genre         text,
  party_size              int,
  budget_range            text,
  special_requests        text,
  preferred_store_name    text,
  store_id                uuid REFERENCES stores(id) ON DELETE SET NULL,
  reservation_date        date,
  reservation_time        time,
  admin_notes             text,
  confirmation_email_sent boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- RLS: service_role full access + anon INSERT for public booking form (WS-11)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON bookings
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_insert_booking" ON bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users (admin dashboard) can SELECT/UPDATE
CREATE POLICY "authenticated_select" ON bookings
  FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated_update" ON bookings
  FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_bookings_updated_at();

-- Indexes
CREATE INDEX idx_bookings_store_id ON bookings(store_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
