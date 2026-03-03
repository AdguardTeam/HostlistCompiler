import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(() => {
        sessionStorage.clear();
        TestBed.configureTestingModule({
            providers: [provideZonelessChangeDetection()],
        });
        service = TestBed.inject(AuthService);
    });

    afterEach(() => sessionStorage.clear());

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should start unauthenticated', () => {
        expect(service.isAuthenticated()).toBe(false);
        expect(service.adminKey()).toBe('');
    });

    it('should set admin key and mark as authenticated', () => {
        service.setKey('my-secret-key');
        expect(service.adminKey()).toBe('my-secret-key');
        expect(service.isAuthenticated()).toBe(true);
    });

    it('should persist key to sessionStorage', () => {
        service.setKey('persisted-key');
        expect(sessionStorage.getItem('adblock-admin-key')).toBe('persisted-key');
    });

    it('should clear key and mark as unauthenticated', () => {
        service.setKey('will-be-cleared');
        expect(service.isAuthenticated()).toBe(true);

        service.clearKey();
        expect(service.adminKey()).toBe('');
        expect(service.isAuthenticated()).toBe(false);
    });

    it('should remove key from sessionStorage on clear', () => {
        service.setKey('temp-key');
        service.clearKey();
        expect(sessionStorage.getItem('adblock-admin-key')).toBeNull();
    });

    it('should load key from sessionStorage on creation', () => {
        sessionStorage.setItem('adblock-admin-key', 'pre-existing-key');

        // Re-create the service to trigger loadKey() in the constructor
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [provideZonelessChangeDetection()],
        });
        const freshService = TestBed.inject(AuthService);

        expect(freshService.adminKey()).toBe('pre-existing-key');
        expect(freshService.isAuthenticated()).toBe(true);
    });

    it('should handle empty string as unauthenticated', () => {
        service.setKey('');
        expect(service.isAuthenticated()).toBe(false);
    });
});
