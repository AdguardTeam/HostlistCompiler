/**
 * Tests for Transformation base classes
 */

import { assertEquals, assertExists } from '@std/assert';
import { AsyncTransformation, SyncTransformation, Transformation } from './Transformation.ts';
import { ITransformationContext, SourceType, TransformationType } from '../../types/index.ts';
import { silentLogger } from '../../utils/index.ts';

/**
 * Concrete implementation of SyncTransformation for testing
 */
class TestSyncTransformation extends SyncTransformation {
    public readonly type = TransformationType.RemoveComments;
    public readonly name = 'Test Sync Transformation';

    public executeSync(rules: readonly string[], _context?: ITransformationContext): readonly string[] {
        return rules.map((rule) => rule.toUpperCase());
    }
}

/**
 * Concrete implementation of AsyncTransformation for testing
 */
class TestAsyncTransformation extends AsyncTransformation {
    public readonly type = TransformationType.RemoveComments;
    public readonly name = 'Test Async Transformation';

    public async execute(rules: readonly string[], _context?: ITransformationContext): Promise<readonly string[]> {
        // Simulate async operation without setTimeout to avoid resource leaks in tests
        await Promise.resolve();
        return rules.map((rule) => rule.toLowerCase());
    }
}

/**
 * Transformation that uses logging
 */
class LoggingTransformation extends SyncTransformation {
    public readonly type = TransformationType.RemoveComments;
    public readonly name = 'Logging Transformation';

    public executeSync(rules: readonly string[], _context?: ITransformationContext): readonly string[] {
        this.info('Processing rules');
        this.debug('Debug message');
        this.error('Error message');
        return rules;
    }
}

Deno.test('Transformation - base class', async (t) => {
    await t.step('should have logger property', () => {
        const transformation = new TestSyncTransformation();
        assertExists(transformation['logger']);
    });

    await t.step('should use default logger when none provided', () => {
        const transformation = new TestSyncTransformation();
        assertExists(transformation['logger']);
    });

    await t.step('should use custom logger when provided', () => {
        const transformation = new TestSyncTransformation(silentLogger);
        assertEquals(transformation['logger'], silentLogger);
    });

    await t.step('should have type property', () => {
        const transformation = new TestSyncTransformation();
        assertExists(transformation.type);
        assertEquals(transformation.type, TransformationType.RemoveComments);
    });

    await t.step('should have name property', () => {
        const transformation = new TestSyncTransformation();
        assertExists(transformation.name);
        assertEquals(typeof transformation.name, 'string');
    });
});

Deno.test('SyncTransformation', async (t) => {
    await t.step('should execute synchronously via executeSync', () => {
        const transformation = new TestSyncTransformation();
        const rules = ['||example.com^', '||test.com^'];

        const result = transformation.executeSync(rules);

        assertEquals(result.length, 2);
        assertEquals(result[0], '||EXAMPLE.COM^');
        assertEquals(result[1], '||TEST.COM^');
    });

    await t.step('should wrap executeSync in Promise via execute', async () => {
        const transformation = new TestSyncTransformation();
        const rules = ['||example.com^', '||test.com^'];

        const result = await transformation.execute(rules);

        assertEquals(result.length, 2);
        assertEquals(result[0], '||EXAMPLE.COM^');
        assertEquals(result[1], '||TEST.COM^');
    });

    await t.step('should handle empty rules array', () => {
        const transformation = new TestSyncTransformation();
        const rules: string[] = [];

        const result = transformation.executeSync(rules);

        assertEquals(result.length, 0);
    });

    await t.step('should handle readonly rules array', () => {
        const transformation = new TestSyncTransformation();
        const rules: readonly string[] = ['||example.com^'];

        const result = transformation.executeSync(rules);

        assertEquals(result.length, 1);
        assertEquals(result[0], '||EXAMPLE.COM^');
    });

    await t.step('should accept transformation context', () => {
        const transformation = new TestSyncTransformation();
        const rules = ['||example.com^'];
        const context: ITransformationContext = {
            configuration: { source: 'test', type: SourceType.Adblock },
            logger: silentLogger,
        };

        const result = transformation.executeSync(rules, context);

        assertEquals(result.length, 1);
    });

    await t.step('should return readonly array', () => {
        const transformation = new TestSyncTransformation();
        const rules = ['||example.com^'];

        const result = transformation.executeSync(rules);

        // Type check - result is readonly string[]
        assertEquals(Array.isArray(result), true);
    });
});

