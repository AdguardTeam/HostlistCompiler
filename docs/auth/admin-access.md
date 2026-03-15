# Admin Access Guide

How admin endpoints are protected and how to configure admin access.

## Current Admin Authentication

Admin routes use **Clerk JWT-based authentication** as the primary layer, with optional Cloudflare Access as defense-in-depth. The `/admin/*` Angular panel and all backing API endpoints are fully protected.

### Layer 1: Clerk JWT (Primary)

Admin requests require a valid Clerk JWT with `publicMetadata.role === 'admin'`. The Angular admin panel attaches this automatically via the HTTP interceptor. For API access:

```bash
# Obtain a session token from Clerk, then:
curl -X GET https://adblock-compiler.jayson-knight.workers.dev/admin/roles/me \
  -H "Authorization: Bearer <clerk-session-jwt>"
```

Within the admin system, a **granular sub-role** (`viewer` / `editor` / `super-admin`) is resolved from the Admin D1 database and cached in KV. Endpoints enforce the required permission via `requireAdminPermission('...')` middleware.

### Layer 2: Static Admin Key (Legacy, for `/admin/storage/*` only)

The legacy storage endpoints retain `X-Admin-Key` header support for backward compatibility:

```bash
curl -X GET https://adblock-compiler.jayson-knight.workers.dev/admin/storage/stats \
  -H "X-Admin-Key: your-admin-key-here"
```

**Configuration:**
```bash
wrangler secret put ADMIN_KEY
```

### Layer 3: Cloudflare Access (Defense-in-Depth)

When configured, admin routes also require a valid Cloudflare Access JWT:

1. User authenticates via Cloudflare Access (SSO, email OTP, etc.)
2. CF Access sets a `CF-Access-JWT-Assertion` header
3. Worker verifies the JWT against CF Access JWKS
4. If CF Access is not configured (`CF_ACCESS_TEAM_DOMAIN` not set), this layer is skipped

**Configuration:**
```bash
wrangler secret put CF_ACCESS_TEAM_DOMAIN  # e.g., "mycompany"
wrangler secret put CF_ACCESS_AUD          # Application audience tag
```

## Clerk-Based Admin Auth

> **Status**: ✅ Complete — shipped in PR #1058 (v0.60.0)

### Current State

| Feature | Status |
|---------|--------|
| `ADMIN_KEY` static key | ✅ Active (legacy, storage endpoints only) |
| CF Access verification | ✅ Active (when configured) |
| Clerk `requireAuth()` on admin routes | ✅ Active |
| Clerk `requireAdminPermission()` on admin routes | ✅ Active |
| Granular sub-roles (viewer/editor/super-admin) | ✅ Active (Admin D1 + KV) |
| Audit logging for every admin action | ✅ Active |

### How to Become an Admin

