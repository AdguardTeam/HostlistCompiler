# Rule Sets API

Rule sets are named, KV-persisted collections of adblock filter rules. They provide a
lightweight way to store, retrieve, and manage reusable rule collections without a
full compilation run.

Rule sets are stored in the `RULES_KV` namespace (falls back to `COMPILATION_CACHE`
when `RULES_KV` is not bound). Each rule set is identified by a UUID generated at
creation time.

All endpoints require a Bearer token in the `Authorization` header.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rules` | Create a new rule set |
| `GET` | `/api/rules` | List all rule sets (metadata only) |
| `GET` | `/api/rules/{id}` | Retrieve a specific rule set |
| `PUT` | `/api/rules/{id}` | Update a rule set |
| `DELETE` | `/api/rules/{id}` | Delete a rule set |

---

## Create — `POST /api/rules`

### Request body

```jsonc
{
    "name": "My Block List",          // required
    "rules": [                         // required
        "||ads.example.com^",
        "||tracking.example.com^"
    ],
    "description": "Custom blocks",   // optional
    "tags": ["custom", "blocking"]    // optional
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | Human-readable name (1–100 characters) |
| `rules` | `string[]` | ✅ | Array of adblock filter rule strings |
| `description` | `string` | ❌ | Optional description |
| `tags` | `string[]` | ❌ | Arbitrary string tags for organisation |

### Response — `201`

```jsonc
{
    "success": true,
    "data": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "My Block List",
        "description": "Custom blocks",
        "rules": ["||ads.example.com^", "||tracking.example.com^"],
        "ruleCount": 2,
        "tags": ["custom", "blocking"],
        "createdAt": "2026-03-10T12:00:00.000Z",
        "updatedAt": "2026-03-10T12:00:00.000Z"
    }
}
```

---

## List — `GET /api/rules`

Returns metadata for all stored rule sets (first 100), sorted by creation date (newest
first). The `rules` array is omitted from list responses to keep payloads small.

### Response — `200`

```jsonc
{
    "success": true,
    "items": [
        {
            "id": "a1b2c3d4-...",
            "name": "My Block List",
            "description": "Custom blocks",
            "ruleCount": 2,
            "tags": ["custom", "blocking"],
            "createdAt": "2026-03-10T12:00:00.000Z",
            "updatedAt": "2026-03-10T12:00:00.000Z"
        }
    ],
    "total": 1
}
```

---

## Retrieve — `GET /api/rules/{id}`

Returns the full rule set including the `rules` array.

### Response — `200`

```jsonc
{
    "success": true,
    "data": {
        "id": "a1b2c3d4-...",
        "name": "My Block List",
        "rules": ["||ads.example.com^"],
        "ruleCount": 1,
        "tags": [],
        "createdAt": "2026-03-10T12:00:00.000Z",
        "updatedAt": "2026-03-10T12:00:00.000Z"
    }
}
```

### Response — `404`

```jsonc
{ "success": false, "error": "Rule set not found" }
```

---

## Update — `PUT /api/rules/{id}`

Replaces fields provided in the request body. Omitted fields are preserved.
`ruleCount` is automatically recalculated from the updated `rules` array.

### Request body

```jsonc
{
    "name": "Updated Name",           // optional
    "rules": ["||new.example.com^"],  // optional
    "description": "New description", // optional
    "tags": ["updated"]               // optional
}
```

### Response — `200`

Same shape as `POST /api/rules` response `data` field, with `updatedAt` reflecting the
update time.

---

## Delete — `DELETE /api/rules/{id}`

### Response — `200`

```jsonc
{ "success": true, "message": "Rule set 'a1b2c3d4-...' deleted" }
```

---

## Configuration

### `wrangler.toml` binding

```toml
[[kv_namespaces]]
binding = "RULES_KV"
id = "<your-kv-namespace-id>"
preview_id = "<your-preview-kv-namespace-id>"
```

When `RULES_KV` is not bound, the worker falls back to `COMPILATION_CACHE`. This means
rule sets work out-of-the-box in environments where `COMPILATION_CACHE` is already
configured.

### Creating the KV namespace

```bash
# Production
wrangler kv namespace create "RULES_KV"

# Preview
wrangler kv namespace create "RULES_KV" --preview
```

---

## Examples

### cURL

```bash
# Create
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/api/rules \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Rules","rules":["||ads.example.com^"]}'

# List
curl https://adblock-compiler.jayson-knight.workers.dev/api/rules \
  -H "Authorization: Bearer $API_KEY"

# Retrieve
curl https://adblock-compiler.jayson-knight.workers.dev/api/rules/$RULE_SET_ID \
  -H "Authorization: Bearer $API_KEY"

# Update
curl -X PUT https://adblock-compiler.jayson-knight.workers.dev/api/rules/$RULE_SET_ID \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'

# Delete
curl -X DELETE https://adblock-compiler.jayson-knight.workers.dev/api/rules/$RULE_SET_ID \
  -H "Authorization: Bearer $API_KEY"
```
