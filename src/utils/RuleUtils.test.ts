import { assertEquals, assertThrows } from '@std/assert';
import { RuleUtils } from '../../src/utils/RuleUtils.ts';

// isComment tests
Deno.test('RuleUtils.isComment - should identify ! comments', () => {
    assertEquals(RuleUtils.isComment('! This is a comment'), true);
});

Deno.test('RuleUtils.isComment - should identify # comments with space', () => {
    assertEquals(RuleUtils.isComment('# This is a comment'), true);
});

Deno.test('RuleUtils.isComment - should identify single #', () => {
    assertEquals(RuleUtils.isComment('#'), true);
});

Deno.test('RuleUtils.isComment - should identify #### comments', () => {
    assertEquals(RuleUtils.isComment('#### Section'), true);
});

Deno.test('RuleUtils.isComment - should not identify regular rules as comments', () => {
    assertEquals(RuleUtils.isComment('||example.org^'), false);
});

Deno.test('RuleUtils.isComment - should not identify hosts rules with # as comments', () => {
    assertEquals(RuleUtils.isComment('0.0.0.0 example.org # inline comment'), false);
});

// isAllowRule tests
Deno.test('RuleUtils.isAllowRule - should identify allow rules', () => {
    assertEquals(RuleUtils.isAllowRule('@@||example.org^'), true);
});

Deno.test('RuleUtils.isAllowRule - should not identify blocking rules', () => {
    assertEquals(RuleUtils.isAllowRule('||example.org^'), false);
});

// isJustDomain tests
Deno.test('RuleUtils.isJustDomain - should identify simple domain', () => {
    assertEquals(RuleUtils.isJustDomain('example.org'), true);
});

Deno.test('RuleUtils.isJustDomain - should identify subdomain', () => {
    assertEquals(RuleUtils.isJustDomain('www.example.org'), true);
});

Deno.test('RuleUtils.isJustDomain - should not identify adblock rule', () => {
    assertEquals(RuleUtils.isJustDomain('||example.org^'), false);
});

// isEtcHostsRule tests
Deno.test('RuleUtils.isEtcHostsRule - should identify IPv4 hosts rule', () => {
    assertEquals(RuleUtils.isEtcHostsRule('0.0.0.0 example.org'), true);
});

Deno.test('RuleUtils.isEtcHostsRule - should identify localhost hosts rule', () => {
    assertEquals(RuleUtils.isEtcHostsRule('127.0.0.1 example.org'), true);
});

Deno.test('RuleUtils.isEtcHostsRule - should identify IPv6 hosts rule', () => {
    assertEquals(RuleUtils.isEtcHostsRule('::1 example.org'), true);
});

Deno.test('RuleUtils.isEtcHostsRule - should identify hosts rule with comment', () => {
    assertEquals(RuleUtils.isEtcHostsRule('0.0.0.0 example.org # comment'), true);
});

Deno.test('RuleUtils.isEtcHostsRule - should not identify adblock rule', () => {
    assertEquals(RuleUtils.isEtcHostsRule('||example.org^'), false);
});

// containsNonAsciiCharacters tests
Deno.test('RuleUtils.containsNonAsciiCharacters - should return false for ASCII', () => {
    assertEquals(RuleUtils.containsNonAsciiCharacters('example.org'), false);
});

Deno.test('RuleUtils.containsNonAsciiCharacters - should return true for non-ASCII', () => {
    assertEquals(RuleUtils.containsNonAsciiCharacters('пример.рф'), true);
});

Deno.test('RuleUtils.containsNonAsciiCharacters - should return true for mixed', () => {
    assertEquals(RuleUtils.containsNonAsciiCharacters('example.рф'), true);
});

// convertNonAsciiToPunycode tests
Deno.test('RuleUtils.convertNonAsciiToPunycode - should convert non-ASCII domain to punycode', () => {
    const result = RuleUtils.convertNonAsciiToPunycode('||пример.рф^');
    assertEquals(result, '||xn--e1afmkfd.xn--p1ai^');
});

Deno.test('RuleUtils.convertNonAsciiToPunycode - should handle wildcard patterns', () => {
    const result = RuleUtils.convertNonAsciiToPunycode('||*.пример.рф^');
    assertEquals(result, '||*.xn--e1afmkfd.xn--p1ai^');
});

Deno.test('RuleUtils.convertNonAsciiToPunycode - should not modify ASCII domains', () => {
    const result = RuleUtils.convertNonAsciiToPunycode('||example.org^');
    assertEquals(result, '||example.org^');
});

// parseRuleTokens tests
Deno.test('RuleUtils.parseRuleTokens - should parse simple rule', () => {
    const tokens = RuleUtils.parseRuleTokens('||example.org^');
    assertEquals(tokens.pattern, '||example.org^');
    assertEquals(tokens.options, null);
    assertEquals(tokens.whitelist, false);
});

Deno.test('RuleUtils.parseRuleTokens - should parse rule with options', () => {
    const tokens = RuleUtils.parseRuleTokens('||example.org^$important');
    assertEquals(tokens.pattern, '||example.org^');
    assertEquals(tokens.options, 'important');
    assertEquals(tokens.whitelist, false);
});

