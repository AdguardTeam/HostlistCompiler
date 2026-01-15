/**
 * Tests for TracingContext
 */

import { assertEquals, assertExists } from '@std/assert';
import { createChildContext, createNoOpContext, createTracingContext, traceAsync, traceSync } from './TracingContext.ts';
import { OperationErrorEvent, OperationStartEvent } from './types.ts';

Deno.test('createTracingContext - creates valid context', () => {
    const context = createTracingContext();

    assertExists(context.correlationId);
    assertExists(context.diagnostics);
    assertExists(context.startTime);
    assertEquals(context.parent, undefined);
});

Deno.test('createTracingContext - accepts custom correlation ID', () => {
    const correlationId = 'custom-correlation-id';
    const context = createTracingContext({ correlationId });

    assertEquals(context.correlationId, correlationId);
});

Deno.test('createTracingContext - accepts custom metadata', () => {
    const metadata = { userId: '123', requestId: 'abc' };
    const context = createTracingContext({ metadata });

    assertEquals(context.metadata, metadata);
});

Deno.test('createChildContext - inherits from parent', () => {
    const parent = createTracingContext({
        correlationId: 'parent-id',
        metadata: { parentKey: 'parentValue' },
    });

    const child = createChildContext(parent, { childKey: 'childValue' });

    assertEquals(child.correlationId, parent.correlationId);
    assertEquals(child.parent, parent);
    assertEquals(child.diagnostics, parent.diagnostics);
    assertExists(child.metadata);
    assertEquals(child.metadata.parentKey, 'parentValue');
    assertEquals(child.metadata.childKey, 'childValue');
});

Deno.test('createNoOpContext - creates no-op context', () => {
    const context = createNoOpContext();

    assertEquals(context.correlationId, 'noop');
    assertEquals(context.startTime, 0);

    // Verify it's truly no-op
    context.diagnostics.recordMetric('test', 1, 'count');
    assertEquals(context.diagnostics.getEvents().length, 0);
});

Deno.test('traceSync - traces synchronous function execution', () => {
    const context = createTracingContext();

    const result = traceSync(context, 'testOperation', () => {
        return 42;
    }, { input: 'test' });

    assertEquals(result, 42);

    const events = context.diagnostics.getEvents();
    assertEquals(events.length, 2); // start + complete
    assertEquals((events[0] as OperationStartEvent).operation, 'testOperation');
    assertEquals((events[1] as OperationStartEvent).operation, 'testOperation');
});

Deno.test('traceSync - captures errors', () => {
    const context = createTracingContext();
    const testError = new Error('Test error');

    try {
        traceSync(context, 'failingOperation', () => {
            throw testError;
        });
    } catch (error) {
        assertEquals(error, testError);
    }

    const events = context.diagnostics.getEvents();
    assertEquals(events.length, 2); // start + error
    assertEquals((events[0] as OperationStartEvent).operation, 'failingOperation');
    assertEquals((events[1] as OperationErrorEvent).errorMessage, 'Test error');
});

Deno.test('traceAsync - traces async function execution', async () => {
    const context = createTracingContext();

    const result = await traceAsync(context, 'asyncOperation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return 'success';
    }, { input: 'test' });

    assertEquals(result, 'success');

    const events = context.diagnostics.getEvents();
    assertEquals(events.length, 2); // start + complete
    assertEquals((events[0] as OperationStartEvent).operation, 'asyncOperation');
    assertEquals((events[1] as OperationStartEvent).operation, 'asyncOperation');
});

Deno.test('traceAsync - captures async errors', async () => {
    const context = createTracingContext();
    const testError = new Error('Async error');

    try {
        await traceAsync(context, 'failingAsyncOperation', () => {
            throw testError;
        });
    } catch (error) {
        assertEquals(error, testError);
    }

    const events = context.diagnostics.getEvents();
    assertEquals(events.length, 2); // start + error
    assertEquals((events[0] as OperationStartEvent).operation, 'failingAsyncOperation');
    assertEquals((events[1] as OperationErrorEvent).errorMessage, 'Async error');
});

Deno.test('tracing - events have correct timestamps and IDs', () => {
    const context = createTracingContext();

    traceSync(context, 'op1', () => 1);
    traceSync(context, 'op2', () => 2);

    const events = context.diagnostics.getEvents();
    assertEquals(events.length, 4); // 2 operations * (start + complete)

    // Verify each event has unique ID and timestamp
    const ids = new Set(events.map((e) => e.eventId));
    assertEquals(ids.size, 4);

    events.forEach((event) => {
        assertExists(event.timestamp);
        assertExists(event.eventId);
        assertEquals(event.correlationId, context.correlationId);
    });
});

import { getOrCreateContext } from './TracingContext.ts';

Deno.test('getOrCreateContext - returns existing context if provided', () => {
    const existing = createTracingContext({ correlationId: 'existing' });
    const result = getOrCreateContext({ tracingContext: existing });

    assertEquals(result.correlationId, 'existing');
    assertEquals(result, existing);
});

Deno.test('getOrCreateContext - creates no-op context if not provided', () => {
    const result = getOrCreateContext({});

    assertEquals(result.correlationId, 'noop');
});

Deno.test('getOrCreateContext - creates no-op context if options undefined', () => {
    const result = getOrCreateContext(undefined);

    assertEquals(result.correlationId, 'noop');
});
