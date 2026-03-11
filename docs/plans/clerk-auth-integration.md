# Plan: Implement Authentication & Authorization System (Issue #980)

## Problem Statement

The adblock-compiler currently has only static admin key auth and Turnstile bot protection. Issue #980 calls for a full authentication/authorization system using **Clerk** for user identity, **Cloudflare Access** for admin protection, and integration with the existing Prisma/PostgreSQL database — all following modern patterns and maximizing Cloudflare platform integration.

## Proposed Approach

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend Clerk SDK | `@clerk/clerk-js` (vanilla JS) | No official `@clerk/angular`; `ngx-clerk` is community-maintained, lacks SSR support, and uses observables instead of signals. Direct SDK gives full control and SSR-safety. |
| Angular integration | Custom signal-based `ClerkService` wrapping `@clerk/clerk-js` | Follows existing patterns (like Turnstile init in `app.config.ts`), uses `signal()`, `computed()`, `inject()` — fully Angular 21 idiomatic |
| Worker JWT verification | `jose` library with `createRemoteJWKSet()` | Edge-compatible, uses Web Crypto API internally, built-in JWKS caching, RFC-compliant — recommended for Cloudflare Workers |
| JWKS caching | `jose` in-memory cache + KV fallback | `jose`'s `createRemoteJWKSet()` caches automatically; KV provides persistence across Worker restarts |
| Webhook verification | `svix` library | Clerk webhooks use Svix for signature verification — this is the official approach |
| Database | Existing Prisma/PostgreSQL via Hyperdrive | Add `clerkUserId` field to existing User model; reuse existing ApiKey, Session models |
| Admin protection | Cloudflare Access | Verify `CF-Access-JWT-Assertion` header for admin routes; zero-trust, no code-level secret management |
| UI components | Clerk's pre-built UI mounted into Angular containers | Use `clerk.mountSignIn()`, `clerk.mountUserButton()` etc. — renders Clerk's battle-tested UI in Angular component containers |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Angular 21 Frontend                                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │ClerkSvc  │  │AuthGuard  │  │AuthIntcpt│  │UserButton │  │
│  │(signals) │  │(functional)│  │(bearer)  │  │(mounted)  │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └───────────┘  │
│       │               │              │                        │
│       └───────────────┼──────────────┘                        │
│                       │  Bearer JWT                           │
└───────────────────────┼───────────────────────────────────────┘
                        ▼
