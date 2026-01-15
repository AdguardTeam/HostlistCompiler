/**
 * Content fetcher that uses pre-fetched content.
 * Essential for browser/worker environments where CORS restrictions apply.
 */

import type { IContentFetcher, PreFetchedContent } from './types.ts';

/**
 * Fetches content from a pre-populated content map.
 * This allows compilation without network or file system access.
 */
export class PreFetchedContentFetcher implements IContentFetcher {
    private readonly contentMap: Map<string, string>;

    /**
     * Creates a new PreFetchedContentFetcher
     * @param content - Pre-fetched content mapping
     */
    constructor(content: PreFetchedContent) {
        // Normalize to Map for consistent access
        if (content instanceof Map) {
            this.contentMap = content;
        } else {
            this.contentMap = new Map(Object.entries(content));
        }
    }

    /**
     * Checks if content is available for the given source.
     */
    public canHandle(source: string): boolean {
        return this.contentMap.has(source);
    }

    /**
     * Returns the pre-fetched content for the source.
     */
    public async fetch(source: string): Promise<string> {
        const content = this.contentMap.get(source);
        if (content === undefined) {
            throw new Error(`No pre-fetched content available for: ${source}`);
        }
        return content;
    }

    /**
     * Adds content to the map (useful for dynamic content loading).
     */
    public addContent(source: string, content: string): void {
        this.contentMap.set(source, content);
    }

    /**
     * Removes content from the map.
     */
    public removeContent(source: string): boolean {
        return this.contentMap.delete(source);
    }

    /**
     * Returns all available source identifiers.
     */
    public getSources(): string[] {
        return Array.from(this.contentMap.keys());
    }
}
