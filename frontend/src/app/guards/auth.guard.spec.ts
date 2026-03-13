import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { ClerkService } from '../services/clerk.service';

describe('authGuard', () => {
    let mockClerk: { isLoaded: ReturnType<typeof vi.fn>; isSignedIn: ReturnType<typeof vi.fn> };
    let router: Router;

    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = { url: '/api-keys' } as RouterStateSnapshot;

    beforeEach(() => {
        mockClerk = {
            isLoaded: vi.fn().mockReturnValue(true),
            isSignedIn: vi.fn().mockReturnValue(false),
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

    it('should allow navigation when signed in', async () => {
        mockClerk.isSignedIn.mockReturnValue(true);

        const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
        expect(result).toBe(true);
    });

    it('should redirect to /sign-in when not signed in', async () => {
        mockClerk.isSignedIn.mockReturnValue(false);

        const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
        expect(result).toBeInstanceOf(UrlTree);
        expect((result as UrlTree).toString()).toContain('/sign-in');
    });

    it('should include returnUrl in redirect query params', async () => {
        mockClerk.isSignedIn.mockReturnValue(false);

        const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
        expect((result as UrlTree).queryParams['returnUrl']).toBe('/api-keys');
    });

    it('should wait for Clerk to load when not yet loaded', async () => {
        // First call: not loaded, then becomes loaded
        let callCount = 0;
        mockClerk.isLoaded.mockImplementation(() => {
            callCount++;
            return callCount > 2; // Becomes loaded after 2 polls
        });
        mockClerk.isSignedIn.mockReturnValue(true);

        const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
        expect(result).toBe(true);
    });
});
