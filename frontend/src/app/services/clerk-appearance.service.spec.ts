import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClerkAppearanceService } from './clerk-appearance.service';
import { ThemeService } from './theme.service';

describe('ClerkAppearanceService', () => {
    describe('on browser platform (light mode)', () => {
        let service: ClerkAppearanceService;
        let themeService: ThemeService;

        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    provideZonelessChangeDetection(),
                    { provide: PLATFORM_ID, useValue: 'browser' },
                ],
            });
            service = TestBed.inject(ClerkAppearanceService);
            themeService = TestBed.inject(ThemeService);
            // Ensure light mode
            if (themeService.isDark()) {
                themeService.toggle();
            }
        });

        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        it('should return an appearance object', () => {
            const appearance = service.buildAppearance();
            expect(appearance).toBeTruthy();
            expect(typeof appearance).toBe('object');
        });

        it('should include variables in appearance', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables).toBeTruthy();
        });

        it('should include elements overrides', () => {
            const appearance = service.buildAppearance();
            expect(appearance.elements).toBeTruthy();
            expect(appearance.elements?.['card']).toBeTruthy();
        });

        it('should set correct font family', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables?.['fontFamily']).toContain('IBM Plex Sans');
            expect(appearance.variables?.['fontFamilyButtons']).toContain('IBM Plex Sans');
        });

        it('should set borderRadius to 4px', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables?.['borderRadius']).toBe('4px');
        });

        it('should set fontSize to 15px', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables?.['fontSize']).toBe('15px');
        });

        it('should not set baseTheme in light mode', () => {
            const appearance = service.buildAppearance();
            expect(appearance.baseTheme).toBeUndefined();
        });

        it('should set baseTheme to dark in dark mode', () => {
            themeService.toggle(); // switch to dark
            const appearance = service.buildAppearance();
            expect(appearance.baseTheme).toBe('dark');
        });

        it('should read token values from getComputedStyle in browser', () => {
            // Stub getComputedStyle to return known CSS custom property values
            const cssVars: Record<string, string> = {
                '--mat-sys-primary': '#cc6600',
                '--mat-sys-surface': '#fafafa',
                '--mat-sys-surface-container-lowest': '#f0f0f0',
                '--mat-sys-on-surface': '#222222',
                '--mat-sys-on-surface-variant': '#555555',
                '--mat-sys-error': '#ee1111',
                '--app-success': '#00aa55',
                '--mat-sys-outline': '#aaaaaa',
                '--mat-sys-outline-variant': '#dddddd',
            };
            const spy = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
                getPropertyValue: (prop: string) => cssVars[prop] ?? '',
            } as unknown as CSSStyleDeclaration);

            const appearance = service.buildAppearance();

            expect(appearance.variables?.['colorPrimary']).toBe('#cc6600');
            expect(appearance.variables?.['colorBackground']).toBe('#fafafa');
            expect(appearance.variables?.['colorInputBackground']).toBe('#f0f0f0');
            expect(appearance.variables?.['colorText']).toBe('#222222');
            expect(appearance.variables?.['colorTextSecondary']).toBe('#555555');
            expect(appearance.variables?.['colorInputText']).toBe('#222222');
            expect(appearance.variables?.['colorDanger']).toBe('#ee1111');
            expect(appearance.variables?.['colorSuccess']).toBe('#00aa55');
            expect(appearance.variables?.['colorNeutral']).toBe('#aaaaaa');
            expect(appearance.elements?.['card']?.['boxShadow']).toContain('#dddddd');
            expect(appearance.elements?.['card']?.['border']).toContain('#dddddd');

            spy.mockRestore();
        });

        it('should call getComputedStyle exactly once per buildAppearance() call', () => {
            const spy = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
                getPropertyValue: () => '',
            } as unknown as CSSStyleDeclaration);

            service.buildAppearance();

            // getComputedStyle should be called only once regardless of how many tokens are resolved
            expect(spy).toHaveBeenCalledTimes(1);

            spy.mockRestore();
        });

        it('should fall back to light static values when getComputedStyle returns empty', () => {
            const spy = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
                getPropertyValue: () => '',
            } as unknown as CSSStyleDeclaration);

            const appearance = service.buildAppearance();

            // Falls back to light-mode static values from LIGHT_FALLBACKS
            expect(appearance.variables?.['colorPrimary']).toBe('#b45309');
            expect(appearance.variables?.['colorDanger']).toBe('#dc2626');

            spy.mockRestore();
        });

        it('should trim whitespace from getComputedStyle values', () => {
            const spy = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
                getPropertyValue: (prop: string) =>
                    prop === '--mat-sys-primary' ? '  #b45309  ' : '',
            } as unknown as CSSStyleDeclaration);

            const appearance = service.buildAppearance();

            expect(appearance.variables?.['colorPrimary']).toBe('#b45309');

            spy.mockRestore();
        });
    });

    describe('on browser platform (dark mode)', () => {
        let service: ClerkAppearanceService;
        let themeService: ThemeService;

        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    provideZonelessChangeDetection(),
                    { provide: PLATFORM_ID, useValue: 'browser' },
                ],
            });
            service = TestBed.inject(ClerkAppearanceService);
            themeService = TestBed.inject(ThemeService);
            themeService.toggle(); // enter dark mode
        });

        afterEach(() => {
            // Restore light mode so localStorage is clean
            if (themeService.isDark()) {
                themeService.toggle();
            }
        });

        it('should fall back to dark static values when getComputedStyle returns empty', () => {
            const spy = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
                getPropertyValue: () => '',
            } as unknown as CSSStyleDeclaration);

            const appearance = service.buildAppearance();

            // Falls back to dark-mode static values from DARK_FALLBACKS
            expect(appearance.variables?.['colorPrimary']).toBe('#f59e0b');
            expect(appearance.variables?.['colorDanger']).toBe('#f87171');
            expect(appearance.baseTheme).toBe('dark');

            spy.mockRestore();
        });
    });

    describe('on server platform (SSR)', () => {
        let service: ClerkAppearanceService;

        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    provideZonelessChangeDetection(),
                    { provide: PLATFORM_ID, useValue: 'server' },
                    {
                        provide: DOCUMENT,
                        useValue: {
                            documentElement: {},
                            body: { classList: { add: () => {}, remove: () => {}, contains: () => false } },
                        },
                    },
                ],
            });
            service = TestBed.inject(ClerkAppearanceService);
        });

        it('should be created on server', () => {
            expect(service).toBeTruthy();
        });

        it('should return a valid appearance object on server (SSR fallback)', () => {
            const appearance = service.buildAppearance();
            expect(appearance).toBeTruthy();
            expect(appearance.variables).toBeTruthy();
        });

        it('should use light fallback values on server', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables?.['colorPrimary']).toBe('#b45309');
            expect(appearance.variables?.['colorBackground']).toBe('#ffffff');
            expect(appearance.variables?.['colorDanger']).toBe('#dc2626');
            expect(appearance.variables?.['colorSuccess']).toBe('#059669');
        });

        it('should set font properties in SSR mode', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables?.['fontFamily']).toContain('IBM Plex Sans');
            expect(appearance.variables?.['borderRadius']).toBe('4px');
            expect(appearance.variables?.['fontSize']).toBe('15px');
        });

        it('should not set baseTheme in light mode on server', () => {
            const appearance = service.buildAppearance();
            expect(appearance.baseTheme).toBeUndefined();
        });
    });
});
