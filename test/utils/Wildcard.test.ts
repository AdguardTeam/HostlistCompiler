import { Wildcard } from '../../src/utils/Wildcard';

describe('Wildcard', () => {
    describe('constructor', () => {
        it('should throw error for empty pattern', () => {
            expect(() => new Wildcard('')).toThrow('Wildcard cannot be empty');
        });

        it('should create plain string pattern', () => {
            const wildcard = new Wildcard('example');
            expect(wildcard.isPlain).toBe(true);
            expect(wildcard.isWildcard).toBe(false);
            expect(wildcard.isRegex).toBe(false);
        });

        it('should create wildcard pattern', () => {
            const wildcard = new Wildcard('*.example.org');
            expect(wildcard.isPlain).toBe(false);
            expect(wildcard.isWildcard).toBe(true);
            expect(wildcard.isRegex).toBe(false);
        });

        it('should create regex pattern', () => {
            const wildcard = new Wildcard('/example\\.org/');
            expect(wildcard.isPlain).toBe(false);
            expect(wildcard.isWildcard).toBe(false);
            expect(wildcard.isRegex).toBe(true);
        });
    });

    describe('test with plain string', () => {
        it('should match substring', () => {
            const wildcard = new Wildcard('example');
            expect(wildcard.test('example.org')).toBe(true);
            expect(wildcard.test('www.example.org')).toBe(true);
        });

        it('should not match non-matching string', () => {
            const wildcard = new Wildcard('example');
            expect(wildcard.test('test.org')).toBe(false);
        });
    });

    describe('test with wildcard pattern', () => {
        it('should match with asterisk', () => {
            const wildcard = new Wildcard('*.example.org');
            expect(wildcard.test('www.example.org')).toBe(true);
            expect(wildcard.test('sub.example.org')).toBe(true);
        });

        it('should match full pattern', () => {
            const wildcard = new Wildcard('||example.org^*');
            expect(wildcard.test('||example.org^')).toBe(true);
            expect(wildcard.test('||example.org^$important')).toBe(true);
        });

        it('should be case insensitive', () => {
            const wildcard = new Wildcard('*.EXAMPLE.org');
            expect(wildcard.test('www.example.org')).toBe(true);
        });
    });

    describe('test with regex pattern', () => {
        it('should match regex', () => {
            const wildcard = new Wildcard('/example\\.org$/');
            expect(wildcard.test('www.example.org')).toBe(true);
            expect(wildcard.test('example.org')).toBe(true);
        });

        it('should not match non-matching regex', () => {
            const wildcard = new Wildcard('/^www\\./');
            expect(wildcard.test('example.org')).toBe(false);
        });

        it('should support multiline flag', () => {
            const wildcard = new Wildcard('/^example/');
            expect(wildcard.test('example.org')).toBe(true);
        });
    });

    describe('test error handling', () => {
        it('should throw error for non-string input', () => {
            const wildcard = new Wildcard('example');
            expect(() => wildcard.test(123 as unknown as string)).toThrow('Invalid argument passed to Wildcard.test');
        });
    });

    describe('toString', () => {
        it('should return original pattern', () => {
            const wildcard = new Wildcard('*.example.org');
            expect(wildcard.toString()).toBe('*.example.org');
        });
    });

    describe('pattern getter', () => {
        it('should return original pattern', () => {
            const wildcard = new Wildcard('*.example.org');
            expect(wildcard.pattern).toBe('*.example.org');
        });
    });
});
