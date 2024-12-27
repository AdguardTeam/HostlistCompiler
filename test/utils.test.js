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

describe('calculateChecksum', () => {
    it('calculates checksum with multiple headers and rules', () => {
        const header = ['! Title: AdGuard DNS filter', '! Title: Example filter list'];
        const rules = ['||example.com^', '||test.com^'];
        const expectedChecksum = '! Checksum: VSbHtv4WyU405Fks327CsA';

        const checksum = utils.calculateChecksum(header, rules);
        expect(checksum).toBe(expectedChecksum);
    });

    it('calculates checksum with empty rules', () => {
        const header = ['[Adblock Plus 2.0]'];
        const rules = [];
        const expectedChecksum = '! Checksum: 87GLA4VsMnV9PiusIkPkEg';

        const checksum = utils.calculateChecksum(header, rules);
        expect(checksum).toBe(expectedChecksum);
    });

    it('calculates checksum with empty header and rules', () => {
        const header = [];
        const rules = [];
        const expectedChecksum = '! Checksum: 1B2M2Y8AsgTpgAmY7PhCfg';

        const checksum = utils.calculateChecksum(header, rules);
        expect(checksum).toBe(expectedChecksum);
    });

    it('calculates checksum without stripping empty lines', () => {
        const header = [
            '! Title: 1Hosts (mini)',
            // eslint-disable-next-line max-len
            '! Description: List for blocking pesky ads, trackers, and malware. Lenient version: unblocks a number of ads & trackers for in-app rewards, anti-AdBlock, etc.',
            '! Version: 1.0.14.48',
            '! Homepage: https://badmojr.github.io/1Hosts/',
            '! Last modified: 2024-12-27T09:45:56.615Z',
            '!',
            '! Compiled by @adguard/hostlist-compiler v1.0.32',
            '!',
        ];
        const rules = [
            '',
            '||logs.netflix.com^',
            '||teams.events.data.microsoft.com^',
            '||measure.office.net^',
            '||app-analytics-services.com^',
        ];
        const expectedChecksum = '! Checksum: 4v+tPGfpA0fy+xfhlr8P6Q';

        const checksum = utils.calculateChecksum(header, rules);
        expect(checksum).toBe(expectedChecksum);
    });
});
