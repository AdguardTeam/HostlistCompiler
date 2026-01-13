import { assertEquals, assertExists } from '@std/assert';
import { CompilerEventEmitter, createEventEmitter, NoOpEventEmitter } from '../../src/utils/EventEmitter.ts';
import {
    ICompilationCompleteEvent,
    ICompilerEvents,
    IProgressEvent,
    ISourceCompleteEvent,
    ISourceErrorEvent,
    ISourceStartEvent,
    ITransformationCompleteEvent,
    ITransformationStartEvent,
    SourceType,
    TransformationType,
} from '../../src/types/index.ts';

// Helper to create test source
function createTestSource() {
    return {
        source: 'https://example.com/hosts.txt',
        name: 'Test Source',
        type: SourceType.Hosts,
    };
}

// CompilerEventEmitter tests
Deno.test('CompilerEventEmitter - should construct with no events', () => {
    const emitter = new CompilerEventEmitter();
    assertEquals(emitter.hasListeners(), false);
});

Deno.test('CompilerEventEmitter - should construct with events', () => {
    const events: ICompilerEvents = {
        onSourceStart: () => {},
    };
    const emitter = new CompilerEventEmitter(events);
    assertEquals(emitter.hasListeners(), true);
});

Deno.test('CompilerEventEmitter - should emit source start event', () => {
    let receivedEvent: ISourceStartEvent | undefined;
    const events: ICompilerEvents = {
        onSourceStart: (event) => {
            receivedEvent = event;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    const event: ISourceStartEvent = {
        source: createTestSource(),
        sourceIndex: 0,
        totalSources: 2,
    };
    emitter.emitSourceStart(event);

    assertExists(receivedEvent);
    assertEquals(receivedEvent.sourceIndex, 0);
    assertEquals(receivedEvent.totalSources, 2);
    assertEquals(receivedEvent.source.name, 'Test Source');
});

Deno.test('CompilerEventEmitter - should emit source complete event', () => {
    let receivedEvent: ISourceCompleteEvent | undefined;
    const events: ICompilerEvents = {
        onSourceComplete: (event) => {
            receivedEvent = event;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    const event: ISourceCompleteEvent = {
        source: createTestSource(),
        sourceIndex: 1,
        totalSources: 3,
        ruleCount: 1000,
        durationMs: 150.5,
    };
    emitter.emitSourceComplete(event);

    assertExists(receivedEvent);
    assertEquals(receivedEvent.ruleCount, 1000);
    assertEquals(receivedEvent.durationMs, 150.5);
});

Deno.test('CompilerEventEmitter - should emit source error event', () => {
    let receivedEvent: ISourceErrorEvent | undefined;
    const events: ICompilerEvents = {
        onSourceError: (event) => {
            receivedEvent = event;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    const testError = new Error('Download failed');
    const event: ISourceErrorEvent = {
        source: createTestSource(),
        sourceIndex: 0,
        totalSources: 1,
        error: testError,
    };
    emitter.emitSourceError(event);

    assertExists(receivedEvent);
    assertEquals(receivedEvent.error.message, 'Download failed');
});

Deno.test('CompilerEventEmitter - should emit transformation start event', () => {
    let receivedEvent: ITransformationStartEvent | undefined;
    const events: ICompilerEvents = {
        onTransformationStart: (event) => {
            receivedEvent = event;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    const event: ITransformationStartEvent = {
        name: TransformationType.Deduplicate,
        inputCount: 5000,
    };
    emitter.emitTransformationStart(event);

    assertExists(receivedEvent);
    assertEquals(receivedEvent.name, TransformationType.Deduplicate);
    assertEquals(receivedEvent.inputCount, 5000);
});

Deno.test('CompilerEventEmitter - should emit transformation complete event', () => {
    let receivedEvent: ITransformationCompleteEvent | undefined;
    const events: ICompilerEvents = {
        onTransformationComplete: (event) => {
            receivedEvent = event;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    const event: ITransformationCompleteEvent = {
        name: TransformationType.Compress,
        inputCount: 5000,
        outputCount: 3500,
        durationMs: 45.2,
    };
    emitter.emitTransformationComplete(event);

    assertExists(receivedEvent);
    assertEquals(receivedEvent.name, TransformationType.Compress);
    assertEquals(receivedEvent.inputCount, 5000);
    assertEquals(receivedEvent.outputCount, 3500);
    assertEquals(receivedEvent.durationMs, 45.2);
});

Deno.test('CompilerEventEmitter - should emit progress event', () => {
    let receivedEvent: IProgressEvent | undefined;
    const events: ICompilerEvents = {
        onProgress: (event) => {
            receivedEvent = event;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    const event: IProgressEvent = {
        phase: 'sources',
        current: 2,
        total: 5,
        message: 'Processing source 2 of 5',
    };
    emitter.emitProgress(event);

    assertExists(receivedEvent);
    assertEquals(receivedEvent.phase, 'sources');
    assertEquals(receivedEvent.current, 2);
    assertEquals(receivedEvent.total, 5);
    assertEquals(receivedEvent.message, 'Processing source 2 of 5');
});

Deno.test('CompilerEventEmitter - should emit compilation complete event', () => {
    let receivedEvent: ICompilationCompleteEvent | undefined;
    const events: ICompilerEvents = {
        onCompilationComplete: (event) => {
            receivedEvent = event;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    const event: ICompilationCompleteEvent = {
        ruleCount: 50000,
        totalDurationMs: 2500.8,
        sourceCount: 10,
        transformationCount: 6,
    };
    emitter.emitCompilationComplete(event);

    assertExists(receivedEvent);
    assertEquals(receivedEvent.ruleCount, 50000);
    assertEquals(receivedEvent.totalDurationMs, 2500.8);
    assertEquals(receivedEvent.sourceCount, 10);
    assertEquals(receivedEvent.transformationCount, 6);
});

Deno.test('CompilerEventEmitter - should not throw when no handler registered', () => {
    const emitter = new CompilerEventEmitter();

    // These should not throw
    emitter.emitSourceStart({ source: createTestSource(), sourceIndex: 0, totalSources: 1 });
    emitter.emitSourceComplete({ source: createTestSource(), sourceIndex: 0, totalSources: 1, ruleCount: 0, durationMs: 0 });
    emitter.emitSourceError({ source: createTestSource(), sourceIndex: 0, totalSources: 1, error: new Error('test') });
    emitter.emitTransformationStart({ name: TransformationType.Validate, inputCount: 0 });
    emitter.emitTransformationComplete({ name: TransformationType.Validate, inputCount: 0, outputCount: 0, durationMs: 0 });
    emitter.emitProgress({ phase: 'sources', current: 0, total: 1, message: '' });
    emitter.emitCompilationComplete({ ruleCount: 0, totalDurationMs: 0, sourceCount: 0, transformationCount: 0 });

    // If we get here, no errors were thrown
    assertEquals(true, true);
});

Deno.test('CompilerEventEmitter - should handle throwing handlers gracefully', () => {
    const events: ICompilerEvents = {
        onSourceStart: () => {
            throw new Error('Handler error');
        },
    };
    const emitter = new CompilerEventEmitter(events);

    // Should not throw even if handler throws
    emitter.emitSourceStart({ source: createTestSource(), sourceIndex: 0, totalSources: 1 });

    // If we get here, the error was caught
    assertEquals(true, true);
});

Deno.test('CompilerEventEmitter - should support multiple handlers', () => {
    let sourceStartCalled = false;
    let sourceCompleteCalled = false;
    let progressCalled = false;

    const events: ICompilerEvents = {
        onSourceStart: () => {
            sourceStartCalled = true;
        },
        onSourceComplete: () => {
            sourceCompleteCalled = true;
        },
        onProgress: () => {
            progressCalled = true;
        },
    };
    const emitter = new CompilerEventEmitter(events);

    emitter.emitSourceStart({ source: createTestSource(), sourceIndex: 0, totalSources: 1 });
    emitter.emitSourceComplete({ source: createTestSource(), sourceIndex: 0, totalSources: 1, ruleCount: 0, durationMs: 0 });
    emitter.emitProgress({ phase: 'sources', current: 1, total: 1, message: '' });

    assertEquals(sourceStartCalled, true);
    assertEquals(sourceCompleteCalled, true);
    assertEquals(progressCalled, true);
});

// NoOpEventEmitter tests
Deno.test('NoOpEventEmitter - should always report no listeners', () => {
    const emitter = NoOpEventEmitter.getInstance();
    assertEquals(emitter.hasListeners(), false);
});

Deno.test('NoOpEventEmitter - should not throw on any emit', () => {
    const emitter = NoOpEventEmitter.getInstance();

    emitter.emitSourceStart({ source: createTestSource(), sourceIndex: 0, totalSources: 1 });
    emitter.emitSourceComplete({ source: createTestSource(), sourceIndex: 0, totalSources: 1, ruleCount: 0, durationMs: 0 });
    emitter.emitSourceError({ source: createTestSource(), sourceIndex: 0, totalSources: 1, error: new Error('test') });
    emitter.emitTransformationStart({ name: TransformationType.Validate, inputCount: 0 });
    emitter.emitTransformationComplete({ name: TransformationType.Validate, inputCount: 0, outputCount: 0, durationMs: 0 });
    emitter.emitProgress({ phase: 'sources', current: 0, total: 1, message: '' });
    emitter.emitCompilationComplete({ ruleCount: 0, totalDurationMs: 0, sourceCount: 0, transformationCount: 0 });

    assertEquals(true, true);
});

// createEventEmitter factory tests
Deno.test('createEventEmitter - should return NoOpEventEmitter when no events', () => {
    const emitter = createEventEmitter();
    assertEquals(emitter instanceof NoOpEventEmitter, true);
    assertEquals(emitter.hasListeners(), false);
});

Deno.test('createEventEmitter - should return NoOpEventEmitter when empty events object', () => {
    const emitter = createEventEmitter({});
    assertEquals(emitter instanceof NoOpEventEmitter, true);
    assertEquals(emitter.hasListeners(), false);
});

Deno.test('createEventEmitter - should return CompilerEventEmitter when events provided', () => {
    const events: ICompilerEvents = {
        onSourceStart: () => {},
    };
    const emitter = createEventEmitter(events);
    assertEquals(emitter instanceof CompilerEventEmitter, true);
    assertEquals(emitter.hasListeners(), true);
});

// Integration-style test
Deno.test('CompilerEventEmitter - should track full compilation lifecycle', () => {
    const eventLog: string[] = [];

    const events: ICompilerEvents = {
        onSourceStart: (e) => eventLog.push(`source-start:${e.sourceIndex}`),
        onSourceComplete: (e) => eventLog.push(`source-complete:${e.sourceIndex}:${e.ruleCount}`),
        onTransformationStart: (e) => eventLog.push(`transform-start:${e.name}`),
        onTransformationComplete: (e) => eventLog.push(`transform-complete:${e.name}:${e.outputCount}`),
        onProgress: (e) => eventLog.push(`progress:${e.phase}:${e.current}/${e.total}`),
        onCompilationComplete: (e) => eventLog.push(`complete:${e.ruleCount}`),
    };

    const emitter = new CompilerEventEmitter(events);

    // Simulate a compilation lifecycle
    emitter.emitSourceStart({ source: createTestSource(), sourceIndex: 0, totalSources: 2 });
    emitter.emitProgress({ phase: 'sources', current: 1, total: 2, message: '' });
    emitter.emitSourceComplete({ source: createTestSource(), sourceIndex: 0, totalSources: 2, ruleCount: 500, durationMs: 100 });

    emitter.emitSourceStart({ source: createTestSource(), sourceIndex: 1, totalSources: 2 });
    emitter.emitProgress({ phase: 'sources', current: 2, total: 2, message: '' });
    emitter.emitSourceComplete({ source: createTestSource(), sourceIndex: 1, totalSources: 2, ruleCount: 300, durationMs: 80 });

    emitter.emitTransformationStart({ name: TransformationType.Deduplicate, inputCount: 800 });
    emitter.emitProgress({ phase: 'transformations', current: 1, total: 1, message: '' });
    emitter.emitTransformationComplete({ name: TransformationType.Deduplicate, inputCount: 800, outputCount: 700, durationMs: 20 });

    emitter.emitCompilationComplete({ ruleCount: 700, totalDurationMs: 200, sourceCount: 2, transformationCount: 1 });

    assertEquals(eventLog.length, 10);
    assertEquals(eventLog[0], 'source-start:0');
    assertEquals(eventLog[2], 'source-complete:0:500');
    assertEquals(eventLog[6], 'transform-start:Deduplicate');
    assertEquals(eventLog[7], 'progress:transformations:1/1');
    assertEquals(eventLog[8], 'transform-complete:Deduplicate:700');
    assertEquals(eventLog[9], 'complete:700');
});
