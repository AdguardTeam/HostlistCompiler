# GitHub Actions Environment Setup

This project uses a layered environment configuration system that automatically loads variables based on the git branch.

## How It Works

The `.github/actions/setup-env` composite action mimics the behavior of `.envrc` for GitHub Actions workflows:

1. Detects the environment from the branch name
2. Loads `.env` (base configuration)
3. Loads `.env.$ENV` (environment-specific)
4. Exports all variables to `$GITHUB_ENV`

## Branch to Environment Mapping

| Branch Pattern              | Environment   | Loaded Files                        |
|-----------------------------|---------------|-------------------------------------|
| `main`                     | `production`  | `.env`, `.env.production`           |
| `dev`, `develop`           | `development` | `.env`, `.env.development`          |
| Other branches (with file) | Custom        | `.env`, `.env.$BRANCH_NAME`         |
| Other branches (no file)   | Default       | `.env`                              |

## Usage in Workflows

### Basic Usage

```yaml
steps:
  - uses: actions/checkout@v4
  
  - name: Load environment variables
    uses: ./.github/actions/setup-env
  
  - name: Use environment variables
    run: |
      echo "Compiler version: $COMPILER_VERSION"
      echo "Port: $PORT"
```

### With Custom Branch

```yaml
- name: Load environment variables for specific branch
  uses: ./.github/actions/setup-env
  with:
    branch: 'staging'
```

### Access Detected Environment

```yaml
- name: Load environment variables
  id: env
  uses: ./.github/actions/setup-env

- name: Use detected environment
  run: echo "Running in ${{ steps.env.outputs.environment }} environment"
```

## Environment Variables Available

After loading, the following variables are available:

### From `.env` (all environments)
- `COMPILER_VERSION` - Current compiler version
- `PORT` - Server port (default: 8787)
- `DENO_DIR` - Deno cache directory

### From `.env.development` (dev/develop branches)
- `DATABASE_URL` - Local SQLite database path
- `TURNSTILE_SITE_KEY` - Test Turnstile site key (always passes)
- `TURNSTILE_SECRET_KEY` - Test Turnstile secret key

### From `.env.production` (main branch)
- `DATABASE_URL` - Production database URL (placeholder)
- `TURNSTILE_SITE_KEY` - Production site key (placeholder)
- `TURNSTILE_SECRET_KEY` - Production secret key (placeholder)

**Note**: Production secrets should be set using GitHub Secrets, not loaded from files.

## Setting Production Secrets

For production deployments, set secrets in GitHub repository settings:

```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  ADMIN_KEY: ${{ secrets.ADMIN_KEY }}
  TURNSTILE_SECRET_KEY: ${{ secrets.TURNSTILE_SECRET_KEY }}
```

Required secrets for production:
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `ADMIN_KEY` - Admin API key
- `TURNSTILE_SITE_KEY` - Production Turnstile site key
- `TURNSTILE_SECRET_KEY` - Production Turnstile secret key

## Example: Deploy Workflow

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Load environment variables
        id: env
        uses: ./.github/actions/setup-env
      
      - name: Deploy to environment
        run: |
          if [ "${{ steps.env.outputs.environment }}" = "production" ]; then
            wrangler deploy --env production
          else
            wrangler deploy --env development
          fi
        env:
          # Production secrets override file-based config
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          ADMIN_KEY: ${{ secrets.ADMIN_KEY }}
```

## Comparison: Local vs CI

| Aspect | Local Development | GitHub Actions |
|--------|------------------|----------------|
| Loader | `.envrc` + `direnv` | `.github/actions/setup-env` |
| Detection | Git branch (real-time) | `github.ref_name` |
| Secrets | `.env.local` (not committed) | GitHub Secrets |
| Override | `.env.local` overrides all | GitHub env vars override files |

## Debugging

To see what environment is detected and what variables are loaded:

```yaml
- name: Load environment variables
  id: env
  uses: ./.github/actions/setup-env

- name: Debug environment
  run: |
    echo "Environment: ${{ steps.env.outputs.environment }}"
    echo "Branch: ${{ github.ref_name }}"
    env | grep -E 'COMPILER_VERSION|PORT|DATABASE_URL' || true
```

## Security Best Practices

1. ✅ **DO** use GitHub Secrets for production credentials
2. ✅ **DO** load base config from `.env` files
3. ✅ **DO** use test keys in `.env.development`
4. ❌ **DON'T** commit real secrets to `.env.*` files
5. ❌ **DON'T** echo secret values in workflow logs
6. ❌ **DON'T** use production credentials in PR builds
