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

The `wrangler.toml` configuration supports environment-based deployments:

```bash
# Development deployment
wrangler deploy --env development

# Production deployment
wrangler deploy --env production
```

Environment variables from `.env.local` are automatically available during local development (`wrangler dev`).

For production deployments, secrets should be set using:

```bash
wrangler secret put ADMIN_KEY --env production
wrangler secret put TURNSTILE_SECRET_KEY --env production
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
- ❌ **DON'T** commit `.env.local`
- ⚠️ **BE CAREFUL** with `.envrc` — it is committed as part of the env-loading system, so never put secrets or credentials in it
- ❌ **DON'T** put real secrets in any committed file
- ❌ **DON'T** commit production credentials

## GitHub Actions Integration

This environment system works seamlessly in GitHub Actions workflows. See [.github/ENV_SETUP.md](.github/ENV_SETUP.md) for detailed documentation.

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
