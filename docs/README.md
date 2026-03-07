# AdBlock Compiler Documentation

Welcome to the AdBlock Compiler documentation. This directory contains all the detailed documentation for the project.

## Quick Links

- [Main README](../README.md) - Project overview and quick start
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## Documentation Structure

```
docs/
├── api/             # REST API reference, OpenAPI spec, streaming, and validation
├── cloudflare/      # Cloudflare-specific features (Queues, D1, Workflows, Analytics)
├── database-setup/  # Database architecture, PostgreSQL, Prisma, and local dev setup
├── deployment/      # Docker, Cloudflare Pages/Containers, and production readiness
├── development/     # Architecture, extensibility, diagnostics, and code quality
├── frontend/        # Angular SPA, Vite, Tailwind CSS, and UI components
├── guides/          # Getting started, migration, client libraries, and troubleshooting
├── postman/         # Postman collection and environment files
├── reference/       # Version management, environment config, and project reference
├── releases/        # Release notes and announcements
├── testing/         # Testing guides, E2E, and Postman API testing
└── workflows/       # GitHub Actions CI/CD workflows and automation
```

---

### Getting Started

- [Quick Start Guide](guides/quick-start.md) - Get up and running with Docker in minutes
- [API Documentation](api/README.md) - REST API reference and examples
- [Client Libraries](guides/clients.md) - Client examples for Python, TypeScript, and Go
- [Migration Guide](guides/MIGRATION.md) - Migrating from @adguard/hostlist-compiler
- [Troubleshooting](guides/TROUBLESHOOTING.md) - Common issues and solutions

### API Reference

- [API Documentation](api/README.md) - REST API reference
- [API Quick Reference](api/QUICK_REFERENCE.md) - Common commands and workflows
- [OpenAPI Support](api/OPENAPI_SUPPORT.md) - OpenAPI 3.0 specification details
- [OpenAPI Tooling](api/OPENAPI_TOOLING.md) - API specification validation and testing
- [Streaming API](api/STREAMING_API.md) - Real-time event streaming via SSE and WebSocket
- [Batch API Guide](api/BATCH_API_GUIDE.md) - 📊 Comprehensive guide with diagrams
- [Zod Validation Guide](api/ZOD_VALIDATION.md) - Runtime validation with Zod schemas
- [AGTree Integration](api/AGTREE_INTEGRATION.md) - AST-based adblock rule parsing with @adguard/agtree

### Cloudflare Worker

- [Cloudflare Overview](cloudflare/README.md) - Cloudflare-specific features index
- [Worker Overview](../worker/README.md) - Worker implementation and API endpoints
- [Admin Dashboard](cloudflare/ADMIN_DASHBOARD.md) - Real-time metrics, queue monitoring, and system health
- [Queue Support](cloudflare/QUEUE_SUPPORT.md) - Async compilation via Cloudflare Queues
- [Queue Diagnostics](cloudflare/QUEUE_DIAGNOSTICS.md) - Diagnostic events for queue-based compilation
- [Cloudflare Workflows](cloudflare/CLOUDFLARE_WORKFLOWS.md) - Durable execution for long-running compilations
- [Workflow Diagrams](workflows/WORKFLOW_DIAGRAMS.md) - System architecture and flow diagrams
- [Cloudflare Analytics Engine](cloudflare/CLOUDFLARE_ANALYTICS.md) - High-cardinality metrics and telemetry
- [Tail Worker](../worker/TAIL_WORKER.md) - Observability and logging
- [Tail Worker Quick Start](../worker/QUICKSTART.md) - Get tail worker running in 5 minutes
- [Worker E2E Tests](cloudflare/WORKER_E2E_TESTS.md) - Automated end-to-end test suite

### Deployment

- [Docker Deployment](deployment/docker.md) - Complete Docker guide with Kubernetes examples
- [Docker Configuration](deployment/DOCKER.md) - Docker Compose with layered environment configuration
- [Cloudflare Containers](deployment/cloudflare-containers.md) - Deploy to Cloudflare edge network
- [Cloudflare Pages](deployment/cloudflare-pages.md) - Deploy to Cloudflare Pages
- [Cloudflare Workers Architecture](deployment/CLOUDFLARE_WORKERS_ARCHITECTURE.md) - Backend vs frontend workers, deployment modes, and their relationship
- [Deployment Versioning](deployment/DEPLOYMENT_VERSIONING.md) - Automated deployment tracking and versioning
- [Production Readiness](deployment/PRODUCTION_READINESS.md) - Production readiness assessment and recommendations

