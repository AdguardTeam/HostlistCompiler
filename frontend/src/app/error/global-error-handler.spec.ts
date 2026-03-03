import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
    let handler: GlobalErrorHandler;

    beforeEach(() => {
        handler = new GlobalErrorHandler();
    });

    it('should be created', () => {
        expect(handler).toBeTruthy();
    });

    it('should handle Error objects', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        handler.handleError(new Error('test error'));

        expect(handler.lastError()).toBeTruthy();
        expect(handler.lastError()?.message).toBe('test error');
        expect(handler.hasError()).toBe(true);
        consoleSpy.mockRestore();
    });

    it('should handle string errors', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        handler.handleError('string error');

        expect(handler.lastError()?.message).toBe('string error');
        consoleSpy.mockRestore();
    });

    it('should handle unknown error types', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        handler.handleError({ code: 500 });

        expect(handler.lastError()?.message).toBe('An unexpected error occurred');
        consoleSpy.mockRestore();
    });

    it('should maintain error history (max 10)', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        for (let i = 0; i < 15; i++) {
            handler.handleError(new Error(`error ${i}`));
        }

        expect(handler.errorHistory().length).toBe(10);
        expect(handler.errorHistory()[0].message).toBe('error 14'); // most recent
        consoleSpy.mockRestore();
    });

    it('should clear current error', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        handler.handleError(new Error('test'));
        handler.clearError();

        expect(handler.lastError()).toBeNull();
        expect(handler.hasError()).toBe(false);
        consoleSpy.mockRestore();
    });

    it('should clear all history', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        handler.handleError(new Error('test'));
        handler.clearHistory();

        expect(handler.errorHistory().length).toBe(0);
        expect(handler.lastError()).toBeNull();
        consoleSpy.mockRestore();
    });

    it('should set timestamp on errors', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const before = new Date();
        handler.handleError(new Error('test'));
        const after = new Date();

        const ts = handler.lastError()!.timestamp;
        expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
        consoleSpy.mockRestore();
    });
});
