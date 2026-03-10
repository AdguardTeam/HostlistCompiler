# Notifications Endpoint

The `POST /api/notify` endpoint accepts a structured notification event and fans it out
to one or more configured external targets: a generic HTTP webhook, Sentry, and/or
Datadog. The response reports delivery success for each target independently so
callers can handle partial failures.

All requests require a Bearer token in the `Authorization` header.

---

## Request

**`POST /api/notify`**

### Body

```jsonc
{
    "event": "compilation.failed",       // required — machine-readable event name
    "message": "Worker timed out",       // required — human-readable description
    "level": "error",                    // optional — info | warn | error  (default: "info")
    "source": "adblock-compiler",        // optional — originating service/component
    "timestamp": "2026-03-10T12:00:00Z", // optional — ISO 8601 (defaults to now)
    "metadata": {                        // optional — arbitrary key/value pairs
        "requestId": "req-abc123",
        "sourceCount": 5
    }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `event` | `string` | ✅ | Machine-readable event identifier (e.g., `compilation.failed`) |
| `message` | `string` | ✅ | Human-readable description of the event |
| `level` | `string` | ❌ | Severity level: `"info"`, `"warn"`, or `"error"`. Default: `"info"` |
| `source` | `string` | ❌ | Originating service or component name |
| `timestamp` | `string` | ❌ | ISO 8601 timestamp. Defaults to the time of the request |
| `metadata` | `object` | ❌ | Arbitrary key/value pairs forwarded to all targets |

---

## Responses

### All targets delivered — `200`

```jsonc
{
    "success": true,
    "results": [
        { "target": "generic", "success": true, "statusCode": 200 },
        { "target": "sentry",  "success": true, "statusCode": 200 }
    ]
}
```

### Partial failure — `200`

The HTTP response is `200` even when some targets fail. Inspect `results` to determine
which targets succeeded.

```jsonc
{
    "success": true,
    "results": [
        { "target": "generic", "success": false, "error": "Connection refused" },
        { "target": "datadog", "success": true,  "statusCode": 202 }
    ]
}
```

### All targets failed — `502`

```jsonc
{
    "success": false,
    "error": "All notification targets failed",
    "results": [
        { "target": "generic", "success": false, "error": "Connection refused" }
    ]
}
```

### No targets configured — `503`

```jsonc
{
    "success": false,
    "error": "No notification targets are configured. Set WEBHOOK_URL, SENTRY_DSN, or DATADOG_API_KEY."
}
```

---

## Target Configuration

Configure one or more of the following environment variables / Worker secrets.
The endpoint is a no-op (returns `503`) when none are set.

| Variable | Type | Description |
|---|---|---|
| `WEBHOOK_URL` | `string` | Generic HTTP webhook endpoint. Receives the raw request body as JSON via `POST`. |
| `SENTRY_DSN` | `string` | Sentry DSN (`https://<key>@<host>/<project>`). Events are submitted to the Sentry Store API. |
| `DATADOG_API_KEY` | `string` | Datadog API key. Events are submitted to the Datadog Events v1 API. |

### Setting secrets

```bash
wrangler secret put WEBHOOK_URL
wrangler secret put SENTRY_DSN
wrangler secret put DATADOG_API_KEY
```

---

## Target Behaviour

### Generic webhook (`WEBHOOK_URL`)

The request body is forwarded verbatim as a JSON `POST` to `WEBHOOK_URL`. Use this for
Slack incoming webhooks, PagerDuty, or any custom HTTP endpoint.

### Sentry (`SENTRY_DSN`)

The event is mapped to a Sentry `store` submission:

| Notify field | Sentry field |
|---|---|
| `message` | `message` |
| `level` (`warn` → `warning`) | `level` |
| `source` | `logger` |
| `metadata` | `extra` |
| `event` | `tags.event` |
| `timestamp` | `timestamp` |

### Datadog (`DATADOG_API_KEY`)

The event is submitted to the Datadog Events v1 API (`/api/v1/events`):

| Notify field | Datadog field |
|---|---|
| `event` | `title` |
| `message` | `text` |
| `level` | `alert_type` (`warn` → `warning`) |
| `source` | `source_type_name` |
| `metadata` keys | `tags` (`key:value`) |
| `timestamp` | `date_happened` (Unix epoch) |

---

## Examples

### cURL

```bash
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/api/notify \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "compilation.completed",
    "message": "Compiled 12,500 rules from 5 sources",
    "level": "info",
    "source": "adblock-compiler",
    "metadata": { "ruleCount": 12500, "sourceCount": 5, "durationMs": 1240 }
  }'
```

### TypeScript

```typescript
await fetch('/api/notify', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        event: 'compilation.failed',
        message: 'Source download timed out after 30s',
        level: 'error',
        metadata: { sourceUrl: 'https://example.com/list.txt' },
    }),
});
```

---

## Notes

- Delivery to each target is attempted in parallel.
- Failed deliveries are reported in the response but do not affect other targets.
- The endpoint always returns `200` when at least one target succeeds. Use the `results`
  array to detect partial failures.
