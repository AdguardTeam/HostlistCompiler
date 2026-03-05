import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

@Component({ template: '' })
class StubComponent {}

describe('adminGuard', () => {
    let auth: AuthService;

    beforeEach(() => {
        sessionStorage.clear();
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([
                    { path: '', component: StubComponent },
                    { path: 'admin', component: StubComponent, canActivate: [adminGuard] },
                ]),
            ],
        });
        auth = TestBed.inject(AuthService);
    });

    afterEach(() => sessionStorage.clear());

    it('should allow navigation when authenticated', () => {
        auth.setKey('valid-key');

        // The guard is a soft guard — always returns true
        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as unknown as ActivatedRouteSnapshot, {} as unknown as RouterStateSnapshot));
        expect(result).toBe(true);
    });

    it('should allow navigation when not authenticated (soft guard)', () => {
        // The admin guard is intentionally a soft guard — it always allows
        // navigation. The AdminComponent handles auth inline.
        expect(auth.isAuthenticated()).toBe(false);

        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as unknown as ActivatedRouteSnapshot, {} as unknown as RouterStateSnapshot));
        expect(result).toBe(true);
    });
});
