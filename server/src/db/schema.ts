export const SCHEMA_SQL = `
-- Users (one owner for now, but structured for future multi-user)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Paired devices
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  platform      TEXT,                -- ios | android
  last_seen_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at    TEXT
);

-- Temporary pairing tokens
CREATE TABLE IF NOT EXISTS pairing_tokens (
  token         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Media metadata (actual files stored on disk by content hash)
CREATE TABLE IF NOT EXISTS media (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT REFERENCES devices(id),
  content_hash    TEXT NOT NULL,          -- SHA-256
  original_name   TEXT NOT NULL,
  original_path   TEXT,
  mime_type       TEXT,
  size_bytes      INTEGER NOT NULL,
  width           INTEGER,
  height          INTEGER,
  duration_ms     INTEGER,
  taken_at        TEXT,
  uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  storage_path    TEXT NOT NULL,          -- relative path under BACKUP_ROOT
  UNIQUE(user_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_media_user_hash ON media(user_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_at ON media(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
`;
