-- =============================================================
-- Migration: Add anon RLS policies for all tables
-- Date: 2026-03-27
-- Purpose: Allow browser client (anon key) full access
--          Note: This app has no user auth yet, admin pages
--          are accessed without login
-- =============================================================

-- stores
CREATE POLICY "anon_select_stores" ON stores FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_stores" ON stores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_stores" ON stores FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- posts
CREATE POLICY "anon_select_posts" ON posts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_posts" ON posts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_posts" ON posts FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- media
CREATE POLICY "anon_select_media" ON media FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_media" ON media FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_media" ON media FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- analytics_snapshots
CREATE POLICY "anon_select_analytics" ON analytics_snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_analytics" ON analytics_snapshots FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_analytics" ON analytics_snapshots FOR UPDATE TO anon USING (true) WITH CHECK (true);
