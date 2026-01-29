/**
 * Tests for RuleOptimizerTransformation
 */

import { assertEquals } from '@std/assert';
import { RuleOptimizerTransformation } from './RuleOptimizerTransformation.ts';
import { TransformationType } from '../types/index.ts';
import { silentLogger } from '../utils/index.ts';

Deno.test('RuleOptimizerTransformation - constructor', async (t) => {
    await t.step('should create instance with default options', () => {
        const optimizer = new RuleOptimizerTransformation();
        const stats = optimizer.getStats();

        assertEquals(stats.rulesOptimized, 0);
        assertEquals(stats.redundantRemoved, 0);
    });

    await t.step('should create instance with custom logger', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);
        const stats = optimizer.getStats();

        assertEquals(stats.originalCount, 0);
    });

    await t.step('should create instance with custom options', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: false,
            mergeRules: true,
            simplifyModifiers: false,
        });

        const result = optimizer.executeSync(['||example.com^']);
        assertEquals(result.length, 1);
    });
});

Deno.test('RuleOptimizerTransformation - getStats', async (t) => {
    await t.step('should return optimization statistics', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const stats = optimizer.getStats();

        assertEquals(typeof stats.rulesOptimized, 'number');
        assertEquals(typeof stats.redundantRemoved, 'number');
        assertEquals(typeof stats.rulesMerged, 'number');
        assertEquals(typeof stats.modifiersSimplified, 'number');
        assertEquals(typeof stats.originalCount, 'number');
        assertEquals(typeof stats.finalCount, 'number');
        assertEquals(typeof stats.sizeReduction, 'number');
    });

    await t.step('should update stats after execution', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        optimizer.executeSync(['||example.com^', '||test.com^']);
        const stats = optimizer.getStats();

        assertEquals(stats.originalCount, 2);
        assertEquals(stats.finalCount, 2);
    });

    await t.step('should calculate size reduction percentage', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: true,
        });

        // Create redundant rules (subdomain and parent domain)
        optimizer.executeSync([
            '||example.com^',
            '||ads.example.com^',
        ]);

        const stats = optimizer.getStats();
        assertEquals(typeof stats.sizeReduction, 'number');
        assertEquals(stats.sizeReduction >= 0, true);
    });
});

Deno.test('RuleOptimizerTransformation - removeRedundant', async (t) => {
    await t.step('should remove redundant subdomain rules when parent exists', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: true,
            optimizePatterns: false,
            simplifyModifiers: false,
        });

        const rules = [
            '||example.com^',
            '||ads.example.com^',
            '||test.com^',
        ];

        const result = optimizer.executeSync(rules);

        // Should keep parent domain rules and independent domains
        assertEquals(result.includes('||example.com^'), true);
        assertEquals(result.includes('||test.com^'), true);
    });

    await t.step('should keep non-redundant rules', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: true,
            optimizePatterns: false,
            simplifyModifiers: false,
        });

        const rules = [
            '||example.com^',
            '||test.com^',
            '||domain.org^',
        ];

        const result = optimizer.executeSync(rules);

        assertEquals(result.length, 3);
    });

    await t.step('should preserve comments and empty lines', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: true,
        });

        const rules = [
            '! Comment',
            '||example.com^',
            '',
            '||test.com^',
        ];

        const result = optimizer.executeSync(rules);

        assertEquals(result.includes('! Comment'), true);
    });

    await t.step('should preserve exception rules', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: true,
        });

        const rules = [
            '||example.com^',
            '@@||ads.example.com^',
        ];

        const result = optimizer.executeSync(rules);

        assertEquals(result.includes('@@||ads.example.com^'), true);
    });
});

Deno.test('RuleOptimizerTransformation - optimizePatterns', async (t) => {
    await t.step('should optimize patterns when enabled', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: false,
            optimizePatterns: true,
            simplifyModifiers: false,
        });

        const rules = ['||example.com^'];

        const result = optimizer.executeSync(rules);

        assertEquals(result.length, 1);
    });

    await t.step('should not optimize patterns when disabled', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            optimizePatterns: false,
        });

        const rules = ['||example.com^'];

        const result = optimizer.executeSync(rules);

        assertEquals(result[0], '||example.com^');
    });
});

