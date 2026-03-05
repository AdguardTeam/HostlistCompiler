import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SseService, type SseConnection } from './sse.service';
import { API_BASE_URL } from '../tokens';

describe('SseService', () => {
    let service: SseService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                { provide: API_BASE_URL, useValue: 'http://localhost/api' },
            ],
        });
        service = TestBed.inject(SseService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should return an SseConnection with all required properties', () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(null, { status: 500, statusText: 'Error' }),
        );

        const connection = service.connect('/test', { data: 'test' });
        expect(connection.events).toBeDefined();
        expect(connection.status).toBeDefined();
        expect(connection.isActive).toBeDefined();
        expect(connection.retryCount).toBeDefined();
        expect(connection.close).toBeInstanceOf(Function);
        expect(connection.latestByType).toBeInstanceOf(Function);

        connection.close();
    });

    it('should start with connecting status', () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

        const connection = service.connect('/test', {});
        expect(connection.status()).toBe('connecting');

        connection.close();
    });

    it('should be active when connecting', () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

        const connection = service.connect('/test', {});
        expect(connection.isActive()).toBe(true);

        connection.close();
    });

    it('should set status to closed when close() is called', () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

        const connection = service.connect('/test', {});
        connection.close();
        expect(connection.status()).toBe('closed');
        expect(connection.isActive()).toBe(false);
    });

    it('should start with empty events', () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

        const connection = service.connect('/test', {});
        expect(connection.events()).toEqual([]);

        connection.close();
    });

    it('should return undefined for latestByType when no events', () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

        const connection = service.connect('/test', {});
        expect(connection.latestByType('message')).toBeUndefined();

        connection.close();
    });

    it('should parse SSE events from streamed response', async () => {
        // Skip if ReadableStream not available in test env (JSDOM)
        if (typeof ReadableStream === 'undefined') {
            return;
        }

        const sseData = 'event: progress\ndata: {"step":1}\n\nevent: result\ndata: {"done":true}\n\nevent: done\ndata: {}\n\n';
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(sseData));
                controller.close();
            },
        });

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
        );

        const connection = service.connect('/test', { body: 'data' });

        await vi.waitFor(() => {
            expect(connection.status()).toBe('closed');
        }, { timeout: 2000 });

        const events = connection.events();
        expect(events.length).toBe(2);
        expect(events[0].type).toBe('progress');
        expect(events[0].data).toEqual({ step: 1 });
        expect(events[1].type).toBe('result');
        expect(events[1].data).toEqual({ done: true });
    });

    it('should set error status on HTTP error response', async () => {
        // Mock fetch to return an error response; mock setTimeout to skip retry delays
        vi.useFakeTimers();
        try {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(null, { status: 500, statusText: 'Internal Server Error' }),
            );

            const connection = service.connect('/test', {});

            // Advance through all retries (3 retries with exponential backoff)
            for (let i = 0; i < 4; i++) {
                await vi.advanceTimersByTimeAsync(10000);
            }

            expect(connection.status()).toBe('error');
            connection.close();
        } finally {
            vi.useRealTimers();
        }
    });

    it('should POST with JSON body', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

        const body = { configuration: { name: 'test' } };
        const connection = service.connect('/compile/stream', body);

        expect(fetchSpy).toHaveBeenCalledWith(
            'http://localhost/api/compile/stream',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }),
        );

        connection.close();
    });

    it('should start retryCount at 0', () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

        const connection = service.connect('/test', {});
        expect(connection.retryCount()).toBe(0);

        connection.close();
    });
});
