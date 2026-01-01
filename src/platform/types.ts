/**
 * Platform abstraction types for cross-runtime compatibility.
 * Allows the compiler to run on Deno, Node.js, Cloudflare Workers, and browsers.
 */

/**
 * Content fetcher abstraction - provides content from any source.
 * This allows the compiler to work with pre-fetched content or custom fetch implementations.
 */
export interface IContentFetcher {
    /**
     * Fetches content from a source.
     * @param source - URL or source identifier
     * @returns The content as a string
     * @throws Error if the content cannot be fetched
     */
    fetch(source: string): Promise<string>;

    /**
     * Checks if this fetcher can handle the given source.
     * @param source - URL or source identifier
     * @returns true if this fetcher can handle the source
     */
    canHandle(source: string): boolean;
}

/**
 * Options for HTTP-based content fetching.
 */
export interface IHttpFetcherOptions {
    /** Request timeout in milliseconds */
    timeout?: number;
    /** User agent string for HTTP requests */
    userAgent?: string;
    /** Allow empty responses without throwing */
    allowEmptyResponse?: boolean;
    /** Custom headers for requests */
    headers?: Record<string, string>;
}

/**
 * Pre-fetched content map - allows passing content directly without network/file access.
 * Keys are source identifiers (URLs or names), values are the content strings.
 */
export type PreFetchedContent = Map<string, string> | Record<string, string>;

/**
 * Platform-agnostic compiler configuration that extends the base configuration.
 */
export interface IPlatformCompilerOptions {
    /**
     * Pre-fetched content that bypasses network/file access.
     * Useful for browser/worker environments or testing.
     */
    preFetchedContent?: PreFetchedContent;

    /**
     * Custom content fetcher for handling sources.
     * Takes precedence over the default HTTP fetcher.
     */
    customFetcher?: IContentFetcher;

    /**
     * Options for the default HTTP fetcher.
     */
    httpOptions?: IHttpFetcherOptions;
}
