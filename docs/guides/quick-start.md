# Quick Start with Docker

Get the Adblock Compiler up and running in minutes with Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (comes with Docker Desktop)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/jaypatrick/adblock-compiler.git
cd adblock-compiler
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

That's it! The compiler is now running.

### 3. Access the Application

- **Web UI**: http://localhost:8787
- **API Documentation**: http://localhost:8787/api  
- **Test Interface**: http://localhost:8787/test.html
- **Metrics**: http://localhost:8787/metrics

## Example Usage

### Using the Web UI

1. Open http://localhost:8787 in your browser
2. Switch to "Simple Mode" or "Advanced Mode"
3. Add filter list URLs or paste a configuration
4. Click "Compile" and watch the real-time progress
5. Download or copy the compiled filter list

### Using the API

Compile a filter list programmatically:

```bash
curl -X POST http://localhost:8787/compile \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "name": "My Filter List",
      "sources": [
        {
          "source": "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
          "transformations": ["RemoveComments", "Deduplicate"]
        }
      ],
      "transformations": ["RemoveEmptyLines"]
    }
  }'
```

### Streaming Compilation

Get real-time progress updates using Server-Sent Events:

```bash
curl -N -X POST http://localhost:8787/compile/stream \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "name": "My Filter List",
      "sources": [{"source": "https://example.com/filters.txt"}]
    }
  }'
```

## Managing the Container

### View Logs

```bash
docker compose logs -f
```

### Stop the Container

```bash
docker compose down
```

### Restart the Container

```bash
docker compose restart
```

### Update the Container

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Configuration

### Environment Variables

Copy the example environment file and customize:

```bash
cp .env.example .env
# Edit .env with your preferred settings
```

Available variables:
- `COMPILER_VERSION`: Version identifier (default: 0.6.0)
- `PORT`: Server port (default: 8787)
- `DENO_DIR`: Deno cache directory (default: /app/.deno)

### Custom Port

To run on a different port, edit `docker-compose.yml`:

```yaml
ports:
  - "8080:8787"  # Runs on port 8080 instead
```

## Development Mode

For active development with live reload:

```bash
# Source code is already mounted in docker-compose.yml
docker compose up
```

Changes to files in `src/`, `worker/`, and `public/` will be reflected automatically.

## Troubleshooting

### Port Already in Use

If port 8787 is already in use:

```bash
# Stop the conflicting service or change the port in docker-compose.yml
docker compose down
# Edit docker-compose.yml to use a different port
docker compose up -d
```

### Container Won't Start

Check the logs:

```bash
docker compose logs
```

### Permission Issues

If you encounter permission errors with volumes:

```bash
sudo chown -R 1001:1001 ./output
```

## Next Steps

- 📚 Read the [Complete Docker Guide](../deployment/docker.md) for advanced configurations
- 🌐 Check out the [Main README](../../README.md) for full documentation
- 🚀 Deploy to production using the Kubernetes examples in docker.md
- 🔧 Explore the [API Documentation](http://localhost:8787/api)

## Need Help?

- **Issues**: https://github.com/jaypatrick/adblock-compiler/issues
- **Documentation**: See [docker.md](../deployment/docker.md) and [README.md](../../README.md)