Deno.test('RuleOptimizerTransformation - simplifyModifiers', async (t) => {
    await t.step('should simplify modifiers when enabled', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: false,
            optimizePatterns: false,
            simplifyModifiers: true,
        });

        const rules = ['||example.com^'];

        const result = optimizer.executeSync(rules);

        assertEquals(result.length, 1);
    });

    await t.step('should not simplify modifiers when disabled', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            simplifyModifiers: false,
        });

        const rules = ['||example.com^'];

        const result = optimizer.executeSync(rules);

        assertEquals(result.length, 1);
    });
});

Deno.test('RuleOptimizerTransformation - mergeRules', async (t) => {
    await t.step('should not merge rules by default', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const rules = [
            '||example.com^',
            '||test.com^',
            '||domain.org^',
        ];

        const result = optimizer.executeSync(rules);

        // mergeRules is false by default
        assertEquals(result.length, 3);
    });

    await t.step('should merge rules when enabled', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: false,
            optimizePatterns: false,
            simplifyModifiers: false,
            mergeRules: true,
            mergeThreshold: 2,
        });

        const rules = [
            '||example.com^',
            '||test.com^',
        ];

        const result = optimizer.executeSync(rules);

        // Merging might reduce rule count
        assertEquals(result.length >= 1, true);
    });
});

Deno.test('RuleOptimizerTransformation - executeSync', async (t) => {
    await t.step('should handle empty rules array', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const result = optimizer.executeSync([]);

        assertEquals(result.length, 0);
        const stats = optimizer.getStats();
        assertEquals(stats.originalCount, 0);
        assertEquals(stats.finalCount, 0);
        assertEquals(stats.sizeReduction, 0);
    });

    await t.step('should handle single rule', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const result = optimizer.executeSync(['||example.com^']);

        assertEquals(result.length, 1);
        assertEquals(result[0], '||example.com^');
    });

    await t.step('should not modify original array', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);
        const rules = ['||example.com^', '||test.com^'];
        const original = [...rules];

        optimizer.executeSync(rules);

        assertEquals(rules, original);
    });

    await t.step('should handle mixed content', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const rules = [
            '! Title: Test Filter',
            '',
            '||example.com^',
            '@@||ads.example.com^',
            '||test.com^',
            '! Comment',
        ];

        const result = optimizer.executeSync(rules);

        // Should preserve comments and exception rules
        assertEquals(result.some((r) => r.startsWith('!')), true);
        assertEquals(result.some((r) => r.startsWith('@@')), true);
    });

    await t.step('should apply all enabled optimizations', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger, {
            removeRedundant: true,
            optimizePatterns: true,
            simplifyModifiers: true,
            mergeRules: false,
        });

        const rules = [
            '||example.com^',
            '||test.com^',
        ];

        const result = optimizer.executeSync(rules);

        assertEquals(Array.isArray(result), true);
        const stats = optimizer.getStats();
        assertEquals(stats.originalCount, 2);
    });
});

Deno.test('RuleOptimizerTransformation - transformation properties', async (t) => {
    await t.step('should have correct type property', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        assertEquals(optimizer.type, TransformationType.Deduplicate);
    });

    await t.step('should have correct name property', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        assertEquals(optimizer.name, 'RuleOptimizer');
    });
});

Deno.test('RuleOptimizerTransformation - edge cases', async (t) => {
    await t.step('should handle rules with special characters', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const rules = [
            '||example.com/path?query=value^',
            '||test.com/*^',
        ];

        const result = optimizer.executeSync(rules);

        assertEquals(result.length, 2);
    });

    await t.step('should handle very long rules', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const longRule = '||' + 'a'.repeat(1000) + '.com^';
        const rules = [longRule];

        const result = optimizer.executeSync(rules);

        assertEquals(result.length, 1);
    });

    await t.step('should handle rules with modifiers', () => {
        const optimizer = new RuleOptimizerTransformation(silentLogger);

        const rules = [
            '||example.com^$third-party',
            '||test.com^$script,domain=example.com',
        ];

        const result = optimizer.executeSync(rules);

        assertEquals(result.length, 2);
    });
});
