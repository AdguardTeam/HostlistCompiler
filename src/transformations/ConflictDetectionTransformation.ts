/**
 * Conflict Detection Transformation
 * Detects and reports conflicting rules (blocking vs. allowing same domain).
 */

import { ILogger, TransformationType } from '../types/index.ts';
import { SyncTransformation } from './base/Transformation.ts';
import { RuleUtils } from '../utils/RuleUtils.ts';

/**
 * Represents a conflict between rules
 */
export interface RuleConflict {
    /** The blocking rule */
    blockingRule: string;
    /** The allowing/exception rule */
    allowingRule: string;
    /** The domain involved */
    domain: string;
    /** Line index of blocking rule */
    blockingIndex: number;
    /** Line index of allowing rule */
    allowingIndex: number;
    /** Recommendation for resolution */
    recommendation: 'keep-block' | 'keep-allow' | 'manual-review';
    /** Reason for recommendation */
    reason: string;
}

/**
 * Conflict detection options
 */
export interface ConflictDetectionOptions {
    /** Whether to remove conflicting rules automatically */
    autoResolve?: boolean;
    /** Resolution strategy when auto-resolving */
    resolutionStrategy?: 'keep-block' | 'keep-allow' | 'keep-first';
    /** Whether to log conflicts */
    logConflicts?: boolean;
}

/**
 * Result of conflict detection
 */
export interface ConflictDetectionResult {
    /** List of detected conflicts */
    conflicts: RuleConflict[];
    /** Number of rules analyzed */
    rulesAnalyzed: number;
    /** Number of blocking rules */
    blockingRules: number;
    /** Number of exception rules */
    exceptionRules: number;
}

/**
 * Transformation that detects conflicting rules
 */
