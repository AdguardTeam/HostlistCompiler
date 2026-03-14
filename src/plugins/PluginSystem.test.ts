/**
 * Tests for PluginSystem
 */

import { assertEquals, assertExists, assertRejects } from '@std/assert';
import {
    CacheBackendPlugin,
    ConflictResolverPlugin,
    DiffReporterPlugin,
    DownloaderPlugin,
    EventHookPlugin,
    FormatterPlugin,
    HeaderGeneratorPlugin,
    ParsedNode,
    ParserPlugin,
    Plugin,
    PluginContext,
    PluginManifest,
    PluginRegistry,
    TransformationPlugin,
    ValidationPlugin,
} from './PluginSystem.ts';
import { silentLogger } from '../utils/index.ts';

// Test data
const createTestManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    ...overrides,
});

const createTestTransformation = (overrides: Partial<TransformationPlugin> = {}): TransformationPlugin => ({
    type: 'test-transform',
    name: 'Test Transformation',
    execute: (rules) => rules.map((r) => r.toUpperCase()),
    ...overrides,
});

const createTestDownloader = (overrides: Partial<DownloaderPlugin> = {}): DownloaderPlugin => ({
    schemes: ['test://'],
    download: async (_source: string) => ['||example.com^'],
    ...overrides,
});

Deno.test('PluginRegistry - constructor', () => {
    const registry = new PluginRegistry();
    assertExists(registry);
});

Deno.test('PluginRegistry - register', async (t) => {
    await t.step('should register a plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
        };

        await registry.register(plugin);

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 1);
        assertEquals(plugins[0].manifest.name, 'test-plugin');
    });

    await t.step('should register plugin with transformations', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [createTestTransformation()],
        };

        await registry.register(plugin);

        const transformation = registry.getTransformation('test-transform');
        assertExists(transformation);
    });

    await t.step('should register plugin with downloaders', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [createTestDownloader()],
        };

        await registry.register(plugin);

        const downloader = registry.getDownloader('test://example.com');
        assertExists(downloader);
    });

    await t.step('should call plugin init function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let initCalled = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            init: () => {
                initCalled = true;
            },
        };

        await registry.register(plugin);

        assertEquals(initCalled, true);
    });

    await t.step('should throw error for duplicate plugin names', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin1: Plugin = {
            manifest: createTestManifest({ name: 'duplicate' }),
        };

        const plugin2: Plugin = {
            manifest: createTestManifest({ name: 'duplicate' }),
        };

        await registry.register(plugin1);

        await assertRejects(
            () => registry.register(plugin2),
            Error,
            'already registered',
        );
    });

    await t.step('should throw error for duplicate transformation types', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin1: Plugin = {
            manifest: createTestManifest({ name: 'plugin1' }),
            transformations: [createTestTransformation({ type: 'duplicate-transform' })],
        };

        const plugin2: Plugin = {
            manifest: createTestManifest({ name: 'plugin2' }),
            transformations: [createTestTransformation({ type: 'duplicate-transform' })],
        };

        await registry.register(plugin1);

        await assertRejects(
            () => registry.register(plugin2),
            Error,
            'already registered',
        );
    });

    await t.step('should throw error for duplicate downloader schemes', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin1: Plugin = {
            manifest: createTestManifest({ name: 'plugin1' }),
            downloaders: [createTestDownloader({ schemes: ['s3://'] })],
        };

        const plugin2: Plugin = {
            manifest: createTestManifest({ name: 'plugin2' }),
            downloaders: [createTestDownloader({ schemes: ['s3://'] })],
        };

        await registry.register(plugin1);

        await assertRejects(
            () => registry.register(plugin2),
            Error,
            'already registered',
        );
    });
});

Deno.test('PluginRegistry - unregister', async (t) => {
    await t.step('should unregister a plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'to-remove' }),
        };

        await registry.register(plugin);
        await registry.unregister('to-remove');

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 0);
    });

    await t.step('should call plugin cleanup function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let cleanupCalled = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            cleanup: () => {
                cleanupCalled = true;
            },
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        assertEquals(cleanupCalled, true);
    });

    await t.step('should remove plugin transformations', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [createTestTransformation()],
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        const transformation = registry.getTransformation('test-transform');
        assertEquals(transformation, undefined);
    });

    await t.step('should remove plugin downloaders', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [createTestDownloader()],
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        const downloader = registry.getDownloader('test://example.com');
        assertEquals(downloader, undefined);
    });

    await t.step('should not throw for non-existent plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        // Should not throw
        await registry.unregister('nonexistent');
    });
});

Deno.test('PluginRegistry - getPlugin', async (t) => {
    await t.step('should get registered plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'my-plugin' }),
        };

        await registry.register(plugin);

        const retrieved = registry.getPlugin('my-plugin');
        assertEquals(retrieved?.manifest.name, 'my-plugin');
    });

    await t.step('should return undefined for non-existent plugin', () => {
        const registry = new PluginRegistry(silentLogger);

        const retrieved = registry.getPlugin('nonexistent');
        assertEquals(retrieved, undefined);
    });
});

