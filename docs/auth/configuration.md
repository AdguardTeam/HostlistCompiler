# Authentication Configuration Guide

Complete reference for all environment variables and configuration needed to run the adblock-compiler authentication system.

## Environment Variables

### Clerk Authentication (Required)

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk Dashboard → API Keys | Public key for frontend Clerk initialization. Starts with `pk_test_` or `pk_live_`. |
| `CLERK_SECRET_KEY` | **Yes** | Clerk Dashboard → API Keys | Secret key for backend operations. **Never expose.** Starts with `sk_test_` or `sk_live_`. |
| `CLERK_JWKS_URL` | **Yes** | Derived from Clerk Frontend API URL | JWKS endpoint for JWT verification. Format: `https://<instance>.clerk.accounts.dev/.well-known/jwks.json` |
| `CLERK_WEBHOOK_SECRET` | **Yes** | Clerk Dashboard → Webhooks → Endpoint → Signing Secret | Svix signing secret for webhook signature verification. Starts with `whsec_`. |

### Admin Access (Legacy)

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `ADMIN_KEY` | Optional | Self-generated | Static admin key for legacy admin endpoints. Used with `X-Admin-Key` header. Will be replaced by Clerk tier-based auth in a future release. |

### Cloudflare Access (Optional — Defense-in-Depth)

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `CF_ACCESS_TEAM_DOMAIN` | Optional | Cloudflare Zero Trust Dashboard | Your Cloudflare Access team domain (e.g., `mycompany`). If not set, CF Access checks are skipped. |
| `CF_ACCESS_AUD` | Optional | CF Access → Applications → Application Audience (AUD) Tag | Audience claim for CF Access JWT verification. Required if `CF_ACCESS_TEAM_DOMAIN` is set. |

### Cloudflare Turnstile (Optional — Bot Protection)

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `TURNSTILE_SITE_KEY` | Optional | Cloudflare Dashboard → Turnstile | Public site key for frontend widget. Returned to clients via `/api/turnstile-config`. |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Dashboard → Turnstile | Secret key for server-side token verification. If not set, Turnstile is disabled. |

### Database (Required)

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string | Hyperdrive connection URL in production; local PostgreSQL URL in development. |

## Setting Variables and Secrets in Cloudflare Workers

### Public Variables (wrangler.toml)

Non-sensitive configuration should be committed in `wrangler.toml` under `[vars]`:

```toml
[vars]
# Clerk public key — safe to commit (starts with pk_test_ or pk_live_)
CLERK_PUBLISHABLE_KEY = "pk_live_..."

# Clerk JWKS URL — public endpoint, safe to commit
CLERK_JWKS_URL = "https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json"
```

### Secrets (wrangler secret put)

**Never** put secrets in `wrangler.toml`. Use Cloudflare Worker secrets for sensitive values:

```bash
# Required auth secrets
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET

# Legacy admin (optional — will be deprecated)
wrangler secret put ADMIN_KEY

# Cloudflare Access (optional)
wrangler secret put CF_ACCESS_TEAM_DOMAIN
wrangler secret put CF_ACCESS_AUD

# Turnstile (optional)
wrangler secret put TURNSTILE_SITE_KEY
wrangler secret put TURNSTILE_SECRET_KEY

# Database
wrangler secret put DATABASE_URL
```

## Local Development Setup

### Option A: Using .env.local (Recommended)

Create `.env.local` (gitignored) with your development keys:

```bash
# .env.local — NOT committed to git
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_WEBHOOK_SECRET=whsec_...

# Optional — use test keys for local dev
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Admin key for local testing
ADMIN_KEY=local-dev-admin-key

# Local PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/adblock_compiler
```

### Option B: Using direnv

The project uses `.envrc` with direnv for automatic environment loading. See [Environment Configuration](../reference/ENV_CONFIGURATION.md) for details.

### Option C: Using Wrangler Dev

```bash
# Start local dev with secrets from .dev.vars
echo 'CLERK_PUBLISHABLE_KEY=pk_test_...' >> .dev.vars
echo 'CLERK_SECRET_KEY=sk_test_...' >> .dev.vars
wrangler dev
```

## Frontend Configuration

The Angular frontend does **not** require build-time environment files. All auth configuration is fetched at runtime:

| Endpoint | Response | Purpose |
|----------|----------|---------|
| `GET /api/clerk-config` | `{ publishableKey: "pk_..." }` | Clerk publishable key for `@clerk/clerk-js` initialization |
| `GET /api/turnstile-config` | `{ siteKey: "...", enabled: true }` | Turnstile widget configuration |

### How It Works

1. Angular app starts → `app.config.ts` runs initialization
2. Fetches `/api/turnstile-config` → configures Turnstile widget
3. Fetches `/api/clerk-config` → initializes `ClerkService` with the publishable key
4. `ClerkService` loads `@clerk/clerk-js` and listens for auth state changes
5. `authInterceptor` automatically attaches JWT to API requests

### Angular Injection Tokens

Defined in `frontend/src/app/tokens.ts`:

| Token | Type | Default | Description |
|-------|------|---------|-------------|
| `TURNSTILE_SITE_KEY` | `InjectionToken<string>` | `''` | Turnstile public site key |
| `API_BASE_URL` | `InjectionToken<string>` | `/api` | Base URL for API calls |

> **Note:** The Clerk publishable key is fetched from `GET /api/clerk-config` at runtime rather than provided as a static injection token, matching the Turnstile pattern.

## Database Schema

The auth system uses PostgreSQL (via Cloudflare Hyperdrive) with these tables:

### `users` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `clerkId` | String | Clerk user ID (unique, indexed) |
| `email` | String | Primary email from Clerk |
| `firstName` | String? | First name |
| `lastName` | String? | Last name |
| `imageUrl` | String? | Profile picture URL |
| `tier` | Enum | `anonymous`, `free`, `pro`, `admin` |
| `role` | String? | User role from Clerk metadata |
| `emailVerified` | Boolean | Email verification status |
| `clerkCreatedAt` | DateTime? | When user was created in Clerk |
| `clerkUpdatedAt` | DateTime? | Last update in Clerk |
| `lastSignInAt` | DateTime? | Last sign-in timestamp |
| `createdAt` | DateTime | Record creation time |
| `updatedAt` | DateTime | Last record update |

### `api_keys` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → `users.id` |
| `keyHash` | String | SHA-256 hash of the plaintext key |
| `keyPrefix` | String | First 8 characters for display (e.g., `abc_Xk9m`) |
| `name` | String | User-provided key name (max 100 chars) |
| `scopes` | String[] | Authorized scopes: `compile`, `rules`, `admin` |
| `rateLimitPerMinute` | Int | Per-key rate limit (default: 60) |
| `expiresAt` | DateTime? | Optional expiration (1–365 days) |
| `revokedAt` | DateTime? | Soft-delete timestamp |
| `lastUsedAt` | DateTime? | Last authentication timestamp |
| `createdAt` | DateTime | Record creation time |
| `updatedAt` | DateTime | Last record update |

## Deployment Checklist

### First-Time Setup

1. [ ] Create Clerk application ([guide](clerk-setup.md))
2. [ ] Configure Clerk sign-in/sign-up URLs
3. [ ] Configure Clerk allowed origins
4. [ ] Set up Clerk webhook endpoint
5. [ ] Store all secrets via `wrangler secret put`
6. [ ] Run Prisma migrations: `deno task db:migrate`
7. [ ] Deploy worker: `wrangler deploy`
8. [ ] Test webhook delivery from Clerk dashboard
9. [ ] Create first admin user (set `tier: admin` in Clerk public metadata)
10. [ ] Verify end-to-end auth flow

### Production Upgrade

1. [ ] Switch from `pk_test_` / `sk_test_` to `pk_live_` / `sk_live_` keys
2. [ ] Update webhook endpoint URL to production domain
3. [ ] Configure CF Access for admin routes (recommended)
4. [ ] Enable Turnstile for bot protection
5. [ ] Set up monitoring/alerts for auth failures
6. [ ] Remove or rotate `ADMIN_KEY` if migrating to Clerk-only admin auth

## Conditional Feature Behavior

| Feature | When Enabled | When Disabled |
|---------|-------------|---------------|
| Clerk Auth | `CLERK_JWKS_URL` is set | JWT verification skipped; anonymous access only |
| Turnstile | `TURNSTILE_SECRET_KEY` is set | Bot protection disabled; compilation requests not verified |
| CF Access | `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` set | CF Access checks skipped on admin routes |
| Admin Key | `ADMIN_KEY` is set | Legacy admin endpoints return "not configured" |
