import { Wildcard } from './Wildcard.ts';

// Sample test strings
const TEST_STRINGS = [
    'example.com',
    'ads.example.com',
    'tracker.ads.example.com',
    'https://example.com/path',
    'subdomain.example.org',
];

const LONG_TEST_STRINGS = [
    'a'.repeat(1000),
    'very.long.subdomain.with.many.parts.example.com',
    'https://subdomain1.subdomain2.subdomain3.example.com/very/long/path/to/resource',
];

// Plain string patterns
Deno.bench('Wildcard - plain string pattern creation', { group: 'creation' }, () => {
    for (let i = 0; i < 1000; i++) {
        new Wildcard('example.com');
    }
});

Deno.bench('Wildcard - wildcard pattern creation', { group: 'creation' }, () => {
    for (let i = 0; i < 1000; i++) {
        new Wildcard('*.example.com');
    }
});

Deno.bench('Wildcard - regex pattern creation', { group: 'creation' }, () => {
    for (let i = 0; i < 1000; i++) {
        new Wildcard('/example\\.com$/');
    }
});

// Plain string matching
Deno.bench('Wildcard - plain string match (hit)', { group: 'plainMatch' }, () => {
    const pattern = new Wildcard('example.com');
    for (let i = 0; i < 1000; i++) {
        pattern.test('ads.example.com');
    }
});

Deno.bench('Wildcard - plain string match (miss)', { group: 'plainMatch' }, () => {
    const pattern = new Wildcard('example.com');
    for (let i = 0; i < 1000; i++) {
        pattern.test('different.org');
    }
});

Deno.bench('Wildcard - plain string multiple tests', { group: 'plainMatch' }, () => {
    const pattern = new Wildcard('example');
    for (let i = 0; i < 100; i++) {
        for (const str of TEST_STRINGS) {
            pattern.test(str);
        }
    }
});

// Wildcard matching
Deno.bench('Wildcard - wildcard match simple (*.domain)', { group: 'wildcardMatch' }, () => {
    const pattern = new Wildcard('*.example.com');
    for (let i = 0; i < 1000; i++) {
        pattern.test('ads.example.com');
    }
});

Deno.bench('Wildcard - wildcard match complex (*sub*.domain*)', { group: 'wildcardMatch' }, () => {
    const pattern = new Wildcard('*tracker*.example.*');
    for (let i = 0; i < 1000; i++) {
        pattern.test('ads.tracker.example.com');
    }
});

Deno.bench('Wildcard - wildcard match prefix (prefix*)', { group: 'wildcardMatch' }, () => {
    const pattern = new Wildcard('ads*');
    for (let i = 0; i < 1000; i++) {
        pattern.test('ads.example.com');
    }
});

Deno.bench('Wildcard - wildcard match suffix (*suffix)', { group: 'wildcardMatch' }, () => {
    const pattern = new Wildcard('*.com');
    for (let i = 0; i < 1000; i++) {
        pattern.test('example.com');
    }
});

Deno.bench('Wildcard - wildcard multiple wildcards (*a*b*c*)', { group: 'wildcardMatch' }, () => {
    const pattern = new Wildcard('*a*e*c*');
    for (let i = 0; i < 1000; i++) {
        pattern.test('ads.example.com');
    }
});

Deno.bench('Wildcard - wildcard match multiple tests', { group: 'wildcardMatch' }, () => {
    const pattern = new Wildcard('*.example.*');
    for (let i = 0; i < 100; i++) {
        for (const str of TEST_STRINGS) {
            pattern.test(str);
        }
    }
});

// Regex matching
Deno.bench('Wildcard - regex simple pattern', { group: 'regexMatch' }, () => {
    const pattern = new Wildcard('/^example\\.com$/');
    for (let i = 0; i < 1000; i++) {
        pattern.test('example.com');
    }
});

Deno.bench('Wildcard - regex complex pattern', { group: 'regexMatch' }, () => {
    const pattern = new Wildcard('/^(ads|tracker)\\..+\\.com$/');
    for (let i = 0; i < 1000; i++) {
        pattern.test('ads.example.com');
    }
});

