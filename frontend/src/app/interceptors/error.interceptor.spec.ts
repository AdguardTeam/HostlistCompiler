import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { LogService } from '../services/log.service';
import { LOG_ENDPOINT } from '../tokens';

describe('errorInterceptor', () => {
    let http: HttpClient;
    let httpTesting: HttpTestingController;
    let auth: AuthService;
    let log: LogService;

    beforeEach(() => {
        sessionStorage.clear();
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(withInterceptors([errorInterceptor])),
                provideHttpClientTesting(),
                { provide: PLATFORM_ID, useValue: 'browser' },
                { provide: LOG_ENDPOINT, useValue: '/api/log' },
            ],
        });
        http = TestBed.inject(HttpClient);
        httpTesting = TestBed.inject(HttpTestingController);
        auth = TestBed.inject(AuthService);
        log = TestBed.inject(LogService);
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

    it('should inject X-Trace-ID header on outgoing requests', () => {
        http.get('/api/test').subscribe();

        const req = httpTesting.expectOne('/api/test');
        expect(req.request.headers.has('X-Trace-ID')).toBe(true);
        expect(req.request.headers.get('X-Trace-ID')!.length).toBeGreaterThan(0);
        req.flush({ ok: true });
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
        const warnSpy = vi.spyOn(log, 'warn');
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
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Rate limited'),
            'HTTP',
            expect.objectContaining({ retryAfter: '30' }),
        );
    });

    it('should handle 5xx server errors', () => {
        const errorSpy = vi.spyOn(log, 'error');
        let errorStatus = 0;

        http.get('/api/health').subscribe({
            error: (err) => { errorStatus = err.status; },
        });

        httpTesting.expectOne('/api/health').flush(null, {
            status: 500,
            statusText: 'Internal Server Error',
        });

        expect(errorStatus).toBe(500);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Server error 500'),
            'HTTP',
            expect.objectContaining({ url: '/api/health' }),
        );
    });

    it('should handle 408/504 timeouts', () => {
        const warnSpy = vi.spyOn(log, 'warn');

        http.get('/api/slow').subscribe({ error: () => {} });

        httpTesting.expectOne('/api/slow').flush(null, {
            status: 504,
            statusText: 'Gateway Timeout',
        });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('timeout (504)'),
            'HTTP',
            expect.objectContaining({ url: '/api/slow' }),
        );
    });

    it('should log network failures (status 0)', () => {
        const errorSpy = vi.spyOn(log, 'error');

        http.get('/api/offline').subscribe({ error: () => {} });

        httpTesting.expectOne('/api/offline').error(
            new ProgressEvent('error'),
            { status: 0, statusText: 'Unknown Error' },
        );

        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Network failure'),
            'HTTP',
            expect.objectContaining({ url: '/api/offline' }),
        );
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
