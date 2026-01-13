# AdBlock Compiler Documentation

Welcome to the AdBlock Compiler documentation. This directory contains all the detailed documentation for the project.

## Quick Links

- [Main README](../README.md) - Project overview and quick start
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## Documentation Structure

### Getting Started

- [Quick Start Guide](guides/quick-start.md) - Get up and running with Docker in minutes
- [API Documentation](api/README.md) - REST API reference and examples
- [Client Libraries](guides/clients.md) - Client examples for Python, TypeScript, and Go

### Deployment

- [Docker Deployment](deployment/docker.md) - Complete Docker guide with Kubernetes examples
- [Cloudflare Containers](deployment/cloudflare-containers.md) - Deploy to Cloudflare edge network

### Cloudflare Worker

- [Queue Support](QUEUE_SUPPORT.md) - Async compilation via Cloudflare Queues
- [Tail Worker](../worker/TAIL_WORKER.md) - Observability and logging
- [Tail Worker Quick Start](../worker/QUICKSTART.md) - Get tail worker running in 5 minutes

### Storage

- [NoSQL Storage](../src/storage/README.md) - Deno KV-based storage module
- [Prisma Backend](../prisma/README.md) - SQL/NoSQL database support
- [Cloudflare D1](CLOUDFLARE_D1.md) - Edge database integration
- [Prisma Evaluation](PRISMA_EVALUATION.md) - Storage backend comparison

### Development

- [Testing Guide](testing.md) - How to run and write tests
- [Benchmarks](benchmarks.md) - Performance benchmarking guide
- [Extensibility](EXTENSIBILITY.md) - Custom transformations and extensions
- [Diagnostics](DIAGNOSTICS.md) - Event emission and tracing

### Reference

- [Migration Guide](MIGRATION.md) - Migrating from @adguard/hostlist-compiler
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [AI Assistant Guide](claude.md) - Context for AI assistants working with this codebase

## Contributing

See the main [README](../README.md) for information on how to contribute to this project.
