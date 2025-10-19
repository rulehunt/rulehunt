-- ========================================================================
-- Migration 0005: Add share tracking
-- Author: Assistant
-- Date: 2025-10-19
-- Description:
--   Adds share_count field to the `runs` table to track how many times
--   each run has been shared via the share button.
-- ========================================================================

ALTER TABLE runs ADD COLUMN share_count INTEGER NOT NULL DEFAULT 0;

-- ========================================================================
-- Index for efficient queries of most shared runs
-- ========================================================================
CREATE INDEX idx_runs_share_count ON runs(share_count DESC);