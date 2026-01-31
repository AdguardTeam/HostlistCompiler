/**
 * Rule Utilities - AGTree-based Implementation
 *
 * This module provides utilities for working with adblock filter rules,
 * leveraging @adguard/agtree for robust parsing and validation.
 */

import { IAdblockRule, IAdblockRuleTokens, IEtcHostsRule, IRuleModifier } from '../types/index.ts';
import { AGTreeParser, type AnyRule, type HostRule, type NetworkRule, NetworkRuleType, RuleCategory } from './AGTreeParser.ts';

/**
 * Converts a domain to ASCII (Punycode) representation.
 * Uses the native URL API which handles IDN conversion.
 */
function domainToASCII(domain: string): string {
    try {
        const url = new URL(`http://${domain}`);
        return url.hostname;
    } catch {
        return domain;
    }
}

// Regular expressions for rule parsing
const DOMAIN_REGEX = /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/;
const DOMAIN_PATTERN_REGEX = /(\*\.|)([^\s^$|=]+(?:\.[^\s^$|=]+)+)/g;
// deno-lint-ignore no-control-regex
const NON_ASCII_REGEX = /[^\x00-\x7F]/;

/**
 * Utility class for working with filtering rules.
 * Uses AGTree for robust parsing and validation.
 */
export class RuleUtils {
    /**
     * Checks if the rule is a comment using AGTree.
     */
    public static isComment(ruleText: string): boolean {
        const result = AGTreeParser.parse(ruleText);
        if (result.success && result.ast) {
            return AGTreeParser.isComment(result.ast);
        }
        // Fallback for unparseable rules
        return ruleText.startsWith('!') ||
            ruleText.startsWith('# ') ||
            ruleText === '#' ||
            ruleText.startsWith('####');
    }

    /**
     * Checks if the rule is an allowing/exception rule using AGTree.
     */
    public static isAllowRule(ruleText: string): boolean {
        const result = AGTreeParser.parse(ruleText);
        if (result.success && result.ast) {
            return AGTreeParser.isExceptionRule(result.ast);
        }
        return ruleText.startsWith('@@');
    }

    /**
     * Checks if the rule is just a domain name.
     */
    public static isJustDomain(ruleText: string): boolean {
        return ruleText.includes('.') && DOMAIN_REGEX.test(ruleText);
    }

    /**
     * Checks if the rule is a /etc/hosts format rule using AGTree.
     */
    public static isEtcHostsRule(ruleText: string): boolean {
        const result = AGTreeParser.parse(ruleText);
        if (result.success && result.ast) {
            return AGTreeParser.isHostRule(result.ast);
        }
        return false;
    }

    /**
     * Checks if the rule contains non-ASCII characters.
     */
    public static containsNonAsciiCharacters(ruleText: string): boolean {
        return NON_ASCII_REGEX.test(ruleText);
    }

    /**
     * Converts non-ASCII domain names to Punycode.
     */
    public static convertNonAsciiToPunycode(line: string): string {
        return line.replace(DOMAIN_PATTERN_REGEX, (match, wildcard: string, domain: string) => {
            if (RuleUtils.containsNonAsciiCharacters(domain)) {
                const punycodeDomain = domainToASCII(domain);
                return wildcard + punycodeDomain;
            }
            return match;
        });
    }

    /**
     * Parses a rule text into tokens using AGTree.
     */
    public static parseRuleTokens(ruleText: string): IAdblockRuleTokens {
        const result = AGTreeParser.parse(ruleText.trim());

        if (result.success && result.ast && AGTreeParser.isNetworkRule(result.ast)) {
            const networkRule = result.ast as NetworkRule;
            const props = AGTreeParser.extractNetworkRuleProperties(networkRule);

            // Build options string from modifiers
            let options: string | null = null;
            if (props.modifiers.length > 0) {
                options = props.modifiers.map((mod) => {
                    if (mod.value) {
                        return `${mod.exception ? '~' : ''}${mod.name}=${mod.value}`;
                    }
                    return `${mod.exception ? '~' : ''}${mod.name}`;
                }).join(',');
            }

            return {
                pattern: props.pattern,
                options,
                whitelist: props.isException,
            };
        }

        // Return empty tokens for non-network rules
        return {
            pattern: ruleText,
            options: null,
            whitelist: ruleText.startsWith('@@'),
        };
    }

    /**
     * Extracts hostname from an adblock rule pattern using AGTree.
     */
    public static extractHostname(pattern: string): string | null {
        // Try parsing as a complete rule
        const result = AGTreeParser.parse(pattern);
        if (result.success && result.ast && AGTreeParser.isNetworkRule(result.ast)) {
            const networkRule = result.ast as NetworkRule;
            const props = AGTreeParser.extractNetworkRuleProperties(networkRule);
            // Check if pattern matches ||domain^ format
            const match = props.pattern.match(/^\|\|([a-z0-9-.]+)\^?$/);
            return match ? match[1] : null;
        }
        // Fallback to regex extraction
        const match = pattern.match(/^\|\|([a-z0-9-.]+)\^$/);
        return match ? match[1] : null;
    }

