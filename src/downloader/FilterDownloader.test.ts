/**
 * Tests for FilterDownloader
 */

import { assertEquals, assertRejects } from '@std/assert';
import { FilterDownloader } from './FilterDownloader.ts';

// Test file content for local file tests
const TEST_DIR = './test_fixtures';

Deno.test('FilterDownloader', async (t) => {
    // Setup: Create test fixtures directory and files
    await Deno.mkdir(TEST_DIR, { recursive: true });

    await t.step('should download and parse simple filter list', async () => {
        const content = `! Title: Test Filter
||example.org^
||test.com^
`;
        const testFile = `${TEST_DIR}/simple.txt`;
        await Deno.writeTextFile(testFile, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(testFile);

        assertEquals(result.length, 3);
        assertEquals(result[0], '! Title: Test Filter');
        assertEquals(result[1], '||example.org^');
        assertEquals(result[2], '||test.com^');
    });

    await t.step('should handle !#if directive with true condition', async () => {
        const content = `||always-included.com^
!#if true
||included-when-true.com^
!#endif
||also-always-included.com^
`;
        const testFile = `${TEST_DIR}/if_true.txt`;
        await Deno.writeTextFile(testFile, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(testFile);

        assertEquals(result.includes('||always-included.com^'), true);
        assertEquals(result.includes('||included-when-true.com^'), true);
        assertEquals(result.includes('||also-always-included.com^'), true);
    });

    await t.step('should handle !#if directive with false condition', async () => {
        const content = `||always-included.com^
!#if false
||excluded-when-false.com^
!#endif
||also-always-included.com^
`;
        const testFile = `${TEST_DIR}/if_false.txt`;
        await Deno.writeTextFile(testFile, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(testFile);

        assertEquals(result.includes('||always-included.com^'), true);
        assertEquals(result.includes('||excluded-when-false.com^'), false);
        assertEquals(result.includes('||also-always-included.com^'), true);
    });

    await t.step('should handle !#if/!#else directive', async () => {
        const content = `!#if false
||if-branch.com^
!#else
||else-branch.com^
!#endif
`;
        const testFile = `${TEST_DIR}/if_else.txt`;
        await Deno.writeTextFile(testFile, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(testFile);

        assertEquals(result.includes('||if-branch.com^'), false);
        assertEquals(result.includes('||else-branch.com^'), true);
    });

    await t.step('should handle nested !#if directives', async () => {
        const content = `!#if true
||outer-if.com^
!#if true
||nested-if.com^
!#endif
||after-nested.com^
!#endif
`;
        const testFile = `${TEST_DIR}/nested_if.txt`;
        await Deno.writeTextFile(testFile, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(testFile);

        assertEquals(result.includes('||outer-if.com^'), true);
        assertEquals(result.includes('||nested-if.com^'), true);
        assertEquals(result.includes('||after-nested.com^'), true);
    });

    await t.step('should handle !#include directive', async () => {
        const mainContent = `||main-filter.com^
!#include included.txt
||after-include.com^
`;
        const includedContent = `||included-rule.com^
`;
        await Deno.writeTextFile(`${TEST_DIR}/main.txt`, mainContent);
        await Deno.writeTextFile(`${TEST_DIR}/included.txt`, includedContent);

        const downloader = new FilterDownloader();
        const result = await downloader.download(`${TEST_DIR}/main.txt`);

        assertEquals(result.includes('||main-filter.com^'), true);
        assertEquals(result.includes('||included-rule.com^'), true);
        assertEquals(result.includes('||after-include.com^'), true);
    });

    await t.step('should detect circular includes', async () => {
        const file1Content = `||file1.com^
!#include circular2.txt
`;
        const file2Content = `||file2.com^
!#include circular1.txt
`;
        await Deno.writeTextFile(`${TEST_DIR}/circular1.txt`, file1Content);
        await Deno.writeTextFile(`${TEST_DIR}/circular2.txt`, file2Content);

        const downloader = new FilterDownloader();
        // Should not throw, but should stop the circular include
        const result = await downloader.download(`${TEST_DIR}/circular1.txt`);

        assertEquals(result.includes('||file1.com^'), true);
        assertEquals(result.includes('||file2.com^'), true);
        // The circular include back to file1 should be skipped
    });

    await t.step('should handle missing include gracefully', async () => {
        const content = `||before-include.com^
!#include nonexistent.txt
||after-include.com^
`;
        await Deno.writeTextFile(`${TEST_DIR}/with_missing_include.txt`, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(`${TEST_DIR}/with_missing_include.txt`);

        assertEquals(result.includes('||before-include.com^'), true);
        assertEquals(result.includes('||after-include.com^'), true);
    });

    await t.step('should handle platform conditions', async () => {
        const content = `||always.com^
!#if adguard
||adguard-only.com^
!#endif
!#if ext_chromium
||chromium-only.com^
!#endif
`;
        const testFile = `${TEST_DIR}/platform.txt`;
        await Deno.writeTextFile(testFile, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(testFile);

        // Without a specific platform, platform-specific rules should be excluded
        assertEquals(result.includes('||always.com^'), true);
        assertEquals(result.includes('||adguard-only.com^'), false);
        assertEquals(result.includes('||chromium-only.com^'), false);
    });

    await t.step('should handle logical operators in conditions', async () => {
        const content = `!#if true && true
||both-true.com^
!#endif
!#if true || false
||one-true.com^
!#endif
!#if !false
||not-false.com^
!#endif
`;
        const testFile = `${TEST_DIR}/logical.txt`;
        await Deno.writeTextFile(testFile, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(testFile);

        assertEquals(result.includes('||both-true.com^'), true);
        assertEquals(result.includes('||one-true.com^'), true);
        assertEquals(result.includes('||not-false.com^'), true);
    });

    await t.step('should throw for non-existent file', async () => {
        const downloader = new FilterDownloader();

        await assertRejects(
            async () => {
                await downloader.download(`${TEST_DIR}/does_not_exist.txt`);
            },
            Error,
            'File not found'
        );
    });

    await t.step('should handle empty file with allowEmptyResponse', async () => {
        await Deno.writeTextFile(`${TEST_DIR}/empty.txt`, '');

        const downloader = new FilterDownloader({ allowEmptyResponse: true });
        const result = await downloader.download(`${TEST_DIR}/empty.txt`);

        assertEquals(result.length, 0); // Empty file returns empty array
    });

    await t.step('static download method should work', async () => {
        const content = '||static-test.com^';
        await Deno.writeTextFile(`${TEST_DIR}/static.txt`, content);

        const result = await FilterDownloader.download(`${TEST_DIR}/static.txt`);

        assertEquals(result.length, 1);
        assertEquals(result[0], '||static-test.com^');
    });

    await t.step('should handle Windows-style line endings', async () => {
        const content = '||line1.com^\r\n||line2.com^\r\n||line3.com^';
        await Deno.writeTextFile(`${TEST_DIR}/crlf.txt`, content);

        const downloader = new FilterDownloader();
        const result = await downloader.download(`${TEST_DIR}/crlf.txt`);

        assertEquals(result.length, 3);
        assertEquals(result[0], '||line1.com^');
        assertEquals(result[1], '||line2.com^');
        assertEquals(result[2], '||line3.com^');
    });

    // Cleanup: Remove test fixtures
    await Deno.remove(TEST_DIR, { recursive: true });
});
