# Cloudflare Pages Custom Domain Setup

## Domain: adblock.jaysonknight.com

### Step 1: Add Custom Domain in Cloudflare Pages

1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/)
2. Select your Pages project (likely named `hostlist-compiler-ui` or similar)
3. Navigate to **Custom domains** tab
4. Click **Set up a custom domain**
5. Enter: `adblock.jaysonknight.com`
6. Click **Continue**

### Step 2: Configure DNS Records

Cloudflare will show you the required DNS records. You need to add a **CNAME** record:

#### DNS Record to Add:

| Type  | Name    | Target                                | Proxy Status |
|-------|---------|---------------------------------------|--------------|
| CNAME | adblock | hostlist-compiler-ui.pages.dev       | Proxied (🟠) |

**Important Notes:**
- Replace `hostlist-compiler-ui.pages.dev` with your actual Pages project URL if different
- Set Proxy status to **Proxied** (orange cloud) for:
  - DDoS protection
  - Automatic HTTPS
  - Performance optimization
  - Cloudflare caching

### Step 3: Add DNS Record via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select domain: **jaysonknight.com**
3. Click **DNS** in the left sidebar
4. Click **Add record**
5. Configure:
   - **Type**: CNAME
   - **Name**: adblock
   - **Target**: hostlist-compiler-ui.pages.dev (or your Pages URL)
   - **Proxy status**: Proxied (orange cloud icon)
   - **TTL**: Auto
6. Click **Save**

### Step 4: Add DNS Record via CLI (Alternative)

If you prefer using Wrangler or API:

```bash
# Using wrangler CLI (if you have a Pages project)
wrangler pages project create hostlist-compiler-ui

# Then add custom domain
wrangler pages domains add adblock.jaysonknight.com --project-name=hostlist-compiler-ui
```

Or use the Cloudflare API:

```bash
# Get your zone ID for jaysonknight.com
curl -X GET "https://api.cloudflare.com/client/v4/zones?name=jaysonknight.com" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"

# Add DNS record (replace ZONE_ID)
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "adblock",
    "content": "hostlist-compiler-ui.pages.dev",
    "proxied": true,
    "ttl": 1
  }'
```

### Step 5: Verify Setup

1. Wait 1-5 minutes for DNS propagation
2. Visit https://adblock.jaysonknight.com
3. Verify SSL certificate is active (should be automatic with Cloudflare proxy)
4. Check that the site loads correctly

### Step 6: Update Cloudflare Pages Settings (Optional)

If you want to redirect the old `.pages.dev` URL to your custom domain:

1. Go to Pages project settings
2. Navigate to **Redirects/Headers**
3. Add a redirect rule:
   ```
   https://hostlist-compiler-ui.pages.dev/* https://adblock.jaysonknight.com/:splat 301
   ```

## Verification Commands

Test DNS propagation:
```bash
# Check CNAME record
nslookup adblock.jaysonknight.com

# Or use dig
dig adblock.jaysonknight.com CNAME

# Test HTTPS
curl -I https://adblock.jaysonknight.com
```

## Troubleshooting

### DNS Not Resolving
- Wait up to 5 minutes for DNS propagation
- Clear your DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
- Try using Google DNS (8.8.8.8) temporarily

### SSL Certificate Error
- Ensure Proxy status is **Proxied** (orange cloud)
- Cloudflare will automatically provision SSL certificate
- May take a few minutes after DNS is active

### 404 Error
- Verify the Pages project name matches the CNAME target
- Check that the Pages project has been deployed successfully
- Ensure custom domain is properly added in Pages dashboard

## Current Configuration

- **Pages Project**: hostlist-compiler-ui (verify actual name)
- **Custom Domain**: adblock.jaysonknight.com
- **API Domain**: adblock-compiler.jayson-knight.workers.dev
- **GitHub Repo**: jaypatrick/adblock-compiler

## Summary

After completing these steps:
- ✅ Web UI will be accessible at https://adblock.jaysonknight.com
- ✅ API remains at https://adblock-compiler.jayson-knight.workers.dev
- ✅ SSL/TLS automatically handled by Cloudflare
- ✅ DDoS protection and caching enabled
