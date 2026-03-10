# Validate Rule Endpoint

The `POST /api/validate-rule` endpoint parses a single adblock filter rule and reports
whether it is structurally valid. An optional URL match test lets you quickly verify
whether a rule would block a specific hostname.

---

## Request

**`POST /api/validate-rule`**

All requests require a Bearer token in the `Authorization` header.

### Body

```jsonc
{
    "rule": "||example.com^",       // required — the rule string to validate
    "testUrl": "https://example.com/page",  // optional — check if the rule matches this URL
    "strict": false                 // optional — use the strict (non-tolerant) parser
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `rule` | `string` | ✅ | The adblock filter rule to validate |
| `testUrl` | `string` | ❌ | A URL to test the rule against (hostname matching only) |
| `strict` | `boolean` | ❌ | When `true`, uses the strict AGTree parser that rejects rules with unrecognised modifiers or malformed patterns. Default: `false` |

---

## Responses

### Valid rule — `200`

```jsonc
{
    "success": true,
    "valid": true,
    "rule": "||example.com^",
    "ruleType": "NetworkRule",
    "category": "blocking",
    "syntax": "AdGuard",
    "ast": { /* parsed AGTree node */ },
    "duration": "2ms"
}
```

### Valid rule with URL match test — `200`

```jsonc
{
    "success": true,
    "valid": true,
    "rule": "||example.com^",
    "ruleType": "NetworkRule",
    "category": "blocking",
    "syntax": "AdGuard",
    "ast": { /* ... */ },
    "testUrl": "https://example.com/page",
    "matchResult": true,
    "duration": "3ms"
}
```

`matchResult` is `undefined` (omitted) when the rule type does not carry enough
structural information for a reliable hostname match (e.g., cosmetic or script rules).

### Invalid rule — `200`

The HTTP status is still `200`; the `valid` field indicates the outcome.

```jsonc
{
    "success": true,
    "valid": false,
    "rule": "##bad selector{",
    "ruleType": "CosmeticRule",
    "error": "Unexpected end of selector",
    "duration": "1ms"
}
```

### Schema validation error — `422`

```jsonc
{
    "success": false,
    "error": "String must contain at least 1 character(s)"
}
```

---

## Examples

### cURL

```bash
# Basic validation
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/api/validate-rule \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rule":"||ads.example.com^"}'

# With URL match test
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/api/validate-rule \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rule":"||ads.example.com^","testUrl":"https://ads.example.com/banner.png"}'

# Strict mode
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/api/validate-rule \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rule":"||ads.example.com^$important","strict":true}'
```

### TypeScript

```typescript
const res = await fetch('/api/validate-rule', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rule: '||ads.example.com^', testUrl: 'https://ads.example.com/' }),
});

const { valid, ruleType, matchResult } = await res.json();
```

---

## Strict Mode

When `strict: true`, the endpoint runs the rule through the non-tolerant AGTree parser
before the standard parse. The strict parser rejects:

- Rules with unrecognised modifiers (e.g., `$unknownModifier`)
- Malformed patterns that the tolerant parser silently accepts

Use strict mode when building validation tooling or CI pipelines that enforce a curated
modifier allowlist.

---

## Notes

- URL matching uses hostname-only comparison (no path, query, or protocol checks). For
  production-grade matching, use a full DNS/network filtering engine.
- The `ast` field contains the raw AGTree parse tree and is useful for debugging or
  building editor tooling.
- Both `ruleType` and `category` use AGTree's terminology. See the
  [AGTree Integration guide](AGTREE_INTEGRATION.md) for a full taxonomy.