Deno.test('PluginRegistry - getPlugins', async (t) => {
    await t.step('should return all registered plugins', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({ manifest: createTestManifest({ name: 'plugin1' }) });
        await registry.register({ manifest: createTestManifest({ name: 'plugin2' }) });
        await registry.register({ manifest: createTestManifest({ name: 'plugin3' }) });

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 3);
    });

    await t.step('should return empty array when no plugins', () => {
        const registry = new PluginRegistry(silentLogger);

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 0);
    });
});

Deno.test('PluginRegistry - getTransformation', async (t) => {
    await t.step('should get transformation by type', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [
                createTestTransformation({ type: 'my-transform', name: 'My Transformation' }),
            ],
        };

        await registry.register(plugin);

        const transformation = registry.getTransformation('my-transform');
        assertEquals(transformation?.name, 'My Transformation');
    });

    await t.step('should return undefined for non-existent transformation', () => {
        const registry = new PluginRegistry(silentLogger);

        const transformation = registry.getTransformation('nonexistent');
        assertEquals(transformation, undefined);
    });
});

Deno.test('PluginRegistry - getDownloader', async (t) => {
    await t.step('should get downloader by URL scheme', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [createTestDownloader({ schemes: ['s3://'] })],
        };

        await registry.register(plugin);

        const downloader = registry.getDownloader('s3://bucket/file.txt');
        assertExists(downloader);
    });

    await t.step('should return undefined for non-matching scheme', () => {
        const registry = new PluginRegistry(silentLogger);

        const downloader = registry.getDownloader('http://example.com');
        assertEquals(downloader, undefined);
    });

    await t.step('should match longest scheme prefix', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [
                createTestDownloader({ schemes: ['s3://'] }),
                createTestDownloader({ schemes: ['s3://special/'] }),
            ],
        };

        await registry.register(plugin);

        const downloader1 = registry.getDownloader('s3://bucket/file.txt');
        const downloader2 = registry.getDownloader('s3://special/file.txt');

        assertExists(downloader1);
        assertExists(downloader2);
    });
});

Deno.test('PluginRegistry - hasTransformation', async (t) => {
    await t.step('should return true for registered transformation', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [createTestTransformation({ type: 'my-transform' })],
        };

        await registry.register(plugin);

        assertEquals(registry.hasTransformation('my-transform'), true);
    });

    await t.step('should return false for non-existent transformation', () => {
        const registry = new PluginRegistry(silentLogger);

        assertEquals(registry.hasTransformation('nonexistent'), false);
    });
});

Deno.test('PluginRegistry - plugin lifecycle', async (t) => {
    await t.step('should handle async init function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let initComplete = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            init: async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                initComplete = true;
            },
        };

        await registry.register(plugin);

        assertEquals(initComplete, true);
    });

    await t.step('should handle async cleanup function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let cleanupComplete = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            cleanup: async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                cleanupComplete = true;
            },
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        assertEquals(cleanupComplete, true);
    });

    await t.step('should provide context to init function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let receivedContext: PluginContext | undefined;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            init: (context) => {
                receivedContext = context;
            },
        };

        await registry.register(plugin);

        assertExists(receivedContext);
        assertEquals(receivedContext.registry, registry);
        assertExists(receivedContext.logger);
        assertExists(receivedContext.compilerVersion);
    });
});

Deno.test('PluginRegistry - edge cases', async (t) => {
    await t.step('should handle plugin with no transformations or downloaders', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
        };

        await registry.register(plugin);

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 1);
    });

    await t.step('should handle multiple transformations from same plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [
                createTestTransformation({ type: 'transform1' }),
                createTestTransformation({ type: 'transform2' }),
                createTestTransformation({ type: 'transform3' }),
            ],
        };

        await registry.register(plugin);

        assertEquals(registry.hasTransformation('transform1'), true);
        assertEquals(registry.hasTransformation('transform2'), true);
        assertEquals(registry.hasTransformation('transform3'), true);
    });

    await t.step('should handle multiple downloaders from same plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [
                createTestDownloader({ schemes: ['s3://'] }),
                createTestDownloader({ schemes: ['gcs://'] }),
                createTestDownloader({ schemes: ['azure://'] }),
            ],
        };

        await registry.register(plugin);

        assertExists(registry.getDownloader('s3://bucket/file'));
        assertExists(registry.getDownloader('gcs://bucket/file'));
        assertExists(registry.getDownloader('azure://container/file'));
    });

    await t.step('should handle downloader with multiple schemes', async () => {
        const registry = new PluginRegistry(silentLogger);

        const downloader = createTestDownloader({ schemes: ['s3://', 'gcs://', 'azure://'] });

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [downloader],
        };

        await registry.register(plugin);

        assertEquals(registry.getDownloader('s3://file'), downloader);
        assertEquals(registry.getDownloader('gcs://file'), downloader);
        assertEquals(registry.getDownloader('azure://file'), downloader);
    });
});

// ── Helper factories for new plugin types ──────────────────────────

const createTestFormatterPlugin = (overrides: Partial<FormatterPlugin> = {}): FormatterPlugin => ({
    format: 'test-format',
    formatterClass: class {
        format(_rules: string[]): string {
            return _rules.join('\n');
        }
    } as unknown as FormatterPlugin['formatterClass'],
    description: 'A test formatter',
    ...overrides,
});

const createTestValidationPlugin = (overrides: Partial<ValidationPlugin> = {}): ValidationPlugin => ({
    name: 'test-validator',
    description: 'A test validator',
    validate: (_config) => ({ valid: true, errorsText: null }),
    ...overrides,
});

