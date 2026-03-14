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
