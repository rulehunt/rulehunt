-- ========================================================================
-- Migration 0003: Add entity identity tracking columns
-- Author: Assistant
-- Date: 2025-10-09
-- Description:
--   Adds entity identity tracking metrics to the `runs` table:
--   - total_entities_ever_seen: Total unique entity IDs that appeared
--   - unique_patterns: Number of distinct pattern types
--   - entities_alive: Current count of alive entities  
--   - entities_died: Number of entities that have died
-- ========================================================================

ALTER TABLE runs ADD COLUMN total_entities_ever_seen INTEGER;
ALTER TABLE runs ADD COLUMN unique_patterns INTEGER;
ALTER TABLE runs ADD COLUMN entities_alive INTEGER;
ALTER TABLE runs ADD COLUMN entities_died INTEGER;