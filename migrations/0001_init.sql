-- ========================================================================
-- Table: runs
-- One row per simulation submission.
-- Deterministically reproducible from (ruleset_hex, seed, sim_version).
-- ========================================================================
CREATE TABLE runs (
  run_id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Submission info
  submitted_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_id            TEXT NOT NULL DEFAULT 'anonymous',  -- anon UUID later
  user_label         TEXT,  -- optional human label (nickname, device name, etc.)

  -- Ruleset identifiers
  ruleset_name       TEXT NOT NULL,
  ruleset_hex        TEXT NOT NULL
                        CHECK (length(ruleset_hex) = 35 AND ruleset_hex GLOB '[0-9A-Fa-f]*'),

  -- Seed and simulation settings
  seed               INTEGER NOT NULL,
  seed_type          TEXT NOT NULL CHECK (seed_type IN ('center','random','patch')),
  seed_percentage    REAL,

  -- Step/timing metadata
  step_count         INTEGER NOT NULL CHECK (step_count >= 0),
  watched_steps      INTEGER NOT NULL CHECK (watched_steps >= 0),
  watched_wall_ms    INTEGER NOT NULL CHECK (watched_wall_ms >= 0),
  grid_size          INTEGER,
  progress_bar_steps INTEGER,
  requested_sps      REAL,
  actual_sps         REAL,

  -- Aggregated statistics
  population         REAL NOT NULL,
  activity           REAL NOT NULL,
  population_change  REAL NOT NULL,
  entropy2x2         REAL NOT NULL,
  entropy4x4         REAL NOT NULL,
  entropy8x8         REAL NOT NULL,
  interest_score     REAL NOT NULL,

  -- Versioning and engine reproducibility
  sim_version        TEXT NOT NULL,
  engine_commit      TEXT,

  -- Optional blob for extensible metrics or metadata
  extra_scores       TEXT,

  -- Deduplication key for deterministic runs
  run_hash           TEXT UNIQUE
);

-- ========================================================================
-- Indexes for fast queries
-- ========================================================================
CREATE INDEX idx_runs_submitted_at       ON runs(submitted_at DESC);
CREATE INDEX idx_runs_user_id            ON runs(user_id);
CREATE INDEX idx_runs_ruleset_hex        ON runs(ruleset_hex);
CREATE INDEX idx_runs_interest_score     ON runs(interest_score DESC);
CREATE INDEX idx_runs_entropy4x4         ON runs(entropy4x4 DESC);
CREATE INDEX idx_runs_seed               ON runs(ruleset_hex, seed);
