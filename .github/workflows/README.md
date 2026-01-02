# CI/CD Workflow Documentation

This directory contains the GitHub Actions workflows for the adblock-compiler project.

## Workflows

### CI/CD Pipeline (`ci.yml`)

The main CI/CD pipeline that runs on every push and pull request to master/main branches.

#### Jobs

1. **Lint Code** - Runs Deno linting and formatting checks
   - Uses `deno task lint` and `deno task fmt:check`
   - Runs on Deno 2.4

2. **Run Tests** - Executes the test suite
   - Matrix strategy: Tests on Deno 2.0 and 2.4
   - Generates code coverage on Deno 2.4
   - Uploads coverage to Codecov (optional, requires CODECOV_TOKEN)

3. **Type Check** - Validates TypeScript types
   - Uses `deno task check`
   - Runs on Deno 2.4

4. **Build Worker** - Bundles the Cloudflare Worker
   - Requires lint, test, and type-check to pass
   - Uses Deno 2.4's `deno bundle` command
   - Checks bundle size (warns if > 1MB)
   - Uploads bundle as artifact

5. **Security Scan** - Scans for vulnerabilities
   - Uses Trivy vulnerability scanner
   - Attempts to upload SARIF results (only on non-fork repositories with Advanced Security enabled)
   - Continues on error

6. **Publish to JSR** - Publishes package to JSR registry
   - Only runs on pushes to master branch
   - Requires JSR_TOKEN secret
   - Continues on error if publishing fails

7. **Deploy Worker** - Deploys to Cloudflare Workers
   - Only runs on pushes to master branch
   - Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets
   - Continues on error if deployment fails

8. **Deploy Pages** - Deploys to Cloudflare Pages
   - Only runs on pushes to master branch
   - Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets
   - Continues on error if deployment fails

9. **Notify on Failure** - Sends notifications on build failures
   - Only runs on push events if any required job fails

## Required Secrets

For full functionality, configure these secrets in your repository settings:

- `JSR_TOKEN` - Token for publishing to JSR registry
- `CODECOV_TOKEN` - Token for uploading code coverage (optional)
- `CLOUDFLARE_API_TOKEN` - Token for Cloudflare deployments (optional)
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID (optional)

## Deno Version Requirements

- **Minimum**: Deno 2.0
- **Recommended**: Deno 2.4 or later
- **Reason**: Deno 2.4 restored the `deno bundle` command which is required for the build step

## Production-Ready Features

- ✅ All external service failures are handled gracefully (continue-on-error)
- ✅ Works on repository forks (SARIF upload is conditional)
- ✅ Matrix testing across multiple Deno versions
- ✅ Proper caching for faster builds
- ✅ Comprehensive error handling
- ✅ Security scanning included
- ✅ Deployment automation (optional, requires secrets)
- ✅ Code coverage reporting (optional, requires token)

## Local Development

To run the same checks locally:

```bash
# Lint
deno task lint

# Format check
deno task fmt:check

# Type check
deno task check

# Run tests
deno task test

# Run tests with coverage
deno task test:coverage
deno coverage coverage --lcov --output=coverage.lcov

# Bundle worker (requires Deno 2.4+)
cd examples/cloudflare-worker
deno bundle --output=dist/worker.js src/worker.ts
```

## Troubleshooting

### Bundle Step Fails

If the bundle step fails with "deno bundle command not found", ensure you're using Deno 2.4 or later:

```bash
deno upgrade --version 2.4.0
```

### SARIF Upload Fails

This is expected on forks or repositories without GitHub Advanced Security. The workflow is configured to continue on error.

### JSR Publish Fails

Ensure the JSR_TOKEN secret is correctly configured. The workflow will continue even if publishing fails.

### Deployment Fails

Deployment jobs require Cloudflare secrets. The workflow will continue even if deployment fails, allowing other jobs to complete.
