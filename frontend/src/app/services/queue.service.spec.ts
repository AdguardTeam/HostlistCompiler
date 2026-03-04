import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { QueueService, QueueStats, QueueResult } from './queue.service';
import { API_BASE_URL } from '../tokens';

describe('QueueService', () => {
    let service: QueueService;
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
        service = TestBed.inject(QueueService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should GET queue/stats and normalize depthHistory', () => {
        const mockStats: QueueStats = {
            currentDepth: 5,
            pending: 3,
            completed: 42,
            failed: 1,
            processingRate: 5,
            lag: 600,
            depthHistory: [],
        };

        service.getStats().subscribe(stats => {
            expect(stats.pending).toBe(3);
            expect(stats.depthHistory).toEqual([]);
        });

        const req = httpTesting.expectOne('/api/../queue/stats');
        expect(req.request.method).toBe('GET');
        req.flush(mockStats);
    });

    it('should GET queue/results/:requestId', () => {
        const requestId = 'req-001';
        const mockResult: QueueResult = {
            success: true,
            status: 'completed',
            requestId,
            ruleCount: 200,
        };

        service.getResults(requestId).subscribe(result => {
            expect(result.status).toBe('completed');
        });

        const req = httpTesting.expectOne(`/api/../queue/results/${requestId}`);
        expect(req.request.method).toBe('GET');
        req.flush(mockResult);
    });

    it('should poll results and complete on terminal status', async () => {
        vi.useFakeTimers();
        try {
            const requestId = 'abc123';
            const results: QueueResult[] = [];
            let completed = false;

            service.pollResults(requestId, 1000).subscribe({
                next: r => results.push(r),
                complete: () => { completed = true; },
            });

            // Advance 1ms to trigger the initial timer(0, ...) emission
            await vi.advanceTimersByTimeAsync(1);
            const req1 = httpTesting.expectOne(`/api/../queue/results/${requestId}`);
            req1.flush({ success: true, status: 'pending', requestId });

            // Second emission: advance by the polling interval
            await vi.advanceTimersByTimeAsync(1000);
            const req2 = httpTesting.expectOne(`/api/../queue/results/${requestId}`);
            req2.flush({ success: true, status: 'completed', requestId, ruleCount: 100 });

            expect(results.length).toBe(2);
            expect(results[0].status).toBe('pending');
            expect(results[1].status).toBe('completed');
            expect(completed).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
