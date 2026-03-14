# CLI Authentication

How to use the `adblock-compiler` CLI with authenticated API endpoints.

## Overview

When the CLI operates in **queue mode** (`--use-queue`), it submits compilation jobs to the remote worker API instead of compiling locally. The worker API enforces authentication and rate limiting, so you must supply credentials via CLI flags.

> **Local-only compilation** (no `--use-queue`) does not require authentication — it reads local files and URLs directly.

## Authentication Flags

| Flag | Type | Description |
|------|------|-------------|
| `--api-key <key>` | string | API key for authenticated worker API requests. Must start with `abc_` followed by key material (e.g., `abc_Xk9mP2nL...`). |
| `--bearer-token <jwt>` | string | Clerk JWT bearer token for authenticated worker API requests. Typically a short-lived `eyJ...` token. |
| `--api-url <url>` | string | Base URL of the worker API. Defaults to `https://adblock-compiler.jayson-knight.workers.dev`. |

### Mutual Exclusion

`--api-key` and `--bearer-token` are **mutually exclusive** — you must choose one authentication method per invocation. If both are provided, the Zod schema validation rejects the input with:

```
Cannot specify both --api-key and --bearer-token; choose one authentication method
```

### Validation Rules

| Rule | Detail |
|------|--------|
| API key format | Must match `/^abc_.+$/` — the `abc_` prefix plus at least one character of key material |
| Bearer token format | Any non-empty string (typically a Clerk JWT starting with `eyJ`) |
| API URL format | Must be a valid URL (`https://...` or `http://localhost:...` for local dev) |
| Queue requirement | Auth flags are only meaningful with `--use-queue`. A warning is emitted if auth flags are used without it. |

---

## Usage Examples

### Compile via Queue with an API Key

```bash
adblock-compiler -c config.json -o output.txt \
  --use-queue \
  --api-key abc_Xk9mP2nLqR5tV8wZ...
```

### Compile via Queue with a Clerk JWT

```bash
# Obtain a JWT from the web UI (DevTools → Network → copy Authorization header)
adblock-compiler -c config.json -o output.txt \
  --use-queue \
  --bearer-token eyJhbGciOiJSUzI1NiIs...
```

### Use a Custom API URL (Local Development)

```bash
adblock-compiler -c config.json -o output.txt \
  --use-queue \
  --api-key abc_Xk9mP2nLqR5tV8wZ... \
  --api-url http://localhost:8787
```

### Combine Auth with Other Flags

```bash
adblock-compiler \
  -i https://example.org/hosts.txt \
  -o output.txt \
  --use-queue \
  --api-key abc_Xk9mP2nLqR5tV8wZ... \
  --priority high \
  --verbose \
  --benchmark
```

---

## Obtaining Credentials

### API Key (Recommended for CLI / CI)

API keys are long-lived and ideal for scripts, CI/CD pipelines, and CLI usage.

1. Sign in to the web UI at `https://adblock-compiler.jayson-knight.workers.dev/`
2. Navigate to **Settings → API Keys**
3. Click **"Create API Key"**
4. Select scopes:
   - **`compile`** — Required for `/compile`, `/compile/stream`, `/compile/batch`
   - **`rules`** — Required for `/rules` CRUD endpoints
   - **`admin`** — Required for `/admin/*` endpoints
5. Copy the key immediately — it is shown only once
6. Store it securely (environment variable, secrets manager, etc.)

> See [API Authentication](api-authentication.md) for full details on API key management.

### Clerk JWT (Browser-Derived)

Clerk JWTs are short-lived (~60 seconds) and best suited for one-off testing:

1. Sign in to the web UI
2. Open browser DevTools → Console
3. Run:
   ```javascript
   window.Clerk?.session?.getToken().then(t => console.log(t));
   ```
4. Copy the printed `eyJ...` token
5. Pass it via `--bearer-token`

> **Tip**: For automated or repeated CLI usage, prefer API keys over Clerk JWTs.

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Compile filter list
  run: |
    adblock-compiler -c config.json -o output.txt \
      --use-queue \
      --api-key ${{ secrets.ADBLOCK_API_KEY }}
```

### Environment Variable Pattern

Store the API key in an environment variable to avoid passing it on the command line:

```bash
export ADBLOCK_API_KEY="abc_Xk9mP2nLqR5tV8wZ..."

adblock-compiler -c config.json -o output.txt \
  --use-queue \
  --api-key "$ADBLOCK_API_KEY"
```

---

## Rate Limiting

When using queue mode, the worker API enforces rate limits based on the authenticated user's tier:

| Tier | Rate Limit | How to Get |
|------|-----------|------------|
| Anonymous | 10 req/min | No auth (being deprecated) |
| Free | 60 req/min | Sign up for free account |
| Pro | 300 req/min | Upgrade to Pro subscription |
| Admin | Unlimited | Admin role in Clerk |

If rate-limited, the CLI receives a `429 Too Many Requests` response. The response includes `Retry-After` and `X-RateLimit-*` headers.

---

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot specify both --api-key and --bearer-token` | Both flags provided | Use only one authentication method |
| `API key must start with "abc_" followed by key material` | Invalid API key format | Check key starts with `abc_` and has content after the prefix |
| `Warning: --api-key/--bearer-token only apply in queue mode` | Auth flags without `--use-queue` | Add `--use-queue` or remove auth flags |
| `401 Unauthorized` from API | Expired or revoked credential | Refresh JWT or create a new API key |
| `403 Forbidden` from API | Insufficient tier or missing scope | Upgrade tier or create key with required scopes |
| `429 Too Many Requests` from API | Rate limit exceeded | Wait for the `Retry-After` period, or upgrade tier |

---

## Security Best Practices

- **Never commit API keys** to source control — use environment variables or a secrets manager
- **Rotate keys regularly** — create keys with expiration dates (1–365 days)
- **Use minimum scopes** — only grant the scopes your workflow needs (e.g., `compile` for CI builds)
- **Prefer API keys over JWTs** for CLI usage — JWTs expire quickly and require browser interaction to obtain
- **Use `--api-url` carefully** — only point to trusted endpoints; the CLI sends your credentials to this URL

---

## Further Reading

- [CLI Reference](../usage/CLI.md) — Full CLI option reference
- [API Authentication Guide](api-authentication.md) — Detailed auth method reference
- [Postman Testing](postman-testing.md) — Testing authenticated APIs with Postman
- [Configuration Guide](configuration.md) — Environment variables and secrets management
- [Removing Anonymous Access](removing-anonymous-access.md) — Migration timeline
