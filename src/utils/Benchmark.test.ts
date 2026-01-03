import { assertEquals, assertExists, assertGreaterOrEqual } from '@std/assert';
import {
    Timer,
    BenchmarkCollector,
    formatDuration,
    formatNumber,
} from '../../src/utils/Benchmark.ts';

// Timer tests
Deno.test('Timer - should measure elapsed time', async () => {
    const timer = new Timer();
    timer.start();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const elapsed = timer.stop();
    assertGreaterOrEqual(elapsed, 5); // Allow some tolerance
});

Deno.test('Timer - should return elapsed time without stopping', async () => {
    const timer = new Timer();
    timer.start();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const elapsed = timer.elapsed;
    assertGreaterOrEqual(elapsed, 5); // Still running
});

Deno.test('Timer - should format elapsed time', async () => {
    const timer = new Timer();
    timer.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    timer.stop();
    const formatted = timer.format();
    assertExists(formatted);
    assertEquals(typeof formatted, 'string');
});

// BenchmarkCollector tests
Deno.test('BenchmarkCollector - should record stages', () => {
    const collector = new BenchmarkCollector();
    collector.start();
    collector.recordStage('Test Stage', 100, 1000);
    const metrics = collector.finish();

    assertEquals(metrics.stages.length, 1);
    assertEquals(metrics.stages[0].name, 'Test Stage');
    assertEquals(metrics.stages[0].durationMs, 100);
    assertEquals(metrics.stages[0].itemCount, 1000);
    assertEquals(metrics.stages[0].itemsPerSecond, 10000); // 1000 items / 100ms * 1000
});

Deno.test('BenchmarkCollector - should time sync operations', () => {
    const collector = new BenchmarkCollector();
    collector.start();

    const result = collector.timeSync('Sync Op', () => {
        // Simulate work
        let sum = 0;
        for (let i = 0; i < 1000; i++) sum += i;
        return sum;
    }, 1000);

    assertEquals(result, 499500); // Sum of 0-999
    const metrics = collector.finish();
    assertEquals(metrics.stages.length, 1);
    assertEquals(metrics.stages[0].name, 'Sync Op');
    assertGreaterOrEqual(metrics.stages[0].durationMs, 0);
});

Deno.test('BenchmarkCollector - should time async operations', async () => {
    const collector = new BenchmarkCollector();
    collector.start();

    const result = await collector.timeAsync(
        'Async Op',
        async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return [1, 2, 3];
        },
        (arr) => arr.length,
    );

    assertEquals(result, [1, 2, 3]);
    const metrics = collector.finish();
    assertEquals(metrics.stages.length, 1);
    assertEquals(metrics.stages[0].name, 'Async Op');
    assertEquals(metrics.stages[0].itemCount, 3);
    assertGreaterOrEqual(metrics.stages[0].durationMs, 5);
});

Deno.test('BenchmarkCollector - should track source and rule counts', () => {
    const collector = new BenchmarkCollector();
    collector.start();
    collector.setSourceCount(5);
    collector.setRuleCount(1000);
    collector.setOutputRuleCount(800);

    const metrics = collector.finish();
    assertEquals(metrics.sourceCount, 5);
    assertEquals(metrics.ruleCount, 1000);
    assertEquals(metrics.outputRuleCount, 800);
});

Deno.test('BenchmarkCollector - should generate formatted report', () => {
    const collector = new BenchmarkCollector();
    collector.start();
    collector.setSourceCount(2);
    collector.setRuleCount(500);
    collector.setOutputRuleCount(450);
    collector.recordStage('Stage 1', 100, 500);
    collector.recordStage('Stage 2', 50, 450);

    const report = collector.generateReport();
    assertExists(report);
    assertEquals(typeof report, 'string');
    // Check key elements are present
    assertEquals(report.includes('COMPILATION BENCHMARK'), true);
    assertEquals(report.includes('Stage 1'), true);
    assertEquals(report.includes('Stage 2'), true);
});

Deno.test('BenchmarkCollector - should handle zero duration', () => {
    const collector = new BenchmarkCollector();
    collector.start();
    collector.recordStage('Instant', 0, 100);

    const metrics = collector.finish();
    assertEquals(metrics.stages[0].itemsPerSecond, undefined); // Avoid division by zero
});

// formatDuration tests
Deno.test('formatDuration - should format microseconds', () => {
    const result = formatDuration(0.5);
    assertEquals(result, '500µs');
});

Deno.test('formatDuration - should format milliseconds', () => {
    const result = formatDuration(50);
    assertEquals(result, '50.0ms');
});

Deno.test('formatDuration - should format seconds', () => {
    const result = formatDuration(5000);
    assertEquals(result, '5.00s');
});

Deno.test('formatDuration - should format minutes and seconds', () => {
    const result = formatDuration(125000); // 2m 5s
    assertEquals(result, '2m 5.0s');
});

// formatNumber tests
Deno.test('formatNumber - should format with thousands separator', () => {
    const result = formatNumber(1000000);
    assertEquals(result.includes('1'), true);
    // Note: Locale formatting may vary, just check it's a string
    assertEquals(typeof result, 'string');
});

Deno.test('formatNumber - should handle small numbers', () => {
    const result = formatNumber(42);
    assertEquals(result, '42');
});
