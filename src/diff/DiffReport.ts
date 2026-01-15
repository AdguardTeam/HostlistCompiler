/**
 * Diff Report Generation
 * Generates detailed diff reports between filter list compilations.
 */

import { PACKAGE_INFO } from '../version.ts';

/**
 * Represents a single rule difference
 */
export interface RuleDiff {
    /** The rule text */
    rule: string;
    /** Type of change */
    type: 'added' | 'removed' | 'modified';
    /** Source of the rule (if known) */
    source?: string;
    /** Line number in original list */
    originalLine?: number;
    /** Line number in new list */
    newLine?: number;
}

/**
 * Summary statistics for diff
 */
export interface DiffSummary {
    /** Total rules in original list */
    originalCount: number;
    /** Total rules in new list */
    newCount: number;
    /** Number of added rules */
    addedCount: number;
    /** Number of removed rules */
    removedCount: number;
    /** Number of unchanged rules */
    unchangedCount: number;
    /** Net change (positive = more rules) */
    netChange: number;
    /** Percentage change */
    percentageChange: number;
}

/**
 * Domain-level diff information
 */
export interface DomainDiff {
    /** Domain name */
    domain: string;
    /** Number of rules added for this domain */
    added: number;
    /** Number of rules removed for this domain */
    removed: number;
}

/**
 * Complete diff report
 */
export interface DiffReport {
    /** Timestamp of comparison */
    timestamp: string;
    /** Version of generator */
    generatorVersion: string;
    /** Original list metadata */
    original: {
        name?: string;
        version?: string;
        timestamp?: string;
        ruleCount: number;
    };
    /** New list metadata */
    current: {
        name?: string;
        version?: string;
        timestamp?: string;
        ruleCount: number;
    };
    /** Summary statistics */
    summary: DiffSummary;
    /** Added rules */
    added: RuleDiff[];
    /** Removed rules */
    removed: RuleDiff[];
    /** Domain-level changes */
    domainChanges: DomainDiff[];
}

/**
 * Options for diff generation
 */
export interface DiffOptions {
    /** Include full rule lists in report */
    includeFullRules?: boolean;
    /** Maximum number of rules to include in report */
    maxRulesToInclude?: number;
    /** Include domain-level analysis */
    analyzeDomains?: boolean;
    /** Ignore comments in comparison */
    ignoreComments?: boolean;
    /** Ignore empty lines in comparison */
    ignoreEmptyLines?: boolean;
}

/**
 * Generates diff reports between filter list compilations
 */
export class DiffGenerator {
    private readonly options: Required<DiffOptions>;

    /**
     * Creates a new DiffGenerator
     * @param options - Optional diff generation options
     */
    constructor(options?: DiffOptions) {
        this.options = {
            includeFullRules: true,
            maxRulesToInclude: 1000,
            analyzeDomains: true,
            ignoreComments: true,
            ignoreEmptyLines: true,
            ...options,
        };
    }

    /**
     * Generates a diff report between two rule lists
     */
    generate(
        originalRules: string[],
        newRules: string[],
        metadata?: {
            originalName?: string;
            originalVersion?: string;
            originalTimestamp?: string;
            newName?: string;
            newVersion?: string;
            newTimestamp?: string;
        },
    ): DiffReport {
        // Normalize rules
        const normalizedOriginal = this.normalizeRules(originalRules);
        const normalizedNew = this.normalizeRules(newRules);

        // Create sets for fast lookup
        const originalSet = new Set(normalizedOriginal);
        const newSet = new Set(normalizedNew);

        // Find added and removed rules
        const added: RuleDiff[] = [];
        const removed: RuleDiff[] = [];

        // Find removed rules (in original but not in new)
        for (let i = 0; i < normalizedOriginal.length; i++) {
            const rule = normalizedOriginal[i];
            if (!newSet.has(rule)) {
                removed.push({
                    rule,
                    type: 'removed',
                    originalLine: i + 1,
                });
            }
        }

        // Find added rules (in new but not in original)
        for (let i = 0; i < normalizedNew.length; i++) {
            const rule = normalizedNew[i];
            if (!originalSet.has(rule)) {
                added.push({
                    rule,
                    type: 'added',
                    newLine: i + 1,
                });
            }
        }

        // Calculate summary
        const unchangedCount = normalizedOriginal.length - removed.length;
        const summary: DiffSummary = {
            originalCount: normalizedOriginal.length,
            newCount: normalizedNew.length,
            addedCount: added.length,
            removedCount: removed.length,
            unchangedCount,
            netChange: added.length - removed.length,
            percentageChange: normalizedOriginal.length > 0 ? ((added.length - removed.length) / normalizedOriginal.length) * 100 : 0,
        };

        // Analyze domain changes if requested
        const domainChanges = this.options.analyzeDomains ? this.analyzeDomainChanges(added, removed) : [];

        // Limit rules if needed
        const limitedAdded = this.options.includeFullRules ? added.slice(0, this.options.maxRulesToInclude) : [];
        const limitedRemoved = this.options.includeFullRules ? removed.slice(0, this.options.maxRulesToInclude) : [];

        return {
            timestamp: new Date().toISOString(),
            generatorVersion: PACKAGE_INFO.version,
            original: {
                name: metadata?.originalName,
                version: metadata?.originalVersion,
                timestamp: metadata?.originalTimestamp,
                ruleCount: normalizedOriginal.length,
            },
            current: {
                name: metadata?.newName,
                version: metadata?.newVersion,
                timestamp: metadata?.newTimestamp,
                ruleCount: normalizedNew.length,
            },
            summary,
            added: limitedAdded,
            removed: limitedRemoved,
            domainChanges,
        };
    }

