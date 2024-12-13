const nock = require('nock');
const consola = require('consola');
const compile = require('../src/index');
const { calculateChecksum } = require('../src/utils');

describe('Hostlist compiler', () => {
    describe('Hostlist compiler', () => {
        it('compile from multiple sources', async () => {
            // Prepare source 1
            const scope = nock('https://example.org')
                .get('/source1.txt')
                .reply(200, '||example.org')
                .get('/source2.txt')
                .reply(200, '||example.com');

            // compiler configuration
            const configuration = {
                name: 'Test filter',
                description: 'Our test filter',
                version: '1.0.0.9',
                sources: [
                    {
                        name: 'source 1',
                        source: 'https://example.org/source1.txt',
                    },
                    {
                        name: 'source 2',
                        source: 'https://example.org/source2.txt',
                    },
                ],
            };

            // compile the final list
            const list = await compile(configuration);

            // assert
            expect(list[1].startsWith('! Checksum:')).toBe(true);
            expect(list).toContain('||example.org');
            expect(list).toContain('||example.com');
            expect(list).toContain('! Version: 1.0.0.9');

            const str = list.join('\n');
            consola.info(str);

            scope.done();
        });

        it('calculates checksum correctly', async () => {
            // Prepare source
            const scope = nock('https://example.org')
                .get('/source1.txt')
                .reply(200, '||example.org');

            // compiler configuration
            const configuration = {
                name: 'Test filter',
                description: 'Checksum test filter',
                version: '1.0.0.1',
                sources: [
                    {
                        name: 'source 1',
                        source: 'https://example.org/source1.txt',
                    },
                ],
            };

            // compile the final list
            const list = await compile(configuration);

            // assert
            const checksumLine = list[1];
            expect(checksumLine.startsWith('! Checksum:')).toBe(true);

            const header = list.slice(2, list.indexOf('||example.org'));
            const finalList = list.slice(list.indexOf('||example.org'));

            const expectedChecksum = calculateChecksum(header, finalList);
            expect(checksumLine).toBe(expectedChecksum);

            scope.done();
        });
    });
});
