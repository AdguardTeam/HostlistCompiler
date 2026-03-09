/**
 * @module TransformationHooks
 *
 * Transformation lifecycle hooks for fine-grained observability and extensibility.
 *
 * ## Overview
 *
 * The hooks system gives you a synchronous or asynchronous callback at three
 * precise points in each transformation's lifetime:
 *
 * | Hook | When it fires | Typical use |
 * |---|---|---|
 * | `beforeTransform` | just before a transformation processes rules | logging, rate-limiting, input inspection |
 * | `afterTransform` | just after successful completion | timing, metrics collection, output inspection |
 * | `onError` | when a transformation throws | error reporting, dead-letter queuing |
 *
 * ## Design decisions
 *
 * **Why hooks instead of subclassing?**
 * Subclassing the `Transformation` base class to add observability forces you to
 * own the full execution model. Hooks are opt-in decorators attached externally,
 * which means they compose cleanly across transformations without modifying any
 * transformation code.
 *
 * **Why `TransformationHookManager` instead of bare callbacks?**
 * A dedicated manager class keeps the `TransformationPipeline` clean (it only
 * calls three well-typed methods), while the manager itself handles ordering,
 * registration, and the `hasHooks()` fast path.
 *
 * **Why `NoOpHookManager`?**
 * When no hooks are registered the pipeline should pay zero overhead. A
 * `NoOpHookManager` that overrides all three execute methods with empty
 * implementations — and returns `false` from `hasHooks()` — is the cleanest
 * way to guarantee that the hot transform loop never touches any hook plumbing
 * under normal (hook-free) operation.
 *
 * **Why `createEventBridgeHook`?**
 * Before this system was wired in, the `TransformationPipeline` called
 * `eventEmitter.emitTransformationStart` / `emitTransformationComplete`
 * directly. Those calls were removed from the loop and replaced with hook
 * invocations. The bridge hook re-implements that forwarding inside the hook
 * system so the existing `ICompilerEvents.onTransformationStart` /
 * `onTransformationComplete` callbacks continue to work with zero code changes
 * on the caller side.
 *
 * ## Quick-start
 *
 * ```ts
 * import {
 *   FilterCompiler,
 *   TransformationHookManager,
 *   createLoggingHook,
 * } from '@jk-com/adblock-compiler';
 *
 * const hookManager = new TransformationHookManager(createLoggingHook(console));
 *
 * const compiler = new FilterCompiler({ hookManager });
 * await compiler.compile(config);
 * // → [Transform] Starting RemoveComments with 4123 rules
 * // → [Transform] Completed RemoveComments: 4123 → 3891 rules (-232) in 1.40ms
 * ```
 *
 * @see {@link TransformationHookManager} for registering hooks
 * @see {@link NoOpHookManager} for the zero-cost default
 * @see {@link createEventBridgeHook} to unify hooks with `ICompilerEvents`
 * @see {@link createLoggingHook} for a ready-made logging hook factory
 * @see {@link createMetricsHook} for a ready-made metrics hook factory
 */

import type { TransformationType } from '../types/index.ts';

/**
 * Shared context object passed to every hook callback.
 *
 * Both `beforeTransform` and `onError` hooks receive exactly this shape.
 * The `afterTransform` hook extends it with `inputCount`, `outputCount`, and
 * `durationMs` (see {@link AfterTransformHook}).
 *
 * @example
 * ```ts
 * manager.onBeforeTransform((ctx) => {
 *   console.log(`About to run ${ctx.name} on ${ctx.ruleCount} rules`);
 * });
 * ```
 */
export interface TransformationHookContext {
    /** Name of the transformation (same string as the `TransformationType` enum value) */
    name: string;
    /** Transformation type enum value — use this for type-safe comparisons */
    type: TransformationType;
    /**
     * Number of rules at the time the hook is called.
     *
     * - In `beforeTransform` hooks this equals the **input** rule count for the
     *   current transformation.
     * - In `onError` hooks this equals the input count at the point of failure.
     * - In `afterTransform` hooks this equals the **output** count; use
     *   `inputCount` / `outputCount` on the extended context instead for
     *   clarity.
     */
    ruleCount: number;
    /** Unix millisecond timestamp captured immediately before hook execution */
    timestamp: number;
    /** Duration in milliseconds — present only on `afterTransform` extended context */
    durationMs?: number;
    /** Optional free-form metadata that hook producers can attach for consumers */
    metadata?: Record<string, unknown>;
}

