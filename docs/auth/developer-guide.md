# Authentication Developer Guide

Technical reference for developers working on or extending the adblock-compiler authentication system.

## Architecture

### Authentication Flow

```
Request arrives at Worker
        │
        ▼
┌─────────────────────────┐
│ authenticateRequestUnified() │
│  (worker/middleware/auth.ts)  │
└─────────┬───────────────┘
          │
          ▼
    ┌───────────┐     Yes    ┌────────────────┐
    │ Has Bearer │──────────▶│ Starts with    │
    │ token?     │           │ "abc_" prefix? │
    └─────┬─────┘           └──────┬─────────┘
          │ No                     │
          ▼                   Yes  │  No
    ┌───────────┐            ▼     ▼
    │ Anonymous  │    ┌──────────┐ ┌──────────────┐
    │ (tier: 0)  │    │ API Key  │ │ Clerk JWT    │
    └───────────┘    │ Verify   │ │ Verify       │
                     │ (SHA-256 │ │ (JWKS/RS256) │
                     │  lookup) │ │              │
                     └────┬─────┘ └──────┬───────┘
                          │              │
                          ▼              ▼
                    ┌──────────────────────┐
                    │  IAuthContext         │
                    │  { userId, tier,     │
                    │    authMethod,       │
                    │    scopes }          │
                    └──────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Route Handlers       │
                    │ requireAuth()        │
                    │ requireTier()        │
                    │ requireScope()       │
                    └─────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `worker/types.ts` | Type definitions, tier/scope registries |
| `worker/middleware/auth.ts` | Core auth middleware, guards |
| `worker/middleware/clerk-auth-provider.ts` | Clerk JWT provider (IAuthProvider impl) |
| `worker/middleware/clerk-jwt.ts` | Low-level Clerk JWT verification (jose) |
| `worker/middleware/cf-access.ts` | Cloudflare Access JWT verification |
| `worker/handlers/api-keys.ts` | API key CRUD endpoints |
| `worker/handlers/clerk-webhook.ts` | Clerk webhook handler (svix) |
| `worker/services/user-service.ts` | User provisioning from Clerk data |

## The IAuthProvider Interface

The authentication system is built on an extensible provider interface. You can swap the identity provider without changing middleware or route logic.

### Interface Definition

```typescript
// worker/types.ts
interface IAuthProvider {
    /** Human-readable provider name (e.g., 'clerk', 'auth0') */
    name: string;

    /** Auth method identifier for IAuthContext (e.g., 'clerk-jwt') */
    authMethod: string;

    /** Verify a JWT token from the request and return user identity */
    verifyToken(request: Request): Promise<IAuthProviderResult>;
}

interface IAuthProviderResult {
    valid: boolean;
    userId?: string;
    tier?: UserTier;
    error?: string;
}
```

### Default Implementation: ClerkAuthProvider

```typescript
// worker/middleware/clerk-auth-provider.ts
export class ClerkAuthProvider implements IAuthProvider {
    public readonly name = 'clerk';
    public readonly authMethod = 'clerk-jwt';

    constructor(private readonly env: Env) {}

    async verifyToken(request: Request): Promise<IAuthProviderResult> {
        // Extracts Bearer token, verifies via JWKS, returns userId + tier
    }
}
```

### Creating a Custom Auth Provider

To integrate a different identity provider (e.g., Auth0, Supabase Auth, Firebase Auth):

```typescript
// worker/middleware/my-auth-provider.ts
import type { Env, IAuthProvider, IAuthProviderResult, UserTier } from '../types.ts';

export class MyAuthProvider implements IAuthProvider {
    public readonly name = 'my-provider';
    public readonly authMethod = 'my-provider-jwt';

    constructor(private readonly env: Env) {}

    async verifyToken(request: Request): Promise<IAuthProviderResult> {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return { valid: false, error: 'No bearer token' };
        }

        const token = authHeader.slice(7);

