import { assertEquals } from '@std/assert';
import { IncludeTransformation } from './IncludeTransformation.ts';
import { Wildcard } from '../utils/Wildcard.ts';

Deno.test('IncludeTransformation - should include only matching rules', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||example.com^',
    ];
    const wildcards = [new Wildcard('*example*')];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||example.org^', '||example.com^']);
});

Deno.test('IncludeTransformation - should include rules matching any pattern', () => {
    const rules = [
        '||ads.example.org^',
        '||tracking.test.com^',
        '||safe.org^',
        '||banner.other.com^',
    ];
    const wildcards = [
        new Wildcard('*example*'),
        new Wildcard('*test*'),
    ];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||ads.example.org^', '||tracking.test.com^']);
});

Deno.test('IncludeTransformation - should return empty when no wildcards', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
    ];
    
    const result = IncludeTransformation.includeWithWildcards(rules, []);
    
    assertEquals(result, []);
});

Deno.test('IncludeTransformation - should handle empty rules array', () => {
    const wildcards = [new Wildcard('*example*')];
    
    const result = IncludeTransformation.includeWithWildcards([], wildcards);
    
    assertEquals(result, []);
});

Deno.test('IncludeTransformation - should handle exact matches', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||other.net^',
    ];
    const wildcards = [new Wildcard('||example.org^')];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||example.org^']);
});

Deno.test('IncludeTransformation - should handle wildcard at start', () => {
    const rules = [
        '||example.org^',
        '||my-example.org^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('*example.org^')];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||example.org^', '||my-example.org^']);
});

Deno.test('IncludeTransformation - should handle wildcard at end', () => {
    const rules = [
        '||example.org^',
        '||example.com^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('||example*')];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||example.org^', '||example.com^']);
});

Deno.test('IncludeTransformation - should return empty for non-matching rules', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||other.net^',
    ];
    const wildcards = [new Wildcard('*nonexistent*')];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    assertEquals(result, []);
});

Deno.test('IncludeTransformation - should handle case-insensitive matching', () => {
    const rules = [
        '||Example.org^',
        '||example.org^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('*example.org*')];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    // Should include both case variants
    assertEquals(result, ['||Example.org^', '||example.org^']);
});

Deno.test('IncludeTransformation - should include all matching rules', () => {
    const rules = [
        '||ads.example.com^',
        '||tracker.example.org^',
        '||safe.org^',
        '||analytics.example.net^',
    ];
    const wildcards = [new Wildcard('*example*')];
    
    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);
    
    assertEquals(result.length, 3);
    assertEquals(result.includes('||ads.example.com^'), true);
    assertEquals(result.includes('||tracker.example.org^'), true);
    assertEquals(result.includes('||analytics.example.net^'), true);
});
