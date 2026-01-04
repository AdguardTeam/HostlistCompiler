/**
 * Tests for checksum utilities
 */

import { assertEquals, assertExists } from '@std/assert';
import { calculateChecksum, addChecksumToHeader } from './checksum.ts';

Deno.test('calculateChecksum - should generate a checksum for simple content', async () => {
    const lines = [
        '||example.com^',
        '||test.com^',
    ];
    
    const checksum = await calculateChecksum(lines);
    
    assertExists(checksum);
    assertEquals(checksum.length, 27);
    // Checksum should be Base64 encoded
    assertEquals(/^[A-Za-z0-9+/=]+$/.test(checksum), true);
});

Deno.test('calculateChecksum - should be deterministic', async () => {
    const lines = [
        '! Title: Test',
        '||example.com^',
        '||test.com^',
    ];
    
    const checksum1 = await calculateChecksum(lines);
    const checksum2 = await calculateChecksum(lines);
    
    assertEquals(checksum1, checksum2);
});

Deno.test('calculateChecksum - should ignore existing checksum lines', async () => {
    const linesWithChecksum = [
        '! Title: Test',
        '! Checksum: oldchecksum123',
        '||example.com^',
    ];
    
    const linesWithoutChecksum = [
        '! Title: Test',
        '||example.com^',
    ];
    
    const checksum1 = await calculateChecksum(linesWithChecksum);
    const checksum2 = await calculateChecksum(linesWithoutChecksum);
    
    assertEquals(checksum1, checksum2);
});

Deno.test('calculateChecksum - should produce different checksums for different content', async () => {
    const lines1 = ['||example.com^'];
    const lines2 = ['||test.com^'];
    
    const checksum1 = await calculateChecksum(lines1);
    const checksum2 = await calculateChecksum(lines2);
    
    assertEquals(checksum1 !== checksum2, true);
});

Deno.test('addChecksumToHeader - should add checksum before Compiled by line', async () => {
    const lines = [
        '!',
        '! Title: Test Filter',
        '! Last modified: 2026-01-04T00:00:00.000Z',
        '!',
        '! Compiled by @jk-com/adblock-compiler v0.6.88',
        '!',
        '||example.com^',
    ];
    
    const result = await addChecksumToHeader(lines);
    
    // Should have one more line than original
    assertEquals(result.length, lines.length + 1);
    
    // Find the checksum line
    const checksumLine = result.find(line => line.startsWith('! Checksum:'));
    assertExists(checksumLine);
    
    // Checksum should be before "Compiled by"
    const checksumIndex = result.indexOf(checksumLine!);
    const compiledByIndex = result.findIndex(line => line.includes('Compiled by'));
    assertEquals(checksumIndex < compiledByIndex, true);
});

Deno.test('addChecksumToHeader - should add checksum with correct format', async () => {
    const lines = [
        '! Title: Test',
        '||example.com^',
    ];
    
    const result = await addChecksumToHeader(lines);
    
    const checksumLine = result.find(line => line.startsWith('! Checksum:'));
    assertExists(checksumLine);
    
    // Should match format: "! Checksum: <base64>"
    assertEquals(/^! Checksum: [A-Za-z0-9+/=]{27}$/.test(checksumLine!), true);
});

Deno.test('addChecksumToHeader - should handle lists without Compiled by line', async () => {
    const lines = [
        '! Title: Test',
        '||example.com^',
    ];
    
    const result = await addChecksumToHeader(lines);
    
    // Should have checksum added
    const checksumLine = result.find(line => line.startsWith('! Checksum:'));
    assertExists(checksumLine);
});

Deno.test('addChecksumToHeader - calculated checksum should validate the content', async () => {
    const lines = [
        '! Title: Test',
        '! Last modified: 2026-01-04T00:00:00.000Z',
        '!',
        '! Compiled by @jk-com/adblock-compiler v0.6.88',
        '!',
        '||example.com^',
    ];
    
    const withChecksum = await addChecksumToHeader(lines);
    
    // Extract the checksum
    const checksumLine = withChecksum.find(line => line.startsWith('! Checksum:'));
    const extractedChecksum = checksumLine!.replace('! Checksum: ', '');
    
    // Calculate checksum of the result (which should ignore the checksum line)
    const recalculated = await calculateChecksum(withChecksum);
    
    assertEquals(extractedChecksum, recalculated);
});
