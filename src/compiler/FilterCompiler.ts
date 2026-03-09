import { ICompilerEvents, IConfiguration, ILogger, ISource, TransformationType } from '../types/index.ts';
import { ConfigurationValidator } from '../configuration/index.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { createEventBridgeHook, NoOpHookManager, TransformationHookManager } from '../transformations/TransformationHooks.ts';
import { SourceCompiler } from './SourceCompiler.ts';
import { HeaderGenerator } from './HeaderGenerator.ts';
import {
    addChecksumToHeader,
    BenchmarkCollector,
    CompilationError,
    CompilationMetrics,
    CompilerEventEmitter,
    ConfigurationError,
    createEventEmitter,
    ErrorUtils,
    logger as defaultLogger,
} from '../utils/index.ts';
import type { DiagnosticEvent, TracingContext } from '../diagnostics/index.ts';
import { createNoOpContext } from '../diagnostics/index.ts';
import type { DownloaderOptions } from '../downloader/index.ts';

/**
 * Result of compilation with optional metrics and diagnostics.
 */
export interface CompilationResult {
    /** The compiled rules */
    rules: string[];
    /** Optional compilation metrics */
    metrics?: CompilationMetrics;
    /** Optional diagnostic events */
    diagnostics?: DiagnosticEvent[];
}

/**
 * Injectable dependencies for the FilterCompiler.
 * Enables full testability and customization.
 */
export interface FilterCompilerDependencies {
    /** Configuration validator */
    validator?: ConfigurationValidator;
    /** Transformation pipeline */
    pipeline?: TransformationPipeline;
    /** Source compiler */
    sourceCompiler?: SourceCompiler;
    /** Header generator */
    headerGenerator?: HeaderGenerator;
}

/**
 * Options for configuring the FilterCompiler.
 *
 * All fields are optional. The most commonly used fields are:
 * - `logger` — route compilation messages to your own logger
 * - `events` — subscribe to source/transformation/compilation lifecycle events
 * - `hookManager` — attach fine-grained before/after/error hooks around each
 *   individual transformation in the pipeline
 *
 * ## Hook manager vs events
 *
 * `events` (via `ICompilerEvents`) and `hookManager` (via
 * `TransformationHookManager`) are two complementary observability layers:
 *
 * | Feature | `ICompilerEvents` | `TransformationHookManager` |
 * |---|---|---|
 * | Granularity | compiler-level (source start/complete, progress, etc.) | per-transformation (before/after/error) |
 * | Async support | callbacks are synchronous | hooks can be async |
 * | Error hooks | none for transformations | yes — `onTransformError` |
 * | Timing data | `durationMs` in complete event | `durationMs` in after hook |
 *
 * When you provide **both** `events` and `hookManager`, the compiler
 * automatically bridges `onTransformationStart`/`onTransformationComplete`
 * events through the hook manager so both systems fire.
 *
 * When you provide only `events` (the common case), the compiler internally
 * creates a `TransformationHookManager` wired to a bridge hook — no change to
 * existing usage is required.
 */
export interface FilterCompilerOptions {
    /** Logger for compilation messages — defaults to the module default logger */
    logger?: ILogger;
    /**
     * Compiler-level event handlers for observability.
     *
     * These fire at source and compilation boundaries. For per-transformation
     * hooks (including async hooks and error hooks) use `hookManager` instead.
     *
     * @see {@link ICompilerEvents}
     */
    events?: ICompilerEvents;
    /**
     * Transformation lifecycle hooks.
     *
     * Attach `beforeTransform`, `afterTransform`, and `onError` callbacks to
     * individual transformations in the pipeline. When omitted, a
     * {@link NoOpHookManager} is used (zero overhead).
     *
     * If `events` are also provided, the compiler automatically registers a
     * bridge hook that forwards `onTransformationStart` /
     * `onTransformationComplete` events — so both systems fire without
     * double-registration.
     *
     * @see {@link TransformationHookManager}
     * @see {@link createLoggingHook}
     * @see {@link createMetricsHook}
     */
    hookManager?: TransformationHookManager;
    /** Tracing context for diagnostics */
    tracingContext?: TracingContext;
    /** Injectable dependencies (for testing/customization) */
    dependencies?: FilterCompilerDependencies;
    /** Options for the HTTP downloader (timeout, retries, user-agent) */
    downloaderOptions?: DownloaderOptions;
}

/**
 * Main compiler class for hostlist compilation.
 * Orchestrates the entire compilation process using async operations throughout.
 */
