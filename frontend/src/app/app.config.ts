/**
 * Angular PoC - Application Configuration (Browser)
 *
 * Angular 21 Patterns demonstrated here:
 *
 * provideZonelessChangeDetection()
 *   Replaces Zone.js-based change detection. Angular schedules renders via
 *   signal notifications and the microtask queue — no monkey-patching of
 *   browser async APIs (setTimeout, fetch, Promise, etc.).
 *
 * provideAppInitializer() — stable v19+
 *   Replaces the verbose APP_INITIALIZER injection token + factory function.
 *   Accepts a plain callback (sync or async) that runs before the first render.
 *   inject() works inside the callback, so you can pull in any service.
 *
 *   OLD pattern (still works but verbose):
 *     { provide: APP_INITIALIZER, useFactory: (s: ThemeService) => () => s.loadPreferences(), deps: [ThemeService], multi: true }
 *
 *   NEW pattern:
 *     provideAppInitializer(() => { inject(ThemeService).loadPreferences(); })
 */

import { ApplicationConfig, provideAppInitializer, provideZonelessChangeDetection, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { errorInterceptor } from './interceptors/error.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { routes } from './app.routes';
import { ThemeService } from './services/theme.service';
import { API_BASE_URL } from './tokens';

export const appConfig: ApplicationConfig = {
    providers: [
        // Zoneless change detection — no Zone.js required.
        provideZonelessChangeDetection(),

        // Router: map route params to component inputs, smooth View Transitions API,
        // preload all lazy routes after initial navigation completes.
        provideRouter(
            routes,
            withComponentInputBinding(),
            withViewTransitions(),
            withPreloading(PreloadAllModules),
        ),

        // HttpClient with fetch for SSR compatibility + error interceptor.
        provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),

        // Client hydration with HTTP transfer cache — prevents double-fetching
        // API data that was already retrieved during SSR.
        provideClientHydration(withHttpTransferCacheOptions({
            includePostRequests: false,
        })),

        // Angular Material async animations.
        provideAnimationsAsync(),

        // API base URL — browser uses relative '/api', SSR overrides in app.config.server.ts.
        { provide: API_BASE_URL, useValue: '/api' },

        // provideAppInitializer() — runs before the first render.
        // ThemeService reads localStorage and applies the saved theme class to <body>
        // so the app never flashes the wrong theme on load (especially important in SSR).
        provideAppInitializer(() => {
            inject(ThemeService).loadPreferences();
        }),
    ],
};
