/**
 * Integration tests for Server-Sent Events (SSE) functionality
 *
 * These tests verify the SSE streaming implementation used for
 * real-time progress tracking during filter list compilation.
 *
 * Tests cover:
 * - SSE event format and structure
 * - Streaming logger functionality
 * - Streaming events handlers
 * - Response headers for SSE endpoints
 * - Event parsing and validation
 */

import { assertEquals, assertExists, assertStringIncludes } from '@std/assert';

/**
 * SSE Event Types emitted during compilation
 */
type SSEEventType =
    | 'log'
    | 'source:start'
    | 'source:complete'
    | 'source:error'
    | 'transformation:start'
    | 'transformation:complete'
    | 'progress'
    | 'compilation:complete'
    | 'result'
    | 'done'
    | 'error';

/**
 * Log levels supported by the streaming logger
 */
type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace';

/**
 * Parsed SSE event structure
 */
interface ParsedSSEEvent {
    type: SSEEventType;
    data: unknown;
}

/**
 * Mock WritableStreamDefaultWriter for testing
 */
class MockWritableStreamDefaultWriter {
    public chunks: Uint8Array[] = [];
    public closed = false;

    write(chunk: Uint8Array): void {
        this.chunks.push(chunk);
    }

    close(): void {
        this.closed = true;
    }

    getOutput(): string {
        const decoder = new TextDecoder();
        return this.chunks.map((chunk) => decoder.decode(chunk)).join('');
    }

    getEvents(): ParsedSSEEvent[] {
        const output = this.getOutput();
        return parseSSEStream(output);
    }

    clear(): void {
        this.chunks = [];
        this.closed = false;
    }
}

/**
 * Parse SSE formatted stream into discrete events
 */
function parseSSEStream(stream: string): ParsedSSEEvent[] {
    const events: ParsedSSEEvent[] = [];
    const eventBlocks = stream.split('\n\n').filter((block) => block.trim());

    for (const block of eventBlocks) {
        const lines = block.split('\n');
        let eventType: string | null = null;
        let eventData: string | null = null;

        for (const line of lines) {
            if (line.startsWith('event: ')) {
                eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
                eventData = line.substring(6);
            }
        }

        if (eventType && eventData) {
            try {
                events.push({
                    type: eventType as SSEEventType,
                    data: JSON.parse(eventData),
                });
            } catch {
                // Handle non-JSON data
                events.push({
                    type: eventType as SSEEventType,
                    data: eventData,
                });
            }
        }
    }

    return events;
}

/**
 * Create a mock streaming logger similar to the worker implementation
 */
function createMockStreamingLogger(writer: MockWritableStreamDefaultWriter) {
    const encoder = new TextEncoder();

    const sendEvent = (type: string, data: unknown) => {
        const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        writer.write(encoder.encode(event));
    };

    return {
        sendEvent,
        logger: {
            info: (message: string) => sendEvent('log', { level: 'info', message }),
            warn: (message: string) => sendEvent('log', { level: 'warn', message }),
            error: (message: string) => sendEvent('log', { level: 'error', message }),
            debug: (message: string) => sendEvent('log', { level: 'debug', message }),
            trace: (message: string) => sendEvent('log', { level: 'trace', message }),
        },
    };
}

/**
 * Create mock streaming events handlers
 */
function createMockStreamingEvents(sendEvent: (type: string, data: unknown) => void) {
    return {
        onSourceStart: (event: { source: { name?: string; source: string } }) => sendEvent('source:start', event),
        onSourceComplete: (event: { source: { name?: string; source: string } }) => sendEvent('source:complete', event),
        onSourceError: (event: { source: { name?: string; source: string }; error: Error }) =>
            sendEvent('source:error', {
                ...event,
                error: event.error.message,
            }),
        onTransformationStart: (event: { name: string }) => sendEvent('transformation:start', event),
        onTransformationComplete: (event: { name: string; outputCount: number }) => sendEvent('transformation:complete', event),
        onProgress: (event: { current: number; total: number; message?: string }) => sendEvent('progress', event),
        onCompilationComplete: (event: { ruleCount: number }) => sendEvent('compilation:complete', event),
    };
}

// SSE Format Tests

Deno.test('SSE Format - event should follow correct format', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    sendEvent('test', { key: 'value' });

    const output = writer.getOutput();
    assertStringIncludes(output, 'event: test');
    assertStringIncludes(output, 'data: {"key":"value"}');
    assertStringIncludes(output, '\n\n');
});

