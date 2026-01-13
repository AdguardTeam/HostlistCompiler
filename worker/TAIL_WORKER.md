# Cloudflare Tail Worker for Adblock Compiler

This directory contains a Cloudflare Tail Worker implementation for the adblock-compiler project. The tail worker provides real-time observability by consuming logs, exceptions, and events from the main worker.

## What is a Tail Worker?

A Cloudflare Tail Worker is a special type of Worker that automatically receives logs and events from other Workers (producer Workers). Unlike regular Workers that respond to HTTP requests, Tail Workers process observability data including:

- Console logs (`console.log`, `console.error`, etc.)
- Unhandled exceptions
- Request/response metadata
- Worker execution outcome (success, exception, CPU exceeded, etc.)

## Features

The adblock-compiler tail worker provides:

- **Log Persistence**: Store logs in Cloudflare KV for later analysis
- **Error Forwarding**: Send critical errors to external webhooks (Slack, Discord, PagerDuty, etc.)
- **Structured Logging**: Format and structure events for easy parsing
- **Automatic Cleanup**: Configurable TTL for log retention
- **Real-time Monitoring**: Console output for immediate visibility

## Setup

### 1. Deploy the Tail Worker

First, deploy the tail worker to Cloudflare:

```bash
npm run tail:deploy
```

This deploys the tail worker as a separate worker named `adblock-compiler-tail`.

### 2. (Optional) Create KV Namespace for Log Storage

If you want to persist logs in KV:

```bash
# Create the KV namespace
wrangler kv:namespace create TAIL_LOGS

# Copy the returned namespace ID and update wrangler.tail.toml
# Uncomment the [[kv_namespaces]] section and add your ID
```

### 3. Enable Tail Consumer

After the tail worker is deployed, enable it as a consumer of the main worker by uncommenting the `tail_consumers` section in `wrangler.toml`:

```toml
# Uncomment these lines:
tail_consumers = [
    { service = "adblock-compiler-tail" }
]
```

Then redeploy the main worker:

```bash
npm run deploy
```

### 4. (Optional) Configure Error Webhook

To forward critical errors to an external endpoint, set the `ERROR_WEBHOOK_URL` environment variable in `wrangler.tail.toml`:

```toml
[vars]
ERROR_WEBHOOK_URL = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

## Usage

### View Tail Worker Logs

To view logs from the tail worker in real-time:

```bash
npm run tail:logs
```

### View Main Worker Logs

To view logs from the main worker (which are also sent to the tail worker):

```bash
npm run tail
```

### Development

Run the tail worker locally:

```bash
npm run tail:dev
```

Note: Local tail workers don't receive events from other local workers. This is primarily for testing the tail worker's code itself.

## Configuration

### Environment Variables

Configure the tail worker behavior in `wrangler.tail.toml`:

- **LOG_RETENTION_TTL**: How long to keep logs in KV (in seconds, default: 86400 = 24 hours)
- **ERROR_WEBHOOK_URL**: Optional webhook URL for forwarding critical errors

### Log Filtering

The tail worker forwards events to webhooks when:

- Worker execution outcome is `exception`
- Any unhandled exceptions occur
- Any error-level logs are present

You can customize this logic in `worker/tail.ts` by modifying the `shouldForwardEvent()` function.

## Webhook Integration Examples

### Slack

```toml
ERROR_WEBHOOK_URL = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
```

The tail worker sends JSON payloads that Slack can format automatically.

### Discord

```toml
ERROR_WEBHOOK_URL = "https://discord.com/api/webhooks/000000000000000000/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Custom HTTP Endpoint

The webhook receives POST requests with this JSON structure:

```json
{
    "timestamp": "2024-01-11T00:00:00.000Z",
    "scriptName": "adblock-compiler",
    "outcome": "exception",
    "url": "https://example.com/compile",
    "method": "POST",
    "logs": [
        {
            "timestamp": "2024-01-11T00:00:00.000Z",
            "level": "error",
            "message": ["Error message here"]
        }
    ],
    "exceptions": [
        {
            "timestamp": "2024-01-11T00:00:00.000Z",
            "name": "Error",
            "message": "Something went wrong"
        }
    ]
}
```

## Querying Stored Logs

If you enabled KV storage, you can query logs using the Cloudflare API or dashboard:

```bash
# List recent log keys
wrangler kv:key list --binding TAIL_LOGS

# Get a specific log
wrangler kv:key get "log:1704931200000" --binding TAIL_LOGS
```

Log keys are in the format `log:{timestamp}` where timestamp is the event's Unix timestamp in milliseconds.

## Architecture

```
┌─────────────────────┐
│  Main Worker        │
│  (worker.ts)        │
│                     │
│  - Handles requests │
│  - Emits logs       │
│  - May throw errors │
└──────────┬──────────┘
           │
           │ Events, Logs, Exceptions
           │
           ▼
┌─────────────────────┐
│  Tail Worker        │
│  (tail.ts)          │
│                     │
│  - Receives events  │
│  - Stores logs      │────► KV Storage (optional)
│  - Forwards errors  │────► Webhook (optional)
└─────────────────────┘
```

## Best Practices

1. **Don't Store Everything**: Use TTL and filtering to avoid storing excessive logs
2. **Rate Limit Webhooks**: The tail worker doesn't implement rate limiting for webhooks - ensure your endpoint can handle the volume
3. **Monitor Costs**: KV storage and webhook requests incur costs
4. **Use for Critical Issues**: Focus on exceptions and errors rather than all logs
5. **Test Locally First**: Deploy to a test worker before enabling in production

## Troubleshooting

### Tail worker not receiving events

1. Ensure the tail worker is deployed: `wrangler deployments list --name adblock-compiler-tail`
2. Check that `tail_consumers` is configured in the main worker's `wrangler.toml`
3. Redeploy the main worker after adding tail consumers
4. Check both workers are in the same Cloudflare account

### Webhook not receiving events

1. Verify the `ERROR_WEBHOOK_URL` is set correctly
2. Check the webhook endpoint is accessible
3. Review tail worker logs for error messages: `npm run tail:logs`
4. Ensure events match the filtering criteria in `shouldForwardEvent()`

### KV storage not working

1. Verify the KV namespace is created and the ID is correct in `wrangler.tail.toml`
2. Uncomment the `[[kv_namespaces]]` section
3. Redeploy the tail worker after configuration changes
4. Check KV usage in the Cloudflare dashboard

## Performance Considerations

- Tail workers have execution limits (CPU time, memory)
- Large volumes of logs may require batching or sampling
- KV writes are asynchronous but count toward your KV usage limits
- Webhook calls are network operations that add latency

## Learn More

- [Cloudflare Tail Workers Documentation](https://developers.cloudflare.com/workers/observability/logs/tail-workers/)
- [Tail Handler API Reference](https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/)
- [Workers Observability](https://developers.cloudflare.com/workers/observability/)

## Contributing

Contributions to improve the tail worker are welcome! Please submit a pull request or open an issue.
