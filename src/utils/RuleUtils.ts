import {
    IAdblockRule,
    IAdblockRuleTokens,
    IEtcHostsRule,
    IRuleModifier,
} from '../types/index.ts';
import { StringUtils } from './StringUtils.ts';

/**
 * Converts a domain to ASCII (Punycode) representation.
 * Uses the native URL API which handles IDN conversion.
 * @param domain - Domain name to convert
 * @returns ASCII representation of the domain
 */
function domainToASCII(domain: string): string {
    try {
        // Use URL constructor which automatically converts IDN to Punycode
        const url = new URL(`http://${domain}`);
        return url.hostname;
    } catch {
        // If URL parsing fails, return the original domain
        return domain;
    }
}

// Regular expressions for rule parsing
const DOMAIN_REGEX = /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/;
const ETC_HOSTS_REGEX = /^([a-f0-9.:\][]+)(%[a-z0-9]+)?\s+([^#]+)(#.*)?$/;
const DOMAIN_PATTERN_REGEX = /(\*\.|)([^\s^$|=]+(?:\.[^\s^$|=]+)+)/g;
// eslint-disable-next-line no-control-regex
const NON_ASCII_REGEX = /[^\x00-\x7F]/;

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
     * Checks if the rule is a /etc/hosts format rule.
     */
    public static isEtcHostsRule(ruleText: string): boolean {
        return ETC_HOSTS_REGEX.test(ruleText);
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

    /**
     * Parses a rule text into tokens (pattern, options, whitelist flag).
     */
    public static parseRuleTokens(ruleText: string): IAdblockRuleTokens {
        const tokens: IAdblockRuleTokens = {
            pattern: null,
            options: null,
            whitelist: false,
        };

        let startIndex = 0;
        if (ruleText.startsWith('@@')) {
            tokens.whitelist = true;
            startIndex = 2;
        }

        if (ruleText.length <= startIndex) {
            throw new TypeError(`the rule is too short: ${ruleText}`);
        }

        // Setting pattern to rule text (for the case of empty options)
        tokens.pattern = ruleText.substring(startIndex);

        // Avoid parsing options inside of a regex rule
        if (tokens.pattern.startsWith('/')
            && tokens.pattern.endsWith('/')
            && !tokens.pattern.includes('replace=')) {
            return tokens;
        }

        for (let i = ruleText.length; i >= startIndex; i -= 1) {
            const c = ruleText[i];
            if (c === '$') {
                if (i > startIndex && ruleText[i - 1] === '\\') {
                    // Escaped, doing nothing
                } else {
                    tokens.pattern = ruleText.substring(startIndex, i);
                    tokens.options = ruleText.substring(i + 1);
                    break;
                }
            }
        }

        return tokens;
    }

    /**
     * Extracts hostname from an adblock rule pattern.
     * Returns null if hostname cannot be extracted.
     */
    public static extractHostname(pattern: string): string | null {
        const match = pattern.match(/^\|\|([a-z0-9-.]+)\^$/);
        return match ? match[1] : null;
    }

    /**
     * Parses a /etc/hosts rule and extracts hostnames.
     */
    public static loadEtcHostsRuleProperties(ruleText: string): IEtcHostsRule {
        let rule = ruleText.trim();
        const hashIndex = rule.indexOf('#');
        if (hashIndex > 0) {
            rule = rule.substring(0, hashIndex);
        }

        const parts = rule.trim().split(/\s+/);
        const hostnames = parts.slice(1);

        if (hostnames.length < 1) {
            throw new TypeError(`Invalid /etc/hosts rule: ${ruleText}`);
        }

        return {
            ruleText,
            hostnames,
        };
    }

    /**
     * Parses an adblock-style rule and extracts its properties.
     */
    public static loadAdblockRuleProperties(ruleText: string): IAdblockRule {
        const tokens = RuleUtils.parseRuleTokens(ruleText.trim());

        const rule: IAdblockRule = {
            ruleText,
            pattern: tokens.pattern || '',
            whitelist: tokens.whitelist,
            options: null,
            hostname: RuleUtils.extractHostname(tokens.pattern || ''),
        };

        if (tokens.options) {
            const optionParts = StringUtils.splitByDelimiterWithEscapeCharacter(
                tokens.options,
                ',',
                '\\',
                false,
            );

            if (optionParts.length > 0) {
                rule.options = [];

                for (const option of optionParts) {
                    const parts = option.split('=');
                    const name = parts[0];
                    const value = parts[1] || null;
                    rule.options.push({ name, value });
                }
            }
        }

        return rule;
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
            if (option.name === name) {
                return option;
            }
        }

        return null;
    }

    /**
     * Removes a modifier by name from the rule's options.
     * Returns true if the modifier was found and removed.
     */
    public static removeModifier(ruleProps: IAdblockRule, name: string): boolean {
        if (!ruleProps.options) {
            return false;
        }

        let found = false;
        for (let i = ruleProps.options.length - 1; i >= 0; i -= 1) {
            const option = ruleProps.options[i];
            if (option.name === name) {
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
}
