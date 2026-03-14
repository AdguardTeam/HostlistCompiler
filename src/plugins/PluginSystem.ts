/**
 * Unified Plugin System
 *
 * Provides a single extensibility surface for all compiler subsystems:
 * transformations, downloaders, formatters, validators, parsers,
 * diff reporters, cache/storage backends, header generators, conflict
 * resolvers, and event hooks.
 *
 * A `Plugin` is a bag of optional slots — each plugin provides whichever
 * subsystem extensions it needs. `PluginRegistry.register()` dispatches
 * each slot to the appropriate subsystem registry/factory.
 *
 * @module PluginSystem
 */

import type { ICompilerEvents, IConfiguration, ILogger, ITransformationContext, IValidationResult, TransformationType } from '../types/index.ts';
import type { FormatterConstructor } from '../formatters/OutputFormatter.ts';
import type { DiffReport } from '../diff/DiffReport.ts';
import type { IStorageAdapter } from '../storage/IStorageAdapter.ts';
import type { HeaderOptions } from '../compiler/HeaderGenerator.ts';
import type { ConflictDetectionOptions, ConflictDetectionResult, RuleConflict } from '../transformations/ConflictDetectionTransformation.ts';
import { Transformation } from '../transformations/base/Transformation.ts';
import { logger as defaultLogger } from '../utils/logger.ts';
import { VERSION } from '../version.ts';

// ── Plugin Manifest ─────────────────────────────────────────────────

/**
 * Plugin metadata
 */
export interface PluginManifest {
    /** Plugin name (unique identifier) */
    name: string;
    /** Plugin version (semver) */
    version: string;
    /** Plugin description */
    description?: string;
    /** Plugin author */
    author?: string;
    /** Plugin homepage */
    homepage?: string;
    /** Minimum compiler version required */
    minCompilerVersion?: string;
    /** Names of other plugins this plugin depends on */
    dependencies?: string[];
}

// ── Existing Plugin Slot Types ──────────────────────────────────────

/**
 * Custom transformation plugin definition
 */
export interface TransformationPlugin {
    /** Unique identifier for the transformation */
    type: string;
    /** Human-readable name */
    name: string;
    /** Description of what the transformation does */
    description?: string;
    /** The transformation implementation */
    execute: (
        rules: readonly string[],
        context?: ITransformationContext,
    ) => Promise<readonly string[]> | readonly string[];
}

/**
 * Custom downloader plugin definition
 */
export interface DownloaderPlugin {
    /** URL schemes this downloader handles (e.g., ['s3://', 'gcs://']) */
    schemes: string[];
    /** Download function */
    download: (source: string) => Promise<string[]>;
}

// ── New Plugin Slot Types ───────────────────────────────────────────

/**
 * Formatter plugin — registers a custom output formatter with
 * `FormatterFactory`.
 */
export interface FormatterPlugin {
    /** Output format identifier (e.g., 'rpz', 'bind', 'blocky') */
    format: string;
    /** Formatter constructor to register */
    formatterClass: FormatterConstructor;
    /** Human-readable description */
    description?: string;
}

/**
 * Validation plugin — runs additional configuration validation after
 * the built-in Zod schema check.
 */
export interface ValidationPlugin {
    /** Unique validator name */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Validate a configuration. Return `{ valid: true }` or `{ valid: false, errorsText }` */
    validate: (config: IConfiguration) => IValidationResult | Promise<IValidationResult>;
}

/**
 * Generic AST node produced by a parser plugin.
 * Intentionally loose to avoid coupling to any specific parser library.
 */
export interface ParsedNode {
    /** Node type identifier (e.g., 'NetworkRule', 'Comment', 'Host') */
    type: string;
    /** Additional node-specific properties */
    [key: string]: unknown;
}

/**
 * Parser plugin — provides rule parsing, serialization, and AST traversal.
 * The AGTree adapter (Phase 3) implements this interface.
 */
export interface ParserPlugin {
    /** Unique parser name */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Syntax dialects this parser supports (e.g., ['adblock', 'ublock', 'hosts']) */
    supportedSyntaxes: string[];
    /** Parse raw input into AST nodes */
    parse: (input: string, options?: Record<string, unknown>) => ParsedNode | ParsedNode[];
    /** Serialize AST node(s) back to string */
    serialize?: (node: ParsedNode | ParsedNode[]) => string;
    /** Walk the AST, calling visitor for each node. Return `false` from visitor to stop. */
    walk?: (node: ParsedNode | ParsedNode[], visitor: (node: ParsedNode) => void | boolean) => void;
}

