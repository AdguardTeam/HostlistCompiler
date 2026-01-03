import { StringUtils } from './StringUtils.ts';

// Sample data for benchmarks
const SAMPLE_STRING = 'The quick brown fox jumps over the lazy dog';
const LONG_STRING = SAMPLE_STRING.repeat(100);
const DELIMITED_STRING = 'value1,value2,value3,value4,value5';
const ESCAPED_STRING = 'value1,value2\\,escaped,value3,value4';
const COMPLEX_ESCAPED = 'a\\,b\\,c,d\\,e,f,g\\,h\\,i\\,j,k';

const REGEX_SPECIAL_CHARS = '.*+?^${}()|[]\\';
const MIXED_TEXT = 'Normal text with some *special* chars and [brackets]';

const WHITESPACE_STRINGS = [
    '   trimmed   ',
    '\t\ttabbed\t\t',
    '  \t mixed \t  ',
    'no-whitespace',
];

Deno.bench('StringUtils.substringBetween - simple', { group: 'substringBetween' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.substringBetween('start[content]end', '[', ']');
    }
});

Deno.bench('StringUtils.substringBetween - not found', { group: 'substringBetween' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.substringBetween('no tags here', '[', ']');
    }
});

Deno.bench('StringUtils.substringBetween - long string', { group: 'substringBetween' }, () => {
    const longStr = `start[${LONG_STRING}]end`;
    for (let i = 0; i < 100; i++) {
        StringUtils.substringBetween(longStr, '[', ']');
    }
});

Deno.bench('StringUtils.substringBetween - null input', { group: 'substringBetween' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.substringBetween(null, '[', ']');
    }
});

Deno.bench('StringUtils.splitByDelimiterWithEscapeCharacter - simple', { group: 'split' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.splitByDelimiterWithEscapeCharacter(DELIMITED_STRING, ',', '\\', false);
    }
});

Deno.bench('StringUtils.splitByDelimiterWithEscapeCharacter - with escapes', { group: 'split' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.splitByDelimiterWithEscapeCharacter(ESCAPED_STRING, ',', '\\', false);
    }
});

Deno.bench('StringUtils.splitByDelimiterWithEscapeCharacter - complex', { group: 'split' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.splitByDelimiterWithEscapeCharacter(COMPLEX_ESCAPED, ',', '\\', false);
    }
});

Deno.bench('StringUtils.splitByDelimiterWithEscapeCharacter - preserve tokens', { group: 'split' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.splitByDelimiterWithEscapeCharacter('a,,b,,c', ',', '\\', true);
    }
});

Deno.bench('StringUtils.splitByDelimiterWithEscapeCharacter - long string', { group: 'split' }, () => {
    const longDelimited = Array(100).fill('value').join(',');
    for (let i = 0; i < 100; i++) {
        StringUtils.splitByDelimiterWithEscapeCharacter(longDelimited, ',', '\\', false);
    }
});

Deno.bench('StringUtils.escapeRegExp - simple', { group: 'escapeRegExp' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.escapeRegExp('example.com');
    }
});

Deno.bench('StringUtils.escapeRegExp - special chars', { group: 'escapeRegExp' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.escapeRegExp(REGEX_SPECIAL_CHARS);
    }
});

Deno.bench('StringUtils.escapeRegExp - mixed text', { group: 'escapeRegExp' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.escapeRegExp(MIXED_TEXT);
    }
});

Deno.bench('StringUtils.escapeRegExp - no special chars', { group: 'escapeRegExp' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.escapeRegExp('simpletext');
    }
});

Deno.bench('StringUtils.isEmpty - empty string', { group: 'isEmpty' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.isEmpty('');
    }
});

Deno.bench('StringUtils.isEmpty - whitespace', { group: 'isEmpty' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.isEmpty('   ');
    }
});

Deno.bench('StringUtils.isEmpty - null', { group: 'isEmpty' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.isEmpty(null);
    }
});

Deno.bench('StringUtils.isEmpty - non-empty', { group: 'isEmpty' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.isEmpty('content');
    }
});

Deno.bench('StringUtils.trim - spaces', { group: 'trim' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.trim('   content   ');
    }
});

Deno.bench('StringUtils.trim - tabs', { group: 'trim' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.trim('\t\tcontent\t\t', '\t');
    }
});

Deno.bench('StringUtils.trim - mixed whitespace', { group: 'trim' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.trim('  \t content \t  ', ' \t');
    }
});

Deno.bench('StringUtils.trim - custom chars', { group: 'trim' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.trim('---content---', '-');
    }
});

Deno.bench('StringUtils.trim - nothing to trim', { group: 'trim' }, () => {
    for (let i = 0; i < 1000; i++) {
        StringUtils.trim('content');
    }
});

// Batch operations
Deno.bench('StringUtils - batch isEmpty checks', { group: 'batch' }, () => {
    const strings = [
        '',
        '   ',
        null,
        'content',
        '\t\t',
        undefined,
        'more content',
        '  \n  ',
    ];
    for (let i = 0; i < 100; i++) {
        for (const str of strings) {
            StringUtils.isEmpty(str);
        }
    }
});

Deno.bench('StringUtils - batch trim operations', { group: 'batch' }, () => {
    for (let i = 0; i < 100; i++) {
        for (const str of WHITESPACE_STRINGS) {
            StringUtils.trim(str);
        }
    }
});

Deno.bench('StringUtils - batch regex escaping', { group: 'batch' }, () => {
    const patterns = [
        '||example.com^',
        '*.test.org',
        '/ads/*',
        'tracker[0-9]+',
        '^https?://',
    ];
    for (let i = 0; i < 100; i++) {
        for (const pattern of patterns) {
            StringUtils.escapeRegExp(pattern);
        }
    }
});

// Real-world scenario: parsing filter list options
Deno.bench('StringUtils - parse filter options (real-world)', { group: 'realworld' }, () => {
    const options = [
        'third-party,script',
        'domain=example.com|test.org',
        'important,third-party,script,domain=site.com',
        'denyallow=sub.example.com',
        'badfilter',
    ];
    for (let i = 0; i < 100; i++) {
        for (const option of options) {
            StringUtils.splitByDelimiterWithEscapeCharacter(option, ',', '\\', false);
        }
    }
});
