import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { QueueService, QueueStats, QueueJobResult } from './queue.service';
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

    it('should GET /api/queue/stats', () => {
        const mockStats: QueueStats = {
            pending: 3,
            completed: 42,
            failed: 1,
            cancelled: 0,
            processingRate: 5,
            averageProcessingTime: 1200,
            queueLag: 600,
            lastUpdate: new Date().toISOString(),
        };

        service.getQueueStats().subscribe(stats => {
            expect(stats).toEqual(mockStats);
        });

        const req = httpTesting.expectOne('/api/queue/stats');
        expect(req.request.method).toBe('GET');
        req.flush(mockStats);
    });

    it('should poll /api/queue/results/:requestId and complete on terminal status', async () => {
        vi.useFakeTimers();
        const requestId = 'abc123';
        const results: QueueJobResult[] = [];
        let completed = false;

        service.pollResults(requestId, 1000).subscribe({
            next: r => results.push(r),
            complete: () => { completed = true; },
        });

        // First emission: startWith(0) fires synchronously
        const req1 = httpTesting.expectOne(`/api/queue/results/${requestId}`);
        req1.flush({ status: 'pending' });

        // Second emission: advance by the polling interval
        await vi.advanceTimersByTimeAsync(1000);
        const req2 = httpTesting.expectOne(`/api/queue/results/${requestId}`);
        req2.flush({ status: 'completed', ruleCount: 100 });

        expect(results.length).toBe(2);
        expect(results[0].status).toBe('pending');
        expect(results[1].status).toBe('completed');
        expect(completed).toBe(true);

        vi.useRealTimers();
    });
});