Deno.test('RuleUtils.parseRuleTokens - should parse allow rule', () => {
    const tokens = RuleUtils.parseRuleTokens('@@||example.org^');
    assertEquals(tokens.pattern, '||example.org^');
    assertEquals(tokens.whitelist, true);
});

Deno.test('RuleUtils.parseRuleTokens - should handle escaped $', () => {
    const tokens = RuleUtils.parseRuleTokens('||example.org/path\\$var^');
    assertEquals(tokens.pattern, '||example.org/path\\$var^');
});

Deno.test('RuleUtils.parseRuleTokens - should handle very short rule gracefully', () => {
    // AGTree parses '@@' as an empty pattern exception rule, not an error
    const tokens = RuleUtils.parseRuleTokens('@@');
    assertEquals(tokens.whitelist, true);
    // Pattern will be empty or the rule itself depending on parse result
});

// extractHostname tests
Deno.test('RuleUtils.extractHostname - should extract hostname from domain rule', () => {
    assertEquals(RuleUtils.extractHostname('||example.org^'), 'example.org');
});

Deno.test('RuleUtils.extractHostname - should return null for non-domain rule', () => {
    assertEquals(RuleUtils.extractHostname('/regex/'), null);
});

Deno.test('RuleUtils.extractHostname - should extract hostname even without trailing separator', () => {
    // AGTree can extract hostname from ||example.org format (no trailing ^)
    assertEquals(RuleUtils.extractHostname('||example.org'), 'example.org');
});

// loadEtcHostsRuleProperties tests
Deno.test('RuleUtils.loadEtcHostsRuleProperties - should parse hosts rule', () => {
    const props = RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org');
    assertEquals(props.hostnames, ['example.org']);
});

Deno.test('RuleUtils.loadEtcHostsRuleProperties - should parse hosts rule with multiple domains', () => {
    const props = RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org www.example.org');
    assertEquals(props.hostnames, ['example.org', 'www.example.org']);
});

Deno.test('RuleUtils.loadEtcHostsRuleProperties - should strip inline comments', () => {
    const props = RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org # comment');
    assertEquals(props.hostnames, ['example.org']);
});

Deno.test('RuleUtils.loadEtcHostsRuleProperties - should throw for invalid rule', () => {
    assertThrows(
        () => RuleUtils.loadEtcHostsRuleProperties('0.0.0.0'),
        Error,
        'Invalid /etc/hosts rule',
    );
});

// loadAdblockRuleProperties tests
Deno.test('RuleUtils.loadAdblockRuleProperties - should parse simple rule', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^');
    assertEquals(props.pattern, '||example.org^');
    assertEquals(props.hostname, 'example.org');
    assertEquals(props.whitelist, false);
    assertEquals(props.options, null);
});

Deno.test('RuleUtils.loadAdblockRuleProperties - should parse rule with options', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
    assertEquals(props.pattern, '||example.org^');
    assertEquals(props.options, [{ name: 'important', value: null }]);
});

Deno.test('RuleUtils.loadAdblockRuleProperties - should parse rule with option value', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^$dnsrewrite=127.0.0.1');
    assertEquals(props.options, [{ name: 'dnsrewrite', value: '127.0.0.1' }]);
});

Deno.test('RuleUtils.loadAdblockRuleProperties - should parse allow rule', () => {
    const props = RuleUtils.loadAdblockRuleProperties('@@||example.org^');
    assertEquals(props.whitelist, true);
});

// findModifier tests
Deno.test('RuleUtils.findModifier - should find existing modifier', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
    const modifier = RuleUtils.findModifier(props, 'important');
    assertEquals(modifier, { name: 'important', value: null });
});

Deno.test('RuleUtils.findModifier - should return null for missing modifier', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^');
    assertEquals(RuleUtils.findModifier(props, 'important'), null);
});

// removeModifier tests
Deno.test('RuleUtils.removeModifier - should remove modifier', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important,third-party');
    const removed = RuleUtils.removeModifier(props, 'third-party');
    assertEquals(removed, true);
    assertEquals(props.options, [{ name: 'important', value: null }]);
});

Deno.test('RuleUtils.removeModifier - should return false for missing modifier', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
    assertEquals(RuleUtils.removeModifier(props, 'third-party'), false);
});

// adblockRuleToString tests
Deno.test('RuleUtils.adblockRuleToString - should convert simple rule', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^');
    assertEquals(RuleUtils.adblockRuleToString(props), '||example.org^');
});

Deno.test('RuleUtils.adblockRuleToString - should convert rule with options', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^$important');
    assertEquals(RuleUtils.adblockRuleToString(props), '||example.org^$important');
});

Deno.test('RuleUtils.adblockRuleToString - should convert allow rule', () => {
    const props = RuleUtils.loadAdblockRuleProperties('@@||example.org^');
    assertEquals(RuleUtils.adblockRuleToString(props), '@@||example.org^');
});

Deno.test('RuleUtils.adblockRuleToString - should convert rule with option value', () => {
    const props = RuleUtils.loadAdblockRuleProperties('||example.org^$dnsrewrite=127.0.0.1');
    assertEquals(RuleUtils.adblockRuleToString(props), '||example.org^$dnsrewrite=127.0.0.1');
});