/**
 * Callback fired synchronously or asynchronously **before** a transformation
 * processes its rule array.
 *
 * Useful for: input inspection, rate-limiting, pre-validation logging.
 *
 * @param context - Hook context with the transformation name and input rule count.
 * @returns `void` or a `Promise<void>`. The pipeline awaits the returned
 *   promise before executing the transformation, so async operations (e.g.
 *   external metric emission) are fully supported.
 */
export type BeforeTransformHook = (context: TransformationHookContext) => void | Promise<void>;

/**
 * Callback fired synchronously or asynchronously **after** a transformation
 * successfully completes.
 *
 * Extends {@link TransformationHookContext} with three additional fields:
 * - `inputCount` — rule count entering the transformation
 * - `outputCount` — rule count exiting the transformation
 * - `durationMs` — wall-clock execution time
 *
 * Useful for: timing metrics, rule-count diff reporting, telemetry.
 *
 * @param context - Extended context including timing and rule counts.
 */
export type AfterTransformHook = (
    context: TransformationHookContext & {
        inputCount: number;
        outputCount: number;
        durationMs: number;
    },
) => void | Promise<void>;

/**
 * Callback fired when a transformation throws an unhandled error.
 *
 * The hook is an **observer only** — it cannot suppress or replace the error.
 * After all registered error hooks have been awaited the pipeline re-throws the
 * original error so normal error-handling flow is preserved.
 *
 * Useful for: error reporting, dead-letter logging, alerting.
 *
 * @param context - Context including the transformation name and the thrown error.
 */
export type TransformErrorHook = (
    context: TransformationHookContext & {
        error: Error;
    },
) => void | Promise<void>;

/**
 * Declarative hook configuration object.
 *
 * Pass this to the {@link TransformationHookManager} constructor to register
 * one or more hooks in a single expression:
 *
 * ```ts
 * const manager = new TransformationHookManager({
 *   beforeTransform: [(ctx) => console.log('start', ctx.name)],
 *   afterTransform:  [(ctx) => console.log('done', ctx.durationMs + 'ms')],
 *   onError:         [(ctx) => console.error(ctx.error)],
 * });
 * ```
 *
 * All three arrays are optional. An empty config object is equivalent to no
 * hooks at all.
 */
export interface TransformationHookConfig {
    /** Hooks fired before each transformation — can contain multiple callbacks */
    beforeTransform?: BeforeTransformHook[];
    /** Hooks fired after each transformation completes — can contain multiple callbacks */
    afterTransform?: AfterTransformHook[];
    /** Hooks fired when a transformation throws — can contain multiple callbacks */
    onError?: TransformErrorHook[];
}

/**
 * Manages a collection of before/after/error hooks and executes them around
 * each transformation in the pipeline.
 *
 * ## Usage
 *
 * ```ts
 * import { FilterCompiler, TransformationHookManager } from '@jk-com/adblock-compiler';
 *
 * const hookManager = new TransformationHookManager();
 *
 * // Fluent registration
 * hookManager
 *   .onBeforeTransform((ctx) => console.log(`▶ ${ctx.name} — ${ctx.ruleCount} rules`))
 *   .onAfterTransform((ctx) => console.log(`✔ ${ctx.name} — ${ctx.durationMs.toFixed(2)}ms`))
 *   .onTransformError((ctx) => console.error(`✖ ${ctx.name}`, ctx.error));
 *
 * const compiler = new FilterCompiler({ hookManager });
 * await compiler.compile(config);
 * ```
 *
 * ## Hook execution order
 *
 * Hooks within each category are executed in **registration order** (FIFO).
 * Each hook is `await`-ed before the next, so you can safely perform
 * asynchronous work (e.g. writing to a database, emitting a metric) inside a
 * hook without worrying about race conditions.
 *
 * ## Error isolation
 *
 * If a `beforeTransform` or `afterTransform` hook throws, the exception
 * propagates up and will abort the pipeline. Wrap hook bodies in try-catch if
 * you want them to be non-fatal.
 *
 * `onError` hooks are also awaited sequentially before the pipeline re-throws
 * the original transformation error — they are observers, not catch handlers.
 *
 * ## Performance
 *
 * When no hooks are registered `hasHooks()` returns `false` and the pipeline
 * skips all hook-invocation overhead entirely. For zero-hook scenarios use
 * {@link NoOpHookManager} (the default) which overrides the execute methods to
 * be empty no-ops, completely eliminating even the `hasHooks()` check cost.
 */
