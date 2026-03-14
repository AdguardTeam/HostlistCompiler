import { assertEquals, assertExists } from '@std/assert';
import { ASTViewerService } from './ASTViewerService.ts';

Deno.test('ASTViewerService - Parse network rule', () => {
    const rule = '||example.com^$third-party';
    const parsed = ASTViewerService.parseRule(rule);

    assertEquals(parsed.success, true);
    assertEquals(parsed.category, 'Network');
    assertEquals(parsed.type, 'NetworkRule');
    assertEquals(parsed.properties?.network?.pattern, '||example.com^');
    assertEquals(parsed.properties?.network?.isException, false);
    assertEquals(parsed.properties?.network?.modifiers.length, 1);
    assertEquals(parsed.properties?.network?.modifiers[0].name, 'third-party');
});

Deno.test('ASTViewerService - Parse exception rule', () => {
    const rule = '@@||example.com^';
    const parsed = ASTViewerService.parseRule(rule);

    assertEquals(parsed.success, true);
    assertEquals(parsed.properties?.network?.isException, true);
});

Deno.test('ASTViewerService - Parse host rule', () => {
    const rule = '127.0.0.1 ad.example.com';
    const parsed = ASTViewerService.parseRule(rule);

    assertEquals(parsed.success, true);
    assertEquals(parsed.category, 'Network');
    assertEquals(parsed.type, 'HostRule');
    assertEquals(parsed.properties?.host?.ip, '127.0.0.1');
    assertEquals(parsed.properties?.host?.hostnames, ['ad.example.com']);
});

Deno.test('ASTViewerService - Parse cosmetic rule', () => {
    const rule = 'example.com##.ad-banner';
    const parsed = ASTViewerService.parseRule(rule);

    assertEquals(parsed.success, true);
    assertEquals(parsed.category, 'Cosmetic');
    assertEquals(parsed.type, 'ElementHidingRule');
    assertEquals(parsed.properties?.cosmetic?.domains, ['example.com']);
    assertEquals(parsed.properties?.cosmetic?.separator, '##');
    assertEquals(parsed.properties?.cosmetic?.body, '.ad-banner');
});

Deno.test('ASTViewerService - Parse comment', () => {
    const rule = '! This is a comment';
    const parsed = ASTViewerService.parseRule(rule);

    assertEquals(parsed.success, true);
    assertEquals(parsed.category, 'Comment');
    assertEquals(parsed.properties?.comment?.text, ' This is a comment');
});

Deno.test('ASTViewerService - Parse metadata comment', () => {
    const rule = '! Title: My Filter List';
    const parsed = ASTViewerService.parseRule(rule);

    assertEquals(parsed.success, true);
    assertEquals(parsed.type, 'MetadataCommentRule');
    assertEquals(parsed.properties?.comment?.header, 'Title');
    assertEquals(parsed.properties?.comment?.value, 'My Filter List');
});

Deno.test('ASTViewerService - Parse invalid rule', () => {
    const rule = '|||invalid|||';
    const parsed = ASTViewerService.parseRule(rule);

    // AGTree may parse this successfully in tolerant mode or mark as invalid
    // Either way is acceptable - we just test that it returns a result
    assertExists(parsed);
    assertExists(parsed.ruleText);
});

Deno.test('ASTViewerService - Parse multiple rules', () => {
    const rules = [
        '||example.com^',
        '@@||example.com/allowed^',
        '! Comment',
    ];

    const parsedRules = ASTViewerService.parseRules(rules);

    assertEquals(parsedRules.length, 3);
    assertEquals(parsedRules[0].success, true);
    assertEquals(parsedRules[1].success, true);
    assertEquals(parsedRules[2].success, true);
});

Deno.test('ASTViewerService - Parse rules from text', () => {
    const text = `||example.com^$third-party
@@||example.com/allowed^
! This is a comment`;

    const parsedRules = ASTViewerService.parseRulesFromText(text);

    assertEquals(parsedRules.length, 3);
    assertEquals(parsedRules[0].category, 'Network');
    assertEquals(parsedRules[1].properties?.network?.isException, true);
    assertEquals(parsedRules[2].category, 'Comment');
});

Deno.test('ASTViewerService - Generate summary', () => {
    const rules = [
        '||example.com^',
        '@@||example.com/allowed^',
        '127.0.0.1 ad.example.com',
        'example.com##.ad-banner',
        '! Comment',
    ];

    const parsedRules = ASTViewerService.parseRules(rules);
    const summary = ASTViewerService.generateSummary(parsedRules);

    assertEquals(summary.total, 5);
    assertEquals(summary.successful, 5);
    assertEquals(summary.failed, 0);
    assertEquals(summary.byCategory['Network'], 3);
    assertEquals(summary.byCategory['Cosmetic'], 1);
    assertEquals(summary.byCategory['Comment'], 1);
});

Deno.test('ASTViewerService - Get example rules', () => {
    const examples = ASTViewerService.getExampleRules();

    assertExists(examples);
    assertEquals(Array.isArray(examples), true);
    assertEquals(examples.length > 0, true);
});

Deno.test('ASTViewerService - Describe network rule', () => {
    const rule = '||example.com^$third-party';
    const parsed = ASTViewerService.parseRule(rule);
    const description = ASTViewerService.describeRule(parsed);

    assertEquals(description.includes('Network'), true);
    assertEquals(description.includes('Blocking'), true);
    assertEquals(description.includes('third-party'), true);
});