Deno.test('AsyncTransformation', async (t) => {
    await t.step('should execute asynchronously', async () => {
        const transformation = new TestAsyncTransformation();
        const rules = ['||EXAMPLE.COM^', '||TEST.COM^'];

        const result = await transformation.execute(rules);

        assertEquals(result.length, 2);
        assertEquals(result[0], '||example.com^');
        assertEquals(result[1], '||test.com^');
    });

    await t.step('should handle empty rules array', async () => {
        const transformation = new TestAsyncTransformation();
        const rules: string[] = [];

        const result = await transformation.execute(rules);

        assertEquals(result.length, 0);
    });

    await t.step('should handle readonly rules array', async () => {
        const transformation = new TestAsyncTransformation();
        const rules: readonly string[] = ['||EXAMPLE.COM^'];

        const result = await transformation.execute(rules);

        assertEquals(result.length, 1);
        assertEquals(result[0], '||example.com^');
    });

    await t.step('should accept transformation context', async () => {
        const transformation = new TestAsyncTransformation();
        const rules = ['||EXAMPLE.COM^'];
        const context: ITransformationContext = {
            configuration: { source: 'test', type: SourceType.Adblock },
            logger: silentLogger,
        };

        const result = await transformation.execute(rules, context);

        assertEquals(result.length, 1);
    });

    await t.step('should return Promise', () => {
        const transformation = new TestAsyncTransformation();
        const rules = ['||EXAMPLE.COM^'];

        const result = transformation.execute(rules);

        assertEquals(result instanceof Promise, true);
    });
});

Deno.test('Transformation - logging methods', async (t) => {
    await t.step('should provide info logging method', () => {
        const transformation = new LoggingTransformation();
        const rules = ['||example.com^'];

        // Should not throw
        transformation.executeSync(rules);
    });

    await t.step('should provide debug logging method', () => {
        const transformation = new LoggingTransformation();
        const rules = ['||example.com^'];

        // Should not throw
        transformation.executeSync(rules);
    });

    await t.step('should provide error logging method', () => {
        const transformation = new LoggingTransformation();
        const rules = ['||example.com^'];

        // Should not throw
        transformation.executeSync(rules);
    });

    await t.step('should invoke custom logger methods when logging', () => {
        let infoLogged = false;
        let debugLogged = false;
        let errorLogged = false;

        const customLogger = {
            info: () => {
                infoLogged = true;
            },
            warn: () => {},
            error: () => {
                errorLogged = true;
            },
            debug: () => {
                debugLogged = true;
            },
            trace: () => {},
        };

        const transformation = new LoggingTransformation(customLogger);
        const rules = ['||example.com^'];

        transformation.executeSync(rules);

        assertEquals(infoLogged, true);
        assertEquals(debugLogged, true);
        assertEquals(errorLogged, true);
    });
});

Deno.test('Transformation - interface compatibility', async (t) => {
    await t.step('SyncTransformation should be compatible with Transformation interface', async () => {
        const transformation: Transformation = new TestSyncTransformation();

        const rules = ['||example.com^'];
        const result = await transformation.execute(rules);

        assertEquals(result.length, 1);
    });

    await t.step('AsyncTransformation should be compatible with Transformation interface', async () => {
        const transformation: Transformation = new TestAsyncTransformation();

        const rules = ['||EXAMPLE.COM^'];
        const result = await transformation.execute(rules);

        assertEquals(result.length, 1);
    });

    await t.step('Both transformation types should have same interface', () => {
        const sync: Transformation = new TestSyncTransformation();
        const async: Transformation = new TestAsyncTransformation();

        assertExists(sync.execute);
        assertExists(async.execute);
        assertExists(sync.type);
        assertExists(async.type);
        assertExists(sync.name);
        assertExists(async.name);
    });
});

Deno.test('Transformation - immutability', async (t) => {
    await t.step('should not modify input rules array', () => {
        const transformation = new TestSyncTransformation();
        const rules = ['||example.com^', '||test.com^'];
        const originalRules = [...rules];

        transformation.executeSync(rules);

        assertEquals(rules, originalRules);
    });

    await t.step('should return new array', () => {
        const transformation = new TestSyncTransformation();
        const rules = ['||example.com^'];

        const result = transformation.executeSync(rules);

        // Result should be different array (even if contents are same)
        assertEquals(result !== rules, true);
    });
});