const createTestParserPlugin = (overrides: Partial<ParserPlugin> = {}): ParserPlugin => ({
    name: 'test-parser',
    description: 'A test parser',
    supportedSyntaxes: ['adblock', 'hosts'],
    parse: (input) => ({ type: 'Rule', raw: input }),
    serialize: (node) => (node as ParsedNode & { raw: string }).raw ?? '',
    walk: (node, visitor) => {
        const nodes = Array.isArray(node) ? node : [node];
        for (const n of nodes) visitor(n);
    },
    ...overrides,
});

const createTestDiffReporterPlugin = (overrides: Partial<DiffReporterPlugin> = {}): DiffReporterPlugin => ({
    name: 'test-reporter',
    description: 'A test reporter',
    format: (report) => `Added: ${report.summary.addedCount}, Removed: ${report.summary.removedCount}`,
    ...overrides,
});

const createTestCacheBackendPlugin = (overrides: Partial<CacheBackendPlugin> = {}): CacheBackendPlugin => ({
    name: 'test-cache',
    description: 'A test cache backend',
    createAdapter: () => ({
        open: async () => {},
        close: async () => {},
        isOpen: () => true,
        get: async () => null,
        set: async () => true,
        delete: async () => true,
        list: async () => [],
        has: async () => false,
        clear: async () => {},
        getStats: async () => ({ totalEntries: 0, totalSize: 0, oldestEntry: null, newestEntry: null }),
        getCacheEntry: async () => null,
        setCacheEntry: async () => true,
        getMetadata: async () => null,
        setMetadata: async () => true,
    } as unknown as ReturnType<CacheBackendPlugin['createAdapter']>),
    ...overrides,
});

const createTestHeaderGeneratorPlugin = (overrides: Partial<HeaderGeneratorPlugin> = {}): HeaderGeneratorPlugin => ({
    name: 'test-header-gen',
    description: 'A test header generator',
    generate: (_config, _options) => ['! X-Plugin: test-header-gen'],
    ...overrides,
});

const createTestConflictResolverPlugin = (overrides: Partial<ConflictResolverPlugin> = {}): ConflictResolverPlugin => ({
    name: 'test-resolver',
    description: 'A test conflict resolver',
    resolve: (conflicts, _options) => ({
        conflicts,
        rulesAnalyzed: 0,
        blockingRules: 0,
        exceptionRules: 0,
    }),
    ...overrides,
});

const createTestEventHookPlugin = (overrides: Partial<EventHookPlugin> = {}): EventHookPlugin => ({
    name: 'test-event-hooks',
    description: 'A test event hook plugin',
    hooks: {
        onCompilationStart: () => {},
        onCompilationComplete: () => {},
    },
    ...overrides,
});

// ── Formatter Plugin Tests ─────────────────────────────────────────

Deno.test('PluginRegistry - FormatterPlugin', async (t) => {
    await t.step('should register and retrieve a formatter plugin', async () => {
        const registry = new PluginRegistry(silentLogger);
        const formatter = createTestFormatterPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'fmt-plugin' }),
            formatters: [formatter],
        });

        assertEquals(registry.getFormatter('test-format'), formatter);
        assertEquals(registry.listFormatters(), ['test-format']);
    });

    await t.step('should reject duplicate formatter format', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'fmt-a' }),
            formatters: [createTestFormatterPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'fmt-b' }),
                    formatters: [createTestFormatterPlugin()],
                }),
            Error,
            'Formatter for format "test-format" is already registered',
        );
    });

    await t.step('should unregister formatter when plugin is removed', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'fmt-plugin' }),
            formatters: [createTestFormatterPlugin()],
        });

        assertEquals(registry.getFormatter('test-format') !== undefined, true);

        await registry.unregister('fmt-plugin');
        assertEquals(registry.getFormatter('test-format'), undefined);
        assertEquals(registry.listFormatters().length, 0);
    });

    await t.step('should support multiple formatters per plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'multi-fmt' }),
            formatters: [
                createTestFormatterPlugin({ format: 'rpz' }),
                createTestFormatterPlugin({ format: 'bind' }),
            ],
        });

        assertExists(registry.getFormatter('rpz'));
        assertExists(registry.getFormatter('bind'));
        assertEquals(registry.listFormatters().length, 2);
    });
});

// ── Validation Plugin Tests ────────────────────────────────────────

Deno.test('PluginRegistry - ValidationPlugin', async (t) => {
    await t.step('should register and retrieve validators', async () => {
        const registry = new PluginRegistry(silentLogger);
        const validator = createTestValidationPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'val-plugin' }),
            validators: [validator],
        });

        assertEquals(registry.getValidator('test-validator'), validator);
        assertEquals(registry.getValidators().length, 1);
    });

    await t.step('should reject duplicate validator name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'val-a' }),
            validators: [createTestValidationPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'val-b' }),
                    validators: [createTestValidationPlugin()],
                }),
            Error,
            'Validator "test-validator" is already registered',
        );
    });

    await t.step('should unregister validators', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'val-plugin' }),
            validators: [createTestValidationPlugin()],
        });

        await registry.unregister('val-plugin');
        assertEquals(registry.getValidator('test-validator'), undefined);
        assertEquals(registry.getValidators().length, 0);
    });

    await t.step('should execute validator logic', async () => {
        const validator = createTestValidationPlugin({
            validate: (config) => ({
                valid: config.sources.length > 0,
                errorsText: config.sources.length === 0 ? 'No sources' : null,
            }),
        });

        const result = validator.validate({
            name: 'test',
            sources: [],
        });

        assertEquals(result, { valid: false, errorsText: 'No sources' });
    });
});

