/**
 * Example: Using the Diagnostics and Tracing System
 * 
 * This example demonstrates how to use the comprehensive diagnostics
 * system to track compilation operations and emit events to the tail worker.
 */

import {
    WorkerCompiler,
    createTracingContext,
    type IConfiguration,
    type DiagnosticEvent,
    TraceCategory,
    TraceSeverity,
} from '../src/index.ts';

/**
 * Example 1: Basic usage with WorkerCompiler
 */
async function basicExample() {
    console.log('=== Example 1: Basic Diagnostics ===\n');

    // Create a tracing context
    const tracingContext = createTracingContext({
        metadata: {
            user: 'example-user',
            environment: 'development',
        },
    });

    // Create configuration
    const configuration: IConfiguration = {
        name: 'Example Filter List',
        sources: [
            {
                source: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
                type: 'hosts',
                transformations: ['Compress'],
            },
        ],
        transformations: ['Deduplicate', 'RemoveEmptyLines'],
    };

    // Create compiler with tracing
    const compiler = new WorkerCompiler({
        tracingContext,
        // Note: In browser/worker, you'd need to pre-fetch content
        // This is just an example
    });

    try {
        // Compile with metrics
        const result = await compiler.compileWithMetrics(configuration, true);

        console.log(`Compiled ${result.rules.length} rules`);
        console.log(`Metrics: ${JSON.stringify(result.metrics, null, 2)}`);
        
        // Access diagnostic events
        if (result.diagnostics) {
            console.log(`\nCollected ${result.diagnostics.length} diagnostic events:`);
            
            // Show summary by category
            const categories = result.diagnostics.reduce((acc, event) => {
                acc[event.category] = (acc[event.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            console.log('Events by category:', categories);
            
            // Show all events
            console.log('\nAll Events:');
            result.diagnostics.forEach(event => {
                console.log(`  [${event.severity}] [${event.category}] ${event.message}`);
            });
        }
    } catch (error) {
        console.error('Compilation failed:', error);
        
        // Check for error events in diagnostics
        const diagnostics = tracingContext.diagnostics.getEvents();
        const errors = diagnostics.filter(e => e.category === 'error');
        console.log(`Found ${errors.length} error events:`, errors);
    }
}

/**
 * Example 2: Filtering and analyzing diagnostic events
 */
async function analyzeEventsExample() {
    console.log('\n=== Example 2: Analyzing Diagnostic Events ===\n');

    const tracingContext = createTracingContext();

    // Simulate some diagnostic events
    tracingContext.diagnostics.recordMetric('downloadSpeed', 1234.56, 'KB/s', {
        source: 'example.com',
    });
    
    tracingContext.diagnostics.recordCacheEvent('hit', 'source-abc123', 50000);
    tracingContext.diagnostics.recordCacheEvent('miss', 'source-xyz789');
    
    tracingContext.diagnostics.recordNetworkEvent(
        'GET',
        'https://example.com/filters.txt',
        200,
        234.56,
        100000
    );

    const eventId = tracingContext.diagnostics.operationStart('exampleOperation', {
        param1: 'value1',
    });
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    tracingContext.diagnostics.operationComplete(eventId, {
        result: 'success',
    });

    // Get all events
    const diagnostics = tracingContext.diagnostics.getEvents();

    // Analyze by category
    console.log('Events by category:');
    const byCategory = diagnostics.reduce((acc, event) => {
        if (!acc[event.category]) {
            acc[event.category] = [];
        }
        acc[event.category].push(event);
        return acc;
    }, {} as Record<string, DiagnosticEvent[]>);

    for (const [category, events] of Object.entries(byCategory)) {
        console.log(`  ${category}: ${events.length} events`);
    }

    // Find performance metrics
    console.log('\nPerformance Metrics:');
    const metrics = diagnostics.filter(e => e.category === TraceCategory.Performance);
    metrics.forEach(m => {
        console.log(`  ${m.metric}: ${m.value} ${m.unit}`);
    });

    // Find cache statistics
    console.log('\nCache Statistics:');
    const cacheEvents = diagnostics.filter(e => e.category === TraceCategory.Cache);
    const cacheStats = cacheEvents.reduce((acc, e) => {
        acc[e.operation] = (acc[e.operation] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    console.log(cacheStats);

    // Find network requests
    console.log('\nNetwork Requests:');
    const networkEvents = diagnostics.filter(e => e.category === TraceCategory.Network);
    networkEvents.forEach(n => {
        console.log(`  ${n.method} ${n.url} - ${n.statusCode} (${n.durationMs}ms)`);
    });
}

/**
 * Example 3: Using diagnostics for debugging
 */
async function debuggingExample() {
    console.log('\n=== Example 3: Debugging with Diagnostics ===\n');

    const tracingContext = createTracingContext({
        correlationId: 'debug-session-123',
    });

    // Simulate an operation that might fail
    const eventId = tracingContext.diagnostics.operationStart('riskyOperation', {
        retries: 3,
    });

    try {
        // Simulate failure
        throw new Error('Network timeout');
    } catch (error) {
        tracingContext.diagnostics.operationError(eventId, error as Error);
    }

    // Analyze errors
    const diagnostics = tracingContext.diagnostics.getEvents();
    const errors = diagnostics.filter(e => e.severity === TraceSeverity.Error);

    console.log(`Found ${errors.length} errors:`);
    errors.forEach(err => {
        console.log(`\n  Error in ${err.operation}:`);
        console.log(`    Type: ${err.errorType}`);
        console.log(`    Message: ${err.errorMessage}`);
        if (err.durationMs) {
            console.log(`    Failed after: ${err.durationMs}ms`);
        }
        if (err.stack) {
            console.log(`    Stack trace available: Yes`);
        }
    });
}

/**
 * Example 4: Emitting diagnostics for tail worker (simplified)
 */
function emitForTailWorker() {
    console.log('\n=== Example 4: Emitting to Tail Worker ===\n');

    const tracingContext = createTracingContext();

    // Record various events
    tracingContext.diagnostics.recordMetric('compilationTime', 1523.45, 'ms');
    tracingContext.diagnostics.recordCacheEvent('hit', 'config-abc');
    
    const eventId = tracingContext.diagnostics.operationStart('compile');
    tracingContext.diagnostics.operationComplete(eventId, { rules: 5000 });

    // Get events and emit them
    const diagnostics = tracingContext.diagnostics.getEvents();

    console.log('Emitting diagnostic events to console for tail worker:');
    diagnostics.forEach(event => {
        // This is how the worker.ts emits to tail worker
        const logData = {
            ...event,
            source: 'adblock-compiler',
        };

        switch (event.severity) {
            case 'error':
                console.error('[DIAGNOSTIC]', JSON.stringify(logData, null, 2));
                break;
            case 'warn':
                console.warn('[DIAGNOSTIC]', JSON.stringify(logData, null, 2));
                break;
            case 'info':
                console.info('[DIAGNOSTIC]', JSON.stringify(logData, null, 2));
                break;
            default:
                console.log('[DIAGNOSTIC]', JSON.stringify(logData, null, 2));
        }
    });
}

// Run all examples
async function main() {
    console.log('Diagnostics System Examples\n');
    console.log('=' .repeat(60) + '\n');

    // Note: Example 1 requires network access and may fail in some environments
    // Uncomment to run: await basicExample();
    
    await analyzeEventsExample();
    await debuggingExample();
    emitForTailWorker();

    console.log('\n' + '='.repeat(60));
    console.log('Examples completed!');
}

// Run if executed directly
if (import.meta.main) {
    main().catch(console.error);
}
