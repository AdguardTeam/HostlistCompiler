/**
 * Transformation hooks system for extensibility.
 * Provides before/after hooks for transformation pipeline.
 */

import type { TransformationType } from '../types/index.ts';

/**
 * Hook context passed to transformation hooks.
 */
export interface TransformationHookContext {
    /** Name of the transformation */
    name: string;
    /** Transformation type enum value */
    type: TransformationType;
    /** Number of rules at this point */
    ruleCount: number;
    /** Timestamp when the hook was called */
    timestamp: number;
    /** Duration (only in afterTransform) */
    durationMs?: number;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Hook called before a transformation runs.
 */
export type BeforeTransformHook = (context: TransformationHookContext) => void | Promise<void>;

/**
 * Hook called after a transformation completes.
 */
export type AfterTransformHook = (
    context: TransformationHookContext & {
        inputCount: number;
        outputCount: number;
        durationMs: number;
    },
) => void | Promise<void>;

/**
 * Hook called when a transformation errors.
 */
export type TransformErrorHook = (
    context: TransformationHookContext & {
        error: Error;
    },
) => void | Promise<void>;

/**
 * Hook configuration for a transformation hook manager.
 */
export interface TransformationHookConfig {
    /** Hooks called before each transformation */
    beforeTransform?: BeforeTransformHook[];
    /** Hooks called after each transformation */
    afterTransform?: AfterTransformHook[];
    /** Hooks called when a transformation errors */
    onError?: TransformErrorHook[];
}

/**
 * Manager for transformation hooks.
 * Allows registering and executing hooks around transformations.
 */
export class TransformationHookManager {
    private readonly beforeHooks: BeforeTransformHook[] = [];
    private readonly afterHooks: AfterTransformHook[] = [];
    private readonly errorHooks: TransformErrorHook[] = [];

    /**
     * Create a new hook manager with optional initial hooks.
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
     * Register a hook to run before transformations.
     */
    onBeforeTransform(hook: BeforeTransformHook): this {
        this.beforeHooks.push(hook);
        return this;
    }

    /**
     * Register a hook to run after transformations.
     */
    onAfterTransform(hook: AfterTransformHook): this {
        this.afterHooks.push(hook);
        return this;
    }

    /**
     * Register a hook to run on transformation errors.
     */
    onTransformError(hook: TransformErrorHook): this {
        this.errorHooks.push(hook);
        return this;
    }

    /**
     * Execute all before hooks.
     */
    async executeBeforeHooks(context: TransformationHookContext): Promise<void> {
        for (const hook of this.beforeHooks) {
            await hook(context);
        }
    }

    /**
     * Execute all after hooks.
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
     * Execute all error hooks.
     */
    async executeErrorHooks(
        context: TransformationHookContext & { error: Error },
    ): Promise<void> {
        for (const hook of this.errorHooks) {
            await hook(context);
        }
    }

    /**
     * Check if any hooks are registered.
     */
    hasHooks(): boolean {
        return (
            this.beforeHooks.length > 0 ||
            this.afterHooks.length > 0 ||
            this.errorHooks.length > 0
        );
    }

    /**
     * Clear all hooks.
     */
    clear(): void {
        this.beforeHooks.length = 0;
        this.afterHooks.length = 0;
        this.errorHooks.length = 0;
    }
}

/**
 * No-op hook manager that does nothing.
 * Use this as a default when hooks are not needed.
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
 * Create a logging hook that logs transformation events.
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
 * Create a metrics hook that collects transformation timing data.
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
