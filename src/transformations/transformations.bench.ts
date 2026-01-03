import { DeduplicateTransformation } from './DeduplicateTransformation.ts';
import { CompressTransformation } from './CompressTransformation.ts';
import { RemoveCommentsTransformation } from './RemoveCommentsTransformation.ts';
import { ValidateTransformation } from './ValidateTransformation.ts';
import { RemoveModifiersTransformation } from './RemoveModifiersTransformation.ts';
import { TrimLinesTransformation } from './TrimLinesTransformation.ts';
import { RemoveEmptyLinesTransformation } from './RemoveEmptyLinesTransformation.ts';
import type { ILogger } from '../types/index.ts';

// No-op logger for benchmarks to avoid console output
const noopLogger: ILogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    trace: () => {},
};

// Sample rule sets
const SMALL_RULESET = [
    '! Comment 1',
    '||example.com^',
    '||ads.example.org^',
    '@@||whitelist.example.com^',
    '||tracker.example.net^',
];

const MEDIUM_RULESET = [
    '! Comment header',
    '! Another comment',
    ...Array(100).fill('||example.com^'),
    ...Array(100).fill('||ads.example.org^'),
    ...Array(50).fill('0.0.0.0 tracker.example.com'),
    '! More comments',
    ...Array(50).fill('||analytics.example.net^$third-party'),
];

const LARGE_RULESET = [
    '! Large filter list',
    ...Array(1000).fill('||example.com^'),
    ...Array(500).fill('||ads.example.org^'),
    ...Array(500).fill('0.0.0.0 tracker.example.com'),
    ...Array(300).fill('||analytics.example.net^$third-party'),
    ...Array(200).fill('@@||whitelist.example.com^'),
];

const HOSTS_FORMAT_RULES = [
    '0.0.0.0 ads.example.com',
    '127.0.0.1 localhost',
    '0.0.0.0 tracker.example.org',
    '0.0.0.0 analytics.example.net',
    '::1 localhost',
    '0.0.0.0 doubleclick.net',
    '0.0.0.0 googleadservices.com',
];

const ADBLOCK_FORMAT_RULES = [
    '||example.com^',
    '||ads.example.org^$third-party',
    '@@||whitelist.com^',
    '||tracker.net^$script,domain=example.com',
    '###ad-banner',
    '||analytics.com^$important',
];

// DeduplicateTransformation benchmarks
Deno.bench('Deduplicate - small ruleset (5 rules)', { group: 'deduplicate' }, () => {
    const transform = new DeduplicateTransformation(noopLogger);
    transform.executeSync(SMALL_RULESET);
});

Deno.bench('Deduplicate - medium ruleset with duplicates (300 rules)', { group: 'deduplicate' }, () => {
    const transform = new DeduplicateTransformation(noopLogger);
    transform.executeSync(MEDIUM_RULESET);
});

Deno.bench('Deduplicate - large ruleset with duplicates (2500 rules)', { group: 'deduplicate' }, () => {
    const transform = new DeduplicateTransformation(noopLogger);
    transform.executeSync(LARGE_RULESET);
});

Deno.bench('Deduplicate - no duplicates (100 unique rules)', { group: 'deduplicate' }, () => {
    const transform = new DeduplicateTransformation(noopLogger);
    const uniqueRules = Array(100).fill(null).map((_, i) => `||example${i}.com^`);
    transform.executeSync(uniqueRules);
});

// CompressTransformation benchmarks
Deno.bench('Compress - hosts format rules', { group: 'compress' }, () => {
    const transform = new CompressTransformation(noopLogger);
    transform.executeSync(HOSTS_FORMAT_RULES);
});

Deno.bench('Compress - adblock format rules', { group: 'compress' }, () => {
    const transform = new CompressTransformation(noopLogger);
    transform.executeSync(ADBLOCK_FORMAT_RULES);
});

Deno.bench('Compress - mixed format small (19 rules)', { group: 'compress' }, () => {
    const transform = new CompressTransformation(noopLogger);
    const mixed = [...HOSTS_FORMAT_RULES, ...ADBLOCK_FORMAT_RULES];
    transform.executeSync(mixed);
});

Deno.bench('Compress - subdomain redundancy (100 rules)', { group: 'compress' }, () => {
    const transform = new CompressTransformation(noopLogger);
    const rules = [
        '||example.com^',
        '||ads.example.com^',
        '||tracker.ads.example.com^',
        '||analytics.example.com^',
        ...Array(96).fill('||sub.example.com^'),
    ];
    transform.executeSync(rules);
});

