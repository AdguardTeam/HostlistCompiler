# Deployment Versioning System

The adblock-compiler project includes an automated deployment versioning system that tracks every successful worker deployment with detailed metadata.

## Overview

Every deployment is assigned a unique version identifier that includes:
- **Semantic version** (e.g., `0.11.3`) from `deno.json`
- **Build number** (auto-incrementing per version)
- **Full version** (e.g., `0.11.3+build.42`)
- **Git commit SHA** and branch
- **Deployment timestamp** and actor
- **CI/CD workflow metadata**

## Architecture

### Components

1. **Database Schema** (`migrations/0002_deployment_history.sql`)
   - `deployment_history` table: Records all deployments
   - `deployment_counter` table: Tracks build numbers per version

2. **Version Utilities** (`src/deployment/version.ts`)
   - Functions to query and manage deployment history
   - TypeScript interfaces for deployment records

3. **Pre-deployment Script** (`scripts/generate-deployment-version.ts`)
   - Generates build number before deployment
   - Creates full version string
   - Outputs version info for CI/CD

4. **Post-deployment Script** (`scripts/record-deployment.ts`)
   - Records successful/failed deployments in D1
   - Collects git and CI/CD metadata

5. **Worker API Endpoints**
   - `GET /api/version` - Current deployment version
   - `GET /api/deployments` - Deployment history
   - `GET /api/deployments/stats` - Deployment statistics

## How It Works

### Deployment Flow

```
1. CI/CD Trigger (push to main)
   ↓
2. Run Database Migrations
   ↓
3. Generate Deployment Version
   - Query D1 for last build number
   - Increment build number
   - Create full version string
   ↓
4. Deploy Worker
   ↓
5. Record Deployment (on success)
   - Insert deployment record into D1
   - Include git metadata, timestamps, etc.
```

### Version Format

Full versions follow the format: `{semantic-version}+build.{build-number}`

**Examples:**
- `0.11.3+build.1` - First deployment of version 0.11.3
- `0.11.3+build.42` - 42nd deployment of version 0.11.3
- `0.12.0+build.1` - First deployment of version 0.12.0

### Build Number Tracking

Build numbers are tracked per semantic version:
- When you bump from `0.11.3` to `0.11.4`, build numbers reset to 1
- Each deployment of the same version increments the build number
- Build numbers are persisted in the `deployment_counter` table

## Database Schema

### deployment_history Table

```sql
CREATE TABLE deployment_history (
    id TEXT PRIMARY KEY,                 -- Unique deployment ID
    version TEXT NOT NULL,               -- Semantic version (0.11.3)
    build_number INTEGER NOT NULL,       -- Build number (42)
    full_version TEXT NOT NULL,          -- Full version (0.11.3+build.42)
    git_commit TEXT NOT NULL,            -- Git commit SHA
    git_branch TEXT NOT NULL,            -- Git branch (main)
    deployed_at TEXT NOT NULL,           -- ISO timestamp
    deployed_by TEXT NOT NULL,           -- Actor (github-actions[user])
    status TEXT NOT NULL,                -- success|failed|rollback
    deployment_duration INTEGER,         -- Duration in ms
    workflow_run_id TEXT,                -- GitHub workflow run ID
    workflow_run_url TEXT,               -- GitHub workflow run URL
    metadata TEXT                        -- Additional JSON metadata
);
```

### deployment_counter Table

```sql
CREATE TABLE deployment_counter (
    version TEXT PRIMARY KEY,            -- Semantic version
    last_build_number INTEGER NOT NULL,  -- Last used build number
    updated_at TEXT NOT NULL             -- Last update timestamp
);
```

## API Endpoints

### GET /api/version

Returns the current deployed version.

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "0.11.3",
    "buildNumber": 42,
    "fullVersion": "0.11.3+build.42",
    "gitCommit": "abc123def456",
    "gitBranch": "main",
    "deployedAt": "2026-01-31T07:00:00.000Z",
    "deployedBy": "github-actions[user]",
    "status": "success"
  }
}
```

### GET /api/deployments

Returns deployment history with optional filters.

**Query Parameters:**
- `limit` (default: 50) - Number of deployments to return
- `version` - Filter by semantic version
- `status` - Filter by status (success|failed|rollback)
- `branch` - Filter by git branch

**Example:**
```bash
curl "https://your-worker.dev/api/deployments?limit=10&version=0.11.3"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "version": "0.11.3",
      "buildNumber": 42,
      "fullVersion": "0.11.3+build.42",
      "gitCommit": "abc123def456",
      "gitBranch": "main",
      "deployedAt": "2026-01-31T07:00:00.000Z",
      "deployedBy": "github-actions[user]",
      "status": "success",
      "metadata": {
        "ci_platform": "github-actions",
        "workflow_run_id": "12345",
        "workflow_run_url": "https://github.com/..."
      }
    }
  ]
}
```

### GET /api/deployments/stats

Returns deployment statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDeployments": 150,
    "successfulDeployments": 145,
    "failedDeployments": 5,
    "latestVersion": "0.11.3+build.42"
  }
}
```

