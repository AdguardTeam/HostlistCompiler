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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, retry, timer } from 'rxjs';
import {
    GetKeysResponseSchema,
    CreateKeyResponseSchema,
    UpdateKeyResponseSchema,
    validateResponse,
} from '../schemas/api-responses';

// ---------------------------------------------------------------------------
// Retry helper for transient HTTP errors (5xx, network failures)
// ---------------------------------------------------------------------------

/** Retry config: 2 retries with exponential backoff, only for transient errors. */
const TRANSIENT_RETRY = retry<unknown>({
    count: 2,
    delay: (error, retryCount) => {
        // Only retry on 5xx or network errors (status 0)
        if (error instanceof HttpErrorResponse && error.status >= 500) {
            return timer(300 * 2 ** (retryCount - 1));
        }
        if (error instanceof HttpErrorResponse && error.status === 0) {
            return timer(300 * 2 ** (retryCount - 1));
        }
        // Don't retry 4xx or non-HTTP errors
        throw error;
    },
});

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

/** Shape of the top-level POST /api/keys response body. */
export interface CreateApiKeyResponse {
    success: boolean;
    /** Plaintext key — returned only once on creation. */
    key: string;
    id: string;
    keyPrefix: string;
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    expiresAt: string | null;
    createdAt: string;
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
            const raw = await firstValueFrom(
                this.http.get<unknown>('/api/keys').pipe(TRANSIENT_RETRY),
            );
            const res = validateResponse(GetKeysResponseSchema, raw, 'GET /api/keys');
            this._keys.set(res.keys ?? []);
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
            const raw = await firstValueFrom(
                this.http.post<unknown>('/api/keys', req).pipe(TRANSIENT_RETRY),
            );
            const res = validateResponse(CreateKeyResponseSchema, raw, 'POST /api/keys');
            // Refresh the list to include the new key
            await this.loadKeys();
            return res.key ?? null;
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
                this.http.delete(`/api/keys/${id}`).pipe(TRANSIENT_RETRY),
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
            const raw = await firstValueFrom(
                this.http.patch<unknown>(`/api/keys/${id}`, req).pipe(TRANSIENT_RETRY),
            );
            const res = validateResponse(UpdateKeyResponseSchema, raw, `PATCH /api/keys/${id}`);
            // Backend returns the updated key fields at the top level alongside success:true
            if (res.id) {
                this._keys.update((keys) => keys.map((k) => {
                    if (k.id !== id) return k;
                    // PATCH response does not include revokedAt — preserve from current state
                    return {
                        id: res.id,
                        keyPrefix: res.keyPrefix,
                        name: res.name,
                        scopes: res.scopes,
                        rateLimitPerMinute: res.rateLimitPerMinute,
                        lastUsedAt: res.lastUsedAt,
                        expiresAt: res.expiresAt,
                        revokedAt: k.revokedAt,
                        createdAt: res.createdAt,
                    };
                }));
            }
            return true;
        } catch (err) {
            this._error.set(err instanceof Error ? err.message : 'Failed to update API key');
            return false;
        }
    }
}