// ── Parser Plugin Tests ────────────────────────────────────────────

Deno.test('PluginRegistry - ParserPlugin', async (t) => {
    await t.step('should register and retrieve a parser', async () => {
        const registry = new PluginRegistry(silentLogger);
        const parser = createTestParserPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'parser-plugin' }),
            parsers: [parser],
        });

        assertEquals(registry.getParser('test-parser'), parser);
        assertEquals(registry.listParsers(), ['test-parser']);
    });

    await t.step('should find parsers by syntax', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'parser-plugin' }),
            parsers: [
                createTestParserPlugin({ name: 'p1', supportedSyntaxes: ['adblock'] }),
                createTestParserPlugin({ name: 'p2', supportedSyntaxes: ['hosts'] }),
                createTestParserPlugin({ name: 'p3', supportedSyntaxes: ['adblock', 'ublock'] }),
            ],
        });

        const adblockParsers = registry.getParsersForSyntax('adblock');
        assertEquals(adblockParsers.length, 2);

        const hostsParsers = registry.getParsersForSyntax('hosts');
        assertEquals(hostsParsers.length, 1);

        const noneParsers = registry.getParsersForSyntax('unknown');
        assertEquals(noneParsers.length, 0);
    });

    await t.step('should reject duplicate parser name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'pa' }),
            parsers: [createTestParserPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'pb' }),
                    parsers: [createTestParserPlugin()],
                }),
            Error,
            'Parser "test-parser" is already registered',
        );
    });

    await t.step('should unregister parsers', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'parser-plugin' }),
            parsers: [createTestParserPlugin()],
        });

        await registry.unregister('parser-plugin');
        assertEquals(registry.getParser('test-parser'), undefined);
    });

    await t.step('should execute parse/serialize/walk', () => {
        const parser = createTestParserPlugin();
        const node = parser.parse('||example.com^') as ParsedNode;
        assertEquals(node.type, 'Rule');
        assertEquals(node.raw, '||example.com^');

        const serialized = parser.serialize!(node);
        assertEquals(serialized, '||example.com^');

        const visited: ParsedNode[] = [];
        parser.walk!(node, (n) => {
            visited.push(n);
        });
        assertEquals(visited.length, 1);
    });
});

// ── Diff Reporter Plugin Tests ─────────────────────────────────────

Deno.test('PluginRegistry - DiffReporterPlugin', async (t) => {
    await t.step('should register and retrieve a diff reporter', async () => {
        const registry = new PluginRegistry(silentLogger);
        const reporter = createTestDiffReporterPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'diff-plugin' }),
            diffReporters: [reporter],
        });

        assertEquals(registry.getDiffReporter('test-reporter'), reporter);
        assertEquals(registry.listDiffReporters(), ['test-reporter']);
    });

    await t.step('should reject duplicate diff reporter name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'da' }),
            diffReporters: [createTestDiffReporterPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'db' }),
                    diffReporters: [createTestDiffReporterPlugin()],
                }),
            Error,
            'Diff reporter "test-reporter" is already registered',
        );
    });

    await t.step('should unregister diff reporters', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'diff-plugin' }),
            diffReporters: [createTestDiffReporterPlugin()],
        });

        await registry.unregister('diff-plugin');
        assertEquals(registry.getDiffReporter('test-reporter'), undefined);
    });
});

// ── Cache Backend Plugin Tests ─────────────────────────────────────

Deno.test('PluginRegistry - CacheBackendPlugin', async (t) => {
    await t.step('should register and retrieve a cache backend', async () => {
        const registry = new PluginRegistry(silentLogger);
        const cache = createTestCacheBackendPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'cache-plugin' }),
            cacheBackends: [cache],
        });

        assertEquals(registry.getCacheBackend('test-cache'), cache);
        assertEquals(registry.listCacheBackends(), ['test-cache']);
    });

    await t.step('should reject duplicate cache backend name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ca' }),
            cacheBackends: [createTestCacheBackendPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'cb' }),
                    cacheBackends: [createTestCacheBackendPlugin()],
                }),
            Error,
            'Cache backend "test-cache" is already registered',
        );
    });

    await t.step('should unregister cache backends', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'cache-plugin' }),
            cacheBackends: [createTestCacheBackendPlugin()],
        });

        await registry.unregister('cache-plugin');
        assertEquals(registry.getCacheBackend('test-cache'), undefined);
    });

    await t.step('should create adapter via factory', () => {
        const cache = createTestCacheBackendPlugin();
        const adapter = cache.createAdapter();
        assertEquals(adapter.isOpen(), true);
    });
});

// ── Header Generator Plugin Tests ──────────────────────────────────

