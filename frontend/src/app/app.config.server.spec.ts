/**
 * Unit tests for the `API_BASE_URL` factory in `app.config.server.ts`.
 *
 * The factory derives an absolute origin from Angular SSR's `REQUEST` token
 * so that HTTP calls made during server-side rendering use a fully-qualified
 * URL (required because SSR has no browser origin to resolve relative paths).
 *
 * Three cases are covered:
 *   1. Valid absolute REQUEST URL  → `${origin}/api`
 *   2. REQUEST token not provided  → `/api`  (prerendering / static generation)
 *   3. Malformed REQUEST URL       → `/api`  (safe fallback)
 */

import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { REQUEST } from '@angular/core';
import { API_BASE_URL } from './tokens';
import { ssrApiBaseUrlFactory } from './app.config.server';

describe('app.config.server — API_BASE_URL factory', () => {
    afterEach(() => TestBed.resetTestingModule());

    function configure(requestOrNull: Request | null): void {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                ...(requestOrNull !== null ? [{ provide: REQUEST, useValue: requestOrNull }] : []),
                { provide: API_BASE_URL, useFactory: ssrApiBaseUrlFactory },
            ],
        });
    }

    it('derives an absolute base URL from a valid request origin', () => {
        configure(new Request('https://adblock-compiler.workers.dev/compiler'));
        const url = TestBed.inject(API_BASE_URL);
        expect(url).toBe('https://adblock-compiler.workers.dev/api');
    });

    it('preserves the origin for a localhost wrangler dev URL', () => {
        configure(new Request('http://localhost:8787/admin'));
        const url = TestBed.inject(API_BASE_URL);
        expect(url).toBe('http://localhost:8787/api');
    });

    it('falls back to /api when REQUEST is not provided (prerendering)', () => {
        configure(null);
        const url = TestBed.inject(API_BASE_URL);
        expect(url).toBe('/api');
    });

    it('falls back to /api when the request URL is malformed', () => {
        // A URL string with embedded spaces causes `new URL()` to throw a TypeError.
        const fakeRequest = { url: 'not a valid url' } as unknown as Request;
        configure(fakeRequest);
        const url = TestBed.inject(API_BASE_URL);
        expect(url).toBe('/api');
    });
});
