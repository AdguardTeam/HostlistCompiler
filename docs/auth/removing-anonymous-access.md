# Removing Anonymous Access

Plan for migrating the adblock-compiler from open anonymous access to mandatory authenticated access.

## Overview

Currently, core API endpoints (compilation, validation, rules) allow unauthenticated access with rate limits of 10 requests/minute. This will change:

- **All API endpoints** will require a valid Clerk JWT or API key
- **Anonymous access** will be completely removed
- **Tiered subscriptions** will control access levels and rate limits

## Why Remove Anonymous Access?

1. **Abuse prevention** — Anonymous endpoints are targets for abuse and scraping
2. **Cost control** — Compilation is compute-intensive; registered users can be metered
3. **Better rate limiting** — Per-user limits are more effective than per-IP
4. **Usage analytics** — Understand who uses what, enabling data-driven decisions
5. **Monetization** — Enable paid Pro tier with higher limits

## Migration Timeline

### Phase 1: Soft Enforcement (Current)

- Anonymous access allowed with 10 req/min limit
- Turnstile bot protection on compilation endpoints
- Warning headers added to anonymous responses:
  ```
  X-Auth-Warning: Anonymous access will be removed. Please register for continued access.
  ```

### Phase 2: Registration Encouraged

- Anonymous rate limits reduced to 5 req/min
- Banner in web UI encouraging registration
- API responses include deprecation notice
- Documentation updated with migration guide

### Phase 3: Hard Enforcement

- All compilation/validation/rules endpoints require authentication
- Anonymous requests receive `401 Unauthorized`:
  ```json
  {
      "success": false,
      "error": "Authentication required. Sign up at https://your-domain.com/sign-up or create an API key.",
      "docs": "https://your-domain.com/docs/auth/api-authentication"
  }
  ```
- Only truly public endpoints remain unauthenticated (version, health, config)

## What Changes for API Consumers

### Before (Anonymous)

```bash
# This works today
curl -X POST https://your-worker.workers.dev/compile \
  -H "Content-Type: application/json" \
  -d '{"sources": ["https://example.com/filters.txt"]}'
```

### After (Authenticated)

```bash
# This will be required
curl -X POST https://your-worker.workers.dev/compile \
  -H "Authorization: Bearer abc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"sources": ["https://example.com/filters.txt"]}'
```

## Endpoint Classification

### Always Public (No Change)

These endpoints will remain accessible without authentication:

| Endpoint | Method | Reason |
|----------|--------|--------|
| `/api/version` | GET | Version discovery |
| `/api/clerk-config` | GET | Frontend needs this before auth |
| `/api/turnstile-config` | GET | Frontend needs this before auth |
| `/health` | GET | Load balancer / uptime checks |
| `/health/latest` | GET | Status page integration |
| `/api/webhooks/clerk` | POST | Clerk webhook delivery (Svix-verified) |
| `/api/deployments` | GET | Public deployment history |
| `/api/deployments/stats` | GET | Public deployment stats |

### Requires Free Tier (New Requirement)

These endpoints will require at minimum a free registered account:

| Endpoint | Method | Current | After |
|----------|--------|---------|-------|
| `/compile` | POST | Anonymous + Turnstile | Free+ JWT or API key |
| `/compile/stream` | POST | Anonymous + Turnstile | Free+ JWT or API key |
| `/compile/batch` | POST | Anonymous + Turnstile | Free+ JWT or API key |
| `/validate-rule` | POST | Anonymous | Free+ JWT or API key |
| `/rules` | GET | Anonymous | Free+ JWT or API key |
| `/rules/:id` | GET | Anonymous | Free+ JWT or API key |
| `/metrics` | GET | Anonymous | Free+ JWT or API key |
| `/queue/stats` | GET | Anonymous | Free+ JWT or API key |
| `/queue/history` | GET | Anonymous | Free+ JWT or API key |

### Requires Pro Tier

These endpoints will require a Pro subscription for higher limits:

| Endpoint | Method | Reason |
|----------|--------|--------|
| `/compile/async` | POST | Queue-based compilation — higher resource usage |
| `/compile/batch/async` | POST | Batch queue compilation — highest resource usage |

### Requires Admin Tier

No change — admin endpoints already require authentication:

| Endpoint | Method | Auth |
|----------|--------|------|
| `/admin/storage/*` | Various | Admin key + CF Access (migrating to Clerk Admin tier) |

## Implementation Steps

### Worker Changes

For each endpoint that currently allows anonymous access:

```typescript
// Before (anonymous allowed)
if (routePath === '/compile' && request.method === 'POST') {
    return handleCompile(request, env);
}

// After (auth required)
if (routePath === '/compile' && request.method === 'POST') {
    const authGuard = requireAuth(authContext);
    if (authGuard) return authGuard;

    const tierGuard = requireTier(authContext, UserTier.Free);
    if (tierGuard) return tierGuard;

    return handleCompile(request, env);
}
```

### Frontend Changes

1. **Redirect unauthenticated users** to sign-in page
2. **Remove Turnstile** from compilation flow (auth replaces bot protection)
3. **Show tier-gated UI** — disable features unavailable at user's tier
4. **Display upgrade prompts** for rate-limited users

### Documentation Changes

1. Update API reference with auth requirements
2. Update quick-start guide with registration step
3. Add migration notice to changelog
4. Update Postman collection with auth headers

## Impact on Existing Users

### Web UI Users

- Must create an account to use the compiler
- Free tier provides same functionality with better rate limits (60 vs 10 req/min)
- Sign-up is quick — email + password or social login (Google, GitHub)

### API/Script Users

- Must create an account and generate an API key
- Add `Authorization: Bearer abc_...` header to all requests
- Free tier API key provides 60 req/min (6x current anonymous limit)

### CI/CD Pipelines

- Create a dedicated API key with `compile` scope
- Set expiration appropriate for your pipeline lifecycle
- Store key as a pipeline secret (GitHub Actions secret, GitLab CI variable, etc.)

## FAQ

**Q: Will there be a free tier?**
A: Yes. Free accounts get 60 requests/minute — 6x the current anonymous limit.

**Q: What happens to my existing scripts?**
A: They will stop working once anonymous access is removed. Create an API key and add the `Authorization` header.

**Q: Can I use this without creating an account?**
A: No, once the migration is complete. Registration is quick and free.

**Q: What data do you collect?**
A: Only what Clerk provides: email, name, and profile picture. We don't track compilation content.

**Q: How long do API keys last?**
A: You can set expiration from 1–365 days, or create non-expiring keys.

**Q: What if I hit rate limits?**
A: Upgrade to Pro tier (300 req/min) or contact us for Enterprise needs.
