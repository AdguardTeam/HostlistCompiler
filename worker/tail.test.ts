/**
 * Tests for the Cloudflare Tail Worker
 * 
 * Note: These are unit tests for the tail worker logic.
 * Integration testing requires actual Cloudflare deployment.
 */

// Mock types for testing
interface MockTailLog {
    timestamp: number;
    level: 'log' | 'debug' | 'info' | 'warn' | 'error';
    message: unknown[];
}

// Simple assertion helpers
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
    if (actual !== expected) {
        throw new Error(msg || `Expected ${expected} but got ${actual}`);
    }
}

function assertExists<T>(actual: T | null | undefined, msg?: string): void {
    if (actual === null || actual === undefined) {
        throw new Error(msg || 'Expected value to exist');
    }
}

interface MockTailException {
    timestamp: number;
    message: string;
    name: string;
}

interface MockTailEvent {
    scriptName?: string;
    outcome: 'ok' | 'exception' | 'exceededCpu' | 'exceededMemory' | 'unknown' | 'canceled';
    eventTimestamp: number;
    logs: MockTailLog[];
    exceptions: MockTailException[];
    event?: {
        request?: {
            url: string;
            method: string;
            headers: Record<string, string>;
        };
    };
}

// Helper functions from tail.ts (duplicated for testing)
function formatLogMessage(log: MockTailLog): string {
    const timestamp = new Date(log.timestamp).toISOString();
    const messages = log.message.map(m => 
        typeof m === 'object' ? JSON.stringify(m) : String(m)
    ).join(' ');
    return `[${timestamp}] [${log.level.toUpperCase()}] ${messages}`;
}

function shouldForwardEvent(event: MockTailEvent): boolean {
    return event.outcome === 'exception' || 
           event.exceptions.length > 0 ||
           event.logs.some(log => log.level === 'error');
}

function createStructuredEvent(event: MockTailEvent): Record<string, unknown> {
    return {
        timestamp: new Date(event.eventTimestamp).toISOString(),
        scriptName: event.scriptName || 'adblock-compiler',
        outcome: event.outcome,
        url: event.event?.request?.url,
        method: event.event?.request?.method,
        logs: event.logs.map(log => ({
            timestamp: new Date(log.timestamp).toISOString(),
            level: log.level,
            message: log.message,
        })),
        exceptions: event.exceptions.map(exc => ({
            timestamp: new Date(exc.timestamp).toISOString(),
            name: exc.name,
            message: exc.message,
        })),
    };
}

// Tests
Deno.test('formatLogMessage - formats simple string message', () => {
    const log: MockTailLog = {
        timestamp: 1704931200000, // 2024-01-11T00:00:00.000Z
        level: 'info',
        message: ['Hello, world!'],
    };

    const formatted = formatLogMessage(log);
    assertEquals(formatted, '[2024-01-11T00:00:00.000Z] [INFO] Hello, world!');
});

Deno.test('formatLogMessage - formats multiple messages', () => {
    const log: MockTailLog = {
        timestamp: 1704931200000,
        level: 'error',
        message: ['Error:', 'Something went wrong'],
    };

    const formatted = formatLogMessage(log);
    assertEquals(formatted, '[2024-01-11T00:00:00.000Z] [ERROR] Error: Something went wrong');
});

Deno.test('formatLogMessage - formats object messages', () => {
    const log: MockTailLog = {
        timestamp: 1704931200000,
        level: 'log',
        message: [{ foo: 'bar', count: 42 }],
    };

    const formatted = formatLogMessage(log);
    assertEquals(formatted, '[2024-01-11T00:00:00.000Z] [LOG] {"foo":"bar","count":42}');
});

Deno.test('shouldForwardEvent - forwards exception outcome', () => {
    const event: MockTailEvent = {
        outcome: 'exception',
        eventTimestamp: 1704931200000,
        logs: [],
        exceptions: [],
    };

    assertEquals(shouldForwardEvent(event), true);
});

Deno.test('shouldForwardEvent - forwards when exceptions present', () => {
    const event: MockTailEvent = {
        outcome: 'ok',
        eventTimestamp: 1704931200000,
        logs: [],
        exceptions: [{
            timestamp: 1704931200000,
            name: 'Error',
            message: 'Test error',
        }],
    };

    assertEquals(shouldForwardEvent(event), true);
});

Deno.test('shouldForwardEvent - forwards when error logs present', () => {
    const event: MockTailEvent = {
        outcome: 'ok',
        eventTimestamp: 1704931200000,
        logs: [{
            timestamp: 1704931200000,
            level: 'error',
            message: ['Error occurred'],
        }],
        exceptions: [],
    };

    assertEquals(shouldForwardEvent(event), true);
});

Deno.test('shouldForwardEvent - does not forward successful events', () => {
    const event: MockTailEvent = {
        outcome: 'ok',
        eventTimestamp: 1704931200000,
        logs: [{
            timestamp: 1704931200000,
            level: 'info',
            message: ['Request successful'],
        }],
        exceptions: [],
    };

    assertEquals(shouldForwardEvent(event), false);
});

Deno.test('createStructuredEvent - creates complete structured event', () => {
    const event: MockTailEvent = {
        scriptName: 'test-worker',
        outcome: 'exception',
        eventTimestamp: 1704931200000,
        logs: [{
            timestamp: 1704931200000,
            level: 'error',
            message: ['Test error'],
        }],
        exceptions: [{
            timestamp: 1704931200000,
            name: 'TypeError',
            message: 'Cannot read property',
        }],
        event: {
            request: {
                url: 'https://example.com/test',
                method: 'POST',
                headers: {},
            },
        },
    };

    const structured = createStructuredEvent(event);

    assertEquals(structured.scriptName, 'test-worker');
    assertEquals(structured.outcome, 'exception');
    assertEquals(structured.url, 'https://example.com/test');
    assertEquals(structured.method, 'POST');
    assertExists(structured.logs);
    assertExists(structured.exceptions);
    assertEquals((structured.logs as any).length, 1);
    assertEquals((structured.exceptions as any).length, 1);
});

Deno.test('createStructuredEvent - handles missing request data', () => {
    const event: MockTailEvent = {
        outcome: 'ok',
        eventTimestamp: 1704931200000,
        logs: [],
        exceptions: [],
    };

    const structured = createStructuredEvent(event);

    assertEquals(structured.scriptName, 'adblock-compiler'); // default value
    assertEquals(structured.url, undefined);
    assertEquals(structured.method, undefined);
});

Deno.test('createStructuredEvent - formats timestamps correctly', () => {
    const timestamp = 1704931200000; // 2024-01-11T00:00:00.000Z
    const event: MockTailEvent = {
        outcome: 'ok',
        eventTimestamp: timestamp,
        logs: [{
            timestamp,
            level: 'info',
            message: ['test'],
        }],
        exceptions: [],
    };

    const structured = createStructuredEvent(event);

    assertEquals(structured.timestamp, '2024-01-11T00:00:00.000Z');
    assertEquals((structured.logs as any)[0].timestamp, '2024-01-11T00:00:00.000Z');
});
