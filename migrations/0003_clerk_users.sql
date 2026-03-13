-- ============================================================================
-- Users — synced from Clerk webhooks
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Clerk integration
    clerk_user_id TEXT UNIQUE,
    tier TEXT NOT NULL DEFAULT 'free',
    first_name TEXT,
    last_name TEXT,
    image_url TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    last_sign_in_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
