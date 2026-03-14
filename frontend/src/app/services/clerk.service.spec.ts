import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClerkService } from './clerk.service';
import { ClerkAppearanceService } from './clerk-appearance.service';

const MOCK_APPEARANCE = { variables: { colorPrimary: '#b45309' }, elements: { card: {} } };

function makeMockAppearanceService() {
    return { buildAppearance: vi.fn().mockReturnValue(MOCK_APPEARANCE) };
}

// Deterministically mock @clerk/clerk-js so Clerk.load() throws a controlled
// error instead of relying on an environment-specific import failure.
vi.mock('@clerk/clerk-js', () => ({
    Clerk: vi.fn().mockImplementation(() => ({
        load: vi.fn().mockRejectedValue(new Error('Clerk SDK initialization failed')),
        addListener: vi.fn(),
        user: null,
        session: null,
    })),
}));

describe('ClerkService', () => {
    let service: ClerkService;

    describe('on browser platform', () => {
        let mockAppearanceService: ReturnType<typeof makeMockAppearanceService>;

        beforeEach(() => {
            mockAppearanceService = makeMockAppearanceService();
            TestBed.configureTestingModule({
                providers: [
                    provideZonelessChangeDetection(),
                    { provide: PLATFORM_ID, useValue: 'browser' },
                    { provide: DOCUMENT,
                        useValue: {
                            defaultView: globalThis,
                            createElement: () => ({}),
                            querySelector: () => null,
                        },
                    },
                    { provide: ClerkAppearanceService, useValue: mockAppearanceService },
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

        it('should set isLoaded true even when initialize() throws', async () => {
            // Clerk.load() is mocked to throw — the catch block sets isLoaded = true
            // for graceful degradation so consumers can render a fallback state.
            await service.initialize('pk_test_fake_key_12345');
            expect(service.isLoaded()).toBe(true);
            expect(service.isSignedIn()).toBe(false);
        });

        it('should not set isAvailable when initialize() throws', async () => {
            // isAvailable is only set in the success path; on error it stays false
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

        it('should not clear configLoadFailed when initialize() throws (error path)', async () => {
            // Clerk.load() is mocked to throw — the catch block does NOT clear
            // configLoadFailed (only the success path does), so the flag stays true.
            service.markConfigLoadFailed();
            await service.initialize('pk_test_fake_key_12345');
            expect(service.configLoadFailed()).toBe(true);
            expect(service.isLoaded()).toBe(true);
            expect(service.isAvailable()).toBe(false);
        });

        it('should leave isAvailable false when initialize() throws', async () => {
            // On error, only isLoaded is set to true; isAvailable stays false
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

        describe('mount calls pass appearance', () => {
            beforeEach(() => {
                // Inject a stub clerkInstance with mount/unmount spies
                (service as any).clerkInstance = {
                    mountSignIn: vi.fn(),
                    mountSignUp: vi.fn(),
                    mountUserButton: vi.fn(),
                };
            });

            it('mountSignIn should call buildAppearance and pass appearance', () => {
                const el = document.createElement('div') as HTMLDivElement;
                service.mountSignIn(el);

                expect(mockAppearanceService.buildAppearance).toHaveBeenCalledTimes(1);
                expect((service as any).clerkInstance.mountSignIn).toHaveBeenCalledWith(
                    el,
                    expect.objectContaining({ appearance: MOCK_APPEARANCE }),
                );
            });

            it('mountSignIn should preserve fallbackRedirectUrl alongside appearance', () => {
                const el = document.createElement('div') as HTMLDivElement;
                service.mountSignIn(el, '/dashboard');

                expect((service as any).clerkInstance.mountSignIn).toHaveBeenCalledWith(
                    el,
                    { fallbackRedirectUrl: '/dashboard', appearance: MOCK_APPEARANCE },
                );
            });

            it('mountSignIn without fallbackRedirectUrl should not include that key', () => {
                const el = document.createElement('div') as HTMLDivElement;
                service.mountSignIn(el);

                const callArg = (service as any).clerkInstance.mountSignIn.mock.calls[0][1];
                expect(callArg).not.toHaveProperty('fallbackRedirectUrl');
                expect(callArg).toHaveProperty('appearance', MOCK_APPEARANCE);
            });

            it('mountSignUp should call buildAppearance and pass appearance', () => {
                const el = document.createElement('div') as HTMLDivElement;
                service.mountSignUp(el);

                expect(mockAppearanceService.buildAppearance).toHaveBeenCalledTimes(1);
                expect((service as any).clerkInstance.mountSignUp).toHaveBeenCalledWith(
                    el,
                    expect.objectContaining({ appearance: MOCK_APPEARANCE }),
                );
            });

            it('mountUserButton should call buildAppearance and pass appearance', () => {
                const el = document.createElement('div') as HTMLDivElement;
                service.mountUserButton(el);

                expect(mockAppearanceService.buildAppearance).toHaveBeenCalledTimes(1);
                expect((service as any).clerkInstance.mountUserButton).toHaveBeenCalledWith(
                    el,
                    expect.objectContaining({ appearance: MOCK_APPEARANCE }),
                );
            });
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
                    { provide: ClerkAppearanceService, useValue: makeMockAppearanceService() },
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
