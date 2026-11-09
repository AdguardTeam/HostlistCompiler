/* eslint-disable class-methods-use-this, max-classes-per-file */
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
            'https:user:secret@example.org/list.txt',
            'https:example.org/list.txt',
        ],
        [
            'https:\\user:secret@example.org\\list.txt',
            'https:\\example.org\\list.txt',
        ],
        [
            'https:\\\\user:secret@example.org\\list.txt',
            'https:\\\\example.org\\list.txt',
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
            'https://proxy.example.org/fetch?u=https://user:secret@raw.example.org/list.txt',
            'https://proxy.example.org/fetch?u=https://raw.example.org/list.txt',
        ],
        [
            'https://proxy.example.org/r/https://user:secret@raw.example.org/list.txt',
            'https://proxy.example.org/r/https://raw.example.org/list.txt',
        ],
        [
            'https://example.org/a,https://user:secret@raw.example.org/list.txt',
            'https://example.org/a,https://raw.example.org/list.txt',
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
            'https://example.org/a//b@c',
            'https://example.org/a//b@c',
        ],
        [
            "https://user:p'ss@example.org/list.txt",
            'https://example.org/list.txt',
        ],
        [
            '"https://o\'brien:secret@example.org"',
            '"https://example.org"',
        ],
        [
            '<https://John Smith:secret@example.org>',
            '<https://example.org>',
        ],
        [
            'https://user:p"s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p<s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p>s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'user:secret@example.org/list.txt',
            'user:secret@example.org/list.txt',
        ],
        [
            'test/dir/list.txt',
            'test/dir/list.txt',
        ],
        [
            'C:\\user:secret@example.org\\list.txt',
            'C:\\user:secret@example.org\\list.txt',
        ],
        [
            'C:/user@corp/list.txt',
            'C:/user@corp/list.txt',
        ],
        [
            'c:/user:secret@corp/list.txt',
            'c:/user:secret@corp/list.txt',
        ],
        [
            'ftp:/user:secret@example.org/list.txt',
            'ftp:/example.org/list.txt',
        ],
        [
            'ftp://user:secret@example.org/list.txt',
            'ftp://example.org/list.txt',
        ],
        [
            'https://user:p s s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            ' https:///user:p s s@example.invalid/list.txt',
            ' https:///example.invalid/list.txt',
        ],
        [
            'https://user:p"s s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p"q"@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://example.org is maintained by user@example.com',
            'https://example.org is maintained by user@example.com',
        ],
        [
            'https://example.org, see foo@bar.com',
            'https://example.org, see foo@bar.com',
        ],
        [
            'https://user:secret@example.org and a@b',
            'https://example.org and a@b',
        ],
        [
            'https://user:secret@example.org and https://other:secret@example.net/x',
            'https://example.org and https://example.net/x',
        ],
        [
            'https://user:secret@example.org and https://other:secret@example.net',
            'https://example.org and https://example.net',
        ],
        [
            'https://user:secret@example.org and a@b',
            'https://example.org and a@b',
        ],
        [
            'https://John Smith: secret@example.org',
            'https://example.org',
        ],
        [
            'See https://John Smith: secret@example.org',
            'See https://example.org',
        ],
        [
            'https://user:1234, secret@example.org',
            'https://example.org',
        ],
        [
            'https://user:1234, secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'See https://user:1234, secret@example.org/list.txt',
            'See https://example.org/list.txt',
        ],
        [
            'https://example.org:8080 by admin@example.com',
            'https://example.org:8080 by admin@example.com',
        ],
        [
            'https://example.org:8080 by admin@example.com/path',
            'https://example.org:8080 by admin@example.com/path',
        ],
        [
            'https://localhost:8080, contact admin@example.com',
            'https://localhost:8080, contact admin@example.com',
        ],
        [
            'https://192.168.1.1:8080, contact admin@example.com',
            'https://192.168.1.1:8080, contact admin@example.com',
        ],
        [
            'Mirror at https://example.org:8080, contact admin@example.com',
            'Mirror at https://example.org:8080, contact admin@example.com',
        ],
        [
            'Mirror at https://example.org:8080, contact admin@example.com/path',
            'Mirror at https://example.org:8080, contact admin@example.com/path',
        ],
        [
            'Mirror at https://example.org:8080. Contact admin@example.com/path',
            'Mirror at https://example.org:8080. Contact admin@example.com/path',
        ],
        [
            'Mirror at https://example.org:8080; contact admin@example.com/path',
            'Mirror at https://example.org:8080; contact admin@example.com/path',
        ],
        [
            'Mirror at https://example.org:8080) contact admin@example.com/path',
            'Mirror at https://example.org:8080) contact admin@example.com/path',
        ],
        [
            'Maintained at https://example.org by john@example.com. Forum: https://forum.example.org/',
            'Maintained at https://example.org by john@example.com. Forum: https://forum.example.org/',
        ],
        [
            'https://John Smith:sekret@example.org by admin@example.com',
            'https://example.org by admin@example.com',
        ],
        [
            "https://o'brien:sekret@example.org by admin@example.com",
            'https://example.org by admin@example.com',
        ],
        [
            'Filter list for Corp. Homepage: https://example.org. Contact: admin@example.com',
            'Filter list for Corp. Homepage: https://example.org. Contact: admin@example.com',
        ],
        [
            'Mirror of https://example.org, maintainer: admin@example.com',
            'Mirror of https://example.org, maintainer: admin@example.com',
        ],
        [
            '(https://example.org) Contact: admin@example.com',
            '(https://example.org) Contact: admin@example.com',
        ],
        [
            'https://[2001:db8::1] by admin@example.com',
            'https://[2001:db8::1] by admin@example.com',
        ],
        [
            'https://[2001:db8::1]. Contact: admin@example.com',
            'https://[2001:db8::1]. Contact: admin@example.com',
        ],
        [
            'https://user:secret@[2001:db8::1] by admin@example.com',
            'https://[2001:db8::1] by admin@example.com',
        ],
        [
            'https://user:secret@[2001:db8::1]. Contact: admin@example.com',
            'https://[2001:db8::1]. Contact: admin@example.com',
        ],
    ])('strips credentials from %s', (url, expected) => {
        expect(utils.stripUrlCredentials(url)).toBe(expected);
    });

    it('returns a non-string value unchanged', () => {
        expect(utils.stripUrlCredentials(undefined)).toBeUndefined();
        expect(utils.stripUrlCredentials(null)).toBeNull();
    });

    it('does not treat a double slash inside a path as a new URL', () => {
        const text = 'https://example.org/a//b@c';

        expect(utils.stripUrlCredentials(text)).toBe(text);
        expect(utils.stripUrlCredentials(`${text} and https://user:secret@example.net/x`))
            .toBe(`${text} and https://example.net/x`);
    });

    it('does not change a rendered configuration that has no credentials', () => {
        const configuration = {
            homepage: 'https://example.org',
            exclusions: ['@@||good.example^'],
            sources: [{ source: 'lists/a.txt' }],
        };
        const dump = JSON.stringify(configuration);

        expect(utils.stripUrlCredentials(dump)).toBe(dump);
    });

    it('handles long strings in linear time', () => {
        // Jest does not fail a synchronous test that runs past its timeout,
        // so the test needs a wall-clock bound. The bound is generous: a
        // quadratic scan needs about 19 seconds for this input, while a linear
        // scan takes milliseconds. A loaded runner cannot fail the bound.
        // The credentialed URL reaches the port heuristic, which used to retry
        // from every position inside the long password.
        const plainText = 'a'.repeat(200_000);
        const longPassword = 'b'.repeat(200_000);
        const credentialedUrl = `https://reader:${longPassword}@example.org/list.txt`;
        const startedAt = Date.now();

        expect(utils.stripUrlCredentials(plainText)).toBe(plainText);
        expect(utils.stripUrlCredentials(credentialedUrl)).toBe('https://example.org/list.txt');
        expect(Date.now() - startedAt).toBeLessThan(3000);
    });
});