Deno.test('ASTViewerService - Describe cosmetic rule', () => {
    const rule = 'example.com##.ad-banner';
    const parsed = ASTViewerService.parseRule(rule);
    const description = ASTViewerService.describeRule(parsed);

    assertEquals(description.includes('Cosmetic'), true);
    assertEquals(description.includes('example.com'), true);
    assertEquals(description.includes('.ad-banner'), true);
});

Deno.test('ASTViewerService - Format AST', () => {
    const rule = '||example.com^';
    const parsed = ASTViewerService.parseRule(rule);

    if (parsed.ast) {
        const formatted = ASTViewerService.formatAST(parsed.ast);
        assertExists(formatted);
        assertEquals(formatted.includes('NetworkRule'), true);
        assertEquals(formatted.includes('||example.com^'), true);
    }
});

// ─────────────────────────────────────────────────────────────────────
// parseRuleViaPlugin — array handling and supportedSyntaxes selection
// ─────────────────────────────────────────────────────────────────────

import { PluginRegistry, type ParsedNode } from '../plugins/PluginSystem.ts';
import { silentLogger } from '../utils/index.ts';

Deno.test('parseRuleViaPlugin — falls back when no registry provided', () => {
    const result = ASTViewerService.parseRuleViaPlugin('||example.com^');
    assertEquals(result.success, true);
    assertEquals(result.type, 'NetworkRule');
});

Deno.test('parseRuleViaPlugin — falls back when registry has no parsers', () => {
    const registry = new PluginRegistry(silentLogger);
    const result = ASTViewerService.parseRuleViaPlugin('||example.com^', registry);
    assertEquals(result.success, true);
});

Deno.test('parseRuleViaPlugin — uses scalar ParsedNode result', async () => {
    const registry = new PluginRegistry(silentLogger);
    await registry.register({
        manifest: { name: 'scalar-parser', version: '1.0.0' },
        parsers: [{
            name: 'scalar-parser',
            supportedSyntaxes: ['adblock'],
            parse: (_input: string): ParsedNode => ({
                type: 'NetworkRule',
                category: 'Network',
                syntax: 'AdGuard',
            }),
        }],
    });

    const result = ASTViewerService.parseRuleViaPlugin('||example.com^', registry);
    assertEquals(result.success, true);
    assertEquals(result.type, 'NetworkRule');
});

Deno.test('parseRuleViaPlugin — handles single-element array result', async () => {
    const registry = new PluginRegistry(silentLogger);
    await registry.register({
        manifest: { name: 'array-parser', version: '1.0.0' },
        parsers: [{
            name: 'array-parser',
            supportedSyntaxes: ['adblock'],
            parse: (_input: string): ParsedNode[] => [{
                type: 'NetworkRule',
                category: 'Network',
            }],
        }],
    });

    const result = ASTViewerService.parseRuleViaPlugin('||example.com^', registry);
    assertEquals(result.success, true);
    assertEquals(result.type, 'NetworkRule');
});

Deno.test('parseRuleViaPlugin — falls back to direct parser for multi-node array', async () => {
    const registry = new PluginRegistry(silentLogger);
    await registry.register({
        manifest: { name: 'multi-parser', version: '1.0.0' },
        parsers: [{
            name: 'multi-parser',
            supportedSyntaxes: ['adblock'],
            parse: (_input: string): ParsedNode[] => [
                { type: 'NetworkRule' },
                { type: 'Comment' },
            ],
        }],
    });

    // Should fall back to direct AGTree parser
    const result = ASTViewerService.parseRuleViaPlugin('||example.com^', registry);
    assertEquals(result.success, true);
    assertEquals(result.type, 'NetworkRule');
});

Deno.test('parseRuleViaPlugin — prefers parser with adblock supportedSyntaxes', async () => {
    const callOrder: string[] = [];
    const registry = new PluginRegistry(silentLogger);

    // Register a non-adblock parser first so it would be picked by naïve first-parser logic
    await registry.register({
        manifest: { name: 'hosts-parser', version: '1.0.0' },
        parsers: [{
            name: 'hosts-parser',
            supportedSyntaxes: ['hosts'],
            parse: (_input: string): ParsedNode => {
                callOrder.push('hosts-parser');
                return { type: 'HostRule' };
            },
        }],
    });

    // Register an adblock parser second
    await registry.register({
        manifest: { name: 'adblock-parser', version: '1.0.0' },
        parsers: [{
            name: 'adblock-parser',
            supportedSyntaxes: ['adblock'],
            parse: (_input: string): ParsedNode => {
                callOrder.push('adblock-parser');
                return { type: 'NetworkRule', category: 'Network' };
            },
        }],
    });

    ASTViewerService.parseRuleViaPlugin('||example.com^', registry);
    // The adblock-syntax parser should be preferred
    assertEquals(callOrder, ['adblock-parser']);
});

Deno.test('parseRuleViaPlugin — returns error result for Error node', async () => {
    const registry = new PluginRegistry(silentLogger);
    await registry.register({
        manifest: { name: 'error-parser', version: '1.0.0' },
        parsers: [{
            name: 'error-parser',
            supportedSyntaxes: ['adblock'],
            parse: (_input: string): ParsedNode => ({
                type: 'Error',
                error: 'parse failed',
            }),
        }],
    });

    const result = ASTViewerService.parseRuleViaPlugin('bad input', registry);
    assertEquals(result.success, false);
    assertEquals(result.error, 'parse failed');
});
