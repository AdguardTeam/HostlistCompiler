/**
 * AGTree Parser Plugin Adapter
 *
 * Bridges the existing {@link AGTreeParser} utility to the plugin system's
 * {@link ParserPlugin} interface, making AGTree the default rule-parsing
 * backend for all plugin consumers.
 *
 * @module
 */

import { AGTreeParser, type AnyRule, RuleCategory } from '../utils/AGTreeParser.ts';
import { RuleGenerator } from '@adguard/agtree';
import type { ParsedNode, ParserPlugin } from './PluginSystem.ts';

/**
 * Maps an AGTree `AnyRule` AST node to the generic {@link ParsedNode}
 * interface used by the plugin system.
 */
function ruleToNode(rule: AnyRule, ruleText?: string): ParsedNode {
    const type = ruleTypeLabel(rule);
    return {
        type,
        category: rule.category,
        syntax: rule.syntax,
        raw: ruleText ?? rule.raws?.text ?? RuleGenerator.generate(rule),
        ast: rule,
    };
}

/** Derive a human-readable type string from the AGTree rule category. */
function ruleTypeLabel(rule: AnyRule): string {
    switch (rule.category) {
        case RuleCategory.Network:
            return rule.type === 'NetworkRule' ? 'NetworkRule' : 'HostRule';
        case RuleCategory.Cosmetic:
            return `CosmeticRule`;
        case RuleCategory.Comment:
            return `Comment`;
        case RuleCategory.Empty:
            return 'Empty';
        default:
            return rule.type ?? 'Unknown';
    }
}

/**
 * Supported adblock syntax dialects recognised by AGTree.
 */
const SUPPORTED_SYNTAXES = [
    'adblock',
    'adguard',
    'ublock',
    'abp',
    'hosts',
] as const;

/**
 * AGTree-backed implementation of {@link ParserPlugin}.
 *
 * @example
 * ```ts
 * import { agTreeParserPlugin } from './plugins/AGTreeParserPlugin.ts';
 * import { PluginRegistry } from './plugins/PluginSystem.ts';
 *
 * const registry = new PluginRegistry();
 * await registry.register({
 *     manifest: { name: 'agtree', version: '1.0.0', description: 'AGTree parser', author: 'core' },
 *     parsers: [agTreeParserPlugin],
 * });
 * ```
 */
export const agTreeParserPlugin: ParserPlugin = {
    name: 'agtree',
    description: 'Default adblock rule parser backed by @adguard/agtree. ' +
        'Supports AdGuard, uBlock Origin, ABP, and hosts syntaxes.',
    supportedSyntaxes: [...SUPPORTED_SYNTAXES],

    /**
     * Parse a single rule or an entire filter list.
     *
     * - Single-line input → returns a single {@link ParsedNode}
     * - Multi-line input  → returns an array of {@link ParsedNode}
     */
    parse(
        input: string,
        options?: Record<string, unknown>,
    ): ParsedNode | ParsedNode[] {
        const lines = input.split('\n');
        const isMultiLine = lines.length > 1 ||
            options?.filterList === true;

        if (isMultiLine) {
            const filterList = AGTreeParser.parseFilterList(
                input,
                options as Record<string, unknown> | undefined,
            );
            return filterList.children.map((rule) => ruleToNode(rule));
        }

        // Single rule
        const result = AGTreeParser.parse(input.trim());
        if (!result.success || !result.ast) {
            return {
                type: 'Error',
                raw: input,
                error: result.error ?? 'Parse failed',
            };
        }
        return ruleToNode(result.ast, input.trim());
    },

    /**
     * Serialize a {@link ParsedNode} (or array) back to text.
     * Uses the original raw text when available, falling back to
     * `RuleGenerator.generate()`.
     */
    serialize(node: ParsedNode | ParsedNode[]): string {
        const nodes = Array.isArray(node) ? node : [node];
        return nodes
            .map((n) => {
                if (typeof n.raw === 'string') return n.raw;
                if (n.ast) return RuleGenerator.generate(n.ast as AnyRule);
                return '';
            })
            .join('\n');
    },

    /**
     * Walk over node(s), calling `visitor` for each. Return `false`
     * from visitor to stop early.
     */
    walk(
        node: ParsedNode | ParsedNode[],
        visitor: (node: ParsedNode) => void | boolean,
    ): void {
        const nodes = Array.isArray(node) ? node : [node];
        for (const n of nodes) {
            const result = visitor(n);
            if (result === false) return;
        }
    },
};
