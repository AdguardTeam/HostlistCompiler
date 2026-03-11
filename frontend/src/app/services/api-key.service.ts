/**
 * ApiKeyService — Signal-based service for managing user API keys.
 *
 * Communicates with the `/api/keys` endpoints on the worker backend.
 * Requires Clerk JWT authentication (the auth interceptor attaches the
 * Bearer token automatically).
 *
 * State is stored in signals so components reactively update on changes.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiKey {
    id: string;
    keyPrefix: string;
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
}

export interface CreateApiKeyRequest {
    name: string;
    scopes?: string[];
    expiresInDays?: number;
}

export interface CreateApiKeyResponse {
    key: ApiKey;
    plaintext: string;
}

export interface UpdateApiKeyRequest {
    name?: string;
    scopes?: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class ApiKeyService {
    private readonly http = inject(HttpClient);

    // State
    private readonly _keys = signal<ApiKey[]>([]);
    private readonly _loading = signal(false);
    private readonly _error = signal<string | null>(null);

    // Public read-only
    readonly keys = this._keys.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly error = this._error.asReadonly();
    readonly count = computed(() => this._keys().length);
    readonly activeKeys = computed(() =>
        this._keys().filter((k) => !k.revokedAt && (!k.expiresAt || new Date(k.expiresAt) > new Date())),
    );

    /** Fetch all API keys for the current user. */
    async loadKeys(): Promise<void> {
        this._loading.set(true);
        this._error.set(null);
        try {
            const res = await firstValueFrom(
                this.http.get<{ data: ApiKey[] }>('/api/keys'),
            );
            this._keys.set(res.data ?? []);
        } catch (err) {
            this._error.set(err instanceof Error ? err.message : 'Failed to load API keys');
        } finally {
            this._loading.set(false);
        }
    }

    /** Create a new API key. Returns the plaintext (shown once). */
    async createKey(req: CreateApiKeyRequest): Promise<string | null> {
        this._error.set(null);
        try {
            const res = await firstValueFrom(
                this.http.post<{ data: CreateApiKeyResponse }>('/api/keys', req),
            );
            // Refresh the list to include the new key
            await this.loadKeys();
            return res.data?.plaintext ?? null;
        } catch (err) {
            this._error.set(err instanceof Error ? err.message : 'Failed to create API key');
            return null;
        }
    }

    /** Revoke (soft-delete) an API key by ID. */
    async revokeKey(id: string): Promise<boolean> {
        this._error.set(null);
        try {
            await firstValueFrom(
                this.http.delete(`/api/keys/${id}`),
            );
            // Update local state immediately
            this._keys.update((keys) =>
                keys.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
            );
            return true;
        } catch (err) {
            this._error.set(err instanceof Error ? err.message : 'Failed to revoke API key');
            return false;
        }
    }

    /** Update an API key's name or scopes. */
    async updateKey(id: string, req: UpdateApiKeyRequest): Promise<boolean> {
        this._error.set(null);
        try {
            const res = await firstValueFrom(
                this.http.patch<{ data: ApiKey }>(`/api/keys/${id}`, req),
            );
            // Update local state with the returned key
            if (res.data) {
                this._keys.update((keys) => keys.map((k) => (k.id === id ? res.data : k)));
            }
            return true;
        } catch (err) {
            this._error.set(err instanceof Error ? err.message : 'Failed to update API key');
            return false;
        }
    }
}
