# Cloudflare Access Integration

Cloudflare Access (part of [Cloudflare Zero Trust](https://one.dash.cloudflare.com)) provides network-level authentication for admin endpoints. It acts as a **defense-in-depth layer** — admin routes require both a valid `X-Admin-Key` header AND a verified Cloudflare Access JWT.

> **Note:** Cloudflare Access protects admin routes only. Regular API authentication is handled by [Clerk JWTs and API keys](api-authentication.md).

---

## Table of Contents

- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Setting Up Cloudflare Access](#setting-up-cloudflare-access)
  - [Step 1: Enable Cloudflare Zero Trust](#step-1-enable-cloudflare-zero-trust)
  - [Step 2: Create a Self-Hosted Application](#step-2-create-a-self-hosted-application)
  - [Step 3: Configure Access Policies](#step-3-configure-access-policies)
  - [Step 4: Get the Application AUD Tag](#step-4-get-the-application-aud-tag)
  - [Step 5: Configure Worker Secrets](#step-5-configure-worker-secrets)
- [Service Tokens for CI/CD](#service-tokens-for-cicd)
- [Local Development](#local-development)
- [Integration with Clerk Auth](#integration-with-clerk-auth)
- [Technical Implementation](#technical-implementation)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌──────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Admin User  │────▶│  Cloudflare Access   │────▶│  Worker         │
│  (Browser)   │     │  (Zero Trust Proxy)  │     │                 │
│              │     │                      │     │  1. X-Admin-Key │
│              │     │  ✓ Identity check    │     │  2. CF Access   │
│              │     │  ✓ Injects JWT       │     │     JWT verify  │
│              │     │    header             │     │  3. Handler     │
└──────────────┘     └─────────────────────┘     └─────────────────┘

┌──────────────┐                                  ┌─────────────────┐
│  CI/CD       │─────────────────────────────────▶│  Worker         │
│  Pipeline    │  Uses Service Token headers:     │                 │
│              │  CF-Access-Client-Id              │  Verified via   │
│              │  CF-Access-Client-Secret           │  CF Access      │
└──────────────┘                                  └─────────────────┘
```

### Defense-in-Depth Layers

Admin routes (`/admin/storage/*`) are protected by **two independent layers**:

| Layer | Mechanism | Header | Purpose |
|-------|-----------|--------|---------|
| 1 | Admin Key | `X-Admin-Key` | Application-level secret — constant-time comparison |
| 2 | CF Access JWT | `CF-Access-JWT-Assertion` | Network-level identity — JWT signature verification |

Both layers must pass for the request to proceed. An attacker who compromises one secret still cannot access admin endpoints.

---

## How It Works

When a request reaches an admin endpoint:

1. **`verifyAdminAuth()`** checks the `X-Admin-Key` header against `env.ADMIN_KEY` using constant-time comparison (`timingSafeCompareWorker`)
2. **`verifyCfAccessJwt()`** verifies the `CF-Access-JWT-Assertion` header:
   - Fetches the JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`
   - Verifies signature, audience (`CF_ACCESS_AUD`), issuer, and expiration using `jose`
   - Extracts `email` and `sub` claims from the payload
3. If both pass, the request reaches the admin handler

### JWT Verification Flow

```
Request → Extract CF-Access-JWT-Assertion header
            │
            ▼
        Token present?
         │         │
         No        Yes
         │         │
         ▼         ▼
    Return 403   Fetch JWKS (cached per Worker isolate)
                   │
                   ▼
              Verify JWT:
              - Signature (RS256)
              - Audience = CF_ACCESS_AUD
              - Issuer = https://<team>.cloudflareaccess.com
              - Not expired
                   │
              ┌────┴────┐
              │         │
            Valid    Invalid
              │         │
              ▼         ▼
         Return     Return 403
         email +    + error message
         identity
```

---

## Setting Up Cloudflare Access

### Step 1: Enable Cloudflare Zero Trust

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com)
2. If not already set up, create your **team name** (e.g., `mycompany`)
   - This becomes your team domain: `mycompany.cloudflareaccess.com`
   - Choose carefully — this is used in JWT verification
3. You need at least the **Free** Zero Trust plan (50 users)

### Step 2: Create a Self-Hosted Application

1. In Zero Trust dashboard, go to **Access → Applications**
2. Click **Add an application** → **Self-hosted**
3. Configure the application:

| Field | Value | Notes |
|-------|-------|-------|
| **Application name** | `Adblock Compiler Admin` | Display name |
| **Session Duration** | `24h` | How long before re-auth |
| **Application domain** | `adblock-compiler.jayson-knight.workers.dev` | Your Worker domain |
| **Path** | `/admin/*` | Restrict to admin routes only |

> **Important:** Set the path to `/admin/*` so that only admin endpoints are behind Access. Regular API and frontend routes should NOT go through Access.

4. Click **Next** to configure policies

### Step 3: Configure Access Policies

Create at least one **Allow** policy:

#### Policy: Admin Team (Email-based)

| Field | Value |
|-------|-------|
| **Policy name** | `Admin Email Allow` |
| **Action** | Allow |
| **Include rule** | Emails — `admin@yourdomain.com` |

#### Alternative: Identity Provider

If you use an IdP (Google Workspace, Okta, GitHub, etc.):

| Field | Value |
|-------|-------|
| **Policy name** | `GitHub Org Members` |
| **Action** | Allow |
| **Include rule** | Login Methods — GitHub |
| **Require rule** | GitHub Organization — `your-org` |

#### Adding Multiple Admins

You can combine multiple rules in a single policy:

- **Emails**: `admin1@example.com`, `admin2@example.com`
- **Email domain**: `@yourdomain.com` (allows entire domain)
- **GitHub org**: Requires membership in a specific GitHub organization
- **IP ranges**: Allow from specific IPs (e.g., office network)

### Step 4: Get the Application AUD Tag

After creating the application:

1. Go to **Access → Applications**
2. Click on your `Adblock Compiler Admin` application
3. Find the **Application Audience (AUD) Tag** in the application overview
   - It looks like: `4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d`
4. Copy this value — you'll need it for the Worker secret

### Step 5: Configure Worker Secrets

Set the two required secrets using Wrangler:

```bash
# Set the team domain (just the subdomain, not the full URL)
wrangler secret put CF_ACCESS_TEAM_DOMAIN
# Enter: mycompany

# Set the application audience tag
wrangler secret put CF_ACCESS_AUD
# Enter: 4a1b2c3d...  (the full AUD tag from Step 4)
```

For local development with `.dev.vars`:

```ini
# .dev.vars (never commit this file)
CF_ACCESS_TEAM_DOMAIN=mycompany
CF_ACCESS_AUD=4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d
```

---

## Service Tokens for CI/CD

Cloudflare Access supports [Service Tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/) for non-interactive access (CI/CD pipelines, cron jobs, monitoring).

### Creating a Service Token

1. In Zero Trust dashboard, go to **Access → Service Auth → Service Tokens**
2. Click **Create Service Token**
3. Name it (e.g., `CI/CD Pipeline`)
4. Copy the **Client ID** and **Client Secret** — the secret is shown only once

### Using Service Tokens in CI/CD

```bash
# GitHub Actions example
curl -X POST "https://adblock-compiler.jayson-knight.workers.dev/admin/storage/stats" \
  -H "X-Admin-Key: ${{ secrets.ADMIN_KEY }}" \
  -H "CF-Access-Client-Id: ${{ secrets.CF_ACCESS_CLIENT_ID }}" \
  -H "CF-Access-Client-Secret: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}"
```

### Adding Service Token Policy

Add a **Service Auth** policy to your Access application:

| Field | Value |
|-------|-------|
| **Policy name** | `CI/CD Service Token` |
| **Action** | Service Auth |
| **Include rule** | Service Token — `CI/CD Pipeline` |

---

## Local Development

When `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD` are **not set**, the CF Access middleware **gracefully skips verification** and returns `{ valid: true }`. This means:

- **Local dev** (`wrangler dev`): Works without CF Access — only `X-Admin-Key` is required for admin routes
- **Production**: Both layers are enforced when both secrets are configured

### Testing CF Access Locally

If you need to test CF Access locally:

1. Set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` in `.dev.vars`
2. Obtain a valid CF Access JWT:
   - Visit your Access-protected URL in a browser
   - After authenticating, the `CF_Authorization` cookie contains the JWT
   - Copy the JWT value
3. Include it in requests:

```bash
curl -X GET "http://localhost:8787/admin/storage/stats" \
  -H "X-Admin-Key: your-admin-key" \
  -H "CF-Access-JWT-Assertion: eyJhbGciOiJS..."
```

---

## Integration with Clerk Auth

CF Access and Clerk serve different purposes in the auth stack:

| Aspect | Clerk | Cloudflare Access |
|--------|-------|-------------------|
| **Scope** | All API routes | Admin routes only |
| **Users** | API consumers, frontend users | Administrators, CI/CD |
| **Identity** | Clerk user ID, email, tier | CF email, identity |
| **Keys** | JWT + API keys | JWT (auto-injected by Access proxy) |
| **Management** | Clerk Dashboard | CF Zero Trust Dashboard |

### How They Coexist

```
Regular API request:
  User → Clerk JWT/API Key → authenticateRequestUnified() → Handler

Admin request (browser):
  Admin → CF Access (injects JWT) → verifyAdminAuth() → verifyCfAccessJwt() → Handler

Admin request (CI/CD):
  Pipeline → CF Service Token → verifyAdminAuth() → verifyCfAccessJwt() → Handler
```

### Future: Clerk-Based Admin Auth

The admin access system will eventually migrate from `X-Admin-Key` to Clerk tier-based authorization:

```
Future admin request:
  Admin → CF Access → authenticateRequestUnified() → requireTier(Admin) → Handler
```

In this model, CF Access remains as the network-level gate, while Clerk handles identity and tier verification. See [Admin Access](admin-access.md) for the migration plan.

---

## Technical Implementation

### Source File

`worker/middleware/cf-access.ts`

### Key Types

```typescript
interface CfAccessVerificationResult {
    valid: boolean;
    email?: string;
    identity?: string;
    error?: string;
}
```

### Environment Variables

```typescript
// In worker/types.ts → Env interface
CF_ACCESS_TEAM_DOMAIN?: string;  // e.g., 'mycompany'
CF_ACCESS_AUD?: string;          // Application audience tag
```

### JWKS Caching

The JWKS resolver is cached at module level per Worker isolate:

```typescript
const cfAccessJwksCache = new Map<string, JWTVerifyGetKey>();
```

- Cached per `certsUrl` (derived from team domain)
- Persists for the lifetime of the Worker isolate
- Automatically refreshes when the isolate is recycled
- Uses the same `jose` library as Clerk JWT verification

### Usage in Worker

```typescript
// worker/worker.ts — admin route protection
if (pathname.startsWith('/admin/storage/')) {
    const adminAuth = verifyAdminAuth(request, env);
    if (!adminAuth.valid) {
        return JsonResponse.unauthorized(adminAuth.error);
    }

    const cfAccess = await verifyCfAccessJwt(request, env);
    if (!cfAccess.valid) {
        return JsonResponse.forbidden(cfAccess.error);
    }

    // Both layers passed — proceed to handler
}
```

---

## Troubleshooting

### "Missing CF-Access-JWT-Assertion header"

**Cause:** Request reached the Worker without passing through CF Access.

**Fix:**
- Verify the Access application path matches your admin route (`/admin/*`)
- Ensure you're accessing the Worker through its public domain (not directly via `wrangler dev` when Access is required)
- For CI/CD, use Service Token headers instead

### "CF Access JWT verification failed: JWTExpired"

**Cause:** The Access session has expired.

**Fix:**
- Re-authenticate through the CF Access login page
- Increase the session duration in the Access application settings
- For Service Tokens, tokens don't expire unless revoked

### "CF Access JWT verification failed: JWSSignatureVerificationFailed"

**Cause:** JWT signature doesn't match the JWKS keys.

**Fix:**
- Verify `CF_ACCESS_TEAM_DOMAIN` matches your Zero Trust team name exactly
- Verify `CF_ACCESS_AUD` matches the application's audience tag exactly
- The JWKS cache may be stale — the Worker isolate will eventually recycle

### Admin route works locally but fails in production

**Cause:** CF Access is not configured or secrets are missing.

**Fix:**
```bash
# Verify secrets are set
wrangler secret list

# Re-set if needed
wrangler secret put CF_ACCESS_TEAM_DOMAIN
wrangler secret put CF_ACCESS_AUD
```

### CF Access blocks non-admin routes

**Cause:** The Access application path is too broad.

**Fix:**
- In Zero Trust dashboard, edit the application
- Ensure the path is set to `/admin/*` (not `/*` or `/`)
- Only admin routes should be behind Access

---

## Further Reading

- [Cloudflare Access Documentation](https://developers.cloudflare.com/cloudflare-one/applications/)
- [Validating JWTs](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)
- [Service Tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/)
- [Zero Trust Pricing](https://www.cloudflare.com/plans/zero-trust-services/) (Free plan: up to 50 users)
- [Admin Access Guide](admin-access.md) — Migration plan to Clerk-based admin auth