Deno.test('PluginRegistry - HeaderGeneratorPlugin', async (t) => {
    await t.step('should register and retrieve header generators', async () => {
        const registry = new PluginRegistry(silentLogger);
        const gen = createTestHeaderGeneratorPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'header-plugin' }),
            headerGenerators: [gen],
        });

        assertEquals(registry.getHeaderGenerator('test-header-gen'), gen);
        assertEquals(registry.getHeaderGenerators().length, 1);
    });

    await t.step('should reject duplicate header generator', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ha' }),
            headerGenerators: [createTestHeaderGeneratorPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'hb' }),
                    headerGenerators: [createTestHeaderGeneratorPlugin()],
                }),
            Error,
            'Header generator "test-header-gen" is already registered',
        );
    });

    await t.step('should unregister header generators', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'header-plugin' }),
            headerGenerators: [createTestHeaderGeneratorPlugin()],
        });

        await registry.unregister('header-plugin');
        assertEquals(registry.getHeaderGenerator('test-header-gen'), undefined);
    });

    await t.step('should generate header lines', () => {
        const gen = createTestHeaderGeneratorPlugin();
        const lines = gen.generate({ name: 'test', sources: [] });
        assertEquals(lines, ['! X-Plugin: test-header-gen']);
    });
});

// ── Conflict Resolver Plugin Tests ─────────────────────────────────

Deno.test('PluginRegistry - ConflictResolverPlugin', async (t) => {
    await t.step('should register and retrieve conflict resolvers', async () => {
        const registry = new PluginRegistry(silentLogger);
        const resolver = createTestConflictResolverPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'resolver-plugin' }),
            conflictResolvers: [resolver],
        });

        assertEquals(registry.getConflictResolver('test-resolver'), resolver);
        assertEquals(registry.listConflictResolvers(), ['test-resolver']);
    });

    await t.step('should reject duplicate conflict resolver', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ra' }),
            conflictResolvers: [createTestConflictResolverPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'rb' }),
                    conflictResolvers: [createTestConflictResolverPlugin()],
                }),
            Error,
            'Conflict resolver "test-resolver" is already registered',
        );
    });

    await t.step('should unregister conflict resolvers', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'resolver-plugin' }),
            conflictResolvers: [createTestConflictResolverPlugin()],
        });

        await registry.unregister('resolver-plugin');
        assertEquals(registry.getConflictResolver('test-resolver'), undefined);
    });
});

// ── Event Hook Plugin Tests ────────────────────────────────────────

Deno.test('PluginRegistry - EventHookPlugin', async (t) => {
    await t.step('should register and retrieve event hooks', async () => {
        const registry = new PluginRegistry(silentLogger);
        const hooks = createTestEventHookPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'hook-plugin' }),
            eventHooks: [hooks],
        });

        assertEquals(registry.getEventHook('test-event-hooks'), hooks);
        assertEquals(registry.getEventHooks().length, 1);
    });

    await t.step('should reject duplicate event hook name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ea' }),
            eventHooks: [createTestEventHookPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'eb' }),
                    eventHooks: [createTestEventHookPlugin()],
                }),
            Error,
            'Event hook "test-event-hooks" is already registered',
        );
    });

    await t.step('should unregister event hooks', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'hook-plugin' }),
            eventHooks: [createTestEventHookPlugin()],
        });

        await registry.unregister('hook-plugin');
        assertEquals(registry.getEventHook('test-event-hooks'), undefined);
    });
});

// ── Multi-Slot Plugin Tests ────────────────────────────────────────

Deno.test('PluginRegistry - multi-slot plugin', async (t) => {
    await t.step('should register a plugin with all slot types', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'mega-plugin' }),
            transformations: [createTestTransformation()],
            downloaders: [createTestDownloader()],
            formatters: [createTestFormatterPlugin()],
            validators: [createTestValidationPlugin()],
            parsers: [createTestParserPlugin()],
            diffReporters: [createTestDiffReporterPlugin()],
            cacheBackends: [createTestCacheBackendPlugin()],
            headerGenerators: [createTestHeaderGeneratorPlugin()],
            conflictResolvers: [createTestConflictResolverPlugin()],
            eventHooks: [createTestEventHookPlugin()],
        };

        await registry.register(plugin);

        // Verify every slot is populated
        assertExists(registry.getTransformation('test-transform'));
        assertExists(registry.getDownloader('test://foo'));
        assertExists(registry.getFormatter('test-format'));
        assertExists(registry.getValidator('test-validator'));
        assertExists(registry.getParser('test-parser'));
        assertExists(registry.getDiffReporter('test-reporter'));
        assertExists(registry.getCacheBackend('test-cache'));
        assertExists(registry.getHeaderGenerator('test-header-gen'));
        assertExists(registry.getConflictResolver('test-resolver'));
        assertExists(registry.getEventHook('test-event-hooks'));
    });

    await t.step('should clean up all slots on unregister', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'mega-plugin' }),
            transformations: [createTestTransformation()],
            downloaders: [createTestDownloader()],
            formatters: [createTestFormatterPlugin()],
            validators: [createTestValidationPlugin()],
            parsers: [createTestParserPlugin()],
            diffReporters: [createTestDiffReporterPlugin()],
            cacheBackends: [createTestCacheBackendPlugin()],
            headerGenerators: [createTestHeaderGeneratorPlugin()],
            conflictResolvers: [createTestConflictResolverPlugin()],
            eventHooks: [createTestEventHookPlugin()],
        };

        await registry.register(plugin);
        await registry.unregister('mega-plugin');

        assertEquals(registry.getTransformation('test-transform'), undefined);
        assertEquals(registry.getDownloader('test://foo'), undefined);
        assertEquals(registry.getFormatter('test-format'), undefined);
        assertEquals(registry.getValidator('test-validator'), undefined);
        assertEquals(registry.getParser('test-parser'), undefined);
        assertEquals(registry.getDiffReporter('test-reporter'), undefined);
        assertEquals(registry.getCacheBackend('test-cache'), undefined);
        assertEquals(registry.getHeaderGenerator('test-header-gen'), undefined);
        assertEquals(registry.getConflictResolver('test-resolver'), undefined);
        assertEquals(registry.getEventHook('test-event-hooks'), undefined);
        assertEquals(registry.size, 0);
    });

    await t.step('should handle clear() with all slot types', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'p1' }),
            formatters: [createTestFormatterPlugin({ format: 'fmt-a' })],
        });

        await registry.register({
            manifest: createTestManifest({ name: 'p2' }),
            parsers: [createTestParserPlugin({ name: 'parser-b' })],
        });

        assertEquals(registry.size, 2);
        await registry.clear();
        assertEquals(registry.size, 0);
        assertEquals(registry.listFormatters().length, 0);
        assertEquals(registry.listParsers().length, 0);
    });
});

