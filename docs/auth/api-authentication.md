# API Authentication Guide

How to authenticate requests to the adblock-compiler API.

## Overview

The adblock-compiler API supports three authentication methods:

1. **Clerk JWT** — For browser-based users (automatic via the web UI)
2. **API Key** — For programmatic/CLI access
3. **Anonymous** — Limited access, being deprecated

> **Important**: Anonymous access will be removed in a future release. All API endpoints will require authentication. See [Removing Anonymous Access](removing-anonymous-access.md).

## Authentication Methods

### Method 1: Clerk JWT (Browser Users)

If you use the web UI at `https://adblock-compiler.jayson-knight.workers.dev/`, authentication is handled automatically:

1. Sign in via the Clerk-powered sign-in page
2. The Angular frontend obtains a JWT from Clerk
3. The `authInterceptor` attaches it to all API requests as `Authorization: Bearer <jwt>`

**You don't need to do anything** — the frontend handles JWT lifecycle, refresh, and attachment.

### Method 2: API Key (Programmatic Access)

For scripts, CI/CD pipelines, or third-party integrations, use an API key.

#### Creating an API Key

1. Sign in to the web UI
2. Navigate to **Settings → API Keys**
3. Click **"Create API Key"**
4. Configure:
   - **Name**: Descriptive label (e.g., "CI/CD Pipeline", "My Script")
   - **Scopes**: Select permissions — `compile`, `rules`, or `admin`
   - **Expiration**: Optional (1–365 days)
5. **Copy the key immediately** — it's shown only once

The key looks like: `abc_Xk9mP2...` (47 characters, starts with `abc_`)

#### Using an API Key

Include the key in the `Authorization` header:

```bash
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/compile \
  -H "Authorization: Bearer abc_Xk9mP2..." \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["https://raw.githubusercontent.com/user/list/main/filters.txt"],
    "transformations": ["validate", "deduplicate", "compress"]
  }'
```

#### API Key Scopes

| Scope | Grants Access To |
|-------|-----------------|
| `compile` | `/compile`, `/compile/stream`, `/compile/batch` |
| `rules` | `/rules` CRUD endpoints |
| `admin` | `/admin/*` endpoints |

> **Note**: Clerk JWT-authenticated users bypass scope checks — scopes only apply to API key access.

#### API Key Limits

| Limit | Value |
|-------|-------|
| Max keys per user | 25 |
| Rate limit | Based on owner's tier (default: 60 req/min) |
| Expiration | 1–365 days (optional; never-expiring allowed) |
| Key name max length | 100 characters |

#### Managing API Keys

| Action | Endpoint | Method |
|--------|----------|--------|
| Create | `/api/keys` | POST |
| List | `/api/keys` | GET |
| Update | `/api/keys/:id` | PATCH |
| Revoke | `/api/keys/:id` | DELETE |

### Method 3: Anonymous Access (Being Deprecated)

Currently, some endpoints allow unauthenticated access with severe rate limits (10 requests/minute). This will be removed in a future release.

## Rate Limiting

Rate limits are enforced per-tier:

| Tier | Rate Limit | How to Get |
|------|-----------|------------|
| Anonymous | 10 req/min | No auth (being deprecated) |
| Free | 60 req/min | Sign up for free account |
| Pro | 300 req/min | Upgrade to Pro subscription |
| Admin | Unlimited | Admin role in Clerk |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1700000000
```

When rate-limited, you'll receive:

```json
HTTP/1.1 429 Too Many Requests

{
    "success": false,
    "error": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
}
```

## Endpoint Protection Matrix

### Public Endpoints (No Auth Required)

These endpoints remain publicly accessible:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/version` | GET | API version information |
| `/api/clerk-config` | GET | Clerk publishable key |
| `/api/turnstile-config` | GET | Turnstile configuration |
| `/health` | GET | Health check |
| `/api/webhooks/clerk` | POST | Clerk webhook receiver |

### Authenticated Endpoints (Auth Required After Migration)

These endpoints currently allow anonymous access but will require authentication:

