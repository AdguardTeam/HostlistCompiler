import { assertEquals, assertRejects } from '@std/assert';
import { PreprocessorEvaluator, DirectiveType } from './PreprocessorEvaluator.ts';

// Mock logger
const mockLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    trace: () => {},
};

Deno.test('PreprocessorEvaluator - should process lines without directives', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = ['||example.org^', '||test.com^'];
    
    const result = await evaluator.process(lines);
    assertEquals(result, lines);
});

Deno.test('PreprocessorEvaluator - should process !#if with true condition', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '||before.com^',
        '!#if true',
        '||included.com^',
        '!#endif',
        '||after.com^',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||before.com^', '||included.com^', '||after.com^']);
});

Deno.test('PreprocessorEvaluator - should process !#if with false condition', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '||before.com^',
        '!#if false',
        '||excluded.com^',
        '!#endif',
        '||after.com^',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||before.com^', '||after.com^']);
});

Deno.test('PreprocessorEvaluator - should process !#if/!#else with false condition', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '!#if false',
        '||if-branch.com^',
        '!#else',
        '||else-branch.com^',
        '!#endif',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||else-branch.com^']);
});

Deno.test('PreprocessorEvaluator - should process !#if/!#else with true condition', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '!#if true',
        '||if-branch.com^',
        '!#else',
        '||else-branch.com^',
        '!#endif',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||if-branch.com^']);
});

Deno.test('PreprocessorEvaluator - should process nested !#if directives', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '!#if true',
        '||outer.com^',
        '!#if true',
        '||inner.com^',
        '!#endif',
        '!#endif',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||outer.com^', '||inner.com^']);
});

Deno.test('PreprocessorEvaluator - should handle platform conditions', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger, 'windows');
    const lines = [
        '!#if windows',
        '||windows-only.com^',
        '!#endif',
        '!#if mac',
        '||mac-only.com^',
        '!#endif',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||windows-only.com^']);
});

Deno.test('PreprocessorEvaluator - should process !#include directive with loader', async () => {
    const includeLoader = async (path: string) => {
        if (path === 'included.txt') {
            return ['||included.com^'];
        }
        throw new Error('File not found');
    };
    
    const evaluator = new PreprocessorEvaluator(mockLogger, undefined, includeLoader);
    const lines = [
        '||before.com^',
        '!#include included.txt',
        '||after.com^',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||before.com^', '||included.com^', '||after.com^']);
});

Deno.test('PreprocessorEvaluator - should skip !#include without loader', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '||before.com^',
        '!#include included.txt',
        '||after.com^',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||before.com^', '||after.com^']);
});

Deno.test('PreprocessorEvaluator - should handle failed !#include gracefully', async () => {
    const includeLoader = async (_path: string) => {
        throw new Error('File not found');
    };
    
    const evaluator = new PreprocessorEvaluator(mockLogger, undefined, includeLoader);
    const lines = [
        '||before.com^',
        '!#include missing.txt',
        '||after.com^',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||before.com^', '||after.com^']);
});

Deno.test('PreprocessorEvaluator - should skip !#safari_cb_affinity blocks', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '||before.com^',
        '!#safari_cb_affinity(content_blockers)',
        '||safari-only.com^',
        '!#safari_cb_affinity',
        '||after.com^',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||before.com^', '||after.com^']);
});

Deno.test('PreprocessorEvaluator - should validate balanced !#if/!#endif', () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const validLines = [
        '!#if true',
        '||rule.com^',
        '!#endif',
    ];
    
    assertEquals(evaluator.validate(validLines), true);
});

Deno.test('PreprocessorEvaluator - should detect unmatched !#if', () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const invalidLines = [
        '!#if true',
        '||rule.com^',
    ];
    
    assertEquals(evaluator.validate(invalidLines), false);
});

Deno.test('PreprocessorEvaluator - should detect unmatched !#endif', () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const invalidLines = [
        '||rule.com^',
        '!#endif',
    ];
    
    assertEquals(evaluator.validate(invalidLines), false);
});

Deno.test('PreprocessorEvaluator - should validate nested !#if/!#endif', () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const validLines = [
        '!#if true',
        '!#if true',
        '||rule.com^',
        '!#endif',
        '!#endif',
    ];
    
    assertEquals(evaluator.validate(validLines), true);
});

Deno.test('PreprocessorEvaluator - should handle complex boolean expressions', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger, 'windows');
    const lines = [
        '!#if windows && !mac',
        '||windows-not-mac.com^',
        '!#endif',
        '!#if windows || mac',
        '||windows-or-mac.com^',
        '!#endif',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||windows-not-mac.com^', '||windows-or-mac.com^']);
});

Deno.test('PreprocessorEvaluator - should handle empty lines', async () => {
    const evaluator = new PreprocessorEvaluator(mockLogger);
    const lines = [
        '||rule.com^',
        '',
        '!#if true',
        '',
        '||included.com^',
        '',
        '!#endif',
        '',
    ];
    
    const result = await evaluator.process(lines);
    assertEquals(result, ['||rule.com^', '', '', '||included.com^', '', '']);
});
