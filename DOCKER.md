# Docker Deployment Guide

This guide explains how to deploy the Adblock Compiler using Docker containers.

## Quick Start

### Using Docker Compose (Recommended)

1. **Start the container:**
   ```bash
   docker-compose up -d
   ```

2. **Access the web UI:**
   Open http://localhost:8787 in your browser

3. **Access the API:**
   The API is available at http://localhost:8787/api

4. **View logs:**
   ```bash
   docker-compose logs -f adblock-compiler
   ```

5. **Stop the container:**
   ```bash
   docker-compose down
   ```

### Using Docker CLI

1. **Build the image:**
   ```bash
   docker build -t adblock-compiler:latest .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name adblock-compiler \
     -p 8787:8787 \
     -e COMPILER_VERSION=0.6.0 \
     adblock-compiler:latest
   ```

3. **Access the application:**
   Open http://localhost:8787 in your browser

## Container Architecture

The Docker image is built in multiple stages for optimal size and security:

1. **Base Stage**: Deno runtime with Node.js for Wrangler support
2. **Builder Stage**: Installs dependencies and builds the CLI executable
3. **Runtime Stage**: Minimal production image with only necessary files

### What's Included

- ✅ Deno 1.45.0 runtime
- ✅ Node.js 20.x and Wrangler (Cloudflare Worker local dev server)
- ✅ Adblock Compiler library and CLI
- ✅ Web UI (public/ directory)
- ✅ Cloudflare Worker API (src-worker/)
- ✅ Health checks
- ✅ Non-root user for security

## Configuration

### Environment Variables

The container supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPILER_VERSION` | `0.6.0` | Compiler version identifier |
| `PORT` | `8787` | Port for the web server |
| `DENO_DIR` | `/app/.deno` | Deno cache directory |

### Volumes

You can mount volumes for persistent data:

```yaml
volumes:
  # Source code (for development)
  - ./src:/app/src
  - ./src-worker:/app/src-worker
  - ./public:/app/public
  
  # Configuration files
  - ./config.json:/app/config.json:ro
  
  # Output directory
  - ./output:/app/output
  
  # Deno cache
  - deno-cache:/app/.deno
```

## Usage Examples

### Web UI and API Server

The default command runs the Cloudflare Worker with the web UI:

```bash
docker-compose up -d
```

Then visit:
- Web UI: http://localhost:8787
- API Docs: http://localhost:8787/api
- Test Interface: http://localhost:8787/test.html
- Metrics: http://localhost:8787/metrics

### CLI Mode

To use the compiler CLI instead of the web server:

```bash
# Run a compilation task
docker run --rm \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/output:/app/output \
  adblock-compiler:latest \
  /app/hostlist-compiler -c /app/config.json -o /app/output/filter.txt
```

Or use the CLI profile with docker-compose:

```bash
# Start the CLI container
docker-compose --profile cli run --rm adblock-compiler-cli \
  -c /app/examples/sdn/config.json -o /app/output/filter.txt
```

### Development Mode

For active development with live reloading:

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  adblock-compiler:
    volumes:
      - ./src:/app/src
      - ./src-worker:/app/src-worker
      - ./public:/app/public
    command: ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]
```

Then run:
```bash
docker-compose up
```

## Production Deployment

### Cloudflare Workers

While this Docker container is great for local development and self-hosted deployments, for production on Cloudflare, we recommend using Cloudflare's native deployment:

```bash
npm run deploy
```

### Self-Hosted Production

For production deployments:

1. **Build for production:**
   ```bash
   docker build -t adblock-compiler:0.6.0 .
   ```

2. **Use environment-specific configuration:**
   ```bash
   docker run -d \
     --name adblock-compiler-prod \
     --restart always \
     -p 8787:8787 \
     -e COMPILER_VERSION=0.6.0 \
     --health-cmd="curl -f http://localhost:8787/api || exit 1" \
     --health-interval=30s \
     --health-timeout=3s \
     --health-retries=3 \
     adblock-compiler:0.6.0
   ```

3. **Use a reverse proxy (nginx/traefik):**
   ```nginx
   server {
       listen 80;
       server_name adblock.example.com;
       
       location / {
           proxy_pass http://localhost:8787;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

### Kubernetes Deployment

Example Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: adblock-compiler
spec:
  replicas: 2
  selector:
    matchLabels:
      app: adblock-compiler
  template:
    metadata:
      labels:
        app: adblock-compiler
    spec:
      containers:
      - name: adblock-compiler
        image: adblock-compiler:0.6.0
        ports:
        - containerPort: 8787
        env:
        - name: COMPILER_VERSION
          value: "0.6.0"
        livenessProbe:
          httpGet:
            path: /api
            port: 8787
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api
            port: 8787
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: adblock-compiler
spec:
  selector:
    app: adblock-compiler
  ports:
  - port: 80
    targetPort: 8787
  type: LoadBalancer
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker-compose logs -f adblock-compiler
```

### Port already in use

Change the port mapping in docker-compose.yml:
```yaml
ports:
  - "8788:8787"  # Use port 8788 instead
```

### Permission issues

The container runs as a non-root user (uid 1001). If you're mounting volumes, ensure they have appropriate permissions:
```bash
chown -R 1001:1001 ./output
```

### Out of memory

Increase Docker memory limit:
```bash
docker run -d \
  --name adblock-compiler \
  --memory="2g" \
  -p 8787:8787 \
  adblock-compiler:latest
```

### Deno cache issues

Clear the Deno cache volume:
```bash
docker-compose down -v
docker volume rm adblock-compiler-deno-cache
docker-compose up -d
```

## Health Checks

The container includes built-in health checks:

```bash
# Check container health status
docker inspect --format='{{.State.Health.Status}}' adblock-compiler

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' adblock-compiler
```

## Security Considerations

- ✅ Container runs as non-root user (uid 1001)
- ✅ Minimal base image with only necessary dependencies
- ✅ No secrets in environment variables or image layers
- ✅ Health checks for monitoring
- ⚠️ For production, use HTTPS via reverse proxy
- ⚠️ Consider rate limiting at the reverse proxy level
- ⚠️ Regularly update base images for security patches

## Performance Tips

1. **Use volume mounts for cache:**
   ```yaml
   volumes:
     - deno-cache:/app/.deno
   ```

2. **Limit container resources:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 1G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

3. **Enable gzip compression at reverse proxy level**

## Support

For issues or questions:
- GitHub Issues: https://github.com/jaypatrick/adblock-compiler/issues
- Documentation: https://github.com/jaypatrick/adblock-compiler/blob/main/README.md
