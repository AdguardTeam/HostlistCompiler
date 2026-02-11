#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env

/**
 * Record deployment information after successful worker deployment
 *
 * This script:
 * 1. Reads deployment version info
 * 2. Collects git metadata
 * 3. Collects CI/CD metadata
 * 4. Records the deployment in D1
 *
 * Usage:
 *   deno run --allow-read --allow-net --allow-env scripts/record-deployment.ts [--status=success|failed]
 *
 * Environment variables:
 *   CLOUDFLARE_ACCOUNT_ID - Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN - Cloudflare API token
 *   D1_DATABASE_ID - D1 database ID (optional, defaults to value in wrangler.toml)
 *   GITHUB_SHA - Git commit SHA (from GitHub Actions)
 *   GITHUB_REF - Git ref (from GitHub Actions)
 *   GITHUB_ACTOR - GitHub actor (from GitHub Actions)
 *   GITHUB_RUN_ID - GitHub workflow run ID (from GitHub Actions)
 *   GITHUB_SERVER_URL - GitHub server URL (from GitHub Actions)
 *   GITHUB_REPOSITORY - GitHub repository (from GitHub Actions)
 */

import { parseArgs } from '@std/cli/parse-args';
import { generateDeploymentId } from '../src/deployment/version.ts';

interface D1QueryResult {
    success: boolean;
    result?: unknown[];
    errors?: Array<{ code: number; message: string }>;
}

interface VersionInfo {
    version: string;
    buildNumber: number;
    fullVersion: string;
}

interface DeploymentMetadata {
    ci_platform?: string;
    workflow_name?: string;
    workflow_run_id?: string;
    workflow_run_url?: string;
    actor?: string;
    repository?: string;
    [key: string]: unknown;
}

/**
 * Read version info from file
 */
async function readVersionInfo(): Promise<VersionInfo | null> {
    try {
        const content = await Deno.readTextFile('.deployment-version.json');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error reading .deployment-version.json:', error);
        return null;
    }
}

/**
 * Read D1 database ID from wrangler.toml
 */
async function readD1DatabaseId(): Promise<string | null> {
    try {
        const content = await Deno.readTextFile('wrangler.toml');
        const dbIdMatch = content.match(/database_id\s*=\s*"([^"]+)"/);
        if (dbIdMatch) {
            return dbIdMatch[1];
        }
        return null;
    } catch (error) {
        console.error('Error reading wrangler.toml:', error);
        return null;
    }
}

/**
 * Get git commit SHA
 */
function getGitCommit(): string {
    return Deno.env.get('GITHUB_SHA') || 'unknown';
}

/**
 * Get git branch
 */
function getGitBranch(): string {
    const ref = Deno.env.get('GITHUB_REF') || '';
    // Extract branch name from refs/heads/branch-name
    const match = ref.match(/refs\/heads\/(.+)/);
    return match ? match[1] : 'unknown';
}

/**
 * Get deployment actor (who deployed)
 */
function getDeployedBy(): string {
    const actor = Deno.env.get('GITHUB_ACTOR');
    if (actor) {
        return `github-actions[${actor}]`;
    }
    return 'github-actions';
}

/**
 * Get deployment metadata
 */
function getDeploymentMetadata(): DeploymentMetadata {
    const metadata: DeploymentMetadata = {
        ci_platform: 'github-actions',
    };

    const workflowRunId = Deno.env.get('GITHUB_RUN_ID');
    if (workflowRunId) {
        metadata.workflow_run_id = workflowRunId;
    }

    const serverUrl = Deno.env.get('GITHUB_SERVER_URL');
    const repository = Deno.env.get('GITHUB_REPOSITORY');
    if (serverUrl && repository && workflowRunId) {
        metadata.workflow_run_url = `${serverUrl}/${repository}/actions/runs/${workflowRunId}`;
    }

    const actor = Deno.env.get('GITHUB_ACTOR');
    if (actor) {
        metadata.actor = actor;
    }

    if (repository) {
        metadata.repository = repository;
    }

    const workflowName = Deno.env.get('GITHUB_WORKFLOW');
    if (workflowName) {
        metadata.workflow_name = workflowName;
    }

    return metadata;
}

