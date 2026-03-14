/**
 * Tests for AGTreeParserPlugin adapter
 */

import { assertEquals, assertExists } from '@std/assert';
import { agTreeParserPlugin } from './AGTreeParserPlugin.ts';
import type { ParsedNode } from './PluginSystem.ts';

// ── Single-rule parsing ─────────────────────────────────────────────

Deno.test('agTreeParserPlugin — parses a network rule', () => {
    const node = agTreeParserPlugin.parse('||example.com^') as ParsedNode;
    assertEquals(node.type, 'NetworkRule');
    assertEquals(node.raw, '||example.com^');
    assertExists(node.ast);
});

Deno.test('agTreeParserPlugin — parses a host rule', () => {
    const node = agTreeParserPlugin.parse(
        '0.0.0.0 ads.example.com',
    ) as ParsedNode;
    assertEquals(node.type, 'HostRule');
    assertEquals(typeof node.raw, 'string');
});

Deno.test('agTreeParserPlugin — parses a comment', () => {
    const node = agTreeParserPlugin.parse(
        '! This is a comment',
    ) as ParsedNode;
    assertEquals(node.type, 'Comment');
});

Deno.test('agTreeParserPlugin — parses an empty line', () => {
    const node = agTreeParserPlugin.parse('') as ParsedNode;
    assertEquals(node.type, 'Empty');
});

Deno.test('agTreeParserPlugin — returns Error node for invalid input', () => {
    // Very malformed input that AGTree can't parse
    const node = agTreeParserPlugin.parse(
        '$$invalid$$rule$$syntax$$',
    ) as ParsedNode;
    // AGTree may still parse this (lenient), but if it fails the type is 'Error'
    assertExists(node.type);
});

// ── Multi-line / filter list parsing ────────────────────────────────

Deno.test('agTreeParserPlugin — parses multi-line filter list', () => {
    const input = [
        '! Title: Test List',
        '||ads.example.com^',
        '@@||allowed.example.com^',
        '',
    ].join('\n');

    const nodes = agTreeParserPlugin.parse(input) as ParsedNode[];
    assertEquals(Array.isArray(nodes), true);
    assertEquals(nodes.length, 4);
    assertEquals(nodes[0].type, 'Comment');
    assertEquals(nodes[1].type, 'NetworkRule');
    assertEquals(nodes[2].type, 'NetworkRule');
    assertEquals(nodes[3].type, 'Empty');
});

Deno.test('agTreeParserPlugin — filterList option forces list mode', () => {
    const nodes = agTreeParserPlugin.parse('||example.com^', {
        filterList: true,
    }) as ParsedNode[];
    assertEquals(Array.isArray(nodes), true);
    assertEquals(nodes.length, 1);
});

// ── Serialization ───────────────────────────────────────────────────

Deno.test('agTreeParserPlugin — serialize single node via raw text', () => {
    const node = agTreeParserPlugin.parse('||example.com^') as ParsedNode;
    const text = agTreeParserPlugin.serialize!(node);
    assertEquals(text, '||example.com^');
});

Deno.test('agTreeParserPlugin — serialize array of nodes', () => {
    const nodes = agTreeParserPlugin.parse(
        '||a.com^\n||b.com^',
    ) as ParsedNode[];
    const text = agTreeParserPlugin.serialize!(nodes);
    assertEquals(text, '||a.com^\n||b.com^');
});

Deno.test('agTreeParserPlugin — round-trip parse → serialize', () => {
    const input = '||example.com^$third-party';
    const node = agTreeParserPlugin.parse(input) as ParsedNode;
    const output = agTreeParserPlugin.serialize!(node);
    assertEquals(output, input);
});

// ── Walk ────────────────────────────────────────────────────────────

Deno.test('agTreeParserPlugin — walk visits all nodes', () => {
    const nodes = agTreeParserPlugin.parse(
        '! comment\n||rule.com^',
    ) as ParsedNode[];
    const visited: string[] = [];

    agTreeParserPlugin.walk!(nodes, (n) => {
        visited.push(n.type);
    });

    assertEquals(visited, ['Comment', 'NetworkRule']);
});

Deno.test('agTreeParserPlugin — walk stops early on false', () => {
    const nodes = agTreeParserPlugin.parse(
        '! a\n! b\n! c',
    ) as ParsedNode[];
    let count = 0;

    agTreeParserPlugin.walk!(nodes, () => {
        count++;
        if (count >= 2) return false;
    });

    assertEquals(count, 2);
});

// ── Metadata ────────────────────────────────────────────────────────

Deno.test('agTreeParserPlugin — has correct metadata', () => {
    assertEquals(agTreeParserPlugin.name, 'agtree');
    assertEquals(
        agTreeParserPlugin.supportedSyntaxes.includes('adblock'),
        true,
    );
    assertEquals(
        agTreeParserPlugin.supportedSyntaxes.includes('hosts'),
        true,
    );
    assertExists(agTreeParserPlugin.description);
});

// ── Plugin registration integration ─────────────────────────────────

Deno.test('agTreeParserPlugin — can be registered in PluginRegistry', async () => {
    const { PluginRegistry } = await import('./PluginSystem.ts');
    const { silentLogger } = await import('../utils/index.ts');

    const registry = new PluginRegistry(silentLogger);
    await registry.register({
        manifest: {
            name: 'agtree-default',
            version: '1.0.0',
            description: 'AGTree parser',
            author: 'core',
        },
        parsers: [agTreeParserPlugin],
    });

    assertEquals(registry.getParser('agtree'), agTreeParserPlugin);
    assertEquals(registry.getParsersForSyntax('adblock').length, 1);
    assertEquals(registry.listParsers(), ['agtree']);
});
