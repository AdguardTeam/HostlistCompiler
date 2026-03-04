import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { API_BASE_URL } from '../tokens';

describe('NotificationService', () => {
    let service: NotificationService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        });
        service = TestBed.inject(NotificationService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should add and dismiss a toast', () => {
        service.showToast('success', 'Title', 'Message');
        expect(service.toasts().length).toBe(1);
        const id = service.toasts()[0].id;
        service.dismissToast(id);
        expect(service.toasts().length).toBe(0);
    });

    it('should add multiple toasts independently', () => {
        service.showToast('info', 'Info', 'Info message');
        service.showToast('error', 'Error', 'Error message');
        expect(service.toasts().length).toBe(2);
        expect(service.toasts()[0].type).toBe('info');
        expect(service.toasts()[1].type).toBe('error');
    });

    it('should initialize with notifications disabled', () => {
        expect(service.isEnabled()).toBe(false);
    });

    it('should track a job', () => {
        service.trackJob('req-1', 'My Config');
        expect(service.trackedJobs().size).toBe(1);
        expect(service.trackedJobs().get('req-1')?.configName).toBe('My Config');
    });
});
