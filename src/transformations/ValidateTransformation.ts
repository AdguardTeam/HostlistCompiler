/**
 * Validate Transformation - AGTree-based Implementation
 *
 * Validates adblock filter rules for DNS blockers using AGTree for parsing.
 * Removes invalid rules and their preceding comments.
 */

import { ILogger, IValidationError, IValidationReport, TransformationType, ValidationErrorType, ValidationSeverity } from '../types/index.ts';
import { StringUtils, TldUtils } from '../utils/index.ts';
import { AGTreeParser, type AnyRule, type HostRule, type NetworkRule, RuleCategory } from '../utils/AGTreeParser.ts';
import { SyncTransformation } from './base/Transformation.ts';

const DOMAIN_PREFIX = '||';
const DOMAIN_SEPARATOR = '^';
const WILDCARD = '*';
const WILDCARD_DOMAIN_PART = '*.';

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
    /** Last validation report (from most recent executeSync call) */
    private lastValidationReport: IValidationReport | null = null;
    /** Current source name for error tracking */
    private currentSourceName?: string;

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
     * Set the current source name for error tracking
     */
    public setSourceName(sourceName: string | undefined): void {
        this.currentSourceName = sourceName;
    }

    /**
     * Get the validation report from the most recent executeSync call
     */
    public getValidationReport(): IValidationReport | null {
        return this.lastValidationReport;
    }

    /**
     * Executes the validation transformation synchronously.
     * @param rules - Array of rules to validate
     * @returns Array of valid rules
     */
    public executeSync(rules: string[]): string[] {
        const filtered = [...rules];
        const validationErrors: IValidationError[] = [];
        let previousRuleRemoved = false;
        const totalRules = rules.length;

        // Iterate from end to beginning to handle preceding comments
        for (let i = filtered.length - 1; i >= 0; i -= 1) {
            const ruleText = filtered[i];
            const parseResult = AGTreeParser.parse(ruleText);
            const isValidRule = this.isValidParsedRule(
                parseResult.ast,
                ruleText,
                i + 1,
                validationErrors,
            );
            const isCommentOrEmpty = this.isCommentOrEmpty(parseResult.ast, ruleText);

            if (!isValidRule) {
                previousRuleRemoved = true;
                filtered.splice(i, 1);
            } else if (previousRuleRemoved && isCommentOrEmpty) {
                this.debug(`Removing a comment or empty line preceding an invalid rule: ${ruleText}`);
                filtered.splice(i, 1);
            } else {
                previousRuleRemoved = false;
            }
        }

        // Store the validation report for retrieval
        const validRules = filtered.length;
        this.lastValidationReport = {
            errorCount: validationErrors.filter((e) => e.severity === ValidationSeverity.Error).length,
            warningCount: validationErrors.filter((e) => e.severity === ValidationSeverity.Warning).length,
            infoCount: validationErrors.filter((e) => e.severity === ValidationSeverity.Info).length,
            errors: validationErrors,
            totalRules,
            validRules,
            invalidRules: totalRules - validRules,
        };

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
     * Add a validation error to the provided errors array
     */
    private addValidationError(
        errors: IValidationError[],
        type: ValidationErrorType,
        severity: ValidationSeverity,
        ruleText: string,
        message: string,
        details?: string,
        ast?: AnyRule,
        lineNumber?: number,
    ): void {
        errors.push({
            type,
            severity,
            ruleText,
            message,
            details,
            ast,
            lineNumber,
            sourceName: this.currentSourceName,
        });
    }

    /**
     * Validates a parsed rule using the AST.
     */
    protected isValidParsedRule(
        ast: AnyRule | null,
        ruleText: string,
        lineNumber: number | undefined,
        errors: IValidationError[],
    ): boolean {
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
            this.addValidationError(
                errors,
                ValidationErrorType.ParseError,
                ValidationSeverity.Error,
                ruleText,
                'Failed to parse rule',
                'The rule could not be parsed by AGTree',
                undefined,
                lineNumber,
            );
            return false;
        }

        // Comments and empty rules are always valid
        if (AGTreeParser.isComment(ast) || AGTreeParser.isEmpty(ast)) {
            return true;
        }

        // Invalid rules (parse errors in tolerant mode)
        if (ast.category === RuleCategory.Invalid) {
            this.debug(`Invalid rule syntax: ${ruleText}`);
            this.addValidationError(
                errors,
                ValidationErrorType.SyntaxError,
                ValidationSeverity.Error,
                ruleText,
                'Invalid rule syntax',
                'The rule has syntax errors',
                ast,
                lineNumber,
            );
            return false;
        }

        // Validate host rules (/etc/hosts format)
        if (AGTreeParser.isHostRule(ast)) {
            return this.validateHostRule(ast as HostRule, ruleText, lineNumber, errors);
        }

        // Validate network rules (adblock format)
        if (AGTreeParser.isNetworkRule(ast)) {
            return this.validateNetworkRule(ast as NetworkRule, ruleText, lineNumber, errors);
        }

        // Cosmetic rules are not valid for DNS blockers
        if (AGTreeParser.isCosmeticRule(ast)) {
            this.debug(`Cosmetic rules are not supported for DNS blocking: ${ruleText}`);
            this.addValidationError(
                errors,
                ValidationErrorType.CosmeticNotSupported,
                ValidationSeverity.Error,
                ruleText,
                'Cosmetic rules not supported',
                'DNS blockers do not support cosmetic/element hiding rules',
                ast,
                lineNumber,
            );
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
        lineNumber: number | undefined,
        errors: IValidationError[],
    ): boolean {
        const result = TldUtils.parse(hostname);

        if (!result.hostname) {
            this.debug(`Invalid hostname ${hostname} in the rule: ${ruleText}`);
            this.addValidationError(
                errors,
                ValidationErrorType.InvalidHostname,
                ValidationSeverity.Error,
                ruleText,
                `Invalid hostname: ${hostname}`,
                'The hostname format is not valid',
                undefined,
                lineNumber,
            );
            return false;
        }

        if (!this.allowIp && result.isIp) {
            this.debug(`IP addresses not allowed: ${hostname} in rule: ${ruleText}`);
            this.addValidationError(
                errors,
                ValidationErrorType.IpNotAllowed,
                ValidationSeverity.Error,
                ruleText,
                `IP address not allowed: ${hostname}`,
                'IP addresses are not permitted in this configuration',
                undefined,
                lineNumber,
            );
            return false;
        }

        if (result.hostname === result.publicSuffix && !hasLimitModifier) {
            this.debug(`Matching the whole public suffix ${hostname} is not allowed: ${ruleText}`);
            this.addValidationError(
                errors,
                ValidationErrorType.PublicSuffixMatch,
                ValidationSeverity.Error,
                ruleText,
                `Public suffix matching not allowed: ${hostname}`,
                'Matching entire public suffixes (like .com, .org) is too broad',
                undefined,
                lineNumber,
            );
            return false;
        }

        return true;
    }

    /**
     * Validates a /etc/hosts rule using AGTree AST.
     */
    protected validateHostRule(
        rule: HostRule,
        ruleText: string,
        lineNumber: number | undefined,
        errors: IValidationError[],
    ): boolean {
        try {
            const props = AGTreeParser.extractHostRuleProperties(rule);

            if (props.hostnames.length === 0) {
                this.info(`The rule has no hostnames: ${ruleText}`);
                return false;
            }

            for (const hostname of props.hostnames) {
                if (!this.validateHostname(hostname, ruleText, false, lineNumber, errors)) {
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
    protected validateNetworkRule(
        rule: NetworkRule,
        ruleText: string,
        lineNumber: number | undefined,
        errors: IValidationError[],
    ): boolean {
        try {
            const props = AGTreeParser.extractNetworkRuleProperties(rule);
            let hasLimitModifier = false;

            // Check for supported modifiers using AGTree
            if (props.modifiers.length > 0) {
                for (const mod of props.modifiers) {
                    const modName = mod.exception ? `~${mod.name}` : mod.name;
                    if (!SUPPORTED_MODIFIERS.includes(modName) && !SUPPORTED_MODIFIERS.includes(mod.name)) {
                        this.debug(`Contains unsupported modifier ${mod.name}: ${ruleText}`);
                        this.addValidationError(
                            errors,
                            ValidationErrorType.UnsupportedModifier,
                            ValidationSeverity.Error,
                            ruleText,
                            `Unsupported modifier: ${mod.name}`,
                            `Supported modifiers: ${SUPPORTED_MODIFIERS.join(', ')}`,
                            rule,
                            lineNumber,
                        );
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
                    this.addValidationError(
                        errors,
                        ValidationErrorType.ModifierValidationFailed,
                        ValidationSeverity.Warning,
                        ruleText,
                        'Modifier validation warning',
                        validationResult.errors.join(', '),
                        rule,
                        lineNumber,
                    );
                    // Note: We don't return false here as AGTree may have stricter validation
                    // than what DNS blockers need. Log for informational purposes.
                }
            }

            const pattern = props.pattern;

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
                this.addValidationError(
                    errors,
                    ValidationErrorType.InvalidCharacters,
                    ValidationSeverity.Error,
                    ruleText,
                    'Invalid characters in pattern',
                    'Pattern contains characters not allowed in domain names',
                    rule,
                    lineNumber,
                );
                return false;
            }

            // Validate domain pattern
            const sepIdx = pattern.indexOf(DOMAIN_SEPARATOR);
            const wildcardIdx = pattern.indexOf(WILDCARD);

            if (sepIdx !== -1 && wildcardIdx !== -1 && wildcardIdx > sepIdx) {
                this.debug(`Wildcard after separator not allowed: ${ruleText}`);
                return false;
            }

            // If pattern doesn't start with ||, it's valid
            if (!pattern.startsWith(DOMAIN_PREFIX)) {
                return true;
            }

            // Extract domain for validation
            let domainToCheck: string | null = null;
            if (sepIdx !== -1) {
                // Pattern has separator: ||domain^ format
                domainToCheck = StringUtils.substringBetween(ruleText, DOMAIN_PREFIX, DOMAIN_SEPARATOR);
            } else {
                // Pattern without separator: ||domain format
                // Extract domain after ||
                domainToCheck = pattern.substring(DOMAIN_PREFIX.length);
            }

            // Check minimum domain length for ||domain^ and ||domain format rules
            if (domainToCheck && domainToCheck.length < 3) {
                this.debug(`The domain is too short: ${ruleText}`);
                this.addValidationError(
                    errors,
                    ValidationErrorType.PatternTooShort,
                    ValidationSeverity.Error,
                    ruleText,
                    'Pattern too short',
                    'Minimum domain length is 3 characters',
                    rule,
                    lineNumber,
                );
                return false;
            }

            // If no separator, we've validated what we can - allow it through
            if (sepIdx === -1) {
                return true;
            }

            if (domainToCheck && wildcardIdx !== -1) {
                const startsWithWildcard = domainToCheck.startsWith(WILDCARD_DOMAIN_PART);
                const tldPattern = domainToCheck.replace(WILDCARD_DOMAIN_PART, '');
                const isOnlyTld = TldUtils.getPublicSuffix(tldPattern) === tldPattern;

                if (startsWithWildcard && isOnlyTld) {
                    const cleanedDomain = domainToCheck.replace(WILDCARD_DOMAIN_PART, '');
                    return this.validateHostname(cleanedDomain, ruleText, hasLimitModifier, lineNumber, errors);
                }
                return true;
            }

            if (domainToCheck && !this.validateHostname(domainToCheck, ruleText, hasLimitModifier, lineNumber, errors)) {
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