/**
 * Diff reporter plugin — formats a `DiffReport` into a custom output
 * format (Markdown, CSV, HTML, etc.).
 */
export interface DiffReporterPlugin {
    /** Output format identifier (e.g., 'markdown', 'csv', 'html') */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Format a diff report */
    format: (report: DiffReport) => string | Record<string, unknown>;
}

/**
 * Cache/storage backend plugin — provides a custom `IStorageAdapter`
 * implementation (Redis, S3, IndexedDB, etc.).
 */
export interface CacheBackendPlugin {
    /** Backend name (e.g., 'redis', 's3') */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Factory to create the storage adapter */
    createAdapter: (options?: Record<string, unknown>) => IStorageAdapter;
}

/**
 * Header generator plugin — contributes custom header lines to
 * compiled filter lists.
 */
export interface HeaderGeneratorPlugin {
    /** Unique generator name */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Generate header lines to include in the output */
    generate: (config: IConfiguration, options?: HeaderOptions) => string[];
}

/**
 * Conflict resolution strategy provided by a plugin.
 */
export interface ConflictResolverPlugin {
    /** Unique resolver name */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Resolve an array of detected conflicts, returning modified detection result */
    resolve: (
        conflicts: RuleConflict[],
        options?: ConflictDetectionOptions,
    ) => ConflictDetectionResult;
}

/**
 * Event hook plugin — subscribes to compiler lifecycle events.
 * Each field is an optional callback matching `ICompilerEvents`.
 */
export interface EventHookPlugin {
    /** Unique hook set name */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Partial set of compiler event callbacks */
    hooks: Partial<ICompilerEvents>;
}

// ── Unified Plugin Interface ────────────────────────────────────────

/**
 * Complete plugin definition.
 *
 * A plugin is a bag of optional slots — provide whichever subsystem
 * extensions are needed. All slots are processed during
 * `PluginRegistry.register()`.
 */
export interface Plugin {
    /** Plugin manifest (name, version, metadata) */
    manifest: PluginManifest;

    // ── Existing slots ──
    /** Custom transformations */
    transformations?: TransformationPlugin[];
    /** Custom downloaders */
    downloaders?: DownloaderPlugin[];

    // ── New slots ──
    /** Custom output formatters */
    formatters?: FormatterPlugin[];
    /** Custom configuration validators */
    validators?: ValidationPlugin[];
    /** Custom rule parsers */
    parsers?: ParserPlugin[];
    /** Custom diff report formatters */
    diffReporters?: DiffReporterPlugin[];
    /** Custom cache/storage backends */
    cacheBackends?: CacheBackendPlugin[];
    /** Custom header generators */
    headerGenerators?: HeaderGeneratorPlugin[];
    /** Custom conflict resolvers */
    conflictResolvers?: ConflictResolverPlugin[];
    /** Event hook subscriptions */
    eventHooks?: EventHookPlugin[];

    /** Plugin initialization — called after registration, receives context */
    init?: (context: PluginContext) => Promise<void> | void;
    /** Plugin cleanup — called during unregistration */
    cleanup?: () => Promise<void> | void;
}

/**
 * Context provided to plugins during initialization.
 * Gives plugins access to core subsystem registries.
 */
export interface PluginContext {
    /** Logger instance */
    logger: ILogger;
    /** Plugin registry (for querying other plugins) */
    registry: PluginRegistry;
    /** Compiler version string */
    compilerVersion: string;
}

/**
 * Plugin loading options
 */
export interface PluginLoadOptions {
    /** Allow plugins from remote URLs */
    allowRemote?: boolean;
    /** Validate plugin manifest */
    validateManifest?: boolean;
    /** Timeout for plugin initialization (ms) */
    initTimeout?: number;
}

// ── Plugin Registry ─────────────────────────────────────────────────

/**
 * Central registry for managing loaded plugins and dispatching their
 * extensions to the appropriate subsystem registries.
 *
 * Each plugin slot type gets its own internal `Map` for O(1) lookups.
 * Subsystem wiring (Phase 2) will add bridge calls to external
 * factories/registries during `register()` and `unregister()`.
 */