export class FilterCompiler {
    private readonly logger: ILogger;
    private readonly validator: ConfigurationValidator;
    private readonly pipeline: TransformationPipeline;
    private readonly sourceCompiler: SourceCompiler;
    private readonly eventEmitter: CompilerEventEmitter;
    private readonly headerGenerator: HeaderGenerator;
    private readonly tracingContext: TracingContext;

    /**
     * Creates a new FilterCompiler instance.
     *
     * @param optionsOrLogger - Compiler configuration options or legacy logger
     *
     * ## Hook manager resolution
     *
     * The constructor resolves which `TransformationHookManager` to use
     * according to the following rules (evaluated in order):
     *
     * 1. **Legacy path** (`ILogger` passed directly): no hooks, uses
     *    `NoOpHookManager`.
     * 2. **`hookManager` + `events` both provided**: uses the supplied
     *    `hookManager` and automatically appends the bridge hook so
     *    `ICompilerEvents.onTransformationStart` / `onTransformationComplete`
     *    still fire.
     * 3. **Only `events` provided** (most common): creates a
     *    `TransformationHookManager` pre-wired with `createEventBridgeHook` so
     *    transformation events arrive at `ICompilerEvents` as before.
     * 4. **Neither provided**: uses `NoOpHookManager` (zero overhead).
     *
     * @example
     * ```ts
     * // Modern API — hooks + events together
     * const compiler = new FilterCompiler({
     *   logger: customLogger,
     *   events: {
     *     onCompilationStart: (e) => console.log('Starting', e.configName),
     *     onCompilationComplete: (e) => console.log('Done in', e.totalDurationMs, 'ms'),
     *   },
     *   hookManager: new TransformationHookManager(createLoggingHook(customLogger)),
     * });
     *
     * // Modern API — events only (backward-compatible)
     * const compiler = new FilterCompiler({
     *   events: {
     *     onTransformationComplete: (e) => console.log(e.name, e.durationMs),
     *   },
     * });
     *
     * // Legacy API (still supported)
     * const compiler = new FilterCompiler(logger);
     * ```
     */
    constructor(optionsOrLogger?: FilterCompilerOptions | ILogger) {
        // Support both modern options object and legacy logger parameter
        let deps: FilterCompilerDependencies | undefined;
        let downloaderOptions: DownloaderOptions | undefined;
        let resolvedHookManager: TransformationHookManager;

        if (optionsOrLogger && 'info' in optionsOrLogger) {
            // ── Legacy path ──────────────────────────────────────────────────
            // Caller passed an ILogger directly (pre-options-object API).
            // No events and no hook manager, so use the cheapest defaults.
            this.logger = optionsOrLogger;
            this.eventEmitter = createEventEmitter();
            this.tracingContext = createNoOpContext();
            resolvedHookManager = new NoOpHookManager();
        } else {
            // ── Modern path ───────────────────────────────────────────────────
            const options = optionsOrLogger as FilterCompilerOptions | undefined;
            this.logger = options?.logger ?? defaultLogger;
            this.eventEmitter = createEventEmitter(options?.events);
            this.tracingContext = options?.tracingContext ?? createNoOpContext();
            deps = options?.dependencies;
            downloaderOptions = options?.downloaderOptions;

            if (options?.hookManager) {
                // Case A: caller supplied a custom hook manager.
                //
                // We never mutate the caller's instance because:
                //  1. The same manager might be reused across multiple compiler
                //     instances, causing duplicate bridge-hook registrations.
                //  2. If the caller passes a NoOpHookManager, its hasHooks()
                //     always returns false, so any hooks appended to it would
                //     never execute in the pipeline.
                //
                // Instead we compose an internal manager that (a) includes the
                // bridge hook when transformation events are registered, and
                // (b) delegates to the caller's manager when it has hooks.
                const userManager = options.hookManager;
                // Only bridge for transformation-specific events, not any listener
                // (e.g. onProgress alone must not cause hook overhead per-transformation).
                const hasTransformListeners = !!(
                    options.events?.onTransformationStart ||
                    options.events?.onTransformationComplete
                );

                if (!hasTransformListeners && !userManager.hasHooks()) {
                    // Neither side needs hooks — zero-cost default
                    resolvedHookManager = new NoOpHookManager();
                } else {
                    const composed = new TransformationHookManager();
                    if (hasTransformListeners) {
                        // Inject bridge so ICompilerEvents still fires
                        const bridge = createEventBridgeHook(this.eventEmitter);
                        for (const h of bridge.beforeTransform ?? []) composed.onBeforeTransform(h);
                        for (const h of bridge.afterTransform ?? []) composed.onAfterTransform(h);
                    }
                    if (userManager.hasHooks()) {
                        // Delegate to the user's manager without touching its internals
                        composed.onBeforeTransform((ctx) => userManager.executeBeforeHooks(ctx));
                        composed.onAfterTransform((ctx) => userManager.executeAfterHooks(ctx));
                        composed.onTransformError((ctx) => userManager.executeErrorHooks(ctx));
                    }
                    resolvedHookManager = composed;
                }
            } else if (options?.events?.onTransformationStart || options?.events?.onTransformationComplete) {
                // Case B: no custom hook manager, but transformation event listeners are present.
                // We only check for transformation-specific listeners here — not hasListeners() —
                // to avoid hook overhead when only unrelated events (e.g. onProgress) are registered.
                resolvedHookManager = new TransformationHookManager(createEventBridgeHook(this.eventEmitter));
            } else {
                // Case C: no hooks and no transformation events — zero-cost no-op.
                resolvedHookManager = new NoOpHookManager();
            }
        }

        // Use injected dependencies or create defaults
        this.validator = deps?.validator ?? new ConfigurationValidator();
        this.pipeline = deps?.pipeline ?? new TransformationPipeline(undefined, this.logger, this.eventEmitter, resolvedHookManager);
        this.sourceCompiler = deps?.sourceCompiler ?? new SourceCompiler({
            pipeline: this.pipeline,
            logger: this.logger,
            eventEmitter: this.eventEmitter,
            downloaderOptions,
        });
        this.headerGenerator = deps?.headerGenerator ?? new HeaderGenerator();
    }

