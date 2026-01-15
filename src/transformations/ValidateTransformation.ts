import { ILogger, TransformationType } from '../types/index.ts';
import { RuleUtils, StringUtils, TldUtils } from '../utils/index.ts';
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
            const isValidRule = this.isValid(filtered[i]);
            const isCommentOrEmpty = RuleUtils.isComment(filtered[i]) || StringUtils.isEmpty(filtered[i]);

            if (!isValidRule) {
                this.previousRuleRemoved = true;
                filtered.splice(i, 1);
            } else if (this.previousRuleRemoved && isCommentOrEmpty) {
                this.debug(`Removing a comment or empty line preceding an invalid rule: ${filtered[i]}`);
                filtered.splice(i, 1);
            } else {
                this.previousRuleRemoved = false;
            }
        }

        return filtered;
    }

    /**
     * Checks if a rule is valid.
     */
    protected isValid(ruleText: string): boolean {
        if (RuleUtils.isComment(ruleText) || StringUtils.isEmpty(ruleText.trim())) {
            return true;
        }

        if (RuleUtils.isEtcHostsRule(ruleText)) {
            return this.validateEtcHostsRule(ruleText);
        }

        return this.validateAdblockRule(ruleText);
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
            this.debug(`invalid hostname ${hostname} in the rule: ${ruleText}`);
            return false;
        }

        if (!this.allowIp && result.isIp) {
            this.debug(`invalid hostname ${hostname} in the rule: ${ruleText}`);
            return false;
        }

        if (result.hostname === result.publicSuffix && !hasLimitModifier) {
            this.debug(`matching the whole public suffix ${hostname} is not allowed: ${ruleText}`);
            return false;
        }

        return true;
    }

    /**
     * Validates a /etc/hosts rule.
     */
    protected validateEtcHostsRule(ruleText: string): boolean {
        try {
            const props = RuleUtils.loadEtcHostsRuleProperties(ruleText);

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
            this.error(`Unexpected incorrect /etc/hosts rule: ${ruleText}: ${ex}`);
            return false;
        }
    }

    /**
     * Validates an adblock-style rule.
     */
    protected validateAdblockRule(ruleText: string): boolean {
        try {
            const props = RuleUtils.loadAdblockRuleProperties(ruleText);
            let hasLimitModifier = false;

            // Check for supported modifiers
            if (props.options) {
                for (const option of props.options) {
                    if (!SUPPORTED_MODIFIERS.includes(option.name)) {
                        this.debug(`Contains unsupported modifier ${option.name}: ${ruleText}`);
                        return false;
                    }
                    if (ANY_PATTERN_MODIFIER.includes(option.name)) {
                        hasLimitModifier = true;
                    }
                }
            }

            // Check minimum pattern length
            if (props.pattern.length < MAX_PATTERN_LENGTH) {
                this.debug(`The rule is too short: ${ruleText}`);
                return false;
            }

            // Special case: regex rules
            if (props.pattern.startsWith('/') && props.pattern.endsWith('/')) {
                return true;
            }

            // Check pattern characters
            let toTest = props.pattern;
            if (toTest.startsWith('://')) {
                toTest = toTest.substring(3);
            }

            if (!/^[a-zA-Z0-9-.*|^]+$/.test(toTest)) {
                this.debug(`The rule contains characters that cannot be in a domain name: ${ruleText}`);
                return false;
            }

            // Validate domain pattern
            const sepIdx = props.pattern.indexOf(DOMAIN_SEPARATOR);
            const wildcardIdx = props.pattern.indexOf(WILDCARD);

            if (sepIdx !== -1 && wildcardIdx !== -1 && wildcardIdx > sepIdx) {
                return false;
            }

            if (!props.pattern.startsWith(DOMAIN_PREFIX) || sepIdx === -1) {
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
            return !(props.pattern.length > sepIdx + 1 && props.pattern[sepIdx + 1] !== '|');
        } catch (ex) {
            this.debug(`This is not a valid adblock rule: ${ruleText}: ${ex}`);
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
