# Adblock Compiler

<!-- Primary Badges -->

[![JSR](https://jsr.io/badges/@jk-com/adblock-compiler)](https://jsr.io/@jk-com/adblock-compiler)
[![JSR Score](https://jsr.io/badges/@jk-com/adblock-compiler/score)](https://jsr.io/@jk-com/adblock-compiler)
[![CI/CD Pipeline](https://github.com/jaypatrick/adblock-compiler/actions/workflows/ci.yml/badge.svg)](https://github.com/jaypatrick/adblock-compiler/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jaypatrick/adblock-compiler/branch/main/graph/badge.svg?token=LC5EYHK71O)](https://codecov.io/gh/jaypatrick/adblock-compiler)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/releases)
[![GitHub Tag](https://img.shields.io/github/v/tag/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/tags)

<!-- Platform & Service Badges -->

[![Web UI](https://img.shields.io/badge/Web%20UI-Live-brightgreen?logo=cloudflare)](https://adblock-compiler-ui.pages.dev/)
[![API](https://img.shields.io/badge/API-Live-blue?logo=cloudflare)](https://adblock-compiler-ui.pages.dev/api)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-6BA539?logo=openapiinitiative&logoColor=white)](docs/api/openapi.yaml)
[![Deno](https://img.shields.io/badge/Deno-2.0+-black?logo=deno)](https://deno.land)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker&logoColor=white)](#docker-deployment)
[![Uptime](https://img.shields.io/website?url=https%3A%2F%2Fadblock-compiler-ui.pages.dev%2F&label=uptime)](https://adblock-compiler-ui.pages.dev/)
[![Deployed on Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://adblock-compiler-ui.pages.dev/)
[![mdBook Docs](https://img.shields.io/badge/docs-mdBook-blue?logo=mdBook)](https://adblock-compiler-ui.pages.dev/docs)

<!-- Security & Quality Badges -->

[![Known Vulnerabilities](https://snyk.io/test/github/jaypatrick/adblock-compiler/badge.svg)](https://snyk.io/test/github/jaypatrick/adblock-compiler)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jaypatrick/adblock-compiler/badge)](https://scorecard.dev/viewer/?uri=github.com/jaypatrick/adblock-compiler)
[![Last Commit](https://img.shields.io/github/last-commit/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/commits/main)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler)
[![Code Size](https://img.shields.io/github/languages/code-size/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler)
[![Top Language](https://img.shields.io/github/languages/top/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler)

<!-- Community & Stats Badges -->

[![GitHub Stars](https://img.shields.io/github/stars/jaypatrick/adblock-compiler?style=social)](https://github.com/jaypatrick/adblock-compiler/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/jaypatrick/adblock-compiler?style=social)](https://github.com/jaypatrick/adblock-compiler/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/pulls)
[![Contributors](https://img.shields.io/github/contributors/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/graphs/contributors)
[![Watchers](https://img.shields.io/github/watchers/jaypatrick/adblock-compiler?style=social)](https://github.com/jaypatrick/adblock-compiler/watchers)
[![Discussions](https://img.shields.io/github/discussions/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/discussions)
[![Changelog](https://img.shields.io/badge/Changelog-CHANGELOG.md-blue)](CHANGELOG.md)

**Compiler-as-a-Service** for adblock filter lists. Transform, optimize, and combine filter lists from multiple sources with real-time progress tracking.

🌐 **[Try the Admin Dashboard](https://adblock-compiler-ui.pages.dev/)** | 🔧 **[Compiler UI](https://adblock-compiler-ui.pages.dev/compiler.html)** | 🚀 **[API Endpoint](https://adblock-compiler-ui.pages.dev/api)** | 📚 **[Documentation](docs/api/README.md)**

> **Note:** This is a Deno-native rewrite of the original [@adguard/hostlist-compiler](https://www.npmjs.com/package/@adguard/hostlist-compiler). The package provides more functionality with improved performance and no Node.js dependencies.

## 📚 Documentation

The full project documentation is available at **[adblock-compiler-ui.pages.dev/docs](https://adblock-compiler-ui.pages.dev/docs)** (coming soon via Cloudflare Pages).

To preview locally:
```bash
# Install mdBook (requires Rust/Cargo or direct binary)
cargo install mdbook
# or download binary: https://github.com/rust-lang/mdBook/releases

# Serve with live reload from the repo root (uses book.toml with src = "docs")
mdbook serve
# → open http://localhost:3000
```

## 🎉 New in v0.30.x

- **🎯 Angular 21 SPA** — Production Angular frontend with zoneless change detection, Angular Material 3, SSR, and Cloudflare Workers deployment ([docs](frontend/README.md))
- **🎨 Tailwind CSS v4** — Migrated from Tailwind v3 to v4 across all legacy UI pages ([docs](docs/frontend/TAILWIND_CSS.md))
- **📱 Mobile Responsive** — Comprehensive responsive layout improvements across all UI pages
- **📖 Styled API Docs** — HTML documentation page served at the `/api` endpoint
- **🔧 IBasicLogger Injection** — Structured error logging injected into `CompilerEventEmitter`, `AnalyticsService`, and `CloudflareQueueProvider`

## ✨ Features

- **🎯 Multi-Source Compilation** - Combine filter lists from URLs, files, or inline rules
- **⚡ Performance** - Gzip compression (70-80% cache reduction), request deduplication, smart caching
- **🔄 Circuit Breaker** - Automatic retry with exponential backoff for unreliable sources
- **📊 Visual Diff** - See what changed between compilations
- **🎪 Batch Processing** - Compile up to 10 lists in parallel
- **📡 Real-time Updates** - Server-Sent Events (SSE) and WebSocket support
- **🔔 Async Notifications** - Get notified when background jobs complete
- **🌐 Admin Dashboard** - Monitor metrics, queue depth, and system health
- **📖 OpenAPI 3.0 Specification** - Full API documentation with contract tests
- **🌍 Universal** - Works in Deno, Node.js, Cloudflare Workers, browsers
- **🖥️ Angular 21 SPA** - Production frontend with zoneless change detection, Material Design 3, and SSR
- **🎨 11 Transformations** - Deduplicate, compress, validate, and more
- **📝 Structured Logging** - Production-ready JSON logs for observability (CloudWatch, Datadog, Splunk)
- **🚨 Error Reporting** - Centralized error tracking with Sentry and Cloudflare Analytics Engine
- **✅ Zod Validation** - Runtime schema validation for all configurations and API inputs
- **🧩 AST Rule Parsing** - Full abstract syntax tree parsing via @adguard/agtree
- **⚙️ Cloudflare Workflows** - Durable execution for long-running and background compilations

- [Installation](#installation)
- [Usage](#usage)
  - [Configuration](#configuration)
  - [Command-line](#command-line)
  - [API](#api)
- [OpenAPI Specification](#openapi-specification)
- [Docker Deployment](#docker-deployment)
- [Cloudflare Pages Deployment](docs/deployment/cloudflare-pages.md)
- [Transformations](#transformations)
  - [RemoveComments](#remove-comments)
  - [Compress](#compress)
  - [RemoveModifiers](#remove-modifiers)
  - [Validate](#validate)
  - [ValidateAllowIp](#validate-allow-ip)
  - [Deduplicate](#deduplicate)
  - [InvertAllow](#invertallow)
  - [RemoveEmptyLines](#removeemptylines)
  - [TrimLines](#trimlines)
  - [InsertFinalNewLine](#insertfinalnewline)
  - [ConvertToAscii](#convert-to-ascii)
- [Extensibility](#extensibility)
- [Development](#development)
  - [Angular Frontend](#angular-frontend-development)
  - [Legacy Frontend (Tailwind CSS / Vite)](#legacy-frontend-tailwind-css--vite)
- [Platform Support](#platform-support)
  - [Edge Runtimes (Generic)](#edge-runtimes)
  - [Cloudflare Workers](#cloudflare-workers)
  - [Web Workers](#web-workers)
  - [Browser Usage](#browser-usage)
  - [Custom Fetchers](#custom-fetchers)

## <a name="installation"></a> Installation

### Using Deno (recommended)

Run directly without installation:

```bash
deno run --allow-read --allow-write --allow-net jsr:@jk-com/adblock-compiler -c config.json -o output.txt
```

Or install globally:

```bash
deno install --allow-read --allow-write --allow-net -n adblock-compiler jsr:@jk-com/adblock-compiler/cli
```

### Build from source

Clone the repository and compile:

```bash
git clone https://github.com/jaypatrick/adblock-compiler.git
cd adblock-compiler
deno task build
```

This creates a standalone `adblock-compiler` executable.

### Using Docker

Run the compiler with Docker for easy deployment:

```bash
# Using Docker Compose (recommended)
docker compose up -d
```

Access the web UI at http://localhost:8787

📚 **[Quick Start Guide](docs/guides/quick-start.md)** - Get started in minutes\
📚 **[Docker Deployment Guide](docs/deployment/docker.md)** - Complete guide with production setups and Kubernetes examples

## <a name="usage"></a> Usage

**Quick hosts conversion**

Convert and compress a `/etc/hosts`-syntax blocklist to [AdGuard syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/).

```bash
adblock-compiler -i hosts.txt -i hosts2.txt -o output.txt
```

**Build a configurable blocklist from multiple sources**

Prepare the list configuration (read more about that [below](#configuration)) and run the compiler:

```bash
adblock-compiler -c configuration.json -o output.txt
```

**All command line options**

```
Usage: adblock-compiler [options]

Options:
  --config, -c      Path to the compiler configuration file             [string]
  --input, -i       URL (or path to a file) to convert to an AdGuard-syntax
                    blocklist. Can be specified multiple times.          [array]
  --input-type, -t  Type of the input file (hosts|adblock)             [string]
  --output, -o      Path to the output file                  [string] [required]
  --verbose, -v     Run with verbose logging                           [boolean]
  --version         Show version number                                [boolean]
  -h, --help        Show help                                          [boolean]

Examples:
  adblock-compiler -c config.json -o       compile a blocklist and write the
  output.txt                                output to output.txt
  adblock-compiler -i                      compile a blocklist from the URL and
  https://example.org/hosts.txt -o          write the output to output.txt
  output.txt
```

### <a name="configuration"></a> Configuration

Configuration defines your filter list sources, and the transformations that are applied to the sources.

Here is an example of this configuration:

```json
{
    "name": "List name",
    "description": "List description",
    "homepage": "https://example.org/",
    "license": "GPLv3",
    "version": "1.0.0.0",
    "sources": [
        {
            "name": "Local rules",
            "source": "rules.txt",
            "type": "adblock",
            "transformations": ["RemoveComments", "Compress"],
            "exclusions": ["excluded rule 1"],
            "exclusions_sources": ["exclusions.txt"],
            "inclusions": ["*"],
            "inclusions_sources": ["inclusions.txt"]
        },
        {
            "name": "Remote rules",
            "source": "https://example.org/rules",
            "type": "hosts",
            "exclusions": ["excluded rule 1"]
        }
    ],
    "transformations": ["Deduplicate", "Compress"],
    "exclusions": ["excluded rule 1", "excluded rule 2"],
    "exclusions_sources": ["global_exclusions.txt"],
    "inclusions": ["*"],
    "inclusions_sources": ["global_inclusions.txt"]
}
```

- `name` - (mandatory) the list name.
- `description` - (optional) the list description.
- `homepage` - (optional) URL to the list homepage.
- `license` - (optional) Filter list license.
- `version` - (optional) Filter list version.
- `sources` - (mandatory) array of the list sources.
  - `.source` - (mandatory) path or URL of the source. It can be a traditional filter list or a hosts file.
  - `.name` - (optional) name of the source.
  - `.type` - (optional) type of the source. It could be `adblock` for Adblock-style lists or `hosts` for /etc/hosts style lists. If not specified, `adblock` is assumed.
  - `.transformations` - (optional) a list of transformations to apply to the source rules. By default, **no transformations** are applied. Learn more about possible transformations [here](#transformations).
  - `.exclusions` - (optional) a list of rules (or wildcards) to exclude from the source.
  - `.exclusions_sources` - (optional) a list of files with exclusions.
  - `.inclusions` - (optional) a list of wildcards to include from the source. All rules that don't match these wildcards won't be included.
  - `.inclusions_sources` - (optional) a list of files with inclusions.
- `transformations` - (optional) a list of transformations to apply to the final list of rules. By default, **no transformations** are applied. Learn more about possible transformations [here](#transformations).
- `exclusions` - (optional) a list of rules (or wildcards) to exclude from the source.
- `exclusions_sources` - (optional) a list of files with exclusions.
- `.inclusions` - (optional) a list of wildcards to include from the source. All rules that don't match these wildcards won't be included.
- `.inclusions_sources` - (optional) a list of files with inclusions.

Here is an example of a minimal configuration:

```json
{
    "name": "test list",
    "sources": [
        {
            "source": "rules.txt"
        }
    ]
}
```

**Exclusion and inclusion rules**

Please note, that exclusion or inclusion rules may be a plain string, wildcard, or a regular expression.

- `plainstring` - every rule that contains `plainstring` will match the rule
- `*.plainstring` - every rule that matches this wildcard will match the rule
- `/regex/` - every rule that matches this regular expression, will match the rule. By default, regular expressions are case-insensitive.
- `! comment` - comments will be ignored.

> [!IMPORTANT]
> Ensure that rules in the exclusion list match the format of the rules in the filter list.
> To maintain a consistent format, add the `Compress` transformation to convert `/etc/hosts` rules to adblock syntax.
> This is especially useful if you have multiple lists in different formats.

Here is an example:

Rules in HOSTS syntax: `/hosts.txt`

```txt
0.0.0.0 ads.example.com
0.0.0.0 tracking.example1.com
0.0.0.0 example.com
```

Exclusion rules in adblock syntax: `/exclusions.txt`

```txt
||example.com^
```

Configuration of the final list:

```json
{
    "name": "List name",
    "description": "List description",
    "sources": [
        {
            "name": "HOSTS rules",
            "source": "hosts.txt",
            "type": "hosts",
            "transformations": ["Compress"]
        }
    ],
    "transformations": ["Deduplicate", "Compress"],
    "exclusions_sources": ["exclusions.txt"]
}
```

Final filter output of `/hosts.txt` after applying the `Compress` transformation and exclusions:

```txt
||ads.example.com^
||tracking.example1.com^
```

The last rule now `||example.com^` will correctly match the rule from the exclusion list and will be excluded.

### <a name="command-line"></a> Command-line

Command-line arguments.

```
Usage: adblock-compiler [options]

Options:
  --version      Show version number                                   [boolean]
  --config, -c   Path to the compiler configuration file               [string]
  --input, -i    URL or path to input file (can be repeated)            [array]
  --output, -o   Path to the output file                     [string] [required]
  --verbose, -v  Run with verbose logging                              [boolean]
  -h, --help     Show help                                             [boolean]

Examples:
  adblock-compiler -c config.json -o       compile a blocklist and write the
  output.txt                                output to output.txt
```

### <a name="api"></a> API

Import from JSR:

```typescript
import { compile } from 'jsr:@jk-com/adblock-compiler';
```

Or add to your `deno.json`:

```json
{
    "imports": {
        "@jk-com/adblock-compiler": "jsr:@jk-com/adblock-compiler"
    }
}
```

#### TypeScript example:

```typescript
import { compile } from '@jk-com/adblock-compiler';
import type { IConfiguration } from '@jk-com/adblock-compiler';

const config: IConfiguration = {
    name: 'Your Hostlist',
    sources: [
        {
            type: 'adblock',
            source: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
            transformations: ['RemoveComments', 'Validate'],
        },
    ],
    transformations: ['Deduplicate'],
};

// Compile filters
const result = await compile(config);

// Write to file
await Deno.writeTextFile('your-hostlist.txt', result.join('\n'));
```

#### Using the FilterCompiler class directly:

```typescript
import { ConsoleLogger, FilterCompiler } from '@jk-com/adblock-compiler';
import type { IConfiguration } from '@jk-com/adblock-compiler';

const logger = new ConsoleLogger();
const compiler = new FilterCompiler(logger);

const config: IConfiguration = {
    name: 'Your Hostlist',
    sources: [
        {
            source: 'rules.txt',
            type: 'hosts',
        },
    ],
    transformations: ['Compress', 'Deduplicate'],
};

const result = await compiler.compile(config);
console.log(`Compiled ${result.length} rules`);
```

#### Runtime Validation with Zod

The package includes **Zod schemas** for type-safe runtime validation of configurations and API requests:

```typescript
import { ConfigurationSchema, ConfigurationValidator } from '@jk-com/adblock-compiler';

// Using the validator class (backward-compatible)
const validator = new ConfigurationValidator();
const result = validator.validate(configObject);

if (!result.valid) {
    console.error('Validation failed:', result.errorsText);
} else {
    console.log('Configuration is valid!');
}

// Or use Zod schemas directly for more control
const parseResult = ConfigurationSchema.safeParse(configObject);

if (!parseResult.success) {
    console.error('Validation failed:');
    for (const issue of parseResult.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
} else {
    // parseResult.data contains the validated configuration
    const validatedConfig = parseResult.data;
    console.log('Configuration is valid!');
}
```

**Available Schemas:**

- `ConfigurationSchema` - Main configuration validation (with transformation ordering refinement)
- `SourceSchema` - Individual source validation (with `.transform()` normalization and ordering refinement)
- `CompileRequestSchema` - Worker compilation request (with URL key validation on `preFetchedContent`)
- `BatchRequestSchema` - Batch compilation requests (with URL key validation on `preFetchedContent`)
- `ValidationReportSchema` - Validation error reports
- `HttpFetcherOptionsSchema` - HTTP fetcher options
- `PlatformCompilerOptionsSchema` - Platform compiler options
- `CompilationResultSchema` - Compilation output shape
- `WorkerCompilationResultSchema` - Worker compilation output with optional benchmark metrics
- `BenchmarkMetricsSchema` - Performance benchmark metrics
- `CliArgumentsSchema` - CLI argument validation (used by `ArgumentParser.validate()`)
- `EnvironmentSchema` - Worker environment bindings and runtime variables
- `AdblockRuleSchema` - Parsed adblock-syntax rule structure
- `EtcHostsRuleSchema` - Parsed `/etc/hosts`-syntax rule structure

For detailed documentation and examples, see [Zod Validation Guide](docs/api/ZOD_VALIDATION.md).

## <a name="openapi-specification"></a> OpenAPI Specification

This package includes a comprehensive **OpenAPI 3.0.3** specification for the REST API, enabling:

- **📄 Interactive API Documentation** - Beautiful, auto-generated docs with Redoc
- **✅ Contract Testing** - Automated validation that API matches specification
- **🔧 Code Generation** - Generate client SDKs in multiple languages
- **📮 Postman Collections** - Import ready-to-use API collections
- **🧪 Automated Validation** - CI/CD integration for spec validation

### Quick Start

```bash
# Validate the OpenAPI specification
deno task openapi:validate

# Generate interactive HTML documentation
deno task openapi:docs

# Run contract tests against live API
deno task test:contract
```

### OpenAPI Features

The OpenAPI specification (`openapi.yaml`) documents all API endpoints:

- **Compilation Endpoints** - `/compile`, `/compile/stream`, `/compile/batch`
- **Async Queue Operations** - `/compile/async`, `/queue/stats`, `/queue/results/{id}`
- **WebSocket Support** - `/ws/compile` for real-time bidirectional communication
- **Metrics & Monitoring** - `/metrics`, `/queue/stats` for performance tracking

### Documentation

- **📚 [OpenAPI Tooling Guide](docs/api/OPENAPI_TOOLING.md)** - Complete guide to validation, testing, and documentation generation
- **📖 [API Quick Reference](docs/api/QUICK_REFERENCE.md)** - Common commands and workflows
- **🌐 [Interactive API Docs](docs/api/index.html)** - Auto-generated HTML documentation
- **📮 [Postman Testing Guide](docs/testing/POSTMAN_TESTING.md)** - Import and test with Postman

### Example: Using the OpenAPI Spec

```bash
# Generate a client SDK (using openapi-generator)
openapi-generator-cli generate -i openapi.yaml -g typescript-fetch -o ./client

# Import into Postman
# File → Import → openapi.yaml

# Test against production
curl https://adblock-compiler-ui.pages.dev/api
```

**View the full OpenAPI specification:** [`openapi.yaml`](openapi.yaml)

## <a name="docker-deployment"></a> Docker Deployment

Deploy the compiler and web UI using Docker containers:

```bash
# Clone and start
git clone https://github.com/jaypatrick/adblock-compiler.git
cd adblock-compiler
docker compose up -d
```

Access the web UI at http://localhost:8787

### Features

- 🐳 Multi-stage Docker build with Deno 2.6.7+ and Node.js 20
- 🚀 Cloudflare Worker runtime with Wrangler dev server
- 🌐 Full Web UI and REST API
- 📊 Built-in health checks and monitoring
- 🔧 direnv integration for environment management
- 🔒 Security: non-root user, minimal attack surface

📚 **[Complete Docker Guide](docs/deployment/docker.md)** - Production setups, Kubernetes deployment, CLI mode, and troubleshooting

## <a name="transformations"></a> Transformations

Here is the full list of transformations that are available:

1. `ConvertToAscii`
1. `RemoveComments`
1. `Compress`
1. `RemoveModifiers`
1. `Validate`
1. `ValidateAllowIp`
1. `Deduplicate`
1. `InvertAllow`
1. `RemoveEmptyLines`
1. `TrimLines`
1. `InsertFinalNewLine`

Please note that these transformations are always applied in the order specified here.

### <a name="remove-comments"></a> RemoveComments

This is a very simple transformation that simply removes comments (e.g. all rules starting with `!` or `#`).

### <a name="compress"></a> Compress

> [!IMPORTANT]
> This transformation converts `hosts` lists into `adblock` lists.

Here's what it does:

1. It converts all rules to adblock-style rules. For instance, `0.0.0.0 example.org` will be converted to `||example.org^`.
2. It discards the rules that are now redundant because of other existing rules. For instance, `||example.org` blocks `example.org` and all it's subdomains, therefore additional rules for the subdomains are now redundant.

### <a name="remove-modifiers"></a> RemoveModifiers

By default, [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) will ignore rules with unsupported modifiers, and all of the modifiers listed here are unsupported. However, the rules with these modifiers are likely to be okay for DNS-level blocking, that's why you might want to remove them when importing rules from a traditional filter list.

Here is the list of modifiers that will be removed:

- `$third-party` and `$3p` modifiers
- `$document` and `$doc` modifiers
- `$all` modifier
- `$popup` modifier
- `$network` modifier

> [!CAUTION]
> Blindly removing `$third-party` from traditional ad blocking rules leads to lots of false-positives.
>
>> This is exactly why there is an option to exclude rules - you may need to use it.

### <a name="validate"></a> Validate

This transformation is really crucial if you're using a filter list for a traditional ad blocker as a source.

It removes dangerous or incompatible rules from the list.

So here's what it does:

- Discards domain-specific rules (e.g. `||example.org^$domain=example.com`). You don't want to have domain-specific rules working globally.
- Discards rules with unsupported modifiers. [Click here](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#-adblock-style-syntax) to learn more about which modifiers are supported.
- Discards rules that are too short.
- Discards IP addresses. If you need to keep IP addresses, use [ValidateAllowIp](#validate-allow-ip) instead.
- Removes rules that block entire top-level domains (TLDs) like `||*.org^`, unless they have specific limiting modifiers such as `$denyallow`, `$badfilter`, or `$client`.
  Examples:
  - `||*.org^` - this rule will be removed
  - `||*.org^$denyallow=example.com` - this rule will be kept because it has a limiting modifier

If there are comments preceding the invalid rule, they will be removed as well.

### <a name="validate-allow-ip"></a> ValidateAllowIp

This transformation exactly repeats the behavior of [Validate](#validate), but leaves the IP addresses in the lists.

### <a name="deduplicate"></a> Deduplicate

This transformation simply removes the duplicates from the specified source.

There are two important notes about this transformation:

1. It keeps the original rules order.
2. It ignores comments. However, if the comments precede the rule that is being removed, the comments will be also removed.

For instance:

```
! rule1 comment 1
rule1
! rule1 comment 2
rule1
```

Here's what will be left after the transformation:

```
! rule1 comment 2
rule1
```

### <a name="invertallow"></a> InvertAllow

This transformation converts blocking rules to "allow" rules. Note, that it does nothing to /etc/hosts rules (unless they were previously converted to adblock-style syntax by a different transformation, for example [Compress](#compress)).

There are two important notes about this transformation:

1. It keeps the original rules order.
2. It ignores comments, empty lines, /etc/hosts rules and existing "allow" rules.

**Example:**

Original list:

```
! comment 1
rule1

# comment 2
192.168.11.11   test.local
@@rule2
```

Here's what we will have after applying this transformation:

```
! comment 1
@@rule1

# comment 2
192.168.11.11   test.local
@@rule2
```

### <a name="removeemptylines"></a> RemoveEmptyLines

This is a very simple transformation that removes empty lines.

**Example:**

Original list:

```
rule1

rule2


rule3
```

Here's what we will have after applying this transformation:

```
rule1
rule2
rule3
```

### <a name="trimlines"></a> TrimLines

This is a very simple transformation that removes leading and trailing spaces/tabs.

**Example:**

Original list:

```
rule1
   rule2
rule3
		rule4
```

Here's what we will have after applying this transformation:

```
rule1
rule2
rule3
rule4
```

### <a name="insertfinalnewline"></a> InsertFinalNewLine

This is a very simple transformation that inserts a final newline.

**Example:**

Original list:

```
rule1
rule2
rule3
```

Here's what we will have after applying this transformation:

```
rule1
rule2
rule3
```

`RemoveEmptyLines` doesn't delete this empty row due to the execution order.

### <a name="convert-to-ascii"></a> ConvertToAscii

This transformation converts all non-ASCII characters to their ASCII equivalents. It is always performed first.

**Example:**

Original list:

```
||*.рус^
||*.कॉम^
||*.セール^
```

Here's what we will have after applying this transformation:

```
||*.xn--p1acf^
||*.xn--11b4c3d^
||*.xn--1qqw23a^
```

## Extensibility

AdBlock Compiler is designed to be fully extensible. You can:

- **Create custom transformations** - Extend `SyncTransformation` or `AsyncTransformation` to add custom rule processing
- **Implement custom fetchers** - Support any protocol or data source by implementing `IContentFetcher`
- **Build custom compilers** - Extend `FilterCompiler` or `WorkerCompiler` for specialized use cases
- **Integrate custom loggers** - Implement `ILogger` to integrate with your logging system
- **Add event handlers** - Implement `ICompilerEvents` for custom monitoring and tracking

**Example: Custom Transformation**

```typescript path=null start=null
import { SyncTransformation, TransformationRegistry, TransformationType } from '@jk-com/adblock-compiler';

class RemoveSocialMediaTransformation extends SyncTransformation {
    public readonly type = 'RemoveSocialMedia' as TransformationType;
    public readonly name = 'Remove Social Media';

    private socialDomains = ['facebook.com', 'twitter.com', 'instagram.com'];

    public executeSync(rules: string[]): string[] {
        return rules.filter((rule) => {
            return !this.socialDomains.some((domain) => rule.includes(domain));
        });
    }
}

// Register and use
const registry = new TransformationRegistry();
registry.register('RemoveSocialMedia' as any, new RemoveSocialMediaTransformation());

const compiler = new FilterCompiler({ transformationRegistry: registry });
```

**Example: Custom Fetcher**

```typescript path=null start=null
import { CompositeFetcher, HttpFetcher, IContentFetcher } from '@jk-com/adblock-compiler';

class DatabaseFetcher implements IContentFetcher {
    async canHandle(source: string): Promise<boolean> {
        return source.startsWith('db://');
    }

    async fetchContent(source: string): Promise<string> {
        const [table, column] = source.replace('db://', '').split('/');
        // Your database query implementation
        return await queryDatabase(table, column);
    }
}

// Use with CompositeFetcher
const fetcher = new CompositeFetcher([
    new DatabaseFetcher(),
    new HttpFetcher(),
]);
```

📚 **For complete extensibility examples and patterns, see [docs/development/EXTENSIBILITY.md](docs/development/EXTENSIBILITY.md)**

Topics covered:

- Custom transformations (sync and async)
- Custom content fetchers
- Custom event handlers
- Custom loggers
- Extending the compiler
- Plugin systems
- Best practices

### Structured Logging

The compiler supports structured JSON logging for production observability and log aggregation systems (CloudWatch, Datadog, Splunk, etc.).

#### Basic Usage

```typescript
import { createLogger, LogLevel } from '@jk-com/adblock-compiler';

// Create a structured logger
const logger = createLogger({
    structured: true,
    level: LogLevel.Info,
});

// Log messages with context
logger.info('Processing started', { itemCount: 42 });
// Output: {"timestamp":"2024-01-01T12:00:00.000Z","level":"info","message":"Processing started","context":{"itemCount":42}}
```

#### Advanced Features

```typescript
import { LogLevel, StructuredLogger } from '@jk-com/adblock-compiler';

// Create logger with correlation and trace IDs
const logger = new StructuredLogger({
    level: LogLevel.Info,
    prefix: 'compiler',
    correlationId: 'req-abc-123',
    traceId: 'trace-xyz-456',
});

// Log with additional context
logger.info('Compilation started', {
    sources: 5,
    transformations: 3,
});

// Create child logger (inherits correlation/trace IDs)
const sourceLogger = logger.child('source-1');
sourceLogger.info('Downloading filter list', { url: 'https://example.com/list.txt' });

// Update correlation ID dynamically
logger.setCorrelationId('req-def-789');

// All log levels supported
logger.trace('Detailed trace information', { step: 1 });
logger.debug('Debug information', { cacheHit: true });
logger.warn('Warning message', { retryCount: 3 });
logger.error('Error occurred', { errorCode: 'ERR_NETWORK' });
logger.success('Operation completed', { duration: 1234 });
```

#### Structured Log Format

```json
{
    "timestamp": "2024-01-01T12:00:00.000Z",
    "level": "info",
    "message": "Processing started",
    "prefix": "compiler:source-1",
    "context": {
        "sources": 5,
        "transformations": 3
    },
    "correlationId": "req-abc-123",
    "traceId": "trace-xyz-456"
}
```

#### Configuration Options

- `structured: boolean` - Enable JSON output mode (default: `false`)
- `level: LogLevel` - Minimum log level to output
- `prefix: string` - Logger name/prefix (included in output)
- `module: string` - Module name for this logger instance (enables module-specific log levels)
- `moduleOverrides: ModuleOverrides` - Per-module log level overrides
- `correlationId: string` - Correlation ID for grouping related logs
- `traceId: string` - Trace ID for distributed tracing
- `timestamps: boolean` - Not used in structured mode (always ISO 8601)
- `colors: boolean` - Not used in structured mode (JSON doesn't need colors)

#### Per-Module Log Levels

Control log verbosity for specific modules independently of the global log level. Perfect for debugging specific components without flooding logs with verbose output from all modules.

**Basic Usage:**

```typescript
import { createLogger, LogLevel } from '@jk-com/adblock-compiler';

// Create logger with module-specific overrides
const logger = createLogger({
    level: LogLevel.Info, // Default level
    moduleOverrides: {
        'compiler': LogLevel.Debug, // Show debug logs for compiler
        'downloader': LogLevel.Trace, // Show all logs for downloader
    },
});

// Create module-specific loggers
const compilerLogger = createLogger({
    level: LogLevel.Info,
    module: 'compiler',
    prefix: 'Compiler',
    moduleOverrides: logger.getModuleOverrides(),
});

compilerLogger.debug('This will show'); // Module override is Debug
compilerLogger.info('This will also show');
```

**Environment Variable Configuration:**

```bash
# Set default level and module overrides via environment variables
export LOG_LEVEL=info
export LOG_MODULE_OVERRIDES=compiler:debug,downloader:trace

# Create logger from environment
import { createLoggerFromEnv } from '@jk-com/adblock-compiler';

const logger = createLoggerFromEnv({ prefix: 'myapp' });
```

**Real-World Example:**

```typescript
// Production setup: minimal logging by default, detailed for specific modules
const logger = createLogger({
    level: LogLevel.Warn, // Only warnings and errors by default
    moduleOverrides: {
        'compiler': LogLevel.Info, // Show compilation progress
        'downloader': LogLevel.Debug, // Debug network issues
    },
});

const compilerLogger = createLogger({
    level: LogLevel.Warn,
    module: 'compiler',
    prefix: 'FilterCompiler',
    moduleOverrides: {
        'compiler': LogLevel.Info,
        'downloader': LogLevel.Debug,
    },
});

const downloaderLogger = createLogger({
    level: LogLevel.Warn,
    module: 'downloader',
    prefix: 'FilterDownloader',
    moduleOverrides: {
        'compiler': LogLevel.Info,
        'downloader': LogLevel.Debug,
    },
});

const transformLogger = createLogger({
    level: LogLevel.Warn,
    module: 'transformation',
    prefix: 'Transformation',
    moduleOverrides: {
        'compiler': LogLevel.Info,
        'downloader': LogLevel.Debug,
    },
});

// Only logs matching their module's override level
compilerLogger.info('Starting compilation'); // Shows (override: Info)
downloaderLogger.debug('Checking cache'); // Shows (override: Debug)
transformLogger.info('Processing rules'); // Hidden (default: Warn)
```

**Child Loggers Inherit Module Configuration:**

```typescript
const parentLogger = createLogger({
    level: LogLevel.Info,
    module: 'compiler',
    moduleOverrides: { 'compiler': LogLevel.Debug },
});

// Child inherits module and overrides
const childLogger = parentLogger.child('SourceCompiler');
childLogger.debug('This shows'); // Inherits compiler:Debug override
```

See `examples/module-log-levels-example.ts` for more examples.

#### Backward Compatibility

The standard `Logger` class remains unchanged and continues to output human-readable text:

```typescript
import { createLogger, LogLevel } from '@jk-com/adblock-compiler';

// Standard text logger (default)
const logger = createLogger({
    level: LogLevel.Info,
    timestamps: true,
    colors: true,
});

logger.info('Processing started');
// Output: 2024-01-01T12:00:00.000Z INFO Processing started
```

### <a name="opentelemetry"></a> OpenTelemetry Integration

The adblock-compiler supports **OpenTelemetry** for distributed tracing, enabling integration with major observability platforms like Datadog, Honeycomb, Jaeger, and others.

#### Features

- **Standard OpenTelemetry API**: Compatible with all platforms supporting OTLP
- **Automatic instrumentation**: Compilation operations are automatically traced
- **Distributed tracing**: Context propagation across services
- **Rich ecosystem**: Works with standard OpenTelemetry exporters and collectors

#### Basic Usage

```typescript
import { createOpenTelemetryExporter, SourceCompiler } from '@jk-com/adblock-compiler';

// Create an OpenTelemetry diagnostics collector
const diagnostics = createOpenTelemetryExporter({
    serviceName: 'adblock-compiler',
    enableConsoleLogging: false, // Optional: log to console for debugging
});

// Use with SourceCompiler
const compiler = new SourceCompiler({ diagnostics });

// All compilation operations are now traced
const rules = await compiler.compile({
    name: 'Example List',
    source: 'https://example.com/filters.txt',
});
```

#### Running with Deno

Deno 2.2+ has built-in OpenTelemetry support. Enable it with environment variables:

```bash
# Enable OpenTelemetry in Deno
OTEL_DENO=true deno run --unstable-otel --allow-net your-script.ts

# Export to a custom OTLP endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_DENO=true \
deno run --unstable-otel --allow-net your-script.ts
```

#### Manual Span Creation

You can also create custom spans for fine-grained tracing:

```typescript
import { trace } from '@opentelemetry/api';
import { createOpenTelemetryExporter, WorkerCompiler } from '@jk-com/adblock-compiler';

const tracer = trace.getTracer('my-service', '1.0.0');

await tracer.startActiveSpan('compile-filters', async (span) => {
    try {
        span.setAttribute('config.name', 'My Config');
        span.setAttribute('sources.count', 3);

        const diagnostics = createOpenTelemetryExporter();
        const compiler = new WorkerCompiler({ diagnostics });

        const result = await compiler.compile(config);

        span.setAttribute('output.rules.count', result.length);
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
    } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
    } finally {
        span.end();
    }
});
```

#### Configuration Options

```typescript
interface OpenTelemetryExporterOptions {
    /** Service name for telemetry (default: 'adblock-compiler') */
    serviceName?: string;

    /** Service version (default: package version) */
    serviceVersion?: string;

    /** Enable console logging for debugging (default: false) */
    enableConsoleLogging?: boolean;

    /** Custom tracer instance (optional) */
    tracer?: Tracer;
}
```

#### Viewing Traces

Set up a local OpenTelemetry collector with Grafana LGTM stack:

```bash
# Run with Docker Compose (example)
docker-compose -f docker-compose.otel.yml up -d

# Access Grafana at http://localhost:3000
# Default credentials: admin/admin
```

Traces include:

- **Operation spans**: Compilation, downloads, transformations
- **Performance metrics**: Duration, rule counts, sizes
- **Error tracking**: Exceptions with stack traces
- **Cache events**: Hit/miss/write operations
- **Network events**: HTTP requests with status codes

📚 **[OpenTelemetry Example](examples/opentelemetry-example.ts)** - Complete example with manual instrumentation

### <a name="error-reporting"></a> Centralized Error Reporting

The adblock-compiler provides centralized error reporting for production monitoring, enabling you to track errors across all instances and integrate with services like Sentry or Cloudflare Analytics Engine.

#### Features

- **Multiple Backends**: Support for Sentry, Cloudflare Analytics Engine, and console logging
- **Composite Reporting**: Send errors to multiple services simultaneously
- **Context Enrichment**: Attach request metadata (IP, path, request ID) to error reports
- **Cloudflare Workers Integration**: Native support for edge runtime error tracking

#### Basic Usage

```typescript
import { CloudflareErrorReporter, CompositeErrorReporter, ConsoleErrorReporter, SentryErrorReporter } from '@jk-com/adblock-compiler';

// Console reporter (development)
const consoleReporter = new ConsoleErrorReporter(true /* verbose */);
consoleReporter.report(new Error('Test error'), {
    requestId: 'req-123',
    path: '/api/compile',
});

// Cloudflare Analytics Engine reporter (production)
const analyticsReporter = new CloudflareErrorReporter(env.ANALYTICS_ENGINE, {
    environment: 'production',
    release: '1.0.0',
});

// Sentry reporter (cloud-based)
const sentryReporter = new SentryErrorReporter('https://key@org.ingest.sentry.io/project', {
    environment: 'production',
    release: '1.0.0',
});

// Composite reporter (send to multiple services)
const reporter = new CompositeErrorReporter([
    consoleReporter,
    analyticsReporter,
    sentryReporter,
]);

// Report errors with context
try {
    await compileFilters(config);
} catch (error) {
    reporter.reportSync(error, {
        requestId: 'req-456',
        ip: '192.168.1.1',
        path: '/api/compile',
        configName: config.name,
    });
}
```

#### Cloudflare Worker Integration

The worker automatically configures error reporting based on environment variables:

```typescript
// In your Cloudflare Worker
import { createWorkerErrorReporter } from '@jk-com/adblock-compiler';

export default {
    async fetch(request: Request, env: Env) {
        const errorReporter = createWorkerErrorReporter(env);

        try {
            return await handleRequest(request, env);
        } catch (error) {
            // Automatically reports to configured services
            errorReporter.reportSync(error, {
                requestId: crypto.randomUUID(),
                path: new URL(request.url).pathname,
                ip: request.headers.get('CF-Connecting-IP') || 'unknown',
            });
            return new Response('Internal Server Error', { status: 500 });
        }
    },
};
```

#### Environment Configuration

Configure error reporting via environment variables in `wrangler.toml`:

```toml
[vars]
# Error reporter type: 'console', 'cloudflare', 'sentry', 'composite', or 'none'
ERROR_REPORTER_TYPE = "composite"

# Sentry configuration (optional)
SENTRY_DSN = "https://your-key@org.ingest.sentry.io/project-id"

# Verbose console logging
ERROR_REPORTER_VERBOSE = "true"
```

#### Available Reporters

1. **ConsoleErrorReporter** - Logs errors to console with formatted output
2. **CloudflareErrorReporter** - Reports to Cloudflare Analytics Engine (no external dependencies)
3. **SentryErrorReporter** - Reports to Sentry with full stack traces and context
4. **CompositeErrorReporter** - Reports to multiple services simultaneously
5. **NoOpErrorReporter** - Disabled reporter for testing

#### Error Context

All reporters support enriching errors with contextual data:

```typescript
interface ErrorContext {
    requestId?: string; // Unique request identifier
    ip?: string; // Client IP address
    path?: string; // Request path
    method?: string; // HTTP method
    [key: string]: unknown; // Any additional context
}
```

## <a name="development"></a> Development

### Prerequisites

- [Deno](https://deno.land/) 2.0 or later

### Available tasks

> **Note:** Always use `deno task test` instead of `deno test` directly. The tests require specific permissions (`--allow-read`, `--allow-write`, `--allow-net`, `--allow-env`) that are configured in the task.

```bash
# Run in development mode with watch
deno task dev

# Run the compiler
deno task compile

# Build standalone executable
deno task build

# Run tests (all tests co-located with source files in src/)
deno task test

# Run tests in watch mode
deno task test:watch

# Run tests with coverage
deno task test:coverage

# Run specific test file (with required permissions)
deno test --allow-read --allow-write --allow-net --allow-env src/cli/ArgumentParser.test.ts

# Lint code
deno task lint

# Format code
deno task fmt

# Check formatting
deno task fmt:check

# Type check
deno task check

# Cache dependencies
deno task cache
```

### Angular Frontend Development

The primary frontend is an Angular 21 SPA in `frontend/`. It uses:

- **Angular 21** with zoneless change detection, signals, `rxResource`, `linkedSignal`
- **Angular Material 3** for UI components and theming
- **SSR** via `@angular/ssr` on Cloudflare Workers
- **Vitest** for unit testing

```bash
# Development server (http://localhost:4200)
pnpm --filter adblock-compiler-frontend run start

# Production build
pnpm --filter adblock-compiler-frontend run build

# Run tests
pnpm --filter adblock-compiler-frontend run test
```

For full-stack local development:

```bash
deno task wrangler:dev        # Worker on :8787
pnpm --filter adblock-compiler-frontend run start  # Angular on :4200 → proxies /api to :8787
```

**Pages:**

- Dashboard — live metrics from `/api/metrics` and `/api/health`
- Compiler — filter list compilation with JSON and SSE streaming modes, drag-and-drop
- Performance — real-time compilation latency and throughput
- Validation — AGTree-powered filter rule validation
- API Docs — HTTP endpoint reference
- Admin — KV/R2/D1 storage management (requires admin key)

### Legacy Frontend (Tailwind CSS / Vite)

The `public/` directory contains the original vanilla HTML frontend. It will be removed once the Angular migration is complete.

📄 **[SPA Benefits Analysis](docs/frontend/SPA_BENEFITS.md)** - Analysis of SPA benefits for this application

### Project structure

```
src/
├── cli/           # Command-line interface (with *.test.ts files)
├── compiler/      # Core compilation logic (with *.test.ts files)
├── configuration/ # Configuration validation (with *.test.ts files)
├── downloader/    # Filter list downloading (with *.test.ts files)
├── platform/      # Platform abstraction layer (with *.test.ts files)
├── transformations/ # Rule transformations (with *.test.ts files)
├── types/         # TypeScript type definitions
├── utils/         # Utility functions (with *.test.ts files)
├── index.ts       # Main library exports
└── mod.ts         # Deno module exports

Note: All tests are co-located with source files (*.test.ts next to *.ts)

worker/            # Cloudflare Worker implementation (production-ready)
├── worker.ts      # Main worker with API endpoints
└── html.ts        # Fallback HTML templates

frontend/          # Angular 21 SPA (replaces public/)
├── src/app/       # Components, services, guards, interceptors
├── src/index.html # Root HTML with Cloudflare analytics
└── angular.json   # Build configuration (SSR + browser)

public/            # Legacy static web UI (to be removed)

examples/
└── cloudflare-worker/  # Legacy deployment reference
```

### Publishing to JSR

```bash
# Dry run to verify everything is correct
deno publish --dry-run

# Publish to JSR
deno publish
```

## <a name="platform-support"></a> Platform Support

The adblock-compiler includes a **platform abstraction layer** that enables running in any JavaScript runtime, including:

- **Deno** (default)
- **Node.js** (via npm compatibility)
- **Cloudflare Workers**
- **Deno Deploy**
- **Vercel Edge Functions**
- **AWS Lambda@Edge**
- **Web Workers** (browser)
- **Browsers** (with server-side proxy for CORS)

The platform layer is designed to be **pluggable** - you can easily add or remove fetchers without modifying the core compiler.

### Core Concepts

The platform layer provides:

- **`WorkerCompiler`** - A platform-agnostic compiler that works without file system access
- **`PreFetchedContentFetcher`** - Supply source content directly instead of fetching from URLs
- **`HttpFetcher`** - Standard Fetch API-based content fetching (works everywhere)
- **`CompositeFetcher`** - Chain multiple fetchers together (pre-fetched takes priority)
- **`PlatformDownloader`** - Handles `!#include` directives and conditional compilation

### <a name="edge-runtimes"></a> Edge Runtimes (Generic)

The `WorkerCompiler` works in any edge runtime or serverless environment that supports the standard Fetch API. The pattern is the same across all platforms:

1. **Pre-fetch source content** on the server (avoids CORS and network restrictions)
2. **Pass content to the compiler** via `preFetchedContent`
3. **Configure and compile** using the standard API

```typescript
import { CompositeFetcher, HttpFetcher, type IConfiguration, PreFetchedContentFetcher, WorkerCompiler } from '@jk-com/adblock-compiler';

// Option 1: Use pre-fetched content (recommended for edge)
async function compileWithPreFetched(sourceUrls: string[]): Promise<string[]> {
    // Fetch all sources
    const preFetched = new Map<string, string>();
    for (const url of sourceUrls) {
        const response = await fetch(url);
        preFetched.set(url, await response.text());
    }

    const compiler = new WorkerCompiler({ preFetchedContent: preFetched });
    const config: IConfiguration = {
        name: 'My Filter List',
        sources: sourceUrls.map((url) => ({ source: url })),
        transformations: ['Deduplicate', 'RemoveEmptyLines'],
    };

    return compiler.compile(config);
}

// Option 2: Build a custom fetcher chain
function createCustomCompiler() {
    const preFetched = new PreFetchedContentFetcher(
        new Map([
            ['local://rules', 'my-custom-rule'],
        ]),
    );
    const http = new HttpFetcher();
    const composite = new CompositeFetcher([preFetched, http]);

    return new WorkerCompiler({ customFetcher: composite });
}
```

### <a name="cloudflare-workers"></a> Cloudflare Workers

The compiler runs natively in Cloudflare Workers. A production-ready implementation is available at the repository root in the `worker/` directory with a comprehensive web UI in `public/`.

**Quick Start**:

```bash
# Install dependencies
npm install

# Run locally
deno task wrangler:dev

# Deploy to Cloudflare
deno task wrangler:deploy
```

**Deployment**: A `wrangler.toml` configuration file is provided in the repository root for easy deployment via Cloudflare's Git integration or using `wrangler deploy`.

⚠️ **Important**: This project uses `wrangler deploy` for Cloudflare Workers, **NOT** `deno deploy`. While this is a Deno-based project, it deploys to Cloudflare Workers runtime. See the [Cloudflare Pages Deployment Guide](docs/deployment/cloudflare-pages.md) for Pages-specific configuration.

The production worker (`worker/worker.ts`) includes:

- **Interactive Web UI** at `/` (see `public/index.html`)
- **API Testing Interface** at `/test.html`
- **JSON API** at `POST /compile`
- **Streaming API** at `POST /compile/stream` with Server-Sent Events
- **Batch API** at `POST /compile/batch`
- **Async API** at `POST /compile/async` for queue-based processing
- **Batch Async API** at `POST /compile/batch/async` for queue-based batch processing
- **Metrics** at `GET /metrics`
- Pre-fetched content support to bypass CORS restrictions
- Caching with KV storage
- Rate limiting
- Request body size limits (DoS protection)
- Request deduplication
- Cloudflare Queue integration for async compilation

**Request Body Size Limits**:

The worker validates request body sizes to prevent denial-of-service attacks via large payloads. The default limit is 1MB.

```bash
# Configure in environment (megabytes)
MAX_REQUEST_BODY_MB="2"  # Set to 2MB limit
```

Requests exceeding the limit receive a `413 Payload Too Large` response:

```json
{
    "error": "Request body size (2097152 bytes) exceeds maximum allowed size (1048576 bytes)"
}
```

**Cloudflare Queue Support**:

The worker supports asynchronous compilation through Cloudflare Queues, allowing you to:

- Offload long-running compilations to background processing
- Process batch operations without blocking
- Pre-warm the cache with popular filter lists
- Bypass rate limits for queued requests

📚 **[Queue Support Documentation](docs/cloudflare/QUEUE_SUPPORT.md)** - Complete guide for using async compilation

**Tail Worker for Observability**:

A Cloudflare Tail Worker is included for advanced logging and monitoring. The tail worker captures logs, exceptions, and events from the main worker in real-time.

```bash
# Deploy the tail worker
deno task wrangler:tail:deploy

# View tail worker logs
deno task wrangler:tail:logs
```

Features:

- **Log Persistence**: Store logs in Cloudflare KV
- **Error Forwarding**: Send critical errors to webhooks (Slack, Discord, etc.)
- **Structured Events**: Format logs for external systems
- **Automatic Cleanup**: Configurable log retention

📚 **[Tail Worker Documentation](worker/TAIL_WORKER.md)** - Complete guide for setup and configuration

```typescript
import { type IConfiguration, WorkerCompiler } from '@jk-com/adblock-compiler';

export default {
    async fetch(request: Request): Promise<Response> {
        // Pre-fetch content on the server where there are no CORS restrictions
        const sourceContent = await fetch('https://example.com/filters.txt').then((r) => r.text());

        const compiler = new WorkerCompiler({
            preFetchedContent: {
                'https://example.com/filters.txt': sourceContent,
            },
        });

        const configuration: IConfiguration = {
            name: 'My Filter List',
            sources: [
                { source: 'https://example.com/filters.txt' },
            ],
            transformations: ['Deduplicate', 'RemoveEmptyLines'],
        };

        const result = await compiler.compile(configuration);

        return new Response(result.join('\n'), {
            headers: { 'Content-Type': 'text/plain' },
        });
    },
};
```

**Using the Web UI**:

1. Visit the root URL of your deployed worker
2. Use **Simple Mode** for quick filter list compilation
3. Use **Advanced Mode** for JSON configuration
4. Use **Test Page** to test API endpoints directly
5. View real-time progress with streaming compilation

### <a name="web-workers"></a> Web Workers

Use `WorkerCompiler` in Web Workers for background compilation:

```typescript
// worker.ts
import { type IConfiguration, WorkerCompiler } from '@jk-com/adblock-compiler';

self.onmessage = async (event) => {
    const { configuration, preFetchedContent } = event.data;

    const compiler = new WorkerCompiler({
        preFetchedContent,
        events: {
            onProgress: (progress) => {
                self.postMessage({ type: 'progress', progress });
            },
        },
    });

    const result = await compiler.compile(configuration);
    self.postMessage({ type: 'complete', rules: result });
};
```

### <a name="browser-usage"></a> Browser Usage

For browser environments, pre-fetch all source content server-side to avoid CORS issues:

```typescript
import { type IConfiguration, WorkerCompiler } from '@jk-com/adblock-compiler';

// Fetch sources through your server proxy to avoid CORS
async function fetchSources(urls: string[]): Promise<Map<string, string>> {
    const content = new Map<string, string>();
    for (const url of urls) {
        const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        content.set(url, await response.text());
    }
    return content;
}

// Usage
const sources = await fetchSources([
    'https://example.com/filters.txt',
]);

const compiler = new WorkerCompiler({
    preFetchedContent: Object.fromEntries(sources),
});

const configuration: IConfiguration = {
    name: 'Browser Compiled List',
    sources: [
        { source: 'https://example.com/filters.txt' },
    ],
};

const rules = await compiler.compile(configuration);
```

### Platform API Reference

#### WorkerCompiler

```typescript
interface WorkerCompilerOptions {
    // Pre-fetched content (Map or Record)
    preFetchedContent?: Map<string, string> | Record<string, string>;

    // Custom content fetcher (for advanced use cases)
    customFetcher?: IContentFetcher;

    // Compilation event handlers
    events?: ICompilerEvents;

    // Logger instance
    logger?: ILogger;
}

class WorkerCompiler {
    constructor(options?: WorkerCompilerOptions);

    // Compile and return rules
    compile(configuration: IConfiguration): Promise<string[]>;

    // Compile with optional benchmarking metrics
    compileWithMetrics(
        configuration: IConfiguration,
        benchmark?: boolean,
    ): Promise<WorkerCompilationResult>;
}
```

#### IContentFetcher

Implement this interface to create custom content fetchers:

```typescript
interface IContentFetcher {
    canHandle(source: string): boolean;
    fetch(source: string): Promise<string>;
}
```

### <a name="custom-fetchers"></a> Custom Fetchers

You can implement custom fetchers for specialized use cases:

```typescript
import { CompositeFetcher, HttpFetcher, type IContentFetcher, WorkerCompiler } from '@jk-com/adblock-compiler';

// Example: Redis-backed cache fetcher
class RedisCacheFetcher implements IContentFetcher {
    constructor(private redis: RedisClient, private ttl: number) {}

    canHandle(source: string): boolean {
        return source.startsWith('http://') || source.startsWith('https://');
    }

    async fetch(source: string): Promise<string> {
        const cached = await this.redis.get(`filter:${source}`);
        if (cached) return cached;

        const response = await fetch(source);
        const content = await response.text();

        await this.redis.setex(`filter:${source}`, this.ttl, content);
        return content;
    }
}

// Example: S3/R2-backed storage fetcher
class S3StorageFetcher implements IContentFetcher {
    constructor(private bucket: S3Bucket) {}

    canHandle(source: string): boolean {
        return source.startsWith('s3://');
    }

    async fetch(source: string): Promise<string> {
        const key = source.replace('s3://', '');
        const object = await this.bucket.get(key);
        return object?.text() ?? '';
    }
}

// Chain fetchers together - first match wins
const compiler = new WorkerCompiler({
    customFetcher: new CompositeFetcher([
        new RedisCacheFetcher(redis, 3600),
        new S3StorageFetcher(bucket),
        new HttpFetcher(),
    ]),
});
```

This pluggable architecture allows you to:

- Add caching layers (Redis, KV, memory)
- Support custom protocols (S3, R2, database)
- Implement authentication/authorization
- Add logging and metrics
- Mock sources for testing

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork and clone the repository
2. Make your changes following our [commit message guidelines](CONTRIBUTING.md#commit-message-guidelines)
3. Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
4. Submit a pull request

**Automatic Version Bumping**: When your PR is merged, the version will be automatically bumped based on your commit messages. See [docs/reference/AUTO_VERSION_BUMP.md](docs/reference/AUTO_VERSION_BUMP.md) for details.

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
