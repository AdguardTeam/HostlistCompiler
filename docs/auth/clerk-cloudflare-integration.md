# Clerk + Cloudflare Integration Guide

This document explains how Clerk authentication integrates with the Cloudflare Workers platform. It covers every touchpoint between Clerk and Cloudflare services — JWT verification, KV rate limiting, Hyperdrive user storage, webhook handling, Turnstile bot protection, frontend deployment, and analytics.

> **See also:** [Cloudflare Access](cloudflare-access.md) for the separate defense-in-depth layer on admin routes.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Cloudflare Services Used by Clerk Auth](#cloudflare-services-used-by-clerk-auth)
- [JWT Verification in Workers](#jwt-verification-in-workers)
  - [JWKS Fetching and Caching](#jwks-fetching-and-caching)
  - [Token Extraction](#token-extraction)
  - [Verification Flow](#verification-flow)
- [Wrangler Secrets and Variables](#wrangler-secrets-and-variables)
  - [Setting Secrets](#setting-secrets)
  - [Setting Variables](#setting-variables)
  - [Local Development (.dev.vars)](#local-development-devvars)
- [Tier-Based Rate Limiting with KV](#tier-based-rate-limiting-with-kv)
  - [KV Namespace](#kv-namespace)
  - [Tier Limits](#tier-limits)
  - [Key Strategy](#key-strategy)
  - [Rate Limit Flow](#rate-limit-flow)
- [User Data Sync via Hyperdrive + PostgreSQL](#user-data-sync-via-hyperdrive--postgresql)
  - [Webhook Route](#webhook-route)
  - [Svix Signature Verification](#svix-signature-verification)
  - [Prisma User Model](#prisma-user-model)
  - [Webhook Event Handling](#webhook-event-handling)
- [API Key Storage in PostgreSQL](#api-key-storage-in-postgresql)
- [Turnstile Bot Protection](#turnstile-bot-protection)
- [Frontend Deployment on Workers](#frontend-deployment-on-workers)
  - [Static Assets and SSR](#static-assets-and-ssr)
  - [Clerk JS SDK in Angular](#clerk-js-sdk-in-angular)
  - [Auth Interceptor](#auth-interceptor)
  - [Clerk Config Endpoint](#clerk-config-endpoint)
- [Cloudflare Queues and Auth](#cloudflare-queues-and-auth)
- [Analytics Engine and Auth Events](#analytics-engine-and-auth-events)
- [Complete Integration Map](#complete-integration-map)
- [Configuring Cloudflare for Clerk](#configuring-cloudflare-for-clerk)
  - [Step 1: Create the Worker](#step-1-create-the-worker)
  - [Step 2: Set Clerk Secrets](#step-2-set-clerk-secrets)
  - [Step 3: Configure KV Namespace](#step-3-configure-kv-namespace)
  - [Step 4: Configure Hyperdrive](#step-4-configure-hyperdrive)
  - [Step 5: Configure Turnstile](#step-5-configure-turnstile)
  - [Step 6: Deploy and Verify](#step-6-deploy-and-verify)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```mermaid
flowchart LR
    subgraph Browser
        CLERKJS["Browser\n(Clerk JS SDK)"]
    end

    subgraph DASH["Clerk Dashboard (Svix)"]
        SVIX["Clerk Dashboard"]
    end

    subgraph WORKER["Cloudflare Worker"]
        JWT_VERIFY["Clerk JWT\nVerification"]
        RATE_LIMITER["Rate Limiter\n(by tier)"]
        HANDLER["Handler"]
        JWKS["JWKS (jose)\ncached"]
        KV_RATE["KV\nRATE_LIMIT"]
        WEBHOOK["Webhook Handler\n(Svix verify)"]
        USER_SVC["User Service\n(Prisma)"]
        HYPERDRIVE["Hyperdrive\n→ PostgreSQL"]
        TURNSTILE["Turnstile\nVerification"]
        ANALYTICS["Analytics\nEngine"]
    end

    CLERKJS -->|JWT| JWT_VERIFY
    JWT_VERIFY --> RATE_LIMITER
    RATE_LIMITER --> HANDLER
    JWT_VERIFY -.-> JWKS
    RATE_LIMITER -.-> KV_RATE
    SVIX -->|POST webhook| WEBHOOK
    WEBHOOK --> USER_SVC
    USER_SVC --> HYPERDRIVE
```

---

## Cloudflare Services Used by Clerk Auth

| Cloudflare Service | Binding | Purpose in Auth |
|---|---|---|
| **Workers** | (runtime) | Hosts all auth middleware and handlers |
| **KV** | `RATE_LIMIT` | Tier-based rate limiting counters |
| **Hyperdrive** | `HYPERDRIVE` | Connection pooling to PostgreSQL for user/API-key storage |
| **D1** | `DB` | Legacy admin database (not primary Clerk storage) |
| **Turnstile** | `TURNSTILE_SECRET_KEY` | Bot protection on compilation endpoints |
| **Analytics Engine** | `ANALYTICS_ENGINE` | Operational metrics (no dedicated auth events yet) |
| **Queues** | `ADBLOCK_COMPILER_QUEUE` | Async compilation (auth applied before queueing) |
| **Worker Secrets** | (runtime) | Stores `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, etc. |
| **Worker Assets** | `ASSETS` | Serves the Angular frontend (which loads Clerk JS) |

---

## JWT Verification in Workers

**Source:** `worker/middleware/clerk-jwt.ts`

Clerk JWTs are verified inside the Cloudflare Worker using the `jose` library (`jsr:@panva/jose`). The Worker fetches Clerk's public keys (JWKS) and caches them at the module level for the lifetime of the Worker isolate.

### JWKS Fetching and Caching

```typescript
// Module-level singleton — persists across requests within one isolate
const jwksCache = new Map<string, JWTVerifyGetKey>();

function getJwksResolver(jwksUrl: string): JWTVerifyGetKey {
    let resolver = jwksCache.get(jwksUrl);
    if (!resolver) {
        resolver = createRemoteJWKSet(new URL(jwksUrl));
        jwksCache.set(jwksUrl, resolver);
    }
    return resolver;
}
```

- The JWKS URL comes from `env.CLERK_JWKS_URL` (e.g., `https://your-instance.clerk.accounts.dev/.well-known/jwks.json`)
- `createRemoteJWKSet()` from `jose` handles fetching and caching keys internally
- The outer `Map` avoids recreating the resolver on every request
- Cache is cleared when the Worker isolate is recycled (typically after a few minutes of inactivity)

### Token Extraction

The middleware checks two locations for the Clerk JWT:

1. **`Authorization: Bearer <token>`** header — used by API clients and the Angular `authInterceptor`
2. **`__session` cookie** — set by Clerk's frontend SDK for browser requests

### Verification Flow

```typescript
const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['RS256'],   // Clerk uses RS256
    clockTolerance: 5,       // 5-second skew tolerance
});
```

Validation checks:
- **Signature** — RS256 via JWKS
- **Issuer** — must match Clerk domain pattern
- **Authorized party (azp)** — validated against `Origin` header when present
- **Expiration** — JWT must not be expired (with 5s tolerance)

Returns an `IJwtVerificationResult` with `userId`, `email`, `tier`, and other claims on success.

---

## Wrangler Secrets and Variables

**Source:** `worker/types.ts` — `Env` interface

### Setting Secrets

Secrets are encrypted and never visible in build output or wrangler.toml:

```bash
# Clerk backend API key (for server-side Clerk API calls)
wrangler secret put CLERK_SECRET_KEY
# Enter: sk_live_abc123...

# Webhook signing secret (from Clerk Dashboard → Webhooks)
wrangler secret put CLERK_WEBHOOK_SECRET
# Enter: whsec_abc123...
```

### Setting Variables

Public variables are safe to commit in `wrangler.toml`:

```toml
[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_abc123..."
CLERK_JWKS_URL = "https://your-instance.clerk.accounts.dev/.well-known/jwks.json"
```

### Local Development (.dev.vars)

Create a `.dev.vars` file in the project root (gitignored):

```ini
CLERK_SECRET_KEY=sk_test_abc123...
CLERK_PUBLISHABLE_KEY=pk_test_abc123...
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_WEBHOOK_SECRET=whsec_abc123...
TURNSTILE_SITE_KEY=0x4AAAAAAA...
TURNSTILE_SECRET_KEY=0x4AAAAAAA...
ADMIN_KEY=your-local-admin-key
```

### Complete Clerk Environment Variables

| Variable | Type | Secret? | Description |
|---|---|---|---|
| `CLERK_SECRET_KEY` | `string` | **Yes** | Backend API key for Clerk SDK calls |
| `CLERK_PUBLISHABLE_KEY` | `string` | No | Frontend key — served via `/api/clerk-config` |
| `CLERK_JWKS_URL` | `string` | No | JWKS endpoint for JWT verification |
| `CLERK_WEBHOOK_SECRET` | `string` | **Yes** | Svix signing key for webhook verification |

---

## Tier-Based Rate Limiting with KV

**Source:** `worker/middleware/index.ts`

Clerk user tiers directly control rate limits, enforced via Cloudflare KV.

### KV Namespace

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "5dc36da36d9142cc9ced6c56328898ee"
```

### Tier Limits

| Tier | Requests/Minute | Identification |
|---|---|---|
| **Anonymous** | 10 | IP address (no Clerk JWT) |
| **Free** | 60 | Clerk user ID |
| **Pro** | 300 | Clerk user ID |
| **Admin** | ∞ (unlimited) | Clerk user ID — bypasses KV entirely |

### Key Strategy

Rate limit counters are keyed differently based on authentication status:

```
Authenticated user:   ratelimit:user:<clerkUserId>
Anonymous user:       ratelimit:ip:<clientIp>
```

Using `clerkUserId` for authenticated users avoids problems where multiple users behind the same NAT gateway share an IP address.

### Rate Limit Flow

```mermaid
flowchart TD
    A[Request arrives] --> B[authenticateRequestUnified\ndetermines tier]
    B --> C[checkRateLimitTiered\ntier, userId, ip]
    C --> D{Admin tier?}
    D -- Yes --> E[Skip KV\nreturn allowed: true]
    D -- No --> F[Build key\nratelimit:user:id or ratelimit:ip:ip]
    F --> G[KV.get key\nparse count + resetAt]
    G --> H{Window expired?}
    H -- Yes --> I[Reset count to 0]
    I --> J{count < tierLimit?}
    H -- No --> J
    J -- Yes --> K[Increment, KV.put\nreturn allowed: true]
    J -- No --> L[return allowed: false\n429 Too Many Requests]
```

KV entries use TTL = `RATE_LIMIT_WINDOW + 10` seconds to auto-expire stale counters.

---

## User Data Sync via Hyperdrive + PostgreSQL

When users sign up, update profiles, or delete accounts in Clerk, the changes are synced to the Worker's PostgreSQL database via webhooks.

### Webhook Route

```
POST /api/webhooks/clerk → handleClerkWebhook()
```

**Source:** `worker/handlers/clerk-webhook.ts`

This route is **exempt** from Clerk auth and rate limiting (since it's Clerk calling us, verified via Svix).

### Svix Signature Verification

Every webhook from Clerk is signed using [Svix](https://www.svix.com/). The Worker verifies the signature before processing:

```typescript
const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
const event = wh.verify(rawBody, {
    'svix-id': request.headers.get('svix-id'),
    'svix-timestamp': request.headers.get('svix-timestamp'),
    'svix-signature': request.headers.get('svix-signature'),
}) as ClerkWebhookEvent;
```

- Uses HMAC-SHA256 with a timestamp nonce (prevents replay attacks)
- The secret (`whsec_...`) is provided when creating the webhook endpoint in Clerk Dashboard
- Invalid signatures return `401 Unauthorized`

### Prisma User Model

**Source:** `prisma/schema.prisma`

```prisma
model User {
    id             String    @id @default(uuid()) @db.Uuid
    email          String    @unique
    displayName    String?   @map("display_name")
    role           String    @default("user")

    // Clerk-synced fields
    clerkUserId    String?   @unique @map("clerk_user_id")
    tier           String    @default("free")
    firstName      String?   @map("first_name")
    lastName       String?   @map("last_name")
    imageUrl       String?   @map("image_url")
    emailVerified  Boolean   @default(false)
    lastSignInAt   DateTime? @map("last_sign_in_at")

    apiKeys  ApiKey[]
    sessions Session[]

    @@map("users")
}
```

The database is accessed via **Cloudflare Hyperdrive**, which provides connection pooling to the external PostgreSQL instance (PlanetScale or Neon).

### Webhook Event Handling

| Clerk Event | Action | Method |
|---|---|---|
| `user.created` | Insert/upsert user record | `upsertUserFromClerk()` |
| `user.updated` | Update user fields, tier, role | `upsertUserFromClerk()` |
| `user.deleted` | Hard-delete user record | `deleteUserByClerkId()` |

**Tier and role mapping** from Clerk metadata:

```typescript
// Clerk user.public_metadata.tier → User.tier
// Clerk user.public_metadata.role → User.role
tier: typeof meta.tier === 'string' ? meta.tier : undefined,
role: typeof meta.role === 'string' ? meta.role : undefined,
```

Set these in the Clerk Dashboard under **Users → [user] → Public Metadata**:
```json
{
    "tier": "pro",
    "role": "admin"
}
```

---

## API Key Storage in PostgreSQL

**Source:** `worker/handlers/api-keys.ts`, `prisma/schema.prisma`

API keys are tied to Clerk users and stored in PostgreSQL via Hyperdrive.

```prisma
model ApiKey {
    id                 String    @id @default(uuid()) @db.Uuid
    userId             String    @map("user_id") @db.Uuid
    keyHash            String    @unique @map("key_hash")
    keyPrefix          String    @map("key_prefix")
    name               String
    scopes             String[]  @default(["compile"])
    rateLimitPerMinute Int       @default(60) @map("rate_limit_per_minute")
    expiresAt          DateTime? @map("expires_at")
    revokedAt          DateTime? @map("revoked_at")

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@map("api_keys")
}
```

### Key Security

- **Only the SHA-256 hash** is stored — the plaintext key is returned once at creation time
- Keys are prefixed with `abc_` for identification
- Revoking a key sets `revokedAt` (soft delete) — the hash remains for audit
- When a user is deleted via Clerk webhook, their API keys are cascade-deleted

### How API Keys Interact with Clerk Tiers

When a request uses an API key:

1. The key hash is looked up in `api_keys`
2. The associated `user_id` resolves to a `User` record
3. The user's `tier` determines the rate limit
4. The key's `scopes` determine which endpoints are accessible

---

## Turnstile Bot Protection

**Source:** `worker/middleware/index.ts`

Cloudflare Turnstile and Clerk auth are **independent, complementary layers**:

| Layer | Purpose | Checks |
|---|---|---|
| **Turnstile** | Bot protection | Is this a real human/browser? |
| **Clerk JWT** | Identity | Who is this user? What tier? |

### Endpoints with Turnstile

| Endpoint | Turnstile | Clerk Auth |
|---|---|---|
| `POST /api/compile` | ✅ | ✅ |
| `POST /api/compile/batch` | ✅ | ✅ |
| `POST /api/compile/async` | ✅ | ✅ |
| `POST /api/webhooks/clerk` | ❌ | ❌ (Svix verified) |
| `GET /api/version` | ❌ | ❌ (public) |
| `GET /admin/storage/*` | ❌ | ❌ (admin key + CF Access) |

A Clerk-authenticated user **still receives a Turnstile check** on compilation endpoints — being authenticated doesn't bypass bot protection.

### Turnstile Configuration

```bash
# Wrangler secrets
wrangler secret put TURNSTILE_SITE_KEY    # Public key for the frontend widget
wrangler secret put TURNSTILE_SECRET_KEY  # Secret for server-side verification
```

Create a Turnstile widget at [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile):

1. Click **Add Widget**
2. Set the domain to your Worker's domain
3. Choose **Managed** mode (recommended)
4. Copy the site key and secret key

The frontend serves the Turnstile config via:
```
GET /api/turnstile-config → { siteKey: "...", enabled: true }
```

---

## Frontend Deployment on Workers

### Static Assets and SSR

The Angular 21 frontend is deployed as Cloudflare Worker static assets with server-side rendering:

```toml
# wrangler.toml (main worker)
[assets]
directory = "./frontend/dist/adblock-compiler/browser"
binding = "ASSETS"
html_handling = "auto-trailing-slash"
not_found_handling = "single-page-application"  # SPA fallback for Angular routes
```

The build process (`scripts/build-worker.sh`):
1. Builds the Angular app with SSR (`ng build`)
2. Copies the browser output to the assets directory
3. Replaces `{{CF_WEB_ANALYTICS_TOKEN}}` in `index.html` if set

### Clerk JS SDK in Angular

**Source:** `frontend/src/app/services/clerk.service.ts`

The Angular app uses `@clerk/clerk-js` (vanilla JS SDK) wrapped in a signal-based Angular service:

```typescript
@Injectable({ providedIn: 'root' })
export class ClerkService {
    private readonly _user = signal<ClerkUser | null>(null);
    private readonly _session = signal<ClerkSession | null>(null);
    readonly isSignedIn = computed(() => !!this._user());
    readonly user = this._user.asReadonly();

    async initialize(publishableKey: string): Promise<void> {
        const { default: ClerkJS } = await import('@clerk/clerk-js');
        this.clerkInstance = new ClerkJS(publishableKey);
        await this.clerkInstance.load();

        this.clerkInstance.addListener((state) => {
            this._user.set(state.user ?? null);
            this._session.set(state.session ?? null);
        });
    }

    async getToken(): Promise<string | null> {
        return (await this.clerkInstance?.session?.getToken()) ?? null;
    }
}
```

- **SSR-safe**: Clerk is only initialized in the browser (`isPlatformBrowser` check)
- **Dynamic import**: `@clerk/clerk-js` is loaded lazily to reduce bundle size
- **Signal-based**: All state is exposed via Angular signals for zoneless change detection

### Auth Interceptor

**Source:** `frontend/src/app/interceptors/auth.interceptor.ts`

The Angular `authInterceptor` automatically attaches Clerk JWTs to API requests:

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const clerk = inject(ClerkService);

    if (!clerk.isSignedIn()) return next(req);

    // Skip public endpoints
    const PUBLIC_PATHS = ['/api/version', '/api/health', '/api/turnstile-config'];
    if (PUBLIC_PATHS.some((p) => req.url.includes(p))) return next(req);

    // Attach Bearer token
    return from(clerk.getToken()).pipe(
        switchMap((token) => {
            if (token) {
                return next(req.clone({
                    setHeaders: { Authorization: `Bearer ${token}` },
                }));
            }
            return next(req);
        }),
    );
};
```

### Clerk Config Endpoint

The Worker serves the publishable key to the frontend:

```
GET /api/clerk-config → { publishableKey: "pk_live_..." }
```

This allows the frontend to initialize Clerk without hardcoding the key. The publishable key is NOT a secret — it's safe to expose publicly.

---

## Cloudflare Queues and Auth

**Bindings:**
- `ADBLOCK_COMPILER_QUEUE` — standard priority
- `ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY` — priority compilations

Queues are **not** directly integrated with Clerk auth. The auth layer operates at the HTTP request level:

```
Request → Auth (Clerk JWT/API key) → Rate Limit → Queue message → Consumer
```

- Auth and tier checks happen **before** a message is enqueued
- Queue messages do **not** carry auth context (no user ID, no tier)
- The consumer processes all messages equally regardless of the original requester's tier

---

## Analytics Engine and Auth Events

**Binding:** `ANALYTICS_ENGINE`

The Analytics Engine currently tracks operational metrics (compilation, cache, workflows) but does **not** have dedicated auth event types:

```typescript
type AnalyticsEventType =
    | 'compilation_request'
    | 'compilation_success'
    | 'compilation_error'
    | 'cache_hit'
    | 'cache_miss'
    | 'rate_limit_exceeded'
    | 'source_fetch'
    | 'workflow_started'
    | 'api_request'
    // ... no 'user_authenticated', 'auth_failure', etc.
```

`rate_limit_exceeded` events are tracked, which indirectly captures auth-related activity since rate limits are tier-based.

> **Future consideration:** Adding `auth_success`, `auth_failure`, `api_key_created`, `api_key_revoked` event types would improve auth observability.

---

## Complete Integration Map

```mermaid
flowchart TD
    subgraph CFW["Cloudflare Worker Runtime"]
        subgraph Secrets["Clerk Secrets (encrypted at rest)"]
            S1[CLERK_SECRET_KEY → Clerk API calls]
            S2[CLERK_WEBHOOK_SECRET → Svix verification]
            S3["(CLERK_PUBLISHABLE_KEY) → Served to frontend"]
            S4["(CLERK_JWKS_URL) → JWKS endpoint"]
        end

        subgraph Pipeline["Auth Middleware Pipeline"]
            P1[1. Extract JWT\nBearer header / __session cookie]
            P2[2. Verify JWT signature\njose + JWKS from Clerk]
            P3[3. Resolve tier\nJWT claims or API key → User record]
            P4[4. Rate limit via KV\nkeyed by userId or IP]
            P5[5. Verify Turnstile token\ncompilation endpoints]
            P6[6. Dispatch to handler]
            P1 --> P2 --> P3 --> P4 --> P5 --> P6
        end

        KV["KV / RATE_LIMIT\nRate limit counters by tier"]
        HP["Hyperdrive → PostgreSQL\nusers · api_keys · sessions"]
        Assets["Assets\nAngular + Clerk JS\nClerkService · authInterceptor · authGuard"]
        Queues["Queues\nAuth applied before enqueue\n(not in message)"]
        Analytics["Analytics Engine\nrate_limit_exceeded events"]
        Turnstile["Turnstile\nBot protection on compile endpoints\n(independent of Clerk auth)"]
    end

    Pipeline --> KV
    Pipeline --> HP
    Pipeline --> Assets
    Pipeline --> Queues
    Pipeline --> Analytics
    Pipeline --> Turnstile
```

---

## Configuring Cloudflare for Clerk

### Step 1: Create the Worker

If not already created:

```bash
# Deploy the worker
wrangler deploy
```

### Step 2: Set Clerk Secrets

```bash
# Required secrets
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET

# Verify secrets are set
wrangler secret list
```

Add public variables to `wrangler.toml`:

```toml
[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_..."
CLERK_JWKS_URL = "https://your-instance.clerk.accounts.dev/.well-known/jwks.json"
```

### Step 3: Configure KV Namespace

The `RATE_LIMIT` KV namespace must exist for tier-based rate limiting:

```bash
# Create if not exists
wrangler kv namespace create "RATE_LIMIT"

# Add the returned ID to wrangler.toml
# [[kv_namespaces]]
# binding = "RATE_LIMIT"
# id = "<returned-id>"
```

### Step 4: Configure Hyperdrive

Hyperdrive connects the Worker to PostgreSQL where user data and API keys are stored:

```bash
# Create Hyperdrive configuration
wrangler hyperdrive create adblock-compiler-db \
  --connection-string="postgresql://user:pass@host:5432/dbname"
```

Add to `wrangler.toml`:
```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<returned-id>"
```

Run Prisma migrations to create the users/api_keys tables:
```bash
deno task db:migrate
```

### Step 5: Configure Turnstile

1. Go to [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click **Add Widget**
3. Add your Worker's domain
4. Choose **Managed** challenge mode
5. Copy the keys:

```bash
wrangler secret put TURNSTILE_SITE_KEY
wrangler secret put TURNSTILE_SECRET_KEY
```

### Step 6: Deploy and Verify

```bash
# Deploy
wrangler deploy

# Test JWT verification
curl -H "Authorization: Bearer <clerk-jwt>" \
  https://your-worker.workers.dev/api/version

# Test webhook endpoint
# (Use Clerk Dashboard → Webhooks → Send Test Event)

# Test rate limiting
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://your-worker.workers.dev/api/compile \
    -X POST -d '{}'
done
# Should see 429 after 10 requests (anonymous tier)
```

---

## Troubleshooting

### "JWKS fetch failed" or "Unable to verify JWT"

**Cause:** The Worker cannot reach Clerk's JWKS endpoint.

**Fix:**
- Verify `CLERK_JWKS_URL` is correct: `https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json`
- Test the URL in a browser — it should return a JSON object with `keys` array
- Check for typos in the instance name

### Rate limiting doesn't match expected tier

**Cause:** The user's tier isn't set in Clerk metadata.

**Fix:**
- In Clerk Dashboard → Users → [user] → Metadata
- Set `public_metadata`: `{ "tier": "pro" }`
- Trigger a `user.updated` webhook (or wait for the next sign-in)
- Verify the `users` table has the correct tier: `SELECT tier FROM users WHERE clerk_user_id = '...'`

### Webhook events not reaching the Worker

**Cause:** Webhook URL misconfigured in Clerk.

**Fix:**
- In Clerk Dashboard → Webhooks, verify the endpoint URL is exactly: `https://your-worker.workers.dev/api/webhooks/clerk`
- Check that `user.created`, `user.updated`, `user.deleted` events are enabled
- Use **Send Test Event** to verify connectivity
- Check Worker logs: `wrangler tail` for webhook handler errors

### "Invalid webhook signature"

**Cause:** `CLERK_WEBHOOK_SECRET` doesn't match the Clerk webhook endpoint.

**Fix:**
- Each webhook endpoint in Clerk has its own signing secret
- Go to Clerk Dashboard → Webhooks → [your endpoint] → Signing Secret
- Re-set the secret: `wrangler secret put CLERK_WEBHOOK_SECRET`
- The secret starts with `whsec_`

### API keys not working after user deletion

**Cause:** Expected behavior — API keys are cascade-deleted when a user is removed.

**Note:** When Clerk sends a `user.deleted` event, the webhook handler hard-deletes the user record. The `ON DELETE CASCADE` constraint on `api_keys.user_id` automatically removes all associated API keys.

### Frontend shows "Clerk not loaded"

**Cause:** Publishable key not available.

**Fix:**
- Verify `/api/clerk-config` returns `{ publishableKey: "pk_..." }`
- Check `CLERK_PUBLISHABLE_KEY` is set in `wrangler.toml` `[vars]` section (not as a secret)
- In local dev, check `.dev.vars` has the key

---

## Further Reading

- [Clerk Documentation](https://clerk.com/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how)
- [Configuration Guide](configuration.md) — Complete environment variable reference
- [Clerk Dashboard Setup](clerk-setup.md) — Step-by-step Clerk configuration
- [Cloudflare Access](cloudflare-access.md) — Defense-in-depth for admin routes
