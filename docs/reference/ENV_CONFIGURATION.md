# Environment Configuration

This project uses a layered environment configuration system powered by `.envrc` and `direnv`.

## How It Works

Environment variables are loaded in the following order (later files override earlier ones):

1. **`.env`** - Base configuration shared across all environments (committed to git)
2. **`.env.$ENV`** - Environment-specific configuration (committed to git)
3. **`.env.local`** - Local overrides and secrets (NOT committed to git)

The `$ENV` variable is automatically determined by your current git branch:

| Git Branch              | Environment   | Loaded File         |
| ----------------------- | ------------- | ------------------- |
| `main`                  | `production`  | `.env.production`   |
| `dev` or `develop`      | `development` | `.env.development`  |
| Other branches          | `local`       | `.env.local`        |
| Custom branch with file | Custom        | `.env.$BRANCH_NAME` |

## File Structure

```
.env                  # Base config (PORT, COMPILER_VERSION, etc.)
.env.development      # Development-specific (test API keys, local DB)
.env.production       # Production-specific (placeholder values)
.env.local            # Your personal secrets (NEVER commit this!)
.env.example          # Template showing all available variables
```

## Setup Instructions

### 1. Enable direnv (if not already installed)

```bash
# macOS
brew install direnv

# Add to your shell config (~/.zshrc)
eval "$(direnv hook zsh)"
```

### 2. Allow the .envrc file

```bash
direnv allow
```

You should see: `✅ Loaded environment: development (branch: dev)`

### 3. Create your .env.local file

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual secrets and API keys.

## What Goes Where?

### `.env` (Committed)

- Non-sensitive defaults
- Port numbers
- Version numbers
- Public configuration

### `.env.development` / `.env.production` (Committed)

- Environment-specific defaults
- Test API keys (development only)
- Environment-specific feature flags
- Non-secret configuration

### `.env.local` (NOT Committed)

- **ALL secrets and API keys**
- Database connection strings
- Authentication tokens
- Personal overrides

## Wrangler Integration

> **Rule:** Use `.envrc`/`.env.local` for ALL local development. Do **not** add new variables to `wrangler.toml [vars]` — that section is reserved for Cloudflare-specific runtime bindings (KV namespace IDs, D1 IDs, queue names, etc.) and truly static non-secret constants like `COMPILER_VERSION`.

The `wrangler.toml` configuration supports environment-based deployments. Production is the default (top-level) environment; there is no `--env production` flag:

```bash
# Development deployment (uses [env.development] overrides in wrangler.toml)
wrangler deploy --env development

# Production deployment (uses top-level wrangler.toml config — no --env flag needed)
wrangler deploy
```

Environment variables from `.env.local` are automatically available during local development (`wrangler dev`).

For production deployments, all runtime secrets and configuration should be set using:

```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put ADMIN_KEY
wrangler secret put DATABASE_URL
# ... see docs/auth/configuration.md for the full list
```

## Troubleshooting

### Environment not loading?

```bash
# Re-allow the .envrc
direnv allow

# Check what's loaded
direnv exec . env | grep DATABASE_URL
```

### Wrong environment?

Check your git branch:

```bash
git branch --show-current
```

The `.envrc` automatically maps your branch to an environment.

### Variables not available?

Make sure:

1. You've created `.env.local` from `.env.example`
2. You've run `direnv allow`
3. The variable exists in one of the .env files

## Security Best Practices

- ✅ **DO** commit `.env`, `.env.development`, `.env.production`
- ✅ **DO** use test/dummy values in committed files
- ✅ **DO** put all secrets in `.env.local`
- ✅ **DO** add every new variable to `.env.example` with a comment stub before merging
- ❌ **DON'T** commit `.env.local`
- ⚠️ **BE CAREFUL** with `.envrc` — it is committed as part of the env-loading system, so never put secrets or credentials in it
- ❌ **DON'T** put real secrets in any committed file
- ❌ **DON'T** commit production credentials
- ❌ **DON'T** add new environment variables to `wrangler.toml [vars]` — use `.env.example` + `.env.local` instead

## GitHub Actions Integration

This environment system works seamlessly in GitHub Actions workflows. See [ENV_SETUP.md](../workflows/ENV_SETUP.md) for detailed documentation.

### Quick Start

```yaml
steps:
    - uses: actions/checkout@v4

    - name: Load environment variables
      uses: ./.github/actions/setup-env

    - name: Use environment variables
      run: echo "Version: $COMPILER_VERSION"
```

The action automatically:

- Detects environment from branch name
- Loads `.env` and `.env.$ENV` files
- Exports variables to workflow

## Environment Variables Reference

See `.env.example` for a complete list of available variables and their purposes.

### Key Variables by Category

| Category | Variables | Where to set locally |
|----------|-----------|---------------------|
| Core | `PORT`, `COMPILER_VERSION` | `.env` (committed defaults) |
| Database | `DATABASE_URL`, `DIRECT_DATABASE_URL` | `.env.local` |
| Clerk Auth | `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWKS_URL`, `CLERK_WEBHOOK_SECRET` | `.env.local` |
| CF Access | `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | `.env.local` |
| Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | `.env.development` (test keys) / `.env.local` (prod keys) |
| Logging | `LOG_LEVEL`, `LOG_STRUCTURED`, `LOG_SINK_URL`, `LOG_SINK_TOKEN` | `.env.local` or `.env.development` |
| Error reporting | `ERROR_REPORTER_TYPE`, `SENTRY_DSN`, `DATADOG_API_KEY` | `.env.local` |
| Notifications | `WEBHOOK_URL`, `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` | `.env.local` |
| Cloudflare API | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `.env.local` |
| Testing | `E2E_BASE_URL`, `SKIP_CONTRACT_TESTS`, `STORAGE_BACKEND` | `.env.local` or CI secrets |

For auth-specific variables, see [docs/auth/configuration.md](../auth/configuration.md).
