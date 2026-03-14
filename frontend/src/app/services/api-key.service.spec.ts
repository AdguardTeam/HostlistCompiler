import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiKeyService, ApiKey } from './api-key.service';

/** Flush one round of microtasks (Promise callbacks). */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const MOCK_KEY: ApiKey = {
    id: 'key-1',
    keyPrefix: 'abc_1234',
    name: 'Test Key',
    scopes: ['compile'],
    rateLimitPerMinute: 60,
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
};

/** Backend wraps all GET /api/keys responses as { success, keys, total }. */
const listResponse = (keys: ApiKey[]) => ({ success: true, keys, total: keys.length });

describe('ApiKeyService', () => {
    let service: ApiKeyService;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        service = TestBed.inject(ApiKeyService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should start with empty keys', () => {
        expect(service.keys()).toEqual([]);
        expect(service.count()).toBe(0);
        expect(service.loading()).toBe(false);
        expect(service.error()).toBeNull();
    });

    describe('loadKeys', () => {
        it('should fetch and set keys', async () => {
            const promise = service.loadKeys();
            expect(service.loading()).toBe(true);

            await tick();
            const req = httpTesting.expectOne('/api/keys');
            expect(req.request.method).toBe('GET');
            req.flush(listResponse([MOCK_KEY]));

            await promise;
            expect(service.keys()).toEqual([MOCK_KEY]);
            expect(service.count()).toBe(1);
            expect(service.loading()).toBe(false);
        });

        it('should set error on failure', async () => {
            const promise = service.loadKeys();

            await tick();
            const req = httpTesting.expectOne('/api/keys');
            req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

            await promise;
            expect(service.error()).toBeTruthy();
            expect(service.loading()).toBe(false);
        });
    });

    describe('createKey', () => {
        it('should POST and return plaintext', async () => {
            // Backend returns the key fields merged at the top level alongside success:true.
            const createResponse = {
                success: true,
                id: MOCK_KEY.id,
                key: 'abc_secret_key_here',  // plaintext returned only on creation
                keyPrefix: MOCK_KEY.keyPrefix,
                name: MOCK_KEY.name,
                scopes: MOCK_KEY.scopes,
                rateLimitPerMinute: MOCK_KEY.rateLimitPerMinute,
                expiresAt: null,
                createdAt: MOCK_KEY.createdAt,
            };

            const promise = service.createKey({ name: 'New Key', scopes: ['compile'] });

            // Flush the POST request
            await tick();
            const req = httpTesting.expectOne({ method: 'POST', url: '/api/keys' });
            expect(req.request.body).toEqual({ name: 'New Key', scopes: ['compile'] });
            req.flush(createResponse);

            // createKey chains loadKeys — wait for the refresh GET to appear
            await tick();
            const refreshReq = httpTesting.expectOne({ method: 'GET', url: '/api/keys' });
            refreshReq.flush(listResponse([MOCK_KEY]));

            const plaintext = await promise;
            expect(plaintext).toBe('abc_secret_key_here');
        });

        it('should set error on failure', async () => {
            const promise = service.createKey({ name: 'Bad Key' });

            await tick();
            const req = httpTesting.expectOne('/api/keys');
            req.error(new ProgressEvent('error'), { status: 400, statusText: 'Bad Request' });

            const plaintext = await promise;
            expect(plaintext).toBeNull();
            expect(service.error()).toBeTruthy();
        });
    });

    describe('revokeKey', () => {
        it('should DELETE and update local state', async () => {
            // Seed a key into local state first
            const loadPromise = service.loadKeys();
            await tick();
            httpTesting.expectOne('/api/keys').flush(listResponse([MOCK_KEY]));
            await loadPromise;

            const promise = service.revokeKey('key-1');

            await tick();
            const req = httpTesting.expectOne('/api/keys/key-1');
            expect(req.request.method).toBe('DELETE');
            req.flush({ success: true, message: 'API key revoked' });

            const ok = await promise;
            expect(ok).toBe(true);
            expect(service.keys()[0].revokedAt).toBeTruthy();
        });

        it('should set error on failure', async () => {
            const promise = service.revokeKey('key-1');

            await tick();
            const req = httpTesting.expectOne('/api/keys/key-1');
            req.error(new ProgressEvent('error'), { status: 404, statusText: 'Not Found' });

            const ok = await promise;
            expect(ok).toBe(false);
            expect(service.error()).toBeTruthy();
        });
    });

    describe('updateKey', () => {
        it('should PATCH and update local state', async () => {
            // Seed a key first
            const loadPromise = service.loadKeys();
            await tick();
            httpTesting.expectOne('/api/keys').flush(listResponse([MOCK_KEY]));
            await loadPromise;

            // Backend returns updated key fields at top level alongside success:true
            // Note: PATCH response includes updatedAt but not revokedAt
            const updatedRow = {
                id: MOCK_KEY.id,
                keyPrefix: MOCK_KEY.keyPrefix,
                name: 'Updated Name',
                scopes: MOCK_KEY.scopes,
                rateLimitPerMinute: MOCK_KEY.rateLimitPerMinute,
                lastUsedAt: MOCK_KEY.lastUsedAt,
                expiresAt: MOCK_KEY.expiresAt,
                createdAt: MOCK_KEY.createdAt,
                updatedAt: '2025-06-01T00:00:00Z',
            };
            const promise = service.updateKey('key-1', { name: 'Updated Name' });

            await tick();
            const req = httpTesting.expectOne('/api/keys/key-1');
            expect(req.request.method).toBe('PATCH');
            expect(req.request.body).toEqual({ name: 'Updated Name' });
            req.flush({ success: true, ...updatedRow });

            const ok = await promise;
            expect(ok).toBe(true);
            expect(service.keys()[0].name).toBe('Updated Name');
        });

        it('should set error on failure', async () => {
            const promise = service.updateKey('key-1', { name: 'Fail' });

            await tick();
            const req = httpTesting.expectOne('/api/keys/key-1');
            req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

            const ok = await promise;
            expect(ok).toBe(false);
            expect(service.error()).toBeTruthy();
        });
    });

    describe('computed signals', () => {
        it('should compute activeKeys excluding revoked and expired', async () => {
            const expired: ApiKey = { ...MOCK_KEY, id: 'key-2', expiresAt: '2020-01-01T00:00:00Z' };
            const revoked: ApiKey = { ...MOCK_KEY, id: 'key-3', revokedAt: '2025-01-01T00:00:00Z' };
            const active: ApiKey = { ...MOCK_KEY, id: 'key-4' };

            const promise = service.loadKeys();
            await tick();
            httpTesting.expectOne('/api/keys').flush(listResponse([expired, revoked, active]));
            await promise;

            expect(service.count()).toBe(3);
            expect(service.activeKeys().length).toBe(1);
            expect(service.activeKeys()[0].id).toBe('key-4');
        });
    });
});