### Storage & Database

- [Storage Module](../src/storage/README.md) - Prisma-based storage with SQLite default
- [Prisma Backend](../prisma/README.md) - SQL/NoSQL database support
- [Database Architecture](database-setup/DATABASE_ARCHITECTURE.md) - Database schema and design
- [Database Evaluation](database-setup/DATABASE_EVALUATION.md) - PlanetScale vs Neon vs Cloudflare vs Prisma comparison
- [Prisma Evaluation](database-setup/PRISMA_EVALUATION.md) - Storage backend comparison
- [Cloudflare D1](cloudflare/CLOUDFLARE_D1.md) - Edge database integration
- [Local Development Setup](database-setup/local-dev.md) - Local PostgreSQL dev environment

### Frontend Development

- [Frontend Overview](frontend/README.md) - Frontend documentation index
- [Angular Frontend](frontend/ANGULAR_FRONTEND.md) - Angular 21 SPA with Material Design 3 and SSR
- [SPA Benefits Analysis](frontend/SPA_BENEFITS.md) - Analysis of SPA benefits and migration recommendations
- [Vite Integration](frontend/VITE.md) - Frontend build pipeline with HMR, multi-page app, and React/Vue support
- [Tailwind CSS](frontend/TAILWIND_CSS.md) - Utility-first CSS framework integration with PostCSS
- [Validation UI](frontend/VALIDATION_UI.md) - Color-coded validation error UI component

### Development

- [Development Overview](development/README.md) - Development documentation index
- [Architecture](development/ARCHITECTURE.md) - System architecture and design decisions
- [Extensibility](development/EXTENSIBILITY.md) - Custom transformations and extensions
- [Circuit Breaker](development/CIRCUIT_BREAKER.md) - Fault-tolerant source downloads with automatic recovery
- [Diagnostics](development/DIAGNOSTICS.md) - Event emission and tracing
- [Benchmarks](development/benchmarks.md) - Performance benchmarking guide
- [Code Review](development/CODE_REVIEW.md) - Code quality review and recommendations

### Testing

- [Testing Guide](testing/testing.md) - How to run and write tests
- [E2E Testing](testing/E2E_TESTING.md) - End-to-end integration testing dashboard
- [Worker E2E Tests](cloudflare/WORKER_E2E_TESTS.md) - Cloudflare Worker automated end-to-end tests
- [Postman Testing](testing/POSTMAN_TESTING.md) - Import and test with Postman collections

### CI/CD & Workflows

- [GitHub Actions Workflows](workflows/WORKFLOWS.md) - CI/CD workflow documentation and best practices
- [Workflow Improvements](workflows/WORKFLOW_IMPROVEMENTS.md) - Summary of workflow parallelization improvements
- [GitHub Actions Environment Setup](workflows/ENV_SETUP.md) - Layered environment configuration for CI
- [Workflow Cleanup Summary](workflows/WORKFLOW_CLEANUP_SUMMARY.md) - Summary of workflow consolidation changes
- [Workflows Reference](../.github/workflows/README.md) - Detailed CI/CD workflow reference

### Reference

- [Reference Overview](reference/README.md) - Reference documentation index
- [Version Management](reference/VERSION_MANAGEMENT.md) - Version synchronization details
- [Auto Version Bump](reference/AUTO_VERSION_BUMP.md) - Automatic versioning via Conventional Commits
- [Environment Configuration](reference/ENV_CONFIGURATION.md) - Environment variables and layered config system
- [Validation Errors](guides/VALIDATION_ERRORS.md) - Understanding validation errors and reporting
- [Bugs and Features](reference/BUGS_AND_FEATURES.md) - Known bugs and feature requests
- [GitHub Issue Templates](reference/GITHUB_ISSUE_TEMPLATES.md) - Ready-to-use GitHub issue templates
- [AI Assistant Guide](reference/claude.md) - Context for AI assistants working with this codebase

### Releases

- [Release 0.8.0](releases/RELEASE_0.8.0.md) - v0.8.0 release notes
- [Blog Post](releases/BLOG_POST_ADBLOCK_COMPILER.md) - Project overview and announcement

---

## Contributing

See the main [README](../README.md) and [CONTRIBUTING](../CONTRIBUTING.md) for information on how to contribute to this project.
