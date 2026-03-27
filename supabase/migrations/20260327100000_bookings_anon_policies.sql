-- =============================================================
-- Migration: Add anon RLS policies for bookings table
-- Date: 2026-03-27
-- Purpose: Allow browser client (anon key) to manage bookings
-- =============================================================

-- SELECT for admin dashboard (no auth required for now)
CREATE POLICY "anon_select_bookings" ON bookings FOR SELECT TO anon USING (true);

-- UPDATE for status changes from dashboard
CREATE POLICY "anon_update_bookings" ON bookings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- INSERT for public booking form
CREATE POLICY "anon_insert_bookings" ON bookings FOR INSERT TO anon WITH CHECK (true);
