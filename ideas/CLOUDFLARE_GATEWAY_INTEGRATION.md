# Cloudflare Gateway Integration

> Date: 2026-03-10

Integration with [Cloudflare Gateway](https://developers.cloudflare.com/cloudflare-one/policies/gateway/) to push compiled blocklists directly to Cloudflare's DNS filtering service, and to translate to/from Cloudflare Gateway's list format.

---

## Why This Is Significant

Cloudflare Gateway is a enterprise-grade DNS filtering service used by teams and individuals via Cloudflare Zero Trust. It supports custom blocklists but uses its own list/policy format — distinct from AdGuard, uBlock Origin, and ABP syntaxes. Bridging this gap would make adblock-compiler a first-class citizen in the Cloudflare ecosystem.

---

## Syntax Translation

### Adblock → Cloudflare Gateway
Cloudflare Gateway DNS policies use plain hostname lists or NDJSON-formatted lists (via API). Key translation challenges:

- **Strip cosmetic rules** — Cloudflare Gateway only supports DNS-level blocking; cosmetic/CSS rules are irrelevant
- **Flatten `||domain^` → bare hostname** — e.g., `||example.com^` → `example.com`
- **Resolve exceptions** (`@@`) — whitelist entries must be pushed as separate "allow" policies
- **Drop unsupported modifiers** — e.g., `$script`, `$image` have no DNS-level equivalent
- **Expand wildcard subdomains** — e.g., `||*.example.com^` needs special handling

### Cloudflare Gateway → Adblock
- **Hostname list → `||domain^`** — wrap each entry in standard adblock syntax
- **Allow list → `@@||domain^`** — convert to adblock exceptions
- **NDJSON list format → plaintext rules** — parse Cloudflare's API response format

---

## Integration Ideas

### 1. `CloudflareGatewayFormatter`
Add a new formatter in `src/formatters/` that outputs compiled rules in Cloudflare Gateway-compatible format (plain hostname list or NDJSON).

```typescript
// src/formatters/cloudflare-gateway.formatter.ts
export class CloudflareGatewayFormatter implements IFormatter {
  format(rules: FilterRule[]): string {
    // Strip cosmetics, flatten ||domain^ to hostname, handle exceptions
  }
}
```

---

### 2. `CloudflareGatewayParser` (Import/Translate FROM Gateway)
Add a parser in `src/filters/` or `src/downloader/` that fetches and translates an existing Cloudflare Gateway list back into standard adblock syntax.

```typescript
// Fetch existing list from Gateway API and convert to adblock rules
const rules = await cloudflareGatewayParser.fetch(listId);
// Returns: ['||example.com^', '||tracker.net^', ...]
```

---

### 3. `CloudflareGatewayDeploymentTarget`
Add a deployment target in `src/deployment/` that pushes a compiled list directly to a Cloudflare Zero Trust account via the Cloudflare API.

```typescript
// src/deployment/cloudflare-gateway.deployment.ts
export class CloudflareGatewayDeploymentTarget implements IDeploymentTarget {
  async deploy(rules: string[], config: CloudflareGatewayConfig): Promise<void> {
    // PATCH /accounts/{account_id}/gateway/lists/{list_id}
  }
}
```

**Required config:**
```json
{
  "accountId": "your-cf-account-id",
  "apiToken": "your-cf-api-token",
  "listId": "your-gateway-list-id"
}
```

---

### 4. API Endpoint: `/api/deploy/cloudflare-gateway`
Expose deployment as a REST endpoint in `worker/worker.ts`, accepting compiled rules and Cloudflare credentials, and pushing the list to Gateway.

---

### 5. API Endpoint: `/api/translate/cloudflare-gateway`
Bidirectional translation endpoint:
- `POST /api/translate/cloudflare-gateway/from` — accepts adblock rules, returns Gateway-formatted list
- `POST /api/translate/cloudflare-gateway/to` — accepts Gateway list, returns adblock rules

---

### 6. Cloudflare Gateway as a Filter Source
Allow specifying a Cloudflare Gateway list as a *source* in the compiler config, downloaded and translated automatically before compilation.

```yaml
sources:
  - type: cloudflare-gateway
    accountId: "abc123"
    listId: "xyz789"
    apiToken: "${CF_API_TOKEN}"
```

---

## Cloudflare API Reference

- **List all Gateway lists:** `GET /accounts/{account_id}/gateway/lists`
- **Get list items:** `GET /accounts/{account_id}/gateway/lists/{list_id}/items`
- **Create list:** `POST /accounts/{account_id}/gateway/lists`
- **Patch list items:** `PATCH /accounts/{account_id}/gateway/lists/{list_id}/items`
- **Docs:** https://developers.cloudflare.com/api/resources/zero_trust/subresources/gateway/subresources/lists/

---

## Key Considerations

- Cloudflare Gateway lists have a **maximum of 1,000 entries per list** for DNS blocklists — large filter lists will need to be split across multiple lists.
- Cloudflare API tokens need `Zero Trust: Edit` permissions.
- Deno-compatible fetch can be used natively for Cloudflare API calls.
- The existing `src/deployment/` structure is a natural home for a `CloudflareGatewayDeploymentTarget`.