/**
 * Execute D1 query via REST API
 */
async function queryD1(
    accountId: string,
    databaseId: string,
    apiToken: string,
    sql: string,
    params: unknown[] = [],
): Promise<D1QueryResult> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sql,
            params,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`D1 API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json() as D1QueryResult;
    return data;
}

/**
 * Record deployment in D1
 */
async function recordDeployment(
    accountId: string,
    databaseId: string,
    apiToken: string,
    versionInfo: VersionInfo,
    status: 'success' | 'failed',
): Promise<void> {
    const id = generateDeploymentId();
    const gitCommit = getGitCommit();
    const gitBranch = getGitBranch();
    const deployedBy = getDeployedBy();
    const metadata = getDeploymentMetadata();
    const metadataJson = JSON.stringify(metadata);

    console.log(`Recording deployment: ${versionInfo.fullVersion}`);
    console.log(`  ID: ${id}`);
    console.log(`  Git commit: ${gitCommit}`);
    console.log(`  Git branch: ${gitBranch}`);
    console.log(`  Deployed by: ${deployedBy}`);
    console.log(`  Status: ${status}`);

    const sql = `
        INSERT INTO deployment_history (
            id, version, build_number, full_version, git_commit, git_branch,
            deployed_by, status, workflow_run_id, workflow_run_url,
            metadata, deployed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    const params = [
        id,
        versionInfo.version,
        versionInfo.buildNumber,
        versionInfo.fullVersion,
        gitCommit,
        gitBranch,
        deployedBy,
        status,
        metadata.workflow_run_id || null,
        metadata.workflow_run_url || null,
        metadataJson,
    ];

    const result = await queryD1(accountId, databaseId, apiToken, sql, params);

    if (!result.success) {
        throw new Error(`Failed to record deployment: ${JSON.stringify(result.errors)}`);
    }

    console.log('✓ Deployment recorded successfully');
}

/**
 * Main function
 */
async function main() {
    console.log('Recording deployment...');

    // Parse command line arguments
    const args = parseArgs(Deno.args, {
        string: ['status'],
        default: {
            status: 'success',
        },
    });

    const status = args.status as 'success' | 'failed';
    if (status !== 'success' && status !== 'failed') {
        console.error('Invalid status. Must be "success" or "failed"');
        Deno.exit(1);
    }

    // Get environment variables
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    let databaseId = Deno.env.get('D1_DATABASE_ID') || undefined;

    if (!databaseId) {
        const dbId = await readD1DatabaseId();
        databaseId = dbId || undefined;
    }

    if (!accountId || !apiToken || !databaseId) {
        console.error('Missing required environment variables:');
        console.error('  CLOUDFLARE_ACCOUNT_ID:', accountId ? '✓' : '✗');
        console.error('  CLOUDFLARE_API_TOKEN:', apiToken ? '✓' : '✗');
        console.error('  D1_DATABASE_ID:', databaseId ? '✓' : '✗');
        console.error('\nDeployment will not be recorded in database.');
        Deno.exit(0); // Don't fail the deployment
    }

    // Read version info
    const versionInfo = await readVersionInfo();
    if (!versionInfo) {
        console.error('Could not read version info from .deployment-version.json');
        console.error('Deployment will not be recorded.');
        Deno.exit(0); // Don't fail the deployment
    }

    // Record deployment
    try {
        await recordDeployment(accountId, databaseId, apiToken, versionInfo, status);
    } catch (error) {
        console.error('Error recording deployment:', error);
        console.error('Deployment succeeded but was not recorded in database.');
        Deno.exit(0); // Don't fail the deployment
    }

    console.log('\nDeployment information:');
    console.log(`  Version: ${versionInfo.fullVersion}`);
    console.log(`  Git commit: ${getGitCommit()}`);
    console.log(`  Git branch: ${getGitBranch()}`);
    console.log(`  Deployed by: ${getDeployedBy()}`);
}

// Run main function
if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error('Fatal error:', error);
        Deno.exit(1);
    }
}
