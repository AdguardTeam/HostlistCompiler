import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationContainerComponent } from './notification-container.component';
import { NotificationService } from '../services/notification.service';
import { API_BASE_URL } from '../tokens';

describe('NotificationContainerComponent', () => {
    let component: NotificationContainerComponent;
    let fixture: ComponentFixture<NotificationContainerComponent>;
    let notificationService: NotificationService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NotificationContainerComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideAnimationsAsync(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(NotificationContainerComponent);
        component = fixture.componentInstance;
        notificationService = TestBed.inject(NotificationService);
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should inject NotificationService', () => {
        expect(component.notificationService).toBeTruthy();
    });

    it('should map success icon', () => {
        expect(component.iconFor('success')).toBe('check_circle');
    });

    it('should map error icon', () => {
        expect(component.iconFor('error')).toBe('error');
    });

    it('should map warning icon', () => {
        expect(component.iconFor('warning')).toBe('warning');
    });

    it('should map info icon', () => {
        expect(component.iconFor('info')).toBe('info');
    });

    it('should default to info icon for unknown type', () => {
        expect(component.iconFor('unknown')).toBe('info');
    });

    it('should render toast container with aria-live', () => {
        fixture.detectChanges();
        const container = fixture.nativeElement.querySelector('.toast-container');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-live')).toBe('polite');
    });

    it('should render toasts from notification service', () => {
        notificationService.showToast('success', 'Test', 'Test message');
        fixture.detectChanges();
        const toasts = fixture.nativeElement.querySelectorAll('.toast');
        expect(toasts.length).toBe(1);
    });

    it('should render toast title and message', () => {
        notificationService.showToast('info', 'My Title', 'My Message');
        fixture.detectChanges();
        const title = fixture.nativeElement.querySelector('.toast-title');
        const message = fixture.nativeElement.querySelector('.toast-message');
        expect(title.textContent).toContain('My Title');
        expect(message.textContent).toContain('My Message');
    });

    it('should apply toast type class', () => {
        notificationService.showToast('error', 'Error', 'Err msg');
        fixture.detectChanges();
        const toast = fixture.nativeElement.querySelector('.toast');
        expect(toast.classList.contains('error')).toBe(true);
    });

    it('should dismiss toast on close button click', () => {
        notificationService.showToast('success', 'Dismiss Me', 'Message');
        fixture.detectChanges();
        const closeBtn = fixture.nativeElement.querySelector('.toast-close');
        closeBtn.click();
        fixture.detectChanges();
        expect(notificationService.toasts().length).toBe(0);
    });
});
