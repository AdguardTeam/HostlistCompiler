/**
 * TurnstileService — Wraps Cloudflare Turnstile's client-side API.
 *
 * Manages the Turnstile widget lifecycle (render, reset, remove) and
 * exposes the verification token as a signal for consumption by
 * components that need bot protection (e.g. CompilerComponent).
 *
 * Angular 21 patterns: signal(), computed(), Injectable, inject(DOCUMENT)
 */

import { Injectable, DOCUMENT, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Turnstile global API (injected via script tag) */
declare const turnstile: {
    render(container: string | HTMLElement, options: TurnstileRenderOptions): string;
    reset(widgetId: string): void;
    remove(widgetId: string): void;
};

interface TurnstileRenderOptions {
    sitekey: string;
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
}

@Injectable({ providedIn: 'root' })
export class TurnstileService {
    private readonly doc = inject(DOCUMENT);
    private readonly platformId = inject(PLATFORM_ID);

    /** Current verification token (empty = not verified) */
    readonly token = signal('');
    /** Whether a valid token is available */
    readonly isVerified = computed(() => this.token().length > 0);
    /** Current widget ID (null if not rendered) */
    private widgetId: string | null = null;

    /** Site key — should be provided via environment/config in production */
    private siteKey = '';

    /** Configure the site key (call once at app init or from environment) */
    setSiteKey(key: string): void {
        this.siteKey = key;
    }

    /**
     * Render the Turnstile widget into the given container element.
     * Returns the widget ID for later reset/removal.
     */
    render(container: HTMLElement, theme: 'light' | 'dark' | 'auto' = 'auto'): string | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        if (!this.siteKey) {
            console.warn('[Turnstile] No site key configured — skipping render');
            return null;
        }

        // Remove previous widget if any
        this.remove();

        try {
            this.widgetId = turnstile.render(container, {
                sitekey: this.siteKey,
                theme,
                callback: (token: string) => this.token.set(token),
                'expired-callback': () => this.token.set(''),
                'error-callback': () => this.token.set(''),
            });
            return this.widgetId;
        } catch {
            console.warn('[Turnstile] Widget render failed — turnstile script may not be loaded');
            return null;
        }
    }

    /** Reset the widget (clears token and prompts re-verification) */
    reset(): void {
        this.token.set('');
        if (this.widgetId) {
            try { turnstile.reset(this.widgetId); } catch { /* noop */ }
        }
    }

    /** Remove the widget from the DOM */
    remove(): void {
        if (this.widgetId) {
            try { turnstile.remove(this.widgetId); } catch { /* noop */ }
            this.widgetId = null;
        }
        this.token.set('');
    }
}
