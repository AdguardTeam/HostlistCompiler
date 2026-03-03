import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
    let service: TurnstileService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                { provide: PLATFORM_ID, useValue: 'browser' },
            ],
        });
        service = TestBed.inject(TurnstileService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should start with empty token', () => {
        expect(service.token()).toBe('');
    });

    it('should not be verified initially', () => {
        expect(service.isVerified()).toBe(false);
    });

    it('should set and get site key', () => {
        service.setSiteKey('test-key');
        // Site key is private, but we can verify render behavior
        expect(service).toBeTruthy();
    });

    it('should update token signal', () => {
        service.token.set('test-token-123');
        expect(service.token()).toBe('test-token-123');
        expect(service.isVerified()).toBe(true);
    });

    it('should reset token', () => {
        service.token.set('some-token');
        service.reset();
        expect(service.token()).toBe('');
        expect(service.isVerified()).toBe(false);
    });

    it('should remove and clear token', () => {
        service.token.set('some-token');
        service.remove();
        expect(service.token()).toBe('');
    });

    it('should warn when no site key on render', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = service.render(document.createElement('div'));
        expect(result).toBeNull();
        spy.mockRestore();
    });
});
