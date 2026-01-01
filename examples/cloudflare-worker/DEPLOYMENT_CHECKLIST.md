# Cloudflare Worker Deployment Checklist

Complete checklist for deploying the AdBlock Compiler to Cloudflare Workers and Pages.

## Pre-Deployment Setup

### 1. Create KV Namespaces

Create three KV namespaces for the worker:

```bash
# Navigate to worker directory
cd examples/cloudflare-worker

# Create KV namespaces
wrangler kv:namespace create COMPILATION_CACHE
wrangler kv:namespace create RATE_LIMIT
wrangler kv:namespace create METRICS
```

Each command will return an ID like:
```
{ id: "abc123...", title: "adblock-compiler-COMPILATION_CACHE" }
```

### 2. Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "COMPILATION_CACHE"
id = "YOUR_COMPILATION_CACHE_ID"  # Replace with actual ID

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "YOUR_RATE_LIMIT_ID"  # Replace with actual ID

[[kv_namespaces]]
binding = "METRICS"
id = "YOUR_METRICS_ID"  # Replace with actual ID
```

### 3. Configure Web Analytics (Optional)

Get a Cloudflare Web Analytics beacon token:

1. Go to https://dash.cloudflare.com/
2. Navigate to **Web Analytics**
3. Create a new site or select existing
4. Copy the beacon token

Update `public/index.html` line 8:

```html
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' 
        data-cf-beacon='{"token": "YOUR_ACTUAL_BEACON_TOKEN"}'></script>
```

### 4. Set Up GitHub Secrets (for CI/CD)

Add these secrets to your GitHub repository:

Go to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `CLOUDFLARE_API_TOKEN` | API token with Workers/Pages permissions | Cloudflare Dashboard → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare Dashboard → Workers & Pages → Overview (right sidebar) |
| `DENO_DEPLOY_TOKEN` | JSR publishing token (optional) | JSR Dashboard → Settings → Tokens |
| `CODECOV_TOKEN` | Code coverage reporting (optional) | Codecov.io → Repository Settings |

**Creating Cloudflare API Token:**

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Add permissions:
   - Account → Workers Scripts → Edit
   - Account → Workers KV Storage → Edit
   - Account → Cloudflare Pages → Edit
5. Set Account Resources to your account
6. Create token and copy it

## Deployment Steps

### Option A: Manual Deployment

```bash
# 1. Install dependencies
npm install

# 2. Test locally
npm run dev
# Visit http://localhost:8787

# 3. Deploy to production
npm run deploy
```

### Option B: Automated CI/CD (GitHub Actions)

The CI/CD pipeline automatically deploys on push to `master` branch:

1. Ensure GitHub secrets are configured (see step 4 above)
2. Push to master:
   ```bash
   git add .
   git commit -m "feat: ready for deployment"
   git push origin master
   ```
3. Monitor deployment:
   - Go to **Actions** tab in GitHub
   - Check the workflow run
   - View deployment logs

### Option C: Bundle First (Recommended for Production)

```bash
# 1. Bundle from repository root
cd ../..
deno bundle src/index.ts examples/cloudflare-worker/bundle.js

# 2. Update import in worker.ts (if needed)
# Change: import {...} from '../../../src/index.ts';
# To:     import {...} from './bundle.js';

# 3. Deploy
cd examples/cloudflare-worker
npm run deploy
```

## Post-Deployment Verification

### 1. Test API Endpoints

```bash
# Test API info endpoint
curl https://adblock-compiler.YOUR_SUBDOMAIN.workers.dev/api

# Test compilation
curl -X POST https://adblock-compiler.YOUR_SUBDOMAIN.workers.dev/compile \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "name": "Test",
      "sources": [{"source": "https://example.com/filters.txt"}],
      "transformations": ["Deduplicate"]
    }
  }'

# Test metrics endpoint
curl https://adblock-compiler.YOUR_SUBDOMAIN.workers.dev/metrics

# Test batch endpoint
curl -X POST https://adblock-compiler.YOUR_SUBDOMAIN.workers.dev/compile/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"id": "test1", "configuration": {"name": "Test", "sources": [{"source": "https://example.com/list1.txt"}]}}
    ]
  }'
```

### 2. Test Web UI

1. Visit `https://adblock-compiler.YOUR_SUBDOMAIN.workers.dev/`
2. Try compiling a filter list in Simple Mode
3. Check that progress updates appear
4. Download/copy results
5. Test Advanced Mode with JSON config

### 3. Verify KV Namespaces

```bash
# List keys in each namespace
wrangler kv:key list --binding=COMPILATION_CACHE
wrangler kv:key list --binding=RATE_LIMIT
wrangler kv:key list --binding=METRICS
```

### 4. Monitor Logs

```bash
# Tail worker logs in real-time
npm run tail

# Or with wrangler directly
wrangler tail
```

### 5. Check Analytics

- **Cloudflare Dashboard**: Workers & Pages → adblock-compiler → Metrics
- **Web Analytics**: Analytics → Web Analytics (if configured)
- **Custom Metrics**: `GET /metrics` endpoint

