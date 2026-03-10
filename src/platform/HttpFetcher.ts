/**
 * HTTP content fetcher using the standard Fetch API.
 * Works in browsers, Deno, Node.js 18+, and Cloudflare Workers.
 */

import type { IContentFetcher, IHttpFetcherOptions } from './types.ts';

const DEFAULT_OPTIONS: Required<Omit<IHttpFetcherOptions, 'headers'>> = {
    timeout: 30000,
    userAgent: 'HostlistCompiler/2.0',
    allowEmptyResponse: false,
};

/**
 * Fetches content over HTTP/HTTPS using the standard Fetch API.
 * This is the default fetcher for URL-based sources.
 */
export class HttpFetcher implements IContentFetcher {
    private readonly options: Required<Omit<IHttpFetcherOptions, 'headers'>>;
    private readonly headers: Record<string, string>;

    /**
     * Creates a new HttpFetcher
     * @param options - HTTP fetcher options
     */
    constructor(options?: IHttpFetcherOptions) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.headers = options?.headers ?? {};
    }

    /**
     * Checks if this fetcher can handle the given source.
     */
    public canHandle(source: string): boolean {
        return source.startsWith('http://') || source.startsWith('https://');
    }

    /**
     * Validates that a URL does not target private/internal network addresses.
     * Prevents SSRF attacks against localhost, private IPs, and cloud metadata endpoints.
     */
    public static isSafeUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();

            // Reject loopback addresses
            if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
                return false;
            }

            // Reject private IP ranges (RFC 1918)
            if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) {
                return false;
            }

            // Reject link-local and cloud metadata endpoints
            if (/^169\.254\./.test(host) || host === 'metadata.google.internal') {
                return false;
            }

            // Reject IPv6 private/loopback ranges.
            // URL.hostname retains brackets for IPv6 addresses in Deno
            // (e.g. http://[fe80::1] → hostname '[fe80::1]'), so strip them first.
            const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
            if (bare === '::1' || (bare.includes(':') && (bare.startsWith('fe80') || bare.startsWith('fc') || bare.startsWith('fd')))) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Fetches content from a URL.
     */
    public async fetch(source: string): Promise<string> {
        if (!HttpFetcher.isSafeUrl(source)) {
            throw new Error(`Blocked request to private/internal address: ${source}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        try {
            const response = await fetch(source, {
                signal: controller.signal,
                headers: {
                    'User-Agent': this.options.userAgent,
                    ...this.headers,
                },
                redirect: 'follow',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();

            if (!text && !this.options.allowEmptyResponse) {
                throw new Error('Empty response received');
            }

            return text;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
