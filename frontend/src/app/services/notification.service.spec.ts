import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
    let service: NotificationService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideZonelessChangeDetection()],
        });
        service = TestBed.inject(NotificationService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should add a job with queued status', () => {
        service.addJob('req-1', 'My Config');
        const jobs = service.jobs();
        expect(jobs.length).toBe(1);
        expect(jobs[0].requestId).toBe('req-1');
        expect(jobs[0].configName).toBe('My Config');
        expect(jobs[0].status).toBe('queued');
    });

    it('should update job to completed with ruleCount', () => {
        service.addJob('req-1', 'My Config');
        service.updateJob('req-1', 'completed', { ruleCount: 500 });
        const job = service.jobs().find(j => j.requestId === 'req-1')!;
        expect(job.status).toBe('completed');
        expect(job.ruleCount).toBe(500);
        expect(job.completedAt).toBeDefined();
    });

    it('should update job to failed with error', () => {
        service.addJob('req-2', 'Other Config');
        service.updateJob('req-2', 'failed', { error: 'Queue not available' });
        const job = service.jobs().find(j => j.requestId === 'req-2')!;
        expect(job.status).toBe('failed');
        expect(job.error).toBe('Queue not available');
    });

    it('should prepend new jobs to the front of the list', () => {
        service.addJob('req-1', 'Config A');
        service.addJob('req-2', 'Config B');
        const jobs = service.jobs();
        expect(jobs[0].requestId).toBe('req-2');
        expect(jobs[1].requestId).toBe('req-1');
    });
});
