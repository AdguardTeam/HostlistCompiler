/**
 * Native Deno implementation of filter list downloader
 * Replaces @adguard/filters-downloader with a Deno-native solution
 *
 * Supports:
 * - Downloading from URLs (http/https)
 * - Reading from local files
 * - Processing preprocessor directives (!#if, !#else, !#endif, !#include)
 * - Recursive include resolution with cycle detection
 */

import type { ILogger } from '../types/index.ts';
import { silentLogger } from '../utils/logger.ts';
import { evaluateBooleanExpression } from '../utils/BooleanExpressionParser.ts';
import { ErrorUtils, FileSystemError, NetworkError, PathUtils } from '../utils/index.ts';
import { NETWORK_DEFAULTS, PREPROCESSOR_DEFAULTS } from '../config/defaults.ts';
import { USER_AGENT } from '../version.ts';

/**
 * Options for the filter downloader
 */
export interface DownloaderOptions {
    /** Maximum number of redirects to follow */
    maxRedirects?: number;
    /** Request timeout in milliseconds */
    timeout?: number;
    /** User agent string for HTTP requests */
    userAgent?: string;
    /** Allow empty responses without throwing */
    allowEmptyResponse?: boolean;
    /** Maximum depth for !#include directives */
    maxIncludeDepth?: number;
    /** Maximum number of retry attempts for failed requests */
    maxRetries?: number;
    /** Base delay for exponential backoff (milliseconds) */
    retryDelay?: number;
}

/**
 * Default options for the downloader (uses centralized constants)
 */
const DEFAULT_OPTIONS: Required<DownloaderOptions> = {
    maxRedirects: NETWORK_DEFAULTS.MAX_REDIRECTS,
    timeout: NETWORK_DEFAULTS.TIMEOUT_MS,
    userAgent: USER_AGENT,
    allowEmptyResponse: false,
    maxIncludeDepth: PREPROCESSOR_DEFAULTS.MAX_INCLUDE_DEPTH,
    maxRetries: NETWORK_DEFAULTS.MAX_RETRIES,
    retryDelay: NETWORK_DEFAULTS.RETRY_DELAY_MS,
};

/**
 * Preprocessor directive types
 */
enum DirectiveType {
    If = '!#if',
    Else = '!#else',
    EndIf = '!#endif',
    Include = '!#include',
    Safari = '!#safari_cb_affinity',
}

/**
 * Represents a conditional block in the filter
 */
interface ConditionalBlock {
    condition: string;
    ifLines: string[];
    elseLines: string[];
}

/**
 * Evaluates a preprocessor condition using safe expression parser
 * Supports: true, false, !, &&, ||, (), and platform identifiers
 */
function evaluateCondition(condition: string, platform?: string): boolean {
    return evaluateBooleanExpression(condition, platform);
}

/**
 * Native Deno filter downloader
 */
export class FilterDownloader {
    private readonly options: Required<DownloaderOptions>;
    private readonly logger: ILogger;
    private readonly visitedUrls: Set<string> = new Set();

