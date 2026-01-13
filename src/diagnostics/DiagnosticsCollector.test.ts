/**
 * Tests for the DiagnosticsCollector
 */

import { assertEquals, assertExists } from '@std/assert';
import { DiagnosticsCollector, NoOpDiagnosticsCollector } from './DiagnosticsCollector.ts';
import { CacheEvent, NetworkEvent, OperationCompleteEvent, OperationErrorEvent, OperationStartEvent, PerformanceMetricEvent, TraceCategory, TraceSeverity } from './types.ts';

Deno.test('DiagnosticsCollector - operationStart creates event', () => {
    const collector = new DiagnosticsCollector('test-correlation');
    const eventId = collector.operationStart('testOperation', { key: 'value' });

    assertExists(eventId);
    const events = collector.getEvents();
    assertEquals(events.length, 1);
    assertEquals((events[0] as OperationStartEvent).operation, 'testOperation');
    assertEquals(events[0].category, TraceCategory.Compilation);
    assertEquals(events[0].severity, TraceSeverity.Debug);
});

Deno.test('DiagnosticsCollector - operationComplete records duration', () => {
    const collector = new DiagnosticsCollector('test-correlation');
    const eventId = collector.operationStart('testOperation');

    // Small delay to ensure duration > 0
    const start = performance.now();
    while (performance.now() - start < 1) {
        // wait
    }

    collector.operationComplete(eventId, { result: 'success' });

    const events = collector.getEvents();
    assertEquals(events.length, 2); // start + complete

    const completeEvent = events[1] as OperationCompleteEvent;
    assertEquals(completeEvent.operation, 'testOperation');
    assertEquals(completeEvent.severity, TraceSeverity.Info);
    assertExists(completeEvent.durationMs);
});

Deno.test('DiagnosticsCollector - operationError records error details', () => {
    const collector = new DiagnosticsCollector('test-correlation');
    const eventId = collector.operationStart('testOperation');

    const testError = new Error('Test error message');
    collector.operationError(eventId, testError);

    const events = collector.getEvents();
    assertEquals(events.length, 2); // start + error

    const errorEvent = events[1] as OperationErrorEvent;
    assertEquals(errorEvent.operation, 'testOperation');
    assertEquals(errorEvent.category, TraceCategory.Error);
    assertEquals(errorEvent.severity, TraceSeverity.Error);
    assertEquals(errorEvent.errorType, 'Error');
    assertEquals(errorEvent.errorMessage, 'Test error message');
    assertExists(errorEvent.stack);
});

Deno.test('DiagnosticsCollector - recordMetric creates performance event', () => {
    const collector = new DiagnosticsCollector('test-correlation');

    collector.recordMetric('responseTime', 123.45, 'ms', { endpoint: '/api/test' });

    const events = collector.getEvents();
    assertEquals(events.length, 1);

    const metricEvent = events[0] as PerformanceMetricEvent;
    assertEquals(metricEvent.category, TraceCategory.Performance);
    assertEquals(metricEvent.metric, 'responseTime');
    assertEquals(metricEvent.value, 123.45);
    assertEquals(metricEvent.unit, 'ms');
    assertEquals(metricEvent.dimensions?.endpoint, '/api/test');
});

Deno.test('DiagnosticsCollector - recordCacheEvent creates cache event', () => {
    const collector = new DiagnosticsCollector('test-correlation');

    collector.recordCacheEvent('hit', 'cache-key-123', 1024);

    const events = collector.getEvents();
    assertEquals(events.length, 1);

    const cacheEvent = events[0] as CacheEvent;
    assertEquals(cacheEvent.category, TraceCategory.Cache);
    assertEquals(cacheEvent.operation, 'hit');
    assertEquals(cacheEvent.key, 'cache-key-123');
    assertEquals(cacheEvent.size, 1024);
});

Deno.test('DiagnosticsCollector - recordNetworkEvent sanitizes URL', () => {
    const collector = new DiagnosticsCollector('test-correlation');

    collector.recordNetworkEvent(
        'GET',
        'https://example.com/api/data?secret=123&token=abc',
        200,
        45.67,
        2048,
    );

    const events = collector.getEvents();
    assertEquals(events.length, 1);

    const networkEvent = events[0] as NetworkEvent;
    assertEquals(networkEvent.category, TraceCategory.Network);
    assertEquals(networkEvent.method, 'GET');
    assertEquals(networkEvent.url, 'https://example.com/api/data?[QUERY]');
    assertEquals(networkEvent.statusCode, 200);
    assertEquals(networkEvent.durationMs, 45.67);
    assertEquals(networkEvent.responseSize, 2048);
});

Deno.test('DiagnosticsCollector - clear removes all events', () => {
    const collector = new DiagnosticsCollector('test-correlation');

    collector.recordMetric('test', 1, 'count');
    collector.recordCacheEvent('hit', 'key');

    assertEquals(collector.getEvents().length, 2);

    collector.clear();
    assertEquals(collector.getEvents().length, 0);
});

Deno.test('DiagnosticsCollector - correlation ID is preserved', () => {
    const correlationId = 'my-custom-correlation-id';
    const collector = new DiagnosticsCollector(correlationId);

    collector.recordMetric('test', 1, 'count');
    collector.operationStart('op');

    const events = collector.getEvents();
    events.forEach((event) => {
        assertEquals(event.correlationId, correlationId);
    });
});

Deno.test('NoOpDiagnosticsCollector - all operations are no-ops', () => {
    const collector = NoOpDiagnosticsCollector.getInstance();

    const eventId = collector.operationStart('test');
    assertEquals(eventId, 'noop');

    collector.operationComplete(eventId);
    collector.operationError(eventId, new Error('test'));
    collector.recordMetric('test', 1, 'count');
    collector.recordCacheEvent('hit', 'key');
    collector.recordNetworkEvent('GET', 'http://example.com');

    assertEquals(collector.getEvents().length, 0);

    collector.clear();
    assertEquals(collector.getEvents().length, 0);
});

Deno.test('NoOpDiagnosticsCollector - singleton instance', () => {
    const instance1 = NoOpDiagnosticsCollector.getInstance();
    const instance2 = NoOpDiagnosticsCollector.getInstance();

    assertEquals(instance1, instance2);
});
