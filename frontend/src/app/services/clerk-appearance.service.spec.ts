import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { ClerkAppearanceService } from './clerk-appearance.service';
import { ThemeService } from './theme.service';

function makeDocument(cssVars: Record<string, string> = {}) {
    return {
        documentElement: {
            style: {},
            // Simulate getComputedStyle on the documentElement
        },
    };
}

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

        it('should include colorPrimary variable', () => {
            const appearance = service.buildAppearance();
            // In test env getComputedStyle returns empty string, so we fall back to static values
            expect(appearance.variables?.['colorPrimary']).toBeTruthy();
        });

        it('should include colorDanger variable', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables?.['colorDanger']).toBeTruthy();
        });

        it('should include colorSuccess variable', () => {
            const appearance = service.buildAppearance();
            expect(appearance.variables?.['colorSuccess']).toBeTruthy();
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
