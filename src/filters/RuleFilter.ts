import type { IBasicLogger, IFilterable } from '../types/index.ts';
import { FilterService } from '../services/FilterService.ts';
import type { Wildcard } from '../utils/Wildcard.ts';

/**
 * Handles rule filtering through exclusions and inclusions.
 * Follows Single Responsibility Principle - only responsible for filtering rules.
 * 
 * This class is optimized for performance by partitioning patterns into
 * plain strings (fast) and regex/wildcards (slower) for efficient matching.
 */
export class RuleFilter {
    private readonly filterService: FilterService;
    private readonly logger: IBasicLogger;

    constructor(filterService: FilterService, logger: IBasicLogger) {
        this.filterService = filterService;
        this.logger = logger;
    }

    /**
     * Applies exclusion patterns to filter out unwanted rules.
     * @param rules - Array of rules to filter
     * @param filterable - Configuration containing exclusion patterns
     * @returns Filtered array of rules
     * @throws Error if wildcard preparation fails
     */
    public async applyExclusions(
        rules: string[],
        filterable: IFilterable,
    ): Promise<string[]> {
        const exclusions = filterable.exclusions;
        const exclusionsSources = filterable.exclusions_sources;

        if ((!exclusions || exclusions.length === 0) &&
            (!exclusionsSources || exclusionsSources.length === 0)) {
            return rules;
        }

        try {
            const wildcards = await this.filterService.prepareWildcards(
                exclusions,
                exclusionsSources,
            );

            if (wildcards.length === 0) {
                return rules;
            }

            this.logger.info(`Filtering rules using ${wildcards.length} exclusion patterns`);

            const filtered = this.filterRules(rules, wildcards, 'exclusion');

            this.logger.info(
                `Excluded ${rules.length - filtered.length} rules. ${filtered.length} rules remain.`,
            );

            return filtered;
        } catch (error) {
            this.logger.error(`Failed to apply exclusions: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(
                `Rule exclusion failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Applies inclusion patterns to keep only matching rules.
     * @param rules - Array of rules to filter
     * @param filterable - Configuration containing inclusion patterns
     * @returns Filtered array of rules
     * @throws Error if wildcard preparation fails
     */
    public async applyInclusions(
        rules: string[],
        filterable: IFilterable,
    ): Promise<string[]> {
        const inclusions = filterable.inclusions;
        const inclusionsSources = filterable.inclusions_sources;

        if ((!inclusions || inclusions.length === 0) &&
            (!inclusionsSources || inclusionsSources.length === 0)) {
            return rules;
        }

        try {
            const wildcards = await this.filterService.prepareWildcards(
                inclusions,
                inclusionsSources,
            );

            if (wildcards.length === 0) {
                return rules;
            }

            this.logger.info(`Filtering rules using ${wildcards.length} inclusion patterns`);

            const filtered = this.filterRules(rules, wildcards, 'inclusion');

            this.logger.info(`Included ${filtered.length} rules`);

            return filtered;
        } catch (error) {
            this.logger.error(`Failed to apply inclusions: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(
                `Rule inclusion failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Filters rules based on wildcard patterns.
     * Optimized by partitioning patterns into plain strings and regex.
     * 
     * @param rules - Rules to filter
     * @param wildcards - Patterns to match against
     * @param mode - Whether to exclude or include matching rules
     * @returns Filtered rules
     */
    private filterRules(
        rules: string[],
        wildcards: Wildcard[],
        mode: 'exclusion' | 'inclusion',
    ): string[] {
        // Partition patterns by type for optimized matching
        const plainPatterns: string[] = [];
        const regexWildcards: Wildcard[] = [];

        for (const wildcard of wildcards) {
            if (wildcard.isPlain) {
                plainPatterns.push(wildcard.pattern);
            } else {
                regexWildcards.push(wildcard);
            }
        }

        const filtered = rules.filter((rule) => {
            const matches = this.ruleMatches(rule, plainPatterns, regexWildcards);

            if (matches) {
                this.logger.debug(`Rule ${mode === 'exclusion' ? 'excluded' : 'included'}: ${rule}`);
            }

            // For exclusions: keep if doesn't match
            // For inclusions: keep if matches
            return mode === 'exclusion' ? !matches : matches;
        });

        return filtered;
    }

    /**
     * Checks if a rule matches any of the provided patterns.
     * @param rule - Rule to test
     * @param plainPatterns - Plain string patterns (fast check)
     * @param regexWildcards - Regex/wildcard patterns (slower check)
     * @returns True if rule matches any pattern
     */
    private ruleMatches(
        rule: string,
        plainPatterns: string[],
        regexWildcards: Wildcard[],
    ): boolean {
        // Fast path: check plain string patterns first
        for (const pattern of plainPatterns) {
            if (rule.includes(pattern)) {
                return true;
            }
        }

        // Slow path: regex/wildcard patterns
        for (const wildcard of regexWildcards) {
            if (wildcard.test(rule)) {
                return true;
            }
        }

        return false;
    }
}
