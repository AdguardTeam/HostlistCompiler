/**
 * ClerkService — Signal-based wrapper around `@clerk/clerk-js`.
 *
 * Provides reactive auth state for Angular 21 via signals:
 *   - `isLoaded()` — whether the Clerk SDK has finished initialising
 *   - `isSignedIn()` — whether a user session is active
 *   - `user()` — the current Clerk UserResource (or null)
 *   - `userId()` — shortcut to the Clerk user ID string
 *
 * SSR-safe: all Clerk operations are guarded by `isPlatformBrowser`.
 * Clerk JS is loaded lazily via dynamic import to keep the server bundle clean.
 *
 * Separate from AuthService (admin key management) — the two coexist:
 *   - ClerkService handles user identity (JWT, sign-in/out, user profile)
 *   - AuthService handles legacy admin key authentication
 */

import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import type { Clerk } from '@clerk/clerk-js';
import type { UserResource, SessionResource } from '@clerk/shared/types';

@Injectable({ providedIn: 'root' })
export class ClerkService {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly document = inject(DOCUMENT);
    private clerkInstance: Clerk | null = null;

    // Writable signals (private)
    private readonly _isLoaded = signal(false);
    private readonly _isAvailable = signal(false);
    private readonly _user = signal<UserResource | null>(null);
    private readonly _session = signal<SessionResource | null>(null);

    // Public read-only signals
    readonly isLoaded = this._isLoaded.asReadonly();
    /** True only when the Clerk SDK loaded successfully (publishable key was valid). */
    readonly isAvailable = this._isAvailable.asReadonly();
    readonly user = this._user.asReadonly();
    readonly session = this._session.asReadonly();
    readonly isSignedIn = computed(() => !!this._user());
    readonly userId = computed(() => this._user()?.id ?? null);

    /**
     * Initialise the Clerk SDK. Called from `provideAppInitializer` in app.config.ts.
     * No-op on the server (SSR-safe).
     */
    async initialize(publishableKey: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (!publishableKey) {
            // Mark loaded (but not available) so consumers can show an error/fallback
            // state instead of spinning indefinitely waiting for Clerk to initialise.
            this._isLoaded.set(true);
            return;
        }

        try {
            const { Clerk: ClerkJS } = await import('@clerk/clerk-js');
            this.clerkInstance = new ClerkJS(publishableKey);
            await this.clerkInstance.load();

            // Seed initial state
            this._user.set(this.clerkInstance.user ?? null);
            this._session.set(this.clerkInstance.session ?? null);
            this._isAvailable.set(true);
            this._isLoaded.set(true);

            // Subscribe to future state changes
            this.clerkInstance.addListener((emission) => {
                this._user.set(emission.user ?? null);
                this._session.set(emission.session ?? null);
            });
        } catch (err) {
            // Non-fatal: app works without Clerk (anonymous mode)
            console.error('[ClerkService] Failed to initialise Clerk:', err);
            this._isLoaded.set(true);
        }
    }

    /**
     * Get a fresh session JWT. Returns null when not signed in.
     * Used by the auth interceptor to attach `Authorization: Bearer <token>`.
     */
    async getToken(): Promise<string | null> {
        return (await this.clerkInstance?.session?.getToken()) ?? null;
    }

    /** Mount Clerk's pre-built sign-in UI into the given DOM element. */
    mountSignIn(element: HTMLDivElement, fallbackRedirectUrl?: string): void {
        const props = fallbackRedirectUrl ? { fallbackRedirectUrl } : undefined;
        this.clerkInstance?.mountSignIn(element, props);
    }

    /** Unmount Clerk's sign-in UI from the given DOM element. */
    unmountSignIn(element: HTMLDivElement): void {
        this.clerkInstance?.unmountSignIn(element);
    }

    /** Mount Clerk's pre-built sign-up UI into the given DOM element. */
    mountSignUp(element: HTMLDivElement): void {
        this.clerkInstance?.mountSignUp(element);
    }

    /** Unmount Clerk's sign-up UI from the given DOM element. */
    unmountSignUp(element: HTMLDivElement): void {
        this.clerkInstance?.unmountSignUp(element);
    }

    /** Mount Clerk's user button (avatar + dropdown) into the given DOM element. */
    mountUserButton(element: HTMLDivElement): void {
        this.clerkInstance?.mountUserButton(element);
    }

    /** Unmount Clerk's user button from the given DOM element. */
    unmountUserButton(element: HTMLDivElement): void {
        this.clerkInstance?.unmountUserButton(element);
    }

    /** Sign the user out and clear local state. */
    async signOut(): Promise<void> {
        await this.clerkInstance?.signOut();
        this._user.set(null);
        this._session.set(null);
    }
}
