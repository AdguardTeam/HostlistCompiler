# Operator Guide

Step-by-step instructions for deploying, configuring, and maintaining the admin system.

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Clerk account** | [clerk.com](https://clerk.com) — provides identity and JWT authentication |
| **Cloudflare account** | Workers Paid plan (required for D1, KV, Analytics Engine) |
| **Wrangler CLI** | `npm i -g wrangler` (v3+) — used for D1 management and deployments |
| **Git access** | Clone of the `adblock-compiler` repository |

## 1. Create the ADMIN_DB Database

The admin system uses a dedicated D1 database separate from the application database.

```bash
# Create the database
wrangler d1 create adblock-compiler-admin-d1
```

This outputs a `database_id` UUID. Copy it — you'll need it in the next step.

### Update wrangler.toml

The ADMIN_DB binding is pre-configured but **commented out** in `wrangler.toml`. Uncomment it and insert your database ID:

```toml
[[d1_databases]]
binding = "ADMIN_DB"
database_name = "adblock-compiler-admin-d1"
database_id = "<paste-your-database-id-here>"
migrations_dir = "admin-migrations"
```

> **Why a separate database?** The admin system uses its own D1 instance (`ADMIN_DB`) instead of the application's `DB` binding. This provides blast-radius isolation — a bad admin migration or runaway query cannot corrupt application data.

## 2. Run Migrations

The schema is defined in `admin-migrations/0001_admin_schema.sql` and creates 8 tables with seed data.

### Local Development

```bash
wrangler d1 migrations apply adblock-compiler-admin-d1 --local
```

This creates a local SQLite file that simulates D1 for development.

### Production

```bash
wrangler d1 migrations apply adblock-compiler-admin-d1 --remote
```

### Verify

Check that the tables were created and seeded:

```bash
# Local
wrangler d1 execute adblock-compiler-admin-d1 --local \
  --command "SELECT role_name, display_name FROM admin_roles;"

# Remote
wrangler d1 execute adblock-compiler-admin-d1 --remote \
  --command "SELECT role_name, display_name FROM admin_roles;"
```

Expected output:

```
┌──────────────┬─────────────┐
│ role_name    │ display_name│
├──────────────┼─────────────┤
│ viewer       │ Viewer      │
│ editor       │ Editor      │
│ super-admin  │ Super Admin │
└──────────────┴─────────────┘
```

## 3. Assign the First Super-Admin

This is a bootstrap problem: you need admin access to assign admin roles, but no one has admin access yet.

### Step 1: Set Clerk Metadata

In the Clerk Dashboard ([dashboard.clerk.com](https://dashboard.clerk.com)):

1. Go to **Users** → find your user
2. Click **Edit** → **Public metadata**
3. Set:

```json
{
  "tier": "admin",
  "role": "admin"
}
```

This is the gate check — the middleware verifies `publicMetadata.role === 'admin'` before any permission evaluation.

**Alternatively**, use the Clerk Backend API:

```bash
# Find your user ID
curl https://api.clerk.com/v1/users?email_address=you@example.com \
  -H "Authorization: Bearer $CLERK_SECRET_KEY"

# Set admin metadata
curl -X PATCH https://api.clerk.com/v1/users/{your_user_id}/metadata \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"public_metadata": {"tier": "admin", "role": "admin"}}'
```

### Step 2: Assign the Super-Admin Role in ADMIN_DB

Since there are no existing admin role assignments at bootstrap, the first super-admin must be seeded out-of-band via a direct D1 insert (the API endpoint requires `roles:assign` permission, which nobody holds yet):

```bash
# Using Wrangler to execute a D1 query directly
wrangler d1 execute adblock-compiler-admin-d1 --command \
  "INSERT INTO admin_role_assignments (clerk_user_id, role_name, assigned_by)
   VALUES ('user_2yourClerkId', 'super-admin', 'bootstrap')"
```

Or, if you prefer the Wrangler D1 interactive shell:

```bash
wrangler d1 execute adblock-compiler-admin-d1 --interactive
```

```sql
INSERT INTO admin_role_assignments (clerk_user_id, role_name, assigned_by)
VALUES ('user_2yourClerkId', 'super-admin', 'bootstrap');
```

Once you have confirmed the insert, subsequent role assignments can be made through the API (`POST /admin/system/roles/assign`) using your super-admin JWT.

### Step 3: Verify

```bash
curl https://your-worker.workers.dev/admin/system/my-context \
  -H "Authorization: Bearer $YOUR_CLERK_JWT"
```

You should see:

```json
{
  "success": true,
  "context": {
    "clerk_user_id": "user_2yourClerkId",
    "role_name": "super-admin",
    "permissions": ["admin:read", "admin:write", "...all 27..."],
    "expires_at": null
  }
}
```

## 4. KV Cache Management

Role resolution results are cached in KV for performance. The admin system shares the `RATE_LIMIT` KV namespace with the application rate limiter, using an `admin:` prefix.

### Cache Configuration

| Setting | Value |
|---------|-------|
| **Namespace** | `RATE_LIMIT` (existing KV binding in wrangler.toml) |
| **Key prefix** | `admin:role:{clerkUserId}` |
| **TTL** | 300 seconds (5 minutes) |
| **Invalidation** | Automatic on role assign/revoke |

### Manual Cache Inspection

```bash
# List admin cache keys
wrangler kv key list --namespace-id=$RATE_LIMIT_NS_ID --prefix="admin:role:"

# Read a specific cache entry
wrangler kv get --namespace-id=$RATE_LIMIT_NS_ID "admin:role:user_2abc123"

# Manually delete a cache entry (force D1 re-lookup)
wrangler kv delete --namespace-id=$RATE_LIMIT_NS_ID "admin:role:user_2abc123"
```

### Cache Staleness

If you modify a role's permissions directly in D1 (e.g., via `wrangler d1 execute`), the KV cache will serve stale data for up to 5 minutes. To force immediate effect:

1. Delete the affected user's cache key (see above), or
2. Wait 5 minutes for the TTL to expire.

The admin API handles cache invalidation automatically — this only applies to out-of-band D1 changes.

## 5. Environment Variables & Bindings

The admin system requires these bindings in `wrangler.toml`:

### Required

| Binding | Type | Purpose |
|---------|------|---------|
| `ADMIN_DB` | D1 Database | Admin configuration and audit storage |

### Shared with Application

| Binding | Type | Purpose |
|---------|------|---------|
| `RATE_LIMIT` | KV Namespace | Role cache (admin: prefix) |
| `ANALYTICS` | Analytics Engine | Admin event reporting |
| `CLERK_PUBLISHABLE_KEY` | Secret | JWT verification |
| `CLERK_SECRET_KEY` | Secret | Backend API calls |

### wrangler.toml snippet

```toml
# Admin D1 database (uncomment after creating)
[[d1_databases]]
binding = "ADMIN_DB"
database_name = "adblock-compiler-admin-d1"
database_id = "<your-database-id>"
migrations_dir = "admin-migrations"

# Shared KV (already configured for rate limiting)
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<your-kv-namespace-id>"

# Analytics Engine (already configured)
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "adblock_compiler_analytics"
```

## 6. Ongoing Operations

### Adding New Admins

As a super-admin, you can onboard new administrators:

1. Have the user create a Clerk account (sign up via the web UI).
2. Set their Clerk `publicMetadata.role` to `"admin"` (via Clerk Dashboard or API).
3. Assign them an appropriate admin role:

```bash
# Read-only access
curl -X POST /admin/system/roles/assign \
  -H "Authorization: Bearer $JWT" \
  -d '{"clerk_user_id": "user_2newAdmin", "role_name": "viewer"}'

# Config management access
curl -X POST /admin/system/roles/assign \
  -H "Authorization: Bearer $JWT" \
  -d '{"clerk_user_id": "user_2newAdmin", "role_name": "editor"}'

# Full admin access (use sparingly)
curl -X POST /admin/system/roles/assign \
  -H "Authorization: Bearer $JWT" \
  -d '{"clerk_user_id": "user_2newAdmin", "role_name": "super-admin"}'
```

### Rotating or Revoking Access

```bash
# Revoke a role
curl -X DELETE /admin/system/roles/revoke \
  -H "Authorization: Bearer $JWT" \
  -d '{"clerk_user_id": "user_2former", "role_name": "editor"}'

# Also remove Clerk admin metadata to fully revoke access
curl -X PATCH https://api.clerk.com/v1/users/{user_id}/metadata \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -d '{"public_metadata": {"role": null}}'
```

### Monitoring Audit Logs

Regularly review the audit log for unexpected changes:

```bash
# Check for denied access attempts
curl "/admin/system/audit?status=denied&limit=50" \
  -H "Authorization: Bearer $JWT"

# Review all config changes in the last 24 hours
curl "/admin/system/audit?since=$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)&limit=100" \
  -H "Authorization: Bearer $JWT"
```

### Database Maintenance

D1 is managed by Cloudflare, but you can run maintenance commands:

```bash
# Check table sizes
wrangler d1 execute adblock-compiler-admin-d1 --remote \
  --command "SELECT name, (SELECT COUNT(*) FROM admin_audit_logs) as audit_count FROM sqlite_master WHERE type='table' LIMIT 1;"

# Backup (export)
wrangler d1 export adblock-compiler-admin-d1 --remote --output admin-backup.sql
```

## Troubleshooting

### "ADMIN_DB is not defined"

The `ADMIN_DB` binding is commented out in `wrangler.toml`. Follow step 1 above to create and configure it.

### "403 Forbidden — not an admin"

The user's Clerk `publicMetadata.role` is not set to `"admin"`. Update it in the Clerk Dashboard.

### "403 Forbidden — insufficient permission"

The user has an admin role but it lacks the required permission. Check their role:

```bash
curl "/admin/system/roles/assignments?clerk_user_id=user_2abc123" \
  -H "Authorization: Bearer $JWT"
```

Then check the role's permissions:

```bash
curl /admin/system/roles -H "Authorization: Bearer $JWT"
```

### Role changes not taking effect

KV cache may be serving stale data. Either wait 5 minutes or manually invalidate:

```bash
wrangler kv delete --namespace-id=$RATE_LIMIT_NS_ID "admin:role:user_2abc123"
```
