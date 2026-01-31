/**
 * Validate Transformation - AGTree-based Implementation
 *
 * Validates adblock filter rules for DNS blockers using AGTree for parsing.
 * Removes invalid rules and their preceding comments.
 */

import { ILogger, TransformationType } from '../types/index.ts';
import { StringUtils, TldUtils } from '../utils/index.ts';
import { AGTreeParser, type AnyRule, type HostRule, type NetworkRule, RuleCategory } from '../utils/AGTreeParser.ts';
import { SyncTransformation } from './base/Transformation.ts';

const DOMAIN_PREFIX = '||';
const DOMAIN_SEPARATOR = '^';
const WILDCARD = '*';
const WILDCARD_DOMAIN_PART = '*.';
const MAX_PATTERN_LENGTH = 5;

/**
 * Modifiers that can limit the rule for specific domains.
 */
const ANY_PATTERN_MODIFIER = [
    'denyallow',
    'badfilter',
    'client',
];

/**
 * Modifiers supported by hosts-level blockers.
 */
const SUPPORTED_MODIFIERS = [
    'important',
    '~important',
    'ctag',
    'dnstype',
    'dnsrewrite',
    ...ANY_PATTERN_MODIFIER,
];

/**
 * Transformation that validates rules for DNS blockers.
 * Uses AGTree for robust parsing and validation.
 * Removes invalid rules and their preceding comments.
 */