## Cloudflare Pages Setup (Web UI)

### 1. Create Pages Project

```bash
# Deploy static assets to Pages
wrangler pages deploy public --project-name=hostlist-compiler-ui

# Or use GitHub integration:
# 1. Go to Cloudflare Dashboard → Pages
# 2. Click "Create a project"
# 3. Connect GitHub repository
# 4. Set build settings:
#    - Build command: (none)
#    - Build output directory: examples/cloudflare-worker/public
# 5. Deploy
```

### 2. Add Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Pages → hostlist-compiler-ui
2. Click **Custom domains**
3. Click **Set up a custom domain**
4. Enter: `adblock.yourdomain.com`
5. Add DNS record:
   - Type: CNAME
   - Name: adblock
   - Target: hostlist-compiler-ui.pages.dev
   - Proxy: Enabled (orange cloud)

See `CLOUDFLARE_PAGES_DOMAIN_SETUP.md` for detailed instructions.

## Configuration Files Reference

### wrangler.toml

```toml
name = "adblock-compiler"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

# KV Namespaces (UPDATE WITH YOUR IDs)
[[kv_namespaces]]
binding = "COMPILATION_CACHE"
id = "YOUR_ID_HERE"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "YOUR_ID_HERE"

[[kv_namespaces]]
binding = "METRICS"
id = "YOUR_ID_HERE"

# Environment variables
[vars]
COMPILER_VERSION = "2.0.0"

# Static assets
[site]
bucket = "./public"
```

### package.json

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  }
}
```

## Troubleshooting

### "KV namespace not found"

**Problem**: Worker can't access KV namespace

**Solution**:
1. Verify KV namespace IDs in `wrangler.toml`
2. Ensure namespaces exist: `wrangler kv:namespace list`
3. Redeploy: `npm run deploy`

### "Module not found" errors

**Problem**: Import paths not resolving

**Solution**:
1. Check that `src/index.ts` exists at repository root
2. Verify relative path in `worker.ts` line 19:
   ```typescript
   import {...} from '../../../src/index.ts';
   ```
3. Or use bundled version (see Option C above)

### Deploy fails with authentication error

**Problem**: Wrangler can't authenticate

**Solution**:
```bash
# Login to Cloudflare
wrangler login

# Or set API token directly
export CLOUDFLARE_API_TOKEN=your_token_here
wrangler deploy
```

### High cache miss rate

**Problem**: `X-Cache-Status: MISS` on most requests

**Solution**:
1. Ensure `COMPILATION_CACHE` KV is configured
2. Check cache TTL (default: 1 hour)
3. Verify cache key generation is deterministic
4. Monitor with `GET /metrics`

### Rate limit too aggressive

**Problem**: Users hitting 429 errors

**Solution**:
Update `src/worker.ts`:
```typescript
const RATE_LIMIT_MAX_REQUESTS = 100; // Increase from 10
```

Then redeploy.

### Worker exceeds CPU/memory limits

**Problem**: Worker times out on large compilations

**Solution**:
1. Enable compression (already enabled)
2. Use smaller source batches
3. Consider upgrading to Workers Paid plan
4. Optimize transformations

## Monitoring & Maintenance

### Regular Checks

- [ ] Monitor error rates in Cloudflare Dashboard
- [ ] Check KV storage usage (250 MB free tier limit)
- [ ] Review `/metrics` endpoint daily
- [ ] Test compilation with large filter lists weekly
- [ ] Update dependencies monthly (`npm update`)

### Scaling Considerations

**Free Tier Limits:**
- 100,000 requests/day
- 10ms CPU time per request
- 128 MB memory

**If you exceed limits:**
- Upgrade to Workers Paid ($5/month)
- Increases to 10M requests/month
- Higher CPU and memory limits

### Backup & Recovery

```bash
# Backup KV data
wrangler kv:key list --binding=COMPILATION_CACHE > backup-cache-keys.json

# Export all keys and values (requires script)
# See Cloudflare docs for bulk export

# Restore from backup
# Upload keys manually or via wrangler
```

## Security Checklist

- [ ] Rate limiting enabled (10 req/min default)
- [ ] CORS configured properly (`Access-Control-Allow-Origin: *`)
- [ ] Input validation in place (ConfigurationValidator)
- [ ] No secrets in code (use environment variables)
- [ ] HTTPS enforced (automatic with Cloudflare)
- [ ] Circuit breaker for external sources (3 retries)
- [ ] Error messages don't leak sensitive info

## Performance Optimization

- [x] Gzip compression enabled (70-80% reduction)
- [x] Request deduplication implemented
- [x] KV caching with 1-hour TTL
- [x] Parallel source downloads (if multiple sources)
- [ ] Consider enabling Cloudflare Argo Smart Routing
- [ ] Add R2 for large filter list storage
- [ ] Implement incremental compilation

## Support

- **Documentation**: See [README.md](README.md)
- **Issues**: https://github.com/jaypatrick/adblock-compiler/issues
- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/

---

**Last Updated**: 2026-01-01  
**Worker Version**: 2.0.0  
**API Version**: v1
