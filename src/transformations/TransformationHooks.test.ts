import { assertEquals, assertExists } from '@std/assert';
import { createEventBridgeHook, createLoggingHook, createMetricsHook, NoOpHookManager, TransformationHookManager } from './TransformationHooks.ts';
import { TransformationPipeline } from './TransformationRegistry.ts';
import { TransformationType } from '../types/index.ts';
import { silentLogger } from '../utils/logger.ts';

// ---------------------------------------------------------------------------
// NoOpHookManager
// ---------------------------------------------------------------------------

Deno.test('NoOpHookManager - should report no hooks', () => {
    const mgr = new NoOpHookManager();
    assertEquals(mgr.hasHooks(), false);
});

Deno.test('NoOpHookManager - executeBeforeHooks does nothing', async () => {
    const mgr = new NoOpHookManager();
    // Should resolve without throwing even though no hooks are registered
    await mgr.executeBeforeHooks({ name: 'Test', type: TransformationType.RemoveComments, ruleCount: 0, timestamp: Date.now() });
});

Deno.test('NoOpHookManager - executeAfterHooks does nothing', async () => {
    const mgr = new NoOpHookManager();
    await mgr.executeAfterHooks({
        name: 'Test',
        type: TransformationType.RemoveComments,
        ruleCount: 0,
        timestamp: Date.now(),
        inputCount: 0,
        outputCount: 0,
        durationMs: 0,
    });
});

Deno.test('NoOpHookManager - executeErrorHooks does nothing', async () => {
    const mgr = new NoOpHookManager();
    await mgr.executeErrorHooks({
        name: 'Test',
        type: TransformationType.RemoveComments,
        ruleCount: 0,
        timestamp: Date.now(),
        error: new Error('test error'),
    });
});

// ---------------------------------------------------------------------------
// TransformationHookManager
// ---------------------------------------------------------------------------

Deno.test('TransformationHookManager - hasHooks returns false when empty', () => {
    const mgr = new TransformationHookManager();
    assertEquals(mgr.hasHooks(), false);
});

Deno.test('TransformationHookManager - hasHooks returns true after registering beforeTransform hook', () => {
    const mgr = new TransformationHookManager();
    mgr.onBeforeTransform(() => {});
    assertEquals(mgr.hasHooks(), true);
});

Deno.test('TransformationHookManager - hasHooks returns true after registering afterTransform hook', () => {
    const mgr = new TransformationHookManager();
    mgr.onAfterTransform(() => {});
    assertEquals(mgr.hasHooks(), true);
});

Deno.test('TransformationHookManager - hasHooks returns true after registering error hook', () => {
    const mgr = new TransformationHookManager();
    mgr.onTransformError(() => {});
    assertEquals(mgr.hasHooks(), true);
});

Deno.test('TransformationHookManager - clear removes all hooks', () => {
    const mgr = new TransformationHookManager();
    mgr.onBeforeTransform(() => {});
    mgr.onAfterTransform(() => {});
    mgr.onTransformError(() => {});
    mgr.clear();
    assertEquals(mgr.hasHooks(), false);
});

Deno.test('TransformationHookManager - constructor accepts initial config', () => {
    const called: string[] = [];
    const mgr = new TransformationHookManager({
        beforeTransform: [() => {
            called.push('before');
        }],
        afterTransform: [() => {
            called.push('after');
        }],
        onError: [() => {
            called.push('error');
        }],
    });
    assertEquals(mgr.hasHooks(), true);
});

Deno.test('TransformationHookManager - executeBeforeHooks invokes all registered hooks', async () => {
    const called: string[] = [];
    const mgr = new TransformationHookManager();
    mgr.onBeforeTransform(() => {
        called.push('hook1');
    });
    mgr.onBeforeTransform(() => {
        called.push('hook2');
    });

    await mgr.executeBeforeHooks({
        name: 'Test',
        type: TransformationType.RemoveComments,
        ruleCount: 5,
        timestamp: Date.now(),
    });

    assertEquals(called, ['hook1', 'hook2']);
});

