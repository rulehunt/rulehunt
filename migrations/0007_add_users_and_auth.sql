-- ========================================================================
-- Authentication and User Management Tables
-- Enables email-based authentication with device linking for cross-device identity
-- Issue #7: Add user authentication and device linking
-- ========================================================================

-- ========================================================================
-- Table: users
-- Authenticated user accounts with email/password
-- ========================================================================
CREATE TABLE users (
  user_id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Authentication credentials
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,  -- bcrypt or Argon2 hash

  -- User profile
  display_name    TEXT,

  -- Account metadata
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at   TEXT,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,

  -- Constraints
  CHECK (length(email) > 0),
  CHECK (length(password_hash) > 0)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ========================================================================
-- Table: user_devices
-- Links multiple browser/device UUIDs to a single user account
-- Enables cross-device identity and run aggregation
-- ========================================================================
CREATE TABLE user_devices (
  device_id       TEXT PRIMARY KEY,  -- The localStorage UUID from identity.ts
  user_id         TEXT NOT NULL,     -- References users.user_id

  -- Device metadata
  device_label    TEXT,  -- Optional friendly name ("iPhone", "Work Laptop", etc.)
  linked_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_last_seen ON user_devices(last_seen_at DESC);

-- ========================================================================
-- Table: sessions
-- Server-side session tracking for auth token management (optional)
-- Can be used instead of JWT for stateful session management
-- ========================================================================
CREATE TABLE sessions (
  session_id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT NOT NULL,

  -- Session lifecycle
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- Session metadata (optional)
  user_agent      TEXT,
  ip_address      TEXT,

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ========================================================================
-- Migration Notes
-- ========================================================================
-- This migration adds authentication without modifying the existing runs table.
-- The runs.user_id field continues to store localStorage UUIDs.
-- Device linking happens through user_devices table:
--   - When user signs up/logs in, their localStorage UUID is linked to their account
--   - Queries can join runs -> user_devices -> users to get user information
--   - Multiple devices (UUIDs) can be linked to one user account
--
-- Example query to get all runs for a logged-in user:
--   SELECT r.* FROM runs r
--   INNER JOIN user_devices ud ON r.user_id = ud.device_id
--   WHERE ud.user_id = ?
--
-- Example query to show user attribution on leaderboard:
--   SELECT r.*, COALESCE(u.display_name, u.email, r.user_label) as user_display
--   FROM runs r
--   LEFT JOIN user_devices ud ON r.user_id = ud.device_id
--   LEFT JOIN users u ON ud.user_id = u.user_id
-- ========================================================================
