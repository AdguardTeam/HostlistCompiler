# Cloudflare R2 / S3-Compatible Storage Integration

> Date: 2026-03-10

This document captures ideas for publishing compiled filter lists to Cloudflare R2 or any S3-compatible object storage, plugging into the existing `src/storage/` module.

---

## 🪣 Why Object Storage?

Currently, compiled filter lists are output to `output/` locally or returned via the API. Object storage enables:
- **CDN distribution** of compiled lists via public R2 bucket URLs
- **Versioned history** of compiled outputs
- **Cross-service sharing** (e.g., AdGuard Home, Pi-hole, or Cloudflare Gateway pulling lists directly from a public URL)

---

## 💡 Integration Ideas

### 1. `R2StorageTarget` in `src/storage/`
Add a `R2StorageTarget` that uses the [Cloudflare R2 Workers Binding](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) to write compiled output:

```typescript
// worker/worker.ts (via R2 binding)
await env.COMPILED_LISTS.put(`lists/${listName}.txt`, compiledOutput, {
  httpMetadata: { contentType: 'text/plain' },
});
```

---

### 2. `S3StorageTarget` in `src/storage/`
Add a generic `S3StorageTarget` using the AWS SDK v3 S3 client (compatible with R2, Backblaze B2, MinIO, etc.) for environments outside Cloudflare Workers:

```typescript
// Environment variables
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=adblock-lists
```

---

### 3. Public CDN URLs
Configure the R2 bucket with a custom domain or Cloudflare's `r2.dev` subdomain to serve compiled lists as publicly accessible URLs:

```
https://lists.example.com/adblock-compiler/my-list.txt
```

These URLs can then be used directly in AdGuard Home, Pi-hole, or uBlock Origin subscription settings.

---

### 4. Versioned Outputs
Store compiled outputs with a timestamp or version prefix to maintain a history:

```
lists/2026-03-10/my-list.txt
lists/latest/my-list.txt
```

---

### 5. Storage Provider Abstraction
Extend the existing `src/storage/` abstraction to support a pluggable `IStorageProvider` interface:

```typescript
interface IStorageProvider {
  write(key: string, content: string): Promise<void>;
  read(key: string): Promise<string | null>;
  list(prefix?: string): Promise<string[]>;
}
```

Implementations: `LocalStorageProvider`, `R2StorageProvider`, `S3StorageProvider`.

---

## Key Consideration

Cloudflare R2 is zero-egress-cost and integrates natively with the Wrangler deployment model already in use. It is the most natural storage backend for this project.
