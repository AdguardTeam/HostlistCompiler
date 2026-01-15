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
     * Fetches content from a URL.
     */
    public async fetch(source: string): Promise<string> {
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
