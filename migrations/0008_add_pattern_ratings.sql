-- ========================================================================
-- Migration 0008: Add pattern ratings table
-- Enables users to rate the "interestingness" of discovered patterns
-- Supports ADANA initiative for human judgment collection
-- ========================================================================

-- ========================================================================
-- Table: pattern_ratings
-- Stores user ratings (1-5 stars) for specific patterns
-- Key: (run_hash, user_id) - One rating per user per pattern
-- ========================================================================
CREATE TABLE pattern_ratings (
  rating_id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Pattern identification (links to runs table)
  run_hash           TEXT NOT NULL,

  -- User identification (anonymous UUID or authenticated user_id)
  user_id            TEXT NOT NULL,

  -- Rating value (1-5 stars)
  rating             INTEGER NOT NULL
                       CHECK (rating >= 1 AND rating <= 5),

  -- Timestamp
  rated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- Pattern snapshot at time of rating (for analysis)
  ruleset_hex        TEXT NOT NULL,
  seed               INTEGER NOT NULL,
  generation         INTEGER NOT NULL,

  -- Ensure one rating per user per pattern
  UNIQUE(run_hash, user_id),

  -- Foreign key to runs table (optional - allows orphaned ratings if run deleted)
  FOREIGN KEY (run_hash) REFERENCES runs(run_hash) ON DELETE CASCADE
);

-- Index for fast rating lookups by pattern
CREATE INDEX idx_pattern_ratings_run_hash ON pattern_ratings(run_hash);

-- Index for fast rating lookups by user
CREATE INDEX idx_pattern_ratings_user_id ON pattern_ratings(user_id);

-- Index for rating statistics queries
CREATE INDEX idx_pattern_ratings_rating ON pattern_ratings(rating);

-- ========================================================================
-- View: pattern_rating_stats
-- Aggregated rating statistics per pattern
-- ========================================================================
CREATE VIEW pattern_rating_stats AS
SELECT
  run_hash,
  COUNT(*) as rating_count,
  ROUND(AVG(rating), 2) as avg_rating,
  MIN(rating) as min_rating,
  MAX(rating) as max_rating,
  SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as high_ratings_count
FROM pattern_ratings
GROUP BY run_hash;

-- ========================================================================
-- Migration Notes
-- ========================================================================
-- This migration adds pattern rating functionality to support the ADANA
-- initiative's goal of collecting human judgment data on CA interestingness.
--
-- Key design decisions:
-- 1. One rating per (run_hash, user_id) pair - users can update their rating
-- 2. Rating scale: 1-5 stars (simple, widely understood)
-- 3. Stores pattern snapshot (ruleset_hex, seed, generation) for analysis
-- 4. Cascade delete if run is deleted (optional - can be changed to SET NULL)
-- 5. View provides aggregated statistics for efficient queries
--
-- Usage examples:
-- - Get average rating for a pattern:
--   SELECT avg_rating FROM pattern_rating_stats WHERE run_hash = 'abc123'
--
-- - Get all high-rated patterns (4+ stars):
--   SELECT run_hash, avg_rating FROM pattern_rating_stats
--   WHERE avg_rating >= 4.0 ORDER BY rating_count DESC
--
-- - Get user's rating history:
--   SELECT * FROM pattern_ratings WHERE user_id = 'user123'
--   ORDER BY rated_at DESC
-- ========================================================================
