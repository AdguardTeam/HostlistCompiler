# ZTA Developer Guide

Practical guide for contributors working on the adblock-compiler. Follow these patterns to maintain Zero Trust Architecture compliance.

## Adding a New Worker Endpoint

Every new endpoint must follow this pattern:

```typescript
// 1. Auth gate — verify before any business logic
const authGuard = requireAuth(authContext);
if (authGuard) return authGuard;

// 2. Rate limiting — enforce per-tier limits
const rateLimit = await checkRateLimitTiered(env, ip, authContext);
if (!rateLimit.allowed) {
    analytics.trackSecurityEvent({
        eventType: 'rate_limit',
        path: '/your/endpoint',
        method: request.method,
        clientIpHash: AnalyticsService.hashIp(ip),
        tier: authContext.tier,
        reason: 'rate_limit_exceeded',
    });
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
}

// 3. Validate input with Zod
const parsed = YourInputSchema.safeParse(await request.json());
if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
}

// 4. Execute business logic
const result = await doWork(parsed.data);

// 5. Response — CORS is applied automatically by the fetch() wrapper
return Response.json(result);
```

## CORS: Which Function to Use

| Scenario | Function | Returns |
|----------|----------|---------|
| Public read-only endpoint | `getPublicCorsHeaders()` | `Access-Control-Allow-Origin: *` |
| Authenticated/write endpoint | `getCorsHeaders(request, env)` | Origin-reflected from allowlist |
| OPTIONS preflight | `handleCorsPreflight(request, env)` | Full preflight response |

**Never** add `Access-Control-Allow-Origin: *` directly. Import from `worker/utils/cors.ts`.

## D1 Database Queries

**Always** use parameterized queries:

```typescript
// ✅ Correct
const result = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

// ❌ Wrong — SQL injection risk
const result = await env.DB.prepare(`SELECT * FROM users WHERE id = '${userId}'`).first();
```

## Frontend API Consumption

All API responses must be Zod-validated before use:

```typescript
import { validateResponse } from '../schemas/api-responses';
import { YourResponseSchema } from '../schemas/api-responses';

// In an Observable pipe
return this.http.get<unknown>(url).pipe(
    map(raw => validateResponse(YourResponseSchema, raw, 'YourService.method'))
);

// With async/await
const raw = await firstValueFrom(this.http.get<unknown>(url));
return validateResponse(YourResponseSchema, raw, 'YourService.method');
```

## Adding Zod Schemas

Add new schemas to `frontend/src/app/schemas/api-responses.ts`:

```typescript
export const NewResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        // your fields
    }),
}).passthrough(); // Allow extra fields for forward compatibility
```

## Secrets Management

| Value Type | Storage | Example |
|-----------|---------|---------|
| Secret / credential | `wrangler secret put` | `CLERK_SECRET_KEY`, `ADMIN_KEY` |
| Public config | `wrangler.toml [vars]` | `CORS_ALLOWED_ORIGINS`, `COMPILER_VERSION` |
| Local dev | `.env.local` (gitignored) | All values |

**Never** commit secrets to source or put them in `wrangler.toml [vars]`.

## Auth Token Management (Frontend)

```typescript
// ✅ Correct — use Clerk SDK
const token = await clerk.session?.getToken();

// ❌ Wrong — never store tokens manually
localStorage.setItem('token', jwt);
```

The HTTP interceptor (`auth.interceptor.ts`) automatically attaches Bearer tokens. Do not attach tokens manually in service code.

## PR Checklist

Every PR touching `worker/` or `frontend/` must complete the ZTA checklist in the PR template. The CI `zta-lint` workflow runs automated checks, but the checklist covers items that require human review.

## Common Mistakes

1. **Forgetting `requireAuth()`** — Every write endpoint needs an auth gate
2. **Using `Response.json()` with manual CORS** — The `fetch()` wrapper adds CORS; don't duplicate
3. **Flushing empty objects in tests** — Zod validation means mock data must match schemas
4. **String interpolation in SQL** — Always `.prepare().bind()`
5. **Storing auth state in components** — Use `ClerkService` signals