1. **Sign up** — Create an account via the web UI or Clerk
2. **Set tier in Clerk** — An existing admin sets your tier to `admin` in Clerk public metadata:

   **Via Clerk Dashboard:**
   - Go to [dashboard.clerk.com](https://dashboard.clerk.com) → Users
   - Find the user → Public metadata → Edit
   - Set: `{ "tier": "admin", "role": "admin" }`

   **Via Clerk API:**
   ```bash
   curl -X PATCH https://api.clerk.com/v1/users/{user_id}/metadata \
     -H "Authorization: Bearer sk_live_..." \
     -H "Content-Type: application/json" \
     -d '{"public_metadata": {"tier": "admin", "role": "admin"}}'
   ```

3. **Webhook syncs** — Clerk fires a `user.updated` event → Worker updates the `users` table with `tier = admin`
4. **Access granted** — Requests with this user's JWT pass `requireAdminPermission()` checks
5. **Assign sub-role** — Visit `/admin/roles` to assign `editor` or `super-admin` sub-role (defaults to `viewer`)

### Bootstrap Problem: First Admin

When setting up a fresh installation with no existing admins:

1. **Option A (Recommended)**: Use the Clerk dashboard directly — it doesn't require admin auth to access. Set `tier: admin, role: admin` on your user in the Clerk dashboard UI.

2. **Option B**: Use the Clerk Backend API with your `CLERK_SECRET_KEY`:
   ```bash
   # Find your user ID
   curl https://api.clerk.com/v1/users?email_address=you@example.com \
     -H "Authorization: Bearer sk_live_..."

   # Set admin tier
   curl -X PATCH https://api.clerk.com/v1/users/{your_user_id}/metadata \
     -H "Authorization: Bearer sk_live_..." \
     -d '{"public_metadata": {"tier": "admin", "role": "admin"}}'
   ```

3. **Option C (Legacy)**: Use the `ADMIN_KEY` for initial storage endpoint access, then migrate to Clerk auth.

## Admin Endpoints Reference

The admin system exposes 27 API endpoints across 8 resource groups. See the [Admin API Reference](../admin/api-reference.md) for the full list with request/response schemas.

**Resource groups:**

| Group | Base Path | Description |
|-------|-----------|-------------|
| Roles | `/admin/roles` | Role definitions, assignments, permission resolution |
| Users | `/admin/users` | User management, tier editing, suspension |
| Tiers | `/admin/config/tiers` | Runtime-editable tier registry |
| Scopes | `/admin/config/scopes` | Runtime-editable scope registry |
| Endpoints | `/admin/config/endpoints` | Per-endpoint auth overrides |
| Feature Flags | `/admin/config/flags` | Flag CRUD + rollout controls |
| Audit Logs | `/admin/audit-logs` | Immutable audit trail (paginated, filtered) |
| API Keys | `/admin/keys` | Cross-user key management + revocation |
| Announcements | `/admin/announcements` | System banner management |
| Storage | `/admin/storage/*` | Legacy storage tools (stats, export, query) |

### Example: Get Current User Permissions

```bash
# Using Clerk JWT (current)
curl -X GET https://your-worker.workers.dev/admin/roles/me \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."

# Response
{
  "role": "editor",
  "permissions": ["admin:read", "config:write", "users:read", "flags:write"]
}
```

## Cloudflare Access Setup (Recommended)

For production admin routes, configure Cloudflare Access as a defense-in-depth layer:

### 1. Create a Cloudflare Access Application

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → Access → Applications
2. Click **"Add an application"** → **Self-hosted**
3. Configure:
   - **Application name**: `Adblock Compiler Admin`
   - **Application domain**: `your-worker.workers.dev`
   - **Path**: `/admin/*`
4. Add an access policy:
   - **Policy name**: `Admin Users`
   - **Action**: Allow
   - **Include**: Emails matching your admin list

### 2. Get the AUD Tag

1. After creating the application, go to its settings
2. Copy the **Application Audience (AUD) Tag**
3. Store it:
   ```bash
   wrangler secret put CF_ACCESS_AUD
   ```

### 3. Set the Team Domain

```bash
wrangler secret put CF_ACCESS_TEAM_DOMAIN
# Enter your team name (e.g., "mycompany")
# This corresponds to: https://mycompany.cloudflareaccess.com
```

### How CF Access Works with the Worker

1. User navigates to `/admin/storage/stats`
2. Cloudflare Access intercepts → shows login page (email OTP, SSO, etc.)
3. After authentication, CF Access sets `CF-Access-JWT-Assertion` header
4. Worker verifies the JWT against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`
5. If valid, request proceeds to the admin handler
6. If invalid (or not configured), request is rejected with 403

## Security Recommendations

1. **Always configure CF Access** for production admin routes — it provides an additional authentication layer independent of your application code
2. **Use strong ADMIN_KEY values** — at least 32 random characters
3. **Rotate ADMIN_KEY periodically** — update via `wrangler secret put ADMIN_KEY`
4. **Limit admin users** — only grant `tier: admin` to users who need it
5. **Monitor admin access** — check Worker logs for admin endpoint usage
6. **Plan for ADMIN_KEY deprecation** — once Clerk tier-based admin auth is wired in, transition away from static keys
