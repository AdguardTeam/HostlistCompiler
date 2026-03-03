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
- [Zod Validation Guide](ZOD_VALIDATION.md) - Runtime validation with Zod schemas
- [AGTree Integration](AGTREE_INTEGRATION.md) - AST-based adblock rule parsing with @adguard/agtree

### Deployment

- [Docker Deployment](deployment/docker.md) - Complete Docker guide with Kubernetes examples
- [Docker Configuration](DOCKER.md) - Docker Compose with layered environment configuration
- [Cloudflare Containers](deployment/cloudflare-containers.md) - Deploy to Cloudflare edge network
- [Deployment Versioning](DEPLOYMENT_VERSIONING.md) - Automated deployment tracking and versioning

### Cloudflare Worker

- [Worker Overview](../worker/README.md) - Worker implementation and API endpoints
- [Admin Dashboard](ADMIN_DASHBOARD.md) - Real-time metrics, queue monitoring, and system health
- [Queue Support](QUEUE_SUPPORT.md) - Async compilation via Cloudflare Queues
- [Queue Diagnostics](QUEUE_DIAGNOSTICS.md) - Diagnostic events for queue-based compilation
- [Cloudflare Workflows](CLOUDFLARE_WORKFLOWS.md) - Durable execution for long-running compilations
- [**Batch API Guide** (Visual Learning Edition)](BATCH_API_GUIDE.md) - 📊 Comprehensive guide with diagrams
- [Workflow Diagrams](WORKFLOW_DIAGRAMS.md) - System architecture and flow diagrams
- [Streaming API](STREAMING_API.md) - Real-time event streaming via SSE and WebSocket
- [Cloudflare Analytics Engine](CLOUDFLARE_ANALYTICS.md) - High-cardinality metrics and telemetry
- [Tail Worker](../worker/TAIL_WORKER.md) - Observability and logging
- [Tail Worker Quick Start](../worker/QUICKSTART.md) - Get tail worker running in 5 minutes
- [Worker E2E Tests](WORKER_E2E_TESTS.md) - Automated end-to-end test suite

### Storage

- [Storage Module](../src/storage/README.md) - Prisma-based storage with SQLite default
- [Prisma Backend](../prisma/README.md) - SQL/NoSQL database support
- [Cloudflare D1](CLOUDFLARE_D1.md) - Edge database integration
- [Prisma Evaluation](PRISMA_EVALUATION.md) - Storage backend comparison
- [**Database Evaluation**](DATABASE_EVALUATION.md) - PlanetScale vs Neon vs Cloudflare vs Prisma: vendor comparison, proposed PostgreSQL schema, Hyperdrive integration, and migration plan

### Reliability

- [Circuit Breaker](CIRCUIT_BREAKER.md) - Fault-tolerant source downloads with automatic recovery

### Frontend Development

- [Vite Integration](VITE.md) - Frontend build pipeline with HMR, multi-page app, and React/Vue support
- [Tailwind CSS](TAILWIND_CSS.md) - Utility-first CSS framework integration with PostCSS
- [SPA Benefits Analysis](SPA_BENEFITS.md) - Analysis of SPA benefits and migration recommendations
- [Framework PoCs](../poc/README.md) - React, Vue 3, Angular, and Svelte 5 proof-of-concept implementations
- [Framework PoCs (Alpha)](FRAMEWORK_POCS.md) - React, Vue 3, Angular, and Svelte proof-of-concept implementations
- [Validation UI](VALIDATION_UI.md) - Color-coded validation error UI component

### Development

- [Testing Guide](testing.md) - How to run and write tests
- [E2E Testing](E2E_TESTING.md) - End-to-end integration testing dashboard
- [Benchmarks](benchmarks.md) - Performance benchmarking guide
- [Extensibility](EXTENSIBILITY.md) - Custom transformations and extensions
- [Diagnostics](DIAGNOSTICS.md) - Event emission and tracing
- [Validation Errors](VALIDATION_ERRORS.md) - Understanding validation errors and reporting

### Reference

- [OpenAPI Tooling](OPENAPI_TOOLING.md) - API specification validation and testing
- [Postman Testing](POSTMAN_TESTING.md) - Import and test with Postman collections
- [Migration Guide](MIGRATION.md) - Migrating from @adguard/hostlist-compiler
- [Version Management](VERSION_MANAGEMENT.md) - Version synchronization details
- [Auto Version Bump](AUTO_VERSION_BUMP.md) - Automatic versioning via Conventional Commits
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [AI Assistant Guide](claude.md) - Context for AI assistants working with this codebase
- [Environment Configuration](ENV_CONFIGURATION.md) - Environment variables and layered config system
- [Production Readiness](PRODUCTION_READINESS.md) - Production readiness assessment and recommendations
- [Bugs and Features](BUGS_AND_FEATURES.md) - Known bugs and feature requests
- [GitHub Issue Templates](GITHUB_ISSUE_TEMPLATES.md) - Ready-to-use GitHub issue templates

### CI/CD & Workflows

- [GitHub Actions Workflows](WORKFLOWS.md) - CI/CD workflow documentation and best practices
- [Workflow Improvements](WORKFLOW_IMPROVEMENTS.md) - Summary of workflow parallelization improvements
- [GitHub Actions Environment Setup](ENV_SETUP.md) - Layered environment configuration for CI
- [Workflow Cleanup Summary](WORKFLOW_CLEANUP_SUMMARY.md) - Summary of workflow consolidation changes
- [Workflows Reference](../.github/workflows/README.md) - Detailed CI/CD workflow reference

## Contributing

See the main [README](../README.md) for information on how to contribute to this project.