    /**
     * Normalizes rules for comparison
     */
    private normalizeRules(rules: string[]): string[] {
        return rules
            .map((rule) => rule.trim())
            .filter((rule) => {
                if (!rule && this.options.ignoreEmptyLines) {
                    return false;
                }
                if (this.options.ignoreComments && (rule.startsWith('!') || rule.startsWith('#'))) {
                    return false;
                }
                return true;
            });
    }

    /**
     * Analyzes domain-level changes
     */
    private analyzeDomainChanges(added: RuleDiff[], removed: RuleDiff[]): DomainDiff[] {
        const domainMap = new Map<string, { added: number; removed: number }>();

        // Count added rules by domain
        for (const rule of added) {
            const domain = this.extractDomain(rule.rule);
            if (domain) {
                const existing = domainMap.get(domain) || { added: 0, removed: 0 };
                existing.added++;
                domainMap.set(domain, existing);
            }
        }

        // Count removed rules by domain
        for (const rule of removed) {
            const domain = this.extractDomain(rule.rule);
            if (domain) {
                const existing = domainMap.get(domain) || { added: 0, removed: 0 };
                existing.removed++;
                domainMap.set(domain, existing);
            }
        }

        // Convert to array and sort by total changes
        return Array.from(domainMap.entries())
            .map(([domain, counts]) => ({
                domain,
                added: counts.added,
                removed: counts.removed,
            }))
            .sort((a, b) => (b.added + b.removed) - (a.added + a.removed))
            .slice(0, 100); // Top 100 domains
    }

    /**
     * Extracts domain from a rule
     */
    private extractDomain(rule: string): string | null {
        // Try to extract from adblock format
        const match = rule.match(/^\|\|([a-z0-9.-]+)\^?/i);
        if (match) {
            return match[1].toLowerCase();
        }

        // Try to extract from hosts format
        const hostsMatch = rule.match(/^[\d.]+\s+([a-z0-9.-]+)/i);
        if (hostsMatch) {
            return hostsMatch[1].toLowerCase();
        }

        return null;
    }

    /**
     * Exports diff report as Markdown
     */
    exportAsMarkdown(report: DiffReport): string {
        const lines: string[] = [];

        lines.push('# Filter List Diff Report');
        lines.push('');
        lines.push(`Generated: ${report.timestamp}`);
        lines.push(`Generator: ${PACKAGE_INFO.name} v${report.generatorVersion}`);
        lines.push('');

        lines.push('## Summary');
        lines.push('');
        lines.push('| Metric | Value |');
        lines.push('|--------|-------|');
        lines.push(`| Original Rules | ${report.original.ruleCount} |`);
        lines.push(`| New Rules | ${report.current.ruleCount} |`);
        lines.push(`| Added | +${report.summary.addedCount} |`);
        lines.push(`| Removed | -${report.summary.removedCount} |`);
        lines.push(`| Unchanged | ${report.summary.unchangedCount} |`);
        lines.push(`| Net Change | ${report.summary.netChange >= 0 ? '+' : ''}${report.summary.netChange} (${report.summary.percentageChange.toFixed(2)}%) |`);
        lines.push('');

        if (report.domainChanges.length > 0) {
            lines.push('## Top Domain Changes');
            lines.push('');
            lines.push('| Domain | Added | Removed |');
            lines.push('|--------|-------|---------|');
            for (const domain of report.domainChanges.slice(0, 20)) {
                lines.push(`| ${domain.domain} | +${domain.added} | -${domain.removed} |`);
            }
            lines.push('');
        }

        if (report.added.length > 0) {
            lines.push('## Added Rules');
            lines.push('');
            lines.push('```');
            for (const rule of report.added.slice(0, 50)) {
                lines.push(`+ ${rule.rule}`);
            }
            if (report.added.length > 50) {
                lines.push(`... and ${report.added.length - 50} more`);
            }
            lines.push('```');
            lines.push('');
        }

        if (report.removed.length > 0) {
            lines.push('## Removed Rules');
            lines.push('');
            lines.push('```');
            for (const rule of report.removed.slice(0, 50)) {
                lines.push(`- ${rule.rule}`);
            }
            if (report.removed.length > 50) {
                lines.push(`... and ${report.removed.length - 50} more`);
            }
            lines.push('```');
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Exports diff report as JSON
     */
    exportAsJson(report: DiffReport): string {
        return JSON.stringify(report, null, 2);
    }
}

/**
 * Convenience function to generate a diff report
 */
export function generateDiff(
    originalRules: string[],
    newRules: string[],
    options?: DiffOptions,
): DiffReport {
    const generator = new DiffGenerator(options);
    return generator.generate(originalRules, newRules);
}

/**
 * Convenience function to generate a markdown diff report
 */
export function generateDiffMarkdown(
    originalRules: string[],
    newRules: string[],
    options?: DiffOptions,
): string {
    const generator = new DiffGenerator(options);
    const report = generator.generate(originalRules, newRules);
    return generator.exportAsMarkdown(report);
}