Deno.test('TransformationHookManager - executeAfterHooks invokes all registered hooks', async () => {
    const durationValues: number[] = [];
    const mgr = new TransformationHookManager();
    mgr.onAfterTransform((ctx) => {
        durationValues.push(ctx.durationMs);
    });

    await mgr.executeAfterHooks({
        name: 'Test',
        type: TransformationType.RemoveComments,
        ruleCount: 3,
        timestamp: Date.now(),
        inputCount: 5,
        outputCount: 3,
        durationMs: 42,
    });

    assertEquals(durationValues, [42]);
});

Deno.test('TransformationHookManager - executeErrorHooks invokes all registered hooks', async () => {
    const errors: string[] = [];
    const mgr = new TransformationHookManager();
    mgr.onTransformError((ctx) => {
        errors.push(ctx.error.message);
    });

    await mgr.executeErrorHooks({
        name: 'Test',
        type: TransformationType.RemoveComments,
        ruleCount: 0,
        timestamp: Date.now(),
        error: new Error('something went wrong'),
    });

    assertEquals(errors, ['something went wrong']);
});

Deno.test('TransformationHookManager - onBeforeTransform supports fluent chaining', () => {
    const mgr = new TransformationHookManager();
    const result = mgr.onBeforeTransform(() => {});
    assertEquals(result, mgr);
});

// ---------------------------------------------------------------------------
// TransformationPipeline + hooks integration
// ---------------------------------------------------------------------------

Deno.test('TransformationPipeline - beforeTransform hook fires with correct context', async () => {
    const hookContexts: Array<{ name: string; ruleCount: number }> = [];
    const mgr = new TransformationHookManager();
    mgr.onBeforeTransform((ctx) => {
        hookContexts.push({ name: ctx.name, ruleCount: ctx.ruleCount });
    });

    const pipeline = new TransformationPipeline(undefined, silentLogger, undefined, mgr);
    const rules = ['||example.org^', '', '||test.com^'];
    const config = { name: 'Test', sources: [] };

    await pipeline.transform(rules, config, [TransformationType.RemoveEmptyLines]);

    assertEquals(hookContexts.length, 1);
    assertEquals(hookContexts[0].name, TransformationType.RemoveEmptyLines);
    assertEquals(hookContexts[0].ruleCount, 3);
});

Deno.test('TransformationPipeline - afterTransform hook fires with correct context', async () => {
    const afterContexts: Array<{ name: string; inputCount: number; outputCount: number }> = [];
    const mgr = new TransformationHookManager();
    mgr.onAfterTransform((ctx) => {
        afterContexts.push({ name: ctx.name, inputCount: ctx.inputCount, outputCount: ctx.outputCount });
    });

    const pipeline = new TransformationPipeline(undefined, silentLogger, undefined, mgr);
    const rules = ['||example.org^', '', '||test.com^'];
    const config = { name: 'Test', sources: [] };

    await pipeline.transform(rules, config, [TransformationType.RemoveEmptyLines]);

    assertEquals(afterContexts.length, 1);
    assertEquals(afterContexts[0].name, TransformationType.RemoveEmptyLines);
    assertEquals(afterContexts[0].inputCount, 3);
    assertEquals(afterContexts[0].outputCount, 2);
});

Deno.test('TransformationPipeline - afterTransform hook context includes durationMs', async () => {
    const mgr = new TransformationHookManager();
    let capturedDuration = -1;
    mgr.onAfterTransform((ctx) => {
        capturedDuration = ctx.durationMs;
    });

    const pipeline = new TransformationPipeline(undefined, silentLogger, undefined, mgr);
    const rules = ['||example.org^', '||test.com^'];
    const config = { name: 'Test', sources: [] };

    await pipeline.transform(rules, config, [TransformationType.Deduplicate]);

    // durationMs should be a non-negative number
    assertEquals(capturedDuration >= 0, true);
});

