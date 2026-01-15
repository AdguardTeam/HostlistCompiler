/**
 * Platform-agnostic filter list downloader.
 * Uses the IContentFetcher abstraction instead of direct file system or network access.
 * Works in browsers, Deno, Node.js, and Cloudflare Workers.
 */

import type { ILogger } from '../types/index.ts';
import type { IContentFetcher } from './types.ts';
import { silentLogger } from '../utils/logger.ts';
import { HttpFetcher } from './HttpFetcher.ts';

/**
 * Options for the platform-agnostic downloader
 */
export interface PlatformDownloaderOptions {
    /** Request timeout in milliseconds */
    timeout?: number;
    /** User agent string for HTTP requests */
    userAgent?: string;
    /** Allow empty responses without throwing */
    allowEmptyResponse?: boolean;
    /** Maximum depth for !#include directives */
    maxIncludeDepth?: number;
}

/**
 * Default options for the downloader
 */
const DEFAULT_OPTIONS: Required<PlatformDownloaderOptions> = {
    timeout: 30000,
    userAgent: 'HostlistCompiler/2.0',
    allowEmptyResponse: false,
    maxIncludeDepth: 10,
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
 * Checks if a string is a valid URL
 */
function isUrl(source: string): boolean {
    return source.startsWith('http://') || source.startsWith('https://');
}

/**
 * Checks if a string is an absolute file path
 */
function isAbsolutePath(path: string): boolean {
    // Unix absolute path
    if (path.startsWith('/')) return true;
    // Windows absolute path (C:\, D:\, etc.)
    if (/^[a-zA-Z]:[/\\]/.test(path)) return true;
    return false;
}

/**
 * Resolves a relative path against a base URL or path
 */
function resolveIncludePath(includePath: string, basePath: string): string {
    // If include path is absolute, use it directly
    if (isAbsolutePath(includePath) || isUrl(includePath)) {
        return includePath;
    }

    if (isUrl(basePath)) {
        // Resolve relative URL
        const baseUrl = new URL(basePath);
        return new URL(includePath, baseUrl).toString();
    } else {
        // Resolve relative file path
        const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1) ||
            basePath.substring(0, basePath.lastIndexOf('\\') + 1);
        return baseDir + includePath;
    }
}

/**
 * Evaluates a preprocessor condition
 * Supports: true, false, !, &&, ||, (), and platform identifiers
 */
function evaluateCondition(condition: string, platform?: string): boolean {
    // Clean up the condition
    let expr = condition.trim();

    // Handle empty condition
    if (!expr) return true;

    // Replace platform identifiers with boolean values
    const platforms = [
        'windows',
        'mac',
        'android',
        'ios',
        'ext_chromium',
        'ext_ff',
        'ext_edge',
        'ext_opera',
        'ext_safari',
        'ext_ublock',
        'adguard',
        'adguard_app_windows',
        'adguard_app_mac',
        'adguard_app_android',
        'adguard_app_ios',
        'adguard_ext_chromium',
        'adguard_ext_firefox',
        'adguard_ext_edge',
        'adguard_ext_opera',
        'adguard_ext_safari',
    ];

    for (const p of platforms) {
        const regex = new RegExp(`\\b${p}\\b`, 'gi');
        const value = platform?.toLowerCase() === p.toLowerCase() ? 'true' : 'false';
        expr = expr.replace(regex, value);
    }

    // Handle logical operators
    expr = expr.replace(/\s+&&\s+/g, ' && ');
    expr = expr.replace(/\s+\|\|\s+/g, ' || ');

    // Evaluate the expression safely
    try {
        if (!/^[!&|() ]*$/i.test(expr.replace(/true|false/gi, ''))) {
            return false;
        }
        // Use Function constructor for safe evaluation
        // This is safe because we've sanitized the input to only contain boolean logic
        const fn = new Function(`return ${expr};`);
        return Boolean(fn());
    } catch {
        return false;
    }
}

/**
 * Platform-agnostic filter downloader.
 * Uses IContentFetcher for all source access.
 */
export class PlatformDownloader {
    private readonly options: Required<PlatformDownloaderOptions>;
    private readonly logger: ILogger;
    private readonly fetcher: IContentFetcher;
    private readonly visitedUrls: Set<string> = new Set();

    /**
     * Creates a new PlatformDownloader
     * @param fetcher - Optional content fetcher
     * @param options - Optional downloader options
     * @param logger - Optional logger instance
     */
    constructor(
        fetcher?: IContentFetcher,
        options?: PlatformDownloaderOptions,
        logger?: ILogger,
    ) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.logger = logger ?? silentLogger;
        this.fetcher = fetcher ?? new HttpFetcher({
            timeout: this.options.timeout,
            userAgent: this.options.userAgent,
            allowEmptyResponse: this.options.allowEmptyResponse,
        });
    }

    /**
     * Downloads and processes a filter list from a source.
     * @param source - URL or source identifier
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
            if (!this.fetcher.canHandle(source)) {
                throw new Error(`No fetcher available for source: ${source}`);
            }
            content = await this.fetcher.fetch(source);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to download ${source}: ${message}`);
            throw error;
        }

        // Split into lines and process
        let lines = content.split(/\r?\n/);

        // Remove trailing empty line
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines = lines.slice(0, -1);
        }

        // Process preprocessor directives
        return this.processDirectives(lines, source, depth);
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

                if (evaluateCondition(condition)) {
                    const processed = await this.processDirectives(block.ifLines, basePath, depth);
                    result.push(...processed);
                } else if (block.elseLines.length > 0) {
                    const processed = await this.processDirectives(block.elseLines, basePath, depth);
                    result.push(...processed);
                }

                i = this.findEndIfIndex(lines, i) + 1;
                continue;
            }

            // Handle !#include directive
            if (trimmed.startsWith(DirectiveType.Include)) {
                const includePath = trimmed.substring(DirectiveType.Include.length).trim();
                const resolvedPath = resolveIncludePath(includePath, basePath);

                try {
                    const included = await this.downloadInternal(resolvedPath, depth + 1);
                    result.push(...included);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.logger.warn(`Failed to include ${includePath}: ${message}`);
                }

                i++;
                continue;
            }

            // Handle !#safari_cb_affinity (skip these blocks)
            if (trimmed.startsWith(DirectiveType.Safari)) {
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

            // Skip standalone !#else and !#endif
            if (trimmed === DirectiveType.Else || trimmed === DirectiveType.EndIf) {
                i++;
                continue;
            }

            // Regular line
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
     * Finds the index of the matching !#endif
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
}
