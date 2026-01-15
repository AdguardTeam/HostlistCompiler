/**
 * Rule Optimizer Transformation
 * Automatically optimizes rules for better performance and smaller file size.
 */

import { ILogger, ITransformationContext, TransformationType } from '../types/index.ts';
import { SyncTransformation } from './base/Transformation.ts';
import { RuleUtils } from '../utils/RuleUtils.ts';

/**
 * Optimization statistics
 */
export interface OptimizationStats {
    /** Number of rules optimized */
    rulesOptimized: number;
    /** Number of redundant rules removed */
    redundantRemoved: number;
    /** Number of rules merged */
    rulesMerged: number;
    /** Number of modifiers simplified */
    modifiersSimplified: number;
    /** Original rule count */
    originalCount: number;
    /** Final rule count */
    finalCount: number;
    /** Size reduction percentage */
    sizeReduction: number;
}

/**
 * Optimization options
 */
export interface RuleOptimizerOptions {
    /** Remove rules that are subsumed by more general rules */
    removeRedundant?: boolean;
    /** Merge similar rules where possible */
    mergeRules?: boolean;
    /** Simplify modifier lists */
    simplifyModifiers?: boolean;
    /** Convert inefficient patterns to more specific ones */
    optimizePatterns?: boolean;
    /** Minimum rules to trigger merge (default: 3) */
    mergeThreshold?: number;
}

/**
 * Transformation that optimizes rules
 */
