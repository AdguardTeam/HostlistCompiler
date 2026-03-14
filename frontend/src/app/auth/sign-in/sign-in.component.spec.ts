import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignInComponent } from './sign-in.component';
import { ClerkService } from '../../services/clerk.service';
import { ThemeService } from '../../services/theme.service';

/** Build a minimal ActivatedRoute stub with the given query params snapshot. */
function makeRoute(queryParams: Record<string, string> = {}) {
    return { snapshot: { queryParams } };
}

function makeMockClerk(overrides: Partial<{ isLoaded: boolean; isAvailable: boolean }> = {}) {
    return {
        isLoaded: signal(overrides.isLoaded ?? true),
        isAvailable: signal(overrides.isAvailable ?? true),
        mountSignIn: vi.fn(),
        unmountSignIn: vi.fn(),
    };
}

function makeMockTheme(dark = false) {
    return { isDark: signal(dark) };
}

describe('SignInComponent', () => {
    let component: SignInComponent;
    let fixture: ComponentFixture<SignInComponent>;
    let mockClerkService: ReturnType<typeof makeMockClerk>;

    beforeEach(async () => {
        mockClerkService = makeMockClerk();

        await TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkService },
                { provide: ActivatedRoute, useValue: makeRoute() },
                { provide: ThemeService, useValue: makeMockTheme() },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SignInComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should show loading spinner while Clerk is not loaded', () => {
        mockClerkService.isLoaded.set(false);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.auth-loading')).toBeTruthy();
        expect(compiled.querySelector('.clerk-container')).toBeNull();
        expect(compiled.querySelector('.auth-error')).toBeNull();
    });

    it('should show error state when Clerk is loaded but not available', () => {
        mockClerkService.isLoaded.set(true);
        mockClerkService.isAvailable.set(false);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.auth-error')).toBeTruthy();
        expect(compiled.querySelector('.clerk-container')).toBeNull();
        expect(compiled.querySelector('.auth-loading')).toBeNull();
    });

    it('should show Clerk container when loaded and available', () => {
        mockClerkService.isLoaded.set(true);
        mockClerkService.isAvailable.set(true);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.clerk-container')).toBeTruthy();
        expect(compiled.querySelector('.auth-loading')).toBeNull();
        expect(compiled.querySelector('.auth-error')).toBeNull();
    });

    it('should render the sign-in container element', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.clerk-container');
        expect(container).toBeTruthy();
    });

    it('should have auth-page wrapper with correct styling', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const authPage = compiled.querySelector('.auth-page');
        expect(authPage).toBeTruthy();
    });

    it('should mount Clerk sign-in UI after render without returnUrl', () => {
        expect(mockClerkService.mountSignIn).toHaveBeenCalledTimes(1);
        expect(mockClerkService.mountSignIn.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
        expect(mockClerkService.mountSignIn.mock.calls[0][1]).toBeUndefined();
    });

    it('should pass returnUrl from query params to mountSignIn as fallbackRedirectUrl', async () => {
        TestBed.resetTestingModule();
        const routeWithReturn = makeRoute({ returnUrl: '/compiler' });
        const clerkWithReturn = makeMockClerk();

        await TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: clerkWithReturn },
                { provide: ActivatedRoute, useValue: routeWithReturn },
                { provide: ThemeService, useValue: makeMockTheme() },
            ],
        }).compileComponents();

        const f = TestBed.createComponent(SignInComponent);
        f.detectChanges();

        expect(clerkWithReturn.mountSignIn).toHaveBeenCalledTimes(1);
        expect(clerkWithReturn.mountSignIn.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
        expect(clerkWithReturn.mountSignIn.mock.calls[0][1]).toBe('/compiler');
    });

    it('should not mount when Clerk is not available', async () => {
        TestBed.resetTestingModule();
        const clerk = makeMockClerk({ isLoaded: true, isAvailable: false });

        await TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: clerk },
                { provide: ActivatedRoute, useValue: makeRoute() },
                { provide: ThemeService, useValue: makeMockTheme() },
            ],
        }).compileComponents();

        const f = TestBed.createComponent(SignInComponent);
        f.detectChanges();

        expect(clerk.mountSignIn).not.toHaveBeenCalled();
    });

    it('should unmount Clerk sign-in UI on destroy', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const containerElement = compiled.querySelector('.clerk-container') as HTMLDivElement;

        fixture.destroy();

        expect(mockClerkService.unmountSignIn).toHaveBeenCalledTimes(1);
        expect(mockClerkService.unmountSignIn).toHaveBeenCalledWith(containerElement);
    });

    it('should handle missing container gracefully on destroy', () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: makeMockClerk() },
                { provide: ActivatedRoute, useValue: makeRoute() },
                { provide: ThemeService, useValue: makeMockTheme() },
            ],
        });

        const tempFixture = TestBed.createComponent(SignInComponent);
        const tempComponent = tempFixture.componentInstance;

        (tempComponent as any).container = () => undefined;

        expect(() => tempFixture.destroy()).not.toThrow();
    });

    it('should handle null container element gracefully on mount', () => {
        const mockClerkNoMount = makeMockClerk();

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoMount },
                { provide: ActivatedRoute, useValue: makeRoute() },
                { provide: ThemeService, useValue: makeMockTheme() },
            ],
        });

        const tempFixture = TestBed.createComponent(SignInComponent);
        tempFixture.detectChanges();

        expect(() => tempFixture.detectChanges()).not.toThrow();
    });
});
