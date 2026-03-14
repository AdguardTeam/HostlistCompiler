-- =============================================================================
-- Admin Configuration Database Schema
-- Migration: 0001_admin_schema.sql
-- Purpose: Create all admin config tables in the dedicated ADMIN_DB D1 database.
--          Isolated from the main application D1 database (DB binding).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Admin Roles — granular role definitions (viewer / editor / super-admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name   TEXT    NOT NULL UNIQUE,
    display_name TEXT   NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    -- JSON array of permission strings, e.g. ["admin:read","config:write","users:manage"]
    permissions TEXT    NOT NULL DEFAULT '[]',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_admin_roles_active ON admin_roles(is_active);

-- ---------------------------------------------------------------------------
-- 2. Admin Role Assignments — maps Clerk user IDs → admin roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_role_assignments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    clerk_user_id   TEXT    NOT NULL,
    role_name       TEXT    NOT NULL,
    assigned_by     TEXT    NOT NULL,          -- clerk_user_id of the assigner
    assigned_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at      TEXT,                      -- NULL = never expires
    FOREIGN KEY (role_name) REFERENCES admin_roles(role_name) ON DELETE CASCADE,
    UNIQUE(clerk_user_id, role_name)
);

CREATE INDEX idx_role_assignments_user   ON admin_role_assignments(clerk_user_id);
CREATE INDEX idx_role_assignments_role   ON admin_role_assignments(role_name);
CREATE INDEX idx_role_assignments_expiry ON admin_role_assignments(expires_at);

-- ---------------------------------------------------------------------------
-- 3. Admin Audit Logs — immutable append-only action log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id      TEXT    NOT NULL,            -- clerk_user_id of the admin
    actor_email   TEXT,                        -- denormalized for readability
    action        TEXT    NOT NULL,            -- e.g. 'tier.update', 'flag.create', 'user.suspend'
    resource_type TEXT    NOT NULL,            -- e.g. 'tier_config', 'feature_flag', 'user'
    resource_id   TEXT,                        -- ID of the affected resource
    old_values    TEXT,                        -- JSON snapshot before change
    new_values    TEXT,                        -- JSON snapshot after change
    ip_address    TEXT,
    user_agent    TEXT,
    status        TEXT    NOT NULL DEFAULT 'success',  -- 'success' | 'failure' | 'denied'
    metadata      TEXT,                        -- extra context as JSON
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Audit logs are append-only; no UPDATE or DELETE expected.
CREATE INDEX idx_audit_actor      ON admin_audit_logs(actor_id);
CREATE INDEX idx_audit_action     ON admin_audit_logs(action);
CREATE INDEX idx_audit_resource   ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created    ON admin_audit_logs(created_at);
CREATE INDEX idx_audit_status     ON admin_audit_logs(status);

-- ---------------------------------------------------------------------------
-- 4. Tier Configs — runtime-editable tier registry (replaces hardcoded TIER_REGISTRY)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tier_configs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tier_name    TEXT    NOT NULL UNIQUE,       -- matches UserTier enum value
    order_rank   INTEGER NOT NULL DEFAULT 0,    -- hierarchy: higher = more privileged
    rate_limit   INTEGER NOT NULL DEFAULT 10,   -- requests per minute (0 = unlimited)
    display_name TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    -- JSON object for tier-specific feature flags / capabilities
    features     TEXT    NOT NULL DEFAULT '{}',
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tier_configs_active ON tier_configs(is_active);
CREATE INDEX idx_tier_configs_order  ON tier_configs(order_rank);

-- ---------------------------------------------------------------------------
-- 5. Scope Configs — runtime-editable scope registry (replaces hardcoded SCOPE_REGISTRY)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scope_configs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_name    TEXT    NOT NULL UNIQUE,      -- matches AuthScope enum value
    display_name  TEXT    NOT NULL,
    description   TEXT    NOT NULL DEFAULT '',
    required_tier TEXT    NOT NULL DEFAULT 'free',  -- minimum UserTier needed
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_scope_configs_active ON scope_configs(is_active);

-- ---------------------------------------------------------------------------
-- 6. Endpoint Auth Overrides — per-endpoint auth requirements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS endpoint_auth_overrides (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    path_pattern    TEXT    NOT NULL,           -- e.g. '/compile', '/api/rules/*'
    method          TEXT    NOT NULL DEFAULT '*',  -- HTTP method or '*' for all
    required_tier   TEXT,                       -- override tier requirement (NULL = use default)
    required_scopes TEXT,                       -- JSON array of required scopes (NULL = use default)
    is_public       INTEGER NOT NULL DEFAULT 0, -- 1 = no auth required
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(path_pattern, method)
);