## CI/CD Integration

The deployment versioning system is integrated into the GitHub Actions workflow (`.github/workflows/ci.yml`).

### Deploy Job Steps

1. **Setup Deno** - Required for scripts
2. **Run Database Migrations** - Ensure schema is up to date
3. **Generate Deployment Version** - Create version info
4. **Deploy Worker** - Deploy to Cloudflare
5. **Record Deployment** - Save deployment record

### Environment Variables

The scripts require the following environment variables:

- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `D1_DATABASE_ID` - D1 database ID (optional, can be read from wrangler.toml)
- `GITHUB_SHA` - Git commit SHA (auto-provided by GitHub Actions)
- `GITHUB_REF` - Git ref (auto-provided by GitHub Actions)
- `GITHUB_ACTOR` - GitHub actor (auto-provided by GitHub Actions)
- `GITHUB_RUN_ID` - Workflow run ID (auto-provided by GitHub Actions)

## Manual Usage

### Generate Deployment Version

```bash
deno run --allow-read --allow-net --allow-env \
  scripts/generate-deployment-version.ts
```

This creates a `.deployment-version.json` file with:
```json
{
  "version": "0.11.3",
  "buildNumber": 42,
  "fullVersion": "0.11.3+build.42"
}
```

### Record Deployment

After a successful deployment:
```bash
deno run --allow-read --allow-net --allow-env \
  scripts/record-deployment.ts --status=success
```

After a failed deployment:
```bash
deno run --allow-read --allow-net --allow-env \
  scripts/record-deployment.ts --status=failed
```

## Querying Deployment History

### Using TypeScript/Deno

```typescript
import { getLatestDeployment, getDeploymentHistory, getDeploymentStats } from './src/deployment/version.ts';

// Assuming you have a D1 database instance
const db = /* your D1 database */;

// Get latest deployment
const latest = await getLatestDeployment(db);
console.log(latest?.fullVersion); // "0.11.3+build.42"

// Get deployment history
const history = await getDeploymentHistory(db, {
  limit: 10,
  version: '0.11.3',
});

// Get deployment stats
const stats = await getDeploymentStats(db);
console.log(`Total deployments: ${stats.totalDeployments}`);
```

### Using D1 CLI

```bash
# Query latest deployment
wrangler d1 execute adblock-compiler-d1-database \
  --remote \
  --command "SELECT * FROM deployment_history WHERE status='success' ORDER BY deployed_at DESC LIMIT 1"

# Query deployment count by version
wrangler d1 execute adblock-compiler-d1-database \
  --remote \
  --command "SELECT version, COUNT(*) as count FROM deployment_history GROUP BY version"

# Query failed deployments
wrangler d1 execute adblock-compiler-d1-database \
  --remote \
  --command "SELECT * FROM deployment_history WHERE status='failed'"
```

## Rollback Support

To mark a deployment as rolled back:

```typescript
import { markDeploymentRollback } from './src/deployment/version.ts';

await markDeploymentRollback(db, '0.11.3+build.42');
```

This updates the deployment status to 'rollback' without deleting the record.

## Troubleshooting

### Build number not incrementing

**Symptom:** Build numbers stay at 1 or don't increment

**Possible causes:**
- D1 credentials not available in CI/CD
- Database migration not applied
- Network connectivity issues with D1 API

**Solution:**
1. Verify environment variables are set
2. Check GitHub Actions secrets
3. Manually run migrations: `wrangler d1 execute adblock-compiler-d1-database --file=migrations/0002_deployment_history.sql --remote`

### Deployment not recorded

**Symptom:** Deployment succeeds but no record in database

**Possible causes:**
- Post-deployment script failed
- D1 credentials missing
- Database migration not applied

**Solution:**
1. Check GitHub Actions logs for script errors
2. Verify D1 database ID matches wrangler.toml
3. Manually record deployment using the script

### API endpoints return 503

**Symptom:** `/api/version` returns "D1 database not available"

**Possible causes:**
- D1 binding not configured in wrangler.toml
- Database not created
- Database ID incorrect

**Solution:**
1. Verify D1 binding in wrangler.toml
2. Create database if needed: `wrangler d1 create adblock-compiler-d1-database`
3. Update database_id in wrangler.toml

## Best Practices

1. **Always use CI/CD for deployments** - Manual deployments won't be tracked
2. **Don't modify build numbers manually** - Let the system auto-increment
3. **Keep deployment history** - Don't delete old records, mark as rollback instead
4. **Monitor deployment stats** - Use `/api/deployments/stats` to track success rate
5. **Use semantic versioning** - Bump version in deno.json when releasing features

## Future Enhancements

Potential improvements to the deployment versioning system:

- Automated rollback on failed health checks
- Deployment notifications (Slack, email)
- Deployment approval workflow
- A/B testing support with version tags
- Performance metrics per deployment
- Automated changelog generation from git commits

## See Also

- [CI/CD Workflows](.github/workflows/README.md)
- [Database Schema](migrations/0002_deployment_history.sql)
- [Version Utilities](../src/deployment/version.ts)
