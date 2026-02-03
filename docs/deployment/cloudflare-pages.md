# Cloudflare Pages Deployment Guide

This guide explains how to deploy the Adblock Compiler UI to Cloudflare Pages.

## Overview

This project uses **Cloudflare Workers** for the main API/compiler service and **Cloudflare Pages** for hosting the static UI files in the `public/` directory.

## Important: Do NOT use `deno deploy`

⚠️ **Common Mistake:** This project is NOT deployed using `deno deploy`. While this is a Deno-based project, deployment to Cloudflare uses Wrangler, not Deno Deploy.

### Why not Deno Deploy?

- This project targets **Cloudflare Workers** runtime, not Deno Deploy
- The worker uses Cloudflare-specific bindings (KV, R2, D1, etc.)
- The deployment is managed through Wrangler CLI

## Deployment Options

### Option 1: Automated Deployment via GitHub Actions (Recommended)

The repository includes automated CI/CD that deploys to Cloudflare Workers and Pages automatically.

See `.github/workflows/ci.yml` for the deployment configuration.

**Requirements:**
- Set repository secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Enable deployment by setting repository variable:
  - `ENABLE_CLOUDFLARE_DEPLOY=true`

### Option 2: Manual Deployment

#### Workers Deployment

```bash
# Install dependencies
npm install

# Deploy worker
npm run deploy
# or
wrangler deploy
```

#### Pages Deployment

For deploying the static UI to Cloudflare Pages:

```bash
# Deploy public directory to Pages
wrangler pages deploy public --project-name=hostlist-compiler-ui
```

## Cloudflare Pages Dashboard Configuration

If you're setting up Cloudflare Pages through the dashboard, use these settings:

### Build Configuration

| Setting | Value |
|---------|-------|
| **Framework preset** | None |
| **Build command** | `npm install` |
| **Build output directory** | `public` |
| **Root directory** | (leave empty) |

### Environment Variables

| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `22` |

### ⚠️ Critical: Deploy Command

**DO NOT** set a deploy command to `deno deploy`. This will cause errors because:

1. Deno is not installed in the Cloudflare Pages build environment by default
2. This project uses Wrangler for deployment, not Deno Deploy
3. The static files in `public/` don't require any build step

**Correct configuration:**
- **Deploy command:** Leave empty or use `echo "No deploy command needed"`
- The `public/` directory contains pre-built static files that are served directly

## Common Errors

### Error: `/bin/sh: 1: deno: not found`

**Symptom:**
```
Executing user deploy command: deno deploy
/bin/sh: 1: deno: not found
Failed: error occurred while running deploy command
```

**Solution:**
Remove or change the deploy command in Cloudflare Pages dashboard settings:
1. Go to Pages project settings
2. Navigate to "Builds & deployments"
3. Under "Build configuration", clear the "Deploy command" field
4. Save changes

### Error: Build fails with missing dependencies

**Solution:**
Ensure the build command is set to `npm install` (not `npm run build` or other commands).

## Architecture

```
┌─────────────────────────────────────────┐
│  Cloudflare Pages                       │
│  ┌───────────────────────────────────┐  │
│  │  Static Files (public/)           │  │
│  │  - index.html (Admin Dashboard)   │  │
│  │  - compiler.html (Compiler UI)    │  │
│  │  - test.html (API Tester)         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ↓ (calls)
┌─────────────────────────────────────────┐
│  Cloudflare Workers                     │
│  ┌───────────────────────────────────┐  │
│  │  Worker (worker/worker.ts)        │  │
│  │  - API endpoints                  │  │
│  │  - Compiler service               │  │
│  │  - KV, R2, D1 bindings            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Verification

After deployment, verify:

1. **Pages URL**: `https://YOUR-PROJECT.pages.dev`
   - Should show the admin dashboard
   - Should load without errors

2. **Worker URL**: `https://adblock-compiler.YOUR-SUBDOMAIN.workers.dev`
   - API endpoints should respond
   - `/api` should return API documentation

3. **Integration**: The Pages UI should successfully call the Worker API

## Troubleshooting

### Pages deployment works but Worker calls fail

**Cause:** CORS issues or incorrect Worker URL in UI

**Solution:**
1. Check that the Worker URL in the UI matches your deployed Worker
2. Ensure CORS is configured correctly in `worker/worker.ts`
3. Verify the Worker is deployed and accessible

### UI shows but API calls return 404

**Cause:** Worker not deployed or incorrect API endpoint

**Solution:**
1. Deploy the Worker: `wrangler deploy`
2. Update the API endpoint URL in the UI files if needed
3. Check Worker logs: `wrangler tail`

## Related Documentation

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions CI/CD](../../.github/workflows/ci.yml)

## Support

For issues related to deployment, please:
1. Check this documentation first
2. Review the [Troubleshooting Guide](../TROUBLESHOOTING.md)
3. Open an issue on GitHub with deployment logs
