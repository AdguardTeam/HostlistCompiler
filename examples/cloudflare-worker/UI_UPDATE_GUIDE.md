# Compiler UI Update Guide

## Overview

The Adblock Compiler UI is served by the Cloudflare Worker and provides an interactive web interface for compiling filter lists. This guide explains how to update and customize the UI.

## UI Location

The compiler UI HTML file is located at:
```
examples/cloudflare-worker/public/index.html
```

This is the **single source of truth** for the UI. When you deploy the worker, this file is served to users who visit the root URL (`/`).

## How It Works

1. **Static Assets**: The `wrangler.toml` file configures the `public/` directory as static assets:
   ```toml
   [site]
   bucket = "./public"
   ```

2. **Worker Serving**: The `src/worker.ts` file serves `index.html` when users visit the root path:
   ```typescript
   // Serve web UI for root path
   if (pathname === '/' && request.method === 'GET') {
       return serveWebUI(env);
   }
   ```

3. **Asset Loading**: The `serveWebUI()` function loads the HTML from the static assets KV namespace (`__STATIC_CONTENT`).

## How to Update the UI

### 1. Edit the HTML File

Simply edit the file at:
```
examples/cloudflare-worker/public/index.html
```

You can modify:
- UI design and styling (CSS in the `<style>` section)
- JavaScript functionality (in the `<script>` section)
- HTML structure
- Examples and documentation
- Colors, fonts, layouts, etc.

### 2. Test Locally

Before deploying, test your changes locally:

```bash
cd examples/cloudflare-worker
npm run dev
```

Then visit `http://localhost:8787` in your browser to see your changes.

### 3. Deploy to Production

Once you're satisfied with your changes:

```bash
cd examples/cloudflare-worker
npm run deploy
```

The updated UI will be deployed to your Cloudflare Worker and available immediately.

## UI Components

The current UI (`index.html`) includes:

### Tabs
- **Simple Mode**: Easy-to-use interface for basic compilation
- **Advanced Mode**: Full JSON configuration editor
- **Examples**: Pre-built templates
- **API Docs**: Documentation and usage examples

### Features
- Real-time progress tracking via Server-Sent Events (SSE)
- Download compiled filter lists
- Copy to clipboard
- Visual diff viewer (shows changes from cached version)
- Benchmarking metrics
- Multiple example templates

### Styling
- Gradient purple/blue theme
- Responsive design (mobile-friendly)
- Modern card-based layout
- Smooth animations and transitions

## Common Customizations

### Change Colors

Edit the CSS gradient in the `<style>` section:

```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Add New Examples

Add to the `examples` object in the JavaScript:

```javascript
const examples = {
    'my-example': {
        mode: 'simple',
        input: 'https://example.com/filters.txt',
        name: 'My Example'
    }
};
```

### Modify API Endpoint

If you change the API URL, update the fetch call:

```javascript
const apiUrl = window.location.hostname === 'localhost' 
    ? '/compile/stream'
    : 'https://your-custom-domain.workers.dev/compile/stream';
```

### Add Analytics

The UI includes Cloudflare Web Analytics. To add your own token:

```html
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' 
    data-cf-beacon='{"token": "YOUR-TOKEN-HERE"}'></script>
```

## Version Information

The current compiler version is displayed in the UI and should match the version in `wrangler.toml`:

- **Current Version**: 0.6.0
- **Location in wrangler.toml**: `COMPILER_VERSION = "0.6.0"`

When updating the compiler version:
1. Update `wrangler.toml`: Change `COMPILER_VERSION`
2. Update `deno.json`: Change `version`
3. The UI will automatically display the correct version from the API response

## Troubleshooting

### UI Not Updating After Deployment

1. **Clear Browser Cache**: Hard refresh with Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. **Check Deployment**: Run `wrangler deployments list` to confirm deployment
3. **Verify File**: Ensure `public/index.html` exists and has your changes
4. **Check Wrangler Config**: Verify `[site]` section in `wrangler.toml`

### Static Assets Not Loading

1. **Check site configuration** in `wrangler.toml`:
   ```toml
   [site]
   bucket = "./public"
   ```

2. **Verify file location**: Ensure `index.html` is in `examples/cloudflare-worker/public/`

3. **Check Environment**: The `__STATIC_CONTENT` binding should be available in production

### Fallback HTML Showing

If you see the simple fallback HTML instead of the full UI, it means:
- Static assets aren't loading
- The `__STATIC_CONTENT` KV namespace is not available
- Local development mode (use `npm run dev` to test with full UI)

The fallback is designed as a safety net and shows basic API information.

## File Structure

```
examples/cloudflare-worker/
├── public/
│   └── index.html          ← MAIN UI FILE (edit this)
├── src/
│   ├── worker.ts           ← Worker logic (serves index.html)
│   └── html.ts             ← Legacy redirect (not used)
├── wrangler.toml           ← Config (version, static assets)
├── package.json
├── DEPLOYMENT.md
├── WEB_UI.md
└── UI_UPDATE_GUIDE.md      ← This file
```

## Best Practices

1. **Test Locally First**: Always use `npm run dev` to test changes before deploying
2. **Keep Version in Sync**: Update version in both `wrangler.toml` and `deno.json`
3. **Backup Before Major Changes**: Copy `index.html` before making significant modifications
4. **Mobile Testing**: Test on mobile devices as the UI is responsive
5. **Browser Compatibility**: Test on Chrome, Firefox, and Safari

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Web UI Documentation](./WEB_UI.md)
- [Deployment Guide](./DEPLOYMENT.md)

## Support

For issues or questions:
1. Check this guide first
2. Review [WEB_UI.md](./WEB_UI.md) for feature documentation
3. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
4. File an issue on GitHub

---

**Quick Reference:**
- **UI File**: `examples/cloudflare-worker/public/index.html`
- **Test Command**: `npm run dev`
- **Deploy Command**: `npm run deploy`
- **Version**: 0.6.0
