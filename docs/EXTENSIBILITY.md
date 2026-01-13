# Extensibility Guide

AdBlock Compiler is designed to be fully extensible. This guide shows you how to extend the compiler with custom transformations, fetchers, and more.

## Table of Contents

- [Custom Transformations](#custom-transformations)
- [Custom Fetchers](#custom-fetchers)
- [Custom Event Handlers](#custom-event-handlers)
- [Custom Loggers](#custom-loggers)
- [Extending the Compiler](#extending-the-compiler)
- [Plugin System](#plugin-system)

## Custom Transformations

Create custom transformations by extending the base `Transformation` classes.

### Synchronous Transformation

For transformations that don't require async operations:

```typescript
import { ITransformationContext, SyncTransformation, TransformationType } from '@jk-com/adblock-compiler';

// Custom transformation to add custom headers
class AddHeaderTransformation extends SyncTransformation {
    public readonly type = 'AddHeader' as TransformationType;
    public readonly name = 'Add Header';

    private header: string;

    constructor(header: string, logger?) {
        super(logger);
        this.header = header;
    }

    public executeSync(rules: string[], context?: ITransformationContext): string[] {
        this.info(`Adding custom header: ${this.header}`);
        return [this.header, ...rules];
    }
}

// Usage
const transformation = new AddHeaderTransformation('! Custom Filter List v1.0.0');
const result = await transformation.execute(rules);
```

### Asynchronous Transformation

For transformations that fetch external data or perform async operations:

```typescript
import { AsyncTransformation, ITransformationContext, TransformationType } from '@jk-com/adblock-compiler';

// Custom transformation to fetch and merge remote rules
class MergeRemoteRulesTransformation extends AsyncTransformation {
    public readonly type = 'MergeRemoteRules' as TransformationType;
    public readonly name = 'Merge Remote Rules';

    private remoteUrl: string;

    constructor(remoteUrl: string, logger?) {
        super(logger);
        this.remoteUrl = remoteUrl;
    }

    public async execute(rules: string[], context?: ITransformationContext): Promise<string[]> {
        this.info(`Fetching remote rules from: ${this.remoteUrl}`);

        try {
            const response = await fetch(this.remoteUrl);
            const remoteRules = (await response.text()).split('\n');

            this.info(`Merged ${remoteRules.length} remote rules`);
            return [...rules, ...remoteRules];
        } catch (error) {
            this.error(`Failed to fetch remote rules: ${error.message}`);
            return rules; // Return original rules on failure
        }
    }
}

// Usage
const transformation = new MergeRemoteRulesTransformation('https://example.com/extra-rules.txt');
const result = await transformation.execute(rules);
```

### Advanced Transformation with Context

Access configuration and logger from context:

```typescript
import { ITransformationContext, RuleUtils, SyncTransformation, TransformationType } from '@jk-com/adblock-compiler';

class SmartDeduplicateTransformation extends SyncTransformation {
    public readonly type = 'SmartDeduplicate' as TransformationType;
    public readonly name = 'Smart Deduplicate';

    public executeSync(rules: string[], context?: ITransformationContext): string[] {
        const config = context?.configuration;
        const logger = context?.logger || this.logger;

        logger.info('Starting smart deduplication...');

        // Group rules by type
        const allowRules: string[] = [];
        const blockRules: string[] = [];
        const comments: string[] = [];

        for (const rule of rules) {
            if (RuleUtils.isComment(rule)) {
                comments.push(rule);
            } else if (RuleUtils.isAllowRule(rule)) {
                allowRules.push(rule);
            } else {
                blockRules.push(rule);
            }
        }

        // Deduplicate each group
        const dedupedAllowRules = [...new Set(allowRules)];
        const dedupedBlockRules = [...new Set(blockRules)];
        const dedupedComments = [...new Set(comments)];

        logger.info(`Deduplicated: ${allowRules.length} → ${dedupedAllowRules.length} allow rules`);
        logger.info(`Deduplicated: ${blockRules.length} → ${dedupedBlockRules.length} block rules`);

        // Combine: comments first, then allow rules, then block rules
        return [...dedupedComments, ...dedupedAllowRules, ...dedupedBlockRules];
    }
}
```

### Registering Custom Transformations

```typescript
import { FilterCompiler, TransformationPipeline, TransformationRegistry } from '@jk-com/adblock-compiler';

// Create custom registry
const registry = new TransformationRegistry();

// Register custom transformations
registry.register('AddHeader' as any, new AddHeaderTransformation('! My Header'));
registry.register('SmartDeduplicate' as any, new SmartDeduplicateTransformation());

// Use custom registry in pipeline
const pipeline = new TransformationPipeline(registry);

// Or use with FilterCompiler
const compiler = new FilterCompiler({ transformationRegistry: registry });
```

## Custom Fetchers

Implement custom content fetchers for different protocols or sources:

```typescript
import { IContentFetcher, PreFetchedContent } from '@jk-com/adblock-compiler';

// Custom fetcher for FTP protocol
class FtpFetcher implements IContentFetcher {
    async canHandle(source: string): Promise<boolean> {
        return source.startsWith('ftp://');
    }

    async fetchContent(source: string): Promise<string> {
        // Your FTP client implementation
        console.log(`Fetching from FTP: ${source}`);

        // Example: use a Deno FTP library
        // const client = new FTPClient();
        // await client.connect(host, port);
        // const content = await client.download(path);
        // await client.close();
        // return content;

        throw new Error('FTP fetcher not implemented');
    }
}

// Custom fetcher for database sources
class DatabaseFetcher implements IContentFetcher {
    private connectionString: string;

    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }

    async canHandle(source: string): Promise<boolean> {
        return source.startsWith('db://');
    }

    async fetchContent(source: string): Promise<string> {
        // Parse source: db://table/column
        const [table, column] = source.replace('db://', '').split('/');

        console.log(`Fetching from database: ${table}.${column}`);

        // Your database query implementation
        // const db = await connect(this.connectionString);
        // const result = await db.query(`SELECT ${column} FROM ${table}`);
        // return result.rows.map(row => row[column]).join('\n');

        throw new Error('Database fetcher not implemented');
    }
}

// Usage with CompositeFetcher
import { CompositeFetcher, HttpFetcher, PreFetchedContentFetcher } from '@jk-com/adblock-compiler';

const fetcher = new CompositeFetcher([
    new HttpFetcher(),
    new FtpFetcher(),
    new DatabaseFetcher('postgresql://localhost/filters'),
    new PreFetchedContentFetcher(preFetchedContent),
]);

// Use with PlatformDownloader
import { PlatformDownloader } from '@jk-com/adblock-compiler';

const downloader = new PlatformDownloader({ fetcher });
const content = await downloader.download('ftp://example.com/filters.txt');
```

## Custom Event Handlers

Implement custom event tracking and monitoring:

```typescript
import { CompilerEventEmitter, ICompilerEvents } from '@jk-com/adblock-compiler';

// Custom event handler that sends metrics to external service
class MetricsEventHandler implements ICompilerEvents {
    private metricsEndpoint: string;

    constructor(metricsEndpoint: string) {
        this.metricsEndpoint = metricsEndpoint;
    }

    onSourceStart(event: any): void {
        console.log(`[SOURCE START] ${event.source.name}`);
        this.sendMetric('source.start', {
            sourceName: event.source.name,
            timestamp: Date.now(),
        });
    }

    onSourceComplete(event: any): void {
        console.log(`[SOURCE COMPLETE] ${event.source.name}: ${event.ruleCount} rules`);
        this.sendMetric('source.complete', {
            sourceName: event.source.name,
            ruleCount: event.ruleCount,
            durationMs: event.durationMs,
        });
    }

    onSourceError(event: any): void {
        console.error(`[SOURCE ERROR] ${event.source.name}: ${event.error.message}`);
        this.sendMetric('source.error', {
            sourceName: event.source.name,
            error: event.error.message,
        });
    }

    onTransformationStart(event: any): void {
        console.log(`[TRANSFORM START] ${event.name}`);
    }

    onTransformationComplete(event: any): void {
        console.log(`[TRANSFORM COMPLETE] ${event.name}: ${event.inputCount} → ${event.outputCount}`);
        this.sendMetric('transformation.complete', {
            name: event.name,
            inputCount: event.inputCount,
            outputCount: event.outputCount,
            durationMs: event.durationMs,
        });
    }

    onTransformationError(event: any): void {
        console.error(`[TRANSFORM ERROR] ${event.name}: ${event.error.message}`);
    }

    onProgress(event: any): void {
        console.log(`[PROGRESS] ${event.phase}: ${event.current}/${event.total}`);
    }

    onCompilationComplete(event: any): void {
        console.log(`[COMPILATION COMPLETE] ${event.ruleCount} rules`);
        this.sendMetric('compilation.complete', {
            ruleCount: event.ruleCount,
            sourceCount: event.sourceCount,
            totalDurationMs: event.totalDurationMs,
        });
    }

    private async sendMetric(eventType: string, data: any): Promise<void> {
        try {
            await fetch(this.metricsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventType, data, timestamp: Date.now() }),
            });
        } catch (error) {
            console.error(`Failed to send metric: ${error.message}`);
        }
    }
}

// Usage
const metricsHandler = new MetricsEventHandler('https://metrics.example.com/events');

import { WorkerCompiler } from '@jk-com/adblock-compiler';
const compiler = new WorkerCompiler({
    events: metricsHandler,
});
```

## Custom Loggers

Implement custom logging to integrate with your logging system:

```typescript
import { ILogger } from '@jk-com/adblock-compiler';

// Custom logger that sends logs to external service
class RemoteLogger implements ILogger {
    private logEndpoint: string;
    private minLevel: 'debug' | 'info' | 'warn' | 'error';

    constructor(logEndpoint: string, minLevel = 'info') {
        this.logEndpoint = logEndpoint;
        this.minLevel = minLevel;
    }

    debug(message: string): void {
        if (this.shouldLog('debug')) {
            console.debug(`[DEBUG] ${message}`);
            this.send('debug', message);
        }
    }

    info(message: string): void {
        if (this.shouldLog('info')) {
            console.info(`[INFO] ${message}`);
            this.send('info', message);
        }
    }

    warn(message: string): void {
        if (this.shouldLog('warn')) {
            console.warn(`[WARN] ${message}`);
            this.send('warn', message);
        }
    }

    error(message: string): void {
        if (this.shouldLog('error')) {
            console.error(`[ERROR] ${message}`);
            this.send('error', message);
        }
    }

    private shouldLog(level: string): boolean {
        const levels = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.minLevel);
    }

    private async send(level: string, message: string): Promise<void> {
        try {
            await fetch(this.logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, message, timestamp: Date.now() }),
            });
        } catch (error) {
            // Don't log errors from logger itself
        }
    }
}

// Structured logger with context
class StructuredLogger implements ILogger {
    private context: Record<string, any>;

    constructor(context: Record<string, any> = {}) {
        this.context = context;
    }

    debug(message: string): void {
        this.log('DEBUG', message);
    }

    info(message: string): void {
        this.log('INFO', message);
    }

    warn(message: string): void {
        this.log('WARN', message);
    }

    error(message: string): void {
        this.log('ERROR', message);
    }

    private log(level: string, message: string): void {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...this.context,
        };
        console.log(JSON.stringify(logEntry));
    }

    withContext(additionalContext: Record<string, any>): StructuredLogger {
        return new StructuredLogger({ ...this.context, ...additionalContext });
    }
}

// Usage
const logger = new StructuredLogger({ service: 'adblock-compiler', version: '2.0.0' });
const compiler = new FilterCompiler({ logger });

// With additional context
const requestLogger = logger.withContext({ requestId: '123-456' });
const compiler2 = new FilterCompiler({ logger: requestLogger });
```

## Extending the Compiler

Create custom compilers for specific use cases:

```typescript
import { FilterCompiler, FilterCompilerOptions, IConfiguration, WorkerCompiler } from '@jk-com/adblock-compiler';

// Custom compiler that always applies specific transformations
class ProductionCompiler extends FilterCompiler {
    constructor(options?: FilterCompilerOptions) {
        super(options);
    }

    async compile(configuration: IConfiguration): Promise<string[]> {
        // Ensure production transformations are always applied
        const productionConfig = {
            ...configuration,
            transformations: [
                ...(configuration.transformations || []),
                'Validate', // Always validate
                'Deduplicate', // Always deduplicate
                'RemoveEmptyLines', // Always remove empty lines
            ],
        };

        return super.compile(productionConfig);
    }
}

// Custom compiler with automatic caching
class CachedCompiler extends FilterCompiler {
    private cache: Map<string, { rules: string[]; timestamp: number }>;
    private ttl: number;

    constructor(options?: FilterCompilerOptions, ttlMs: number = 3600000) {
        super(options);
        this.cache = new Map();
        this.ttl = ttlMs;
    }

    async compile(configuration: IConfiguration): Promise<string[]> {
        const cacheKey = JSON.stringify(configuration);
        const cached = this.cache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < this.ttl) {
            console.log('Cache HIT');
            return cached.rules;
        }

        console.log('Cache MISS');
        const rules = await super.compile(configuration);

        this.cache.set(cacheKey, {
            rules,
            timestamp: Date.now(),
        });

        return rules;
    }

    clearCache(): void {
        this.cache.clear();
    }
}

// Usage
const prodCompiler = new ProductionCompiler();
const cachedCompiler = new CachedCompiler(undefined, 3600000); // 1 hour TTL
```

## Plugin System

Create a plugin system for your application:

```typescript
import { FilterCompiler, IContentFetcher, ILogger, Transformation } from '@jk-com/adblock-compiler';

interface Plugin {
    name: string;
    version: string;
    initialize(compiler: FilterCompiler): void | Promise<void>;
}

// Analytics plugin
class AnalyticsPlugin implements Plugin {
    name = 'analytics';
    version = '1.0.0';

    initialize(compiler: FilterCompiler): void {
        console.log(`Initialized ${this.name} plugin v${this.version}`);
        // Register custom event handlers, transformations, etc.
    }
}

// Monitoring plugin
class MonitoringPlugin implements Plugin {
    name = 'monitoring';
    version = '1.0.0';
    private endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint;
    }

    async initialize(compiler: FilterCompiler): Promise<void> {
        console.log(`Initialized ${this.name} plugin v${this.version}`);
        // Set up monitoring hooks
    }
}

// Plugin manager
class PluginManager {
    private plugins: Plugin[] = [];

    register(plugin: Plugin): void {
        this.plugins.push(plugin);
    }

    async initializeAll(compiler: FilterCompiler): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.initialize(compiler);
        }
    }

    getPlugin(name: string): Plugin | undefined {
        return this.plugins.find((p) => p.name === name);
    }
}

// Usage
const pluginManager = new PluginManager();
pluginManager.register(new AnalyticsPlugin());
pluginManager.register(new MonitoringPlugin('https://metrics.example.com'));

const compiler = new FilterCompiler();
await pluginManager.initializeAll(compiler);
```

## Best Practices

### 1. Follow Interface Contracts

Always implement the required interfaces fully:

```typescript
// Good: Implements all required methods
class MyFetcher implements IContentFetcher {
    canHandle(source: string): Promise<boolean> {/* ... */}
    fetchContent(source: string): Promise<string> {/* ... */}
}

// Bad: Missing required methods
class BadFetcher implements IContentFetcher {
    canHandle(source: string): Promise<boolean> {/* ... */}
    // Missing fetchContent!
}
```

### 2. Handle Errors Gracefully

```typescript
class RobustTransformation extends SyncTransformation {
    public executeSync(rules: string[]): string[] {
        try {
            return rules.map((rule) => this.transformRule(rule));
        } catch (error) {
            this.error(`Transformation failed: ${error.message}`);
            return rules; // Return original rules on error
        }
    }

    private transformRule(rule: string): string {
        // Your transformation logic
        return rule;
    }
}
```

### 3. Use Logging

```typescript
class VerboseTransformation extends SyncTransformation {
    public executeSync(rules: string[]): string[] {
        this.info(`Starting transformation with ${rules.length} rules`);

        const result = this.doTransform(rules);

        this.info(`Transformation complete: ${rules.length} → ${result.length} rules`);
        return result;
    }
}
```

### 4. Document Your Extensions

````typescript
/**
 * Removes rules that match a specific pattern.
 * Useful for filtering out unwanted rules from upstream sources.
 *
 * @example
 * ```typescript
 * const transformation = new PatternFilterTransformation(/google\\.com/);
 * const filtered = await transformation.execute(rules);
 * ```
 */
class PatternFilterTransformation extends SyncTransformation {
    // Implementation...
}
````

### 5. Test Your Extensions

```typescript
import { assertEquals } from '@std/assert';

Deno.test('MyTransformation should remove duplicates', async () => {
    const transformation = new MyTransformation();
    const input = ['rule1', 'rule2', 'rule1'];
    const output = await transformation.execute(input);
    assertEquals(output, ['rule1', 'rule2']);
});
```

## Example: Complete Custom Extension

Here's a complete example combining multiple extensibility features:

```typescript
import { FilterCompiler, IContentFetcher, ILogger, SyncTransformation, TransformationRegistry, TransformationType } from '@jk-com/adblock-compiler';

// 1. Custom transformation
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

// 2. Custom fetcher
class S3Fetcher implements IContentFetcher {
    async canHandle(source: string): Promise<boolean> {
        return source.startsWith('s3://');
    }

    async fetchContent(source: string): Promise<string> {
        // Implement S3 fetching
        throw new Error('S3 fetcher not implemented');
    }
}

// 3. Custom logger
class FileLogger implements ILogger {
    private logFile: string;

    constructor(logFile: string) {
        this.logFile = logFile;
    }

    debug(message: string): void {
        this.write('DEBUG', message);
    }
    info(message: string): void {
        this.write('INFO', message);
    }
    warn(message: string): void {
        this.write('WARN', message);
    }
    error(message: string): void {
        this.write('ERROR', message);
    }

    private write(level: string, message: string): void {
        const entry = `[${new Date().toISOString()}] ${level}: ${message}\n`;
        Deno.writeTextFileSync(this.logFile, entry, { append: true });
    }
}

// 4. Put it all together
const logger = new FileLogger('./compiler.log');
const registry = new TransformationRegistry(logger);
registry.register('RemoveSocialMedia' as any, new RemoveSocialMediaTransformation(logger));

const compiler = new FilterCompiler({
    logger,
    transformationRegistry: registry,
});

// 5. Use it
const config = {
    name: 'My Custom Filter',
    sources: [{ source: 'https://example.com/filters.txt' }],
    transformations: ['RemoveSocialMedia', 'Deduplicate'],
};

const rules = await compiler.compile(config);
console.log(`Compiled ${rules.length} rules`);
```

## Resources

- **API Documentation**: [docs/api/README.md](../api/README.md)
- **Type Definitions**: See `src/types/index.ts`
- **Examples**: [examples/](../../examples/)
- **Source Code**: [src/](../../src/)

## Contributing

If you create useful extensions, consider contributing them back to the project!

Open a pull request at https://github.com/jaypatrick/adblock-compiler/pulls

---

**Questions?** Open an issue at https://github.com/jaypatrick/adblock-compiler/issues
