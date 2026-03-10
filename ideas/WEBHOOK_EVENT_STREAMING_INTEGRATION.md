# Webhook / Event Streaming Integration

> Date: 2026-03-10

This document captures ideas for emitting compilation events to external consumers via webhooks, building on the existing `CompilerEventEmitter`.

---

## 🪝 Why Webhooks?

The compiler already has a `CompilerEventEmitter` for internal event propagation. Exposing these events externally via webhooks enables powerful automation — triggering downstream deploys, notifications, audit trails, and integrations with tools like Slack, GitHub Actions, or custom dashboards.

---

## 💡 Integration Ideas

### 1. `WebhookEventSink` in `src/services/`
Add a `WebhookEventSink` that subscribes to `CompilerEventEmitter` events and POSTs them as JSON payloads to a configured URL:

```typescript
interface CompilerWebhookPayload {
  event: 'compile.start' | 'compile.complete' | 'compile.error' | 'transform.complete';
  timestamp: string;
  jobId: string;
  metadata: Record<string, unknown>;
}
```

---

### 2. Configurable Webhook Endpoints
Support multiple webhook endpoints per event type, configured via `.env` or a config file:

```env
WEBHOOK_URL_COMPILE_COMPLETE=https://example.com/hooks/compile
WEBHOOK_URL_COMPILE_ERROR=https://hooks.slack.com/services/...
```

---

### 3. HMAC Signature Verification
Sign outgoing webhook payloads with an HMAC-SHA256 signature header (`X-Compiler-Signature`) so consumers can verify authenticity — consistent with GitHub, Stripe, and other webhook conventions.

---

### 4. Retry Logic with Exponential Backoff
Add a retry queue (plugging into `src/queue/`) for failed webhook deliveries, with exponential backoff and a configurable max retry count.

---

### 5. Event Types

| Event | Payload |
|---|---|
| `compile.start` | Job ID, source list URLs |
| `compile.complete` | Job ID, rule count, duration, output URL |
| `compile.error` | Job ID, error message, stack |
| `transform.complete` | Transformation name, rules in/out, duration |
| `download.complete` | Source URL, rules fetched, duration |
| `diff.generated` | Added/removed rule counts, diff URL |

---

### 6. GitHub Actions Trigger
Emit a `repository_dispatch` event to a GitHub repo on compile completion, enabling downstream CI workflows to automatically publish updated filter lists.

---

## Key Consideration

The existing `CompilerEventEmitter` and `src/queue/` modules provide a strong foundation. The main addition is an outbound HTTP sink with signing and retry logic — all feasible within Cloudflare Workers using `fetch` and Durable Objects or Queue consumers.