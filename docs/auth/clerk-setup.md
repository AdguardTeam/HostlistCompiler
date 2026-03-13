# Clerk Dashboard Setup Guide

This guide walks you through creating and configuring a Clerk application for the adblock-compiler.

## Prerequisites

- A [Clerk account](https://dashboard.clerk.com/sign-up) (free tier is sufficient to start)
- Access to your Cloudflare Workers dashboard
- The adblock-compiler deployed (or running locally)

## Step 1: Create a Clerk Application

1. Sign in to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Click **"Add application"**
3. Enter your application name (e.g., `Adblock Compiler`)
4. Choose your sign-in options:
   - **Recommended**: Email address + Google OAuth
   - Optional: GitHub, Apple, or other social providers
5. Click **"Create application"**

## Step 2: Get Your API Keys

After creating the application, navigate to **API Keys** in the sidebar:

| Key | Where to Use | Example Format |
|-----|-------------|----------------|
| **Publishable Key** | Worker env (`CLERK_PUBLISHABLE_KEY`) | `pk_test_...` or `pk_live_...` |
| **Secret Key** | Worker env (`CLERK_SECRET_KEY`) — **never expose** | `sk_test_...` or `sk_live_...` |

> **Important**: The publishable key is safe to expose publicly. The secret key must be stored as a Cloudflare Worker secret.

## Step 3: Configure URLs

Navigate to **Paths** (under "Configure" in sidebar):

### Sign-in and Sign-up URLs

| Setting | Value |
|---------|-------|
| **Sign-in URL** | `/sign-in` |
| **Sign-up URL** | `/sign-up` |
| **After sign-in URL** | `/compiler` |
| **After sign-up URL** | `/compiler` |

### Allowed Origins

Under **Domains** → **Allowed origins**, add:

```
https://your-worker.workers.dev
https://your-custom-domain.com
http://localhost:4200          (for Angular dev server)
http://localhost:8787          (for Wrangler local dev)
```

## Step 4: Configure JWT Templates (Optional)

By default, Clerk JWTs include standard claims. To include tier information in the JWT:

1. Go to **JWT Templates** in the sidebar
2. Click **"New template"** → **"Blank"**
3. Name it `adblock-compiler`
4. Add custom claims:

```json
{
    "metadata": "{{user.public_metadata}}"
}
```

This ensures the user's tier (set in public metadata) is available in the JWT payload, reducing database lookups.

> **Note**: If you don't configure a JWT template, the system will look up the user's tier from the database on each request. Both approaches work; the JWT template approach is more performant.

## Step 5: Configure Webhooks

Webhooks sync user data between Clerk and your Cloudflare D1 database.

1. Go to **Webhooks** in the sidebar
2. Click **"Add Endpoint"**
3. Configure:

| Setting | Value |
|---------|-------|
| **Endpoint URL** | `https://your-worker.workers.dev/api/webhooks/clerk` |
| **Message Filtering** | Select: `user.created`, `user.updated`, `user.deleted` |

4. Click **"Create"**
5. Copy the **Signing Secret** (starts with `whsec_...`)

> **Important**: Store the signing secret as `CLERK_WEBHOOK_SECRET` in your Worker secrets.

### Testing Webhooks

Clerk provides a **"Testing"** tab on each webhook endpoint:

1. Select an event type (e.g., `user.created`)
2. Click **"Send test webhook"**
3. Check the delivery log for a `200` response

### Webhook Events Handled

| Event | Action | Database Effect |
|-------|--------|----------------|
| `user.created` | Create/update user record | Insert into `users` table |
| `user.updated` | Update user profile/tier | Update `users` table |
| `user.deleted` | Delete user | Hard-delete from `users` table |

## Step 6: Set User Tiers via Public Metadata

User tiers are stored in Clerk's **public metadata**. To set a user's tier:

### Via Clerk Dashboard

1. Go to **Users** in the sidebar
2. Click on a user
3. Scroll to **Public metadata**
4. Click **"Edit"** and set:

```json
{
    "tier": "pro",
    "role": "user"
}
```

### Available Tiers

| Tier Value | Numeric Order | Description |
|-----------|---------------|-------------|
| `anonymous` | 0 | Unauthenticated (system-assigned) |
| `free` | 1 | Default for new signups |
| `pro` | 2 | Paid subscriber |
| `admin` | 3 | Full admin access |

### Via Clerk Backend API

```bash
curl -X PATCH https://api.clerk.com/v1/users/{user_id}/metadata \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "public_metadata": {
      "tier": "pro",
      "role": "user"
    }
  }'
```

> **Tip**: When a user's tier is updated via the API or dashboard, Clerk fires a `user.updated` webhook, which automatically syncs the change to your Cloudflare D1 database.

## Step 7: Configure Environment Variables

### Local Development — Use direnv/.env.local (recommended)

This project uses **direnv** + `.envrc` for local env management. Add your Clerk keys to `.env.local` (gitignored):

```bash
# .env.local (copy from .env.example, then fill in your real values)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_WEBHOOK_SECRET=whsec_...
```

Run `direnv allow` once in the repo root to activate automatic loading.

### Production Deployment — Use wrangler secret put

For Cloudflare Workers production deployments, store all Clerk variables as Worker secrets:

```bash
# All Clerk variables (use prod pk_live_ / sk_live_ keys)
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_JWKS_URL
wrangler secret put CLERK_WEBHOOK_SECRET
```

### Finding Your JWKS URL

1. Go to **API Keys** in the Clerk dashboard
2. Note the **Frontend API URL** (e.g., `https://abc-123.clerk.accounts.dev`)
3. Append `/.well-known/jwks.json`
4. Full URL: `https://abc-123.clerk.accounts.dev/.well-known/jwks.json`

## Step 8: Test the Integration

### Verify JWT Authentication

```bash
# 1. Sign in via the frontend to get a Clerk session
# 2. Copy the JWT from browser DevTools (Application → Cookies → __session)
# 3. Test an authenticated endpoint:

curl -X GET https://your-worker.workers.dev/api/keys \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

### Verify Webhook Delivery

1. Create a test user in Clerk dashboard
2. Check your Worker logs for webhook processing
3. Verify the user appears in your D1 `users` table:

```bash
# Query via Wrangler (remote D1)
wrangler d1 execute adblock-compiler-d1-database --remote \
  --command="SELECT id, email, tier, clerk_user_id FROM users ORDER BY created_at DESC LIMIT 5;"
```

### Verify Public Metadata Tier

1. Set a user's tier to `admin` in Clerk dashboard
2. Sign in as that user
3. Access an admin endpoint — should succeed
4. Sign in as a `free` user — admin endpoints should return 403

## Troubleshooting

### "Invalid JWT" Errors

- Verify `CLERK_JWKS_URL` is correct and accessible
- Ensure the JWT hasn't expired (default lifetime: 60 seconds)
- Check that the Clerk instance is in the correct mode (test vs. live)

### "Webhook signature verification failed"

- Verify `CLERK_WEBHOOK_SECRET` matches the signing secret in Clerk dashboard
- Ensure the webhook endpoint URL exactly matches (including trailing slash behavior)
- Check that the Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`) are being forwarded

