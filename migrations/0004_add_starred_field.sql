-- ========================================================================
-- Migration 0004: Add starred field for user favorites
-- Author: Assistant
-- Date: 2025-10-09
-- Description:
--   Adds is_starred boolean field to the `runs` table to allow users to
--   mark favorite patterns for later recall. When a user stars a simulation,
--   the seed field will contain the current active seed at that moment,
--   enabling perfect reproduction of the favorited state.
-- ========================================================================

ALTER TABLE runs ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0 CHECK (is_starred IN (0, 1));

-- ========================================================================
-- Partial index for efficient starred pattern queries
-- Only indexes rows where is_starred = 1, reducing index size
-- ========================================================================
CREATE INDEX idx_runs_starred ON runs(is_starred, submitted_at DESC) WHERE is_starred = 1;
