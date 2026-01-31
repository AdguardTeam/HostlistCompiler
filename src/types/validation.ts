/**
 * Validation Error Types
 *
 * Types for tracking and reporting validation errors through agtree integration
 */

import type { AnyRule } from '../utils/AGTreeParser.ts';

/**
 * Type of validation error
 */
export enum ValidationErrorType {
    /** Rule failed to parse */
    ParseError = 'parse_error',
    /** Invalid syntax */
    SyntaxError = 'syntax_error',
    /** Unsupported modifier */
    UnsupportedModifier = 'unsupported_modifier',
    /** Invalid hostname */
    InvalidHostname = 'invalid_hostname',
    /** IP address not allowed */
    IpNotAllowed = 'ip_not_allowed',
    /** Pattern too short */
    PatternTooShort = 'pattern_too_short',
    /** Public suffix matching */
    PublicSuffixMatch = 'public_suffix_match',
    /** Invalid pattern characters */
    InvalidCharacters = 'invalid_characters',
    /** Cosmetic rule not supported */
    CosmeticNotSupported = 'cosmetic_not_supported',
    /** Modifier validation failed */
    ModifierValidationFailed = 'modifier_validation_failed',
}

/**
 * Severity level of validation error
 */
export enum ValidationSeverity {
    /** Error - rule will be removed */
    Error = 'error',
    /** Warning - rule may have issues but is kept */
    Warning = 'warning',
    /** Info - informational message */
    Info = 'info',
}

/**
 * A single validation error for a rule
 */
export interface IValidationError {
    /** Type of validation error */
    type: ValidationErrorType;
    /** Severity level */
    severity: ValidationSeverity;
    /** The rule text that failed validation */
    ruleText: string;
    /** Line number in the original source (if available) */
    lineNumber?: number;
    /** Human-readable error message */
    message: string;
    /** Additional context or details */
    details?: string;
    /** The parsed AST node (if parsing succeeded) */
    ast?: AnyRule;
    /** Source name (if from a specific source) */
    sourceName?: string;
}

/**
 * Collection of validation errors for a compilation
 */
export interface IValidationReport {
    /** Total number of errors */
    errorCount: number;
    /** Total number of warnings */
    warningCount: number;
    /** Total number of info messages */
    infoCount: number;
    /** List of all validation errors */
    errors: IValidationError[];
    /** Total rules validated */
    totalRules: number;
    /** Valid rules count */
    validRules: number;
    /** Invalid rules count (removed) */
    invalidRules: number;
}

/**
 * Extended compilation result with validation report
 */
export interface IValidationResult {
    /** The compiled rules */
    rules: string[];
    /** Validation report */
    validation: IValidationReport;
}
