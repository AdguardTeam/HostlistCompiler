/**
 * Minimal type declarations for `@cloudflare/containers`.
 *
 * The full package's type graph transitively imports `cloudflare:workers`
 * (for `DurableObject`) which is only available in the Cloudflare Workers
 * runtime and not resolvable by Deno's type checker.
 *
 * These stubs expose just enough typing for the code paths we use while
 * keeping `deno check` stable.  The real types are only needed by the
 * Cloudflare Workers runtime / wrangler bundler, which handles the
 * dependency without issue.
 *
 * @see https://github.com/cloudflare/containers
 * @see https://developers.cloudflare.com/containers/
 */

declare module '@cloudflare/containers' {
    /**
     * Base class for container-enabled Durable Objects.
     *
     * Extend this class to create a Durable Object that runs alongside a
     * container instance.  The `fetch` method forwards requests to the
     * container on `defaultPort`.
     */
    export class Container {
        /** Port the container listens on (forwarded by `fetch`). */
        defaultPort?: number;
        /** Stop the container after this period of inactivity (e.g. "10m"). */
        sleepAfter?: string | number;
        /** Environment variables injected into the container at start. */
        // deno-lint-ignore no-explicit-any
        envVars?: Record<string, any>;

        // deno-lint-ignore no-explicit-any
        constructor(ctx: any, env: any, options?: any);

        /** Forward a request to the container. */
        fetch(request: Request): Promise<Response>;
        /** Lifecycle hook – called when the container starts successfully. */
        onStart(): void | Promise<void>;
        /** Lifecycle hook – called when the container shuts down. */
        // deno-lint-ignore no-explicit-any
        onStop(_: any): void | Promise<void>;
        /** Lifecycle hook – called on container error. */
        onError(error: unknown): unknown;
    }

    /**
     * Get (or create) a named container stub from a Durable Object namespace.
     *
     * @param binding  The `DurableObjectNamespace` binding for the container class.
     * @param name     Instance name – defaults to a singleton name when omitted.
     * @returns A Durable Object stub whose `fetch` routes to the container.
     */
    // deno-lint-ignore no-explicit-any
    export function getContainer<T extends Container>(binding: any, name?: string): any;

    /**
     * Get a random container stub across `instances` concurrent instances.
     * Useful for simple load-balancing.
     */
    // deno-lint-ignore no-explicit-any
    export function getRandom<T extends Container>(binding: any, instances?: number): Promise<any>;

    /**
     * @deprecated Use `getRandom` instead.
     */
    // deno-lint-ignore no-explicit-any
    export function loadBalance<T extends Container>(binding: any, instances?: number): Promise<any>;

    /**
     * Rewrite a `Request` to target a specific container port.
     * Use with `fetch()` when `containerFetch` is not suitable (e.g. WebSockets).
     */
    export function switchPort(request: Request, port: number): Request;
}
