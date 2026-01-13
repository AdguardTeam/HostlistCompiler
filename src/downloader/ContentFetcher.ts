import type { IDetailedLogger, IFileSystem, IHttpClient } from '../types/index.ts';
import { ErrorUtils, FileSystemError, NetworkError, PathUtils } from '../utils/index.ts';
import { NETWORK_DEFAULTS } from '../config/defaults.ts';

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
    timeout: NETWORK_DEFAULTS.TIMEOUT_MS,
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
     * @throws NetworkError or FileSystemError if fetch fails
     */
    public async fetch(source: string): Promise<string> {
        this.logger.debug(`Fetching: ${source}`);

        try {
            const content = PathUtils.isUrl(source) ? await this.fetchFromUrl(source) : await this.fetchFromFile(source);

            if (!content && !this.options.allowEmptyResponse) {
                throw PathUtils.isUrl(source) ? new NetworkError('Empty content received', source) : new FileSystemError('Empty file', source);
            }

            return content;
        } catch (error) {
            // Re-throw typed errors as-is
            if (error instanceof NetworkError || error instanceof FileSystemError) {
                this.logger.error(`Failed to fetch ${source}: ${error.message}`);
                throw error;
            }

            const message = ErrorUtils.getMessage(error);
            this.logger.error(`Failed to fetch ${source}: ${message}`);

            // Wrap unknown errors in appropriate typed error
            if (PathUtils.isUrl(source)) {
                throw new NetworkError(`Content fetch failed: ${message}`, source);
            } else {
                throw new FileSystemError(`Content fetch failed: ${message}`, source);
            }
        }
    }

    /**
     * Fetches content from a URL
     * @param url - URL to fetch
     * @returns Content as string
     * @throws NetworkError if HTTP request fails
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
                throw ErrorUtils.httpError(url, response.status, response.statusText);
            }

            return await response.text();
        } catch (error) {
            if (error instanceof NetworkError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'AbortError') {
                throw ErrorUtils.timeoutError(url, this.options.timeout);
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
     * @throws FileSystemError if file read fails
     */
    private async fetchFromFile(path: string): Promise<string> {
        try {
            return await this.fileSystem.readTextFile(path);
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                throw ErrorUtils.fileNotFoundError(path);
            }
            if (error instanceof Error && error.name === 'NotCapable') {
                throw ErrorUtils.permissionDeniedError(path, 'read');
            }
            throw error;
        }
    }

    /**
     * Resolves a relative path against a base URL or path.
     * @deprecated Use PathUtils.resolveIncludePath instead
     */
    public static resolveIncludePath(includePath: string, basePath: string): string {
        return PathUtils.resolveIncludePath(includePath, basePath);
    }
}
