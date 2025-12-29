import { RuleUtils } from '../../src/utils/RuleUtils';

describe('RuleUtils', () => {
    describe('isComment', () => {
        it('should identify ! comments', () => {
            expect(RuleUtils.isComment('! This is a comment')).toBe(true);
        });

        it('should identify # comments with space', () => {
            expect(RuleUtils.isComment('# This is a comment')).toBe(true);
        });

        it('should identify single #', () => {
            expect(RuleUtils.isComment('#')).toBe(true);
        });

        it('should identify #### comments', () => {
            expect(RuleUtils.isComment('#### Section')).toBe(true);
        });

        it('should not identify regular rules as comments', () => {
            expect(RuleUtils.isComment('||example.org^')).toBe(false);
        });

        it('should not identify hosts rules with # as comments', () => {
            expect(RuleUtils.isComment('0.0.0.0 example.org # inline comment')).toBe(false);
        });
    });

    describe('isAllowRule', () => {
        it('should identify allow rules', () => {
            expect(RuleUtils.isAllowRule('@@||example.org^')).toBe(true);
        });

        it('should not identify blocking rules', () => {
            expect(RuleUtils.isAllowRule('||example.org^')).toBe(false);
        });
    });

    describe('isJustDomain', () => {
        it('should identify simple domain', () => {
            expect(RuleUtils.isJustDomain('example.org')).toBe(true);
        });

        it('should identify subdomain', () => {
            expect(RuleUtils.isJustDomain('www.example.org')).toBe(true);
        });

        it('should not identify adblock rule', () => {
            expect(RuleUtils.isJustDomain('||example.org^')).toBe(false);
        });
    });

    describe('isEtcHostsRule', () => {
        it('should identify IPv4 hosts rule', () => {
            expect(RuleUtils.isEtcHostsRule('0.0.0.0 example.org')).toBe(true);
        });

        it('should identify localhost hosts rule', () => {
            expect(RuleUtils.isEtcHostsRule('127.0.0.1 example.org')).toBe(true);
        });

        it('should identify IPv6 hosts rule', () => {
            expect(RuleUtils.isEtcHostsRule('::1 example.org')).toBe(true);
        });

        it('should identify hosts rule with comment', () => {
            expect(RuleUtils.isEtcHostsRule('0.0.0.0 example.org # comment')).toBe(true);
        });

        it('should not identify adblock rule', () => {
            expect(RuleUtils.isEtcHostsRule('||example.org^')).toBe(false);
        });
    });

    describe('containsNonAsciiCharacters', () => {
        it('should return false for ASCII', () => {
            expect(RuleUtils.containsNonAsciiCharacters('example.org')).toBe(false);
        });

        it('should return true for non-ASCII', () => {
            expect(RuleUtils.containsNonAsciiCharacters('пример.рф')).toBe(true);
        });

        it('should return true for mixed', () => {
            expect(RuleUtils.containsNonAsciiCharacters('example.рф')).toBe(true);
        });
    });

    describe('convertNonAsciiToPunycode', () => {
        it('should convert non-ASCII domain to punycode', () => {
            const result = RuleUtils.convertNonAsciiToPunycode('||пример.рф^');
            expect(result).toBe('||xn--e1afmkfd.xn--p1ai^');
        });

        it('should handle wildcard patterns', () => {
            const result = RuleUtils.convertNonAsciiToPunycode('||*.пример.рф^');
            expect(result).toBe('||*.xn--e1afmkfd.xn--p1ai^');
        });

        it('should not modify ASCII domains', () => {
            const result = RuleUtils.convertNonAsciiToPunycode('||example.org^');
            expect(result).toBe('||example.org^');
        });
    });

    describe('parseRuleTokens', () => {
        it('should parse simple rule', () => {
            const tokens = RuleUtils.parseRuleTokens('||example.org^');
            expect(tokens.pattern).toBe('||example.org^');
            expect(tokens.options).toBe(null);
            expect(tokens.whitelist).toBe(false);
        });

        it('should parse rule with options', () => {
            const tokens = RuleUtils.parseRuleTokens('||example.org^$important');
            expect(tokens.pattern).toBe('||example.org^');
            expect(tokens.options).toBe('important');
            expect(tokens.whitelist).toBe(false);
        });

        it('should parse allow rule', () => {
            const tokens = RuleUtils.parseRuleTokens('@@||example.org^');
            expect(tokens.pattern).toBe('||example.org^');
            expect(tokens.whitelist).toBe(true);
        });

        it('should handle escaped $', () => {
            const tokens = RuleUtils.parseRuleTokens('||example.org/path\\$var^');
            expect(tokens.pattern).toBe('||example.org/path\\$var^');
        });

        it('should throw for too short rule', () => {
            expect(() => RuleUtils.parseRuleTokens('@@')).toThrow('the rule is too short');
        });
    });

    describe('extractHostname', () => {
        it('should extract hostname from domain rule', () => {
            expect(RuleUtils.extractHostname('||example.org^')).toBe('example.org');
        });

        it('should return null for non-domain rule', () => {
            expect(RuleUtils.extractHostname('/regex/')).toBe(null);
        });

        it('should return null for rule without separator', () => {
            expect(RuleUtils.extractHostname('||example.org')).toBe(null);
        });
    });

    describe('loadEtcHostsRuleProperties', () => {
        it('should parse hosts rule', () => {
            const props = RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org');
            expect(props.hostnames).toEqual(['example.org']);
        });

        it('should parse hosts rule with multiple domains', () => {
            const props = RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org www.example.org');
            expect(props.hostnames).toEqual(['example.org', 'www.example.org']);
        });

        it('should strip inline comments', () => {
            const props = RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org # comment');
            expect(props.hostnames).toEqual(['example.org']);
        });

        it('should throw for invalid rule', () => {
            expect(() => RuleUtils.loadEtcHostsRuleProperties('0.0.0.0'))
                .toThrow('Invalid /etc/hosts rule');
        });
    });

    describe('loadAdblockRuleProperties', () => {
        it('should parse simple rule', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^');
            expect(props.pattern).toBe('||example.org^');
            expect(props.hostname).toBe('example.org');
            expect(props.whitelist).toBe(false);
            expect(props.options).toBe(null);
        });

        it('should parse rule with options', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
            expect(props.pattern).toBe('||example.org^');
            expect(props.options).toEqual([{ name: 'important', value: null }]);
        });

        it('should parse rule with option value', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^$dnsrewrite=127.0.0.1');
            expect(props.options).toEqual([{ name: 'dnsrewrite', value: '127.0.0.1' }]);
        });

        it('should parse allow rule', () => {
            const props = RuleUtils.loadAdblockRuleProperties('@@||example.org^');
            expect(props.whitelist).toBe(true);
        });
    });

    describe('findModifier', () => {
        it('should find existing modifier', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
            const modifier = RuleUtils.findModifier(props, 'important');
            expect(modifier).toEqual({ name: 'important', value: null });
        });

        it('should return null for missing modifier', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^');
            expect(RuleUtils.findModifier(props, 'important')).toBe(null);
        });
    });

    describe('removeModifier', () => {
        it('should remove modifier', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important,third-party');
            const removed = RuleUtils.removeModifier(props, 'third-party');
            expect(removed).toBe(true);
            expect(props.options).toEqual([{ name: 'important', value: null }]);
        });

        it('should return false for missing modifier', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
            expect(RuleUtils.removeModifier(props, 'third-party')).toBe(false);
        });
    });

    describe('adblockRuleToString', () => {
        it('should convert simple rule', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^');
            expect(RuleUtils.adblockRuleToString(props)).toBe('||example.org^');
        });

        it('should convert rule with options', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
            expect(RuleUtils.adblockRuleToString(props)).toBe('||example.org^$important');
        });

        it('should convert allow rule', () => {
            const props = RuleUtils.loadAdblockRuleProperties('@@||example.org^');
            expect(RuleUtils.adblockRuleToString(props)).toBe('@@||example.org^');
        });

        it('should convert rule with option value', () => {
            const props = RuleUtils.loadAdblockRuleProperties('||example.org^$dnsrewrite=127.0.0.1');
            expect(RuleUtils.adblockRuleToString(props)).toBe('||example.org^$dnsrewrite=127.0.0.1');
        });
    });
});
