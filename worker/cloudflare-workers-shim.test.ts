/**
 * Unit tests for the cloudflare-workers-shim module.
 *
 * The shim provides Deno-compatible stubs for types and runtime values that
 * originate from the `cloudflare:workers` built-in module.  Tests verify that
 * the exported stubs have the expected shapes so that code depending on them
 * behaves correctly under `deno test`.
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert';
import { env, WorkflowEntrypoint } from './cloudflare-workers-shim.ts';
import type { BrowserWorker, WorkflowEvent, WorkflowStep } from './cloudflare-workers-shim.ts';

// ---------------------------------------------------------------------------
// env stub
// ---------------------------------------------------------------------------

Deno.test('env shim - is exported', () => {
    assertExists(env);
});

Deno.test('env shim - is an object', () => {
    assertEquals(typeof env, 'object');
    assertEquals(env !== null, true);
});

// ---------------------------------------------------------------------------
// WorkflowEntrypoint base class
// ---------------------------------------------------------------------------

Deno.test('WorkflowEntrypoint - is exported as a class (function)', () => {
    assertEquals(typeof WorkflowEntrypoint, 'function');
    assertExists(WorkflowEntrypoint.prototype);
});

Deno.test('WorkflowEntrypoint - can be subclassed with a run method', () => {
    // deno-lint-ignore no-explicit-any
    class TestWorkflow extends WorkflowEntrypoint<any, { value: string }> {
        async run(_event: WorkflowEvent<{ value: string }>, _step: WorkflowStep): Promise<string> {
            return 'done';
        }
    }

    // Verify the subclass can be instantiated (WorkflowEntrypoint accepts ctx + env)
    // deno-lint-ignore no-explicit-any
    const instance = new TestWorkflow({} as any, {});
    assertInstanceOf(instance, WorkflowEntrypoint);
    assertInstanceOf(instance, TestWorkflow);
    assertEquals(typeof instance.run, 'function');
});

Deno.test('WorkflowEntrypoint - subclass run method is callable and returns a value', async () => {
    // deno-lint-ignore no-explicit-any
    class EchoWorkflow extends WorkflowEntrypoint<any, { message: string }> {
        async run(event: WorkflowEvent<{ message: string }>, _step: WorkflowStep): Promise<string> {
            return event.payload.message;
        }
    }

    // deno-lint-ignore no-explicit-any
    const wf = new EchoWorkflow({} as any, {});
    const mockEvent: WorkflowEvent<{ message: string }> = {
        payload: { message: 'hello' },
        timestamp: new Date(),
        instanceId: 'test-instance-id',
    };
    // deno-lint-ignore no-explicit-any
    const result = await wf.run(mockEvent, {} as any);
    assertEquals(result, 'hello');
});

// ---------------------------------------------------------------------------
// BrowserWorker interface (type-level shape verified via duck-typing)
// ---------------------------------------------------------------------------

Deno.test('BrowserWorker - an object with a fetch function satisfies the interface', () => {
    // Verify the interface shape at runtime using a simple conforming object.
    const mockBrowserWorker: BrowserWorker = {
        fetch: globalThis.fetch,
    };
    assertExists(mockBrowserWorker.fetch);
    assertEquals(typeof mockBrowserWorker.fetch, 'function');
});