describe('stripUrlValueCredentials', () => {
    it.each([
        [
            'https://user:secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p s s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p"s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            "https://user:p'ss@example.org/list.txt",
            'https://example.org/list.txt',
        ],
        [
            '//user:p s s@example.org/list.txt',
            '//example.org/list.txt',
        ],
        [
            'https:user:p s s@example.org/list.txt',
            'https:example.org/list.txt',
        ],
        [
            'https:\\user:p s s@example.org\\list.txt',
            'https:\\example.org\\list.txt',
        ],
        [
            'https://example.org/a//b@c',
            'https://example.org/a//b@c',
        ],
        [
            'C:\\user:secret@example.org\\list.txt',
            'C:\\user:secret@example.org\\list.txt',
        ],
        [
            'C:/user@corp/list.txt',
            'C:/user@corp/list.txt',
        ],
        [
            ' https://user:secret@example.org/list.txt',
            ' https://example.org/list.txt',
        ],
        [
            '\thttps://user:secret@example.org/list.txt',
            '\thttps://example.org/list.txt',
        ],
        [
            '<https://user:secret@example.org/>',
            '<https://example.org/>',
        ],
        [
            '"https://user:secret@example.org/"',
            '"https://example.org/"',
        ],
        [
            'See https://user:secret@example.org/list.txt',
            'See https://example.org/list.txt',
        ],
        [
            'https://user:p"s s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p"q"@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:p\t s@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://example.org is maintained by user@example.com',
            'https://example.org is maintained by user@example.com',
        ],
        [
            'https://example.org, see foo@bar.com',
            'https://example.org, see foo@bar.com',
        ],
        [
            "https://o'brien:secret@example.org/list.txt",
            'https://example.org/list.txt',
        ],
        [
            'https://John Smith:secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user: secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            "https://o'brien:secret@example.org",
            'https://example.org',
        ],
        [
            'https://John Smith:secret@example.org',
            'https://example.org',
        ],
        [
            'https://user: secret@example.org',
            'https://example.org',
        ],
        [
            'https://example.org team: contact@example.com',
            'https://example.org team: contact@example.com',
        ],
        [
            'https://John Smith: secret@example.org',
            'https://example.org',
        ],
        [
            'See https://John Smith: secret@example.org',
            'See https://example.org',
        ],
        [
            'https://user:1234, secret@example.org',
            'https://example.org',
        ],
        [
            'https://user:1234, secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'See https://user:1234, secret@example.org/list.txt',
            'See https://example.org/list.txt',
        ],
        [
            'https://example.org:8080 by admin@example.com',
            'https://example.org:8080 by admin@example.com',
        ],
        [
            'https://example.org:8080 by admin@example.com/path',
            'https://example.org:8080 by admin@example.com/path',
        ],
        [
            'https://localhost:8080, contact admin@example.com',
            'https://localhost:8080, contact admin@example.com',
        ],
        [
            'https://192.168.1.1:8080, contact admin@example.com',
            'https://192.168.1.1:8080, contact admin@example.com',
        ],
        [
            'Mirror at https://example.org:8080, contact admin@example.com',
            'Mirror at https://example.org:8080, contact admin@example.com',
        ],
        [
            'Mirror at https://example.org:8080, contact admin@example.com/path',
            'Mirror at https://example.org:8080, contact admin@example.com/path',
        ],
        [
            'Mirror at https://example.org:8080. Contact admin@example.com/path',
            'Mirror at https://example.org:8080. Contact admin@example.com/path',
        ],
        [
            'Mirror at https://example.org:8080; contact admin@example.com/path',
            'Mirror at https://example.org:8080; contact admin@example.com/path',
        ],
        [
            'Mirror at https://example.org:8080) contact admin@example.com/path',
            'Mirror at https://example.org:8080) contact admin@example.com/path',
        ],
        [
            'Maintained at https://example.org by john@example.com. Forum: https://forum.example.org/',
            'Maintained at https://example.org by john@example.com. Forum: https://forum.example.org/',
        ],
        [
            'https://John Smith:sekret@example.org by admin@example.com',
            'https://example.org by admin@example.com',
        ],
        [
            "https://o'brien:sekret@example.org by admin@example.com",
            'https://example.org by admin@example.com',
        ],
        [
            'Filter list for Corp. Homepage: https://example.org. Contact: admin@example.com',
            'Filter list for Corp. Homepage: https://example.org. Contact: admin@example.com',
        ],
        [
            'Mirror of https://example.org, maintainer: admin@example.com',
            'Mirror of https://example.org, maintainer: admin@example.com',
        ],
        [
            '(https://example.org) Contact: admin@example.com',
            '(https://example.org) Contact: admin@example.com',
        ],
        [
            'https://[2001:db8::1] by admin@example.com',
            'https://[2001:db8::1] by admin@example.com',
        ],
        [
            'https://[2001:db8::1]. Contact: admin@example.com',
            'https://[2001:db8::1]. Contact: admin@example.com',
        ],
        [
            'https://user:secret@[2001:db8::1] by admin@example.com',
            'https://[2001:db8::1] by admin@example.com',
        ],
        [
            'https://user:secret@[2001:db8::1]. Contact: admin@example.com',
            'https://[2001:db8::1]. Contact: admin@example.com',
        ],
        [
            'https://user:secret@example.org and a@b',
            'https://example.org and a@b',
        ],
        [
            'https://proxy.example.org/fetch?u=https://user:secret@raw.example.org/list.txt',
            'https://proxy.example.org/fetch?u=https://raw.example.org/list.txt',
        ],
        [
            'https://proxy.example.org/r/https://user:secret@raw.example.org/list.txt',
            'https://proxy.example.org/r/https://raw.example.org/list.txt',
        ],
        [
            'https://example.org/a,https://user:secret@raw.example.org/list.txt',
            'https://example.org/a,https://raw.example.org/list.txt',
        ],
    ])('strips credentials from %s', (url, expected) => {
        expect(utils.stripUrlValueCredentials(url)).toBe(expected);
    });

    it('returns a non-string value unchanged', () => {
        expect(utils.stripUrlValueCredentials(undefined)).toBeUndefined();
        expect(utils.stripUrlValueCredentials(null)).toBeNull();
    });
});

