import { assertEquals } from '@std/assert';
import { ExcludeTransformation } from './ExcludeTransformation.ts';
import { Wildcard } from '../utils/Wildcard.ts';

Deno.test('ExcludeTransformation - should exclude rules matching pattern', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||example.com^',
    ];
    const wildcards = [new Wildcard('*example*')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||test.com^']);
});

Deno.test('ExcludeTransformation - should exclude multiple matching rules', () => {
    const rules = [
        '||ads.example.org^',
        '||tracking.example.com^',
        '||safe.org^',
        '||banner.test.com^',
    ];
    const wildcards = [new Wildcard('*example*')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||safe.org^', '||banner.test.com^']);
});

Deno.test('ExcludeTransformation - should handle multiple exclusion patterns', () => {
    const rules = [
        '||ads.example.org^',
        '||tracking.test.com^',
        '||safe.org^',
    ];
    const wildcards = [
        new Wildcard('*example*'),
        new Wildcard('*test*'),
    ];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||safe.org^']);
});

Deno.test('ExcludeTransformation - should return all rules when no wildcards', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
    ];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, []);
    
    assertEquals(result, rules);
});

Deno.test('ExcludeTransformation - should handle empty rules array', () => {
    const wildcards = [new Wildcard('*example*')];
    
    const result = ExcludeTransformation.excludeWithWildcards([], wildcards);
    
    assertEquals(result, []);
});

Deno.test('ExcludeTransformation - should handle exact matches', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||other.net^',
    ];
    const wildcards = [new Wildcard('||example.org^')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||test.com^', '||other.net^']);
});

Deno.test('ExcludeTransformation - should handle wildcard at start', () => {
    const rules = [
        '||example.org^',
        '||my-example.org^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('*example.org^')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||test.com^']);
});

Deno.test('ExcludeTransformation - should handle wildcard at end', () => {
    const rules = [
        '||example.org^',
        '||example.com^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('||example*')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, ['||test.com^']);
});

Deno.test('ExcludeTransformation - should not exclude non-matching rules', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||other.net^',
    ];
    const wildcards = [new Wildcard('*nonexistent*')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, rules);
});

Deno.test('ExcludeTransformation - should handle case-insensitive matching', () => {
    const rules = [
        '||Example.org^',
        '||example.org^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('*example.org*')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    // Should exclude both case variants
    assertEquals(result, ['||test.com^']);
});
