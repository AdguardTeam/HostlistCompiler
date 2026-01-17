/**
 * Type shim for cloudflare:workers module.
 *
 * This file provides type stubs for Cloudflare Workers Workflow types
 * to enable Deno type checking. At runtime on Cloudflare Workers,
 * the actual cloudflare:workers module will be used.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/workflows/
 */

/// <reference types="@cloudflare/workers-types" />

/**
 * Workflow event passed to the run method
 */
export interface WorkflowEvent<T = unknown> {
    payload: T;
    timestamp: Date;
    instanceId: string;
}

/**
 * Workflow step for durable execution
 */
export interface WorkflowStep {
    do<T>(
        name: string,
        callback: () => Promise<T> | T
    ): Promise<T>;
    do<T>(
        name: string,
        options: {
            retries?: {
                limit: number;
                delay: string;
                backoff?: 'constant' | 'linear' | 'exponential';
            };
            timeout?: string;
        },
        callback: () => Promise<T> | T
    ): Promise<T>;
    sleep(name: string, duration: string): Promise<void>;
    sleepUntil(name: string, timestamp: Date | number): Promise<void>;
}

/**
 * Base class for workflow entrypoints
 */
export abstract class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    protected env: Env;
    protected ctx: ExecutionContext;

    constructor(ctx: ExecutionContext, env: Env) {
        this.ctx = ctx;
        this.env = env;
    }

    abstract run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>;
}
