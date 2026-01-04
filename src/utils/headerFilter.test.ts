/**
 * Tests for header filtering utilities
 */

import { assertEquals } from '@std/assert';
import { stripUpstreamHeaders } from './headerFilter.ts';

Deno.test('stripUpstreamHeaders - should remove Title header', () => {
    const lines = [
        '! Title: AdGuard DNS Filter',
        '||example.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    assertEquals(result.includes('! Title: AdGuard DNS Filter'), false);
    assertEquals(result.includes('||example.com^'), true);
});

Deno.test('stripUpstreamHeaders - should remove all metadata headers', () => {
    const lines = [
        '!',
        '! Title: AdGuard DNS Filter',
        '! Description: Filter for blocking ads',
        '! Homepage: https://github.com/example',
        '! License: GPL-3.0',
        '! Last modified: 2026-01-04T00:00:00.000Z',
        '!',
        '! Compiled by @adguard/hostlist-compiler v1.0.38',
        '!',
        '||example.com^',
        '||test.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    // All metadata headers should be removed
    assertEquals(result.some(line => line.includes('Title:')), false);
    assertEquals(result.some(line => line.includes('Description:')), false);
    assertEquals(result.some(line => line.includes('Homepage:')), false);
    assertEquals(result.some(line => line.includes('License:')), false);
    assertEquals(result.some(line => line.includes('Last modified:')), false);
    assertEquals(result.some(line => line.includes('Compiled by')), false);
    
    // Rules should be preserved
    assertEquals(result.includes('||example.com^'), true);
    assertEquals(result.includes('||test.com^'), true);
});

Deno.test('stripUpstreamHeaders - should preserve informational comments', () => {
    const lines = [
        '! Title: Test Filter',
        '!',
        '! This section contains ad servers',
        '! Good: ||doubleclick.net^$third-party',
        '!',
        '||example.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    // Metadata should be removed
    assertEquals(result.some(line => line.includes('Title:')), false);
    
    // Informational comments should be preserved
    assertEquals(result.some(line => line.includes('This section contains ad servers')), true);
    assertEquals(result.some(line => line.includes('Good: ||doubleclick.net^$third-party')), true);
    
    // Rules should be preserved
    assertEquals(result.includes('||example.com^'), true);
});

Deno.test('stripUpstreamHeaders - should handle lists with no headers', () => {
    const lines = [
        '||example.com^',
        '||test.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    assertEquals(result, lines);
});

Deno.test('stripUpstreamHeaders - should handle empty lists', () => {
    const lines: string[] = [];
    
    const result = stripUpstreamHeaders(lines);
    
    assertEquals(result, []);
});

Deno.test('stripUpstreamHeaders - should remove checksum header', () => {
    const lines = [
        '! Title: Test',
        '! Checksum: abc123',
        '||example.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    assertEquals(result.some(line => line.includes('Checksum:')), false);
    assertEquals(result.includes('||example.com^'), true);
});

Deno.test('stripUpstreamHeaders - should handle complex upstream headers', () => {
    const lines = [
        '!',
        '! Title: AdGuard DNS filter',
        '! Description: Filter composed of several other filters',
        '! Homepage: https://github.com/AdguardTeam/AdguardSDNSFilter',
        '! License: https://github.com/AdguardTeam/AdguardSDNSFilter/blob/master/LICENSE',
        '! Last modified: 2026-01-04T02:52:12.913Z',
        '!',
        '! Compiled by @adguard/hostlist-compiler v1.0.38',
        '!',
        '!',
        '! Source name: AdGuard Base filter ad servers',
        '! Source: https://example.com/filter.txt',
        '!',
        '!',
        '! This section contains the list of third-party advertising networks domains.',
        '!',
        '||doubleclick.net^$third-party',
        '||ads.example.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    // All AdGuard metadata should be removed
    assertEquals(result.some(line => line.includes('Title:')), false);
    assertEquals(result.some(line => line.includes('Description:')), false);
    assertEquals(result.some(line => line.includes('Compiled by @adguard')), false);
    assertEquals(result.some(line => line.includes('Source name:')), false);
    assertEquals(result.some(line => line.includes('Source:')), false);
    
    // Section comments should be preserved
    assertEquals(result.some(line => line.includes('This section contains the list')), true);
    
    // Rules should be preserved
    assertEquals(result.includes('||doubleclick.net^$third-party'), true);
    assertEquals(result.includes('||ads.example.com^'), true);
});

Deno.test('stripUpstreamHeaders - should clean up excessive empty comment markers', () => {
    const lines = [
        '!',
        '!',
        '!',
        '! Title: Test',
        '!',
        '!',
        '||example.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    // Should not have multiple consecutive ! at the start
    const emptyCommentCount = result.filter(line => line.trim() === '!').length;
    assertEquals(emptyCommentCount <= 1, true);
    
    // Rule should be preserved
    assertEquals(result.includes('||example.com^'), true);
});

Deno.test('stripUpstreamHeaders - should preserve rules that start with !', () => {
    const lines = [
        '! Title: Test',
        '@@||example.com^',
        '||test.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    // Metadata should be removed
    assertEquals(result.some(line => line.includes('Title:')), false);
    
    // Allow rule (@@) should be preserved
    assertEquals(result.includes('@@||example.com^'), true);
    assertEquals(result.includes('||test.com^'), true);
});

Deno.test('stripUpstreamHeaders - real world example from problem statement', () => {
    const lines = [
        '!',
        '! Title: Basic AdGuard DNS Filter',
        '! Last modified: 2026-01-04T02:57:05.825Z',
        '!',
        '! Compiled by @jk-com/adblock-compiler v0.6.88',
        '!',
        '!',
        '! Source name: Source 1',
        '! Source: https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
        '!',
        '!',
        '! Title: AdGuard DNS filter',
        '! Description: Filter composed of several other filters',
        '! Homepage: https://github.com/AdguardTeam/AdguardSDNSFilter',
        '! License: https://github.com/AdguardTeam/AdguardSDNSFilter/blob/master/LICENSE',
        '! Last modified: 2026-01-04T02:52:12.913Z',
        '!',
        '! Compiled by @adguard/hostlist-compiler v1.0.38',
        '!',
        '!',
        '! Source name: AdGuard Base filter ad servers',
        '! Source: https://adguardteam.github.io/AdguardFilters/BaseFilter/sections/adservers.txt',
        '!',
        '!',
        '! This section contains the list of third-party advertising networks domains.',
        '||example.com^',
    ];
    
    const result = stripUpstreamHeaders(lines);
    
    // All duplicate/redundant headers should be removed
    assertEquals(result.filter(line => line.includes('Title:')).length, 0);
    assertEquals(result.filter(line => line.includes('Compiled by')).length, 0);
    assertEquals(result.filter(line => line.includes('Source name:')).length, 0);
    assertEquals(result.filter(line => line.includes('Source:')).length, 0);
    
    // Informational comment should be preserved
    assertEquals(result.some(line => line.includes('This section contains')), true);
    
    // Rule should be preserved
    assertEquals(result.includes('||example.com^'), true);
});
