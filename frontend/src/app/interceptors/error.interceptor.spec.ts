import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';

describe('errorInterceptor', () => {
    let http: HttpClient;
    let httpTesting: HttpTestingController;
    let auth: AuthService;

    beforeEach(() => {
        sessionStorage.clear();
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(withInterceptors([errorInterceptor])),
                provideHttpClientTesting(),
            ],
        });
        http = TestBed.inject(HttpClient);
        httpTesting = TestBed.inject(HttpTestingController);
        auth = TestBed.inject(AuthService);
    });

    afterEach(() => {
        httpTesting.verify();
        sessionStorage.clear();
    });

    it('should pass through successful responses', () => {
        http.get('/api/test').subscribe(result => {
            expect(result).toEqual({ ok: true });
        });

        httpTesting.expectOne('/api/test').flush({ ok: true });
    });

    it('should clear admin key on 401 Unauthorized', () => {
        auth.setKey('will-be-cleared');
        expect(auth.isAuthenticated()).toBe(true);

        http.get('/api/admin').subscribe({ error: () => {} });

        httpTesting.expectOne('/api/admin').flush(null, {
            status: 401,
            statusText: 'Unauthorized',
        });

        expect(auth.isAuthenticated()).toBe(false);
        expect(auth.adminKey()).toBe('');
    });

    it('should re-throw error after handling 401', () => {
        let errorStatus = 0;

        http.get('/api/admin').subscribe({
            error: (err) => { errorStatus = err.status; },
        });

        httpTesting.expectOne('/api/admin').flush(null, {
            status: 401,
            statusText: 'Unauthorized',
        });

        expect(errorStatus).toBe(401);
    });

    it('should handle 429 rate limited', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let errorStatus = 0;

        http.get('/api/compile').subscribe({
            error: (err) => { errorStatus = err.status; },
        });

        httpTesting.expectOne('/api/compile').flush(null, {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Retry-After': '30' },
        });

        expect(errorStatus).toBe(429);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limited'));
        consoleSpy.mockRestore();
    });

    it('should handle 5xx server errors', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        let errorStatus = 0;

        http.get('/api/health').subscribe({
            error: (err) => { errorStatus = err.status; },
        });

        httpTesting.expectOne('/api/health').flush(null, {
            status: 500,
            statusText: 'Internal Server Error',
        });

        expect(errorStatus).toBe(500);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Server error 500'),
            expect.anything(),
        );
        consoleSpy.mockRestore();
    });

    it('should not clear admin key on non-401 errors', () => {
        auth.setKey('should-remain');

        http.get('/api/test').subscribe({ error: () => {} });

        httpTesting.expectOne('/api/test').flush(null, {
            status: 500,
            statusText: 'Server Error',
        });

        expect(auth.isAuthenticated()).toBe(true);
        expect(auth.adminKey()).toBe('should-remain');
    });
});