export class PluginRegistry {
    // ── Internal storage ──
    private readonly plugins = new Map<string, Plugin>();
    private readonly transformations = new Map<string, TransformationPlugin>();
    private readonly downloaders = new Map<string, DownloaderPlugin>();
    private readonly formatters = new Map<string, FormatterPlugin>();
    private readonly validators = new Map<string, ValidationPlugin>();
    private readonly parsers = new Map<string, ParserPlugin>();
    private readonly diffReporters = new Map<string, DiffReporterPlugin>();
    private readonly cacheBackends = new Map<string, CacheBackendPlugin>();
    private readonly headerGenerators = new Map<string, HeaderGeneratorPlugin>();
    private readonly conflictResolvers = new Map<string, ConflictResolverPlugin>();
    private readonly eventHooks = new Map<string, EventHookPlugin>();
    private readonly logger: ILogger;

    constructor(logger?: ILogger) {
        this.logger = logger ?? defaultLogger;
    }

    // ── Registration ──

    /**
     * Registers a plugin, dispatching each slot to its subsystem map.
     * Calls the plugin's `init()` lifecycle hook after registration.
     */
    async register(plugin: Plugin): Promise<void> {
        const name = plugin.manifest.name;

        if (this.plugins.has(name)) {
            throw new Error(`Plugin "${name}" is already registered`);
        }

        this.logger.info(`Registering plugin: ${name} v${plugin.manifest.version}`);

        // Dispatch transformations
        if (plugin.transformations) {
            for (const t of plugin.transformations) {
                if (this.transformations.has(t.type)) {
                    throw new Error(
                        `Transformation "${t.type}" is already registered by another plugin`,
                    );
                }
                this.transformations.set(t.type, t);
                this.logger.debug(`  ↳ transformation: ${t.type}`);
            }
        }

        // Dispatch downloaders
        if (plugin.downloaders) {
            for (const d of plugin.downloaders) {
                for (const scheme of d.schemes) {
                    if (this.downloaders.has(scheme)) {
                        throw new Error(
                            `Downloader for scheme "${scheme}" is already registered`,
                        );
                    }
                    this.downloaders.set(scheme, d);
                    this.logger.debug(`  ↳ downloader: ${scheme}`);
                }
            }
        }

        // Dispatch formatters
        if (plugin.formatters) {
            for (const f of plugin.formatters) {
                if (this.formatters.has(f.format)) {
                    throw new Error(
                        `Formatter for format "${f.format}" is already registered`,
                    );
                }
                this.formatters.set(f.format, f);
                this.logger.debug(`  ↳ formatter: ${f.format}`);
            }
        }

        // Dispatch validators
        if (plugin.validators) {
            for (const v of plugin.validators) {
                if (this.validators.has(v.name)) {
                    throw new Error(
                        `Validator "${v.name}" is already registered`,
                    );
                }
                this.validators.set(v.name, v);
                this.logger.debug(`  ↳ validator: ${v.name}`);
            }
        }

        // Dispatch parsers
        if (plugin.parsers) {
            for (const p of plugin.parsers) {
                if (this.parsers.has(p.name)) {
                    throw new Error(
                        `Parser "${p.name}" is already registered`,
                    );
                }
                this.parsers.set(p.name, p);
                this.logger.debug(`  ↳ parser: ${p.name}`);
            }
        }

        // Dispatch diff reporters
        if (plugin.diffReporters) {
            for (const r of plugin.diffReporters) {
                if (this.diffReporters.has(r.name)) {
                    throw new Error(
                        `Diff reporter "${r.name}" is already registered`,
                    );
                }
                this.diffReporters.set(r.name, r);
                this.logger.debug(`  ↳ diff reporter: ${r.name}`);
            }
        }

        // Dispatch cache backends
        if (plugin.cacheBackends) {
            for (const c of plugin.cacheBackends) {
                if (this.cacheBackends.has(c.name)) {
                    throw new Error(
                        `Cache backend "${c.name}" is already registered`,
                    );
                }
                this.cacheBackends.set(c.name, c);
                this.logger.debug(`  ↳ cache backend: ${c.name}`);
            }
        }

        // Dispatch header generators
        if (plugin.headerGenerators) {
            for (const h of plugin.headerGenerators) {
                if (this.headerGenerators.has(h.name)) {
                    throw new Error(
                        `Header generator "${h.name}" is already registered`,
                    );
                }
                this.headerGenerators.set(h.name, h);
                this.logger.debug(`  ↳ header generator: ${h.name}`);
            }
        }

        // Dispatch conflict resolvers
        if (plugin.conflictResolvers) {
            for (const cr of plugin.conflictResolvers) {
                if (this.conflictResolvers.has(cr.name)) {
                    throw new Error(
                        `Conflict resolver "${cr.name}" is already registered`,
                    );
                }
                this.conflictResolvers.set(cr.name, cr);
                this.logger.debug(`  ↳ conflict resolver: ${cr.name}`);
            }
        }

        // Dispatch event hooks
        if (plugin.eventHooks) {
            for (const eh of plugin.eventHooks) {
                if (this.eventHooks.has(eh.name)) {
                    throw new Error(
                        `Event hook "${eh.name}" is already registered`,
                    );
                }
                this.eventHooks.set(eh.name, eh);
                this.logger.debug(`  ↳ event hook: ${eh.name}`);
            }
        }

        // Initialize plugin
        if (plugin.init) {
            const context: PluginContext = {
                logger: this.logger,
                registry: this,
                compilerVersion: VERSION,
            };
            await plugin.init(context);
        }

        this.plugins.set(name, plugin);
        this.logger.info(`Plugin "${name}" registered successfully`);
    }

