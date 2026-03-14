-- ============================================================================
-- Migration 0004: Make users.email nullable
-- ============================================================================
--
-- Clerk supports users without email addresses (phone-only auth, passkey,
-- OAuth providers that don't require email, and the Clerk dashboard webhook
-- tester). This migration removes the NOT NULL constraint from the email column.
--
-- SQLite does not support DROP COLUMN constraints via ALTER COLUMN, so we use
-- the standard table-rebuild approach.
--
-- Apply to remote D1:
--   wrangler d1 execute adblock-compiler-d1-database --remote \
--     --file=migrations/0004_users_email_nullable.sql
--
-- Apply locally:
--   wrangler d1 execute adblock-compiler-d1-database --local \
--     --file=migrations/0004_users_email_nullable.sql
-- ============================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE _users_new (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,          -- was NOT NULL; now nullable
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    clerk_user_id TEXT UNIQUE,
    tier TEXT NOT NULL DEFAULT 'free',
    first_name TEXT,
    last_name TEXT,
    image_url TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    last_sign_in_at TEXT
);

INSERT INTO _users_new
    SELECT id, email, display_name, role, created_at, updated_at,
           clerk_user_id, tier, first_name, last_name, image_url,
           email_verified, last_sign_in_at
    FROM users;

DROP TABLE users;

ALTER TABLE _users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

PRAGMA foreign_keys = ON;
