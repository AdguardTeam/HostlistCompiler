/**
 * Angular - Application Configuration (Browser)
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

import { ApplicationConfig, ErrorHandler, PLATFORM_ID, provideAppInitializer, provideZonelessChangeDetection, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions, withPreloading, PreloadAllModules, TitleStrategy } from '@angular/router';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { routes } from './app.routes';
import { AppTitleStrategy } from './title-strategy';
import { ThemeService } from './services/theme.service';
import { ClerkService } from './services/clerk.service';
import { GlobalErrorHandler } from './error/global-error-handler';
import { TurnstileService } from './services/turnstile.service';
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

        // Custom TitleStrategy: appends "| Adblock Compiler" to each route title
        // for WCAG 2.4.2 (Page Titled) compliance.
        { provide: TitleStrategy, useClass: AppTitleStrategy },

        // HttpClient with fetch for SSR compatibility + auth and error interceptors.
        // Order matters: authInterceptor adds Bearer token, then errorInterceptor adds X-Trace-ID.
        provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),

        // Client hydration with HTTP transfer cache — prevents double-fetching
        // API data that was already retrieved during SSR.
        provideClientHydration(withHttpTransferCacheOptions({
            includePostRequests: false,
        })),

        // Angular Material async animations.
        provideAnimationsAsync(),

        // API base URL — browser uses relative '/api', SSR overrides in app.config.server.ts.
        { provide: API_BASE_URL, useValue: '/api' },

        // Item 14: Custom error handler with signal-based state
        { provide: ErrorHandler, useClass: GlobalErrorHandler },

        // provideAppInitializer() — runs before the first render.
        // ThemeService reads localStorage and applies the saved theme class to <body>
        // so the app never flashes the wrong theme on load (especially important in SSR).
        // MatIconRegistry: switches mat-icon from the legacy 'Material Icons' ligature font
        // (not in npm) to the 'material-symbols' npm package which is already imported in
        // styles.css via `@import 'material-symbols/outlined.css'`.
        // TurnstileService: awaits /api/turnstile-config (browser only) so the site key
        // signal is populated before the first render, ensuring the Turnstile widget
        // renders with the correct key. Skipped during SSR/prerendering — Turnstile is
        // only used on the compiler route (RenderMode.Server) and the widget is
        // browser-only. A try/catch keeps this non-fatal so a network failure or timeout
        // still allows the app to boot with Turnstile simply disabled.
        provideAppInitializer(async () => {
            inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
            inject(ThemeService).loadPreferences();

            if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

            const http = inject(HttpClient);
            const turnstileService = inject(TurnstileService);
            const apiBaseUrl = inject(API_BASE_URL);

            try {
                const config = await firstValueFrom(
                    http.get<{ siteKey: string | null; enabled: boolean }>(`${apiBaseUrl}/turnstile-config`)
                        .pipe(timeout(5000)),
                );
                if (config.enabled && config.siteKey) {
                    turnstileService.setSiteKey(config.siteKey);
                }
            } catch {
                // Non-fatal: Turnstile will be disabled if config can't be fetched or times out
            }

            // Clerk SDK initialisation (browser only, non-fatal)
            // Fetches the publishable key from /api/clerk-config at runtime —
            // mirrors the Turnstile pattern above so no build-time env files are needed.
            try {
                const clerkConfig = await firstValueFrom(
                    http.get<{ publishableKey: string | null }>(`${apiBaseUrl}/clerk-config`)
                        .pipe(timeout(5000)),
                );
                if (clerkConfig.publishableKey) {
                    await inject(ClerkService).initialize(clerkConfig.publishableKey);
                }
            } catch (err) {
                // Non-fatal: Clerk will be uninitialised if config can't be fetched
                console.warn('[app.config] Failed to load Clerk config:', err instanceof Error ? err.message : String(err));
            }
        }),
    ],
};