    /**
     * Unregisters a plugin, removing all its subsystem entries and
     * calling the plugin's `cleanup()` lifecycle hook.
     */
    async unregister(name: string): Promise<void> {
        const plugin = this.plugins.get(name);
        if (!plugin) return;

        // Cleanup lifecycle
        if (plugin.cleanup) {
            await plugin.cleanup();
        }

        // Remove transformations
        if (plugin.transformations) {
            for (const t of plugin.transformations) {
                this.transformations.delete(t.type);
            }
        }

        // Remove downloaders
        if (plugin.downloaders) {
            for (const d of plugin.downloaders) {
                for (const scheme of d.schemes) {
                    this.downloaders.delete(scheme);
                }
            }
        }

        // Remove formatters
        if (plugin.formatters) {
            for (const f of plugin.formatters) {
                this.formatters.delete(f.format);
            }
        }

        // Remove validators
        if (plugin.validators) {
            for (const v of plugin.validators) {
                this.validators.delete(v.name);
            }
        }

        // Remove parsers
        if (plugin.parsers) {
            for (const p of plugin.parsers) {
                this.parsers.delete(p.name);
            }
        }

        // Remove diff reporters
        if (plugin.diffReporters) {
            for (const r of plugin.diffReporters) {
                this.diffReporters.delete(r.name);
            }
        }

        // Remove cache backends
        if (plugin.cacheBackends) {
            for (const c of plugin.cacheBackends) {
                this.cacheBackends.delete(c.name);
            }
        }

        // Remove header generators
        if (plugin.headerGenerators) {
            for (const h of plugin.headerGenerators) {
                this.headerGenerators.delete(h.name);
            }
        }

        // Remove conflict resolvers
        if (plugin.conflictResolvers) {
            for (const cr of plugin.conflictResolvers) {
                this.conflictResolvers.delete(cr.name);
            }
        }

        // Remove event hooks
        if (plugin.eventHooks) {
            for (const eh of plugin.eventHooks) {
                this.eventHooks.delete(eh.name);
            }
        }

        this.plugins.delete(name);
        this.logger.info(`Plugin "${name}" unregistered`);
    }

    // ── Query: Transformations ──

    getTransformation(type: string): TransformationPlugin | undefined {
        return this.transformations.get(type);
    }

    hasTransformation(type: string): boolean {
        return this.transformations.has(type);
    }

    listTransformations(): { type: string; name: string; isCustom: boolean }[] {
        return Array.from(this.transformations.values()).map((t) => ({
            type: t.type,
            name: t.name,
            isCustom: true,
        }));
    }

    // ── Query: Downloaders ──

    getDownloader(url: string): DownloaderPlugin | undefined {
        for (const [scheme, downloader] of this.downloaders) {
            if (url.startsWith(scheme)) return downloader;
        }
        return undefined;
    }

    listSchemes(): string[] {
        return Array.from(this.downloaders.keys());
    }

    // ── Query: Formatters ──

    getFormatter(format: string): FormatterPlugin | undefined {
        return this.formatters.get(format);
    }

