import { RuleUtils } from './RuleUtils.ts';

// Sample data for benchmarks
const COMMENT_RULES = [
    '! This is a comment',
    '# Another comment',
    '#### Header comment',
    '||example.com^',
];

const ALLOW_RULES = [
    '@@||example.com^',
    '@@||ads.example.org^$important',
    '||blocked.example.com^',
];

const DOMAIN_RULES = [
    'example.com',
    'sub.example.com',
    'ads.tracker.example.org',
    '||example.com^',
    '/regex-rule/',
];

const ETC_HOSTS_RULES = [
    '0.0.0.0 example.com',
    '127.0.0.1 localhost',
    '::1 localhost',
    '192.168.1.1 router.local',
    '||example.com^',
];

const NON_ASCII_RULES = [
    '||example.com^',
    '||*.рус^',
    '||*.कॉम^',
    '||*.セール^',
    '||münchen.de^',
];

const _ADBLOCK_RULES = [
    '||example.com^',
    '@@||whitelist.example.com^$important',
    '||ads.example.org^$third-party,script',
    '###ad-banner',
    '/ads/banner/$domain=example.com',
];

Deno.bench('RuleUtils.isComment - mixed rules', { group: 'isComment' }, () => {
    for (const rule of COMMENT_RULES) {
        RuleUtils.isComment(rule);
    }
});

Deno.bench('RuleUtils.isComment - comments only', { group: 'isComment' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.isComment('! Comment line');
    }
});

Deno.bench('RuleUtils.isAllowRule - mixed rules', { group: 'isAllowRule' }, () => {
    for (const rule of ALLOW_RULES) {
        RuleUtils.isAllowRule(rule);
    }
});

Deno.bench('RuleUtils.isAllowRule - allow rules only', { group: 'isAllowRule' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.isAllowRule('@@||example.com^');
    }
});

Deno.bench('RuleUtils.isJustDomain - mixed rules', { group: 'isJustDomain' }, () => {
    for (const rule of DOMAIN_RULES) {
        RuleUtils.isJustDomain(rule);
    }
});

Deno.bench('RuleUtils.isJustDomain - domains only', { group: 'isJustDomain' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.isJustDomain('example.com');
    }
});

Deno.bench('RuleUtils.isEtcHostsRule - mixed rules', { group: 'isEtcHostsRule' }, () => {
    for (const rule of ETC_HOSTS_RULES) {
        RuleUtils.isEtcHostsRule(rule);
    }
});

Deno.bench('RuleUtils.isEtcHostsRule - hosts only', { group: 'isEtcHostsRule' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.isEtcHostsRule('0.0.0.0 example.com');
    }
});

Deno.bench('RuleUtils.containsNonAsciiCharacters - mixed', { group: 'nonAscii' }, () => {
    for (const rule of NON_ASCII_RULES) {
        RuleUtils.containsNonAsciiCharacters(rule);
    }
});

Deno.bench('RuleUtils.containsNonAsciiCharacters - ASCII only', { group: 'nonAscii' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.containsNonAsciiCharacters('||example.com^');
    }
});

Deno.bench('RuleUtils.convertNonAsciiToPunycode - mixed', { group: 'punycode' }, () => {
    for (const rule of NON_ASCII_RULES) {
        RuleUtils.convertNonAsciiToPunycode(rule);
    }
});

Deno.bench('RuleUtils.convertNonAsciiToPunycode - non-ASCII', { group: 'punycode' }, () => {
    for (let i = 0; i < 50; i++) {
        RuleUtils.convertNonAsciiToPunycode('||*.рус^');
    }
});

Deno.bench('RuleUtils.parseRuleTokens - simple rule', { group: 'parseTokens' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.parseRuleTokens('||example.com^');
    }
});

Deno.bench('RuleUtils.parseRuleTokens - rule with options', { group: 'parseTokens' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.parseRuleTokens('||example.com^$third-party,script,domain=test.com');
    }
});

Deno.bench('RuleUtils.parseRuleTokens - whitelist rule', { group: 'parseTokens' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.parseRuleTokens('@@||example.com^$important');
    }
});

Deno.bench('RuleUtils.extractHostname - simple pattern', { group: 'extractHostname' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.extractHostname('||example.com^');
    }
});

Deno.bench('RuleUtils.extractHostname - no match', { group: 'extractHostname' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.extractHostname('/ads/banner/');
    }
});

Deno.bench('RuleUtils.loadEtcHostsRuleProperties - simple', { group: 'loadEtcHosts' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.com');
    }
});

Deno.bench('RuleUtils.loadEtcHostsRuleProperties - multiple hosts', { group: 'loadEtcHosts' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.com ads.example.com tracker.example.org');
    }
});

Deno.bench('RuleUtils.loadAdblockRuleProperties - simple', { group: 'loadAdblock' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.loadAdblockRuleProperties('||example.com^');
    }
});

Deno.bench('RuleUtils.loadAdblockRuleProperties - with options', { group: 'loadAdblock' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.loadAdblockRuleProperties('||example.com^$third-party,script,important');
    }
});

Deno.bench('RuleUtils.loadAdblockRuleProperties - whitelist', { group: 'loadAdblock' }, () => {
    for (let i = 0; i < 100; i++) {
        RuleUtils.loadAdblockRuleProperties('@@||whitelist.example.com^$important');
    }
});

// Batch processing benchmarks
Deno.bench('RuleUtils - batch process 1000 rules', { group: 'batch' }, () => {
    const rules = Array(1000).fill('||example.com^');
    for (const rule of rules) {
        RuleUtils.isComment(rule);
        RuleUtils.isAllowRule(rule);
        RuleUtils.parseRuleTokens(rule);
    }
});

Deno.bench('RuleUtils - batch process mixed 1000 rules', { group: 'batch' }, () => {
    const rules = [
        ...Array(250).fill('! Comment'),
        ...Array(250).fill('||example.com^'),
        ...Array(250).fill('@@||whitelist.com^'),
        ...Array(250).fill('0.0.0.0 example.com'),
    ];
    for (const rule of rules) {
        RuleUtils.isComment(rule);
        RuleUtils.isAllowRule(rule);
        RuleUtils.isEtcHostsRule(rule);
        RuleUtils.isJustDomain(rule);
    }
});