export class ValidateTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType;
    /** Human-readable name of the transformation */
    public readonly name: string;

    /** Whether IP addresses are allowed in rules */
    protected readonly allowIp: boolean;
    private previousRuleRemoved: boolean = false;

    /**
     * Creates a new ValidateTransformation
     * @param allowIp - Whether to allow IP address rules
     * @param logger - Logger instance for output
     */
    constructor(allowIp: boolean = false, logger?: ILogger) {
        super(logger);
        this.allowIp = allowIp;
        this.type = TransformationType.Validate;
        this.name = 'Validate';
    }

    /**
     * Executes the validation transformation synchronously.
     * @param rules - Array of rules to validate
     * @returns Array of valid rules
     */
    public executeSync(rules: string[]): string[] {
        const filtered = [...rules];
        this.previousRuleRemoved = false;

        // Iterate from end to beginning to handle preceding comments
        for (let i = filtered.length - 1; i >= 0; i -= 1) {
            const ruleText = filtered[i];
            const parseResult = AGTreeParser.parse(ruleText);
            const isValidRule = this.isValidParsedRule(parseResult.ast, ruleText);
            const isCommentOrEmpty = this.isCommentOrEmpty(parseResult.ast, ruleText);

            if (!isValidRule) {
                this.previousRuleRemoved = true;
                filtered.splice(i, 1);
            } else if (this.previousRuleRemoved && isCommentOrEmpty) {
                this.debug(`Removing a comment or empty line preceding an invalid rule: ${ruleText}`);
                filtered.splice(i, 1);
            } else {
                this.previousRuleRemoved = false;
            }
        }

        return filtered;
    }

    /**
     * Check if the parsed rule is a comment or empty.
     */
    private isCommentOrEmpty(ast: AnyRule | null, ruleText: string): boolean {
        if (StringUtils.isEmpty(ruleText)) {
            return true;
        }
        if (ast) {
            return AGTreeParser.isComment(ast) || AGTreeParser.isEmpty(ast);
        }
        // Fallback for unparseable rules
        return ruleText.startsWith('!') ||
            ruleText.startsWith('# ') ||
            ruleText === '#' ||
            ruleText.startsWith('####');
    }

    /**
     * Validates a parsed rule using the AST.
     */
    protected isValidParsedRule(ast: AnyRule | null, ruleText: string): boolean {
        // Empty or whitespace-only rules are valid
        if (StringUtils.isEmpty(ruleText.trim())) {
            return true;
        }

        // Parse failed - check if it looks like a comment (fallback)
        if (!ast) {
            // Fallback comment check for unparseable rules
            if (
                ruleText.startsWith('!') ||
                ruleText.startsWith('# ') ||
                ruleText === '#' ||
                ruleText.startsWith('####')
            ) {
                return true;
            }
            this.debug(`Failed to parse rule: ${ruleText}`);
            return false;
        }

        // Comments and empty rules are always valid
        if (AGTreeParser.isComment(ast) || AGTreeParser.isEmpty(ast)) {
            return true;
        }

        // Invalid rules (parse errors in tolerant mode)
        if (ast.category === RuleCategory.Invalid) {
            this.debug(`Invalid rule syntax: ${ruleText}`);
            return false;
        }

        // Validate host rules (/etc/hosts format)
        if (AGTreeParser.isHostRule(ast)) {
            return this.validateHostRule(ast as HostRule, ruleText);
        }

        // Validate network rules (adblock format)
        if (AGTreeParser.isNetworkRule(ast)) {
            return this.validateNetworkRule(ast as NetworkRule, ruleText);
        }

        // Cosmetic rules are not valid for DNS blockers
        if (AGTreeParser.isCosmeticRule(ast)) {
            this.debug(`Cosmetic rules are not supported for DNS blocking: ${ruleText}`);
            return false;
        }

        // Unknown rule type
        this.debug(`Unknown rule type: ${ruleText}`);
        return false;
    }

    /**
     * Validates a hostname for the blocklist.
     */
    protected validateHostname(
        hostname: string,
        ruleText: string,
        hasLimitModifier: boolean,
    ): boolean {
        const result = TldUtils.parse(hostname);

        if (!result.hostname) {
            this.debug(`Invalid hostname ${hostname} in the rule: ${ruleText}`);
            return false;
        }

        if (!this.allowIp && result.isIp) {
            this.debug(`IP addresses not allowed: ${hostname} in rule: ${ruleText}`);
            return false;
        }

        if (result.hostname === result.publicSuffix && !hasLimitModifier) {
            this.debug(`Matching the whole public suffix ${hostname} is not allowed: ${ruleText}`);
            return false;
        }

        return true;
    }

    /**
     * Validates a /etc/hosts rule using AGTree AST.
     */
    protected validateHostRule(rule: HostRule, ruleText: string): boolean {
        try {
            const props = AGTreeParser.extractHostRuleProperties(rule);

            if (props.hostnames.length === 0) {
                this.info(`The rule has no hostnames: ${ruleText}`);
                return false;
            }

            for (const hostname of props.hostnames) {
                if (!this.validateHostname(hostname, ruleText, false)) {
                    return false;
                }
            }

            return true;
        } catch (ex) {
            this.error(`Unexpected error validating /etc/hosts rule: ${ruleText}: ${ex}`);
            return false;
        }
    }

    /**
     * Validates an adblock-style network rule using AGTree AST.
     */
    protected validateNetworkRule(rule: NetworkRule, ruleText: string): boolean {
        try {
            const props = AGTreeParser.extractNetworkRuleProperties(rule);
            let hasLimitModifier = false;

            // Check for supported modifiers using AGTree
            if (props.modifiers.length > 0) {
                for (const mod of props.modifiers) {
                    const modName = mod.exception ? `~${mod.name}` : mod.name;
                    if (!SUPPORTED_MODIFIERS.includes(modName) && !SUPPORTED_MODIFIERS.includes(mod.name)) {
                        this.debug(`Contains unsupported modifier ${mod.name}: ${ruleText}`);
                        return false;
                    }
                    if (ANY_PATTERN_MODIFIER.includes(mod.name)) {
                        hasLimitModifier = true;
                    }
                }

                // Validate modifiers using AGTree's built-in validator
                const validationResult = AGTreeParser.validateNetworkRuleModifiers(rule);
                if (!validationResult.valid) {
                    this.debug(`Modifier validation failed: ${validationResult.errors.join(', ')}: ${ruleText}`);
                    // Note: We don't return false here as AGTree may have stricter validation
                    // than what DNS blockers need. Log for informational purposes.
                }
            }

            const pattern = props.pattern;

            // Check minimum pattern length
            if (pattern.length < MAX_PATTERN_LENGTH) {
                this.debug(`The rule is too short: ${ruleText}`);
                return false;
            }

            // Special case: regex rules are valid
            if (pattern.startsWith('/') && pattern.endsWith('/')) {
                return true;
            }

            // Check pattern characters
            let toTest = pattern;
            if (toTest.startsWith('://')) {
                toTest = toTest.substring(3);
            }

            if (!/^[a-zA-Z0-9-.*|^]+$/.test(toTest)) {
                this.debug(`The rule contains characters that cannot be in a domain name: ${ruleText}`);
                return false;
            }

            // Validate domain pattern
            const sepIdx = pattern.indexOf(DOMAIN_SEPARATOR);
            const wildcardIdx = pattern.indexOf(WILDCARD);

            if (sepIdx !== -1 && wildcardIdx !== -1 && wildcardIdx > sepIdx) {
                this.debug(`Wildcard after separator not allowed: ${ruleText}`);
                return false;
            }

            if (!pattern.startsWith(DOMAIN_PREFIX) || sepIdx === -1) {
                return true;
            }

            const domainToCheck = StringUtils.substringBetween(ruleText, DOMAIN_PREFIX, DOMAIN_SEPARATOR);

            if (domainToCheck && wildcardIdx !== -1) {
                const startsWithWildcard = domainToCheck.startsWith(WILDCARD_DOMAIN_PART);
                const tldPattern = domainToCheck.replace(WILDCARD_DOMAIN_PART, '');
                const isOnlyTld = TldUtils.getPublicSuffix(tldPattern) === tldPattern;

                if (startsWithWildcard && isOnlyTld) {
                    const cleanedDomain = domainToCheck.replace(WILDCARD_DOMAIN_PART, '');
                    return this.validateHostname(cleanedDomain, ruleText, hasLimitModifier);
                }
                return true;
            }

            if (domainToCheck && !this.validateHostname(domainToCheck, ruleText, hasLimitModifier)) {
                return false;
            }

            // Ensure nothing after domain separator except ^|
            return !(pattern.length > sepIdx + 1 && pattern[sepIdx + 1] !== '|');
        } catch (ex) {
            this.debug(`Error validating adblock rule: ${ruleText}: ${ex}`);
            return false;
        }
    }
}

/**
 * Validation transformation that allows IP addresses.
 */
export class ValidateAllowIpTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.ValidateAllowIp;
    /** Human-readable name of the transformation */
    public readonly name = 'ValidateAllowIp';

    private readonly validator: ValidateTransformation;

    /**
     * Creates a new ValidateAllowIpTransformation
     * @param logger - Logger instance for output
     */
    constructor(logger?: ILogger) {
        super(logger);
        this.validator = new ValidateTransformation(true, logger);
    }

    /**
     * Executes the validation transformation synchronously.
     * @param rules - Array of rules to validate
     * @returns Array of valid rules
     */
    public executeSync(rules: string[]): string[] {
        return this.validator.executeSync(rules);
    }
}
