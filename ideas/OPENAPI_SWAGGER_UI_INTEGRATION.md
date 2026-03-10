# OpenAPI / Swagger UI Integration

> Date: 2026-03-10

This document captures ideas for auto-generating interactive API documentation from the existing OpenAPI spec and hosting it alongside the Cloudflare Worker.

---

## 💡 Integration Ideas

### 1. Swagger UI via Cloudflare Worker
Serve the [Swagger UI](https://swagger.io/tools/swagger-ui/) directly from the existing `worker/worker.ts`, rendering the OpenAPI spec interactively at a `/docs` route:

```typescript
// worker/worker.ts
if (url.pathname === '/docs') {
  return new Response(swaggerHtml, {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

Bundle the OpenAPI spec (`openapi.yaml` / `openapi.json`) as a static asset via Wrangler.

### 2. Scalar API Reference
As an alternative to Swagger UI, [Scalar](https://scalar.com/) provides a modern, more visually appealing API reference UI that is also OpenAPI-driven and lightweight enough for Workers.

### 3. OpenAPI Spec Auto-Generation
Rather than hand-authoring the spec, auto-generate it from TypeScript types/decorators in `worker/worker.ts` using a tool like [`zod-openapi`](https://github.com/asteasolutions/zod-to-openapi) or [`hono-openapi`](https://github.com/rhinobase/hono-openapi) — especially relevant if Hono is already in use.

### 4. Spec Validation in CI
Add a CI step (`.github/workflows/`) to validate the OpenAPI spec on every PR using [`redocly lint`](https://redocly.com/docs/cli/) or [`spectral`](https://stoplight.io/open-source/spectral):

```yaml
- name: Lint OpenAPI spec
  run: npx @redocly/cli lint openapi.yaml
```

### 5. Client SDK Generation
Use the OpenAPI spec to auto-generate typed client SDKs (TypeScript, Python, etc.) via [`openapi-generator`](https://openapi-generator.tech/) or [`hey-api`](https://heyapi.dev/), making it easy for consumers to integrate with the compiler API.

### 6. Postman Collection Sync
Auto-sync the OpenAPI spec to the existing `.postman/` collection in the repo using the [Postman API](https://www.postman.com/postman/workspace/postman-public-workspace/documentation/12959542-c8142d51-e97c-46b6-bd77-52bb66712c9a), keeping the Postman collection up to date automatically.

---

## Key Consideration

The project already has a `.postman/` directory and `postman/` folder, indicating API documentation and testing are priorities. Swagger UI / Scalar served from the Worker itself provides zero-infrastructure interactive docs, fully aligned with the Cloudflare Workers deployment model.