// ── Plugin Manifest Dependencies ───────────────────────────────────

Deno.test('PluginManifest - dependencies field', async () => {
    const registry = new PluginRegistry(silentLogger);

    // Register dependencies first
    await registry.register({ manifest: { name: 'core-plugin', version: '1.0.0' } });
    await registry.register({ manifest: { name: 'parser-plugin', version: '1.0.0' } });

    const plugin: Plugin = {
        manifest: createTestManifest({
            name: 'dependent-plugin',
            dependencies: ['core-plugin', 'parser-plugin'],
        }),
    };

    await registry.register(plugin);

    const retrieved = registry.getPlugin('dependent-plugin');
    assertExists(retrieved);
    assertEquals(retrieved.manifest.dependencies, ['core-plugin', 'parser-plugin']);
});

// ═════════════════════════════════════════════════════════════════════
// Phase 2: SubsystemBridge wiring tests
// ═════════════════════════════════════════════════════════════════════

Deno.test('SubsystemBridge — formatter registration flows to bridge', async () => {
    const registered: Array<{ format: string; ctor: unknown }> = [];
    const unregistered: string[] = [];

    const registry = new PluginRegistry(silentLogger, {
        registerFormatter: (format, ctor) => registered.push({ format, ctor }),
        unregisterFormatter: (format) => unregistered.push(format),
    });

    class MarkdownFormatter {}
    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'md-fmt' }),
        formatters: [
            { format: 'markdown', formatterClass: MarkdownFormatter as never },
        ],
    };

    await registry.register(plugin);
    assertEquals(registered.length, 1);
    assertEquals(registered[0].format, 'markdown');

    await registry.unregister('md-fmt');
    assertEquals(unregistered.length, 1);
    assertEquals(unregistered[0], 'markdown');
});

Deno.test('SubsystemBridge — transformation registration flows to bridge', async () => {
    const bridgedTypes: string[] = [];

    const registry = new PluginRegistry(silentLogger, {
        registerTransformation: (type) => bridgedTypes.push(type),
    });

    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'tr-bridge' }),
        transformations: [{
            type: 'StripMetadata' as never,
            name: 'StripMetadata',
            execute: async (lines: readonly string[]) => lines,
        }],
    };

    await registry.register(plugin);
    assertEquals(bridgedTypes, ['StripMetadata']);
});

Deno.test('SubsystemBridge — event hook registration flows to bridge', async () => {
    const registeredHooks: Array<Partial<Record<string, unknown>>> = [];
    const unregisteredHooks: Array<Partial<Record<string, unknown>>> = [];

    const registry = new PluginRegistry(silentLogger, {
        registerEventHooks: (hooks) => registeredHooks.push(hooks),
        unregisterEventHooks: (hooks) => unregisteredHooks.push(hooks),
    });

    const hooks = { onCompileStart: () => {} };
    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'hook-bridge' }),
        eventHooks: [{ name: 'lifecycle-hooks', hooks: hooks as never }],
    };

    await registry.register(plugin);
    assertEquals(registeredHooks.length, 1);

    await registry.unregister('hook-bridge');
    assertEquals(unregisteredHooks.length, 1);
});

Deno.test('SubsystemBridge — connectBridge wires late-bound subsystems', async () => {
    const registry = new PluginRegistry(silentLogger);
    const registered: string[] = [];

    // Connect bridge after construction
    registry.connectBridge({
        registerFormatter: (format) => registered.push(format),
    });

    class CsvFormatter {}
    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'csv-plugin' }),
        formatters: [{ format: 'csv', formatterClass: CsvFormatter as never }],
    };

    await registry.register(plugin);
    assertEquals(registered, ['csv']);
});

Deno.test('SubsystemBridge — bridge is optional, registry works standalone', async () => {
    const registry = new PluginRegistry(silentLogger);

    class PlainFormatter {}
    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'standalone-test' }),
        formatters: [{ format: 'plain', formatterClass: PlainFormatter as never }],
    };

    // Should not throw even with no bridge
    await registry.register(plugin);
    assertEquals(registry.getFormatter('plain')?.format, 'plain');
    await registry.unregister('standalone-test');
});