export class TransformationHookManager {
    private readonly beforeHooks: BeforeTransformHook[] = [];
    private readonly afterHooks: AfterTransformHook[] = [];
    private readonly errorHooks: TransformErrorHook[] = [];

    /**
     * Creates a new `TransformationHookManager`.
     *
     * Pass an initial {@link TransformationHookConfig} to bulk-register hooks in
     * one call, or start with an empty manager and use the fluent `on*` methods:
     *
     * ```ts
     * // Declarative (all hooks at construction time)
     * const mgr = new TransformationHookManager(createLoggingHook(myLogger));
     *
     * // Imperative (add hooks later)
     * const mgr = new TransformationHookManager();
     * mgr.onAfterTransform(myTimingHook);
     * ```
     */
    constructor(config?: TransformationHookConfig) {
        if (config?.beforeTransform) {
            this.beforeHooks.push(...config.beforeTransform);
        }
        if (config?.afterTransform) {
            this.afterHooks.push(...config.afterTransform);
        }
        if (config?.onError) {
            this.errorHooks.push(...config.onError);
        }
    }

    /**
     * Register a hook to run **before** each transformation.
     *
     * Multiple hooks can be registered; they fire in registration order.
     *
     * @returns `this` for fluent chaining.
     */
    onBeforeTransform(hook: BeforeTransformHook): this {
        this.beforeHooks.push(hook);
        return this;
    }

    /**
     * Register a hook to run **after** each transformation completes.
     *
     * Multiple hooks can be registered; they fire in registration order.
     *
     * @returns `this` for fluent chaining.
     */
    onAfterTransform(hook: AfterTransformHook): this {
        this.afterHooks.push(hook);
        return this;
    }

    /**
     * Register a hook to run when a transformation throws an error.
     *
     * Error hooks are observers — they cannot suppress or replace the thrown
     * error. After all error hooks complete, the pipeline re-throws the
     * original error unchanged.
     *
     * @returns `this` for fluent chaining.
     */
    onTransformError(hook: TransformErrorHook): this {
        this.errorHooks.push(hook);
        return this;
    }

    /**
     * Execute all registered `beforeTransform` hooks in order.
     *
     * Called by the pipeline immediately before each `transformation.execute()`
     * call. Each hook is awaited sequentially.
     */
    async executeBeforeHooks(context: TransformationHookContext): Promise<void> {
        for (const hook of this.beforeHooks) {
            await hook(context);
        }
    }

    /**
     * Execute all registered `afterTransform` hooks in order.
     *
     * Called by the pipeline immediately after a successful
     * `transformation.execute()` call. Each hook is awaited sequentially.
     * The context includes the wall-clock duration and rule counts for diffing.
     */
    async executeAfterHooks(
        context: TransformationHookContext & {
            inputCount: number;
            outputCount: number;
            durationMs: number;
        },
    ): Promise<void> {
        for (const hook of this.afterHooks) {
            await hook(context);
        }
    }

    /**
     * Execute all registered `onError` hooks in order.
     *
     * Called by the pipeline inside the try-catch that wraps each
     * `transformation.execute()`. Each hook is awaited sequentially.
     * After all hooks have run the pipeline re-throws the original error.
     */
    async executeErrorHooks(
        context: TransformationHookContext & { error: Error },
    ): Promise<void> {
        for (const hook of this.errorHooks) {
            await hook(context);
        }
    }

    /**
     * Returns `true` if at least one hook of any type has been registered.
     *
     * The `TransformationPipeline` calls this as a fast-path guard before
     * each hook execution block. When no hooks are registered the pipeline
     * avoids constructing context objects and awaiting async calls entirely,
     * keeping the hot transform loop overhead at zero.
     */
    hasHooks(): boolean {
        return (
            this.beforeHooks.length > 0 ||
            this.afterHooks.length > 0 ||
            this.errorHooks.length > 0
        );
    }

