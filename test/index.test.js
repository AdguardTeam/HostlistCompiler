const nock = require('nock');
const consola = require('consola');
const compile = require('../src/index');

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
        expect(list).toContain('||example.org');
        expect(list).toContain('||example.com');

        const str = list.join('\n');
        consola.info(str);

        scope.done();
    });
});