Deno.bench('Compress - large hosts file (500 rules)', { group: 'compress' }, () => {
    const transform = new CompressTransformation(noopLogger);
    const rules = Array(500).fill(null).map((_, i) => `0.0.0.0 ads${i}.example.com`);
    transform.executeSync(rules);
});

// RemoveCommentsTransformation benchmarks
Deno.bench('RemoveComments - mixed rules and comments', { group: 'removeComments' }, () => {
    const transform = new RemoveCommentsTransformation(noopLogger);
    const rules = [
        '! Comment 1',
        '||example.com^',
        '# Comment 2',
        '||ads.example.org^',
        '#### Header',
        '||tracker.net^',
    ];
    transform.executeSync(rules);
});

Deno.bench('RemoveComments - mostly comments (100 rules)', { group: 'removeComments' }, () => {
    const transform = new RemoveCommentsTransformation(noopLogger);
    const rules = [
        ...Array(70).fill('! Comment line'),
        ...Array(30).fill('||example.com^'),
    ];
    transform.executeSync(rules);
});

// ValidateTransformation benchmarks
Deno.bench('Validate - valid simple rules', { group: 'validate' }, () => {
    const transform = new ValidateTransformation(false, noopLogger);
    const rules = [
        '||example.com^',
        '||ads.example.org^',
        '||tracker.example.net^',
        '@@||whitelist.com^',
    ];
    transform.executeSync(rules);
});

Deno.bench('Validate - complex rules with options', { group: 'validate' }, () => {
    const transform = new ValidateTransformation(false, noopLogger);
    const rules = [
        '||example.com^$third-party',
        '||ads.org^$script,important',
        '||tracker.net^$popup',
        '||analytics.com^$network',
    ];
    transform.executeSync(rules);
});

// RemoveModifiersTransformation benchmarks
Deno.bench('RemoveModifiers - rules with modifiers', { group: 'removeModifiers' }, () => {
    const transform = new RemoveModifiersTransformation(noopLogger);
    const rules = [
        '||example.com^$third-party',
        '||ads.org^$document',
        '||tracker.net^$popup',
        '||analytics.com^$all',
    ];
    transform.executeSync(rules);
});

// TrimLinesTransformation benchmarks
Deno.bench('TrimLines - rules with whitespace', { group: 'trimLines' }, () => {
    const transform = new TrimLinesTransformation(noopLogger);
    const rules = [
        '  ||example.com^  ',
        '\t||ads.example.org^\t',
        '  \t||tracker.net^\t  ',
        '||clean.com^',
    ];
    transform.executeSync(rules);
});

// RemoveEmptyLinesTransformation benchmarks
Deno.bench('RemoveEmptyLines - rules with empty lines', { group: 'removeEmptyLines' }, () => {
    const transform = new RemoveEmptyLinesTransformation(noopLogger);
    const rules = [
        '||example.com^',
        '',
        '||ads.example.org^',
        '',
        '',
        '||tracker.net^',
        '',
    ];
    transform.executeSync(rules);
});

// Chained transformations (real-world scenario)
Deno.bench('Chained - Deduplicate + Compress (500 rules)', { group: 'chained' }, () => {
    const dedup = new DeduplicateTransformation(noopLogger);
    const compress = new CompressTransformation(noopLogger);
    
    const rules = [
        ...Array(200).fill('||example.com^'),
        ...Array(200).fill('0.0.0.0 ads.example.com'),
        ...Array(100).fill('||tracker.example.org^'),
    ];
    
    const deduplicated = dedup.executeSync(rules);
    compress.executeSync(deduplicated);
});

Deno.bench('Chained - Full pipeline (1000 rules)', { group: 'chained' }, () => {
    const removeComments = new RemoveCommentsTransformation(noopLogger);
    const trim = new TrimLinesTransformation(noopLogger);
    const removeEmpty = new RemoveEmptyLinesTransformation(noopLogger);
    const dedup = new DeduplicateTransformation(noopLogger);
    const compress = new CompressTransformation(noopLogger);
    
    const rules = [
        '! Large filter list',
        ...Array(300).fill('  ||example.com^  '),
        ...Array(300).fill('0.0.0.0 ads.example.com'),
        '',
        '! More comments',
        ...Array(300).fill('||tracker.example.org^'),
        '',
        ...Array(100).fill('\t||analytics.net^\t'),
    ];
    
    let result = removeComments.executeSync(rules);
    result = trim.executeSync(result);
    result = removeEmpty.executeSync(result);
    result = dedup.executeSync(result);
    result = compress.executeSync(result);
});
