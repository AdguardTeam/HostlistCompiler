/**
 * Shared browser-rendering utilities for Cloudflare Workers.
 *
 * All three exported functions open a short-lived headless browser via the
 * `BROWSER` binding (Cloudflare Browser Rendering), perform their task, and
 * close the browser.
 *
 * `@cloudflare/playwright` is loaded via a **dynamic import** inside
 * {@link acquireBrowser}.  This prevents Deno's static module graph from
 * resolving the package during type-check / test runs — it imports
 * `cloudflare:workers` at module-level which fails outside of a Worker
 * runtime.
 *
 * Types ({@link IPlaywrightBrowser}, {@link IPlaywrightPage}) and the shared
 * {@link EXTRACT_TEXT_SCRIPT} constant are imported directly from
 * `BrowserFetcher.ts` so there is a single source of truth.
 */

import type { BrowserWorker } from '../cloudflare-workers-shim.ts';
// Type-only imports from the JSR-published platform module — no runtime cost.
import type { IPlaywrightBrowser, IPlaywrightPage } from '../../src/platform/BrowserFetcher.ts';
import { EXTRACT_TEXT_SCRIPT } from '../../src/platform/BrowserFetcher.ts';
import { ErrorUtils } from '../../src/utils/index.ts';

export { EXTRACT_TEXT_SCRIPT };

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Opens a Playwright browser against the provided Cloudflare Browser
 * Rendering binding.
 *
 * Uses a dynamic import so that `@cloudflare/playwright` (which imports
 * `cloudflare:workers` at the module level) is never pulled into the static
 * module graph when running under Deno.
 */
async function acquireBrowser(binding: BrowserWorker): Promise<IPlaywrightBrowser> {
    // The cast is required because @cloudflare/playwright ships its own types
    // that are only available inside wrangler's bundler; we use the structural
    // interface IPlaywrightBrowser instead.
    const { launch } = (await import('@cloudflare/playwright')) as unknown as {
        launch(binding: BrowserWorker): Promise<IPlaywrightBrowser>;
    };
    return launch(binding);
}

/**
 * Converts a {@link Uint8Array} to a base-64 encoded string without risking a
 * stack overflow from spreading large typed arrays into `String.fromCharCode`.
 */
function uint8ArrayToBase64(buffer: Uint8Array): string {
    const CHUNK = 8_192;
    let binary = '';
    for (let i = 0; i < buffer.length; i += CHUNK) {
        binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

// ============================================================================
// Navigation options
// ============================================================================

/**
 * Options shared by all browser utility functions.
 */
export interface BrowserNavOptions {
    /** Navigation timeout in milliseconds. @default 30_000 */
    timeout?: number;
    /** Playwright page-load strategy. @default 'networkidle' */
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

// ============================================================================
// Exported utilities
// ============================================================================

/**
 * Navigates to `url` in a headless browser and returns the final URL after
 * any JavaScript-driven redirects have settled.
 *
 * Useful for resolving link-shorteners or CDN-hosted filter lists that redirect
 * to the canonical asset URL.
 *
 * @throws {Error} If navigation fails.
 */
export async function resolveCanonicalUrl(binding: BrowserWorker, url: string, options: BrowserNavOptions = {}): Promise<string> {
    const browser = await acquireBrowser(binding);
    let page: IPlaywrightPage | undefined;

    try {
        page = await browser.newPage();
        await page.goto(url, {
            waitUntil: options.waitUntil ?? 'networkidle',
            timeout: options.timeout ?? 30_000,
        });
        const resolved = await page.evaluate<string>('window.location.href');
        return resolved;
    } catch (error) {
        throw new Error(`resolveCanonicalUrl failed for '${url}': ${ErrorUtils.getMessage(error)}`);
    } finally {
        await page?.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
    }
}

/**
 * Navigates to `url` in a headless browser and returns the visible text
 * content (or `outerHTML` when `returnHtml` is `true`).
 *
 * Text extraction prefers the first `<pre>`, `<code>`, or `<textarea>` element
 * (typical for plain-text filter lists served via an HTML wrapper), then falls
 * back to `document.body.innerText`.
 *
 * @throws {Error} If navigation or content extraction fails.
 */
export async function fetchWithBrowser(
    binding: BrowserWorker,
    url: string,
    options: BrowserNavOptions & { returnHtml?: boolean } = {},
): Promise<string> {
    const browser = await acquireBrowser(binding);
    let page: IPlaywrightPage | undefined;

    try {
        page = await browser.newPage();
        await page.goto(url, {
            waitUntil: options.waitUntil ?? 'networkidle',
            timeout: options.timeout ?? 30_000,
        });

        if (options.returnHtml) {
            return await page.evaluate<string>('document.body.outerHTML');
        }

        return await page.evaluate<string>(EXTRACT_TEXT_SCRIPT);
    } catch (error) {
        throw new Error(`fetchWithBrowser failed for '${url}': ${ErrorUtils.getMessage(error)}`);
    } finally {
        await page?.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
    }
}

/**
 * Navigates to `url` in a headless browser, takes a full-page PNG screenshot,
 * and returns the raw bytes as a {@link Uint8Array}.
 *
 * Callers that need a base-64 string (e.g. to embed the screenshot inline in an
 * API response) can convert with {@link uint8ArrayToBase64}.
 *
 * @throws {Error} If navigation or screenshot capture fails.
 */
export async function takeSourceScreenshot(binding: BrowserWorker, url: string, options: BrowserNavOptions = {}): Promise<Uint8Array> {
    const browser = await acquireBrowser(binding);
    let page: IPlaywrightPage | undefined;

    try {
        page = await browser.newPage();
        await page.goto(url, {
            waitUntil: options.waitUntil ?? 'networkidle',
            timeout: options.timeout ?? 30_000,
        });

        // Playwright's screenshot() returns a Buffer/Uint8Array.
        return await (page as unknown as {
            screenshot(options?: { fullPage?: boolean }): Promise<Uint8Array>;
        }).screenshot({ fullPage: true });
    } catch (error) {
        throw new Error(`takeSourceScreenshot failed for '${url}': ${ErrorUtils.getMessage(error)}`);
    } finally {
        await page?.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
    }
}
