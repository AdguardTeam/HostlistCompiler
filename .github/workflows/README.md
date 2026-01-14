# CI/CD Workflow Documentation

This directory contains the GitHub Actions workflows for the adblock-compiler project.

## Workflows Overview

| Workflow           | Trigger           | Purpose                                                  |
| ------------------ | ----------------- | -------------------------------------------------------- |
| `ci.yml`           | Push, PR          | Main CI/CD pipeline with tests, security, and deployment |
| `version-bump.yml` | PR opened, Manual | Automatic version bumping                                |
| `release.yml`      | Tag push, Manual  | Create GitHub releases with binaries                     |

## CI/CD Pipeline (`ci.yml`)

The main CI/CD pipeline runs on every push and pull request to master/main branches.

### Jobs

```
┌─────────┐     ┌───────────┐     ┌─────────┐
│   CI    │────▶│  Build    │────▶│ Docker  │ (main branch only)
│ (tests) │     │ Artifacts │     │  Image  │
└─────────┘     └───────────┘     └─────────┘
     │
     ├──────────▶ Security ───────▶ Deploy Worker ───▶ Smoke Test
     │                    └───────▶ Deploy Pages
     │
     └──────────▶ Publish (JSR)

┌───────────┐
│ Benchmark │ (runs in parallel)
└───────────┘
```

#### 1. **CI** - Lint, Test & Type Check

- Runs `deno lint` and `deno fmt --check`
- Type checks with `deno check src/index.ts`
- Runs test suite with coverage
- Uploads coverage to Codecov

#### 2. **Benchmark** - Performance Benchmarks

- Runs `deno bench` and outputs JSON results
- Uploads benchmark results as artifacts (90-day retention)
- Displays results in PR summary for easy comparison

#### 3. **Security** - Vulnerability Scan

- Uses Trivy to scan for vulnerabilities (CRITICAL, HIGH, MEDIUM)
- Uploads SARIF results to GitHub Security tab

#### 4. **Build** - Build Artifacts

- Compiles CLI binary using `deno compile`
- Uploads binary as artifact (30-day retention)

#### 5. **Docker** - Build & Push Image

- Builds multi-stage Docker image
- Pushes to GitHub Container Registry (ghcr.io)
- Tags: `latest`, commit SHA, branch name
- Uses GitHub Actions cache for faster builds

#### 6. **Publish** - Publish to JSR

- Publishes package to JSR registry
- Uses OIDC authentication (no token needed)
- Only runs on main branch pushes

#### 7. **Deploy Worker** - Cloudflare Worker Deployment

- Creates Cloudflare resources (queues, R2 bucket)
- Deploys worker using Wrangler
- Runs post-deployment smoke test
- Only runs when `ENABLE_CLOUDFLARE_DEPLOY=true`

#### 8. **Deploy Pages** - Cloudflare Pages Deployment

- Deploys static UI to Cloudflare Pages
- Only runs when `ENABLE_CLOUDFLARE_DEPLOY=true`

### Concurrency Control

The CI workflow uses concurrency groups to automatically cancel outdated runs:

```yaml
concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
```

## Version Bump (`version-bump.yml`)

Automatically bumps the version number when a pull request is opened.

### Trigger

- Runs when a PR is opened targeting master/main branches
- Does not run for automation bots (github-actions[bot], dependabot[bot])
- Can be manually triggered with version type selection

### Manual Trigger Options

- **bump_type**: `patch` (default), `minor`, or `major`
- **create_release**: Optionally trigger a release after bumping

### What it does

1. Extracts current version from `deno.json`
2. Calculates new version based on bump type
3. Updates version in all relevant files:
   - `deno.json`
   - `package.json`
   - `src/version.ts`
   - `wrangler.toml`
   - `docker-compose.yml`
   - Example configurations
4. Commits and pushes changes
5. Comments on PR with version change

## Release (`release.yml`)

Creates GitHub releases with compiled binaries for all platforms.

### Trigger

- Pushing a tag matching `v*` (e.g., `v0.8.0`)
- Manual trigger with version input

### What it creates

- **Binaries** for:
  - Linux x64 and ARM64
  - macOS x64 (Intel) and ARM64 (Apple Silicon)
  - Windows x64
- **Docker images** pushed to ghcr.io with version tag
- **GitHub Release** with:
  - Auto-generated release notes
  - Installation instructions
  - SHA256 checksums for all binaries

### Creating a Release

**Option 1: Tag-based (recommended)**

```bash
git tag v0.8.0
git push origin v0.8.0
```

**Option 2: Manual via GitHub UI**

1. Go to Actions → Release
2. Click "Run workflow"
3. Enter version (e.g., `0.8.0`)

**Option 3: Via Version Bump workflow**

1. Go to Actions → Version Bump
2. Select bump type (patch/minor/major)
3. Check "Create a release after bumping"

## Required Secrets & Variables

### Secrets

| Secret                  | Required       | Purpose                       |
| ----------------------- | -------------- | ----------------------------- |
| `CODECOV_TOKEN`         | Optional       | Upload code coverage reports  |
| `CLOUDFLARE_API_TOKEN`  | For deployment | Cloudflare API access         |
| `CLOUDFLARE_ACCOUNT_ID` | For deployment | Cloudflare account identifier |

### Repository Variables

| Variable                   | Default | Purpose                                |
| -------------------------- | ------- | -------------------------------------- |
| `ENABLE_CLOUDFLARE_DEPLOY` | `false` | Set to `true` to enable CF deployments |

## Local Development

Run the same checks locally:

```bash
# Lint and format
deno lint
deno fmt --check

# Type check
deno check src/index.ts

# Run tests
deno task test

# Run tests with coverage
deno task test:coverage
deno coverage coverage --lcov --output=coverage.lcov --include="^file:"

# Run benchmarks
deno bench --allow-read --allow-write --allow-net --allow-env

# Build CLI binary
deno compile --allow-read --allow-write --allow-net --output=hostlist-compiler src/cli.ts

# Build Docker image
docker build -t adblock-compiler .
```

## Troubleshooting

### CI Fails on Format Check

Run `deno fmt` locally and commit the changes.

### Security Scan Fails

Check the Trivy output for vulnerabilities. Non-critical issues won't block the build.

### Docker Build Fails

Ensure the Dockerfile is valid and all required files are present.

### Deployment Fails

1. Verify `ENABLE_CLOUDFLARE_DEPLOY` is set to `true`
2. Check Cloudflare secrets are configured correctly
3. Review Wrangler logs in the action output

### JSR Publish Fails

- The version may already exist on JSR
- Check that `deno.json` has valid exports configuration

### Release Binaries Missing

- Ensure the tag format is correct (`v*`)
- Check the build logs for compilation errors

## Architecture Decisions

### Why Deno 2.x?

- Native TypeScript support
- Built-in testing, benchmarking, and coverage
- JSR publishing support
- Cross-platform binary compilation

### Why GitHub Container Registry?

- Free for public repositories
- Integrated with GitHub Actions
- Automatic authentication via GITHUB_TOKEN

### Why Concurrency Control?

- Saves CI minutes on rapid pushes
- Prevents deployment race conditions
- Ensures only latest code is deployed