CREATE INDEX idx_endpoint_overrides_active ON endpoint_auth_overrides(is_active);
CREATE INDEX idx_endpoint_overrides_path   ON endpoint_auth_overrides(path_pattern);

-- ---------------------------------------------------------------------------
-- 7. Feature Flags — feature flag storage with targeting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    flag_name           TEXT    NOT NULL UNIQUE,
    enabled             INTEGER NOT NULL DEFAULT 0,
    rollout_percentage  INTEGER NOT NULL DEFAULT 100,  -- 0-100
    -- JSON array of UserTier values that this flag applies to
    target_tiers        TEXT    NOT NULL DEFAULT '[]',
    -- JSON array of clerk_user_ids for user-level targeting
    target_users        TEXT    NOT NULL DEFAULT '[]',
    description         TEXT    NOT NULL DEFAULT '',
    created_by          TEXT,                  -- clerk_user_id
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX idx_feature_flags_name    ON feature_flags(flag_name);

-- ---------------------------------------------------------------------------
-- 8. Admin Announcements — system-wide banners/notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_announcements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    body        TEXT    NOT NULL DEFAULT '',
    severity    TEXT    NOT NULL DEFAULT 'info',  -- 'info' | 'warning' | 'error' | 'success'
    active_from TEXT,                             -- NULL = immediately active
    active_until TEXT,                            -- NULL = no expiry
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_by  TEXT,                             -- clerk_user_id
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_announcements_active ON admin_announcements(is_active);
CREATE INDEX idx_announcements_dates  ON admin_announcements(active_from, active_until);

-- =============================================================================
-- SEED DATA — defaults that match current hardcoded values
-- =============================================================================

-- Seed default admin roles
INSERT INTO admin_roles (role_name, display_name, description, permissions) VALUES
    ('viewer', 'Viewer', 'Read-only access to admin dashboards and logs', '["admin:read","audit:read","metrics:read","config:read","users:read","flags:read"]'),
    ('editor', 'Editor', 'Read and write access to configuration, flags, and tiers', '["admin:read","audit:read","metrics:read","config:read","config:write","users:read","flags:read","flags:write","tiers:read","tiers:write","scopes:read","scopes:write","endpoints:read","endpoints:write","announcements:read","announcements:write"]'),
    ('super-admin', 'Super Admin', 'Full administrative access including user management and role assignment', '["admin:read","admin:write","audit:read","metrics:read","config:read","config:write","users:read","users:write","users:manage","flags:read","flags:write","tiers:read","tiers:write","scopes:read","scopes:write","endpoints:read","endpoints:write","announcements:read","announcements:write","roles:read","roles:write","roles:assign","keys:read","keys:write","keys:revoke","storage:read","storage:write"]');

-- Seed tier configs from current hardcoded TIER_REGISTRY (worker/types.ts)
INSERT INTO tier_configs (tier_name, order_rank, rate_limit, display_name, description, features) VALUES
    ('anonymous', 0, 10,  'Anonymous', 'Unauthenticated user — basic access', '{"maxSources": 3, "maxBatchSize": 1}'),
    ('free',      1, 60,  'Free',      'Registered free-tier user',           '{"maxSources": 10, "maxBatchSize": 5}'),
    ('pro',       2, 300, 'Pro',       'Paid pro-tier user — higher limits',  '{"maxSources": 50, "maxBatchSize": 25, "priorityQueue": true}'),
    ('admin',     3, 0,   'Admin',     'Administrator — unrestricted access', '{"maxSources": -1, "maxBatchSize": -1, "priorityQueue": true, "rawSqlAccess": true}');

-- Seed scope configs from current hardcoded SCOPE_REGISTRY (worker/types.ts)
INSERT INTO scope_configs (scope_name, display_name, description, required_tier) VALUES
    ('compile', 'Compile',  'Compile and download filter lists',                             'free'),
    ('rules',   'Rules',    'Create, read, update, and delete custom filter rules',          'free'),
    ('admin',   'Admin',    'Full administrative access — manage users, keys, and system config', 'admin');
