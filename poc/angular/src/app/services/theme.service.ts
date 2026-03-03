/**
 * Angular PoC - Theme Service
 *
 * Angular 21 Patterns demonstrated:
 *
 * Injectable service with signal state
 *   isDark() is a computed signal derived from _isDark WritableSignal.
 *   Any component that reads isDark() will be automatically re-rendered when
 *   the theme changes — no manual BehaviorSubject + subscribe needed.
 *
 * inject(DOCUMENT) for SSR-safe DOM access
 *   Never use `document` directly — DOCUMENT token resolves to the real DOM in
 *   the browser and to a server-side stub during SSR prerendering.
 *
 * Used by provideAppInitializer() in app.config.ts
 *   loadPreferences() runs before the first render so the correct theme class
 *   is applied to <body> before Angular paints anything — eliminates the dark/
 *   light theme flash on page load (FOUC).
 */

import { Injectable, DOCUMENT, inject, signal, computed } from '@angular/core';

/**
 * ThemeService
 * Manages dark/light theme state across the application.
 * Persists preference to localStorage (SSR-safe guard included).
 */
@Injectable({
    providedIn: 'root',
})
export class ThemeService {
    private readonly _isDark = signal<boolean>(false);

    /** Read-only signal — consumed by AppComponent and any other interested component */
    readonly isDark = computed(() => this._isDark());

    /** Injected DOCUMENT token — SSR-safe alternative to direct `document` access */
    private readonly doc = inject(DOCUMENT);

    /**
     * loadPreferences()
     * Called by provideAppInitializer() in app.config.ts BEFORE the first render.
     * Reads the persisted theme preference from localStorage and applies it to <body>.
     */
    loadPreferences(): void {
        try {
            const saved = localStorage.getItem('theme');
            const dark = saved === 'dark';
            this._isDark.set(dark);
            this.applyThemeClass(dark);
        } catch {
            // localStorage may throw SecurityError in private browsing mode or when
            // storage access is disabled. Silently fall back to the default (light) theme.
        }
    }

    /**
     * toggle()
     * Flips the theme, persists the new preference, and updates the DOM class.
     */
    toggle(): void {
        const newDark = !this._isDark();
        this._isDark.set(newDark);
        this.applyThemeClass(newDark);
        try {
            localStorage.setItem('theme', newDark ? 'dark' : 'light');
        } catch {
            // Silently ignore storage errors (private browsing, disabled storage).
        }
    }

    private applyThemeClass(dark: boolean): void {
        const body = this.doc.body;
        if (dark) {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }
    }
}