describe('stripKnownUrlCredentials', () => {
    it.each([
        [
            'https://user:secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user:secret@example.org',
            'https://example.org',
        ],
        [
            "https://o'brien:secret@example.org/list.txt",
            'https://example.org/list.txt',
        ],
        [
            "https://o'brien:secret@example.org",
            'https://example.org',
        ],
        [
            'https://John Smith:secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://John Smith:secret@example.org',
            'https://example.org',
        ],
        [
            'https://user: secret@example.org/list.txt',
            'https://example.org/list.txt',
        ],
        [
            'https://user: secret@example.org',
            'https://example.org',
        ],
        [
            'https://user:p@s s@example.invalid/list.txt',
            'https://example.invalid/list.txt',
        ],
        [
            ' https://user:p s s@example.invalid/list.txt',
            ' https://example.invalid/list.txt',
        ],
        [
            '<https://user:p"s s@example.org/>',
            '<https://example.org/>',
        ],
        [
            'See https://user:p"q"@example.org/list.txt',
            'See https://example.org/list.txt',
        ],
        [
            'https://example.org:8080/list.txt',
            'https://example.org:8080/list.txt',
        ],
        [
            'C:\\user:secret@example.org\\list.txt',
            'C:\\user:secret@example.org\\list.txt',
        ],
        [
            'C:/user@corp/list.txt',
            'C:/user@corp/list.txt',
        ],
        [
            'https://proxy.example.org/fetch?u=https://user:secret@raw.example.org/list.txt',
            'https://proxy.example.org/fetch?u=https://raw.example.org/list.txt',
        ],
        [
            'https://proxy.example.org/r/https://user:secret@raw.example.org/list.txt',
            'https://proxy.example.org/r/https://raw.example.org/list.txt',
        ],
        [
            'https://example.org/a,https://user:secret@raw.example.org/list.txt',
            'https://example.org/a,https://raw.example.org/list.txt',
        ],
    ])('strips credentials from %s', (url, expected) => {
        expect(utils.stripKnownUrlCredentials(url)).toBe(expected);
    });

    it('returns a non-string value unchanged', () => {
        expect(utils.stripKnownUrlCredentials(undefined)).toBeUndefined();
        expect(utils.stripKnownUrlCredentials(null)).toBeNull();
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

    it('sanitizes known URL fields with whitespace and quotes in userinfo', () => {
        const configuration = {
            homepage: 'https://user:p s s@example.org/',
            sources: [
                {
                    source: 'https://user:p s s@example.org/list.txt',
                    exclusions_sources: ['https://user:p s s@example.org/exclusions.txt'],
                    inclusions_sources: ['https://user:p"s@example.org/inclusions.txt'],
                },
            ],
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.homepage).toBe('https://example.org/');
        expect(sanitized.sources[0].source).toBe('https://example.org/list.txt');
        expect(sanitized.sources[0].exclusions_sources).toEqual(['https://example.org/exclusions.txt']);
        expect(sanitized.sources[0].inclusions_sources).toEqual(['https://example.org/inclusions.txt']);
        expect(configuration.homepage).toBe('https://user:p s s@example.org/');
    });

    it('sanitizes known URL fields with a quote or space in the username', () => {
        const configuration = {
            homepage: "https://o'brien:secret@example.org",
            sources: [
                {
                    source: 'https://John Smith:secret@example.org/list.txt',
                },
            ],
            exclusions_sources: ['https://user: secret@example.org/exclusions.txt'],
            inclusions_sources: 'https://user:p@s s@example.org/inclusions.txt',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.homepage).toBe('https://example.org');
        expect(sanitized.sources[0].source).toBe('https://example.org/list.txt');
        expect(sanitized.exclusions_sources).toEqual(['https://example.org/exclusions.txt']);
        expect(sanitized.inclusions_sources).toBe('https://example.org/inclusions.txt');
        expect(configuration.homepage).toBe("https://o'brien:secret@example.org");
        expect(configuration.sources[0].source).toBe('https://John Smith:secret@example.org/list.txt');
    });

    it('sanitizes path-less known URL fields with a literal @ in the password', () => {
        const configuration = {
            homepage: 'https://user:p@s s@example.org',
            sources: [
                {
                    source: 'https://user:p@s s@example.org',
                    exclusions_sources: ['https://user:p@s s@example.org'],
                    inclusions_sources: 'https://user:p@s s@example.org',
                },
            ],
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.homepage).toBe('https://example.org');
        expect(sanitized.sources[0].source).toBe('https://example.org');
        expect(sanitized.sources[0].exclusions_sources).toEqual(['https://example.org']);
        expect(sanitized.sources[0].inclusions_sources).toBe('https://example.org');
        expect(configuration.homepage).toBe('https://user:p@s s@example.org');
    });

    it('keeps prose that looks like a port', () => {
        const configuration = {
            description: 'https://example.org:8080 by admin@example.com',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.description).toBe(configuration.description);
    });

    it('keeps prose with a port on a host-like token and punctuation', () => {
        const configuration = {
            description: 'Mirror at https://example.org:8080, contact admin@example.com',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.description).toBe(configuration.description);
    });

    it('keeps prose that starts a label after a URL', () => {
        const configuration = {
            description: 'https://example.org team: contact@example.com',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.description).toBe(configuration.description);
    });

    it('sanitizes a description with a space in the username and after the password colon', () => {
        const configuration = {
            description: 'Mirror https://John Smith: secret@example.org',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.description).toBe('Mirror https://example.org');
    });

    it('sanitizes a description with a numeric password followed by punctuation', () => {
        const configuration = {
            description: 'Mirror https://user:1234, secret@example.org/list.txt',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.description).toBe('Mirror https://example.org/list.txt');
    });

    it('sanitizes values under unknown keys with the strict parser', () => {
        const configuration = {
            name: 'test',
            sources: [
                {
                    url: 'https://John Smith: secret@example.org',
                },
            ],
            unknown: 'https://user:1234, secret@example.org/list.txt',
            // A path-less value with a literal `@` and a space in the password
            // is sanitized only by the strict parser.
            unknownLiteralAt: 'https://user:p@s s@example.org',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.sources[0].url).toBe('https://example.org');
        expect(sanitized.unknown).toBe('https://example.org/list.txt');
        expect(sanitized.unknownLiteralAt).toBe('https://example.org');
        expect(configuration.sources[0].url).toBe('https://John Smith: secret@example.org');
        expect(configuration.unknown).toBe('https://user:1234, secret@example.org/list.txt');
        expect(configuration.unknownLiteralAt).toBe('https://user:p@s s@example.org');
    });

    it('sanitizes nested values under unknown keys', () => {
        const configuration = {
            unknown: {
                nested: ['https://John Smith: secret@example.org'],
            },
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.unknown.nested).toEqual(['https://example.org']);
    });

    it('sanitizes URL object keys', () => {
        const configuration = {
            'https://user:secret@example.org/key.txt': 'value',
            'https://user:p"s@example.org/other.txt': 'value',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized['https://example.org/key.txt']).toBe('value');
        expect(sanitized['https://example.org/other.txt']).toBe('value');
        expect(configuration['https://user:secret@example.org/key.txt']).toBe('value');
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

    it('sanitizes a malformed source string with whitespace in userinfo', () => {
        const configuration = {
            sources: ['https://user:p s s@example.org/source.txt'],
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.sources).toEqual(['https://example.org/source.txt']);
        expect(configuration.sources[0]).toBe('https://user:p s s@example.org/source.txt');
    });

    it('does not change prose that starts with a URL', () => {
        const configuration = {
            description: 'https://example.org is maintained by user@example.com',
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.description).toBe(configuration.description);
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

    it('sanitizes a configuration that is itself a class instance', () => {
        class Configuration {
            constructor() {
                this.sources = [
                    { source: 'https://user:secret@example.org/list.txt' },
                ];
            }
        }

        const configuration = new Configuration();
        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized).toBeInstanceOf(Configuration);
        expect(sanitized.sources[0].source).toBe('https://example.org/list.txt');
        expect(configuration.sources[0].source).toBe('https://user:secret@example.org/list.txt');
    });
});

describe('sanitizeConfigurationForLog', () => {
    it('does not change a configuration with a path-less URL and a later email', () => {
        // Re-scanning the rendered document treated the text between the
        // path-less homepage and the email as userinfo. The description key
        // disappeared and the homepage changed.
        const configuration = {
            homepage: 'https://example.org',
            description: 'admin@example.com',
            sources: [{ source: 'list.txt' }],
        };

        const sanitized = utils.sanitizeConfigurationForLog(configuration);
        const dump = JSON.stringify(sanitized, 0, 4);

        expect(dump).toBe(JSON.stringify(configuration, 0, 4));
    });

    it('does not change a rendered configuration that has no credentials', () => {
        const configuration = {
            homepage: 'https://example.org',
            exclusions: ['@@||good.example^'],
            sources: [{ source: 'lists/a.txt' }],
        };

        const dump = JSON.stringify(utils.sanitizeConfigurationForLog(configuration), 0, 4);

        expect(dump).toBe(JSON.stringify(configuration, 0, 4));
    });

    it('sanitizes a credentialed source in a rendered configuration with exclusions', () => {
        const configuration = {
            homepage: 'https://example.org',
            exclusions: ['@@||good.example^'],
            sources: [{ source: 'https://user:secret@example.org/list.txt' }],
        };

        const dump = JSON.stringify(utils.sanitizeConfigurationForLog(configuration), 0, 4);

        expect(dump).toContain('"homepage": "https://example.org"');
        expect(dump).toContain('"@@||good.example^"');
        expect(dump).toContain('"source": "https://example.org/list.txt"');
        expect(dump).not.toContain('secret');
    });

    it('sanitizes a URL object, a serialized value, and URL-like keys', () => {
        class Serialized {
            toJSON() {
                return 'https://user:secret@example.org/serialized.txt';
            }
        }

        const configuration = {
            homepage: new URL('https://user:secret@example.org/'),
            description: new Serialized(),
            'https://user:secret@example.org/key.txt': 'value',
            sources: [{ source: 'https://example.org/list.txt' }],
        };

        const dump = JSON.stringify(utils.sanitizeConfigurationForLog(configuration));

        expect(dump).toContain('"homepage":"https://example.org/"');
        expect(dump).toContain('"description":"https://example.org/serialized.txt"');
        expect(dump).toContain('"https://example.org/key.txt":"value"');
        expect(dump).not.toContain('secret');
    });

    it('sanitizes URL-like keys introduced by toJSON', () => {
        class Configuration {
            toJSON() {
                return {
                    'https://user:secret@example.org/key.txt': 'value',
                };
            }
        }

        const dump = JSON.stringify(utils.sanitizeConfigurationForLog(new Configuration()));

        expect(dump).toContain('"https://example.org/key.txt":"value"');
        expect(dump).not.toContain('secret');
    });

    it('does not change the original configuration', () => {
        const configuration = {
            homepage: new URL('https://user:secret@example.org/'),
        };

        utils.sanitizeConfigurationForLog(configuration);

        expect(configuration.homepage.href).toBe('https://user:secret@example.org/');
    });
});

describe('stripErrorCredentials', () => {
    it('sanitizes the message, stack, and cause chain in place', () => {
        const aggregateError = new global.AggregateError([
            new Error('aggregate https://user:secret@example.net/aggregate.txt'),
        ]);
        const innerError = new Error('inner https:///user:secret@example.org/inner.txt');
        innerError.cause = aggregateError;

        const error = new Error('outer https://user:secret@example.org/outer.txt');
        error.stack = 'Error: outer https://user:secret@example.org/outer.txt\n    at test';
        error.cause = innerError;

        const sanitized = utils.stripErrorCredentials(error);

        expect(sanitized).toBe(error);
        expect(error.message).toBe('outer https://example.org/outer.txt');
        expect(error.stack).toBe('Error: outer https://example.org/outer.txt\n    at test');
        expect(error.cause.message).toBe('inner https:///example.org/inner.txt');
        expect(error.cause.cause.errors[0].message).toBe('aggregate https://example.net/aggregate.txt');
        expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain('secret');
    });

    it('sanitizes a string cause and a string in the errors array', () => {
        const error = new Error('outer');
        error.cause = 'cause https://user:secret@example.org/cause.txt';
        error.errors = ['aggregate https://user:secret@example.net/aggregate.txt'];

        utils.stripErrorCredentials(error);

        expect(error.cause).toBe('cause https://example.org/cause.txt');
        expect(error.errors).toEqual(['aggregate https://example.net/aggregate.txt']);
    });

    it('applies exact replacements before the generic scan', () => {
        const raw = 'https:///user:p@s s@example.invalid/list.txt';
        const sanitized = 'https:///example.invalid/list.txt';
        const error = new Error(`Failed to request url '${raw}'`);

        utils.stripErrorCredentials(error, [[raw, sanitized]]);

        expect(error.message).toBe(`Failed to request url '${sanitized}'`);
    });

    it('returns primitive values unchanged', () => {
        expect(utils.stripErrorCredentials('https://user:secret@example.org/')).toBe('https://user:secret@example.org/');
        expect(utils.stripErrorCredentials(undefined)).toBeUndefined();
        expect(utils.stripErrorCredentials(null)).toBeNull();
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

describe('stripConfigurationCredentials with nested URLs', () => {
    it('sanitizes a URL nested in another URL with the strict parser', () => {
        const configuration = {
            homepage: 'https://proxy.example.org/fetch?u=https://user:secret@raw.example.org/list.txt',
            sources: [
                {
                    source: 'https://proxy.example.org/r/https://user:secret@raw.example.org/list.txt',
                },
            ],
        };

        const sanitized = utils.stripConfigurationCredentials(configuration);

        expect(sanitized.homepage).toBe('https://proxy.example.org/fetch?u=https://raw.example.org/list.txt');
        expect(sanitized.sources[0].source).toBe(
            'https://proxy.example.org/r/https://raw.example.org/list.txt',
        );
        expect(configuration.homepage).toBe(
            'https://proxy.example.org/fetch?u=https://user:secret@raw.example.org/list.txt',
        );
    });
});
