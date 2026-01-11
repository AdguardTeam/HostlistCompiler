import { assertEquals } from '@std/assert';
import { ConflictDetectionTransformation, detectConflicts } from './ConflictDetectionTransformation.ts';

Deno.test('ConflictDetectionTransformation - detects basic conflicts', () => {
    const rules = [
        '||example.com^',
        '@@||example.com^',
    ];

    const transformation = new ConflictDetectionTransformation();
    transformation.executeSync(rules);
    const conflicts = transformation.getConflicts();

    assertEquals(conflicts.length, 1);
    assertEquals(conflicts[0].domain, 'example.com');
    assertEquals(conflicts[0].blockingRule, '||example.com^');
    assertEquals(conflicts[0].allowingRule, '@@||example.com^');
});

Deno.test('ConflictDetectionTransformation - no conflict for different domains', () => {
    const rules = [
        '||ads.example.com^',
        '@@||allowed.example.com^',
    ];

    const transformation = new ConflictDetectionTransformation();
    transformation.executeSync(rules);
    const conflicts = transformation.getConflicts();

    assertEquals(conflicts.length, 0);
});

Deno.test('ConflictDetectionTransformation - detects multiple conflicts', () => {
    const rules = [
        '||example.com^',
        '||test.org^',
        '@@||example.com^',
        '@@||test.org^',
    ];

    const transformation = new ConflictDetectionTransformation();
    transformation.executeSync(rules);
    const conflicts = transformation.getConflicts();

    assertEquals(conflicts.length, 2);
});

Deno.test('ConflictDetectionTransformation - ignores comments', () => {
    const rules = [
        '! This is a comment',
        '||example.com^',
        '# Another comment',
    ];

    const transformation = new ConflictDetectionTransformation();
    const result = transformation.executeSync(rules);

    assertEquals(result.length, 3);
    assertEquals(transformation.getConflicts().length, 0);
});

Deno.test('ConflictDetectionTransformation - auto-resolve keeps blocking', () => {
    const rules = [
        '||example.com^',
        '@@||example.com^',
    ];

    const transformation = new ConflictDetectionTransformation(undefined, {
        autoResolve: true,
        resolutionStrategy: 'keep-block',
    });
    const result = transformation.executeSync(rules);

    assertEquals(result.length, 1);
    assertEquals(result[0], '||example.com^');
});

Deno.test('ConflictDetectionTransformation - auto-resolve keeps allowing', () => {
    const rules = [
        '||example.com^',
        '@@||example.com^',
    ];

    const transformation = new ConflictDetectionTransformation(undefined, {
        autoResolve: true,
        resolutionStrategy: 'keep-allow',
    });
    const result = transformation.executeSync(rules);

    assertEquals(result.length, 1);
    assertEquals(result[0], '@@||example.com^');
});

Deno.test('ConflictDetectionTransformation - auto-resolve keeps first', () => {
    const rules = [
        '||example.com^',
        '@@||example.com^',
    ];

    const transformation = new ConflictDetectionTransformation(undefined, {
        autoResolve: true,
        resolutionStrategy: 'keep-first',
    });
    const result = transformation.executeSync(rules);

    assertEquals(result.length, 1);
    assertEquals(result[0], '||example.com^');
});

Deno.test('detectConflicts - convenience function works', () => {
    const rules = [
        '||example.com^',
        '@@||example.com^',
        '||other.com^',
    ];

    const result = detectConflicts(rules);

    assertEquals(result.conflicts.length, 1);
    assertEquals(result.rulesAnalyzed, 3);
});

Deno.test('ConflictDetectionTransformation - clears conflicts between runs', () => {
    const transformation = new ConflictDetectionTransformation();

    transformation.executeSync(['||a.com^', '@@||a.com^']);
    assertEquals(transformation.getConflicts().length, 1);

    transformation.clearConflicts();
    assertEquals(transformation.getConflicts().length, 0);
});

Deno.test('ConflictDetectionTransformation - provides recommendation', () => {
    const rules = [
        '||example.com^',
        '@@||example.com^$script',
    ];

    const transformation = new ConflictDetectionTransformation();
    transformation.executeSync(rules);
    const conflicts = transformation.getConflicts();

    assertEquals(conflicts.length, 1);
    // More specific exception rule should recommend keep-allow
    assertEquals(conflicts[0].recommendation, 'keep-allow');
});