Deno.bench('Wildcard - regex with character class', { group: 'regexMatch' }, () => {
    const pattern = new Wildcard('/[0-9]+\\.example\\.com/');
    for (let i = 0; i < 1000; i++) {
        pattern.test('123.example.com');
    }
});

Deno.bench('Wildcard - regex multiple tests', { group: 'regexMatch' }, () => {
    const pattern = new Wildcard('/\\.example\\.(com|org|net)/');
    for (let i = 0; i < 100; i++) {
        for (const str of TEST_STRINGS) {
            pattern.test(str);
        }
    }
});

// Long string performance
Deno.bench('Wildcard - plain match long strings', { group: 'longStrings' }, () => {
    const pattern = new Wildcard('subdomain');
    for (let i = 0; i < 100; i++) {
        for (const str of LONG_TEST_STRINGS) {
            pattern.test(str);
        }
    }
});

Deno.bench('Wildcard - wildcard match long strings', { group: 'longStrings' }, () => {
    const pattern = new Wildcard('*subdomain*example*');
    for (let i = 0; i < 100; i++) {
        for (const str of LONG_TEST_STRINGS) {
            pattern.test(str);
        }
    }
});

Deno.bench('Wildcard - regex match long strings', { group: 'longStrings' }, () => {
    const pattern = new Wildcard('/subdomain.*example/');
    for (let i = 0; i < 100; i++) {
        for (const str of LONG_TEST_STRINGS) {
            pattern.test(str);
        }
    }
});

// Property access
Deno.bench('Wildcard - property access', { group: 'properties' }, () => {
    const plain = new Wildcard('example.com');
    const wildcard = new Wildcard('*.example.com');
    const regex = new Wildcard('/example/');
    
    for (let i = 0; i < 1000; i++) {
        plain.isPlain;
        plain.isWildcard;
        plain.isRegex;
        wildcard.isPlain;
        wildcard.isWildcard;
        regex.isRegex;
    }
});

Deno.bench('Wildcard - toString', { group: 'properties' }, () => {
    const pattern = new Wildcard('*.example.com');
    for (let i = 0; i < 1000; i++) {
        pattern.toString();
    }
});

// Real-world filter list patterns
Deno.bench('Wildcard - filter list exclusion patterns', { group: 'realworld' }, () => {
    const patterns = [
        new Wildcard('||example.com^'),
        new Wildcard('*tracker*'),
        new Wildcard('*/ads/*'),
        new Wildcard('*.doubleclick.*'),
    ];
    
    const rules = [
        '||ads.example.com^',
        '||tracker.example.org^',
        'https://example.com/ads/banner.js',
        '||ad.doubleclick.net^',
        '||safe-site.com^',
    ];
    
    for (let i = 0; i < 100; i++) {
        for (const pattern of patterns) {
            for (const rule of rules) {
                pattern.test(rule);
            }
        }
    }
});

Deno.bench('Wildcard - filter list inclusion patterns', { group: 'realworld' }, () => {
    const patterns = [
        new Wildcard('||*.example.com^'),
        new Wildcard('@@*'),
        new Wildcard('*$important*'),
    ];
    
    const rules = [
        '||ads.example.com^',
        '@@||whitelist.com^',
        '||tracking.org^$important',
        '||test.example.com^$third-party',
    ];
    
    for (let i = 0; i < 100; i++) {
        for (const pattern of patterns) {
            for (const rule of rules) {
                pattern.test(rule);
            }
        }
    }
});

// Pattern comparison
Deno.bench('Wildcard - plain vs wildcard vs regex comparison', { group: 'comparison' }, () => {
    const plain = new Wildcard('example.com');
    const wildcard = new Wildcard('*.example.com');
    const regex = new Wildcard('/^.*\\.example\\.com$/');
    
    const testStr = 'ads.example.com';
    
    for (let i = 0; i < 1000; i++) {
        plain.test(testStr);
        wildcard.test(testStr);
        regex.test(testStr);
    }
});
