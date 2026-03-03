import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { GlobalErrorHandler } from './global-error-handler';
import { LogService } from '../services/log.service';
import { LOG_ENDPOINT } from '../tokens';

describe('GlobalErrorHandler', () => {
    let handler: GlobalErrorHandler;
    let log: LogService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                GlobalErrorHandler,
                { provide: PLATFORM_ID, useValue: 'browser' },
                { provide: LOG_ENDPOINT, useValue: '/api/log' },
            ],
        });
        handler = TestBed.inject(GlobalErrorHandler);
        log = TestBed.inject(LogService);
    });

    it('should be created', () => {
        expect(handler).toBeTruthy();
    });

    it('should handle Error objects', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        handler.handleError(new Error('test error'));

        expect(handler.lastError()).toBeTruthy();
        expect(handler.lastError()?.message).toBe('test error');
        expect(handler.hasError()).toBe(true);
        consoleSpy.mockRestore();
    });

    it('should handle string errors', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        handler.handleError('string error');

        expect(handler.lastError()?.message).toBe('string error');
        consoleSpy.mockRestore();
    });

    it('should handle unknown error types', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        handler.handleError({ code: 500 });

        expect(handler.lastError()?.message).toBe('An unexpected error occurred');
        consoleSpy.mockRestore();
    });

    it('should maintain error history (max 10)', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        for (let i = 0; i < 15; i++) {
            handler.handleError(new Error(`error ${i}`));
        }

        expect(handler.errorHistory().length).toBe(10);
        expect(handler.errorHistory()[0].message).toBe('error 14'); // most recent
        consoleSpy.mockRestore();
    });

    it('should clear current error', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        handler.handleError(new Error('test'));
        handler.clearError();

        expect(handler.lastError()).toBeNull();
        expect(handler.hasError()).toBe(false);
        consoleSpy.mockRestore();
    });

    it('should clear all history', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        handler.handleError(new Error('test'));
        handler.clearHistory();

        expect(handler.errorHistory().length).toBe(0);
        expect(handler.lastError()).toBeNull();
        consoleSpy.mockRestore();
    });

    it('should set timestamp on errors', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        const before = new Date();
        handler.handleError(new Error('test'));
        const after = new Date();

        const ts = handler.lastError()!.timestamp;
        expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
        consoleSpy.mockRestore();
    });

    it('should report errors to backend via LogService', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const reportSpy = vi.spyOn(log, 'reportError');
        navigator.sendBeacon = vi.fn().mockReturnValue(true);

        handler.handleError(new Error('crash'));

        expect(reportSpy).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'crash' }),
        );
        consoleSpy.mockRestore();
    });

    it('should log errors via LogService.error()', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const errorSpy = vi.spyOn(log, 'error');
        navigator.sendBeacon = vi.fn().mockReturnValue(true);

        handler.handleError(new Error('boom'));

        expect(errorSpy).toHaveBeenCalledWith(
            'boom',
            'unhandled-error',
            expect.objectContaining({ timestamp: expect.any(String) }),
        );
        consoleSpy.mockRestore();
    });
});