### "User not found" After Sign-Up

- Verify the `user.created` webhook is configured and delivering
- Check Worker logs for webhook processing errors
- Manually trigger a test webhook from the Clerk dashboard

### JWT Template Not Applied

- Ensure the JWT template name matches what the frontend requests via `getToken({ template: 'adblock-compiler' })`
- If no template is specified, Clerk returns a default JWT without custom claims

## Security Checklist

- [ ] `CLERK_SECRET_KEY` stored as Worker secret (not in `wrangler.toml`)
- [ ] `CLERK_WEBHOOK_SECRET` stored as Worker secret
- [ ] Allowed origins configured for all deployment URLs
- [ ] Test mode (`pk_test_`) keys NOT used in production
- [ ] Webhook endpoint only accepts POST requests
- [ ] JWKS URL is correct and accessible from Workers
- [ ] Admin users have `tier: "admin"` in public metadata
- [ ] CF Access configured for admin routes (optional but recommended)

---

## Step 9: Deploy to Cloudflare Workers

This section walks through deploying the full Clerk integration to a Cloudflare Worker from scratch.

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated (`wrangler login`)
- A Cloudflare account with Workers and D1 enabled
- Clerk API keys from Steps 2 and 5 above

### 9a. Apply the D1 Migration

The `users` table (used by the Clerk webhook handler) lives in Cloudflare D1. Apply the migration to the remote D1 database before deploying:

```bash
# Apply the Clerk users migration to the remote D1 database
wrangler d1 migrations apply adblock-compiler-d1-database --remote
```

Verify the table was created:

```bash
wrangler d1 execute adblock-compiler-d1-database --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table';"
```

You should see `users` (and other D1 tables) in the output.

### 9b. Set Worker Secrets

Store all secrets via Wrangler's secret management — **never** commit real keys to `wrangler.toml`:

```bash
# Clerk authentication secrets
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET
```

When prompted, paste the corresponding values from your Clerk dashboard.

### 9c. Add Public Variables to wrangler.toml

`CLERK_PUBLISHABLE_KEY` and `CLERK_JWKS_URL` are public (non-secret) values that belong in `wrangler.toml [vars]`:

```toml
# wrangler.toml
[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_..."          # from Clerk Dashboard → API Keys
CLERK_JWKS_URL        = "https://<instance>.clerk.accounts.dev/.well-known/jwks.json"
```

> **Note:** For local development, put these in `.env.local` (loaded by direnv) rather than `wrangler.toml`.

### 9d. Deploy the Worker

```bash
# Using the project task (runs preflight checks first)
deno task wrangler:deploy

# Or directly with Wrangler
wrangler deploy
```

After deployment, confirm the worker is live:

```bash
curl https://your-worker.workers.dev/api/version
```

### 9e. Update the Webhook Endpoint URL

Back in the Clerk Dashboard:

1. Go to **Webhooks** → your endpoint
2. Update the **Endpoint URL** to your production Worker URL:
   ```
   https://your-worker.workers.dev/api/webhooks/clerk
   ```
3. Click **Save**

If you previously used a local dev URL (e.g., from `wrangler dev` or Cloudflare Tunnel), remove it and add only the production URL.

### 9f. Verify End-to-End

**Test webhook delivery:**

1. In the Clerk Dashboard, go to **Webhooks** → your endpoint → **Testing** tab
2. Select `user.created` and click **Send test webhook**
3. The delivery log should show a `200 OK` response
4. Confirm the user appeared in D1:

```bash
wrangler d1 execute adblock-compiler-d1-database --remote \
  --command="SELECT id, email, tier FROM users ORDER BY created_at DESC LIMIT 3;"
```

**Test JWT authentication:**

```bash
# Sign in via the Angular frontend, then copy the session token from
# browser DevTools (Application → Cookies → __session) and test:
curl https://your-worker.workers.dev/api/keys \
  -H "Authorization: Bearer <your-clerk-jwt>"
```

### 9g. Switch to Production Keys

When ready to go live, replace test keys with production keys:

```bash
# Update the secret with the sk_live_ key
wrangler secret put CLERK_SECRET_KEY   # paste sk_live_...
```

And in `wrangler.toml`:

```toml
[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_..."   # was pk_test_...
```

> **Reminder:** After changing `wrangler.toml`, redeploy with `wrangler deploy`.
