import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { ClerkService } from '../services/clerk.service';

describe('authInterceptor', () => {
    let http: HttpClient;
    let httpTesting: HttpTestingController;
    let isSignedInSignal: WritableSignal<boolean>;
    let mockGetToken: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        isSignedInSignal = signal(false);
        mockGetToken = vi.fn().mockResolvedValue(null);

        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                {
                    provide: ClerkService,
                    useValue: {
                        isSignedIn: isSignedInSignal.asReadonly(),
                        getToken: mockGetToken,
                    },
                },
            ],
        });

        http = TestBed.inject(HttpClient);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it('should pass through when not signed in', () => {
        isSignedInSignal.set(false);

        http.get('/api/compile').subscribe();

        const req = httpTesting.expectOne('/api/compile');
        expect(req.request.headers.has('Authorization')).toBe(false);
        req.flush({});
    });

    it('should skip public paths even when signed in', () => {
        isSignedInSignal.set(true);

        http.get('/api/version').subscribe();

        const req = httpTesting.expectOne('/api/version');
        expect(req.request.headers.has('Authorization')).toBe(false);
        req.flush({});
    });

    it('should skip /api/health when signed in', () => {
        isSignedInSignal.set(true);

        http.get('/api/health').subscribe();

        const req = httpTesting.expectOne('/api/health');
        expect(req.request.headers.has('Authorization')).toBe(false);
        req.flush({});
    });

    it('should attach Bearer token when signed in', async () => {
        isSignedInSignal.set(true);
        mockGetToken.mockResolvedValue('test-jwt-token');

        http.get('/api/keys').subscribe();

        // Allow the microtask (Promise in from(getToken())) to resolve
        await new Promise((r) => setTimeout(r, 0));

        const req = httpTesting.expectOne('/api/keys');
        expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
        req.flush({});
    });

    it('should not attach header when getToken returns null', async () => {
        isSignedInSignal.set(true);
        mockGetToken.mockResolvedValue(null);

        http.get('/api/keys').subscribe();

        // Allow the microtask to resolve
        await new Promise((r) => setTimeout(r, 0));

        const req = httpTesting.expectOne('/api/keys');
        expect(req.request.headers.has('Authorization')).toBe(false);
        req.flush({});
    });

    it('should propagate error when getToken rejects', async () => {
        isSignedInSignal.set(true);
        mockGetToken.mockRejectedValue(new Error('Session expired'));

        let caughtError: Error | undefined;
        http.get('/api/keys').subscribe({
            error: (err: Error) => { caughtError = err; },
        });

        // Allow the microtask (rejected Promise) to resolve
        await new Promise((r) => setTimeout(r, 0));

        expect(caughtError).toBeDefined();
        expect(caughtError!.message).toContain('Session token refresh failed');
    });
});
