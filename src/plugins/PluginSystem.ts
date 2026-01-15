/**
 * Plugin System
 * Allows extending the compiler with custom transformations and downloaders.
 */

import type { ILogger, ITransformationContext, TransformationType } from '../types/index.ts';
import { Transformation } from '../transformations/base/Transformation.ts';
import { logger as defaultLogger } from '../utils/logger.ts';
import { VERSION } from '../version.ts';

/**
 * Plugin metadata
 */
export interface PluginManifest {
    /** Plugin name */
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
}

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

/**
 * Complete plugin definition
 */
export interface Plugin {
    /** Plugin manifest */
    manifest: PluginManifest;
    /** Custom transformations provided by the plugin */
    transformations?: TransformationPlugin[];
    /** Custom downloaders provided by the plugin */
    downloaders?: DownloaderPlugin[];
    /** Plugin initialization function */
    init?: (context: PluginContext) => Promise<void> | void;
    /** Plugin cleanup function */
    cleanup?: () => Promise<void> | void;
}

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
    /** Logger instance */
    logger: ILogger;
    /** Plugin registry */
    registry: PluginRegistry;
    /** Compiler version */
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

/**
 * Plugin registry for managing loaded plugins
 */
export class PluginRegistry {
    private readonly plugins = new Map<string, Plugin>();
    private readonly transformations = new Map<string, TransformationPlugin>();
    private readonly downloaders = new Map<string, DownloaderPlugin>();
    private readonly logger: ILogger;

    /**
     * Creates a new PluginRegistry
     * @param logger - Logger instance for output
     */
    constructor(logger?: ILogger) {
        this.logger = logger ?? defaultLogger;
    }

    /**
     * Registers a plugin
     */
    async register(plugin: Plugin): Promise<void> {
        const name = plugin.manifest.name;

        if (this.plugins.has(name)) {
            throw new Error(`Plugin "${name}" is already registered`);
        }

        this.logger.info(`Registering plugin: ${name} v${plugin.manifest.version}`);

        // Register transformations
        if (plugin.transformations) {
            for (const transformation of plugin.transformations) {
                if (this.transformations.has(transformation.type)) {
                    throw new Error(
                        `Transformation "${transformation.type}" is already registered by another plugin`,
                    );
                }
                this.transformations.set(transformation.type, transformation);
                this.logger.debug(`Registered transformation: ${transformation.type}`);
            }
        }

        // Register downloaders
        if (plugin.downloaders) {
            for (const downloader of plugin.downloaders) {
                for (const scheme of downloader.schemes) {
                    if (this.downloaders.has(scheme)) {
                        throw new Error(
                            `Downloader for scheme "${scheme}" is already registered`,
                        );
                    }
                    this.downloaders.set(scheme, downloader);
                    this.logger.debug(`Registered downloader for scheme: ${scheme}`);
                }
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
     * Unregisters a plugin
     */
    async unregister(name: string): Promise<void> {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            return;
        }

        // Cleanup
        if (plugin.cleanup) {
            await plugin.cleanup();
        }

        // Remove transformations
        if (plugin.transformations) {
            for (const transformation of plugin.transformations) {
                this.transformations.delete(transformation.type);
            }
        }

        // Remove downloaders
        if (plugin.downloaders) {
            for (const downloader of plugin.downloaders) {
                for (const scheme of downloader.schemes) {
                    this.downloaders.delete(scheme);
                }
            }
        }

        this.plugins.delete(name);
        this.logger.info(`Plugin "${name}" unregistered`);
    }

    /**
     * Gets a custom transformation
     */
    getTransformation(type: string): TransformationPlugin | undefined {
        return this.transformations.get(type);
    }

    /**
     * Gets a downloader for a URL scheme
     */
    getDownloader(url: string): DownloaderPlugin | undefined {
        for (const [scheme, downloader] of this.downloaders) {
            if (url.startsWith(scheme)) {
                return downloader;
            }
        }
        return undefined;
    }

    /**
     * Lists all registered plugins
     */
    listPlugins(): PluginManifest[] {
        return Array.from(this.plugins.values()).map((p) => p.manifest);
    }

    /**
     * Lists all available transformations (built-in + custom)
     */
    listTransformations(): { type: string; name: string; isCustom: boolean }[] {
        const result: { type: string; name: string; isCustom: boolean }[] = [];

        // Add custom transformations
        for (const [type, transformation] of this.transformations) {
            result.push({
                type,
                name: transformation.name,
                isCustom: true,
            });
        }

        return result;
    }

    /**
     * Lists all registered URL schemes
     */
    listSchemes(): string[] {
        return Array.from(this.downloaders.keys());
    }

    /**
     * Checks if a transformation is available
     */
    hasTransformation(type: string): boolean {
        return this.transformations.has(type);
    }

    /**
     * Clears all registered plugins
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
 * Loads a plugin from a file path or URL
 */
export async function loadPlugin(
    path: string,
    options?: PluginLoadOptions,
): Promise<Plugin> {
    const opts: Required<PluginLoadOptions> = {
        allowRemote: false,
        validateManifest: true,
        initTimeout: 5000,
        ...options,
    };

    // Check if it's a remote URL
    const isRemote = path.startsWith('http://') || path.startsWith('https://');
    if (isRemote && !opts.allowRemote) {
        throw new Error('Loading plugins from remote URLs is disabled');
    }

    try {
        // Dynamic import
        const module = await import(path);
        const plugin = module.default || module;

        // Validate manifest
        if (opts.validateManifest) {
            if (!plugin.manifest) {
                throw new Error('Plugin is missing manifest');
            }
            if (!plugin.manifest.name || typeof plugin.manifest.name !== 'string') {
                throw new Error('Plugin manifest is missing valid name');
            }
            if (!plugin.manifest.version || typeof plugin.manifest.version !== 'string') {
                throw new Error('Plugin manifest is missing valid version');
            }
        }

        return plugin as Plugin;
    } catch (error) {
        throw new Error(`Failed to load plugin from "${path}": ${error}`);
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
