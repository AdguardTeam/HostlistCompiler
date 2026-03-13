# Testing with Postman

This guide explains how to configure Postman to authenticate against the adblock-compiler API using either a **Clerk JWT** or an **API key**. It covers environment setup, obtaining tokens, pre-request scripts for automatic token refresh, and ready-to-use request examples for every major endpoint.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Postman Environment Setup](#postman-environment-setup)
- [Authentication Methods](#authentication-methods)
  - [Method 1: API Key (Recommended for Testing)](#method-1-api-key-recommended-for-testing)
  - [Method 2: Clerk JWT (Manual Token)](#method-2-clerk-jwt-manual-token)
  - [Method 3: Clerk JWT (Automatic via Pre-Request Script)](#method-3-clerk-jwt-automatic-via-pre-request-script)
- [Collection Setup](#collection-setup)
  - [Collection-Level Authorization](#collection-level-authorization)
  - [Pre-Request Script for Automatic JWT Refresh](#pre-request-script-for-automatic-jwt-refresh)
- [Request Examples](#request-examples)
  - [Health & Version (Public — No Auth)](#health--version-public--no-auth)
  - [Compile Filter List](#compile-filter-list)
  - [API Key Management](#api-key-management)
  - [Admin Endpoints](#admin-endpoints)
- [Testing All Tiers](#testing-all-tiers)
- [Common Errors & Troubleshooting](#common-errors--troubleshooting)

---

## Prerequisites

- [Postman](https://www.postman.com/downloads/) desktop app (v10+) or Postman Web
- An account registered at the adblock-compiler web UI (`https://adblock-compiler.jayson-knight.workers.dev/`)  
  _or_ a locally running worker (`http://localhost:8787`)
- (Optional) Clerk account access for your adblock-compiler application — see [Clerk Dashboard Setup](clerk-setup.md)

---

## Postman Environment Setup

Create a dedicated Postman environment to avoid hard-coding values into requests.

### Step 1: Create the Environment

1. Open Postman → **Environments** (left sidebar) → **+**
2. Name it `adblock-compiler` (or `adblock-compiler-local` for local dev)
3. Add the following variables:

| Variable | Type | Initial / Current Value | Notes |
|----------|------|------------------------|-------|
| `baseUrl` | default | `https://adblock-compiler.jayson-knight.workers.dev` | Change to `http://localhost:8787` for local dev |
| `apiKey` | secret | _(your `abc_...` key)_ | Obtained from Settings → API Keys in the web UI |
| `clerkJwt` | secret | _(leave blank — populated automatically)_ | Set by pre-request script or manually |
| `clerkPublishableKey` | default | `pk_test_...` or `pk_live_...` | From Clerk Dashboard → API Keys |
| `adminKey` | secret | _(your admin key)_ | Only needed for `/admin/*` endpoints — see [Admin Access](admin-access.md) |

4. Click **Save**
5. Select `adblock-compiler` as the **Active Environment** (top-right dropdown)

### Step 2: Activate the Environment

Ensure the environment is selected in the top-right **Environment** dropdown before sending any requests.

---

## Authentication Methods

The adblock-compiler supports three authentication methods. For Postman testing, **API Key** is the simplest option. Use **Clerk JWT** when you need to test tier-specific behaviour or user-scoped endpoints.

### Method 1: API Key (Recommended for Testing)

API keys are the easiest way to authenticate in Postman because they never expire (unless you set an expiration) and don't require a browser sign-in flow.

#### Step 1: Create an API Key

1. Sign in to the web UI
2. Go to **Settings → API Keys**
3. Click **"Create API Key"**
4. Fill in:
   - **Name**: `Postman Testing`
   - **Scopes**: Select all that apply — `compile`, `rules`, `admin`
   - **Expiration**: Optional
5. Copy the key (starts with `abc_`) — **it's only shown once**

#### Step 2: Add the Key to Postman

Paste the key into the `apiKey` environment variable created above.

#### Step 3: Configure Authorization

In any request (or at the collection level — see [Collection Setup](#collection-setup)):

1. Open the request → **Authorization** tab
2. Select **Type**: `Bearer Token`
3. Set **Token**: `{{apiKey}}`

All requests using `{{apiKey}}` will automatically send:

```
Authorization: Bearer abc_Xk9mP2...
```

---

### Method 2: Clerk JWT (Manual Token)

Use this method when you need a real Clerk JWT (e.g., to test tier enforcement or user-specific features) but don't want to set up a script.

#### Step 1: Sign in to the Web UI and Copy the JWT

1. Open the web UI in your browser and sign in
2. Open **DevTools** → **Application** tab → **Session Storage** or **Local Storage**  
   — look for keys prefixed with `__clerk_db_jwt` or `__session`  
   _or_ use DevTools **Network** tab:
   - Filter requests for `Authorization: Bearer`
   - Copy the token value (a long JWT string starting with `eyJ...`)

   > **Tip**: The easiest method is to use the browser DevTools console:
   > ```javascript
   > // Paste this in the browser console while on the web UI
   > const session = window.Clerk?.session;
   > session?.getToken().then(t => console.log(t));
   > ```
   > Copy the printed token.

3. Paste the JWT into the `clerkJwt` environment variable in Postman

#### Step 2: Configure Authorization

In your request → **Authorization** tab:

- **Type**: `Bearer Token`
- **Token**: `{{clerkJwt}}`

> **Note**: Clerk JWTs are short-lived (typically 60 seconds). You will need to refresh this token frequently. Consider using the [pre-request script method](#method-3-clerk-jwt-automatic-via-pre-request-script) instead.

---

### Method 3: Clerk JWT (Automatic via Pre-Request Script)

> **Status**: Clerk's hosted sign-in flow requires browser interaction, so fully headless JWT retrieval is not natively supported in Postman without the Clerk Frontend API. This script uses the Clerk Frontend API to obtain a session token from existing credentials.
>
> **Best for**: Teams with a dedicated test account where the session can be refreshed programmatically.

See [Pre-Request Script for Automatic JWT Refresh](#pre-request-script-for-automatic-jwt-refresh) for the full script.

---

## Collection Setup

### Creating the Collection

1. In Postman, click **Collections** (left sidebar) → **+** → **Blank Collection**
2. Name it `adblock-compiler`
3. Add a description: `Testing collection for the adblock-compiler API`

### Collection-Level Authorization

Set authorization once at the collection level so all requests inherit it automatically.

1. Click the collection name → **Authorization** tab
2. Configure:
   - **Type**: `Bearer Token`
   - **Token**: `{{apiKey}}`
3. Click **Save**

All requests in the collection will default to `Inherit auth from parent`, which picks up `{{apiKey}}` automatically. Override on individual requests as needed.

---

### Pre-Request Script for Automatic JWT Refresh

Add this script to the collection's **Pre-request Script** tab to automatically fetch and cache a fresh Clerk JWT before each request. This uses the **Clerk Frontend API** with a long-lived session token.

> **Setup required**: This script requires a `clerkSessionToken` environment variable containing a long-lived Clerk session token. Obtain it by signing in to the Clerk-powered web UI and copying the `__client` cookie value, or by calling Clerk's `/v1/client` endpoint from a signed-in browser session.

```javascript
// Collection Pre-request Script — Automatic Clerk JWT Refresh
// Refreshes the JWT if it is missing or expires within the next 30 seconds.

const jwt = pm.environment.get('clerkJwt');
const jwtExpiry = pm.environment.get('clerkJwtExpiry');
const now = Math.floor(Date.now() / 1000);

// Skip refresh if the cached JWT is still valid for > 30 seconds
if (jwt && jwtExpiry && parseInt(jwtExpiry) > now + 30) {
    console.log('[Clerk] Using cached JWT, expires in', parseInt(jwtExpiry) - now, 's');
    return;
}

// Derive the Clerk Frontend API URL from the publishable key
// pk_test_<base64(domain)> → decode to get the Clerk Frontend API host
const publishableKey = pm.environment.get('clerkPublishableKey');
if (!publishableKey) {
    console.warn('[Clerk] clerkPublishableKey not set — skipping JWT refresh');
    return;
}

const sessionToken = pm.environment.get('clerkSessionToken');
if (!sessionToken) {
    console.warn('[Clerk] clerkSessionToken not set — cannot refresh JWT');
    console.warn('[Clerk] Set clerkSessionToken to your __client cookie value from a signed-in browser session');
    return;
}

// Decode the Clerk Frontend API host from the publishable key
const keyPart = publishableKey.replace(/^pk_(test|live)_/, '');
let clerkFapiHost;
try {
    clerkFapiHost = atob(keyPart).replace(/\$$/, '');
} catch (e) {
    console.error('[Clerk] Failed to decode publishable key:', e.message);
    return;
}

const fapiUrl = `https://${clerkFapiHost}/v1/client/sessions/{{clerkSessionId}}/tokens`;

pm.sendRequest(
    {
        url: fapiUrl,
        method: 'POST',
        header: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': `__client=${sessionToken}`,
        },
    },
    (err, res) => {
        if (err) {
            console.error('[Clerk] JWT refresh failed:', err);
            return;
        }
        if (res.code !== 200) {
            console.error('[Clerk] JWT refresh returned', res.code, res.text());
            return;
        }
        const body = res.json();
        const newJwt = body?.jwt;
        if (!newJwt) {
            console.error('[Clerk] No JWT in response:', body);
            return;
        }
        // Decode expiry from JWT payload (middle segment)
        try {
            const payload = JSON.parse(atob(newJwt.split('.')[1]));
            pm.environment.set('clerkJwtExpiry', String(payload.exp));
        } catch (_) {
            // If decode fails, assume 60s expiry
            pm.environment.set('clerkJwtExpiry', String(now + 60));
        }
        pm.environment.set('clerkJwt', newJwt);
        console.log('[Clerk] JWT refreshed successfully');
    }
);
```

> **Simpler alternative**: For most Postman testing, use the `{{apiKey}}` variable instead. API keys are long-lived and require no scripting.

---

## Request Examples

Import the examples below by creating new requests in the `adblock-compiler` collection. All examples assume the `adblock-compiler` environment is active.

---

### Health & Version (Public — No Auth)

These endpoints require no authentication and are useful to verify connectivity.

#### GET /health

| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `{{baseUrl}}/health` |
| Auth | No auth |

**Expected Response** (`200 OK`):
```json
{
    "status": "ok",
    "timestamp": "2026-03-13T00:00:00.000Z"
}
```

#### GET /api/version

| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `{{baseUrl}}/api/version` |
| Auth | No auth |

---

### Compile Filter List

#### POST /compile — Compile with API Key

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `{{baseUrl}}/compile` |
| Auth | Bearer Token → `{{apiKey}}` |
| Content-Type | `application/json` |

**Body** (raw JSON):
```json
{
    "sources": [
        "https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_Base/filter.txt"
    ],
    "transformations": ["validate", "deduplicate"]
}
```

**Expected Response** (`200 OK`):
```json
{
    "success": true,
    "rules": ["...", "..."],
    "stats": {
        "total": 1234,
        "deduplicated": 56
    }
}
```

#### POST /compile — Unauthenticated (Anonymous)

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `{{baseUrl}}/compile` |
| Auth | No auth |
| Content-Type | `application/json` |

> **Note**: Anonymous access is rate-limited to 10 req/min and will be removed in a future release. Expect a `429 Too Many Requests` if you exceed the limit. See [Removing Anonymous Access](removing-anonymous-access.md).

**Expected Response Headers**:
```
X-Auth-Warning: Anonymous access will be removed. Please register for continued access.
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
```

#### POST /compile/batch — Batch Compile

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `{{baseUrl}}/compile/batch` |
| Auth | Bearer Token → `{{apiKey}}` (requires `compile` scope) |
| Content-Type | `application/json` |

**Body**:
```json
{
    "jobs": [
        {
            "id": "job-1",
            "sources": ["https://example.com/list1.txt"],
            "transformations": ["validate"]
        },
        {
            "id": "job-2",
            "sources": ["https://example.com/list2.txt"],
            "transformations": ["deduplicate", "compress"]
        }
    ]
}
```

---

### API Key Management

These endpoints require a valid Clerk JWT (not an API key — you can't manage API keys using an API key).

#### GET /api/keys — List Your API Keys

| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `{{baseUrl}}/api/keys` |
| Auth | Bearer Token → `{{clerkJwt}}` |

**Expected Response** (`200 OK`):
```json
{
    "success": true,
    "keys": [
        {
            "id": "key_abc123",
            "name": "Postman Testing",
            "scopes": ["compile", "rules"],
            "createdAt": "2026-01-01T00:00:00.000Z",
            "expiresAt": null,
            "lastUsedAt": "2026-03-13T00:00:00.000Z"
        }
    ]
}
```

#### POST /api/keys — Create an API Key

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `{{baseUrl}}/api/keys` |
| Auth | Bearer Token → `{{clerkJwt}}` |
| Content-Type | `application/json` |

**Body**:
```json
{
    "name": "My New Key",
    "scopes": ["compile"],
    "expiresInDays": 90
}
```

**Expected Response** (`201 Created`):
```json
{
    "success": true,
    "key": {
        "id": "key_xyz789",
        "name": "My New Key",
        "token": "abc_Xk9mP2...",
        "scopes": ["compile"],
        "expiresAt": "2026-06-11T00:00:00.000Z"
    }
}
```

> **Important**: Copy the `token` value immediately — it is only returned once.

#### PATCH /api/keys/:id — Update an API Key

| Field | Value |
|-------|-------|
| Method | `PATCH` |
| URL | `{{baseUrl}}/api/keys/key_xyz789` |
| Auth | Bearer Token → `{{clerkJwt}}` |
| Content-Type | `application/json` |

**Body**:
```json
{
    "name": "Renamed Key",
    "scopes": ["compile", "rules"]
}
```

#### DELETE /api/keys/:id — Revoke an API Key

| Field | Value |
|-------|-------|
| Method | `DELETE` |
| URL | `{{baseUrl}}/api/keys/key_xyz789` |
| Auth | Bearer Token → `{{clerkJwt}}` |

**Expected Response** (`200 OK`):
```json
{
    "success": true,
    "message": "API key revoked"
}
```

---

### Admin Endpoints

Admin endpoints require **both** the `X-Admin-Key` header and (if Cloudflare Access is configured) a valid `CF-Access-JWT-Assertion` header. See [Admin Access](admin-access.md) for full details.

#### GET /admin/storage/stats

| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `{{baseUrl}}/admin/storage/stats` |
| Auth | No auth (uses custom header instead) |
| Custom Header | `X-Admin-Key: {{adminKey}}` |

**To add the custom header**:
1. Open the request → **Headers** tab
2. Add a new header:
   - **Key**: `X-Admin-Key`
   - **Value**: `{{adminKey}}`

**Expected Response** (`200 OK`):
```json
{
    "success": true,
    "stats": {
        "totalUsers": 42,
        "totalApiKeys": 108
    }
}
```

**Unauthorized Response** (`401 Unauthorized`):
```json
{
    "success": false,
    "error": "Unauthorized"
}
```

---

## Testing All Tiers

To verify tier-based rate limiting and access control, test with credentials for each tier:

| Tier | How to Get Credentials | Rate Limit | Test Strategy |
|------|----------------------|-----------|---------------|
| **Anonymous** | No auth | 10 req/min | Send 11+ requests in a minute — expect `429` on the 11th |
| **Free** | Sign up → `{{clerkJwt}}` or API key with `compile` scope | 60 req/min | Same as above with higher limit |
| **Pro** | Set `tier: pro` in Clerk public metadata | 300 req/min | Same |
| **Admin** | Set `tier: admin, role: admin` in Clerk metadata | Unlimited | Test `/admin/*` endpoints |

### Setting Up a Test User's Tier (via Clerk Dashboard)

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → your application → **Users**
2. Find the test user → click their name
3. Scroll to **Public metadata** → click **Edit**
4. Set:
   ```json
   {
       "tier": "pro"
   }
   ```
5. Click **Save**
6. The webhook fires a `user.updated` event, syncing the tier to PostgreSQL
7. Obtain a fresh JWT (the old JWT may still carry the old tier until it expires)

---

## Common Errors & Troubleshooting

| HTTP Status | Error | Likely Cause | Fix |
|-------------|-------|-------------|-----|
| `401 Unauthorized` | `"Authentication required"` | Missing or malformed `Authorization` header | Ensure `Bearer {{apiKey}}` or `Bearer {{clerkJwt}}` is set correctly |
| `401 Unauthorized` | `"Invalid token"` | Expired or invalid JWT | Refresh `{{clerkJwt}}` — Clerk JWTs are short-lived (~60s) |
| `403 Forbidden` | `"Insufficient tier"` | Your account tier is too low for the endpoint | Upgrade tier in Clerk metadata, or use an API key with the required scope |
| `403 Forbidden` | `"Missing required scope"` | API key lacks a required scope (e.g., `admin`) | Create a new API key with the correct scopes |
| `429 Too Many Requests` | `"Rate limit exceeded"` | Exceeded your tier's request-per-minute limit | Wait 60 seconds, or use a higher-tier account |
| `401 Unauthorized` (admin) | `"Unauthorized"` | Missing or incorrect `X-Admin-Key` header | Check `{{adminKey}}` environment variable |
| `400 Bad Request` | `"Invalid request body"` | Malformed JSON or missing required fields | Validate your JSON body — check `sources` is an array |

### Verifying the Authorization Header is Set

In Postman, after sending a request:
1. Click **Console** (bottom bar) → find the request
2. Expand **Request Headers**
3. Confirm `Authorization: Bearer abc_...` (or `eyJ...` for JWT) is present

### JWT Claims Inspection

To inspect a Clerk JWT's claims (tier, expiry, user ID):

1. Copy the value of `{{clerkJwt}}` from the environment
2. Paste it into [jwt.io](https://jwt.io)
3. The **Payload** section shows:
   - `sub` — Clerk user ID
   - `exp` — expiry timestamp (Unix)
   - `metadata.tier` — user's tier (if JWT template is configured — see [Clerk Setup](clerk-setup.md#step-4-configure-jwt-templates-optional))

---

## Further Reading

- [API Authentication Guide](api-authentication.md) — Full auth method reference
- [Clerk Dashboard Setup](clerk-setup.md) — Creating and configuring the Clerk application
- [Configuration Guide](configuration.md) — All environment variables
- [Admin Access Guide](admin-access.md) — Admin endpoint authentication
- [Removing Anonymous Access](removing-anonymous-access.md) — Migration timeline