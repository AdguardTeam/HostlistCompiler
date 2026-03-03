/**
 * AuthService — manages admin authentication state.
 *
 * The admin key is stored in a signal and attached to requests via
 * the HTTP interceptor. Persisted to sessionStorage so it survives
 * navigation but not browser close.
 */

import { Injectable, signal, computed } from '@angular/core';

const ADMIN_KEY_STORAGE = 'adblock-admin-key';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    /** Current admin key (empty = not authenticated) */
    readonly adminKey = signal(this.loadKey());

    /** Whether the user has entered an admin key */
    readonly isAuthenticated = computed(() => this.adminKey().length > 0);

    setKey(key: string): void {
        this.adminKey.set(key);
        try {
            if (key) {
                sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
            } else {
                sessionStorage.removeItem(ADMIN_KEY_STORAGE);
            }
        } catch {
            // SSR or restricted storage — ignore
        }
    }

    clearKey(): void {
        this.setKey('');
    }

    private loadKey(): string {
        try {
            return sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
        } catch {
            return '';
        }
    }
}