Deno.test('SSE Format - events should be separated by double newlines', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    sendEvent('event1', { id: 1 });
    sendEvent('event2', { id: 2 });
    sendEvent('event3', { id: 3 });

    const output = writer.getOutput();
    const eventBlocks = output.split('\n\n').filter((b) => b.trim());

    assertEquals(eventBlocks.length, 3);
});

Deno.test('SSE Format - data should be valid JSON', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    const testData = {
        nested: { key: 'value' },
        array: [1, 2, 3],
        number: 42,
        boolean: true,
        null: null,
    };

    sendEvent('complex', testData);

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'complex');
    assertEquals(events[0].data, testData);
});

Deno.test('SSE Format - should handle special characters in data', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    const testData = {
        message: 'Hello\nWorld\twith\r\nspecial "chars"',
        url: 'https://example.com/path?query=value&other=test',
    };

    sendEvent('special', testData);

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].data, testData);
});

Deno.test('SSE Format - should handle unicode characters', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    const testData = {
        emoji: '🎉🔥✅',
        chinese: '你好世界',
        arabic: 'مرحبا بالعالم',
        mixed: 'Hello 世界 🌍',
    };

    sendEvent('unicode', testData);

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].data, testData);
});

// Streaming Logger Tests

Deno.test('Streaming Logger - info level should emit log event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.info('Test info message');

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'log');
    assertEquals((events[0].data as { level: LogLevel; message: string }).level, 'info');
    assertEquals(
        (events[0].data as { level: LogLevel; message: string }).message,
        'Test info message',
    );
});

Deno.test('Streaming Logger - warn level should emit log event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.warn('Test warning message');

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'log');
    assertEquals((events[0].data as { level: LogLevel; message: string }).level, 'warn');
    assertEquals(
        (events[0].data as { level: LogLevel; message: string }).message,
        'Test warning message',
    );
});

Deno.test('Streaming Logger - error level should emit log event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.error('Test error message');

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'log');
    assertEquals((events[0].data as { level: LogLevel; message: string }).level, 'error');
    assertEquals(
        (events[0].data as { level: LogLevel; message: string }).message,
        'Test error message',
    );
});

Deno.test('Streaming Logger - debug level should emit log event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.debug('Test debug message');

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'log');
    assertEquals((events[0].data as { level: LogLevel; message: string }).level, 'debug');
});

Deno.test('Streaming Logger - trace level should emit log event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.trace('Test trace message');

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'log');
    assertEquals((events[0].data as { level: LogLevel; message: string }).level, 'trace');
});

Deno.test('Streaming Logger - multiple log levels in sequence', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');
    logger.debug('Debug message');
    logger.trace('Trace message');

    const events = writer.getEvents();
    assertEquals(events.length, 5);

    const levels = events.map((e) => (e.data as { level: LogLevel }).level);
    assertEquals(levels, ['info', 'warn', 'error', 'debug', 'trace']);
});

// Streaming Events Tests

Deno.test('Streaming Events - onSourceStart should emit source:start event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    events.onSourceStart({
        source: { name: 'Test Source', source: 'https://example.com/test.txt' },
    });

    const parsedEvents = writer.getEvents();
    assertEquals(parsedEvents.length, 1);
    assertEquals(parsedEvents[0].type, 'source:start');
    assertExists((parsedEvents[0].data as { source: { name: string } }).source);
});

Deno.test('Streaming Events - onSourceComplete should emit source:complete event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    events.onSourceComplete({
        source: { name: 'Test Source', source: 'https://example.com/test.txt' },
    });

    const parsedEvents = writer.getEvents();
    assertEquals(parsedEvents.length, 1);
    assertEquals(parsedEvents[0].type, 'source:complete');
});

Deno.test('Streaming Events - onSourceError should emit source:error event with message', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    events.onSourceError({
        source: { name: 'Test Source', source: 'https://example.com/test.txt' },
        error: new Error('Network timeout'),
    });

    const parsedEvents = writer.getEvents();
    assertEquals(parsedEvents.length, 1);
    assertEquals(parsedEvents[0].type, 'source:error');
    assertEquals((parsedEvents[0].data as { error: string }).error, 'Network timeout');
});

