/**
 * Tests for the Cloudflare Tail Worker
 *
 * Note: These are unit tests for the tail worker logic.
 * Integration testing requires actual Cloudflare deployment.
 */

import { assertEquals, assertExists } from '@std/assert';
import { createStructuredEvent, formatLogMessage, shouldForwardEvent, type TailEvent, type TailLog } from './tail.ts';

// Tests
Deno.test('formatLogMessage - formats simple string message', () => {
    const log: TailLog = {
        timestamp: 1704931200000, // 2024-01-11T00:00:00.000Z
        level: 'info',
        message: ['Hello, world!'],
    };

    const formatted = formatLogMessage(log);
    assertEquals(formatted, '[2024-01-11T00:00:00.000Z] [INFO] Hello, world!');
});

Deno.test('formatLogMessage - formats multiple messages', () => {
    const log: TailLog = {
        timestamp: 1704931200000,
        level: 'error',
        message: ['Error:', 'Something went wrong'],
    };

    const formatted = formatLogMessage(log);
    assertEquals(formatted, '[2024-01-11T00:00:00.000Z] [ERROR] Error: Something went wrong');
});

Deno.test('formatLogMessage - formats object messages', () => {
    const log: TailLog = {
        timestamp: 1704931200000,
        level: 'log',
        message: [{ foo: 'bar', count: 42 }],
    };

    const formatted = formatLogMessage(log);
    assertEquals(formatted, '[2024-01-11T00:00:00.000Z] [LOG] {"foo":"bar","count":42}');
});

Deno.test('formatLogMessage - handles circular reference in objects', () => {
    // Create an object with circular reference
    const obj: any = { foo: 'bar' };
    obj.self = obj; // circular reference

    const log: TailLog = {
        timestamp: 1704931200000,
        level: 'log',
        message: [obj],
    };

    const formatted = formatLogMessage(log);
    // Should fall back to String() when JSON.stringify fails
    assertEquals(formatted, '[2024-01-11T00:00:00.000Z] [LOG] [object Object]');
});

Deno.test('shouldForwardEvent - forwards exception outcome', () => {
    const event: TailEvent = {
        outcome: 'exception',
        eventTimestamp: 1704931200000,
        logs: [],
        exceptions: [],
    };

    assertEquals(shouldForwardEvent(event), true);
});

Deno.test('shouldForwardEvent - forwards when exceptions present', () => {
    const event: TailEvent = {
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
    const event: TailEvent = {
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
    const event: TailEvent = {
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
    const event: TailEvent = {
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
    const event: TailEvent = {
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
    const event: TailEvent = {
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
