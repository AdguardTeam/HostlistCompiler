import { assertEquals } from '@std/assert';
import { ExcludeTransformation } from './ExcludeTransformation.ts';
import { Wildcard } from '../utils/Wildcard.ts';

Deno.test('ExcludeTransformation - should exclude rules matching pattern', () => {
    const transformation = new ExcludeTransformation();
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
    const transformation = new ExcludeTransformation();
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
    const transformation = new ExcludeTransformation();
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
    const transformation = new ExcludeTransformation();
    const rules = [
        '||example.org^',
        '||test.com^',
    ];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, []);
    
    assertEquals(result, rules);
});

Deno.test('ExcludeTransformation - should handle empty rules array', () => {
    const transformation = new ExcludeTransformation();
    const wildcards = [new Wildcard('*example*')];
    
    const result = ExcludeTransformation.excludeWithWildcards([], wildcards);
    
    assertEquals(result, []);
});

Deno.test('ExcludeTransformation - should handle exact matches', () => {
    const transformation = new ExcludeTransformation();
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
    const transformation = new ExcludeTransformation();
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
    const transformation = new ExcludeTransformation();
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
    const transformation = new ExcludeTransformation();
    const rules = [
        '||example.org^',
        '||test.com^',
        '||other.net^',
    ];
    const wildcards = [new Wildcard('*nonexistent*')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    assertEquals(result, rules);
});

Deno.test('ExcludeTransformation - should handle case-sensitive matching', () => {
    const transformation = new ExcludeTransformation();
    const rules = [
        '||Example.org^',
        '||example.org^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('*example.org*')];
    
    const result = ExcludeTransformation.excludeWithWildcards(rules, wildcards);
    
    // Should only exclude the lowercase match
    assertEquals(result, ['||Example.org^', '||test.com^']);
});