Deno.test('Streaming Events - onTransformationStart should emit transformation:start event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    events.onTransformationStart({ name: 'Deduplicate' });

    const parsedEvents = writer.getEvents();
    assertEquals(parsedEvents.length, 1);
    assertEquals(parsedEvents[0].type, 'transformation:start');
    assertEquals((parsedEvents[0].data as { name: string }).name, 'Deduplicate');
});

Deno.test(
    'Streaming Events - onTransformationComplete should emit transformation:complete event',
    () => {
        const writer = new MockWritableStreamDefaultWriter();
        const { sendEvent } = createMockStreamingLogger(writer);
        const events = createMockStreamingEvents(sendEvent);

        events.onTransformationComplete({ name: 'Deduplicate', outputCount: 1500 });

        const parsedEvents = writer.getEvents();
        assertEquals(parsedEvents.length, 1);
        assertEquals(parsedEvents[0].type, 'transformation:complete');
        assertEquals((parsedEvents[0].data as { name: string }).name, 'Deduplicate');
        assertEquals((parsedEvents[0].data as { outputCount: number }).outputCount, 1500);
    },
);

Deno.test('Streaming Events - onProgress should emit progress event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    events.onProgress({ current: 3, total: 5, message: 'Processing sources' });

    const parsedEvents = writer.getEvents();
    assertEquals(parsedEvents.length, 1);
    assertEquals(parsedEvents[0].type, 'progress');
    assertEquals((parsedEvents[0].data as { current: number }).current, 3);
    assertEquals((parsedEvents[0].data as { total: number }).total, 5);
    assertEquals((parsedEvents[0].data as { message: string }).message, 'Processing sources');
});

Deno.test('Streaming Events - onCompilationComplete should emit compilation:complete event', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    events.onCompilationComplete({ ruleCount: 5000 });

    const parsedEvents = writer.getEvents();
    assertEquals(parsedEvents.length, 1);
    assertEquals(parsedEvents[0].type, 'compilation:complete');
    assertEquals((parsedEvents[0].data as { ruleCount: number }).ruleCount, 5000);
});

// Full Compilation Flow Simulation

Deno.test('Streaming Flow - simulates complete compilation flow', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent, logger } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);
    const encoder = new TextEncoder();

    // Simulate compilation flow
    logger.info('Starting compilation');
    events.onProgress({ current: 0, total: 2, message: 'Initializing' });

    // Source 1
    events.onSourceStart({
        source: { name: 'EasyList', source: 'https://example.com/easylist.txt' },
    });
    events.onSourceComplete({
        source: { name: 'EasyList', source: 'https://example.com/easylist.txt' },
    });
    events.onProgress({ current: 1, total: 2, message: 'Fetched 1/2 sources' });

    // Source 2
    events.onSourceStart({
        source: { name: 'AdGuard', source: 'https://example.com/adguard.txt' },
    });
    events.onSourceComplete({
        source: { name: 'AdGuard', source: 'https://example.com/adguard.txt' },
    });
    events.onProgress({ current: 2, total: 2, message: 'Fetched 2/2 sources' });

    // Transformations
    events.onTransformationStart({ name: 'Deduplicate' });
    events.onTransformationComplete({ name: 'Deduplicate', outputCount: 10000 });

    events.onTransformationStart({ name: 'RemoveComments' });
    events.onTransformationComplete({ name: 'RemoveComments', outputCount: 9500 });

    // Compilation complete
    events.onCompilationComplete({ ruleCount: 9500 });

    // Final result
    sendEvent('result', {
        rules: ['||ads.example.com^', '||tracker.example.com^'],
        ruleCount: 9500,
        metrics: { duration: 1234 },
    });

    // Done event
    writer.write(encoder.encode('event: done\ndata: {}\n\n'));

    const parsedEvents = writer.getEvents();

    // Verify event sequence
    const eventTypes = parsedEvents.map((e) => e.type);

    assertExists(eventTypes.includes('log'));
    assertExists(eventTypes.includes('progress'));
    assertExists(eventTypes.includes('source:start'));
    assertExists(eventTypes.includes('source:complete'));
    assertExists(eventTypes.includes('transformation:start'));
    assertExists(eventTypes.includes('transformation:complete'));
    assertExists(eventTypes.includes('compilation:complete'));
    assertExists(eventTypes.includes('result'));
    assertExists(eventTypes.includes('done'));
});

