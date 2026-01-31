-- Deployment History - Track all worker deployments
-- This migration adds deployment versioning and tracking capabilities

-- ============================================================================
-- Deployment History - Track successful worker deployments
-- ============================================================================

CREATE TABLE IF NOT EXISTS deployment_history (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    build_number INTEGER NOT NULL,
    full_version TEXT NOT NULL,
    git_commit TEXT NOT NULL,
    git_branch TEXT NOT NULL,
    deployed_at TEXT NOT NULL DEFAULT (datetime('now')),
    deployed_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'success',
    deployment_duration INTEGER,
    workflow_run_id TEXT,
    workflow_run_url TEXT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_deployment_history_version ON deployment_history(version);
CREATE INDEX IF NOT EXISTS idx_deployment_history_build_number ON deployment_history(build_number);
CREATE INDEX IF NOT EXISTS idx_deployment_history_deployed_at ON deployment_history(deployed_at);
CREATE INDEX IF NOT EXISTS idx_deployment_history_status ON deployment_history(status);
CREATE INDEX IF NOT EXISTS idx_deployment_history_git_commit ON deployment_history(git_commit);

-- Create unique index to prevent duplicate deployments
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployment_history_unique_deployment 
    ON deployment_history(version, build_number);

-- ============================================================================
-- Deployment Counter - Track build numbers per version
-- ============================================================================

CREATE TABLE IF NOT EXISTS deployment_counter (
    version TEXT PRIMARY KEY,
    last_build_number INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deployment_counter_updated_at ON deployment_counter(updated_at);
