# Security Policy

## Supported Versions

| Version          | Supported              |
| ---------------- | ---------------------- |
| Latest `main`    | :white_check_mark:     |
| Feature branches | :x: (development only) |

## Zero Trust Architecture

This project implements Zero Trust Architecture (ZTA) at every layer:

- **Cloudflare Edge**: Turnstile human verification, Clerk JWT auth, CF Access admin protection
- **Worker API**: Auth verification on every handler, tiered rate limiting, CORS origin allowlist
- **Data Layer**: 100% parameterized D1 queries, scoped KV/R2 bindings
- **Frontend**: Clerk SDK auth management, functional route guards, Zod response validation

See [`docs/security/ZERO_TRUST_ARCHITECTURE.md`](docs/security/ZERO_TRUST_ARCHITECTURE.md) for the full architecture.

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Please report security vulnerabilities via [GitHub Security Advisories](https://github.com/jaypatrick/adblock-compiler/security/advisories/new).

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You can expect:

- **Acknowledgement** within 48 hours
- **Assessment** within 1 week
- **Fix timeline** communicated after assessment

## Security Controls

| Control            | Implementation                                                    |
| ------------------ | ----------------------------------------------------------------- |
| Authentication     | Clerk JWT + API keys                                              |
| Authorization      | 4-tier system (Anonymous → Free → Pro → Admin)                    |
| Rate Limiting      | Per-tier limits, keyed by user ID or IP                           |
| CORS               | Origin allowlist on write/auth endpoints; `*` on public read-only |
| Input Validation   | Zod schemas at all trust boundaries                               |
| SQL Injection      | 100% parameterized `.prepare().bind()`                            |
| Secrets Management | Worker Secrets only (never in `[vars]` or source)                 |
| Admin Access       | Dual-layer: X-Admin-Key + Cloudflare Access JWT                   |
| Security Telemetry | Analytics Engine events on auth failures                          |
| CI Enforcement     | ZTA lint workflow checks for regressions                          |
