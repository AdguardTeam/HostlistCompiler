const utils = require('../src/utils');

const { Wildcard } = utils;

describe('Wildcard', () => {
    it('compile a simple URL source', () => {
        let w = new Wildcard('test');
        expect(w.test('1test1')).toBe(true);
        expect(w.test('trara')).toBe(false);

        w = new Wildcard('t*est');
        expect(w.test('test')).toBe(true);
        expect(w.test('t123est')).toBe(true);
        expect(w.test('t12\n3est')).toBe(true);

        w = new Wildcard('/t.*est/');
        expect(w.test('test')).toBe(true);
        expect(w.test('t123est')).toBe(true);
    });
});

describe('stripUrlCredentials', () => {
    it.each([
        [
            'https://example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user%40name:p%40ss%3Aword@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            '//user:secret@example.org/list.txt',
            '//example.org/list.txt',
        ],
        [
            'http:/user:secret@example.org/list.txt',
            'http:/example.org/list.txt',
        ],
        [
            'HTTPS://user:secret@example.org/list.txt',
            'HTTPS://example.org/list.txt',
        ],
        [
            'See https://user:secret@example.org/list.txt and https://other:secret@example.net/other.txt',
            'See https://example.org/list.txt and https://example.net/other.txt',
        ],
        [
            'https://user:secret@example.org:8443/list.txt',
            'https://example.org:8443/list.txt',
        ],
        [
            'https://user:secret@[2001:db8::1]:8443/list.txt?query=1#fragment',
            'https://[2001:db8::1]:8443/list.txt?query=1#fragment',
        ],
        [
            'https://user:secret@example.org?query=1#fragment',
            'https://example.org?query=1#fragment',
        ],
        [
            'https://user:secret@example.org#fragment',
            'https://example.org#fragment',
        ],
        [
            'https://example.org/list@with@at.txt',
            'https://example.org/list@with@at.txt',
        ],
        [
            'user:secret@example.org/list.txt',
            'user:secret@example.org/list.txt',
        ],
        [
            'test/dir/list.txt',
            'test/dir/list.txt',
        ],
    ])('strips credentials from %s', (url, expected) => {
        expect(utils.stripUrlCredentials(url)).toBe(expected);
    });

    it('returns a non-string value unchanged', () => {
        expect(utils.stripUrlCredentials(undefined)).toBeUndefined();
        expect(utils.stripUrlCredentials(null)).toBeNull();
    });
});

describe('stripConfigurationCredentials', () => {
    it('returns a sanitized copy without changing the original configuration', () => {
        const configuration = {
            name: 'Test filter',
            homepage: 'https://user:secret@example.org/',
            exclusions_sources: ['https://user:secret@example.org/exclusions.txt'],
            inclusions_sources: ['https://user:secret@example.org/inclusions.txt'],
            sources: [
                {
                    name: 'source 1',
                    source: 'https://user:secret@example.org/list.txt',
                    exclusions_sources: ['https://user:secret@example.org/source-exclusions.txt'],
                    inclusions_sources: ['https://user:secret@example.org/source-inclusions.txt'],
                },
            ],
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized).not.toBe(configuration);
        expect(sanitized).not.toEqual(configuration);
        expect(sanitized.name).toBe('Test filter');
        expect(sanitized.homepage).toBe('https://example.org/');
        expect(sanitized.exclusions_sources).toEqual(['https://example.org/exclusions.txt']);
        expect(sanitized.inclusions_sources).toEqual(['https://example.org/inclusions.txt']);
        expect(sanitized.sources[0].source).toBe('https://example.org/list.txt');
        expect(sanitized.sources[0].exclusions_sources).toEqual(['https://example.org/source-exclusions.txt']);
        expect(sanitized.sources[0].inclusions_sources).toEqual(['https://example.org/source-inclusions.txt']);

        expect(configuration.homepage).toBe('https://user:secret@example.org/');
        expect(configuration.sources[0].source).toBe('https://user:secret@example.org/list.txt');
    });

    it('sanitizes every string in malformed configuration shapes', () => {
        const configuration = {
            homepage: ['https://user:secret@example.org/'],
            exclusions_sources: 'https://user:secret@example.org/exclusions.txt',
            sources: [
                'https://user:secret@example.org/source.txt',
                {
                    url: 'https://user:secret@example.org/misspelled.txt',
                    source: ['https://user:secret@example.org/source-array.txt'],
                },
            ],
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized).toEqual({
            homepage: ['https://example.org/'],
            exclusions_sources: 'https://example.org/exclusions.txt',
            sources: [
                'https://example.org/source.txt',
                {
                    url: 'https://example.org/misspelled.txt',
                    source: ['https://example.org/source-array.txt'],
                },
            ],
        });
        expect(configuration.homepage[0]).toBe('https://user:secret@example.org/');
        expect(configuration.sources[1].url).toBe('https://user:secret@example.org/misspelled.txt');
    });

    it('sanitizes strings in class instances', () => {
        class Source {
            constructor(source) {
                this.source = source;
            }
        }

        const configuration = {
            sources: [new Source('https://user:secret@example.org/list.txt')],
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.sources[0].source).toBe('https://example.org/list.txt');
        expect(configuration.sources[0].source).toBe('https://user:secret@example.org/list.txt');
    });
});

describe('substringBetween', () => {
    it('works', () => {
        let substr = utils.substringBetween('<a>test</a>', '<a>', '</a>');
        expect(substr).toBe('test');

        substr = utils.substringBetween('<a>test</a', '<a>', '</a>');
        expect(substr).toBe(null);

        substr = utils.substringBetween('</a><a>test', '<a>', '</a>');
        expect(substr).toBe(null);

        substr = utils.substringBetween('</a>test', '<a>', '</a>');
        expect(substr).toBe(null);
    });
});
