# VSCode Adblock Syntax Integration Ideas

Integration ideas for [`AdguardTeam/VscodeAdblockSyntax`](https://github.com/AdguardTeam/VscodeAdblockSyntax) and `adblock-compiler`.

> **Note:** This is primarily a developer experience (DX) integration — the VSCode extension and its underlying
> [AGLint](https://github.com/AdguardTeam/AGLint) engine improve the development workflow for contributors
> working on `adblock-compiler` filter files rather than being a runtime dependency.

---

## 1. 🎨 Add `.aglintrc.yaml` to the Repository

Ship an `.aglintrc.yaml` in the repo root so contributors editing filter rule files get **real-time syntax highlighting and linting** in VSCode automatically:

```yaml
# .aglintrc.yaml
root: true
extends:
  - aglint:recommended
```

This gives immediate feedback on any `.txt` filter files used in tests, fixtures, or examples — catching invalid rules before they reach your compilation pipeline.

---

## 2. 🔍 AGLint as a Pre-Compilation Lint Gate in CI

Integrate AGLint directly into your CI pipeline as a **pre-compilation validation step**:

```yaml
# .github/workflows/lint.yml
- name: Lint filter rules
  run: npx aglint 'src/filters/**/*.txt' 'test/fixtures/**/*.txt'
```

This creates a clean separation of concerns:
- **AGLint** — "Is this valid adblock syntax?"
- **AGTree + Zod** — "Does this compile correctly for your target platform?"
- **adblock-compiler** — "Is the output optimized and deduplicated?"

---

## 3. 🧪 Use Grammar Coverage to Improve Test Fixtures

The extension's grammar file covers all major rule types across AdGuard, uBlock Origin, and Adblock Plus. Use it as a reference to audit your test fixture coverage:

| Rule Type | Example |
|---|---|
| Element hiding | `example.com##.ad-banner` |
| Extended CSS | `example.com#?#.ad:has(> .text)` |
| CSS injection | `example.com#$#.ad { display: none }` |
| Scriptlet injection | `example.com#%#//scriptlet('abort-on-property-read', 'ads')` |
| Preprocessor | `!#if (adguard && !adguard_ext_safari)` |
| Hint comments | `!+ NOT_OPTIMIZED PLATFORM(windows)` |
| uBO scriptlet | `example.com##+js(aopr, ads)` |
| ABP snippet | `example.com#$#log hello` |

---

## 4. 🌐 Recommend the Extension in Developer Documentation

Add a **recommended tooling section** to `docs/api/README.md`:

```markdown
## Recommended Developer Tools

- **[Adblock Syntax for VSCode](https://marketplace.visualstudio.com/items?itemName=adguard.adblock)**
  Install for syntax highlighting, real-time AGLint linting, and auto-fix support.
  Quick install: `ext install adguard.adblock`
```

---

## 5. 🐙 Agent Comment Headers for GitHub Syntax Highlighting

Add agent comment headers to `.txt` filter files in your repo for highlighted diffs on GitHub:

```adblock
[AdGuard]
! Title: My Test Filter
! Description: Example filter for adblock-compiler tests
! Version: 1.0.0
! Expires: 1 day
```

---

## 6. ⚙️ Expose AGLint-Compatible Error Positions from Your API

Adopt AGLint's diagnostic error format in your compiler's validation error responses:

```typescript
interface RuleValidationError {
    rule: string;
    line: number;
    column: number;
    severity: 'error' | 'warn';
    message: string;
    ruleId?: string; // e.g. 'no-invalid-modifiers'
}
```

---

## 7. 🔗 AGLint + adblock-compiler Two-Stage Validation Pipeline

```
Developer edits filter file in VSCode
    └─ VscodeAdblockSyntax: real-time AGLint linting + syntax highlighting
        ↓
CI: npx aglint
    └─ Validates syntax across all supported platforms
        ↓
adblock-compiler POST /compile
    └─ AGTree parse → Zod validate → Transform → Emit
```

---

## AdGuard DNS Private API — Key Reference

Since `adblock-compiler` will integrate heavily with the **AdGuard DNS Private API** (`https://api.adguard-dns.io`):

### Authentication

```http
# API Key (recommended, v2.17+)
Authorization: ApiKey {api_key}

# Bearer token (legacy)
Authorization: Bearer {access_token}
```

Generate a token:
```http
POST /oapi/v1/oauth_token
{ "username": "...", "password": "...", "totp_token": "..." }
```

### Key Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/oapi/v1/account/limits` | `GET` | Account limits (devices, rules per plan) |
| `/oapi/v1/devices` | `GET` | List all devices |
| `/oapi/v1/devices` | `POST` | Add a device |
| `/oapi/v1/devices/{device_id}` | `DELETE` | Remove a device |
| `/oapi/v1/oauth_token` | `POST` | Generate access token |
| `/oapi/v1/oauth_token` | `DELETE` | Revoke access token |

### Filtering Rules & Blocklists

- Supports Adblock-style, `/etc/hosts`-style, and domains-only rule syntax
- Plan limits: Personal (1K rules), Team (5K rules), Enterprise (100K rules)

### DNS Filtering Rule Syntax

```adblock
||example.org^          # Block all subdomains
@@||example.org^        # Allowlist
0.0.0.0 example.org    # Hosts-style block
```

### Access Controls

- **Allowed clients** — permitted IPs/subnets (takes precedence)
- **Disallowed clients** — explicitly blocked IPs/subnets
- **Disallowed domains** — domain/wildcard blocklist

### OpenAPI Spec

```
https://api.adguard-dns.io/swagger/openapi.json
```

---

## References

- [`AdguardTeam/VscodeAdblockSyntax`](https://github.com/AdguardTeam/VscodeAdblockSyntax)
- [VSCode Marketplace: Adblock Syntax](https://marketplace.visualstudio.com/items?itemName=adguard.adblock)
- [AGLint](https://github.com/AdguardTeam/AGLint)
- [AdGuard DNS Private API Overview](https://adguard-dns.io/kb/private-dns/api/overview/)
- [AdGuard DNS Private API Changelog](https://adguard-dns.io/kb/private-dns/api/changelog/)
- [AdGuard DNS API Swagger](https://api.adguard-dns.io/swagger/openapi.json)
- [DNS Filtering Rule Syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/)
- [adblock-compiler AGTree Integration](../docs/api/AGTREE_INTEGRATION.md)
- [adblock-compiler Zod Validation](../docs/api/ZOD_VALIDATION.md)
- [adblock-compiler API README](../docs/api/README.md)
- [adblock-compiler OpenAPI Support](../docs/api/OPENAPI_SUPPORT.md)