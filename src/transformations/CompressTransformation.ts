import { IBlocklistRule, TransformationType } from '../types/index.ts';
import { RuleUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that compresses the final list by removing redundant rules.
 * Also converts /etc/hosts rules to adblock-style rules.
 */
export class CompressTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.Compress;
    /** Human-readable name of the transformation */
    public readonly name = 'Compress';

    /**
     * Executes the compression transformation synchronously.
     * @param rules - Array of rules to compress
     * @returns Array of compressed rules
     */
    public executeSync(rules: string[]): string[] {
        const byHostname: Record<string, boolean> = {};
        const filtered: IBlocklistRule[] = [];

        // First pass: transform rules and build lookup table
        for (const rule of rules) {
            const adblockRules = this.toAdblockRules(rule);

            for (const adblockRule of adblockRules) {
                if (adblockRule.canCompress) {
                    if (adblockRule.hostname && !byHostname[adblockRule.hostname]) {
                        filtered.push(adblockRule);
                        byHostname[adblockRule.hostname] = true;
                    }
                } else {
                    filtered.push(adblockRule);
                }
            }
        }

        // Second pass: mark redundant subdomain rules
        // Use a Set to track indices to discard (O(1) lookups)
        const discardIndices = new Set<number>();

        for (let i = 0; i < filtered.length; i++) {
            const rule = filtered[i];

            if (rule.canCompress && rule.hostname) {
                // Check parent domains for redundancy
                if (this.hasParentDomainRule(rule.hostname, byHostname)) {
                    this.debug(
                        `The rule blocking ${rule.hostname} (from ${rule.originalRuleText}) is redundant`,
                    );
                    discardIndices.add(i);
                }
            }
        }

        // Filter in a single pass (O(n) instead of O(n²) with splice)
        const result = filtered.filter((_, index) => !discardIndices.has(index));

        this.info(`The list was compressed from ${rules.length} to ${result.length}`);
        return result.map((rule) => rule.ruleText);
    }

    /**
     * Checks if any parent domain already has a blocking rule.
     * Uses index-based iteration to avoid creating intermediate arrays.
     */
    private hasParentDomainRule(hostname: string, byHostname: Record<string, boolean>): boolean {
        let dotIndex = 0;
        while ((dotIndex = hostname.indexOf('.', dotIndex + 1)) !== -1) {
            const parentDomain = hostname.substring(dotIndex + 1);
            if (byHostname[parentDomain]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Converts a rule to an array of blocklist rules.
     */
    private toAdblockRules(ruleText: string): IBlocklistRule[] {
        const adblockRules: IBlocklistRule[] = [];

        // Handle /etc/hosts rules
        if (RuleUtils.isEtcHostsRule(ruleText)) {
            const props = RuleUtils.loadEtcHostsRuleProperties(ruleText);

            for (const hostname of props.hostnames) {
                adblockRules.push({
                    ruleText: `||${hostname}^`,
                    canCompress: true,
                    hostname,
                    originalRuleText: ruleText,
                });
            }

            return adblockRules;
        }

        // Handle plain domain names
        if (RuleUtils.isJustDomain(ruleText)) {
            return [{
                ruleText: `||${ruleText}^`,
                canCompress: true,
                hostname: ruleText,
                originalRuleText: ruleText,
            }];
        }

        // Try parsing as adblock rule
        try {
            const props = RuleUtils.loadAdblockRuleProperties(ruleText);

            if (props.hostname && !props.whitelist && (!props.options || props.options.length === 0)) {
                adblockRules.push({
                    ruleText,
                    canCompress: true,
                    hostname: props.hostname,
                    originalRuleText: ruleText,
                });

                return adblockRules;
            }
        } catch {
            // Ignore invalid rules
        }

        // Cannot parse or compress
        adblockRules.push({
            ruleText,
            canCompress: false,
            hostname: null,
            originalRuleText: ruleText,
        });

        return adblockRules;
    }
}
