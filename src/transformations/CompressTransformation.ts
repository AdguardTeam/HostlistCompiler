import { IBlocklistRule, TransformationType } from '../types/index.ts';
import { RuleUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that compresses the final list by removing redundant rules.
 * Also converts /etc/hosts rules to adblock-style rules.
 */
export class CompressTransformation extends SyncTransformation {
    public readonly type = TransformationType.Compress;
    public readonly name = 'Compress';

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

        // Second pass: remove redundant subdomain rules
        for (let i = filtered.length - 1; i >= 0; i -= 1) {
            const rule = filtered[i];
            let discard = false;

            if (rule.canCompress && rule.hostname) {
                const hostnames = this.extractHostnames(rule.hostname);

                // Start from 1 to skip the full hostname
                for (let j = 1; j < hostnames.length; j += 1) {
                    const hostname = hostnames[j];
                    if (byHostname[hostname]) {
                        this.debug(`The rule blocking ${hostname} (from ${rule.originalRuleText}) is redundant`);
                        discard = true;
                        break;
                    }
                }
            }

            if (discard) {
                filtered.splice(i, 1);
            }
        }

        this.info(`The list was compressed from ${rules.length} to ${filtered.length}`);
        return filtered.map((rule) => rule.ruleText);
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

    /**
     * Extracts all hostnames up to TLD.
     * Example: "sub.example.org" -> ["sub.example.org", "example.org", "org"]
     */
    private extractHostnames(hostname: string): string[] {
        const parts = hostname.split('.');
        const domains: string[] = [];

        for (let i = 0; i < parts.length; i += 1) {
            const domain = parts.slice(i, parts.length).join('.');
            domains.push(domain);
        }

        return domains;
    }
}
