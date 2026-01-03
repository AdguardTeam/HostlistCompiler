# Cloudflare Containers Deployment Guide

This guide explains how to deploy the Adblock Compiler to Cloudflare Containers.

## Overview

Cloudflare Containers allows you to deploy Docker containers globally alongside your Workers. The container configuration is already set up in `wrangler.toml`.

## Current Configuration

The `wrangler.toml` file includes:

```toml
[[containers]]
class_name = "AdblockCompiler"
image = "./Dockerfile"
max_instances = 5
instance_type = "basic"

[[durable_objects.bindings]]
class_name = "AdblockCompiler"
name = "ADBLOCK_COMPILER"

[[migrations]]
new_sqlite_classes = ["AdblockCompiler"]
tag = "v1"
```

## Prerequisites

1. **Docker must be running** - Wrangler uses Docker to build and push images
   ```powershell
   docker info
   ```
   If this fails, start Docker Desktop.

2. **Wrangler authentication** - Already authenticated as jayson.knight@jaysonknight.com

3. **Container support in your Cloudflare plan** - Containers are currently in public beta

## Deployment Steps

### 1. Deploy to Cloudflare

```powershell
npx wrangler deploy
```

This command will:
- Build your Docker container image using the Dockerfile
- Push the image to Cloudflare's Container Registry (backed by R2)
- Deploy your Worker
- Configure Cloudflare's network to spawn container instances

### 2. Wait for Provisioning

After first deployment, **wait 2-3 minutes** before making requests. Unlike Workers, Containers take time to be provisioned across the edge network.

### 3. Check Deployment Status

```powershell
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
   npx wrangler dev
   ```

2. **Disable containers for local dev** (current configuration)
   The `wrangler.toml` has `enable_containers = false` in the `[dev]` section, which allows you to develop the Worker functionality locally without containers.

### Local Development Without Containers

You can still test the Worker API locally:

```powershell
npx wrangler dev --local
```

Visit http://localhost:8787 to access:
- `/api` - API documentation
- `/compile` - JSON compilation endpoint
- `/compile/stream` - Streaming compilation with SSE
- `/metrics` - Request metrics

**Note:** Container-specific endpoints will return 501 Not Implemented in local development.

## Container Class

The `AdblockCompiler` class in `worker/worker.ts` is currently a stub for local development. When you deploy to Cloudflare with containers enabled, you can update it to extend the Container class:

```typescript
import { Container } from "cloudflare:workers";

export class AdblockCompiler extends Container {
  defaultPort = 8787;
}
```

## Production Deployment Workflow

1. **Build and test locally** (without containers)
   ```powershell
   npx wrangler dev --local
   ```

2. **Test Docker image** (optional)
   ```powershell
   docker build -t adblock-compiler:test .
   docker run -p 8787:8787 adblock-compiler:test
   ```

3. **Deploy to Cloudflare**
   ```powershell
   npx wrangler deploy
   ```

4. **Check deployment status**
   ```powershell
   npx wrangler containers list
   ```

5. **Monitor logs**
   ```powershell
   npx wrangler tail
   ```

## Container Configuration Options

### Instance Types

Available instance types in `wrangler.toml`:
- `basic` - Default, suitable for most workloads
- `standard` - More CPU/memory for intensive tasks
- `premium` - Maximum resources

### Scaling

```toml
[[containers]]
class_name = "AdblockCompiler"
image = "./Dockerfile"
max_instances = 5  # Maximum concurrent container instances
instance_type = "basic"
```

Future autoscaling support:
```toml
autoscaling = true  # Coming soon
cpu_target = 75     # Target CPU utilization
```

## Bindings Available

Your container/worker has access to:
- `env.COMPILATION_CACHE` - KV Namespace for caching compiled results
- `env.RATE_LIMIT` - KV Namespace for rate limiting
- `env.METRICS` - KV Namespace for metrics storage
- `env.FILTER_STORAGE` - R2 Bucket for filter list storage
- `env.ASSETS` - Static assets (HTML, CSS, JS)
- `env.COMPILER_VERSION` - Version string
- `env.ADBLOCK_COMPILER` - Durable Object binding to container

## Cost Considerations

- Containers are billed per millisecond of runtime (10ms granularity)
- Automatically scale to zero when not in use
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
2. Check container logs with `npx wrangler tail`
3. Verify Dockerfile builds locally: `docker build -t test .`

### Module not found errors

If you see `Cannot find module 'cloudflare:workers'`:

**Solution:** This is expected in local dev. The module is only available in production. Make sure `enable_containers = false` is set in `[dev]` section of `wrangler.toml`.

## Next Steps

1. **Deploy to production:**
   ```powershell
   npx wrangler deploy
   ```

2. **Set up custom domain** (optional)
   ```powershell
   npx wrangler deployments domains add <your-domain>
   ```

3. **Monitor performance**
   ```powershell
   npx wrangler tail
   ```

4. **Update container configuration** as needed in `wrangler.toml`

## Resources

- [Cloudflare Containers Documentation](https://developers.cloudflare.com/containers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Container Examples](https://developers.cloudflare.com/containers/examples/)
- [Containers Limits](https://developers.cloudflare.com/containers/platform-details/limits/)

## Support

For issues or questions:
- GitHub Issues: https://github.com/jaypatrick/adblock-compiler/issues
- Cloudflare Discord: https://discord.gg/cloudflaredev
