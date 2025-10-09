-- ========================================================================
-- Migration 0002: Add entity_count and entity_change columns
-- Author: Robb Walters
-- Date: 2025-10-09
-- Description:
--   Adds optional metrics `entity_count` and `entity_change` to the `runs`
--   table, corresponding to the new fields in the Scores schema.
-- ========================================================================

ALTER TABLE runs ADD COLUMN entity_count REAL;
ALTER TABLE runs ADD COLUMN entity_change REAL;
