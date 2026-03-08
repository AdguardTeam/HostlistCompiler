# Cloudflare Containers Deployment Guide

This guide explains how to deploy the Adblock Compiler to Cloudflare Containers.

## Overview

Cloudflare Containers allows you to deploy Docker containers globally alongside your Workers. The container configuration is set up in `wrangler.toml` and the container image is defined in `Dockerfile.container`.

## Current Configuration

### `wrangler.toml`

```toml
[[containers]]
class_name = "AdblockCompiler"
image = "./Dockerfile.container"
max_instances = 5

[[durable_objects.bindings]]
class_name = "AdblockCompiler"
name = "ADBLOCK_COMPILER"

[[migrations]]
new_sqlite_classes = ["AdblockCompiler"]
tag = "v1"
```

### `worker/worker.ts`

The `AdblockCompiler` class extends the `Container` class from `@cloudflare/containers`:

```typescript
import { Container } from '@cloudflare/containers';

export class AdblockCompiler extends Container {
    defaultPort = 8787;
    sleepAfter = '10m';

    override onStart() {
        console.log('[AdblockCompiler] Container started');
    }
}
```

### `Dockerfile.container`

A minimal Deno image that runs `worker/container-server.ts` — a lightweight HTTP server that handles compilation requests forwarded by the Worker.

## Prerequisites

1. **Docker must be running** — Wrangler uses Docker to build and push images
   ```bash
   docker info
   ```
   If this fails, start Docker Desktop or your Docker daemon.

2. **Wrangler authentication** — Authenticate with your Cloudflare account:
   ```bash
   deno task wrangler login
   ```

3. **Container support in your Cloudflare plan** — Containers are available on the Workers Paid plan.

## Deployment Steps

### 1. Deploy to Cloudflare

```bash
deno task wrangler:deploy
```

This command will:

- Build the Docker container image from `Dockerfile.container`
- Push the image to Cloudflare's Container Registry (backed by R2)
- Deploy your Worker with the container binding
- Configure Cloudflare's network to spawn container instances on-demand

### 2. Wait for Provisioning

After the first deployment, **wait 2–3 minutes** before making requests. Unlike Workers, containers take time to be provisioned across the edge network.

### 3. Check Deployment Status

```bash
npx wrangler containers list
```

This shows all containers in your account and their deployment status.

## Local Development

### Windows Limitation

**Containers are not supported for local development on Windows.** You have two options:

1. **Use WSL** (Windows Subsystem for Linux)
   ```powershell
   wsl
   cd /mnt/d/source/adblock-compiler
   deno task wrangler:dev
   ```

2. **Disable containers for local dev** (current configuration)
   The `wrangler.toml` has `enable_containers = false` in the `[dev]` section, which allows you to develop the Worker functionality locally without containers.

### Local Development Without Containers

You can still test the Worker API locally:

```bash
deno task wrangler:dev
```

Visit http://localhost:8787 to access:

- `/api` — API documentation
- `/compile` — JSON compilation endpoint
- `/compile/stream` — Streaming compilation with SSE
- `/metrics` — Request metrics

**Note:** Container endpoints return a fallback response in local development when `enable_containers = false`.

## Container Architecture

### How It Works

1. A request reaches the Cloudflare Worker (`worker/worker.ts`)
2. The Worker passes the request to an `AdblockCompiler` Durable Object instance
3. The `AdblockCompiler` (which extends `Container`) starts a container instance if one isn't already running
4. The container (`Dockerfile.container`) runs `worker/container-server.ts` — a Deno HTTP server
5. The server handles the compilation request using `WorkerCompiler` and returns the result
6. The container sleeps after 10 minutes of inactivity (`sleepAfter = '10m'`)

### Container Server Endpoints

`worker/container-server.ts` exposes:

| Method | Path       | Description                                 |
|--------|------------|---------------------------------------------|
| GET    | `/health`  | Liveness probe — returns `{ status: 'ok' }` |
| POST   | `/compile` | Compile a filter list, returns plain text   |

## Production Deployment Workflow

1. **Build and test locally** (without containers)
   ```bash
   deno task wrangler:dev
   ```

2. **Test Docker image** (optional)
   ```bash
   docker build -f Dockerfile.container -t adblock-compiler-container:test .
   docker run -p 8787:8787 adblock-compiler-container:test
   curl http://localhost:8787/health
   ```

3. **Deploy to Cloudflare**
   ```bash
   deno task wrangler:deploy
   ```

4. **Check deployment status**
   ```bash
   npx wrangler containers list
   ```

5. **Monitor logs**
   ```bash
   deno task wrangler:tail
   ```

## Container Configuration Options

### Scaling

```toml
[[containers]]
class_name = "AdblockCompiler"
image = "./Dockerfile.container"
max_instances = 5  # Maximum concurrent container instances
```

### Sleep Timeout

Configured in `worker/worker.ts` on the `AdblockCompiler` class:

```typescript
sleepAfter = '10m';  // Stop the container after 10 minutes of inactivity
```

## Bindings Available

The container/worker has access to:

- `env.COMPILATION_CACHE` — KV Namespace for caching compiled results
- `env.RATE_LIMIT` — KV Namespace for rate limiting
- `env.METRICS` — KV Namespace for metrics storage
- `env.FILTER_STORAGE` — R2 Bucket for filter list storage
- `env.ASSETS` — Static assets (HTML, CSS, JS)
- `env.COMPILER_VERSION` — Version string
- `env.ADBLOCK_COMPILER` — Durable Object binding to container

## Cost Considerations

- Containers are billed per millisecond of runtime (10ms granularity)
- Automatically scale to zero when not in use (`sleepAfter = '10m'`)
- No charges when idle
- Container registry storage is free (backed by R2)

## Troubleshooting

### Docker not running

```
Error: Docker is not running
```

**Solution:** Start Docker Desktop and run `docker info` to verify.

### Container won't provision

```
Error: Container failed to start
```

**Solution:**

1. Check `npx wrangler containers list` for status
2. Check container logs with `deno task wrangler:tail`
3. Verify `Dockerfile.container` builds locally: `docker build -f Dockerfile.container -t test .`

### Module not found errors

If you see `Cannot find module '@cloudflare/containers'`:

**Solution:** Run `pnpm install` to install the `@cloudflare/containers` package.

## Next Steps

1. **Deploy to production:**
   ```bash
   deno task wrangler:deploy
   ```

2. **Set up custom domain** (optional)
   ```bash
   npx wrangler deployments domains add <your-domain>
   ```

3. **Monitor performance**
   ```bash
   deno task wrangler:tail
   ```

4. **Update container configuration** as needed in `wrangler.toml` and `worker/worker.ts`

## Resources

- [Cloudflare Containers Documentation](https://developers.cloudflare.com/containers/)
- [@cloudflare/containers package](https://github.com/cloudflare/containers)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Container Examples](https://developers.cloudflare.com/containers/examples/)
- [Containers Limits](https://developers.cloudflare.com/containers/platform-details/#limits)

## Support

For issues or questions:

- GitHub Issues: https://github.com/jaypatrick/adblock-compiler/issues
- Cloudflare Discord: https://discord.gg/cloudflaredev