| Endpoint | Method | Current | After Migration |
|----------|--------|---------|-----------------|
| `/compile` | POST | Anonymous + Turnstile | Free+ |
| `/compile/stream` | POST | Anonymous + Turnstile | Free+ |
| `/compile/batch` | POST | Anonymous + Turnstile | Free+ |
| `/compile/async` | POST | Anonymous + Turnstile | Pro+ |
| `/compile/batch/async` | POST | Anonymous + Turnstile | Pro+ |
| `/validate-rule` | POST | Anonymous | Free+ |
| `/rules` | GET | Anonymous | Free+ |
| `/rules/:id` | GET | Anonymous | Free+ |
| `/api/deployments` | GET | Anonymous | Public (unchanged) |
| `/metrics` | GET | Anonymous | Free+ |

### Protected Endpoints (Auth Already Required)

| Endpoint | Method | Required Auth |
|----------|--------|--------------|
| `/api/keys` | POST | Authenticated (any tier) |
| `/api/keys` | GET | Authenticated (any tier) |
| `/api/keys/:id` | DELETE | Authenticated (any tier) |
| `/api/keys/:id` | PATCH | Authenticated (any tier) |
| `/api/notify` | POST | Authenticated (any tier) |

### Admin Endpoints

| Endpoint | Method | Required Auth |
|----------|--------|--------------|
| `/admin/storage/stats` | GET | Admin key or Admin tier |
| `/admin/storage/clear-expired` | POST | Admin key or Admin tier |
| `/admin/storage/clear-cache` | POST | Admin key or Admin tier |
| `/admin/storage/export` | GET | Admin key or Admin tier |
| `/admin/storage/vacuum` | POST | Admin key or Admin tier |
| `/admin/storage/tables` | GET | Admin key or Admin tier |
| `/admin/storage/query` | POST | Admin key or Admin tier |

## Error Responses

### 401 Unauthorized

Returned when authentication is required but not provided or invalid:

```json
{
    "success": false,
    "error": "Authentication required"
}
```

**Common causes:**
- Missing `Authorization` header
- Expired JWT (Clerk JWTs expire after ~60 seconds; the frontend auto-refreshes)
- Invalid or revoked API key
- Malformed Bearer token

### 403 Forbidden

Returned when authenticated but lacking permission:

```json
{
    "success": false,
    "error": "Insufficient tier: requires pro, current tier is free"
}
```

**Common causes:**
- Tier too low for the endpoint
- API key missing required scope
- CF Access verification failed (admin routes)

### 429 Too Many Requests

Returned when rate limit is exceeded:

```json
{
    "success": false,
    "error": "Rate limit exceeded. Try again in 30 seconds.",
    "retryAfter": 30
}
```

## Migration Guide: Preparing for Required Auth

When anonymous access is removed:

1. **Create an account** — Sign up at the web UI
2. **Create an API key** — For any scripts or integrations
3. **Update your scripts** — Add `Authorization: Bearer abc_...` header
4. **Test** — Verify your integration works with authentication
5. **Monitor rate limits** — Free tier is 60 req/min (up from 10 anonymous)

See [Removing Anonymous Access](removing-anonymous-access.md) for the full migration plan.

## Examples

### cURL

```bash
# Compile with API key
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/compile \
  -H "Authorization: Bearer abc_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sources": ["https://example.com/filters.txt"]}'
```

### JavaScript/TypeScript (fetch)

```typescript
const response = await fetch('https://adblock-compiler.jayson-knight.workers.dev/compile', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        sources: ['https://example.com/filters.txt'],
        transformations: ['validate', 'deduplicate'],
    }),
});

if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
}
```

### Python (requests)

```python
import requests

response = requests.post(
    'https://adblock-compiler.jayson-knight.workers.dev/compile',
    headers={'Authorization': f'Bearer {API_KEY}'},
    json={
        'sources': ['https://example.com/filters.txt'],
        'transformations': ['validate', 'deduplicate'],
    },
)

if response.status_code == 429:
    retry_after = response.headers.get('Retry-After')
    print(f'Rate limited. Retry after {retry_after} seconds')
```
