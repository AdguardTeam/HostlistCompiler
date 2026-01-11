import { assertEquals, assertExists } from '@std/assert';
import { DiffGenerator, generateDiff, generateDiffMarkdown } from './DiffReport.ts';

Deno.test('DiffGenerator - detects added rules', () => {
    const original = ['||example.com^'];
    const updated = ['||example.com^', '||new.example.com^'];

    const generator = new DiffGenerator();
    const report = generator.generate(original, updated);

    assertEquals(report.summary.addedCount, 1);
    assertEquals(report.summary.removedCount, 0);
    assertEquals(report.summary.unchangedCount, 1);
    assertEquals(report.added[0].rule, '||new.example.com^');
});

Deno.test('DiffGenerator - detects removed rules', () => {
    const original = ['||example.com^', '||removed.example.com^'];
    const updated = ['||example.com^'];

    const generator = new DiffGenerator();
    const report = generator.generate(original, updated);

    assertEquals(report.summary.addedCount, 0);
    assertEquals(report.summary.removedCount, 1);
    assertEquals(report.summary.unchangedCount, 1);
    assertEquals(report.removed[0].rule, '||removed.example.com^');
});

Deno.test('DiffGenerator - calculates net change', () => {
    const original = ['||a.com^', '||b.com^'];
    const updated = ['||a.com^', '||c.com^', '||d.com^', '||e.com^'];

    const generator = new DiffGenerator();
    const report = generator.generate(original, updated);

    assertEquals(report.summary.originalCount, 2);
    assertEquals(report.summary.newCount, 4);
    assertEquals(report.summary.netChange, 2); // +3 added, -1 removed = +2
});

Deno.test('DiffGenerator - ignores comments by default', () => {
    const original = ['! Comment', '||example.com^'];
    const updated = ['! Different comment', '||example.com^'];

    const generator = new DiffGenerator({ ignoreComments: true });
    const report = generator.generate(original, updated);

    assertEquals(report.summary.addedCount, 0);
    assertEquals(report.summary.removedCount, 0);
    assertEquals(report.summary.unchangedCount, 1);
});

Deno.test('DiffGenerator - includes comments when configured', () => {
    const original = ['! Comment', '||example.com^'];
    const updated = ['! Different comment', '||example.com^'];

    const generator = new DiffGenerator({ ignoreComments: false });
    const report = generator.generate(original, updated);

    assertEquals(report.summary.addedCount, 1);
    assertEquals(report.summary.removedCount, 1);
});

Deno.test('DiffGenerator - ignores empty lines by default', () => {
    const original = ['||example.com^', '', '||test.com^'];
    const updated = ['||example.com^', '||test.com^'];

    const generator = new DiffGenerator();
    const report = generator.generate(original, updated);

    assertEquals(report.summary.addedCount, 0);
    assertEquals(report.summary.removedCount, 0);
});

Deno.test('DiffGenerator - analyzes domain changes', () => {
    const original = [
        '||ads.example.com^',
        '||tracking.example.com^',
    ];
    const updated = [
        '||ads.example.com^',
        '||new-ads.example.com^',
        '||new-tracking.example.com^',
    ];

    const generator = new DiffGenerator({ analyzeDomains: true });
    const report = generator.generate(original, updated);

    assertExists(report.domainChanges);
    assertEquals(report.domainChanges.length > 0, true);
});

Deno.test('DiffGenerator - exports as markdown', () => {
    const original = ['||old.example.com^'];
    const updated = ['||new.example.com^'];

    const generator = new DiffGenerator();
    const report = generator.generate(original, updated);
    const markdown = generator.exportAsMarkdown(report);

    assertEquals(markdown.includes('# Filter List Diff Report'), true);
    assertEquals(markdown.includes('## Summary'), true);
    assertEquals(markdown.includes('Added'), true);
    assertEquals(markdown.includes('Removed'), true);
});

Deno.test('DiffGenerator - exports as JSON', () => {
    const original = ['||example.com^'];
    const updated = ['||example.com^', '||new.example.com^'];

    const generator = new DiffGenerator();
    const report = generator.generate(original, updated);
    const json = generator.exportAsJson(report);

    const parsed = JSON.parse(json);
    assertEquals(parsed.summary.addedCount, 1);
    assertExists(parsed.timestamp);
});

Deno.test('generateDiff - convenience function works', () => {
    const original = ['||example.com^'];
    const updated = ['||new.example.com^'];

    const report = generateDiff(original, updated);

    assertEquals(report.summary.addedCount, 1);
    assertEquals(report.summary.removedCount, 1);
});

Deno.test('generateDiffMarkdown - convenience function works', () => {
    const original = ['||example.com^'];
    const updated = ['||new.example.com^'];

    const markdown = generateDiffMarkdown(original, updated);

    assertEquals(markdown.includes('# Filter List Diff Report'), true);
});

Deno.test('DiffGenerator - handles empty lists', () => {
    const generator = new DiffGenerator();

    const report1 = generator.generate([], ['||new.com^']);
    assertEquals(report1.summary.addedCount, 1);
    assertEquals(report1.summary.removedCount, 0);

    const report2 = generator.generate(['||old.com^'], []);
    assertEquals(report2.summary.addedCount, 0);
    assertEquals(report2.summary.removedCount, 1);

    const report3 = generator.generate([], []);
    assertEquals(report3.summary.addedCount, 0);
    assertEquals(report3.summary.removedCount, 0);
});

Deno.test('DiffGenerator - limits output rules', () => {
    const original: string[] = [];
    const updated = Array.from({ length: 2000 }, (_, i) => `||rule${i}.com^`);

    const generator = new DiffGenerator({ maxRulesToInclude: 100 });
    const report = generator.generate(original, updated);

    assertEquals(report.summary.addedCount, 2000);
    assertEquals(report.added.length, 100); // Limited to 100
});
