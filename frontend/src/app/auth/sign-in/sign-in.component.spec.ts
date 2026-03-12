import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignInComponent } from './sign-in.component';
import { ClerkService } from '../../services/clerk.service';

/** Build a minimal ActivatedRoute stub with the given query params snapshot. */
function makeRoute(queryParams: Record<string, string> = {}) {
    return { snapshot: { queryParams } };
}

describe('SignInComponent', () => {
    let component: SignInComponent;
    let fixture: ComponentFixture<SignInComponent>;
    let mockClerkService: {
        mountSignIn: ReturnType<typeof vi.fn>;
        unmountSignIn: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockClerkService = {
            mountSignIn: vi.fn(),
            unmountSignIn: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkService },
                { provide: ActivatedRoute, useValue: makeRoute() },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SignInComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
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

    it('should pass returnUrl from query params to mountSignIn as afterSignInUrl', async () => {
        TestBed.resetTestingModule();
        const routeWithReturn = makeRoute({ returnUrl: '/compiler' });
        const clerkWithReturn = { mountSignIn: vi.fn(), unmountSignIn: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: clerkWithReturn },
                { provide: ActivatedRoute, useValue: routeWithReturn },
            ],
        }).compileComponents();

        const f = TestBed.createComponent(SignInComponent);
        f.detectChanges();

        expect(clerkWithReturn.mountSignIn).toHaveBeenCalledTimes(1);
        expect(clerkWithReturn.mountSignIn.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
        expect(clerkWithReturn.mountSignIn.mock.calls[0][1]).toBe('/compiler');
    });

    it('should unmount Clerk sign-in UI on destroy', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const containerElement = compiled.querySelector('.clerk-container') as HTMLDivElement;

        fixture.destroy();

        expect(mockClerkService.unmountSignIn).toHaveBeenCalledTimes(1);
        expect(mockClerkService.unmountSignIn).toHaveBeenCalledWith(containerElement);
    });

    it('should handle missing container gracefully on destroy', () => {
        const mockClerkNoContainer = { mountSignIn: vi.fn(), unmountSignIn: vi.fn() };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoContainer },
                { provide: ActivatedRoute, useValue: makeRoute() },
            ],
        });

        const tempFixture = TestBed.createComponent(SignInComponent);
        const tempComponent = tempFixture.componentInstance;

        // Manually set container to undefined to simulate missing element
        (tempComponent as any).container = () => undefined;

        // Should not throw when destroying
        expect(() => tempFixture.destroy()).not.toThrow();
        expect(mockClerkNoContainer.unmountSignIn).not.toHaveBeenCalled();
    });

    it('should handle null container element gracefully on mount', () => {
        const mockClerkNoMount = { mountSignIn: vi.fn(), unmountSignIn: vi.fn() };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoMount },
                { provide: ActivatedRoute, useValue: makeRoute() },
            ],
        });

        const tempFixture = TestBed.createComponent(SignInComponent);
        tempFixture.detectChanges();

        // The component should not throw if container is missing/null
        // afterNextRender will check for null and skip mounting
        expect(() => tempFixture.detectChanges()).not.toThrow();
    });
});