    /**
     * Remove all registered hooks from this manager.
     *
     * Useful in tests or when you want to reconfigure a manager without
     * creating a new instance.
     */
    clear(): void {
        this.beforeHooks.length = 0;
        this.afterHooks.length = 0;
        this.errorHooks.length = 0;
    }
}

/**
 * A `TransformationHookManager` that does absolutely nothing.
 *
 * ## Why this exists
 *
 * The `TransformationPipeline` always holds a reference to a
 * `TransformationHookManager`. Rather than null-checking on every iteration,
 * the pipeline uses `NoOpHookManager` as its default. All three `execute*`
 * methods are overridden to be empty, and `hasHooks()` always returns `false`,
 * so the pipeline's `if (hookManager.hasHooks())` guard short-circuits
 * immediately with no virtual-dispatch overhead.
 *
 * ## When to use
 *
 * You never need to construct this directly. It is automatically used as the
 * default in:
 * - `new TransformationPipeline()` (no `hookManager` arg)
 * - `new FilterCompiler()` (no `hookManager` in options)
 * - `new FilterCompiler(logger)` (legacy constructor path)
 */
export class NoOpHookManager extends TransformationHookManager {
    override async executeBeforeHooks(_context: TransformationHookContext): Promise<void> {
        // No-op
    }

    override async executeAfterHooks(
        _context: TransformationHookContext & {
            inputCount: number;
            outputCount: number;
            durationMs: number;
        },
    ): Promise<void> {
        // No-op
    }

    override async executeErrorHooks(
        _context: TransformationHookContext & { error: Error },
    ): Promise<void> {
        // No-op
    }

    override hasHooks(): boolean {
        return false;
    }
}

/**
 * Create a hook configuration that logs transformation start/complete/error
 * messages to any object implementing `{ info, error }`.
 *
 * Output format:
 * ```
 * [Transform] Starting RemoveComments with 4123 rules
 * [Transform] Completed RemoveComments: 4123 → 3891 rules (-232) in 1.40ms
 * [Transform] Error in Deduplicate: out of memory
 * ```
 *
 * @param logger - Any object with `info(msg)` and `error(msg)` methods.
 *   Typically your compiler logger, `console`, or any adapter.
 * @returns A {@link TransformationHookConfig} ready to pass to
 *   `new TransformationHookManager(config)`.
 *
 * @example
 * ```ts
 * const mgr = new TransformationHookManager(createLoggingHook(myLogger));
 * const compiler = new FilterCompiler({ hookManager: mgr });
 * ```
 */
export function createLoggingHook(
    logger: { info: (msg: string) => void; error: (msg: string) => void },
): TransformationHookConfig {
    return {
        beforeTransform: [
            (ctx) => {
                logger.info(`[Transform] Starting ${ctx.name} with ${ctx.ruleCount} rules`);
            },
        ],
        afterTransform: [
            (ctx) => {
                const diff = ctx.inputCount - ctx.outputCount;
                logger.info(
                    `[Transform] Completed ${ctx.name}: ${ctx.inputCount} → ${ctx.outputCount} rules ` +
                        `(${diff >= 0 ? '-' : '+'}${Math.abs(diff)}) in ${ctx.durationMs.toFixed(2)}ms`,
                );
            },
        ],
        onError: [
            (ctx) => {
                logger.error(`[Transform] Error in ${ctx.name}: ${ctx.error.message}`);
            },
        ],
    };
}