// ═════════════════════════════════════════════════════════════════════
// Phase 2: Subsystem integration method tests
// ═════════════════════════════════════════════════════════════════════

Deno.test('runValidators — returns valid when no validators registered', async () => {
    const registry = new PluginRegistry(silentLogger);
    const result = await registry.runValidators({} as never);
    assertEquals(result.valid, true);
});

Deno.test('runValidators — returns first failing validation', async () => {
    const registry = new PluginRegistry(silentLogger);

    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'val-test' }),
        validators: [
            {
                name: 'check-name',
                validate: (config) => config.name ? { valid: true, errorsText: null } : { valid: false, errorsText: 'name is required' },
            },
        ],
    };

    await registry.register(plugin);

    const fail = await registry.runValidators({ name: '' } as never);
    assertEquals(fail.valid, false);
    assertEquals(fail.errorsText, 'name is required');

    const pass = await registry.runValidators({ name: 'test' } as never);
    assertEquals(pass.valid, true);
});

Deno.test('formatDiffReport — formats with named reporter', async () => {
    const registry = new PluginRegistry(silentLogger);

    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'reporter-test' }),
        diffReporters: [{
            name: 'csv-reporter',
            format: (report) => `CSV:${report.summary.addedCount}`,
        }],
    };

    await registry.register(plugin);

    const result = registry.formatDiffReport('csv-reporter', {
        summary: { addedCount: 5, removedCount: 2 },
    } as never);
    assertEquals(result, 'CSV:5');
    assertEquals(registry.formatDiffReport('nonexistent', {} as never), undefined);
});

Deno.test('createStorageAdapter — creates adapter from backend plugin', async () => {
    const registry = new PluginRegistry(silentLogger);

    const mockAdapter = { mock: true };
    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'storage-test' }),
        cacheBackends: [{
            name: 'memory-store',
            createAdapter: () => mockAdapter as never,
        }],
    };

    await registry.register(plugin);
    assertExists(registry.createStorageAdapter('memory-store'));
    assertEquals(registry.createStorageAdapter('nonexistent'), undefined);
});

Deno.test('generatePluginHeaders — collects lines from all generators', async () => {
    const registry = new PluginRegistry(silentLogger);

    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'header-test' }),
        headerGenerators: [
            { name: 'banner', generate: () => ['! Generated by plugin'] },
            { name: 'timestamp', generate: () => ['! Date: 2025-01-01'] },
        ],
    };

    await registry.register(plugin);
    const lines = registry.generatePluginHeaders({} as never);
    assertEquals(lines, ['! Generated by plugin', '! Date: 2025-01-01']);
});

Deno.test('resolveConflicts — delegates to resolver plugin', async () => {
    const registry = new PluginRegistry(silentLogger);

    const plugin: Plugin = {
        manifest: createTestManifest({ name: 'resolver-test' }),
        conflictResolvers: [{
            name: 'auto-resolve',
            resolve: (conflicts) => ({
                conflicts,
                rulesAnalyzed: conflicts.length,
                blockingRules: 0,
                exceptionRules: 0,
            }),
        }],
    };

    await registry.register(plugin);
    const result = registry.resolveConflicts([{ rule1: 'a', rule2: 'b' }] as never);
    assertExists(result);
    assertEquals(result.rulesAnalyzed, 1);
});

Deno.test('resolveConflicts — returns undefined when no resolver', () => {
    const registry = new PluginRegistry(silentLogger);
    assertEquals(registry.resolveConflicts([] as never), undefined);
});

// ── Phase 4: Dependency Resolution ──────────────────────────────────

Deno.test('register — rejects plugin with unmet dependencies', async () => {
    const registry = new PluginRegistry(silentLogger);
    const plugin: Plugin = {
        manifest: { name: 'child', version: '1.0.0', dependencies: ['parent'] },
    };

    await assertRejects(
        () => registry.register(plugin),
        Error,
        'unmet dependencies: parent',
    );
});

Deno.test('register — accepts plugin when all dependencies satisfied', async () => {
    const registry = new PluginRegistry(silentLogger);
    const parent: Plugin = { manifest: { name: 'parent', version: '1.0.0' } };
    const child: Plugin = {
        manifest: { name: 'child', version: '1.0.0', dependencies: ['parent'] },
    };

    await registry.register(parent);
    await registry.register(child);

    assertExists(registry.getPlugin('child'));
});

Deno.test('registerAll — sorts by dependencies', async () => {
    const registry = new PluginRegistry(silentLogger);
    const order: string[] = [];

    const a: Plugin = {
        manifest: { name: 'a', version: '1.0.0' },
        init: () => {
            order.push('a');
        },
    };
    const b: Plugin = {
        manifest: { name: 'b', version: '1.0.0', dependencies: ['a'] },
        init: () => {
            order.push('b');
        },
    };
    const c: Plugin = {
        manifest: { name: 'c', version: '1.0.0', dependencies: ['b'] },
        init: () => {
            order.push('c');
        },
    };

    // Pass them in reverse order to prove sort works
    await registry.registerAll([c, b, a]);

    assertEquals(order, ['a', 'b', 'c']);
    assertExists(registry.getPlugin('a'));
    assertExists(registry.getPlugin('b'));
    assertExists(registry.getPlugin('c'));
});

