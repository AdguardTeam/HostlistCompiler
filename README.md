# Hostlist Compiler

[![JSR](https://jsr.io/badges/@anthropic/hostlist-compiler)](https://jsr.io/@anthropic/hostlist-compiler)

This is a simple tool that makes it easier to compile a [hosts blocklist](https://adguard-dns.io/kb/general/dns-filtering-syntax/) compatible with AdGuard Home or any other AdGuard product with **DNS filtering**.

> **Note:** This is a Deno-native rewrite of the original [@adguard/hostlist-compiler](https://www.npmjs.com/package/@adguard/hostlist-compiler). It provides the same functionality with improved performance and no Node.js dependencies.

- [Installation](#installation)
- [Usage](#usage)
  - [Configuration](#configuration)
  - [Command-line](#command-line)
  - [API](#api)
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
- [Development](#development)
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
deno run --allow-read --allow-write --allow-net jsr:@anthropic/hostlist-compiler -c config.json -o output.txt
```

Or install globally:

```bash
deno install --allow-read --allow-write --allow-net -n hostlist-compiler jsr:@anthropic/hostlist-compiler/cli
```

### Build from source

Clone the repository and compile:

```bash
git clone https://github.com/anthropics/hostlist-compiler.git
cd hostlist-compiler
deno task build
```

This creates a standalone `hostlist-compiler` executable.

## <a name="usage"></a> Usage

**Quick hosts conversion**

Convert and compress a `/etc/hosts`-syntax blocklist to [AdGuard syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/).

```bash
hostlist-compiler -i hosts.txt -i hosts2.txt -o output.txt
```

**Build a configurable blocklist from multiple sources**

Prepare the list configuration (read more about that [below](#configuration)) and run the compiler:

```bash
hostlist-compiler -c configuration.json -o output.txt
```

**All command line options**

```
Usage: hostlist-compiler [options]

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
  hostlist-compiler -c config.json -o       compile a blocklist and write the
  output.txt                                output to output.txt
  hostlist-compiler -i                      compile a blocklist from the URL and
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
Usage: hostlist-compiler [options]

Options:
  --version      Show version number                                   [boolean]
  --config, -c   Path to the compiler configuration file               [string]
  --input, -i    URL or path to input file (can be repeated)            [array]
  --output, -o   Path to the output file                     [string] [required]
  --verbose, -v  Run with verbose logging                              [boolean]
  -h, --help     Show help                                             [boolean]

Examples:
  hostlist-compiler -c config.json -o       compile a blocklist and write the
  output.txt                                output to output.txt
```

### <a name="api"></a> API

Import from JSR:

```typescript
import { compile } from "jsr:@anthropic/hostlist-compiler";
```

Or add to your `deno.json`:

```json
{
  "imports": {
    "@anthropic/hostlist-compiler": "jsr:@anthropic/hostlist-compiler"
  }
}
```

#### TypeScript example:

```typescript
import { compile } from "@anthropic/hostlist-compiler";
import type { IConfiguration } from "@anthropic/hostlist-compiler";

const config: IConfiguration = {
  name: "Your Hostlist",
  sources: [
    {
      type: "adblock",
      source: "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
      transformations: ["RemoveComments", "Validate"],
    },
  ],
  transformations: ["Deduplicate"],
};

// Compile filters
const result = await compile(config);

// Write to file
await Deno.writeTextFile("your-hostlist.txt", result.join("\n"));
```

#### Using the FilterCompiler class directly:

```typescript
import { FilterCompiler, ConsoleLogger } from "@anthropic/hostlist-compiler";
import type { IConfiguration } from "@anthropic/hostlist-compiler";

const logger = new ConsoleLogger();
const compiler = new FilterCompiler(logger);

const config: IConfiguration = {
  name: "Your Hostlist",
  sources: [
    {
      source: "rules.txt",
      type: "hosts",
    },
  ],
  transformations: ["Compress", "Deduplicate"],
};

const result = await compiler.compile(config);
console.log(`Compiled ${result.length} rules`);
```

## <a name="transformations"></a> Transformations

Here is the full list of transformations that are available:

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

Please note that these transformations are are always applied in the order specified here.

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

## <a name="development"></a> Development

### Prerequisites

- [Deno](https://deno.land/) 2.0 or later

### Available tasks

```bash
# Run in development mode with watch
deno task dev

# Run the compiler
deno task compile

# Build standalone executable
deno task build

# Run tests
deno task test

# Run tests in watch mode
deno task test:watch

# Run tests with coverage
deno task test:coverage

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

### Project structure

```
src/
├── cli/           # Command-line interface
├── compiler/      # Core compilation logic
├── configuration/ # Configuration validation
├── downloader/    # Filter list downloading
├── platform/      # Platform abstraction layer (Workers, browsers)
├── transformations/ # Rule transformations
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
├── index.ts       # Main library exports
└── mod.ts         # Deno module exports

examples/
└── cloudflare-worker/  # Cloudflare Worker deployment example
```

### Publishing to JSR

```bash
# Dry run to verify everything is correct
deno publish --dry-run

# Publish to JSR
deno publish
```

## <a name="platform-support"></a> Platform Support

The hostlist-compiler includes a **platform abstraction layer** that enables running in any JavaScript runtime, including:

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
import {
    WorkerCompiler,
    HttpFetcher,
    PreFetchedContentFetcher,
    CompositeFetcher,
    type IConfiguration,
} from '@anthropic/hostlist-compiler';

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
        sources: sourceUrls.map(url => ({ source: url })),
        transformations: ['Deduplicate', 'RemoveEmptyLines'],
    };

    return compiler.compile(config);
}

// Option 2: Build a custom fetcher chain
function createCustomCompiler() {
    const preFetched = new PreFetchedContentFetcher(new Map([
        ['local://rules', 'my-custom-rule'],
    ]));
    const http = new HttpFetcher();
    const composite = new CompositeFetcher([preFetched, http]);

    return new WorkerCompiler({ customFetcher: composite });
}
```

### <a name="cloudflare-workers"></a> Cloudflare Workers

The compiler runs natively in Cloudflare Workers. See the [examples/cloudflare-worker](./examples/cloudflare-worker) directory for a complete example with SSE streaming.

```typescript
import { WorkerCompiler, type IConfiguration } from '@anthropic/hostlist-compiler';

export default {
    async fetch(request: Request): Promise<Response> {
        // Pre-fetch content on the server where there are no CORS restrictions
        const sourceContent = await fetch('https://example.com/filters.txt').then(r => r.text());

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

The Cloudflare Worker example includes:
- JSON API endpoint for programmatic access
- Server-Sent Events (SSE) streaming for real-time progress
- Pre-fetched content support to bypass CORS restrictions
- Benchmarking metrics support

### <a name="web-workers"></a> Web Workers

Use `WorkerCompiler` in Web Workers for background compilation:

```typescript
// worker.ts
import { WorkerCompiler, type IConfiguration } from '@anthropic/hostlist-compiler';

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
import { WorkerCompiler, type IConfiguration } from '@anthropic/hostlist-compiler';

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
        benchmark?: boolean
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
import {
    WorkerCompiler,
    CompositeFetcher,
    HttpFetcher,
    type IContentFetcher,
} from '@anthropic/hostlist-compiler';

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

## License

MIT