Deno.test('TransformationPipeline - both before and after hooks fire for multiple transformations', async () => {
    const events: string[] = [];
    const mgr = new TransformationHookManager();
    mgr.onBeforeTransform((ctx) => {
        events.push(`before:${ctx.name}`);
    });
    mgr.onAfterTransform((ctx) => {
        events.push(`after:${ctx.name}`);
    });

    const pipeline = new TransformationPipeline(undefined, silentLogger, undefined, mgr);
    const rules = ['  ||example.org^  ', '', '  ||test.com^  '];
    const config = { name: 'Test', sources: [] };

    await pipeline.transform(rules, config, [
        TransformationType.TrimLines,
        TransformationType.RemoveEmptyLines,
    ]);

    assertEquals(events.includes(`before:${TransformationType.TrimLines}`), true);
    assertEquals(events.includes(`after:${TransformationType.TrimLines}`), true);
    assertEquals(events.includes(`before:${TransformationType.RemoveEmptyLines}`), true);
    assertEquals(events.includes(`after:${TransformationType.RemoveEmptyLines}`), true);
});

Deno.test('TransformationPipeline - NoOpHookManager as default produces no errors', async () => {
    // Pipeline without explicit hook manager should use NoOpHookManager by default
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^'];
    const config = { name: 'Test', sources: [] };

    const result = await pipeline.transform(rules, config, [TransformationType.Deduplicate]);
    assertEquals(result, rules);
});

// ---------------------------------------------------------------------------
// createEventBridgeHook
// ---------------------------------------------------------------------------

Deno.test('createEventBridgeHook - beforeTransform calls emitTransformationStart', async () => {
    const startEvents: Array<{ name: string; inputCount: number }> = [];
    const mockEmitter = {
        emitTransformationStart: (e: { name: string; inputCount: number }) => {
            startEvents.push(e);
        },
        emitTransformationComplete: (_e: { name: string; inputCount: number; outputCount: number; durationMs: number }) => {},
    };

    const config = createEventBridgeHook(mockEmitter);
    assertExists(config.beforeTransform);
    await config.beforeTransform![0]({
        name: 'RemoveComments',
        type: TransformationType.RemoveComments,
        ruleCount: 10,
        timestamp: Date.now(),
    });

    assertEquals(startEvents.length, 1);
    assertEquals(startEvents[0].name, 'RemoveComments');
    assertEquals(startEvents[0].inputCount, 10);
});

Deno.test('createEventBridgeHook - afterTransform calls emitTransformationComplete', async () => {
    const completeEvents: Array<{ name: string; inputCount: number; outputCount: number; durationMs: number }> = [];
    const mockEmitter = {
        emitTransformationStart: (_e: { name: string; inputCount: number }) => {},
        emitTransformationComplete: (e: { name: string; inputCount: number; outputCount: number; durationMs: number }) => {
            completeEvents.push(e);
        },
    };

    const config = createEventBridgeHook(mockEmitter);
    assertExists(config.afterTransform);
    await config.afterTransform![0]({
        name: 'Deduplicate',
        type: TransformationType.Deduplicate,
        ruleCount: 5,
        timestamp: Date.now(),
        inputCount: 10,
        outputCount: 5,
        durationMs: 7.5,
    });

    assertEquals(completeEvents.length, 1);
    assertEquals(completeEvents[0].name, 'Deduplicate');
    assertEquals(completeEvents[0].inputCount, 10);
    assertEquals(completeEvents[0].outputCount, 5);
    assertEquals(completeEvents[0].durationMs, 7.5);
});

Deno.test('createEventBridgeHook - does not define onError', () => {
    const mockEmitter = {
        emitTransformationStart: (_e: { name: string; inputCount: number }) => {},
        emitTransformationComplete: (_e: { name: string; inputCount: number; outputCount: number; durationMs: number }) => {},
    };

    const config = createEventBridgeHook(mockEmitter);
    assertEquals(config.onError, undefined);
});

// ---------------------------------------------------------------------------
// createLoggingHook and createMetricsHook (factory smoke tests)
// ---------------------------------------------------------------------------

Deno.test('createLoggingHook - returns valid TransformationHookConfig', () => {
    const logger = { info: (_msg: string) => {}, error: (_msg: string) => {} };
    const config = createLoggingHook(logger);
    assertExists(config.beforeTransform);
    assertExists(config.afterTransform);
    assertExists(config.onError);
});

Deno.test('createMetricsHook - returns valid TransformationHookConfig with afterTransform', () => {
    const collector = { record: (_name: string, _duration: number, _diff: number) => {} };
    const config = createMetricsHook(collector);
    assertExists(config.afterTransform);
});