    listFormatters(): string[] {
        return Array.from(this.formatters.keys());
    }

    // ── Query: Validators ──

    getValidator(name: string): ValidationPlugin | undefined {
        return this.validators.get(name);
    }

    getValidators(): ValidationPlugin[] {
        return Array.from(this.validators.values());
    }

    // ── Query: Parsers ──

    getParser(name: string): ParserPlugin | undefined {
        return this.parsers.get(name);
    }

    /** Find all parsers that support a given syntax dialect */
    getParsersForSyntax(syntax: string): ParserPlugin[] {
        return Array.from(this.parsers.values())
            .filter((p) => p.supportedSyntaxes.includes(syntax));
    }

    listParsers(): string[] {
        return Array.from(this.parsers.keys());
    }

    // ── Query: Diff Reporters ──

    getDiffReporter(name: string): DiffReporterPlugin | undefined {
        return this.diffReporters.get(name);
    }

    listDiffReporters(): string[] {
        return Array.from(this.diffReporters.keys());
    }

    // ── Query: Cache Backends ──

    getCacheBackend(name: string): CacheBackendPlugin | undefined {
        return this.cacheBackends.get(name);
    }

    listCacheBackends(): string[] {
        return Array.from(this.cacheBackends.keys());
    }

    // ── Query: Header Generators ──

    getHeaderGenerator(name: string): HeaderGeneratorPlugin | undefined {
        return this.headerGenerators.get(name);
    }

    getHeaderGenerators(): HeaderGeneratorPlugin[] {
        return Array.from(this.headerGenerators.values());
    }

    // ── Query: Conflict Resolvers ──

    getConflictResolver(name: string): ConflictResolverPlugin | undefined {
        return this.conflictResolvers.get(name);
    }

    listConflictResolvers(): string[] {
        return Array.from(this.conflictResolvers.keys());
    }

    // ── Query: Event Hooks ──

    getEventHook(name: string): EventHookPlugin | undefined {
        return this.eventHooks.get(name);
    }

    getEventHooks(): EventHookPlugin[] {
        return Array.from(this.eventHooks.values());
    }

    // ── Generic Plugin Queries ──

    getPlugin(name: string): Plugin | undefined {
        return this.plugins.get(name);
    }

    getPlugins(): Plugin[] {
        return Array.from(this.plugins.values());
    }

    listPlugins(): PluginManifest[] {
        return Array.from(this.plugins.values()).map((p) => p.manifest);
    }

    /** Total number of registered plugins */
    get size(): number {
        return this.plugins.size;
    }

    /**
     * Clears all registered plugins (calls `unregister` on each).
     */
    async clear(): Promise<void> {
        const names = Array.from(this.plugins.keys());
        for (const name of names) {
            await this.unregister(name);
        }
    }
}

/**
 * Creates a transformation wrapper from a plugin transformation
 */
export class PluginTransformationWrapper extends Transformation {
    /** The transformation type identifier */
    public readonly type: TransformationType;
    /** Human-readable name of the transformation */
    public readonly name: string;
    private readonly plugin: TransformationPlugin;

    /**
     * Creates a new PluginTransformationWrapper
     * @param plugin - The plugin transformation to wrap
     * @param logger - Logger instance for output
     */
    constructor(plugin: TransformationPlugin, logger?: ILogger) {
        super(logger);
        this.type = plugin.type as TransformationType;
        this.name = plugin.name;
        this.plugin = plugin;
    }

    /**
     * Executes the plugin transformation
     * @param rules - Array of rules to transform
     * @param context - Optional transformation context
     * @returns Transformed rules array
     */
    async execute(
        rules: readonly string[],
        context?: ITransformationContext,
    ): Promise<readonly string[]> {
        return this.plugin.execute(rules, context);
    }
}

/**
 * Creates a simple plugin from a transformation function
 */
export function createSimplePlugin(
    name: string,
    transformationFn: (rules: readonly string[]) => readonly string[],
): Plugin {
    return {
        manifest: {
            name,
            version: '1.0.0',
            description: `Custom transformation: ${name}`,
        },
        transformations: [{
            type: name,
            name,
            execute: (rules) => transformationFn(rules),
        }],
    };
}

/**
 * Global plugin registry instance
 */
export const globalRegistry: PluginRegistry = new PluginRegistry();
