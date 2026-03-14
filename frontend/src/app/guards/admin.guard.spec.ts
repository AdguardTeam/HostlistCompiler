import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { adminGuard } from './admin.guard';
import { ClerkService } from '../services/clerk.service';

describe('adminGuard', () => {
    let mockClerk: {
        isLoaded: ReturnType<typeof vi.fn>;
        isSignedIn: ReturnType<typeof vi.fn>;
        user: ReturnType<typeof vi.fn>;
    };
    let router: Router;

    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = { url: '/admin' } as RouterStateSnapshot;

    beforeEach(() => {
        mockClerk = {
            isLoaded: vi.fn().mockReturnValue(true),
            isSignedIn: vi.fn().mockReturnValue(false),
            user: vi.fn().mockReturnValue(null),
        };

        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([]),
                { provide: ClerkService, useValue: mockClerk },
            ],
        });

        router = TestBed.inject(Router);
    });

    it('should allow navigation when signed in with admin role', async () => {
        mockClerk.isSignedIn.mockReturnValue(true);
        mockClerk.user.mockReturnValue({ publicMetadata: { role: 'admin' } });

        const result = await TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
        expect(result).toBe(true);
    });

    it('should redirect to /sign-in when not signed in', async () => {
        mockClerk.isSignedIn.mockReturnValue(false);

        const result = await TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
        expect(result).toBeInstanceOf(UrlTree);
        expect((result as UrlTree).toString()).toContain('/sign-in');
    });

    it('should redirect to / when signed in but not admin', async () => {
        mockClerk.isSignedIn.mockReturnValue(true);
        mockClerk.user.mockReturnValue({ publicMetadata: { role: 'user' } });

        const result = await TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
        expect(result).toBeInstanceOf(UrlTree);
        expect((result as UrlTree).toString()).toBe('/');
    });

    it('should redirect to / when signed in with no role metadata', async () => {
        mockClerk.isSignedIn.mockReturnValue(true);
        mockClerk.user.mockReturnValue({ publicMetadata: {} });

        const result = await TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
        expect(result).toBeInstanceOf(UrlTree);
        expect((result as UrlTree).toString()).toBe('/');
    });

    it('should include returnUrl in sign-in redirect', async () => {
        mockClerk.isSignedIn.mockReturnValue(false);

        const result = await TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
        expect((result as UrlTree).queryParams['returnUrl']).toBe('/admin');
    });
});