    /**
     * Creates a new FilterDownloader
     * @param options - Downloader options
     * @param logger - Logger instance for output
     */
    constructor(options?: DownloaderOptions, logger?: ILogger) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.logger = logger ?? silentLogger;
    }

    /**
     * Downloads and processes a filter list from a URL or file path
     * @param source - URL or file path to download from
     * @returns Array of filter rules (lines)
     */
    async download(source: string): Promise<string[]> {
        this.visitedUrls.clear();
        return this.downloadInternal(source, 0);
    }

    /**
     * Internal download method with include depth tracking
     */
    private async downloadInternal(source: string, depth: number): Promise<string[]> {
        // Check for circular includes
        if (this.visitedUrls.has(source)) {
            this.logger.warn(`Circular include detected: ${source}`);
            return [];
        }

        // Check include depth
        if (depth > this.options.maxIncludeDepth) {
            this.logger.warn(`Max include depth exceeded: ${source}`);
            return [];
        }

        this.visitedUrls.add(source);
        this.logger.debug(`Downloading: ${source}`);

        let content: string;

        try {
            if (PathUtils.isUrl(source)) {
                content = await this.fetchUrl(source);
            } else {
                content = await this.readFile(source);
            }
        } catch (error) {
            const message = ErrorUtils.getMessage(error);
            this.logger.error(`Failed to download ${source}: ${message}`);
            throw error;
        }

        // Split into lines and process
        let lines = content.split(/\r?\n/);

        // Remove trailing empty line created by files ending with newline
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines = lines.slice(0, -1);
        }

        // Process preprocessor directives
        const processed = await this.processDirectives(lines, source, depth);

        return processed;
    }

    /**
     * Fetches content from a URL with retry logic and circuit breaker
     */
    private async fetchUrl(url: string): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

            try {
                this.logger.debug(`Fetching ${url} (attempt ${attempt + 1}/${this.options.maxRetries + 1})`);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': this.options.userAgent,
                    },
                    redirect: 'follow',
                });

                if (!response.ok) {
                    // Only retry on 5xx errors and 429 (rate limit)
                    const shouldRetry = response.status >= 500 || response.status === 429;
                    if (!shouldRetry || attempt === this.options.maxRetries) {
                        throw ErrorUtils.httpError(url, response.status, response.statusText);
                    }

                    lastError = ErrorUtils.httpError(url, response.status, response.statusText);
                    this.logger.warn(`Request failed with ${response.status}, retrying...`);
                } else {
                    const text = await response.text();

                    if (!text && !this.options.allowEmptyResponse) {
                        throw new NetworkError('Empty response received', url);
                    }

                    return text;
                }
            } catch (error) {
                // Preserve NetworkError instances
                if (error instanceof NetworkError) {
                    lastError = error;
                } else {
                    lastError = ErrorUtils.toError(error);
                }

                // Check if it's a timeout/abort error
                const isTimeoutError = lastError.name === 'AbortError' ||
                    lastError.message.includes('aborted');

                if (isTimeoutError) {
                    lastError = ErrorUtils.timeoutError(url, this.options.timeout);
                }

                // Don't retry on 4xx client errors
                if (!isTimeoutError && lastError.message.includes('HTTP 4')) {
                    throw lastError;
                }

                if (attempt === this.options.maxRetries) {
                    throw lastError;
                }

                this.logger.warn(`Request failed: ${lastError.message}, retrying...`);
            } finally {
                clearTimeout(timeoutId);
            }

            // Exponential backoff with jitter
            if (attempt < this.options.maxRetries) {
                const backoffDelay = this.options.retryDelay * Math.pow(2, attempt);
                const jitter = Math.random() * 0.3 * backoffDelay; // Add up to 30% jitter
                const delay = backoffDelay + jitter;

                this.logger.debug(`Waiting ${Math.round(delay)}ms before retry...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        throw lastError ?? new NetworkError('Failed to fetch URL after retries', url);
    }

    /**
     * Reads content from a local file
     */
    private async readFile(path: string): Promise<string> {
        try {
            const content = await Deno.readTextFile(path);

            if (!content && !this.options.allowEmptyResponse) {
                throw new FileSystemError('Empty file', path);
            }

            return content;
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
     * Processes preprocessor directives in the filter content
     */
    private async processDirectives(
        lines: string[],
        basePath: string,
        depth: number,
    ): Promise<string[]> {
        const result: string[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            // Handle !#if directive
            if (trimmed.startsWith(DirectiveType.If)) {
                const block = this.parseConditionalBlock(lines, i);
                const condition = trimmed.substring(DirectiveType.If.length).trim();

                // Evaluate condition and include appropriate lines
                if (evaluateCondition(condition)) {
                    const processed = await this.processDirectives(block.ifLines, basePath, depth);
                    result.push(...processed);
                } else if (block.elseLines.length > 0) {
                    const processed = await this.processDirectives(block.elseLines, basePath, depth);
                    result.push(...processed);
                }

                // Skip to after the block
                i = this.findEndIfIndex(lines, i) + 1;
                continue;
            }

            // Handle !#include directive
            if (trimmed.startsWith(DirectiveType.Include)) {
                const includePath = trimmed.substring(DirectiveType.Include.length).trim();
                const resolvedPath = PathUtils.resolveIncludePath(includePath, basePath);

                try {
                    const included = await this.downloadInternal(resolvedPath, depth + 1);
                    result.push(...included);
                } catch (error) {
                    this.logger.warn(`Failed to include ${includePath}: ${ErrorUtils.getMessage(error)}`);
                }

                i++;
                continue;
            }

            // Handle !#safari_cb_affinity (skip these blocks for non-Safari)
            if (trimmed.startsWith(DirectiveType.Safari)) {
                // Skip until we find the end marker or run out of lines
                i++;
                while (i < lines.length) {
                    const currentLine = lines[i].trim();
                    if (
                        currentLine.startsWith('!#safari_cb_affinity') &&
                        currentLine.length === DirectiveType.Safari.length
                    ) {
                        i++;
                        break;
                    }
                    i++;
                }
                continue;
            }

            // Skip standalone !#else and !#endif (they're handled by !#if)
            if (trimmed === DirectiveType.Else || trimmed === DirectiveType.EndIf) {
                i++;
                continue;
            }

            // Regular line - add to result
            result.push(line);
            i++;
        }

        return result;
    }

    /**
     * Parses a conditional block (!#if ... !#else ... !#endif)
     */
    private parseConditionalBlock(lines: string[], startIndex: number): ConditionalBlock {
        const block: ConditionalBlock = {
            condition: lines[startIndex].trim().substring(DirectiveType.If.length).trim(),
            ifLines: [],
            elseLines: [],
        };

        let depth = 1;
        let inElse = false;
        let i = startIndex + 1;

        while (i < lines.length && depth > 0) {
            const trimmed = lines[i].trim();

            if (trimmed.startsWith(DirectiveType.If)) {
                depth++;
                if (inElse) {
                    block.elseLines.push(lines[i]);
                } else {
                    block.ifLines.push(lines[i]);
                }
            } else if (trimmed === DirectiveType.EndIf) {
                depth--;
                if (depth > 0) {
                    if (inElse) {
                        block.elseLines.push(lines[i]);
                    } else {
                        block.ifLines.push(lines[i]);
                    }
                }
            } else if (trimmed === DirectiveType.Else && depth === 1) {
                inElse = true;
            } else {
                if (inElse) {
                    block.elseLines.push(lines[i]);
                } else {
                    block.ifLines.push(lines[i]);
                }
            }

            i++;
        }

        return block;
    }

    /**
     * Finds the index of the matching !#endif for a !#if at startIndex
     */
    private findEndIfIndex(lines: string[], startIndex: number): number {
        let depth = 1;
        let i = startIndex + 1;

        while (i < lines.length && depth > 0) {
            const trimmed = lines[i].trim();

            if (trimmed.startsWith(DirectiveType.If)) {
                depth++;
            } else if (trimmed === DirectiveType.EndIf) {
                depth--;
            }

            if (depth === 0) {
                return i;
            }

            i++;
        }

        return lines.length - 1;
    }

    /**
     * Static convenience method for one-off downloads
     */
    static async download(
        source: string,
        options?: DownloaderOptions,
        additionalOptions?: { allowEmptyResponse?: boolean },
    ): Promise<string[]> {
        const mergedOptions: DownloaderOptions = {
            ...options,
            allowEmptyResponse: additionalOptions?.allowEmptyResponse,
        };
        const downloader = new FilterDownloader(mergedOptions);
        return downloader.download(source);
    }
}
