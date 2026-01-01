import type { IDetailedLogger, IFileSystem, IHttpClient } from '../types/index.ts';

/**
 * Options for content fetching
 */
export interface FetchOptions {
    /** Request timeout in milliseconds */
    timeout?: number;
    /** User agent string for HTTP requests */
    userAgent?: string;
    /** Allow empty responses without throwing */
    allowEmptyResponse?: boolean;
}

/**
 * Default fetch options
 */
const DEFAULT_FETCH_OPTIONS: Required<FetchOptions> = {
    timeout: 30000,
    userAgent: 'HostlistCompiler/2.0 (Deno)',
    allowEmptyResponse: false,
};

/**
 * Default Deno file system implementation
 */
export class DenoFileSystem implements IFileSystem {
    async readTextFile(path: string): Promise<string> {
        return await Deno.readTextFile(path);
    }

    async writeTextFile(path: string, content: string): Promise<void> {
        await Deno.writeTextFile(path, content);
    }

    async exists(path: string): Promise<boolean> {
        try {
            await Deno.stat(path);
            return true;
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                return false;
            }
            throw error;
        }
    }
}

/**
 * Default HTTP client using global fetch
 */
export class DefaultHttpClient implements IHttpClient {
    async fetch(url: string, options?: RequestInit): Promise<Response> {
        return await fetch(url, options);
    }
}

/**
 * Fetches content from URLs or local files.
 * Follows Single Responsibility Principle - only handles content retrieval.
 * Uses Dependency Injection for testability.
 */
export class ContentFetcher {
    private readonly fileSystem: IFileSystem;
    private readonly httpClient: IHttpClient;
    private readonly logger: IDetailedLogger;
    private readonly options: Required<FetchOptions>;

    /**
     * Creates a new ContentFetcher
     * @param logger - Logger for diagnostic messages
     * @param options - Fetch options
     * @param fileSystem - File system implementation (injectable for testing)
     * @param httpClient - HTTP client implementation (injectable for testing)
     */
    constructor(
        logger: IDetailedLogger,
        options?: FetchOptions,
        fileSystem?: IFileSystem,
        httpClient?: IHttpClient,
    ) {
        this.logger = logger;
        this.options = { ...DEFAULT_FETCH_OPTIONS, ...options };
        this.fileSystem = fileSystem || new DenoFileSystem();
        this.httpClient = httpClient || new DefaultHttpClient();
    }

    /**
     * Fetches content from a URL or file path
     * @param source - URL or file path
     * @returns Content as string
     * @throws Error if fetch fails or content is empty (when not allowed)
     */
    public async fetch(source: string): Promise<string> {
        this.logger.debug(`Fetching: ${source}`);

        try {
            const content = this.isUrl(source)
                ? await this.fetchFromUrl(source)
                : await this.fetchFromFile(source);

            if (!content && !this.options.allowEmptyResponse) {
                throw new Error('Empty content received');
            }

            return content;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to fetch ${source}: ${message}`);
            throw new Error(`Content fetch failed for ${source}: ${message}`);
        }
    }

    /**
     * Fetches content from a URL
     * @param url - URL to fetch
     * @returns Content as string
     * @throws Error if HTTP request fails
     */
    private async fetchFromUrl(url: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        try {
            const response = await this.httpClient.fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': this.options.userAgent,
                },
                redirect: 'follow',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.options.timeout}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Fetches content from a local file
     * @param path - File path
     * @returns Content as string
     * @throws Error if file read fails
     */
    private async fetchFromFile(path: string): Promise<string> {
        try {
            return await this.fileSystem.readTextFile(path);
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                throw new Error(`File not found: ${path}`);
            }
            throw error;
        }
    }

    /**
     * Checks if a string is a valid URL
     * @param source - String to check
     * @returns True if source is a URL
     */
    private isUrl(source: string): boolean {
        return source.startsWith('http://') || source.startsWith('https://');
    }

    /**
     * Resolves a relative path against a base URL or path
     * @param includePath - Path to resolve
     * @param basePath - Base path/URL
     * @returns Resolved absolute path/URL
     */
    public static resolveIncludePath(includePath: string, basePath: string): string {
        // If include path is absolute, use it directly
        if (ContentFetcher.isAbsolutePath(includePath) || includePath.startsWith('http')) {
            return includePath;
        }

        if (basePath.startsWith('http')) {
            // Resolve relative URL
            try {
                const baseUrl = new URL(basePath);
                return new URL(includePath, baseUrl).toString();
            } catch {
                return includePath;
            }
        } else {
            // Resolve relative file path
            const separator = basePath.includes('\\') ? '\\' : '/';
            const baseDir = basePath.substring(0, basePath.lastIndexOf(separator) + 1);
            return baseDir + includePath;
        }
    }

    /**
     * Checks if a string is an absolute file path
     * @param path - Path to check
     * @returns True if path is absolute
     */
    private static isAbsolutePath(path: string): boolean {
        // Unix absolute path
        if (path.startsWith('/')) return true;
        // Windows absolute path (C:\, D:\, etc.)
        if (/^[a-zA-Z]:[/\\]/.test(path)) return true;
        return false;
    }
}
