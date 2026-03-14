/**
 * ClerkAppearanceService — Builds Clerk `Appearance` objects from the app's
 * Material Design 3 CSS custom properties.
 *
 * Reads actual runtime CSS token values via `getComputedStyle` so the Clerk
 * widgets (SignIn, SignUp, UserButton) automatically pick up the correct colour
 * scheme — including dark-mode overrides — without any hardcoded duplication.
 *
 * SSR-safe: `getComputedStyle` is browser-only, so all DOM reads are guarded
 * by `isPlatformBrowser`.  On the server a static fallback object is returned
 * using the light-mode token values from `:root` in `styles.css`.
 */

import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ThemeService } from './theme.service';

/** Shape of a Clerk `Appearance` object (subset we actually populate). */
export interface ClerkAppearance {
    baseTheme?: string;
    variables?: Record<string, string>;
    elements?: Record<string, Record<string, string>>;
}

/** Static light-mode fallbacks matching the `:root` values in styles.css. */
const LIGHT_FALLBACKS: Record<string, string> = {
    '--mat-sys-primary': '#b45309',
    '--mat-sys-surface': '#ffffff',
    '--mat-sys-surface-container-lowest': '#ffffff',
    '--mat-sys-on-surface': '#111111',
    '--mat-sys-on-surface-variant': '#4b4540',
    '--mat-sys-error': '#dc2626',
    '--mat-sys-outline': '#c9c4be',
    '--mat-sys-outline-variant': '#e5e1da',
    '--app-success': '#059669',
};

/** Static dark-mode fallbacks matching the `body.dark-theme` values in styles.css. */
const DARK_FALLBACKS: Record<string, string> = {
    '--mat-sys-primary': '#f59e0b',
    '--mat-sys-surface': '#0f0f0f',
    '--mat-sys-surface-container-lowest': '#050505',
    '--mat-sys-on-surface': '#f0ece4',
    '--mat-sys-on-surface-variant': '#c9c4be',
    '--mat-sys-error': '#f87171',
    '--mat-sys-outline': '#6b6560',
    '--mat-sys-outline-variant': '#3a3630',
    '--app-success': '#059669',
};

@Injectable({ providedIn: 'root' })
export class ClerkAppearanceService {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly document = inject(DOCUMENT);
    private readonly themeService = inject(ThemeService);

    /**
     * Construct the full Clerk `Appearance` object.
     *
     * When running in a browser the method reads actual computed values from
     * the document root so dark-mode overrides propagate automatically.
     * When running on the server (SSR) it falls back to the hardcoded token
     * values defined in `styles.css`.
     */
    buildAppearance(): ClerkAppearance {
        const dark = this.themeService.isDark();
        const token = (name: string): string => this.resolveToken(name, dark);

        const outlineVariant = token('--mat-sys-outline-variant');

        return {
            baseTheme: dark ? 'dark' : undefined,
            variables: {
                colorPrimary: token('--mat-sys-primary'),
                colorBackground: token('--mat-sys-surface'),
                colorInputBackground: token('--mat-sys-surface-container-lowest'),
                colorText: token('--mat-sys-on-surface'),
                colorTextSecondary: token('--mat-sys-on-surface-variant'),
                colorInputText: token('--mat-sys-on-surface'),
                colorDanger: token('--mat-sys-error'),
                colorSuccess: token('--app-success'),
                colorNeutral: token('--mat-sys-outline'),
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontFamilyButtons: "'IBM Plex Sans', sans-serif",
                borderRadius: '4px',
                fontSize: '15px',
            },
            elements: {
                card: {
                    boxShadow: `0 1px 3px 0 ${outlineVariant}`,
                    border: `1px solid ${outlineVariant}`,
                },
            },
        };
    }

    /**
     * Resolve a CSS custom property value.
     *
     * In the browser we read from `getComputedStyle(documentElement)` so we
     * get the correct value for the current theme class on `<body>`.  On the
     * server we fall back to the hardcoded token maps.
     */
    private resolveToken(name: string, dark: boolean): string {
        if (isPlatformBrowser(this.platformId)) {
            const computed = getComputedStyle(this.document.documentElement)
                .getPropertyValue(name)
                .trim();
            if (computed) return computed;
        }

        // SSR fallback (or empty computed value)
        const fallbacks = dark ? DARK_FALLBACKS : LIGHT_FALLBACKS;
        return fallbacks[name] ?? '';
    }
}
