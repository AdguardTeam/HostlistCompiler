const nock = require('nock');
const consola = require('consola');
const path = require('path');
const compile = require('../src/index');

const testDirPath = path.resolve(__dirname, 'resources');
const filterFilePath = path.resolve(testDirPath, 'rules.txt');

describe('Hostlist compiler', () => {
    it('compile from one source with nested includes', async () => {
        // Prepare filters content
        const filterContent1 = `! this is a source
||example.org
||example.com
!#include https://example.org/source2.txt`;

        const filterContent2 = `
||example.net
||example.io
!#include https://example.org/source3.txt`;

        const filterContent3 = `
last.include.com
non/valid_rule`;

        // Prepare source
        const scope = nock('https://example.org')
            .get('/source1.txt')
            .reply(200, filterContent1, {
                'Content-Type': 'text/plain',
            })
            .get('/source2.txt')
            .reply(200, filterContent2, {
                'Content-Type': 'text/plain',
            })
            .get('/source3.txt')
            .reply(200, filterContent3, {
                'Content-Type': 'text/plain',
            });

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
            ],
            transformations: [
                'RemoveComments',
                'Compress',
                'InsertFinalNewLine',
                'Validate',
            ],
        };

        // compile the final list
        const list = await compile(configuration);

        // assert
        const expectedRules = [
            '||example.org',
            '||example.com',
            '||example.net',
            '||example.io',
            '||last.include.com^',
        ];

        expectedRules.forEach((rule) => {
            expect(list).toContain(rule);
        });

        expect(list).not.toContain('non/valid_rule');

        expect(list).toContain('! Version: 1.0.0.9');

        const str = list.join('\n');
        consola.info(str);

        scope.done();
    });

    it('compile from one source with include and exclude file', async () => {
        // Prepare filters content
        const filterContent1 = `! this is a source
ads.example.com
trackers.exclude.com
exclude.com
!#include https://example.org/source2.txt`;

        const filterContent2 = `
popups.com
event.com`;

        const exclusionsContent = `
exclude.com
non/valid_rule`;

        // Prepare source
        const scope = nock('https://example.org')
            .get('/source1.txt')
            .reply(200, filterContent1, {
                'Content-Type': 'text/plain',
            })
            .get('/source2.txt')
            .reply(200, filterContent2, {
                'Content-Type': 'text/plain',
            })
            .get('/exclusions.txt')
            .reply(200, exclusionsContent, {
                'Content-Type': 'text/plain',
            });

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
            ],
            transformations: [
                'RemoveComments',
                'Compress',
                'InsertFinalNewLine',
                'Validate',
            ],
            exclusions_sources: [
                'https://example.org/exclusions.txt',
            ],
        };

        // compile the final list
        const list = await compile(configuration);

        // assert
        const expectedRules = [
            '||ads.example.com^',
            '||popups.com^',
            '||event.com^',
        ];

        expectedRules.forEach((rule) => {
            expect(list).toContain(rule);
        });

        expect(list).not.toContain('||exclude.com^', 'non/valid_rule');

        expect(list).toContain('! Version: 1.0.0.9');

        const str = list.join('\n');
        consola.info(str);

        scope.done();
    });

    it('compile from local source with local include', async () => {
        // compiler configuration
        const configuration = {
            name: 'Test filter',
            description: 'Our test filter',
            version: '1.0.0.9',
            sources: [
                {
                    name: 'filter',
                    source: filterFilePath,
                },
            ],
            transformations: [
                'RemoveComments',
                'Compress',
                'InsertFinalNewLine',
                'Validate',
            ],
        };

        // compile the final list
        const list = await compile(configuration);

        const str = list.join('\n');
        consola.info(str);

        const expectedRules = [
            '||sat.terithrow2.net^',
            '||sat.fevilsor5.net^',
            '||leegreemula.net^',
            '||should.be.included.com^',
            '||last.rule^',
        ];

        expectedRules.forEach((rule) => {
            expect(list).toContain(rule);
        });
    });
});