    /**
     * Parses a /etc/hosts rule using AGTree.
     */
    public static loadEtcHostsRuleProperties(ruleText: string): IEtcHostsRule {
        const result = AGTreeParser.parse(ruleText.trim());

        if (result.success && result.ast && AGTreeParser.isHostRule(result.ast)) {
            const hostRule = result.ast as HostRule;
            const props = AGTreeParser.extractHostRuleProperties(hostRule);

            return {
                ruleText,
                hostnames: props.hostnames,
            };
        }

        throw new TypeError(`Invalid /etc/hosts rule: ${ruleText}`);
    }

    /**
     * Parses an adblock-style rule using AGTree.
     */
    public static loadAdblockRuleProperties(ruleText: string): IAdblockRule {
        const result = AGTreeParser.parse(ruleText.trim());

        if (result.success && result.ast && AGTreeParser.isNetworkRule(result.ast)) {
            const networkRule = result.ast as NetworkRule;
            const props = AGTreeParser.extractNetworkRuleProperties(networkRule);

            // Convert AGTree modifiers to IRuleModifier format
            const options: IRuleModifier[] | null = props.modifiers.length > 0
                ? props.modifiers.map((mod) => ({
                    name: mod.exception ? `~${mod.name}` : mod.name,
                    value: mod.value,
                }))
                : null;

            // Extract hostname from pattern
            const hostnameMatch = props.pattern.match(/^\|\|([a-z0-9-.]+)\^?$/);
            const hostname = hostnameMatch ? hostnameMatch[1] : null;

            return {
                ruleText,
                pattern: props.pattern,
                whitelist: props.isException,
                options,
                hostname,
            };
        }

        // Fallback for rules that don't parse as network rules
        const isWhitelist = ruleText.startsWith('@@');
        const pattern = isWhitelist ? ruleText.slice(2) : ruleText;

        return {
            ruleText,
            pattern,
            whitelist: isWhitelist,
            options: null,
            hostname: null,
        };
    }

    /**
     * Finds a modifier by name in the rule's options.
     */
    public static findModifier(
        ruleProps: IAdblockRule,
        name: string,
    ): IRuleModifier | null {
        if (!ruleProps.options) {
            return null;
        }

        for (const option of ruleProps.options) {
            if (option.name === name || option.name === `~${name}`) {
                return option;
            }
        }

        return null;
    }

    /**
     * Removes a modifier by name from the rule's options.
     */
    public static removeModifier(ruleProps: IAdblockRule, name: string): boolean {
        if (!ruleProps.options) {
            return false;
        }

        let found = false;
        for (let i = ruleProps.options.length - 1; i >= 0; i -= 1) {
            const option = ruleProps.options[i];
            if (option.name === name || option.name === `~${name}`) {
                ruleProps.options.splice(i, 1);
                found = true;
            }
        }

        return found;
    }

    /**
     * Converts an AdblockRule back to string representation.
     */
    public static adblockRuleToString(ruleProps: IAdblockRule): string {
        let ruleText = '';

        if (ruleProps.whitelist) {
            ruleText = '@@';
        }

        ruleText += ruleProps.pattern;

        if (ruleProps.options && ruleProps.options.length > 0) {
            ruleText += '$';

            for (let i = 0; i < ruleProps.options.length; i += 1) {
                const option = ruleProps.options[i];
                ruleText += option.name;

                if (option.value) {
                    ruleText += '=';
                    ruleText += option.value;
                }

                if (i < ruleProps.options.length - 1) {
                    ruleText += ',';
                }
            }
        }

        return ruleText;
    }

    // =========================================================================
    // New AGTree-powered methods
    // =========================================================================

    /**
     * Parse a rule and return the AST node.
     */
    public static parseToAST(ruleText: string): AnyRule | null {
        const result = AGTreeParser.parse(ruleText);
        return result.success ? result.ast : null;
    }

    /**
     * Check if a rule is valid (parseable without errors).
     */
    public static isValidRule(ruleText: string): boolean {
        const result = AGTreeParser.parse(ruleText);
        return result.success;
    }

    /**
     * Check if a rule is a network rule.
     */
    public static isNetworkRule(ruleText: string): boolean {
        const result = AGTreeParser.parse(ruleText);
        if (result.success && result.ast) {
            return result.ast.category === RuleCategory.Network &&
                result.ast.type === NetworkRuleType.NetworkRule;
        }
        return false;
    }

    /**
     * Check if a rule is a cosmetic rule.
     */
    public static isCosmeticRule(ruleText: string): boolean {
        const result = AGTreeParser.parse(ruleText);
        if (result.success && result.ast) {
            return AGTreeParser.isCosmeticRule(result.ast);
        }
        return false;
    }

    /**
     * Check if a rule is empty or whitespace only.
     */
    public static isEmpty(ruleText: string): boolean {
        const trimmed = ruleText.trim();
        if (trimmed === '') return true;

        const result = AGTreeParser.parse(trimmed);
        if (result.success && result.ast) {
            return AGTreeParser.isEmpty(result.ast);
        }
        return false;
    }

    /**
     * Get the syntax type of a rule (AdGuard, uBlock Origin, ABP, Common).
     */
    public static detectSyntax(ruleText: string): string {
        return AGTreeParser.detectSyntax(ruleText);
    }
}
