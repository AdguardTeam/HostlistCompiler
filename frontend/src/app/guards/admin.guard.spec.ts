import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('adminGuard', () => {
    let auth: AuthService;
    let router: Router;

    beforeEach(() => {
        sessionStorage.clear();
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([
                    { path: '', component: class {} as any },
                    { path: 'admin', component: class {} as any, canActivate: [adminGuard] },
                ]),
            ],
        });
        auth = TestBed.inject(AuthService);
        router = TestBed.inject(Router);
    });

    afterEach(() => sessionStorage.clear());

    it('should allow navigation when authenticated', () => {
        auth.setKey('valid-key');

        // The guard is a soft guard — always returns true
        const result = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
        expect(result).toBe(true);
    });

    it('should allow navigation when not authenticated (soft guard)', () => {
        // The admin guard is intentionally a soft guard — it always allows
        // navigation. The AdminComponent handles auth inline.
        expect(auth.isAuthenticated()).toBe(false);

        const result = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
        expect(result).toBe(true);
    });
});
