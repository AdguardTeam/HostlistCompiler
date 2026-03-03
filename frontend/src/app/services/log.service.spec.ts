import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { LogService } from './log.service';
import { LOG_ENDPOINT } from '../tokens';

describe('LogService', () => {
    let service: LogService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                { provide: PLATFORM_ID, useValue: 'browser' },
                { provide: LOG_ENDPOINT, useValue: '/api/log' },
            ],
        });
        service = TestBed.inject(LogService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should have a session ID', () => {
        expect(service.sessionId).toBeTruthy();
        expect(service.sessionId.length).toBeGreaterThan(0);
    });

    it('should generate unique trace IDs', () => {
        const id1 = service.generateTraceId();
        const id2 = service.generateTraceId();
        expect(id1).not.toBe(id2);
    });

    it('should log debug messages', () => {
        const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        service.debug('test message', 'test-category');
        expect(spy).toHaveBeenCalledWith(
            '[DEBUG] [test-category]',
            'test message',
            '',
        );
        spy.mockRestore();
    });

    it('should log info messages', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        service.info('test info');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should log warn messages', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        service.warn('test warning');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should log error messages', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        service.error('test error');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should buffer recent logs', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        service.info('msg1');
        service.info('msg2');
        service.info('msg3');

        const logs = service.getRecentLogs();
        expect(logs.length).toBe(3);
        expect(logs[0].message).toBe('msg1');
        expect(logs[2].message).toBe('msg3');
        spy.mockRestore();
    });

    it('should cap buffer at 50 entries', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        for (let i = 0; i < 60; i++) {
            service.info(`msg ${i}`);
        }

        const logs = service.getRecentLogs();
        expect(logs.length).toBe(50);
        expect(logs[0].message).toBe('msg 10'); // oldest retained
        spy.mockRestore();
    });

    it('should include category in log entries', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        service.info('test', 'HTTP');

        const logs = service.getRecentLogs();
        expect(logs[0].category).toBe('HTTP');
        spy.mockRestore();
    });

    it('should include data in log entries', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        service.info('test', undefined, { status: 200 });

        const logs = service.getRecentLogs();
        expect(logs[0].data).toEqual({ status: 200 });
        spy.mockRestore();
    });

    it('should report errors via sendBeacon', () => {
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        service.reportError({ message: 'crash', stack: 'Error: crash\n at ...' });

        expect(navigator.sendBeacon).toHaveBeenCalledWith(
            '/api/log',
            expect.stringContaining('"message":"crash"'),
        );
    });

    it('should include session ID in reported errors', () => {
        navigator.sendBeacon = vi.fn().mockReturnValue(true);
        service.reportError({ message: 'test' });

        const payload = JSON.parse((navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0][1] as string);
        expect(payload.sessionId).toBe(service.sessionId);
    });
});
