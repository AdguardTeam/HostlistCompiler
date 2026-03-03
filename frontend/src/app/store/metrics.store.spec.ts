import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MetricsStore } from './metrics.store';

describe('MetricsStore', () => {
    let store: MetricsStore;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        store = TestBed.inject(MetricsStore);
        httpMock = TestBed.inject(HttpTestingController);

        // Flush initial SWR fetches
        const metricsReq = httpMock.match('/api/metrics');
        metricsReq.forEach(r => r.flush({ totalRequests: 100, averageDuration: 50, cacheHitRate: 80, successRate: 99 }));
        const healthReq = httpMock.match('/api/health');
        healthReq.forEach(r => r.flush({ status: 'healthy', version: '1.0' }));
    });

    it('should be created', () => {
        expect(store).toBeTruthy();
    });

    it('should expose metrics signal', () => {
        expect(store.metrics).toBeDefined();
    });

    it('should expose health signal', () => {
        expect(store.health).toBeDefined();
    });

    it('should expose isLoading signal', () => {
        expect(store.isLoading()).toBe(false);
    });

    it('should expose isStale signal', () => {
        expect(store.isStale).toBeDefined();
    });

    it('should have a refresh method', () => {
        expect(typeof store.refresh).toBe('function');
    });

    it('should have refreshMetrics method', () => {
        expect(typeof store.refreshMetrics).toBe('function');
    });

    it('should have refreshHealth method', () => {
        expect(typeof store.refreshHealth).toBe('function');
    });
});
