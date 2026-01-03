# Troubleshooting Guide

Common issues and solutions for AdBlock Compiler.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Compilation Errors](#compilation-errors)
- [Performance Issues](#performance-issues)
- [Network & API Issues](#network--api-issues)
- [Cache Issues](#cache-issues)
- [Deployment Issues](#deployment-issues)
- [Platform-Specific Issues](#platform-specific-issues)

## Installation Issues

### Package not found on JSR

**Error:**
```
error: JSR package not found: @jk-com/adblock-compiler
```

**Solution:**
Use npm import as fallback:
```typescript
import { compile } from "npm:@jk-com/adblock-compiler";
```

Or install via npm:
```bash
npm install @jk-com/adblock-compiler
```

### Deno version incompatibility

**Error:**
```
error: Unsupported Deno version
```

**Solution:**
AdBlock Compiler requires Deno 2.0 or higher:
```bash
deno upgrade
deno --version  # Should be 2.0.0 or higher
```

### Permission denied errors

**Error:**
```
error: Requires net access to "example.com"
```

**Solution:**
Grant necessary permissions:
```bash
# Allow all network access
deno run --allow-net your-script.ts

# Allow specific hosts
deno run --allow-net=example.com,github.com your-script.ts

# For file access
deno run --allow-read --allow-net your-script.ts
```

## Compilation Errors

### Invalid configuration

**Error:**
```
ValidationError: Invalid configuration: sources is required
```

**Solution:**
Ensure your configuration has required fields:
```typescript
const config: IConfiguration = {
  name: "My Filter List",  // REQUIRED
  sources: [               // REQUIRED
    {
      name: "Source 1",
      source: "https://example.com/list.txt"
    }
  ],
  // Optional fields...
};
```

### Source fetch failures

**Error:**
```
Error fetching source: 404 Not Found
```

**Solutions:**

1. **Check URL validity:**
```typescript
// Verify the URL is accessible
const response = await fetch(sourceUrl);
console.log(response.status);  // Should be 200
```

2. **Handle 404s gracefully:**
```typescript
// Use exclusions_sources to skip broken sources
const config = {
  name: "My List",
  sources: [
    { name: "Good", source: "https://good.com/list.txt" },
    { name: "Broken", source: "https://broken.com/404.txt" }
  ],
  exclusions_sources: ["https://broken.com/404.txt"]
};
```

3. **Check circuit breaker:**
```
Source temporarily disabled due to repeated failures
```

Wait 5 minutes for circuit breaker to reset, or check the source availability.

### Transformation errors

**Error:**
```
TransformationError: Invalid rule at line 42
```

**Solution:**
Enable validation transformation to see detailed errors:
```typescript
const config = {
  name: "My List",
  sources: [...],
  transformations: [
    "Validate",  // Add this to see validation details
    "RemoveComments",
    "Deduplicate"
  ]
};
```

### Memory issues

**Error:**
```
JavaScript heap out of memory
```

**Solutions:**

1. **Increase memory limit (Node.js):**
```bash
node --max-old-space-size=4096 your-script.js
```

2. **Use streaming for large files:**
```typescript
// Process sources in chunks
const config = {
  sources: smallBatch,  // Process 10-20 sources at a time
  transformations: ["Compress", "Deduplicate"]
};
```

3. **Enable compression:**
```typescript
transformations: ["Compress"]  // Reduces memory usage
```

## Performance Issues

### Slow compilation

**Symptoms:**
- Compilation takes >60 seconds
- High CPU usage
- Unresponsive UI

**Solutions:**

1. **Enable caching (API/Worker):**
```typescript
// Cloudflare Worker automatically caches
// Check cache headers:
X-Cache-Status: HIT
```

2. **Use batch API for multiple lists:**
```typescript
// Compile in parallel
POST /compile/batch
{
  "requests": [
    { "id": "list1", "configuration": {...} },
    { "id": "list2", "configuration": {...} }
  ]
}
```

3. **Optimize transformations:**
```typescript
// Minimal transformations for speed
transformations: [
  "RemoveComments",
  "Deduplicate",
  "RemoveEmptyLines"
]

// Remove expensive transformations like:
// - Validate (checks every rule)
// - ConvertToAscii (processes every character)
```

4. **Check source count:**
```typescript
// Limit to 20-30 sources max
// Too many sources = slow compilation
console.log(config.sources.length);
```

### High memory usage

**Solution:**
```typescript
// Use Compress transformation
transformations: ["Compress", "Deduplicate"]

// This reduces memory usage by 70-80%
```

### Request deduplication not working

**Issue:**
Multiple identical requests all compile instead of using cached result.

**Solution:**
Ensure requests are identical:
```typescript
// These are DIFFERENT requests (different order)
const req1 = { sources: [a, b] };
const req2 = { sources: [b, a] };

// These are IDENTICAL (will be deduplicated)
const req1 = { sources: [a, b] };
const req2 = { sources: [a, b] };
```

Check for deduplication:
```
X-Request-Deduplication: HIT
```

## Network & API Issues

### Rate limiting

**Error:**
```
429 Too Many Requests
Retry-After: 60
```

**Solution:**
Respect rate limits:
```typescript
const retryAfter = response.headers.get('Retry-After');
await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
```

Rate limits:
- **Per IP**: 60 requests/minute
- **Per endpoint**: 100 requests/minute

### CORS errors

**Error:**
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS
```

**Solution:**
Use the API endpoint which has CORS enabled:
```typescript
// ✅ CORRECT - CORS enabled
fetch('https://adblock-compiler.jayson-knight.workers.dev/compile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ configuration })
});

// ❌ WRONG - Direct source fetch (no CORS)
fetch('https://random-site.com/list.txt');
```

### Timeout errors

**Error:**
```
TimeoutError: Request timed out after 30000ms
```

**Solution:**

1. **Check source availability:**
```bash
curl -I https://source-url.com/list.txt
```

2. **Circuit breaker will retry:**
- Automatic retry with exponential backoff
- Up to 3 attempts
- Then source is temporarily disabled

3. **Use fallback sources:**
```typescript
sources: [
  { name: "Primary", source: "https://primary.com/list.txt" },
  { name: "Mirror", source: "https://mirror.com/list.txt" }  // Fallback
]
```

### SSL/TLS errors

**Error:**
```
error: Invalid certificate
```

**Solution:**
```bash
# Deno - use --unsafely-ignore-certificate-errors (not recommended)
deno run --unsafely-ignore-certificate-errors script.ts

# Better: Fix the source's SSL certificate
# Or use HTTP if available (less secure)
```

## Cache Issues

### Stale cache

**Issue:**
API returns old/outdated results.

**Solution:**

1. **Check cache age:**
```typescript
const response = await fetch('/compile', {...});
console.log(response.headers.get('X-Cache-Age'));  // Seconds
```

2. **Force cache refresh:**
Add a unique parameter:
```typescript
const config = {
  name: "My List",
  version: new Date().toISOString(),  // Forces new cache key
  sources: [...]
};
```

3. **Cache TTL:**
- Default: 1 hour
- Max: 24 hours

### Cache miss rate high

**Issue:**
```
X-Cache-Status: MISS
```
Most requests miss cache.

**Solution:**
Use consistent configuration:
```typescript
// BAD - timestamp changes every time
const config = {
  name: "My List",
  version: Date.now().toString(),  // Always different!
  sources: [...]
};

// GOOD - stable configuration
const config = {
  name: "My List",
  version: "1.0.0",  // Static version
  sources: [...]
};
```

### Compressed cache errors

**Error:**
```
DecompressionError: Invalid compressed data
```

**Solution:**
Clear cache and recompile:
```typescript
// Cache will be automatically rebuilt
// If persistent, file a GitHub issue
```

## Deployment Issues

### Cloudflare Worker deployment fails

**Error:**
```
Error: Worker exceeded memory limit
```

**Solutions:**

1. **Check bundle size:**
```bash
du -h dist/worker.js
# Should be < 1MB
```

2. **Minify code:**
```bash
deno bundle --minify src/worker.ts dist/worker.js
```

3. **Remove unused imports:**
```typescript
// BAD
import * as everything from '@jk-com/adblock-compiler';

// GOOD
import { compile, FilterCompiler } from '@jk-com/adblock-compiler';
```

### Worker KV errors

**Error:**
```
KV namespace not found
```

**Solution:**
Ensure KV namespace is bound in wrangler.toml:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

Create namespace:
```bash
wrangler kv:namespace create CACHE
```

### Environment variables not set

**Error:**
```
ReferenceError: CACHE is not defined
```

**Solution:**
Add bindings in wrangler.toml:
```toml
[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "production-kv-id"
```

## Platform-Specific Issues

### Deno issues

**Issue: Import map not working**

**Solution:**
```bash
# Use deno.json, not import_map.json
# Ensure deno.json is in project root
```

**Issue: Type errors**

**Solution:**
```bash
# Clear Deno cache
rm -rf ~/.cache/deno
deno cache --reload src/main.ts
```

### Node.js issues

**Issue: ES modules not supported**

**Solution:**
Add to package.json:
```json
{
  "type": "module"
}
```

Or use .mjs extension:
```bash
mv index.js index.mjs
```

**Issue: CommonJS require() not working**

**Solution:**
```javascript
// Use dynamic import
const { compile } = await import('@jk-com/adblock-compiler');

// Or convert to ES modules
```

### Browser issues

**Issue: Module not found**

**Solution:**
Use a bundler (esbuild, webpack):
```bash
npm install -D esbuild
npx esbuild src/main.ts --bundle --outfile=dist/bundle.js
```

**Issue: CORS with local files**

**Solution:**
Run a local server:
```bash
# Python
python -m http.server 8000

# Deno
deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts

# Node
npx serve .
```

## Getting Help

### Enable debug logging

```typescript
// Set environment variable
Deno.env.set("DEBUG", "true");

// Or in .env file
DEBUG=true
```

### Collect diagnostics

```bash
# System info
deno --version
node --version

# Network test
curl -I https://adblock-compiler.jayson-knight.workers.dev/api

# Permissions test
deno run --allow-net test.ts
```

### Report an issue

Include:
1. Error message (full stack trace)
2. Minimal reproduction code
3. Configuration file (sanitized)
4. Platform/version info
5. Steps to reproduce

**GitHub Issues**: https://github.com/jaypatrick/adblock-compiler/issues

### Community support

- **Documentation**: [README.md](../README.md)
- **API Reference**: [docs/api/README.md](../docs/api/README.md)
- **Examples**: [docs/guides/clients.md](../docs/guides/clients.md)
- **Web UI**: https://adblock-compiler.jayson-knight.workers.dev/

## Quick Fixes Checklist

- [ ] Updated to latest version?
- [ ] Cleared cache? (`rm -rf ~/.cache/deno` or `rm -rf node_modules`)
- [ ] Correct permissions? (`--allow-net --allow-read`)
- [ ] Valid configuration? (name + sources required)
- [ ] Network connectivity? (`curl -I <source-url>`)
- [ ] Rate limits respected? (60 req/min)
- [ ] Checked GitHub issues? (Someone may have solved it)

---

Still stuck? Open an issue with full details!
