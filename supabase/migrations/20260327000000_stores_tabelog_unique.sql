-- =============================================================
-- Migration: Add UNIQUE constraint on stores.tabelog_url
-- Date: 2026-03-27
-- Purpose: Required for upsert ON CONFLICT in scrape API
-- =============================================================

ALTER TABLE stores ADD CONSTRAINT stores_tabelog_url_unique UNIQUE (tabelog_url);
