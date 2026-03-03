/**
 * Vitest global test setup for Angular 21
 *
 * This file is executed once before any spec file is loaded (configured via
 * `setupFiles` in `vitest.config.ts`).
 *
 * Why `@angular/compiler` must be imported here:
 *   Angular's TestBed uses the JIT compiler to compile components declared in
 *   `TestBed.configureTestingModule()`. The JIT compiler is exported from
 *   `@angular/compiler` and must be loaded before the first `TestBed` call.
 *   In the CLI's Karma setup this import was injected automatically by the
 *   `@angular-devkit/build-angular` builder; with Vitest we add it explicitly.
 *
 * Add any additional global polyfills or test utilities below this import.
 * Examples:
 *   - `import 'zone.js/testing';`  (only if Zone.js is re-enabled)
 *   - `import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';`
 */
import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// Mock IntersectionObserver for jsdom (used by @defer (on viewport))
if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class IntersectionObserver {
        readonly root = null;
        readonly rootMargin = '0px';
        readonly thresholds: readonly number[] = [0];
        constructor(private callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] { return []; }
    } as any;
}

TestBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
);
