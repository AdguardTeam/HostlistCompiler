import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { StorageService, StorageStats } from './storage.service';
import { AuthService } from './auth.service';
import { ADMIN_BASE_URL } from '../tokens';

describe('StorageService', () => {
    let service: StorageService;
    let auth: AuthService;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ADMIN_BASE_URL, useValue: '/admin/storage' },
            ],
        });
        service = TestBed.inject(StorageService);
        auth = TestBed.inject(AuthService);
        httpTesting = TestBed.inject(HttpTestingController);

        // Set admin key for all requests
        auth.setKey('test-admin-key');
    });

    afterEach(() => {
        httpTesting.verify();
        auth.clearKey();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should GET /admin/storage/stats with X-Admin-Key header', () => {
        const mockStats: StorageStats = {
            kvKeys: 10,
            r2Objects: 5,
            d1Tables: 3,
            cacheEntries: 100,
        };

        service.getStats().subscribe(result => {
            expect(result).toEqual(mockStats);
        });

        const req = httpTesting.expectOne('/admin/storage/stats');
        expect(req.request.method).toBe('GET');
        expect(req.request.headers.get('X-Admin-Key')).toBe('test-admin-key');
        req.flush(mockStats);
    });

    it('should GET /admin/storage/tables', () => {
        service.getTables().subscribe();

        const req = httpTesting.expectOne('/admin/storage/tables');
        expect(req.request.method).toBe('GET');
        expect(req.request.headers.get('X-Admin-Key')).toBe('test-admin-key');
        req.flush([]);
    });

    it('should POST sql to /admin/storage/query', () => {
        const sql = 'SELECT * FROM compilations LIMIT 10';

        service.query(sql).subscribe();

        const req = httpTesting.expectOne('/admin/storage/query');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ sql });
        expect(req.request.headers.get('X-Admin-Key')).toBe('test-admin-key');
        req.flush({ success: true, columns: [], rows: [], rowCount: 0 });
    });

    it('should POST to /admin/storage/clear-cache', () => {
        service.clearCache().subscribe(result => {
            expect(result.success).toBe(true);
        });

        const req = httpTesting.expectOne('/admin/storage/clear-cache');
        expect(req.request.method).toBe('POST');
        expect(req.request.headers.get('X-Admin-Key')).toBe('test-admin-key');
        req.flush({ success: true });
    });

    it('should POST to /admin/storage/clear-expired', () => {
        service.clearExpired().subscribe(result => {
            expect(result.removed).toBe(5);
        });

        const req = httpTesting.expectOne('/admin/storage/clear-expired');
        expect(req.request.method).toBe('POST');
        req.flush({ success: true, removed: 5 });
    });

    it('should POST to /admin/storage/vacuum', () => {
        service.vacuum().subscribe();

        const req = httpTesting.expectOne('/admin/storage/vacuum');
        expect(req.request.method).toBe('POST');
        req.flush({ success: true });
    });

    it('should GET /admin/storage/export as blob', () => {
        service.exportData().subscribe(result => {
            expect(result).toBeInstanceOf(Blob);
        });

        const req = httpTesting.expectOne('/admin/storage/export');
        expect(req.request.method).toBe('GET');
        expect(req.request.responseType).toBe('blob');
        req.flush(new Blob(['{}'], { type: 'application/json' }));
    });

    it('should use current admin key from AuthService', () => {
        auth.setKey('new-key-123');

        service.getStats().subscribe();

        const req = httpTesting.expectOne('/admin/storage/stats');
        expect(req.request.headers.get('X-Admin-Key')).toBe('new-key-123');
        req.flush({});
    });
});