Deno.test('registerAll — detects circular dependency', async () => {
    const registry = new PluginRegistry(silentLogger);
    const a: Plugin = {
        manifest: { name: 'a', version: '1.0.0', dependencies: ['b'] },
    };
    const b: Plugin = {
        manifest: { name: 'b', version: '1.0.0', dependencies: ['a'] },
    };

    await assertRejects(
        () => registry.registerAll([a, b]),
        Error,
        'Circular plugin dependency',
    );
});

// Use the exported function directly
import { topologicalSort } from './PluginSystem.ts';

Deno.test('topologicalSort — preserves order for independent plugins', () => {
    const a: Plugin = { manifest: { name: 'a', version: '1.0.0' } };
    const b: Plugin = { manifest: { name: 'b', version: '1.0.0' } };
    const result = topologicalSort([a, b]);
    assertEquals(result.length, 2);
    assertEquals(result[0].manifest.name, 'a');
    assertEquals(result[1].manifest.name, 'b');
});

Deno.test('topologicalSort — reorders based on dependencies', () => {
    const a: Plugin = { manifest: { name: 'a', version: '1.0.0', dependencies: ['b'] } };
    const b: Plugin = { manifest: { name: 'b', version: '1.0.0' } };
    const result = topologicalSort([a, b]);
    assertEquals(result[0].manifest.name, 'b');
    assertEquals(result[1].manifest.name, 'a');
});

Deno.test('topologicalSort — throws on cycle', () => {
    const a: Plugin = { manifest: { name: 'a', version: '1.0.0', dependencies: ['b'] } };
    const b: Plugin = { manifest: { name: 'b', version: '1.0.0', dependencies: ['a'] } };
    let threw = false;
    try {
        topologicalSort([a, b]);
    } catch (e) {
        threw = true;
        assertEquals((e as Error).message.includes('Circular'), true);
    }
    assertEquals(threw, true);
});

// ── Phase 5: Integration & Lifecycle Tests ──────────────────────────

Deno.test('lifecycle — init/cleanup called in correct order', async () => {
    const registry = new PluginRegistry(silentLogger);
    const events: string[] = [];

    const plugin: Plugin = {
        manifest: { name: 'lifecycle', version: '1.0.0' },
        init: () => {
            events.push('init');
        },
        cleanup: () => {
            events.push('cleanup');
        },
    };

    await registry.register(plugin);
    assertEquals(events, ['init']);

    await registry.unregister('lifecycle');
    assertEquals(events, ['init', 'cleanup']);
});

Deno.test('lifecycle — async init error rejects register', async () => {
    const registry = new PluginRegistry(silentLogger);
    const plugin: Plugin = {
        manifest: { name: 'bad-init', version: '1.0.0' },
        init: async () => {
            throw new Error('init failure');
        },
    };

    await assertRejects(
        () => registry.register(plugin),
        Error,
        'init failure',
    );
    // Plugin should NOT be in the registry after failed init
    assertEquals(registry.getPlugin('bad-init'), undefined);
});

Deno.test('integration — full multi-slot plugin end-to-end', async () => {
    const bridge = {
        registered: [] as string[],
        registerFormatter: (format: string, _ctor: unknown) => {
            bridge.registered.push(`fmt:${format}`);
        },
    };

    const registry = new PluginRegistry(silentLogger, bridge as never);

    // Plugin that provides formatter + validator + header generator
    const plugin: Plugin = {
        manifest: { name: 'all-in-one', version: '2.0.0' },
        formatters: [{
            format: 'custom-json',
            formatterClass: class {} as never,
        }],
        validators: [{
            name: 'custom-validate',
            validate: () => ({ valid: true, errorsText: null }),
        }],
        headerGenerators: [{
            name: 'custom-header',
            generate: () => ['! Generated by all-in-one plugin'],
        }],
    };

    await registry.register(plugin);

    // Formatter registered via bridge
    assertEquals(bridge.registered, ['fmt:custom-json']);

    // Validator works
    const result = await registry.runValidators({} as never);
    assertEquals(result.valid, true);

    // Header generator works
    const headers = registry.generatePluginHeaders({} as never);
    assertEquals(headers, ['! Generated by all-in-one plugin']);

    // Clean up
    await registry.unregister('all-in-one');
    assertEquals(registry.getPlugin('all-in-one'), undefined);
});

Deno.test('integration — registerAll with bridge + dependencies', async () => {
    const bridgeLog: string[] = [];
    const bridge = {
        registerFormatter: (format: string) => bridgeLog.push(format),
    };

    const registry = new PluginRegistry(silentLogger, bridge as never);

    const core: Plugin = {
        manifest: { name: 'core', version: '1.0.0' },
        formatters: [{ format: 'base', formatterClass: class {} as never }],
    };

    const ext: Plugin = {
        manifest: { name: 'extension', version: '1.0.0', dependencies: ['core'] },
        formatters: [{ format: 'extended', formatterClass: class {} as never }],
    };

    // Register in reverse order — topological sort should fix
    await registry.registerAll([ext, core]);

    // 'base' must be registered before 'extended' because core comes first
    assertEquals(bridgeLog, ['base', 'extended']);
    assertEquals(registry.getPlugins().length, 2);
});