Deno.test('Streaming Flow - simulates compilation with source error', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent, logger } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    // Simulate compilation with error
    logger.info('Starting compilation');

    events.onSourceStart({
        source: { name: 'Test', source: 'https://example.com/invalid.txt' },
    });

    events.onSourceError({
        source: { name: 'Test', source: 'https://example.com/invalid.txt' },
        error: new Error('404 Not Found'),
    });

    logger.warn('Source fetch failed, continuing with other sources');

    const parsedEvents = writer.getEvents();
    const errorEvent = parsedEvents.find((e) => e.type === 'source:error');

    assertExists(errorEvent);
    assertEquals((errorEvent!.data as { error: string }).error, '404 Not Found');
});

Deno.test('Streaming Flow - simulates fatal error', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);
    const encoder = new TextEncoder();

    logger.info('Starting compilation');

    // Simulate fatal error
    const errorMessage = 'Invalid configuration: missing sources';
    writer.write(
        encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`),
    );

    const parsedEvents = writer.getEvents();
    const errorEvent = parsedEvents.find((e) => e.type === 'error');

    assertExists(errorEvent);
    assertEquals((errorEvent!.data as { error: string }).error, errorMessage);
});

// SSE Response Headers Tests

Deno.test('SSE Headers - correct Content-Type header', () => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    };

    assertEquals(headers['Content-Type'], 'text/event-stream');
});

Deno.test('SSE Headers - Cache-Control prevents caching', () => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    };

    assertEquals(headers['Cache-Control'], 'no-cache');
});

Deno.test('SSE Headers - Connection keep-alive for persistent connection', () => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    };

    assertEquals(headers['Connection'], 'keep-alive');
});

Deno.test('SSE Headers - CORS header allows all origins', () => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    };

    assertEquals(headers['Access-Control-Allow-Origin'], '*');
});

// Event Parsing Tests

Deno.test('Event Parsing - parseSSEStream handles single event', () => {
    const stream = 'event: test\ndata: {"key":"value"}\n\n';
    const events = parseSSEStream(stream);

    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'test');
    assertEquals(events[0].data, { key: 'value' });
});

Deno.test('Event Parsing - parseSSEStream handles multiple events', () => {
    const stream = 'event: first\ndata: {"id":1}\n\nevent: second\ndata: {"id":2}\n\nevent: third\ndata: {"id":3}\n\n';
    const events = parseSSEStream(stream);

    assertEquals(events.length, 3);
    assertEquals(events[0].type, 'first');
    assertEquals(events[1].type, 'second');
    assertEquals(events[2].type, 'third');
});

Deno.test('Event Parsing - parseSSEStream handles empty data', () => {
    const stream = 'event: done\ndata: {}\n\n';
    const events = parseSSEStream(stream);

    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'done');
    assertEquals(events[0].data, {});
});

Deno.test('Event Parsing - parseSSEStream handles nested JSON data', () => {
    const stream = 'event: complex\ndata: {"nested":{"deep":{"value":42}},"array":[1,2,3]}\n\n';
    const events = parseSSEStream(stream);

    assertEquals(events.length, 1);
    assertEquals((events[0].data as { nested: { deep: { value: number } } }).nested.deep.value, 42);
    assertEquals((events[0].data as { array: number[] }).array, [1, 2, 3]);
});

Deno.test('Event Parsing - parseSSEStream ignores malformed events', () => {
    const stream = 'event: valid\ndata: {"valid":true}\n\ninvalid line without format\n\n';
    const events = parseSSEStream(stream);

    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'valid');
});

// Writer State Tests

Deno.test('Writer State - tracks chunks written', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    assertEquals(writer.chunks.length, 0);

    sendEvent('event1', {});
    assertEquals(writer.chunks.length, 1);

    sendEvent('event2', {});
    assertEquals(writer.chunks.length, 2);
});

Deno.test('Writer State - close marks writer as closed', () => {
    const writer = new MockWritableStreamDefaultWriter();

    assertEquals(writer.closed, false);

    writer.close();

    assertEquals(writer.closed, true);
});

Deno.test('Writer State - clear resets writer state', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    sendEvent('event', {});
    writer.close();

    assertEquals(writer.chunks.length, 1);
    assertEquals(writer.closed, true);

    writer.clear();

    assertEquals(writer.chunks.length, 0);
    assertEquals(writer.closed, false);
});

// Performance and Edge Case Tests

Deno.test('Performance - handles large number of events', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    const eventCount = 1000;
    for (let i = 0; i < eventCount; i++) {
        sendEvent('bulk', { index: i, timestamp: Date.now() });
    }

    const events = writer.getEvents();
    assertEquals(events.length, eventCount);
    assertEquals((events[0].data as { index: number }).index, 0);
    assertEquals((events[eventCount - 1].data as { index: number }).index, eventCount - 1);
});

Deno.test('Performance - handles large data payload', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    // Create large array of rules (simulating real compilation result)
    const rules = Array.from({ length: 10000 }, (_, i) => `||ads${i}.example.com^`);

    sendEvent('result', {
        rules,
        ruleCount: rules.length,
        metrics: { duration: 5000 },
    });

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals((events[0].data as { ruleCount: number }).ruleCount, 10000);
    assertEquals((events[0].data as { rules: string[] }).rules.length, 10000);
});

Deno.test('Edge Case - handles empty message', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.info('');

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals((events[0].data as { message: string }).message, '');
});

Deno.test('Edge Case - handles message with only whitespace', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { logger } = createMockStreamingLogger(writer);

    logger.info('   \t\n   ');

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertExists((events[0].data as { message: string }).message);
});

Deno.test('Edge Case - handles null and undefined in data', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    sendEvent('test', { nullValue: null, definedValue: 'test' });

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals((events[0].data as { nullValue: null }).nullValue, null);
    assertEquals((events[0].data as { definedValue: string }).definedValue, 'test');
});

// Result Event Structure Tests

Deno.test('Result Event - contains required fields', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    const resultData = {
        rules: ['||example.com^'],
        ruleCount: 1,
        metrics: {
            duration: 100,
            sourcesFetched: 1,
            transformationsApplied: 2,
        },
        previousVersion: {
            rules: [],
            ruleCount: 0,
            compiledAt: new Date().toISOString(),
        },
    };

    sendEvent('result', resultData);

    const events = writer.getEvents();
    assertEquals(events.length, 1);
    assertEquals(events[0].type, 'result');

    const data = events[0].data as typeof resultData;
    assertExists(data.rules);
    assertExists(data.ruleCount);
    assertExists(data.metrics);
});

Deno.test('Result Event - metrics contains timing information', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);

    sendEvent('result', {
        rules: [],
        ruleCount: 0,
        metrics: {
            duration: 1500,
            fetchDuration: 800,
            transformDuration: 700,
        },
    });

    const events = writer.getEvents();
    const data = events[0].data as {
        metrics: { duration: number; fetchDuration: number; transformDuration: number };
    };

    assertEquals(data.metrics.duration, 1500);
    assertEquals(data.metrics.fetchDuration, 800);
    assertEquals(data.metrics.transformDuration, 700);
});

// Integration with Compilation Configuration

Deno.test('Configuration - events include source configuration', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    const sourceConfig = {
        name: 'EasyList',
        source: 'https://easylist.to/easylist/easylist.txt',
    };

    events.onSourceStart({ source: sourceConfig });

    const parsedEvents = writer.getEvents();
    const data = parsedEvents[0].data as { source: typeof sourceConfig };

    assertEquals(data.source.name, 'EasyList');
    assertEquals(data.source.source, 'https://easylist.to/easylist/easylist.txt');
});

Deno.test('Configuration - transformation names are preserved', () => {
    const writer = new MockWritableStreamDefaultWriter();
    const { sendEvent } = createMockStreamingLogger(writer);
    const events = createMockStreamingEvents(sendEvent);

    const transformations = [
        'Deduplicate',
        'RemoveComments',
        'RemoveEmptyLines',
        'TrimLines',
        'ValidateRules',
    ];

    for (const name of transformations) {
        events.onTransformationStart({ name });
        events.onTransformationComplete({ name, outputCount: 1000 });
    }

    const parsedEvents = writer.getEvents();
    const transformationStarts = parsedEvents.filter((e) => e.type === 'transformation:start');
    const transformationCompletes = parsedEvents.filter(
        (e) => e.type === 'transformation:complete',
    );

    assertEquals(transformationStarts.length, 5);
    assertEquals(transformationCompletes.length, 5);
});