    /**
     * Compiles a filter list using the specified configuration.
     * @param configuration - Compilation configuration
     * @returns Array of compiled rules
     */
    public async compile(configuration: IConfiguration): Promise<string[]> {
        const result = await this.compileWithMetrics(configuration, false);
        return result.rules;
    }

    /**
     * Compiles a filter list with optional performance metrics.
     * @param configuration - Compilation configuration
     * @param benchmark - Whether to collect performance metrics
     * @returns Compilation result with rules, optional metrics, and diagnostics
     */
    public async compileWithMetrics(
        configuration: IConfiguration,
        benchmark: boolean = false,
    ): Promise<CompilationResult> {
        const collector = benchmark ? new BenchmarkCollector() : null;
        collector?.start();
        const compilationStartTime = performance.now();

        // Get configuration name safely (it's required but we handle missing gracefully)
        const configName = configuration?.name ?? 'unknown';

        // Start tracing compilation - use placeholder values until validation passes
        const compilationEventId = this.tracingContext.diagnostics.operationStart(
            'compileFilterList',
            {
                name: configName,
                sourceCount: 0,
                transformationCount: 0,
            },
        );

        try {
            this.logger.info('Starting the compiler');

            // Trace validation
            const validationEventId = this.tracingContext.diagnostics.operationStart(
                'validateConfiguration',
                {
                    name: configName,
                },
            );

            const validationResult = this.validator.validate(configuration);
            if (!validationResult.valid) {
                const validationError = new ConfigurationError(
                    validationResult.errorsText ?? 'Unknown validation error',
                    configName,
                );
                this.tracingContext.diagnostics.operationError(validationEventId, validationError);
                this.logger.error(validationError.message);
                throw validationError;
            }

            this.tracingContext.diagnostics.operationComplete(validationEventId, { valid: true });
            this.logger.info(`Configuration: ${JSON.stringify(configuration, null, 4)}`);

            const totalSources = configuration.sources.length;

            // Emit compilation start event: fires after configuration validation
            // has passed but before any source is fetched or downloaded.
            // This is the earliest point at which we have authoritative values for
            // sourceCount and transformationCount (validation guarantees they're
            // well-formed), making it useful for pre-compilation logging and
            // cache-warming decisions.
            this.eventEmitter.emitCompilationStart({
                configName,
                sourceCount: totalSources,
                transformationCount: (configuration.transformations ?? []).length,
                timestamp: Date.now(),
            });

            // Trace source compilation
            const sourcesEventId = this.tracingContext.diagnostics.operationStart(
                'compileSources',
                {
                    totalSources,
                },
            );

            // Compile all sources in parallel for better performance
            // Each source emits its own events through the SourceCompiler
            const sourceResults = await (collector
                ? collector.timeAsync(
                    'Fetch & compile sources',
                    () =>
                        Promise.all(
                            configuration.sources.map(async (source, index) => ({
                                source,
                                rules: await this.sourceCompiler.compile(
                                    source,
                                    index,
                                    totalSources,
                                ),
                            })),
                        ),
                    (results) => results.reduce((sum, r) => sum + r.rules.length, 0),
                )
                : Promise.all(
                    configuration.sources.map(async (source, index) => ({
                        source,
                        rules: await this.sourceCompiler.compile(source, index, totalSources),
                    })),
                ));

            this.tracingContext.diagnostics.operationComplete(sourcesEventId, {
                totalRules: sourceResults.reduce((sum, r) => sum + r.rules.length, 0),
            });

            collector?.setSourceCount(configuration.sources.length);

            // Combine results maintaining order, using push for efficiency
            let finalList: string[] = [];
            for (const { source, rules } of sourceResults) {
                const sourceHeader = this.prepareSourceHeader(source);
                finalList.push(...sourceHeader, ...rules);
            }

            const inputRuleCount = finalList.length;
            collector?.setRuleCount(inputRuleCount);

            // Record metrics
            this.tracingContext.diagnostics.recordMetric('inputRuleCount', inputRuleCount, 'rules');

            // Emit progress for transformation phase
            const transformations = configuration.transformations || [];
            this.eventEmitter.emitProgress({
                phase: 'transformations',
                current: 0,
                total: transformations.length,
                message: `Applying ${transformations.length} transformations`,
            });

            // Trace transformations
            const transformEventId = this.tracingContext.diagnostics.operationStart(
                'applyTransformations',
                {
                    count: transformations.length,
                    inputRuleCount,
                },
            );

            // Apply global transformations
            finalList = await (collector
                ? collector.timeAsync(
                    'Apply transformations',
                    () =>
                        this.pipeline.transform(
                            finalList,
                            configuration,
                            transformations as TransformationType[],
                        ),
                    (result) => result.length,
                )
                : this.pipeline.transform(
                    finalList,
                    configuration,
                    transformations as TransformationType[],
                ));

            this.tracingContext.diagnostics.operationComplete(transformEventId, {
                outputRuleCount: finalList.length,
                reducedBy: inputRuleCount - finalList.length,
            });

            // Emit finalize progress
            this.eventEmitter.emitProgress({
                phase: 'finalize',
                current: 1,
                total: 1,
                message: 'Finalizing output',
            });

            // Prepend the list header and return combined result
            const header = this.prepareHeader(configuration);
            this.logger.info(`Final length of the list is ${header.length + finalList.length}`);

            let rules = [...header, ...finalList];

            // Add checksum to the header
            rules = await addChecksumToHeader(rules);

            collector?.setOutputRuleCount(rules.length);

            const metrics = collector?.finish();
            if (metrics) {
                this.logger.info(collector!.generateReport());
            }

            // Record final metrics
            this.tracingContext.diagnostics.recordMetric('outputRuleCount', rules.length, 'rules');
            this.tracingContext.diagnostics.recordMetric(
                'compilationDuration',
                performance.now() - compilationStartTime,
                'ms',
            );

            // Emit compilation complete event
            const totalDurationMs = performance.now() - compilationStartTime;
            this.eventEmitter.emitCompilationComplete({
                ruleCount: rules.length,
                totalDurationMs,
                sourceCount: totalSources,
                transformationCount: transformations.length,
            });

            // Complete compilation tracing
            this.tracingContext.diagnostics.operationComplete(compilationEventId, {
                ruleCount: rules.length,
                totalDurationMs,
            });

            return {
                rules,
                metrics,
                diagnostics: this.tracingContext.diagnostics.getEvents(),
            };
        } catch (error) {
            // Normalize error and record in diagnostics
            const normalizedError = ErrorUtils.toError(error);
            this.tracingContext.diagnostics.operationError(compilationEventId, normalizedError);

            // Wrap in CompilationError if not already a typed error
            if (error instanceof ConfigurationError || error instanceof CompilationError) {
                throw error;
            }

            throw new CompilationError(
                `Compilation failed: ${normalizedError.message}`,
                undefined,
                normalizedError,
            );
        }
    }

    /**
     * Prepares the main list header.
     */
    private prepareHeader(configuration: IConfiguration): string[] {
        return this.headerGenerator.generateListHeader(configuration);
    }

    /**
     * Prepares the source header.
     */
    private prepareSourceHeader(source: ISource): string[] {
        return this.headerGenerator.generateSourceHeader(source);
    }
}

/**
 * Convenience function for compiling a filter list.
 * Maintains backward compatibility with the original API.
 */
export async function compile(configuration: IConfiguration): Promise<string[]> {
    const compiler = new FilterCompiler();
    return compiler.compile(configuration);
}
