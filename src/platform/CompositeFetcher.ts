/**
 * Composite fetcher that delegates to multiple fetchers.
 * Tries each fetcher in order until one can handle the source.
 */

import type { IContentFetcher } from './types.ts';

/**
 * Combines multiple fetchers, trying each in order.
 * First fetcher that can handle the source wins.
 */
export class CompositeFetcher implements IContentFetcher {
    private readonly fetchers: IContentFetcher[];

    /**
     * Creates a new CompositeFetcher
     * @param fetchers - Array of content fetchers to try in order
     */
    constructor(fetchers: IContentFetcher[]) {
        this.fetchers = fetchers;
    }

    /**
     * Checks if any fetcher can handle the given source.
     */
    public canHandle(source: string): boolean {
        return this.fetchers.some((f) => f.canHandle(source));
    }

    /**
     * Fetches content using the first fetcher that can handle the source.
     */
    public async fetch(source: string): Promise<string> {
        for (const fetcher of this.fetchers) {
            if (fetcher.canHandle(source)) {
                return fetcher.fetch(source);
            }
        }
        throw new Error(`No fetcher available for source: ${source}`);
    }

    /**
     * Adds a fetcher to the chain.
     * @param fetcher - Fetcher to add
     * @param priority - If true, adds to front of chain (checked first)
     */
    public addFetcher(fetcher: IContentFetcher, priority = false): void {
        if (priority) {
            this.fetchers.unshift(fetcher);
        } else {
            this.fetchers.push(fetcher);
        }
    }
}
