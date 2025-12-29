// Deno-compatible version of RuleUtils
// Uses native URL API instead of Node.js 'url' module

import {
    IAdblockRule,
    IAdblockRuleTokens,
    IEtcHostsRule,
    IRuleModifier,
} from '../types/index.ts';
import { StringUtils } from './StringUtils.ts';

// Regular expressions for rule parsing
const DOMAIN_REGEX = /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/;
const ETC_HOSTS_REGEX = /^([a-f0-9.:\][]+)(%[a-z0-9]+)?\s+([^#]+)(#.*)?$/;
const DOMAIN_PATTERN_REGEX = /(\*\.|)([^\s^$|=]+(?:\.[^\s^$|=]+)+)/g;
// eslint-disable-next-line no-control-regex
const NON_ASCII_REGEX = /[^\x00-\x7F]/;

/**
 * Converts a domain name to ASCII/Punycode using native URL API
 * This is the Deno-compatible replacement for Node.js's domainToASCII
 */
function domainToASCII(domain: string): string {
    try {
        // Use URL constructor to handle punycode conversion
        // We need to wrap the domain in a URL to use the native conversion
        const url = new URL(`http://${domain}`);
        return url.hostname;
    } catch {
        // If URL parsing fails, return the original domain
        return domain;
    }
}

/**
 * Utility class for working with filtering rules.
 * Provides static methods for parsing and manipulating both
 * adblock-style and /etc/hosts rules.
 */
export class RuleUtils {
    /**
     * Checks if the rule is a comment.
     * Comments start with ! or # (with space or ####)
     */
    public static isComment(ruleText: string): boolean {
        return ruleText.startsWith('!')
            || ruleText.startsWith('# ')
            || ruleText === '#'
            || ruleText.startsWith('####');
    }

    /**
     * Checks if the rule is an allowing/exception rule.
     * Allow rules start with @@
     */
    public static isAllowRule(ruleText: string): boolean {
        return ruleText.startsWith('@@');
    }

    /**
     * Checks if the rule is just a domain name.
     */
    public static isJustDomain(ruleText: string): boolean {
        return ruleText.includes('.') && DOMAIN_REGEX.test(ruleText);
    }

    /**
     * Checks if the rule contains non-ASCII characters.
     */
    public static containsNonAsciiCharacters(ruleText: string): boolean {
        return NON_ASCII_REGEX.test(ruleText);
    }

    /**
     * Converts non-ASCII domain names to Punycode.
     * Handles wildcards and preserves other parts of the rule.
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

    // Note: The rest of the RuleUtils methods would continue here
    // For a full migration, copy all remaining methods from the original file
}
