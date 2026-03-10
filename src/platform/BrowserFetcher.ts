/**
 * Browser-based content fetcher using Cloudflare Browser Rendering.
 *
 * Implements {@link IContentFetcher} via an injected {@link BrowserConnector}
 * so that this module never imports `@cloudflare/playwright` directly.
 * That keeps the JSR-published `src/` package free of Worker-only npm modules
 * (which import `cloudflare:workers` at the module level and cannot be resolved
 * by Deno's test runtime).
 *
 * **Usage in a Cloudflare Worker:**
 * ```ts
 * import { launch } from '@cloudflare/playwright';
 * import { BrowserFetcher } from '@jk-com/adblock-compiler';
 *
 * const fetcher = new BrowserFetcher(env.BROWSER, { timeout: 30_000 }, launch);
 * const content = await fetcher.fetch('https://example.com/filters.txt');
 * ```
 *
 * @module
 */

import type { IContentFetcher } from './types.ts';
import { ErrorUtils } from '../utils/index.ts';
import { HttpFetcher } from './HttpFetcher.ts';

// ============================================================================
// Playwright structural interfaces
// (defined here — NOT imported from @cloudflare/playwright — so this file
// remains compatible with Deno's test runtime)
// ============================================================================

/**
 * Minimal subset of a Playwright Page used by {@link BrowserFetcher}.
 * Structurally compatible with the Page returned by `@cloudflare/playwright`.
 */
export interface IPlaywrightPage {
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
    content(): Promise<string>;
    evaluate<T>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
    close(): Promise<void>;
}

/**
 * Minimal subset of a Playwright Browser used by {@link BrowserFetcher}.
 * Structurally compatible with the Browser returned by `@cloudflare/playwright`.
 */
export interface IPlaywrightBrowser {
    newPage(): Promise<IPlaywrightPage>;
    close(): Promise<void>;
}

/**
 * Factory function that connects to a Cloudflare Browser Rendering binding
 * and returns a Playwright-compatible browser instance.
 *
 * In production, pass `launch` imported from `@cloudflare/playwright`.
 * In tests, pass a mock function.
 */
export type BrowserConnector = (binding: IBrowserWorker) => Promise<IPlaywrightBrowser>;

/**
 * Minimal interface for the Cloudflare `BrowserWorker` binding.
 * Matches the `BrowserWorker` exported by `cloudflare-workers-shim.ts`.
 */
export interface IBrowserWorker {
    fetch: typeof fetch;
}

// ============================================================================
// Shared constants
// ============================================================================

/**
 * JavaScript expression injected into a browser page to extract visible text.
 *
 * Exported so that `worker/handlers/browser.ts` can reuse it without
 * duplicating the logic.
 */
export const EXTRACT_TEXT_SCRIPT = `
    Array.from(document.querySelectorAll('pre, code, textarea, body'))
        .find(el => el.tagName === 'PRE' || el.tagName === 'CODE' || el.tagName === 'TEXTAREA')
        ?.innerText ?? document.body.innerText ?? ''
`.trim();

// ============================================================================
// Options
// ============================================================================

/**
 * Options for {@link BrowserFetcher}.
 */
export interface BrowserFetcherOptions {
    /**
     * Navigation timeout in milliseconds.
     * @default 30_000
     */
    timeout?: number;

    /**
     * Playwright `waitUntil` page-load strategy.
     * `'networkidle'` waits for network activity to settle; `'load'` waits for
     * the `load` event (faster but may miss client-side rendered content).
     * @default 'networkidle'
     */
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';

    /**
     * When `true`, the raw HTML `outerHTML` of the page `<body>` is returned
     * instead of the extracted text content.
     * @default false
     */
    returnHtml?: boolean;
}

// ============================================================================
// BrowserFetcher
// ============================================================================

/**
 * An {@link IContentFetcher} that loads pages through a Cloudflare Browser
 * Rendering binding and extracts their text content.
 *
 * Because JavaScript-heavy pages (e.g. those that redirect via `window.location`)
 * would return empty or misleading content to a plain `fetch()` call, this
 * fetcher drives a real Chromium browser via `@cloudflare/playwright`.
 *
 * Dependency-injection via {@link BrowserConnector} ensures the JSR package
 * never imports the Workers-only `@cloudflare/playwright` package.
 */
export class BrowserFetcher implements IContentFetcher {
    private readonly binding: IBrowserWorker;
    private readonly options: Required<BrowserFetcherOptions>;
    private readonly connect: BrowserConnector;

    constructor(
        /** The `BROWSER` binding from the Worker `Env`. */
        binding: IBrowserWorker,
        options: BrowserFetcherOptions = {},
        /** Factory that opens a browser against the binding. Pass `launch` from `@cloudflare/playwright`. */
        connect: BrowserConnector,
    ) {
        this.binding = binding;
        this.connect = connect;
        this.options = {
            timeout: options.timeout ?? 30_000,
            waitUntil: options.waitUntil ?? 'networkidle',
            returnHtml: options.returnHtml ?? false,
        };
    }

    /**
     * Returns `true` for any HTTP or HTTPS URL — the same sources `HttpFetcher`
     * handles, since browser rendering only makes sense for web pages.
     */
    canHandle(source: string): boolean {
        return source.startsWith('http://') || source.startsWith('https://');
    }

    /**
     * Navigates to `url` in a headless browser and returns the page content.
     *
     * @remarks Uses {@link HttpFetcher.isSafeUrl} to block private/internal addresses (SSRF prevention).
     *
     * Text extraction order:
     * 1. First `<pre>`, `<code>`, or `<textarea>` element's `innerText`
     *    (common for plain-text filter list pages wrapped in HTML)
     * 2. `document.body.innerText`
     *
     * When `returnHtml` is `true`, returns `document.body.outerHTML` instead.
     *
     * @throws {Error} If the browser fails to navigate or extract content.
     */
    async fetch(url: string): Promise<string> {
        // Reuse HttpFetcher's SSRF protection
        if (!HttpFetcher.isSafeUrl(url)) {
            throw new Error(`Blocked browser request to private/internal address: ${url}`);
        }

        const browser = await this.connect(this.binding);
        let page: IPlaywrightPage | undefined;

        try {
            page = await browser.newPage();
            await page.goto(url, {
                waitUntil: this.options.waitUntil,
                timeout: this.options.timeout,
            });

            if (this.options.returnHtml) {
                return await page.evaluate<string>('document.body.outerHTML');
            }

            const text = await page.evaluate<string>(EXTRACT_TEXT_SCRIPT);
            return text;
        } catch (error) {
            throw new Error(`BrowserFetcher failed to fetch '${url}': ${ErrorUtils.getMessage(error)}`);
        } finally {
            await page?.close().catch(() => undefined);
            await browser.close().catch(() => undefined);
        }
    }
}
