/**
 * Deployment version management utilities
 * Provides functions to track and query deployment history
 */

export interface DeploymentRecord {
    id: string;
    version: string;
    build_number: number;
    full_version: string;
    git_commit: string;
    git_branch: string;
    deployed_at: string;
    deployed_by: string;
    status: 'success' | 'failed' | 'rollback';
    deployment_duration?: number;
    workflow_run_id?: string;
    workflow_run_url?: string;
    metadata?: Record<string, unknown>;
}

export interface DeploymentInfo {
    version: string;
    buildNumber: number;
    fullVersion: string;
    gitCommit: string;
    gitBranch: string;
    deployedAt: string;
    deployedBy: string;
    status: string;
    metadata?: Record<string, unknown>;
}

/**
 * D1 Database interface (minimal required methods)
 */
export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<{ success: boolean; error?: string }>;
    all<T = unknown>(): Promise<{ results?: T[]; success: boolean; error?: string }>;
}

/**
 * Generate a unique deployment ID
 */
export function generateDeploymentId(): string {
    return `dep_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Format a full version string from version and build number
 */
export function formatFullVersion(version: string, buildNumber: number): string {
    return `${version}+build.${buildNumber}`;
}

/**
 * Parse a full version string into components
 */
export function parseFullVersion(fullVersion: string): { version: string; buildNumber: number } | null {
    const match = fullVersion.match(/^(.+)\+build\.(\d+)$/);
    if (!match) {
        return null;
    }
    return {
        version: match[1],
        buildNumber: parseInt(match[2], 10),
    };
}

/**
 * Get the next build number for a version
 */
export async function getNextBuildNumber(db: D1Database, version: string): Promise<number> {
    // Get current build number from counter table
    const result = await db
        .prepare('SELECT last_build_number FROM deployment_counter WHERE version = ?')
        .bind(version)
        .first<{ last_build_number: number }>();

    const currentBuildNumber = result?.last_build_number || 0;
    const nextBuildNumber = currentBuildNumber + 1;

    // Update counter
    await db
        .prepare(
            `INSERT INTO deployment_counter (version, last_build_number, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(version) DO UPDATE SET
                last_build_number = ?,
                updated_at = datetime('now')`,
        )
        .bind(version, nextBuildNumber, nextBuildNumber)
        .run();

    return nextBuildNumber;
}

/**
 * Record a deployment in the database
 */
export async function recordDeployment(
    db: D1Database,
    deployment: Omit<DeploymentRecord, 'id' | 'deployed_at'>,
): Promise<string> {
    const id = generateDeploymentId();
    const metadataJson = deployment.metadata ? JSON.stringify(deployment.metadata) : null;

    await db
        .prepare(
            `INSERT INTO deployment_history (
                id, version, build_number, full_version, git_commit, git_branch,
                deployed_by, status, deployment_duration, workflow_run_id,
                workflow_run_url, metadata, deployed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        )
        .bind(
            id,
            deployment.version,
            deployment.build_number,
            deployment.full_version,
            deployment.git_commit,
            deployment.git_branch,
            deployment.deployed_by,
            deployment.status,
            deployment.deployment_duration || null,
            deployment.workflow_run_id || null,
            deployment.workflow_run_url || null,
            metadataJson,
        )
        .run();

    return id;
}

/**
 * Get the latest deployment record
 */
export async function getLatestDeployment(db: D1Database): Promise<DeploymentInfo | null> {
    const result = await db
        .prepare(
            `SELECT
                version, build_number, full_version, git_commit, git_branch,
                deployed_at, deployed_by, status, metadata
             FROM deployment_history
             WHERE status = 'success'
             ORDER BY deployed_at DESC
             LIMIT 1`,
        )
        .first<{
            version: string;
            build_number: number;
            full_version: string;
            git_commit: string;
            git_branch: string;
            deployed_at: string;
            deployed_by: string;
            status: string;
            metadata: string | null;
        }>();

    if (!result) {
        return null;
    }

    return {
        version: result.version,
        buildNumber: result.build_number,
        fullVersion: result.full_version,
        gitCommit: result.git_commit,
        gitBranch: result.git_branch,
        deployedAt: result.deployed_at,
        deployedBy: result.deployed_by,
        status: result.status,
        metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
    };
}

/**
 * Get deployment history with optional filters
 */
export async function getDeploymentHistory(
    db: D1Database,
    options: {
        limit?: number;
        version?: string;
        status?: string;
        branch?: string;
    } = {},
): Promise<DeploymentInfo[]> {
    const { limit = 50, version, status, branch } = options;

    let query = `
        SELECT
            version, build_number, full_version, git_commit, git_branch,
            deployed_at, deployed_by, status, metadata
        FROM deployment_history
        WHERE 1=1
    `;

    const params: unknown[] = [];

    if (version) {
        query += ' AND version = ?';
        params.push(version);
    }

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    if (branch) {
        query += ' AND git_branch = ?';
        params.push(branch);
    }

    query += ' ORDER BY deployed_at DESC LIMIT ?';
    params.push(limit);

    const result = await db.prepare(query).bind(...params).all<{
        version: string;
        build_number: number;
        full_version: string;
        git_commit: string;
        git_branch: string;
        deployed_at: string;
        deployed_by: string;
        status: string;
        metadata: string | null;
    }>();

    if (!result.results) {
        return [];
    }

    return result.results.map((row) => ({
        version: row.version,
        buildNumber: row.build_number,
        fullVersion: row.full_version,
        gitCommit: row.git_commit,
        gitBranch: row.git_branch,
        deployedAt: row.deployed_at,
        deployedBy: row.deployed_by,
        status: row.status,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
}

/**
 * Get deployment by full version
 */
export async function getDeploymentByVersion(db: D1Database, fullVersion: string): Promise<DeploymentInfo | null> {
    const result = await db
        .prepare(
            `SELECT
                version, build_number, full_version, git_commit, git_branch,
                deployed_at, deployed_by, status, metadata
             FROM deployment_history
             WHERE full_version = ?
             LIMIT 1`,
        )
        .bind(fullVersion)
        .first<{
            version: string;
            build_number: number;
            full_version: string;
            git_commit: string;
            git_branch: string;
            deployed_at: string;
            deployed_by: string;
            status: string;
            metadata: string | null;
        }>();

    if (!result) {
        return null;
    }

    return {
        version: result.version,
        buildNumber: result.build_number,
        fullVersion: result.full_version,
        gitCommit: result.git_commit,
        gitBranch: result.git_branch,
        deployedAt: result.deployed_at,
        deployedBy: result.deployed_by,
        status: result.status,
        metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
    };
}

/**
 * Mark a deployment as rolled back
 */
export async function markDeploymentRollback(db: D1Database, fullVersion: string): Promise<void> {
    await db
        .prepare(
            `UPDATE deployment_history
             SET status = 'rollback'
             WHERE full_version = ?`,
        )
        .bind(fullVersion)
        .run();
}

/**
 * Get deployment statistics
 */
export async function getDeploymentStats(
    db: D1Database,
): Promise<{
    totalDeployments: number;
    successfulDeployments: number;
    failedDeployments: number;
    latestVersion: string | null;
}> {
    const totalResult = await db.prepare('SELECT COUNT(*) as count FROM deployment_history').first<{ count: number }>();

    const successResult = await db
        .prepare("SELECT COUNT(*) as count FROM deployment_history WHERE status = 'success'")
        .first<{ count: number }>();

    const failedResult = await db
        .prepare("SELECT COUNT(*) as count FROM deployment_history WHERE status = 'failed'")
        .first<{ count: number }>();

    const latestResult = await db
        .prepare("SELECT full_version FROM deployment_history WHERE status = 'success' ORDER BY deployed_at DESC LIMIT 1")
        .first<{ full_version: string }>();

    return {
        totalDeployments: totalResult?.count || 0,
        successfulDeployments: successResult?.count || 0,
        failedDeployments: failedResult?.count || 0,
        latestVersion: latestResult?.full_version || null,
    };
}
