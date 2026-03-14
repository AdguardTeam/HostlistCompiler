import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ClerkService } from './clerk.service';

describe('ClerkService', () => {
    let service: ClerkService;

    describe('on browser platform', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    provideZonelessChangeDetection(),
                    { provide: PLATFORM_ID, useValue: 'browser' },
                    {
                        provide: DOCUMENT,
                        useValue: {
                            defaultView: globalThis,
                            createElement: () => ({}),
                            querySelector: () => null,
                        },
                    },
                ],
            });
            service = TestBed.inject(ClerkService);
        });

        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        it('should start with isLoaded false', () => {
            expect(service.isLoaded()).toBe(false);
        });

        it('should start with isAvailable false', () => {
            expect(service.isAvailable()).toBe(false);
        });

        it('should start with configLoadFailed false', () => {
            expect(service.configLoadFailed()).toBe(false);
        });

        it('should start with isSignedIn false', () => {
            expect(service.isSignedIn()).toBe(false);
        });

        it('should start with user null', () => {
            expect(service.user()).toBeNull();
        });

        it('should start with userId null', () => {
            expect(service.userId()).toBeNull();
        });

        it('should start with session null', () => {
            expect(service.session()).toBeNull();
        });

        it('should mark isLoaded true (but isAvailable false) when publishableKey is empty', async () => {
            await service.initialize('');
            // isLoaded is set to true so consumers can render an error/fallback
            // state instead of waiting for Clerk indefinitely.
            expect(service.isLoaded()).toBe(true);
            expect(service.isAvailable()).toBe(false);
        });

        it('should set isLoaded true even when Clerk import fails', async () => {
            // Dynamic import of @clerk/clerk-js will fail in test env —
            // the catch block sets isLoaded = true for graceful degradation
            await service.initialize('pk_test_fake_key_12345');
            expect(service.isLoaded()).toBe(true);
            expect(service.isSignedIn()).toBe(false);
        });

        it('should not set isAvailable when Clerk import fails', async () => {
            // isAvailable is only set in the success path; on failure it stays false
            await service.initialize('pk_test_fake_key_12345');
            expect(service.isAvailable()).toBe(false);
        });

        it('should not set isAvailable when publishableKey is empty', async () => {
            await service.initialize('');
            expect(service.isAvailable()).toBe(false);
        });

        it('should set configLoadFailed to true when markConfigLoadFailed() is called', () => {
            service.markConfigLoadFailed();
            expect(service.configLoadFailed()).toBe(true);
        });

        it('should not clear configLoadFailed when initialized with empty key (no-op path)', async () => {
            // initialize('') short-circuits before the success path, so the flag stays true
            service.markConfigLoadFailed();
            await service.initialize('');
            expect(service.configLoadFailed()).toBe(true);
            expect(service.isLoaded()).toBe(true);
            expect(service.isAvailable()).toBe(false);
        });

        it('should not clear configLoadFailed when Clerk SDK import fails (error path)', async () => {
            // Dynamic import of @clerk/clerk-js fails in the test env — the catch block does
            // NOT clear configLoadFailed (only the success path does), so the flag stays true.
            service.markConfigLoadFailed();
            await service.initialize('pk_test_fake_key_12345');
            expect(service.configLoadFailed()).toBe(true);
            expect(service.isLoaded()).toBe(true);
            expect(service.isAvailable()).toBe(false);
        });

        it('should leave isAvailable false when Clerk import fails', async () => {
            // On import failure, only isLoaded is set to true; isAvailable stays false
            await service.initialize('pk_test_fake_key_12345');
            expect(service.isAvailable()).toBe(false);
        });

        it('should return null from getToken when not initialised', async () => {
            const token = await service.getToken();
            expect(token).toBeNull();
        });

        it('should clear user and session on signOut', async () => {
            // signOut should not throw even if Clerk isn't initialised
            await service.signOut();
            expect(service.user()).toBeNull();
            expect(service.session()).toBeNull();
        });
    });

    describe('on server platform (SSR)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    provideZonelessChangeDetection(),
                    { provide: PLATFORM_ID, useValue: 'server' },
                    {
                        provide: DOCUMENT,
                        useValue: {
                            defaultView: null,
                            createElement: () => ({}),
                            querySelector: () => null,
                        },
                    },
                ],
            });
            service = TestBed.inject(ClerkService);
        });

        it('should no-op initialize on server', async () => {
            await service.initialize('pk_test_fake_key');
            // isLoaded and isAvailable stay false on server (early return)
            expect(service.isLoaded()).toBe(false);
            expect(service.isAvailable()).toBe(false);
        });
    });
});
