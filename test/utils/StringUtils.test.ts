import { StringUtils } from '../../src/utils/StringUtils';

describe('StringUtils', () => {
    describe('substringBetween', () => {
        it('should extract substring between tags', () => {
            expect(StringUtils.substringBetween('||example.org^', '||', '^')).toBe('example.org');
        });

        it('should return null for empty string', () => {
            expect(StringUtils.substringBetween('', '||', '^')).toBe(null);
        });

        it('should return null for null input', () => {
            expect(StringUtils.substringBetween(null, '||', '^')).toBe(null);
        });

        it('should return null if tags not found', () => {
            expect(StringUtils.substringBetween('example.org', '||', '^')).toBe(null);
        });

        it('should handle nested tags', () => {
            expect(StringUtils.substringBetween('start||middle^end', '||', '^')).toBe('middle');
        });
    });

    describe('splitByDelimiterWithEscapeCharacter', () => {
        it('should split by comma', () => {
            const result = StringUtils.splitByDelimiterWithEscapeCharacter('a,b,c', ',', '\\', false);
            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('should handle escaped delimiters', () => {
            const result = StringUtils.splitByDelimiterWithEscapeCharacter('a\\,b,c', ',', '\\', false);
            expect(result).toEqual(['a,b', 'c']);
        });

        it('should return empty array for null input', () => {
            expect(StringUtils.splitByDelimiterWithEscapeCharacter(null, ',', '\\', false)).toEqual([]);
        });

        it('should preserve all tokens when requested', () => {
            const result = StringUtils.splitByDelimiterWithEscapeCharacter('a,,c', ',', '\\', true);
            expect(result).toEqual(['a', '', 'c']);
        });

        it('should skip empty tokens when not preserving', () => {
            const result = StringUtils.splitByDelimiterWithEscapeCharacter('a,,c', ',', '\\', false);
            expect(result).toEqual(['a', 'c']);
        });
    });

    describe('escapeRegExp', () => {
        it('should escape special regex characters', () => {
            expect(StringUtils.escapeRegExp('.*+?^${}()|[]\\'))
                .toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
        });

        it('should not modify regular strings', () => {
            expect(StringUtils.escapeRegExp('example')).toBe('example');
        });
    });

    describe('isEmpty', () => {
        it('should return true for null', () => {
            expect(StringUtils.isEmpty(null)).toBe(true);
        });

        it('should return true for undefined', () => {
            expect(StringUtils.isEmpty(undefined)).toBe(true);
        });

        it('should return true for empty string', () => {
            expect(StringUtils.isEmpty('')).toBe(true);
        });

        it('should return true for whitespace only', () => {
            expect(StringUtils.isEmpty('   ')).toBe(true);
        });

        it('should return false for non-empty string', () => {
            expect(StringUtils.isEmpty('test')).toBe(false);
        });
    });

    describe('trim', () => {
        it('should trim spaces and tabs', () => {
            expect(StringUtils.trim('  \ttest\t  ', ' \t')).toBe('test');
        });

        it('should handle custom characters', () => {
            expect(StringUtils.trim('---test---', '-')).toBe('test');
        });
    });
});