        try {
            // Your JWT verification logic here
            const payload = await verifyMyJwt(token, this.env);

            return {
                valid: true,
                userId: payload.sub,
                tier: mapMyTier(payload.tier) as UserTier,
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
```

### Injecting a Custom Provider

Pass your provider as the 4th argument to `authenticateRequestUnified()`:

```typescript
// In your worker fetch handler:
import { MyAuthProvider } from './middleware/my-auth-provider.ts';

const authProvider = new MyAuthProvider(env);
const authResult = await authenticateRequestUnified(request, env, createPool, authProvider);
```

If omitted, the system defaults to `ClerkAuthProvider`.

## Tier System

### Registry Architecture

Tiers are defined in a central registry (`TIER_REGISTRY`) rather than hardcoded values:

```typescript
// worker/types.ts
export enum UserTier {
    Anonymous = 'anonymous',
    Free = 'free',
    Pro = 'pro',
    Admin = 'admin',
}

export const TIER_REGISTRY: Record<UserTier, ITierConfig> = {
    [UserTier.Anonymous]: {
        order: 0,
        rateLimit: 10,
        displayName: 'Anonymous',
        description: 'Unauthenticated user — basic access',
    },
    [UserTier.Free]: {
        order: 1,
        rateLimit: 60,
        displayName: 'Free',
        description: 'Registered free-tier user',
    },
    [UserTier.Pro]: {
        order: 2,
        rateLimit: 300,
        displayName: 'Pro',
        description: 'Paid pro-tier user — higher limits',
    },
    [UserTier.Admin]: {
        order: 3,
        rateLimit: Infinity,
        displayName: 'Admin',
        description: 'Administrator — unrestricted access',
    },
};
```

### Tier Comparison

```typescript
// Returns true if actual tier meets or exceeds the required tier
isTierSufficient(UserTier.Pro, UserTier.Free);  // true — Pro ≥ Free
isTierSufficient(UserTier.Free, UserTier.Admin); // false — Free < Admin
```

### Adding a New Tier

1. Add to the `UserTier` enum in `worker/types.ts`
2. Add to `TIER_REGISTRY` with appropriate `order`, `rateLimit`, and metadata
3. Update Prisma schema if needed (`prisma/schema.prisma`)
4. Update Clerk public metadata documentation

```typescript
// Example: Adding an "Enterprise" tier between Pro and Admin
export enum UserTier {
    Anonymous = 'anonymous',
    Free = 'free',
    Pro = 'pro',
    Enterprise = 'enterprise', // New
    Admin = 'admin',
}

// In TIER_REGISTRY:
[UserTier.Enterprise]: {
    order: 2.5, // Between Pro (2) and Admin (3) — or renumber
    rateLimit: 1000,
    displayName: 'Enterprise',
    description: 'Enterprise subscriber — highest limits',
},
```

## Scope System

### Registry Architecture

Scopes control fine-grained access for API keys:

```typescript
// worker/types.ts
export enum AuthScope {
    Compile = 'compile',
    Rules = 'rules',
    Admin = 'admin',
}

export const SCOPE_REGISTRY: Record<AuthScope, IScopeConfig> = {
    [AuthScope.Compile]: {
        displayName: 'Compile',
        description: 'Compile and download filter lists',
        requiredTier: UserTier.Free,
    },
    [AuthScope.Rules]: {
        displayName: 'Rules',
        description: 'Create, read, update, delete custom rules',
        requiredTier: UserTier.Free,
    },
    [AuthScope.Admin]: {
        displayName: 'Admin',
        description: 'Full administrative access',
        requiredTier: UserTier.Admin,
    },
};

export const VALID_SCOPES = Object.values(AuthScope);
```

### Scope Enforcement Behavior

| Auth Method | Scope Behavior |
|-------------|---------------|
| **Clerk JWT** | Scopes bypassed — JWT users have full access based on tier |
| **API Key** | Scopes checked — must have all required scopes in the key's `scopes` array |
| **Anonymous** | Returns 401 (not 403) — scopes require authentication |

### Adding a New Scope

1. Add to the `AuthScope` enum in `worker/types.ts`
2. Add to `SCOPE_REGISTRY` with metadata and required tier
3. Use `requireScope()` in route handlers

```typescript
// Example: Adding a 'webhooks' scope
export enum AuthScope {
    Compile = 'compile',
    Rules = 'rules',
    Admin = 'admin',
    Webhooks = 'webhooks', // New
}

// In SCOPE_REGISTRY:
[AuthScope.Webhooks]: {
    displayName: 'Webhooks',
    description: 'Create and manage webhook subscriptions',
    requiredTier: UserTier.Pro,
},
```

## Guard Functions

### `requireAuth(authContext)`

Ensures the request is authenticated (not anonymous). Returns a `Response` if unauthorized, or `null` if authorized.

```typescript
const authGuard = requireAuth(authContext);
if (authGuard) return authGuard; // 401 Unauthorized
// ... proceed with authenticated logic
```

### `requireTier(authContext, requiredTier)`

Ensures the user's tier meets the minimum required level.

```typescript
const tierGuard = requireTier(authContext, UserTier.Pro);
if (tierGuard) return tierGuard; // 403 Forbidden — insufficient tier
// ... proceed with Pro+ logic
```

### `requireScope(authContext, ...requiredScopes)`

Ensures the user has all required scopes (API keys only; JWT users bypass).

```typescript
const scopeGuard = requireScope(authContext, AuthScope.Compile, AuthScope.Rules);
if (scopeGuard) return scopeGuard; // 403 Forbidden — missing scopes
// ... proceed with scoped logic
```

### Composing Guards

Guards can be chained for defense-in-depth:

```typescript
// Require authentication + Pro tier + compile scope
const authGuard = requireAuth(authContext);
if (authGuard) return authGuard;

const tierGuard = requireTier(authContext, UserTier.Pro);
if (tierGuard) return tierGuard;

const scopeGuard = requireScope(authContext, AuthScope.Compile);
if (scopeGuard) return scopeGuard;

// All checks passed — handle request
return handleCompileRequest(request, env);
```

## Webhook Processing

### Clerk Webhook Architecture

```
Clerk Dashboard                   Cloudflare Worker
     │                                  │
     │  POST /api/webhooks/clerk        │
     │  Headers:                        │
     │    svix-id                       │
     │    svix-timestamp                │
     │    svix-signature                │
     │  Body: { type, data }            │
     ├─────────────────────────────────▶│
     │                                  │
     │                          ┌───────┴───────┐
     │                          │ Svix Verify    │
     │                          │ (HMAC check)   │
     │                          └───────┬───────┘
     │                                  │
     │                          ┌───────┴───────┐
     │                          │ Event Router   │
     │                          │ user.created → │
     │                          │ user.updated → │
     │                          │ user.deleted → │
     │                          └───────┬───────┘
     │                                  │
     │                          ┌───────┴───────┐
     │                          │ UserService    │
     │                          │ (PostgreSQL)   │
     │                          └───────────────┘
```

### Processing Logic

- `worker/handlers/clerk-webhook.ts` handles incoming webhooks
- Signature verified using `svix` (npm package, no JSR equivalent)
- Events routed to `worker/services/user-service.ts` for database operations
- Unrecognized events are acknowledged with 200 OK (graceful degradation)

## API Key System

### Key Format

```
abc_<32-random-bytes-base64url>
 │
 └── Prefix identifies token type (vs. Clerk JWT)
```

- **Total length**: ~47 characters
- **Prefix**: `abc_` (4 characters)
- **Random part**: 32 bytes, base64url-encoded
- **Storage**: SHA-256 hash in database; plaintext returned **once** at creation

### Authentication Flow

1. Extract `Authorization: Bearer abc_...` header
2. Detect `abc_` prefix → API key path (not JWT)
3. SHA-256 hash the plaintext key
4. Query `api_keys` table by `key_hash`
5. Validate: not revoked, not expired, has required scopes
6. Look up owner's tier from `users` table
7. Build `IAuthContext` with key's scopes and owner's tier
8. Update `last_used_at` (fire-and-forget)

### Constraints

| Constraint | Value |
|-----------|-------|
| Max keys per user | 25 |
| Max key name length | 100 characters |
| Expiration range | 1–365 days (optional) |
| Valid scopes | `compile`, `rules`, `admin` |
| Rate limit | Per-key `rateLimitPerMinute` (default: 60) |

## Testing

### Auth Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `worker/middleware/auth.test.ts` | Auth middleware, unified auth chain | JWT, API key, anonymous flows |
| `worker/middleware/auth-extensibility.test.ts` | Scope registry, tier registry, guards | Extensibility features |
| `worker/middleware/clerk-jwt.test.ts` | Clerk JWT verification | JWKS, claims validation |
| `worker/middleware/cf-access.test.ts` | CF Access JWT verification | Token parsing, audience check |
| `worker/handlers/api-keys.test.ts` | API key CRUD | Create, list, revoke, update |
| `worker/handlers/clerk-webhook.test.ts` | Webhook processing | Svix verification, event routing |
| `worker/services/user-service.test.ts` | User provisioning | CRUD, tier mapping |

### Testing Custom Auth Providers

```typescript
import { assertEquals } from '@std/assert';
import type { IAuthProvider, IAuthProviderResult } from '../types.ts';

// Create a mock provider for testing
class MockAuthProvider implements IAuthProvider {
    name = 'mock';
    authMethod = 'mock-jwt';

    constructor(private result: IAuthProviderResult) {}

    async verifyToken(_request: Request): Promise<IAuthProviderResult> {
        return this.result;
    }
}

Deno.test('custom provider: valid token', async () => {
    const provider = new MockAuthProvider({
        valid: true,
        userId: 'test-user-123',
        tier: UserTier.Pro,
    });

    const result = await authenticateRequestUnified(
        new Request('https://example.com', {
            headers: { Authorization: 'Bearer test-token' },
        }),
        mockEnv,
        undefined,
        provider,
    );

    assertEquals(result.context.userId, 'test-user-123');
    assertEquals(result.context.tier, UserTier.Pro);
});
```

### Running Auth Tests

```bash
# All auth tests
deno test worker/middleware/ worker/handlers/ worker/services/ --allow-env --allow-net

# Specific test file
deno test worker/middleware/auth-extensibility.test.ts

# With coverage
deno task test:coverage
```

## Dependencies

| Package | Registry | Version | Purpose |
|---------|----------|---------|---------|
| `@panva/jose` | **JSR** | ^6.2.1 | JWT verification (JWKS, RS256) |
| `svix` | **npm** | ^1.62.0 | Webhook signature verification |
| `@clerk/clerk-js` | **pnpm** | ^6.3.0 | Frontend Clerk UI SDK |

### Why These Registries?

- **jose → JSR**: The `@panva/jose` package is published natively on JSR, providing better Deno compatibility than the npm version.
- **svix → npm**: No JSR equivalent exists. The `svix` package provides Clerk webhook signature verification using HMAC.
- **@clerk/clerk-js → pnpm**: Frontend-only Angular dependency. Managed by pnpm workspace for the `frontend/` package.
