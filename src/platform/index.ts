/**
 * Platform abstraction layer for cross-runtime compatibility.
 */

export type { IContentFetcher, IHttpFetcherOptions, IPlatformCompilerOptions, PreFetchedContent } from './types.ts';

export { HttpFetcher } from './HttpFetcher.ts';
export { PreFetchedContentFetcher } from './PreFetchedContentFetcher.ts';
export { CompositeFetcher } from './CompositeFetcher.ts';
export { PlatformDownloader } from './PlatformDownloader.ts';
export type { PlatformDownloaderOptions } from './PlatformDownloader.ts';
export { WorkerCompiler } from './WorkerCompiler.ts';
export type { WorkerCompilationResult, WorkerCompilerOptions } from './WorkerCompiler.ts';

// Browser Rendering (Cloudflare Workers only — requires BROWSER binding)
export { BrowserFetcher } from './BrowserFetcher.ts';
export type { BrowserConnector, BrowserFetcherOptions, IBrowserWorker, IPlaywrightBrowser, IPlaywrightPage } from './BrowserFetcher.ts';
