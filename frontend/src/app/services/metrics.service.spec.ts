import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MetricsService, MetricsResponse, HealthResponse } from './metrics.service';
import { API_BASE_URL } from '../tokens';

describe('MetricsService', () => {
    let service: MetricsService;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        });
        service = TestBed.inject(MetricsService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should GET /api/metrics', () => {
        const mockMetrics: MetricsResponse = {
            totalRequests: 1000,
            averageDuration: 42,
            cacheHitRate: 87,
            successRate: 99,
        };

        service.getMetrics().subscribe(result => {
            expect(result).toEqual(mockMetrics);
        });

        const req = httpTesting.expectOne('/api/metrics');
        expect(req.request.method).toBe('GET');
        req.flush(mockMetrics);
    });

    it('should GET /api/health', () => {
        const mockHealth: HealthResponse = {
            status: 'healthy',
            version: '0.29.2',
        };

        service.getHealth().subscribe(result => {
            expect(result).toEqual(mockHealth);
        });

        const req = httpTesting.expectOne('/api/health');
        expect(req.request.method).toBe('GET');
        req.flush(mockHealth);
    });

    it('should use the injected API_BASE_URL', () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: 'https://api.example.com' },
            ],
        });

        const customService = TestBed.inject(MetricsService);
        const customHttp = TestBed.inject(HttpTestingController);

        customService.getMetrics().subscribe();
        const req = customHttp.expectOne('https://api.example.com/metrics');
        expect(req.request.method).toBe('GET');
        req.flush({});
        customHttp.verify();
    });
});