/**
 * Create a hook configuration that records per-transformation timing and
 * rule-count diff data to an arbitrary metrics collector.
 *
 * Only an `afterTransform` hook is registered — metrics are recorded after
 * each transformation completes, capturing wall-clock duration and the net
 * change in rule count (`inputCount - outputCount`).
 *
 * @param collector - Any object with a `record(name, durationMs, rulesDiff)`
 *   method. Wire this to Prometheus, StatsD, OpenTelemetry, a simple in-memory
 *   store, or any custom sink.
 * @returns A {@link TransformationHookConfig} ready to pass to
 *   `new TransformationHookManager(config)`.
 *
 * @example
 * ```ts
 * const timings: Record<string, number> = {};
 * const collector = {
 *   record: (name, durationMs) => { timings[name] = durationMs; },
 * };
 * const mgr = new TransformationHookManager(createMetricsHook(collector));
 * const compiler = new FilterCompiler({ hookManager: mgr });
 * await compiler.compile(config);
 * console.log(timings); // { RemoveComments: 1.4, Deduplicate: 22.7, … }
 * ```
 */
export function createMetricsHook(
    collector: { record: (name: string, durationMs: number, rulesDiff: number) => void },
): TransformationHookConfig {
    return {
        afterTransform: [
            (ctx) => {
                collector.record(ctx.name, ctx.durationMs, ctx.inputCount - ctx.outputCount);
            },
        ],
    };
}

/**
 * Create a hook configuration that **bridges** the transformation hook system
 * into the compiler's `ICompilerEvents` / `CompilerEventEmitter` event bus.
 *
 * ## Why this exists
 *
 * The `TransformationPipeline` previously called
 * `eventEmitter.emitTransformationStart` / `emitTransformationComplete`
 * **directly** inside its transform loop. When the pipeline was updated to use
 * hooks instead, those direct calls were removed to avoid double-firing. This
 * factory re-implements that forwarding as a hook so the existing
 * `ICompilerEvents.onTransformationStart` / `onTransformationComplete`
 * callbacks continue to work with no changes on the caller side.
 *
 * ## How it's used automatically
 *
 * `FilterCompiler` and `WorkerCompiler` automatically create and register this
 * bridge hook when `ICompilerEvents` listeners are present but no custom
 * `hookManager` is provided:
 *
 * ```
 * new FilterCompiler({ events: { onTransformationStart: (e) => … } })
 *        ↓ internally
 * resolvedHookManager = new TransformationHookManager(createEventBridgeHook(emitter))
 * ```
 *
 * This means existing code that uses `ICompilerEvents` continues to receive
 * transformation events without any changes.
 *
 * ## Using it explicitly
 *
 * You can also use it explicitly when you want to add your own hooks **and**
 * keep `ICompilerEvents` working:
 *
 * ```ts
 * const hookManager = new TransformationHookManager();
 * hookManager
 *   .onBeforeTransform(myCustomHook)
 *   .onAfterTransform(myTimingHook);
 *
 * // Manually wire in the bridge so onTransformationStart / Complete still fire
 * const bridge = createEventBridgeHook(eventEmitter);
 * for (const h of bridge.beforeTransform ?? []) hookManager.onBeforeTransform(h);
 * for (const h of bridge.afterTransform  ?? []) hookManager.onAfterTransform(h);
 * ```
 *
 * When you pass `hookManager` to `FilterCompilerOptions`, the compiler detects
 * that both a custom hook manager and an event emitter with listeners are
 * present, and performs this bridging automatically.
 *
 * @param eventEmitter - An object exposing `emitTransformationStart` and
 *   `emitTransformationComplete`. In practice this is always a
 *   {@link CompilerEventEmitter}, but the interface is duck-typed so it works
 *   with mocks in tests.
 * @returns A {@link TransformationHookConfig} with `beforeTransform` and
 *   `afterTransform` arrays populated. `onError` is intentionally omitted —
 *   `ICompilerEvents` has no error hook for transformations.
 */
export function createEventBridgeHook(
    eventEmitter: {
        emitTransformationStart: (event: { name: string; inputCount: number }) => void;
        emitTransformationComplete: (event: { name: string; inputCount: number; outputCount: number; durationMs: number }) => void;
    },
): TransformationHookConfig {
    return {
        beforeTransform: [
            (ctx) => {
                eventEmitter.emitTransformationStart({ name: ctx.name, inputCount: ctx.ruleCount });
            },
        ],
        afterTransform: [
            (ctx) => {
                eventEmitter.emitTransformationComplete({
                    name: ctx.name,
                    inputCount: ctx.inputCount,
                    outputCount: ctx.outputCount,
                    durationMs: ctx.durationMs,
                });
            },
        ],
    };
}
