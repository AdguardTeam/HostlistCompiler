# Quick Start: Deploying the Tail Worker

This guide will help you get the Cloudflare Tail Worker up and running in 5 minutes.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install`)
- Main adblock-compiler worker already deployed

## Step 1: Deploy the Tail Worker

```bash
npm run tail:deploy
```

This deploys the tail worker to Cloudflare as `adblock-compiler-tail`.

## Step 2: Enable Tail Consumer (Optional)

If you want the main worker to automatically send logs to the tail worker, edit `wrangler.toml` and uncomment:

```toml
tail_consumers = [
    { service = "adblock-compiler-tail" }
]
```

Then redeploy the main worker:

```bash
npm run deploy
```

## Step 3: View Logs

```bash
# View logs from the tail worker itself
npm run tail:logs

# Or view logs from the main worker (which also shows what's sent to tail)
npm run tail
```

## That's it!

The tail worker is now capturing logs and events from your main worker.

## Next Steps (Optional)

### Store Logs in KV

1. Create a KV namespace:
   ```bash
   wrangler kv:namespace create TAIL_LOGS
   ```

2. Copy the namespace ID from the output

3. Edit `wrangler.tail.toml` and uncomment the `[[kv_namespaces]]` section:
   ```toml
   [[kv_namespaces]]
   binding = "TAIL_LOGS"
   id = "YOUR_NAMESPACE_ID_HERE"
   ```

4. Redeploy:
   ```bash
   npm run tail:deploy
   ```

### Forward Errors to Slack

1. Create a Slack webhook URL: https://api.slack.com/messaging/webhooks

2. Edit `wrangler.tail.toml` and add:
   ```toml
   [vars]
   ERROR_WEBHOOK_URL = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
   ```

3. Redeploy:
   ```bash
   npm run tail:deploy
   ```

Now you'll get Slack notifications when errors occur!

### Forward Errors to Discord

1. Create a Discord webhook in your server settings

2. Edit `wrangler.tail.toml` and add:
   ```toml
   [vars]
   ERROR_WEBHOOK_URL = "https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
   ```

3. Redeploy:
   ```bash
   npm run tail:deploy
   ```

## Troubleshooting

**Tail worker not receiving events?**

- Make sure it's deployed: `wrangler deployments list --name adblock-compiler-tail`
- Check `tail_consumers` is uncommented in `wrangler.toml`
- Redeploy the main worker after adding tail consumers

**Webhook not working?**

- Verify the URL is correct in `wrangler.tail.toml`
- Check tail worker logs: `npm run tail:logs`
- Ensure only errors are being sent (webhook only triggers on exceptions/errors)

## Learn More

- [Full Documentation](TAIL_WORKER.md)
- [Integration Examples](tail-examples.ts)
- [Cloudflare Docs](https://developers.cloudflare.com/workers/observability/logs/tail-workers/)