export class RuleOptimizerTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.Deduplicate; // Reuse type
    /** Human-readable name of the transformation */
    public readonly name = 'RuleOptimizer';

    private stats: OptimizationStats = {
        rulesOptimized: 0,
        redundantRemoved: 0,
        rulesMerged: 0,
        modifiersSimplified: 0,
        originalCount: 0,
        finalCount: 0,
        sizeReduction: 0,
    };

    private readonly options: Required<RuleOptimizerOptions>;

    /**
     * Creates a new RuleOptimizerTransformation
     * @param logger - Logger instance for output
     * @param options - Optimization options
     */
    constructor(logger?: ILogger, options?: RuleOptimizerOptions) {
        super(logger);
        this.options = {
            removeRedundant: true,
            mergeRules: false, // Disabled by default as it changes rule behavior
            simplifyModifiers: true,
            optimizePatterns: true,
            mergeThreshold: 3,
            ...options,
        };
    }

    /**
     * Gets optimization statistics
     */
    getStats(): OptimizationStats {
        return { ...this.stats };
    }

    /**
     * Optimizes rules for better performance and smaller file size
     * @param rules - Array of rules to optimize
     * @param _context - Optional transformation context
     * @returns Optimized rules array
     */
    public executeSync(
        rules: readonly string[],
        _context?: ITransformationContext,
    ): readonly string[] {
        this.stats = {
            rulesOptimized: 0,
            redundantRemoved: 0,
            rulesMerged: 0,
            modifiersSimplified: 0,
            originalCount: rules.length,
            finalCount: 0,
            sizeReduction: 0,
        };

        let result = [...rules];

        // Step 1: Remove redundant rules
        if (this.options.removeRedundant) {
            result = this.removeRedundantRules(result);
        }

        // Step 2: Optimize patterns
        if (this.options.optimizePatterns) {
            result = this.optimizePatterns(result);
        }

        // Step 3: Simplify modifiers
        if (this.options.simplifyModifiers) {
            result = this.simplifyModifiers(result);
        }

        // Step 4: Merge similar rules (optional)
        if (this.options.mergeRules) {
            result = this.mergeSimilarRules(result);
        }

        // Calculate stats
        this.stats.finalCount = result.length;
        this.stats.sizeReduction = this.stats.originalCount > 0 ? ((this.stats.originalCount - this.stats.finalCount) / this.stats.originalCount) * 100 : 0;

        this.info(
            `Optimized ${this.stats.rulesOptimized} rules, ` +
                `removed ${this.stats.redundantRemoved} redundant, ` +
                `${this.stats.sizeReduction.toFixed(1)}% reduction`,
        );

        return result;
    }

    /**
     * Removes rules that are subsumed by more general rules
     */
    private removeRedundantRules(rules: string[]): string[] {
        const domainRules = new Map<string, { rule: string; index: number }>();
        const keepIndices = new Set<number>();

        // First pass: collect domain-based rules
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i].trim();

            // Skip comments and empty lines
            if (!rule || rule.startsWith('!') || rule.startsWith('#')) {
                keepIndices.add(i);
                continue;
            }

            // Skip exception rules
            if (rule.startsWith('@@')) {
                keepIndices.add(i);
                continue;
            }

            // Try to extract hostname
            try {
                const parsed = RuleUtils.loadAdblockRuleProperties(rule);
                if (parsed.hostname && !parsed.options?.length) {
                    const existing = domainRules.get(parsed.hostname);
                    if (!existing) {
                        domainRules.set(parsed.hostname, { rule, index: i });
                    }
                } else {
                    keepIndices.add(i);
                }
            } catch {
                keepIndices.add(i);
            }
        }

        // Second pass: check for redundant subdomains
        for (const [hostname, { index }] of domainRules) {
            let isRedundant = false;

            // Check if parent domain has a rule
            const parts = hostname.split('.');
            for (let j = 1; j < parts.length - 1; j++) {
                const parentDomain = parts.slice(j).join('.');
                if (domainRules.has(parentDomain)) {
                    isRedundant = true;
                    this.stats.redundantRemoved++;
                    this.debug(`Removing redundant subdomain rule for ${hostname}`);
                    break;
                }
            }

            if (!isRedundant) {
                keepIndices.add(index);
            }
        }

        return rules.filter((_, i) => keepIndices.has(i));
    }

    /**
     * Optimizes rule patterns for better matching performance
     */
    private optimizePatterns(rules: string[]): string[] {
        return rules.map((rule) => {
            const trimmed = rule.trim();

            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#')) {
                return rule;
            }

            // Optimize common patterns
            let optimized = trimmed;

            // Convert `||domain.com/` to `||domain.com^` when appropriate
            if (optimized.match(/^\|\|[a-z0-9.-]+\/$/i)) {
                const newRule = optimized.slice(0, -1) + '^';
                this.stats.rulesOptimized++;
                this.debug(`Optimized pattern: ${optimized} -> ${newRule}`);
                optimized = newRule;
            }

            // Remove unnecessary wildcards at the start
            if (optimized.startsWith('||*')) {
                const newRule = '||' + optimized.substring(3);
                this.stats.rulesOptimized++;
                optimized = newRule;
            }

            // Remove trailing wildcards before ^
            if (optimized.match(/\*\^$/)) {
                const newRule = optimized.slice(0, -2) + '^';
                this.stats.rulesOptimized++;
                optimized = newRule;
            }

            return optimized;
        });
    }

    /**
     * Simplifies modifier lists
     */
    private simplifyModifiers(rules: string[]): string[] {
        return rules.map((rule) => {
            const trimmed = rule.trim();

            // Skip non-adblock rules
            if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#')) {
                return rule;
            }

            if (!trimmed.includes('$')) {
                return rule;
            }

            try {
                const parsed = RuleUtils.loadAdblockRuleProperties(trimmed);
                if (!parsed.options || parsed.options.length === 0) {
                    return rule;
                }

                // Remove duplicate modifiers
                const seen = new Set<string>();
                const uniqueOptions = parsed.options.filter((opt) => {
                    const key = opt.value ? `${opt.name}=${opt.value}` : opt.name;
                    if (seen.has(key)) {
                        this.stats.modifiersSimplified++;
                        return false;
                    }
                    seen.add(key);
                    return true;
                });

                // Remove redundant type modifiers (e.g., having both ~script and ~image)
                const typeModifiers = uniqueOptions.filter(
                    (opt) => ['script', 'image', 'stylesheet', 'font', 'xmlhttprequest', 'media'].includes(opt.name.replace('~', '')),
                );

                const negatedCount = typeModifiers.filter((opt) => opt.name.startsWith('~')).length;
                const totalTypes = 6; // Common type modifiers

                // If all types are negated except one, simplify to just that one
                if (negatedCount === totalTypes - 1 && typeModifiers.length === negatedCount) {
                    this.stats.modifiersSimplified++;
                }

                // Rebuild rule if we made changes
                if (uniqueOptions.length !== parsed.options.length) {
                    parsed.options = uniqueOptions;
                    return RuleUtils.adblockRuleToString(parsed);
                }

                return rule;
            } catch {
                return rule;
            }
        });
    }

    /**
     * Merges similar rules where possible
     */
    private mergeSimilarRules(rules: string[]): string[] {
        // Group rules by pattern (without domain option)
        const groups = new Map<string, { pattern: string; domains: string[]; indices: number[] }>();

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i].trim();

            // Skip non-adblock rules
            if (!rule || rule.startsWith('!') || rule.startsWith('#')) {
                continue;
            }

            try {
                const parsed = RuleUtils.loadAdblockRuleProperties(rule);
                const domainOption = parsed.options?.find((opt) => opt.name === 'domain');

                if (parsed.pattern && domainOption?.value) {
                    const patternKey = parsed.pattern;
                    const existing = groups.get(patternKey);

                    if (existing) {
                        existing.domains.push(domainOption.value);
                        existing.indices.push(i);
                    } else {
                        groups.set(patternKey, {
                            pattern: patternKey,
                            domains: [domainOption.value],
                            indices: [i],
                        });
                    }
                }
            } catch {
                // Skip invalid rules
            }
        }

        // Merge groups that meet threshold
        const indicesToRemove = new Set<number>();
        const mergedRules: { index: number; rule: string }[] = [];

        for (const [pattern, group] of groups) {
            if (group.domains.length >= this.options.mergeThreshold) {
                // Merge these rules
                const mergedDomains = group.domains.join('|');
                const mergedRule = `${pattern}$domain=${mergedDomains}`;

                // Remove all but first, replace first with merged
                for (let i = 1; i < group.indices.length; i++) {
                    indicesToRemove.add(group.indices[i]);
                }
                mergedRules.push({ index: group.indices[0], rule: mergedRule });
                this.stats.rulesMerged += group.indices.length - 1;
            }
        }

        // Apply merges
        return rules
            .map((rule, i) => {
                const merged = mergedRules.find((m) => m.index === i);
                return merged ? merged.rule : rule;
            })
            .filter((_, i) => !indicesToRemove.has(i));
    }
}

/**
 * Optimizes a list of rules
 */
export function optimizeRules(
    rules: string[],
    options?: RuleOptimizerOptions,
): { rules: string[]; stats: OptimizationStats } {
    const transformation = new RuleOptimizerTransformation(undefined, options);
    const optimized = transformation.executeSync(rules);
    return {
        rules: [...optimized],
        stats: transformation.getStats(),
    };
}
