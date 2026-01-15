-- Cloudflare D1 Schema for AdBlock Compiler
-- Generated from Prisma schema

-- ============================================================================
-- Storage Entry - Generic key-value storage with metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage_entries (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    expiresAt TEXT,
    tags TEXT
);

CREATE INDEX IF NOT EXISTS idx_storage_entries_key ON storage_entries(key);
CREATE INDEX IF NOT EXISTS idx_storage_entries_expiresAt ON storage_entries(expiresAt);

-- ============================================================================
-- Filter Cache - Cached filter list downloads
-- ============================================================================

CREATE TABLE IF NOT EXISTS filter_cache (
    id TEXT PRIMARY KEY,
    source TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    hash TEXT NOT NULL,
    etag TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    expiresAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_filter_cache_source ON filter_cache(source);
CREATE INDEX IF NOT EXISTS idx_filter_cache_expiresAt ON filter_cache(expiresAt);

-- ============================================================================
-- Compilation Metadata - Build history tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS compilation_metadata (
    id TEXT PRIMARY KEY,
    configName TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    sourceCount INTEGER NOT NULL,
    ruleCount INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    outputPath TEXT
);

CREATE INDEX IF NOT EXISTS idx_compilation_metadata_configName ON compilation_metadata(configName);
CREATE INDEX IF NOT EXISTS idx_compilation_metadata_timestamp ON compilation_metadata(timestamp);

-- ============================================================================
-- Source Snapshot - Point-in-time source state for change detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_snapshots (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    contentHash TEXT NOT NULL,
    ruleCount INTEGER NOT NULL,
    ruleSample TEXT,
    etag TEXT,
    isCurrent INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_snapshots_source_isCurrent ON source_snapshots(source, isCurrent);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_source ON source_snapshots(source);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_timestamp ON source_snapshots(timestamp);

-- ============================================================================
-- Source Health - Reliability metrics for filter sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_health (
    id TEXT PRIMARY KEY,
    source TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    totalAttempts INTEGER NOT NULL DEFAULT 0,
    successfulAttempts INTEGER NOT NULL DEFAULT 0,
    failedAttempts INTEGER NOT NULL DEFAULT 0,
    consecutiveFailures INTEGER NOT NULL DEFAULT 0,
    averageDuration REAL NOT NULL DEFAULT 0,
    averageRuleCount REAL NOT NULL DEFAULT 0,
    lastAttemptAt TEXT,
    lastSuccessAt TEXT,
    lastFailureAt TEXT,
    recentAttempts TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_source_health_source ON source_health(source);
CREATE INDEX IF NOT EXISTS idx_source_health_status ON source_health(status);

-- ============================================================================
-- Source Attempt - Individual fetch attempt record
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_attempts (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    success INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    error TEXT,
    ruleCount INTEGER,
    etag TEXT
);

CREATE INDEX IF NOT EXISTS idx_source_attempts_source ON source_attempts(source);
CREATE INDEX IF NOT EXISTS idx_source_attempts_timestamp ON source_attempts(timestamp);
