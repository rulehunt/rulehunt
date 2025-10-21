-- ========================================================================
-- Migration 0006: Add stats view tracking
-- Author: Assistant
-- Date: 2025-10-20
-- Description:
--   Adds stats_view_count field to the `runs` table to track how many times
--   each run's statistics have been viewed via the simulation metrics button.
-- ========================================================================

ALTER TABLE runs ADD COLUMN stats_view_count INTEGER NOT NULL DEFAULT 0;