┌───────────────────────────────────────────────────────────────┐
│  Cloudflare Worker                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │JWT Middleware │  │API Key Auth  │  │CF Access Validator │  │
│  │(jose/JWKS)   │  │(existing)    │  │(admin routes)      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                  │                    │              │
│         └──────────────────┼────────────────────┘              │
│                            ▼                                   │
│                   ┌─────────────────┐                          │
│                   │  AuthContext     │                          │
│                   │  (userId, role, │                          │
│                   │   tier, apiKey)  │                          │
│                   └────────┬────────┘                          │
│                            ▼                                   │
│               ┌─────────────────────────┐                      │
│               │  Route Handlers         │                      │
│               │  (rate limits by tier)  │                      │
│               └────────────┬────────────┘                      │
│                            ▼                                   │
│            ┌────────────────────────────┐                      │
│            │  PostgreSQL (Hyperdrive)   │                      │
│            │  User, ApiKey, Session     │                      │
│            └────────────────────────────┘                      │
└───────────────────────────────────────────────────────────────┘
```

### User Tiers & Rate Limits

| Tier | Auth Method | Rate Limit | Features |
|------|------------|------------|----------|
| Anonymous | None (+ Turnstile) | 10 req/min | Basic compilation |
| Free Registered | Clerk JWT | 60 req/min | Compilation + history |
| Pro (future) | Clerk JWT + Stripe | 300 req/min | Priority + batch + storage |
| Admin | Clerk JWT + CF Access | Unlimited | Full admin panel |

---

## Implementation Phases

### Phase 1: Worker JWT Middleware & Clerk Backend Integration ✅

**Status**: Complete — committed as `528c5ed51`, `41c9c1c5b`

**Goal**: Verify Clerk JWTs on every Worker request, establish AuthContext.

**Files to create/modify:**
- `worker/middleware/clerk-jwt.ts` — NEW: JWT verification middleware using `jose`
- `worker/middleware/auth.ts` — MODIFY: Integrate JWT auth alongside existing API key auth
- `worker/types/auth.ts` — NEW: AuthContext, ClerkClaims, UserTier types
- `worker/worker.ts` — MODIFY: Wire JWT middleware into request pipeline
- `wrangler.toml` — MODIFY: Add secret references (CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, CLERK_JWKS_URL)
- `deno.json` — MODIFY: Add `jose` dependency
- `package.json` — MODIFY: Add `jose` dependency for Worker bundling

**Implementation details:**
1. Create `worker/middleware/clerk-jwt.ts`:
   - Import `jwtVerify`, `createRemoteJWKSet` from `jose`
   - Create module-level JWKS cache: `createRemoteJWKSet(new URL(env.CLERK_JWKS_URL))`
   - Implement `verifyClerkJWT(request, env)` → extracts Bearer token from Authorization header or `__session` cookie
   - Validate claims: `iss` (Clerk domain), `exp`, `nbf`, `azp` (authorized parties)
   - Return typed `ClerkClaims` with `sub` (user ID), `metadata.role`, custom session claims
   - Graceful fallback: if no token present, return `null` (anonymous user) — don't reject

2. Create `worker/types/auth.ts`:
   - `UserTier` enum: `Anonymous`, `Free`, `Pro`, `Admin`
   - `AuthContext` interface: `{ userId: string | null; clerkUserId: string | null; tier: UserTier; role: string; apiKeyId: string | null; sessionId: string | null }`
   - `ClerkClaims` interface matching Clerk's JWT payload structure

3. Modify `worker/middleware/auth.ts`:
   - Add `authenticateRequest(request, env)` that chains: (1) try Clerk JWT, (2) try API key, (3) fall through to anonymous
   - Return unified `AuthContext` regardless of auth method
   - Preserve existing `authenticateApiKey()` function

4. Wire into `worker/worker.ts`:
   - Early in fetch handler, call `authenticateRequest()` to create `AuthContext`
   - Pass `AuthContext` through to route handlers
   - Adjust rate limiting to use tier-based limits

> **Note**: Route-level auth guards (`requireAuth()`, `requireTier()`) and tiered rate limiting wiring were implemented as a sub-phase and committed separately as `23982141f`.

### Phase 2: Prisma Schema & User Provisioning via Webhooks ✅

**Status**: Complete — committed as `d15248d8d`

**Goal**: Sync Clerk users to PostgreSQL, manage user lifecycle via webhooks.

**Files to create/modify:**
- `prisma/schema.prisma` — MODIFY: Add `clerkUserId` to User, add UserTier enum
- `worker/handlers/clerk-webhook.ts` — NEW: Clerk webhook handler
- `worker/worker.ts` — MODIFY: Add POST `/api/webhooks/clerk` route
- `deno.json` — MODIFY: Add `svix` dependency
- `package.json` — MODIFY: Add `svix` dependency

**Implementation details:**
1. Schema changes:
   - Add `clerkUserId String? @unique` to User model
   - Add `UserTier` enum: `ANONYMOUS`, `FREE`, `PRO`, `ADMIN`
   - Add `tier UserTier @default(FREE)` to User model
   - Add `emailVerified Boolean @default(false)` to User model
   - Run `deno task db:migrate`

2. Webhook handler (`worker/handlers/clerk-webhook.ts`):
   - Verify Svix signature using `env.CLERK_WEBHOOK_SECRET`
   - Handle events:
     - `user.created` → Create User record with clerkUserId, email, name, tier=FREE
     - `user.updated` → Update User record (email, name, metadata changes)
     - `user.deleted` → Soft-delete User record (set `active=false`), revoke API keys
     - `session.created` → Log session for analytics
     - `session.ended` → Update session record
   - Return 200 with `{ received: true }` on success
   - Idempotent: use Svix event ID for dedup

3. Wire webhook route in `worker/worker.ts`:
   - Add `POST /api/webhooks/clerk` — no auth required (Svix signature is the auth)
   - Skip Turnstile verification for webhook endpoint
   - Skip rate limiting for webhook endpoint

### Phase 3: Angular Frontend — ClerkService & Auth UI ✅

**Status**: Complete — committed as `ff8347f99` on `feature/clerk-auth-integration`

**Goal**: Full Clerk integration in Angular 21 using `@clerk/clerk-js` with signals.

**Files to create/modify:**
- `frontend/src/app/services/clerk.service.ts` — NEW: Signal-based Clerk wrapper
- `frontend/src/app/services/auth.service.ts` — MODIFY: Refactor to use ClerkService
- `frontend/src/app/interceptors/auth.interceptor.ts` — NEW: Bearer token injection
- `frontend/src/app/interceptors/error.interceptor.ts` — MODIFY: Handle 401 with Clerk redirect
- `frontend/src/app/guards/auth.guard.ts` — NEW: Clerk-aware functional route guard
- `frontend/src/app/guards/admin.guard.ts` — MODIFY: Integrate Clerk + CF Access
- `frontend/src/app/components/sign-in/sign-in.component.ts` — NEW: Sign-in page
- `frontend/src/app/components/sign-up/sign-up.component.ts` — NEW: Sign-up page
- `frontend/src/app/components/user-button/user-button.component.ts` — NEW: User avatar/menu
- `frontend/src/app/app.config.ts` — MODIFY: Add Clerk initialization via `provideAppInitializer()`
- `frontend/src/app/app.routes.ts` — MODIFY: Add auth routes, apply guards
- `frontend/src/app/app.component.ts` — MODIFY: Add UserButton to header
- `frontend/src/environments/environment.ts` — MODIFY: Add Clerk publishable key
- `frontend/package.json` — MODIFY: Add `@clerk/clerk-js` dependency

**Implementation details:**

1. `ClerkService` (signal-based, SSR-safe):
   ```typescript
   @Injectable({ providedIn: 'root' })
   export class ClerkService {
       private readonly platformId = inject(PLATFORM_ID);
       private readonly document = inject(DOCUMENT);
       private clerkInstance: Clerk | null = null;

       // Signals
       private readonly _isLoaded = signal(false);
       private readonly _user = signal<UserResource | null>(null);
       private readonly _session = signal<SessionResource | null>(null);

       readonly isLoaded = this._isLoaded.asReadonly();
       readonly user = this._user.asReadonly();
       readonly session = this._session.asReadonly();
       readonly isSignedIn = computed(() => !!this._user());
       readonly userId = computed(() => this._user()?.id ?? null);

       async initialize(publishableKey: string): Promise<void> {
           if (!isPlatformBrowser(this.platformId)) return; // SSR-safe
           const { default: Clerk } = await import('@clerk/clerk-js');
           this.clerkInstance = new Clerk(publishableKey);
           await this.clerkInstance.load();
           // Subscribe to Clerk state changes, update signals
           this.clerkInstance.addListener((state) => {
               this._user.set(state.user);
               this._session.set(state.session);
               this._isLoaded.set(true);
           });
       }

       async getToken(): Promise<string | null> {
           return this.clerkInstance?.session?.getToken() ?? null;
       }

       mountSignIn(element: HTMLElement): void {
           this.clerkInstance?.mountSignIn(element);
       }

       mountSignUp(element: HTMLElement): void {
           this.clerkInstance?.mountSignUp(element);
       }

       mountUserButton(element: HTMLElement): void {
           this.clerkInstance?.mountUserButton(element);
       }

       async signOut(): Promise<void> {
           await this.clerkInstance?.signOut();
       }
   }
   ```

2. Auth interceptor (`frontend/src/app/interceptors/auth.interceptor.ts`):
   - Inject `ClerkService`, get token via `getToken()`
   - Attach `Authorization: Bearer <token>` to all API requests
   - Skip for public endpoints (version, health, turnstile-config)

3. Clerk UI components (Angular wrappers):
   - Each component: standalone, uses `afterNextRender()` to mount Clerk UI into a container `<div>`
   - SSR-safe: no DOM access during server render
   - `SignInComponent`: Mounts `clerk.mountSignIn(el)` into template container
   - `SignUpComponent`: Mounts `clerk.mountSignUp(el)` into template container
   - `UserButtonComponent`: Mounts `clerk.mountUserButton(el)` into header

4. App initialization in `app.config.ts`:
   - Add `provideAppInitializer()` that calls `ClerkService.initialize()` with publishable key from environment
   - Similar pattern to existing Turnstile initialization

5. Route updates:
   - `/sign-in` → SignInComponent (public)
   - `/sign-up` → SignUpComponent (public)
   - `/compiler` → Existing (public, enhanced features when signed in)
   - `/admin` → AdminComponent (requires `adminGuard` — Clerk + CF Access)
   - Add `authGuard` (redirects to sign-in if not authenticated)

### Phase 4: API Key Management ✅ (backend: `63d6f2d39`, frontend: `da3190e91`)

**Goal**: Registered users can create/revoke API keys for programmatic access.

**Files to create/modify:**
- `worker/handlers/api-keys.ts` — NEW: CRUD handlers for API keys
- `worker/worker.ts` — MODIFY: Add API key management routes
- `frontend/src/app/components/api-keys/` — NEW: API key management UI
- `docs/api/openapi.yaml` — MODIFY: Add Bearer JWT security scheme, API key endpoints

**Implementation details:**
1. API key endpoints (all require Clerk JWT):
   - `POST /api/keys` — Create new API key (returns plaintext once, stores SHA-256 hash)
   - `GET /api/keys` — List user's API keys (masked, shows metadata)
   - `DELETE /api/keys/:id` — Revoke an API key
   - `PATCH /api/keys/:id` — Update key name/permissions

2. Key generation:
   - Generate 32-byte random key using `crypto.getRandomValues()`
   - Prefix with `abc_` (adblock-compiler) for easy identification
   - Store SHA-256 hash in PostgreSQL via existing ApiKey model
   - Return plaintext key only once on creation

3. Dual auth: requests can authenticate with either Clerk JWT OR API key
   - JWT: `Authorization: Bearer <clerk-jwt>`
   - API key: `X-Api-Key: abc_<key>` (existing header convention)

4. Frontend UI:
   - API Keys management page (standalone component, signals)
   - Create key dialog (Material dialog)
   - Key list with copy/revoke actions
   - Show key only once on creation (with copy button)

### Phase 5: Cloudflare Access for Admin Routes ✅ (`63d6f2d39`)

**Goal**: Admin routes protected by Cloudflare Access zero-trust.

**Files to create/modify:**
- `worker/middleware/cf-access.ts` — NEW: CF Access JWT verification
- `worker/middleware/auth.ts` — MODIFY: Integrate CF Access check for admin routes
- `worker/worker.ts` — MODIFY: Apply CF Access middleware to admin routes

**Implementation details:**
1. CF Access middleware:
   - Extract `CF-Access-JWT-Assertion` header
   - Verify JWT using CF Access team domain's JWKS: `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`
   - Validate `iss`, `aud` (Access application AUD tag), `exp`
   - Can reuse `jose` library (same as Clerk JWT verification)

2. Admin route protection:
   - Admin routes require BOTH: valid Clerk JWT with admin role AND valid CF Access token
   - Defense-in-depth: even if Clerk is compromised, CF Access provides independent verification

3. Frontend admin detection:
   - Check for CF Access headers in initial page load
   - Admin UI only shows for users with both Clerk admin role + CF Access token

### Phase 6: Testing ✅ (`9ef13ede0`)

**Goal**: Full test coverage for all auth components.

**Backend tests (Deno, 46 tests — ALL PASS):**
- `worker/handlers/api-keys.test.ts` — 23 tests: CRUD, validation, user isolation
- `worker/handlers/clerk-webhook.test.ts` — 6 tests: Svix signature verification, event routing
- `worker/services/user-service.test.ts` — 11 tests: upsert, find, delete, tier management
- `worker/middleware/cf-access.test.ts` — 6 tests: CF Access JWT validation, skip paths

**Frontend tests (Vitest + Angular, 49 tests — ALL PASS):**
- `frontend/src/app/services/clerk.service.spec.ts` — 11 tests: SSR safety, signals, init
- `frontend/src/app/services/api-key.service.spec.ts` — 15 tests: CRUD with HttpTestingController
- `frontend/src/app/guards/auth.guard.spec.ts` — 4 tests: redirect logic, loading state
- `frontend/src/app/interceptors/auth.interceptor.spec.ts` — 5 tests: Bearer token injection
- `frontend/src/app/components/api-keys/api-keys.component.spec.ts` — 14 tests: Material UI, create/revoke

**Total: 95 auth-specific tests. Full suite: 1396 backend + 353 frontend = 1749 tests.**

---

## Dependencies to Add

| Package | Target | Purpose |
|---------|--------|---------|
| `jose` | Worker (deno.json + package.json) | JWT verification, JWKS fetching |
| `svix` | Worker (deno.json + package.json) | Clerk webhook signature verification |
| `@clerk/clerk-js` | Frontend (frontend/package.json) | Clerk vanilla JS SDK for Angular |
| `@clerk/types` | Frontend (frontend/package.json) | TypeScript types for Clerk |

## Secrets to Configure

| Secret | Target | Purpose |
|--------|--------|---------|
| `CLERK_SECRET_KEY` | wrangler.toml secret | Backend API calls to Clerk |
| `CLERK_PUBLISHABLE_KEY` | wrangler.toml var | Frontend initialization (not secret) |
| `CLERK_WEBHOOK_SECRET` | wrangler.toml secret | Svix webhook verification |
| `CLERK_JWKS_URL` | wrangler.toml var | JWKS endpoint for JWT verification |
| `CF_ACCESS_TEAM_DOMAIN` | wrangler.toml var | Cloudflare Access team domain |
| `CF_ACCESS_AUD` | wrangler.toml var | CF Access application audience tag |

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `@clerk/clerk-js` bundle size in frontend | Dynamic import via `import()` — only loaded when needed, not in initial bundle |
| JWKS fetch latency on cold Worker start | `jose`'s `createRemoteJWKSet()` caches keys automatically; optionally back with KV |
| `ngx-clerk` would be easier | Community package lacks SSR, signals, and Angular 21 guarantees — direct SDK is more maintainable |
| Webhook delivery failures | Implement idempotency via Svix event ID; Clerk retries automatically |
| Migration complexity | Phased approach — each phase is independently deployable and adds value |

## Notes

- **Backward compatibility**: Anonymous access continues to work exactly as today — auth is additive, not breaking
- **Existing Turnstile**: Stays in place for bot protection on anonymous endpoints; Clerk JWT bypasses Turnstile for authenticated users
- **Existing admin key**: Retained as fallback during migration; deprecated after CF Access is live
- **SSR safety**: All Clerk operations guarded with `isPlatformBrowser()` — server renders show loading state
- **OpenAPI spec**: Must be updated with Bearer JWT security scheme after Phase 1; run `deno task schema:generate` after changes

---

## Extensibility Improvements ✅ (Post-Phase 6)

After completing all 6 phases, the auth system was reviewed for extensibility. Four improvements were identified and implemented in commit `ea38e5ca4`:

### 1. Scope Registry ✅
- Replaced hardcoded `VALID_SCOPES` string array with `AuthScope` enum + `SCOPE_REGISTRY` (metadata per scope: displayName, description, requiredTier)
- `isValidScope()` type guard for runtime validation
- `api-keys.ts` now derives scopes from registry instead of local const

### 2. Centralized Tier Config ✅
- Added `TIER_REGISTRY`: `Record<UserTier, ITierConfig>` with order, rateLimit, displayName, description
- `isTierSufficient()` helper uses registry order — adding a new tier is a single registry entry
- `TIER_RATE_LIMITS` marked `@deprecated`, now derives from `TIER_REGISTRY`
- `requireTier()` refactored to use `isTierSufficient()` and registry display names

### 3. `requireScope()` Guard ✅
- New guard in `auth.ts`: JWT users bypass scope checks (full access), API key users checked against their scopes
- Returns 403 with descriptive error listing missing scopes
- Anonymous users get 401

### 4. `IAuthProvider` Interface ✅
- Extracted `IAuthProvider` and `IAuthProviderResult` interfaces to `worker/types.ts`
- Created `ClerkAuthProvider` class (`worker/middleware/clerk-auth-provider.ts`) wrapping existing `verifyClerkJWT()`
- `authenticateRequestUnified()` now accepts optional `IAuthProvider` param, defaulting to `ClerkAuthProvider`
- Swapping auth providers (e.g., Auth0, Supabase Auth) is now a config change — implement `IAuthProvider` and pass it in

### 5. API Key Tier Lookup Fix ✅
- API key auth path now queries `users` table for the key owner's actual tier
- Replaced hardcoded `UserTier.Free` with `resolveApiKeyOwnerTier()` DB lookup
- Falls back to `UserTier.Free` on DB errors or missing user

### Testing
- 23 new extensibility tests in `worker/middleware/auth-extensibility.test.ts`
- Covers: scope registry, tier registry, `isTierSufficient()`, `requireScope()`, `requireTier()`, `ClerkAuthProvider` structure, guard chains
- Total: **1419 tests, 0 failures**
