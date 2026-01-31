/**
 * AST Viewer Service
 *
 * Provides functionality to parse adblock rules and generate structured
 * AST representations for display and analysis.
 */

import { AGTreeParser } from '../utils/AGTreeParser.ts';
import type { AnyRule } from '../utils/AGTreeParser.ts';

/**
 * Parsed rule with display-friendly information.
 */
export interface ParsedRuleInfo {
    /** Original rule text */
    ruleText: string;
    /** Whether parsing was successful */
    success: boolean;
    /** Error message if parsing failed */
    error?: string;
    /** Rule category (Network, Cosmetic, Comment, etc.) */
    category?: string;
    /** Rule type (NetworkRule, HostRule, etc.) */
    type?: string;
    /** Detected syntax (Common, AdGuard, uBlock, etc.) */
    syntax?: string;
    /** Whether the rule is valid */
    valid?: boolean;
    /** Type-specific properties */
    properties?: RuleProperties;
    /** Full AST as JSON */
    ast?: AnyRule;
}

/**
 * Type-specific rule properties.
 */
export interface RuleProperties {
    /** Network rule properties */
    network?: {
        pattern: string;
        isException: boolean;
        modifiers: Array<{
            name: string;
            value: string | null;
            exception: boolean;
        }>;
    };
    /** Host rule properties */
    host?: {
        ip: string;
        hostnames: string[];
        comment: string | null;
    };
    /** Cosmetic rule properties */
    cosmetic?: {
        domains: string[];
        separator: string;
        isException: boolean;
        body: string;
        ruleType: string;
    };
    /** Comment rule properties */
    comment?: {
        text: string;
        header?: string;
        value?: string;
    };
}

/**
 * Summary of parsed rules.
 */
export interface RuleSummary {
    total: number;
    successful: number;
    failed: number;
    byCategory: Record<string, number>;
    byType: Record<string, number>;
}

/**
 * AST Viewer Service for parsing and analyzing adblock rules.
 */
export class ASTViewerService {
    /**
     * Parse a single rule and return display-friendly information.
     */
    static parseRule(ruleText: string): ParsedRuleInfo {
        const result = AGTreeParser.parse(ruleText);

        if (!result.success || !result.ast) {
            return {
                ruleText,
                success: false,
                error: result.error || 'Failed to parse rule',
            };
        }

        const ast = result.ast;

        // Initialize properties object
        const properties: RuleProperties = {};

        // Extract type-specific properties
        if (AGTreeParser.isNetworkRule(ast)) {
            const props = AGTreeParser.extractNetworkRuleProperties(ast);
            properties.network = {
                pattern: props.pattern,
                isException: props.isException,
                modifiers: props.modifiers,
            };
        } else if (AGTreeParser.isHostRule(ast)) {
            const props = AGTreeParser.extractHostRuleProperties(ast);
            properties.host = {
                ip: props.ip,
                hostnames: props.hostnames,
                comment: props.comment,
            };
        } else if (AGTreeParser.isCosmeticRule(ast)) {
            const props = AGTreeParser.extractCosmeticRuleProperties(ast);
            properties.cosmetic = {
                domains: props.domains,
                separator: props.separator,
                isException: props.isException,
                body: props.body,
                ruleType: props.type,
            };
        } else if (AGTreeParser.isComment(ast)) {
            properties.comment = {
                text: 'text' in ast && ast.text && typeof ast.text === 'object' && 'value' in ast.text ? String(ast.text.value) : '',
            };

            if (AGTreeParser.isMetadataComment(ast)) {
                // We know comment exists because we just created it above
                if (properties.comment) {
                    properties.comment.header = ast.header?.value;
                    properties.comment.value = ast.value?.value;
                }
            }
        }

        const info: ParsedRuleInfo = {
            ruleText,
            success: true,
            category: ast.category,
            type: ast.type,
            syntax: ast.syntax,
            valid: AGTreeParser.isValid(ast),
            properties,
            ast,
        };

        return info;
    }

    /**
     * Parse multiple rules.
     */
    static parseRules(rules: string[]): ParsedRuleInfo[] {
        return rules.map((rule) => this.parseRule(rule));
    }

    /**
     * Parse rules from a multi-line string.
     */
    static parseRulesFromText(text: string): ParsedRuleInfo[] {
        const lines = text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        return this.parseRules(lines);
    }

    /**
     * Get example rules for demonstration.
     */
    static getExampleRules(): string[] {
        return [
            '||example.com^$third-party',
            '@@||example.com/allowed^',
            '127.0.0.1 ad.example.com',
            'example.com##.ad-banner',
            'example.com##+js(abort-on-property-read, ads)',
            '! This is a comment',
            '! Title: My Filter List',
            '! Description: Example filter list',
            'example.com,~subdomain.example.com##.selector',
            '||ads.example.com^$script,domain=example.com|example.org',
            '0.0.0.0 tracking.example.com',
            'example.com#@#.ad-banner',
            '||example.com^$important,third-party',
        ];
    }

    /**
     * Generate a summary of parsed rules.
     */
    static generateSummary(parsedRules: ParsedRuleInfo[]): RuleSummary {
        const summary: RuleSummary = {
            total: parsedRules.length,
            successful: 0,
            failed: 0,
            byCategory: {},
            byType: {},
        };

        for (const rule of parsedRules) {
            if (rule.success) {
                summary.successful++;

                // Count by category
                if (rule.category) {
                    summary.byCategory[rule.category] = (summary.byCategory[rule.category] || 0) + 1;
                }

                // Count by type
                if (rule.type) {
                    summary.byType[rule.type] = (summary.byType[rule.type] || 0) + 1;
                }
            } else {
                summary.failed++;
            }
        }

        return summary;
    }

    /**
     * Format AST as pretty-printed JSON.
     */
    static formatAST(ast: AnyRule, indent: number = 2): string {
        return JSON.stringify(ast, null, indent);
    }

    /**
     * Get a human-readable description of a rule.
     */
    static describeRule(info: ParsedRuleInfo): string {
        if (!info.success) {
            return `Invalid rule: ${info.error}`;
        }

        const parts: string[] = [];

        // Category and type
        parts.push(`${info.category} / ${info.type}`);

        // Type-specific description
        if (info.properties?.network) {
            const { pattern, isException, modifiers } = info.properties.network;
            parts.push(isException ? '(Exception/Allowlist)' : '(Blocking)');
            parts.push(`Pattern: ${pattern}`);
            if (modifiers.length > 0) {
                parts.push(`Modifiers: ${modifiers.map((m) => m.name).join(', ')}`);
            }
        } else if (info.properties?.host) {
            const { ip, hostnames } = info.properties.host;
            parts.push(`IP: ${ip}`);
            parts.push(`Hosts: ${hostnames.join(', ')}`);
        } else if (info.properties?.cosmetic) {
            const { domains, isException, body } = info.properties.cosmetic;
            parts.push(isException ? '(Exception)' : '(Hiding)');
            parts.push(`Domains: ${domains.join(', ') || 'All'}`);
            parts.push(`Selector: ${body}`);
        } else if (info.properties?.comment) {
            const { header, value, text } = info.properties.comment;
            if (header && value) {
                parts.push(`${header}: ${value}`);
            } else {
                parts.push(text);
            }
        }

        return parts.join(' | ');
    }
}