export class ConflictDetectionTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.Validate; // Reuse Validate type
    /** Human-readable name of the transformation */
    public readonly name = 'ConflictDetection';

    private conflicts: RuleConflict[] = [];
    private readonly options: ConflictDetectionOptions;

    /**
     * Creates a new ConflictDetectionTransformation
     * @param logger - Logger instance for output
     * @param options - Conflict detection options
     */
    constructor(logger?: ILogger, options?: ConflictDetectionOptions) {
        super(logger);
        this.options = {
            autoResolve: false,
            resolutionStrategy: 'keep-block',
            logConflicts: true,
            ...options,
        };
    }

    /**
     * Gets the detected conflicts
     */
    getConflicts(): RuleConflict[] {
        return [...this.conflicts];
    }

    /**
     * Gets conflict detection statistics
     */
    getStats(): ConflictDetectionResult {
        return {
            conflicts: this.conflicts,
            rulesAnalyzed: 0,
            blockingRules: 0,
            exceptionRules: 0,
        };
    }

    /**
     * Clears detected conflicts
     */
    clearConflicts(): void {
        this.conflicts = [];
    }

    /**
     * Detects conflicting rules (blocking vs. allowing same domain)
     * @param rules - Array of rules to analyze
     * @returns Rules (optionally with conflicts resolved)
     */
    public executeSync(
        rules: readonly string[],
    ): readonly string[] {
        this.conflicts = [];

        // Maps for tracking rules by domain
        const blockingByDomain = new Map<string, { rule: string; index: number }[]>();
        const allowingByDomain = new Map<string, { rule: string; index: number }[]>();

        // First pass: categorize rules
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i].trim();

            // Skip empty lines and comments
            if (!rule || rule.startsWith('!') || rule.startsWith('#')) {
                continue;
            }

            const isException = RuleUtils.isAllowRule(rule);
            const hostname = this.extractDomain(rule);

            if (!hostname) {
                continue;
            }

            if (isException) {
                const existing = allowingByDomain.get(hostname) || [];
                existing.push({ rule, index: i });
                allowingByDomain.set(hostname, existing);
            } else {
                const existing = blockingByDomain.get(hostname) || [];
                existing.push({ rule, index: i });
                blockingByDomain.set(hostname, existing);
            }
        }

        // Second pass: detect conflicts
        for (const [domain, allowingRules] of allowingByDomain) {
            const blockingRules = blockingByDomain.get(domain);

            if (blockingRules && blockingRules.length > 0) {
                // We have both blocking and allowing rules for the same domain
                for (const blocking of blockingRules) {
                    for (const allowing of allowingRules) {
                        const conflict = this.createConflict(
                            blocking.rule,
                            blocking.index,
                            allowing.rule,
                            allowing.index,
                            domain,
                        );
                        this.conflicts.push(conflict);

                        if (this.options.logConflicts) {
                            this.logger.warn(
                                `Conflict detected for domain "${domain}": ` +
                                    `blocking rule "${blocking.rule}" vs exception "${allowing.rule}"`,
                            );
                        }
                    }
                }
            }

            // Also check for subdomain conflicts
            this.checkSubdomainConflicts(domain, allowingRules, blockingByDomain);
        }

        this.info(`Detected ${this.conflicts.length} rule conflicts`);

        // If auto-resolve is enabled, remove conflicting rules based on strategy
        if (this.options.autoResolve && this.conflicts.length > 0) {
            return this.resolveConflicts(rules);
        }

        return rules;
    }

    /**
     * Extracts domain from a rule
     */
    private extractDomain(rule: string): string | null {
        try {
            // Remove @@ prefix for exception rules
            const cleanRule = rule.startsWith('@@') ? rule.substring(2) : rule;

            // Try to extract hostname from adblock rule
            const parsed = RuleUtils.loadAdblockRuleProperties(
                cleanRule.startsWith('@@') ? cleanRule : rule,
            );
            if (parsed.hostname) {
                return parsed.hostname.toLowerCase();
            }

            // Try simple pattern extraction
            const match = cleanRule.match(/^\|\|([a-z0-9.-]+)\^?/i);
            if (match) {
                return match[1].toLowerCase();
            }

            // Check if it's a plain domain
            if (RuleUtils.isJustDomain(cleanRule)) {
                return cleanRule.toLowerCase();
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Creates a conflict record
     */
    private createConflict(
        blockingRule: string,
        blockingIndex: number,
        allowingRule: string,
        allowingIndex: number,
        domain: string,
    ): RuleConflict {
        // Determine recommendation based on rule specificity
        let recommendation: 'keep-block' | 'keep-allow' | 'manual-review' = 'manual-review';
        let reason = 'Both rules apply to the same domain';

        // If exception is more specific (has more options), prefer it
        const blockingOptions = blockingRule.includes('$') ? blockingRule.split('$')[1] : '';
        const allowingOptions = allowingRule.includes('$') ? allowingRule.split('$')[1] : '';

        if (allowingOptions.length > blockingOptions.length) {
            recommendation = 'keep-allow';
            reason = 'Exception rule is more specific';
        } else if (blockingOptions.length > allowingOptions.length) {
            recommendation = 'keep-block';
            reason = 'Blocking rule is more specific';
        }

        return {
            blockingRule,
            allowingRule,
            domain,
            blockingIndex,
            allowingIndex,
            recommendation,
            reason,
        };
    }

    /**
     * Checks for subdomain conflicts
     */
    private checkSubdomainConflicts(
        domain: string,
        allowingRules: { rule: string; index: number }[],
        blockingByDomain: Map<string, { rule: string; index: number }[]>,
    ): void {
        // Check if a parent domain has blocking rules
        const parts = domain.split('.');
        for (let i = 1; i < parts.length - 1; i++) {
            const parentDomain = parts.slice(i).join('.');
            const parentBlocking = blockingByDomain.get(parentDomain);

            if (parentBlocking && parentBlocking.length > 0) {
                for (const blocking of parentBlocking) {
                    for (const allowing of allowingRules) {
                        const conflict = this.createConflict(
                            blocking.rule,
                            blocking.index,
                            allowing.rule,
                            allowing.index,
                            domain,
                        );
                        conflict.reason = `Exception for subdomain "${domain}" conflicts with parent domain blocking rule`;
                        conflict.recommendation = 'manual-review';
                        this.conflicts.push(conflict);
                    }
                }
            }
        }
    }

    /**
     * Resolves conflicts based on strategy
     */
    private resolveConflicts(rules: readonly string[]): readonly string[] {
        const indicesToRemove = new Set<number>();

        for (const conflict of this.conflicts) {
            switch (this.options.resolutionStrategy) {
                case 'keep-block':
                    indicesToRemove.add(conflict.allowingIndex);
                    break;
                case 'keep-allow':
                    indicesToRemove.add(conflict.blockingIndex);
                    break;
                case 'keep-first':
                    if (conflict.blockingIndex < conflict.allowingIndex) {
                        indicesToRemove.add(conflict.allowingIndex);
                    } else {
                        indicesToRemove.add(conflict.blockingIndex);
                    }
                    break;
            }
        }

        const resolved = rules.filter((_, index) => !indicesToRemove.has(index));
        this.info(`Removed ${indicesToRemove.size} conflicting rules`);

        return resolved;
    }
}

/**
 * Detects conflicts in a list of rules without applying transformation
 */
export function detectConflicts(
    rules: string[],
    options?: ConflictDetectionOptions,
): ConflictDetectionResult {
    const transformation = new ConflictDetectionTransformation(undefined, {
        ...options,
        autoResolve: false,
    });

    transformation.executeSync(rules);

    const conflicts = transformation.getConflicts();

    return {
        conflicts,
        rulesAnalyzed: rules.filter((r) => r && !r.startsWith('!')).length,
        blockingRules: conflicts.length > 0 ? new Set(conflicts.map((c) => c.blockingRule)).size : 0,
        exceptionRules: conflicts.length > 0 ? new Set(conflicts.map((c) => c.allowingRule)).size : 0,
    };
}
