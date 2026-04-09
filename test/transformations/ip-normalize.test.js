const {
    parseIpPattern,
    normalizeFullIp,
    check3OctetSubnet,
    checkTooWidePattern,
    processIpRule,
    normalizeIpRules,
} = require('../../src/transformations/ip-normalize');

describe('ip-normalize', () => {
    describe('parseIpPattern', () => {
        it('parses full IP without separators', () => {
            const result = parseIpPattern('1.2.3.4');
            expect(result).toEqual({
                prefix: '',
                octets: ['1', '2', '3', '4'],
                hasTrailingDot: false,
                hasTrailingWildcard: false,
                hasCaret: false,
                hasCaretPipe: false,
            });
        });

        it('parses full IP with || and ^', () => {
            const result = parseIpPattern('||1.2.3.4^');
            expect(result).toEqual({
                prefix: '||',
                octets: ['1', '2', '3', '4'],
                hasTrailingDot: false,
                hasTrailingWildcard: false,
                hasCaret: true,
                hasCaretPipe: false,
            });
        });

        it('parses full IP with | and ^', () => {
            const result = parseIpPattern('|1.2.3.4^');
            expect(result).toEqual({
                prefix: '|',
                octets: ['1', '2', '3', '4'],
                hasTrailingDot: false,
                hasTrailingWildcard: false,
                hasCaret: true,
                hasCaretPipe: false,
            });
        });

        it('parses 3-octet subnet with trailing dot', () => {
            const result = parseIpPattern('192.168.1.');
            expect(result).toEqual({
                prefix: '',
                octets: ['192', '168', '1'],
                hasTrailingDot: true,
                hasTrailingWildcard: false,
                hasCaret: false,
                hasCaretPipe: false,
            });
        });

        it('parses 3-octet subnet with trailing wildcard', () => {
            const result = parseIpPattern('||192.168.1.*');
            expect(result).toEqual({
                prefix: '||',
                octets: ['192', '168', '1'],
                hasTrailingDot: false,
                hasTrailingWildcard: true,
                hasCaret: false,
                hasCaretPipe: false,
            });
        });

        it('parses pattern with ^|', () => {
            const result = parseIpPattern('||1.2.3.4^|');
            expect(result).toEqual({
                prefix: '||',
                octets: ['1', '2', '3', '4'],
                hasTrailingDot: false,
                hasTrailingWildcard: false,
                hasCaret: true,
                hasCaretPipe: true,
            });
        });

        it('returns null for non-IP patterns', () => {
            expect(parseIpPattern('example.com')).toBeNull();
            expect(parseIpPattern('||example.com^')).toBeNull();
            expect(parseIpPattern('1.2.3.4.5')).toBeNull();
            expect(parseIpPattern('1.2.3.256')).toBeNull();
            expect(parseIpPattern('1.2.3.abc')).toBeNull();
        });
    });

    describe('normalizeFullIp', () => {
        it('normalizes IP without separators', () => {
            expect(normalizeFullIp('1.2.3.4')).toBe('||1.2.3.4^');
        });

        it('normalizes IP with only ^', () => {
            expect(normalizeFullIp('1.2.3.4^')).toBe('||1.2.3.4^');
        });

        it('normalizes IP with only |', () => {
            expect(normalizeFullIp('|1.2.3.4')).toBe('||1.2.3.4^');
        });

        it('normalizes IP with | and ^', () => {
            expect(normalizeFullIp('|1.2.3.4^')).toBe('||1.2.3.4^');
        });

        it('normalizes IP with only ||', () => {
            expect(normalizeFullIp('||1.2.3.4')).toBe('||1.2.3.4^');
        });

        it('returns null for already correct format', () => {
            expect(normalizeFullIp('||1.2.3.4^')).toBeNull();
        });

        it('returns null for 3-octet patterns', () => {
            expect(normalizeFullIp('192.168.1.')).toBeNull();
            expect(normalizeFullIp('||192.168.1.*')).toBeNull();
        });

        it('returns null for non-IP patterns', () => {
            expect(normalizeFullIp('example.com')).toBeNull();
        });
    });

    describe('check3OctetSubnet', () => {
        it('allows 3-octet with trailing dot', () => {
            expect(check3OctetSubnet('192.168.1.')).toEqual({
                action: 'normalize',
                normalized: '||192.168.1.',
            });
        });

        it('allows 3-octet with trailing wildcard', () => {
            expect(check3OctetSubnet('192.168.1.*')).toEqual({
                action: 'normalize',
                normalized: '||192.168.1.*',
            });
        });

        it('allows 3-octet with || and trailing dot', () => {
            expect(check3OctetSubnet('||192.168.1.')).toEqual({
                action: 'allow',
            });
        });

        it('allows 3-octet with || and trailing wildcard', () => {
            expect(check3OctetSubnet('||192.168.1.*')).toEqual({
                action: 'allow',
            });
        });

        it('rejects 3-octet without trailing dot/wildcard', () => {
            const result = check3OctetSubnet('192.168.1');
            expect(result.action).toBe('reject');
            expect(result.reason).toContain('ambiguous');
        });

        it('rejects 3-octet with || but no trailing dot/wildcard', () => {
            const result = check3OctetSubnet('||192.168.1');
            expect(result.action).toBe('reject');
            expect(result.reason).toContain('ambiguous');
        });

        it('rejects 3-octet with ^', () => {
            const result = check3OctetSubnet('||192.168.1^');
            expect(result.action).toBe('reject');
            expect(result.reason).toContain('does not work');
        });

        it('rejects 3-octet without || but with ^', () => {
            const result = check3OctetSubnet('192.168.1^');
            expect(result.action).toBe('reject');
            expect(result.reason).toContain('does not work');
        });

        it('does not apply to 4-octet patterns', () => {
            expect(check3OctetSubnet('1.2.3.4')).toBeNull();
            expect(check3OctetSubnet('||1.2.3.4^')).toBeNull();
        });

        it('does not apply to non-3-octet patterns', () => {
            expect(check3OctetSubnet('192.168.')).toBeNull();
        });
    });

    describe('checkTooWidePattern', () => {
        it('rejects 1-octet patterns', () => {
            expect(checkTooWidePattern('1.').action).toBe('reject');
            expect(checkTooWidePattern('1.*').action).toBe('reject');
            expect(checkTooWidePattern('||1.').action).toBe('reject');
        });

        it('rejects 2-octet patterns', () => {
            expect(checkTooWidePattern('1.2.').action).toBe('reject');
            expect(checkTooWidePattern('1.2.*').action).toBe('reject');
            expect(checkTooWidePattern('||1.2.').action).toBe('reject');
            expect(checkTooWidePattern('||1.2^').action).toBe('reject');
        });

        it('does not apply to 3-octet patterns', () => {
            expect(checkTooWidePattern('192.168.1.')).toBeNull();
        });

        it('does not apply to 4-octet patterns', () => {
            expect(checkTooWidePattern('1.2.3.4')).toBeNull();
        });

        it('does not apply to non-IP patterns', () => {
            expect(checkTooWidePattern('example.com')).toBeNull();
        });
    });

    describe('processIpRule', () => {
        it('normalizes 4-octet IP without separators', () => {
            expect(processIpRule('1.2.3.4')).toEqual({
                action: 'normalize',
                normalized: '||1.2.3.4^',
            });
        });

        it('normalizes 4-octet IP with modifiers', () => {
            expect(processIpRule('1.2.3.4$important')).toEqual({
                action: 'normalize',
                normalized: '||1.2.3.4^$important',
            });
        });

        it('normalizes 3-octet subnet with trailing dot', () => {
            expect(processIpRule('192.168.1.')).toEqual({
                action: 'normalize',
                normalized: '||192.168.1.',
            });
        });

        it('keeps already correct 4-octet IP', () => {
            expect(processIpRule('||1.2.3.4^')).toEqual({ action: 'keep' });
        });

        it('keeps already correct 3-octet subnet', () => {
            expect(processIpRule('||192.168.1.')).toEqual({ action: 'keep' });
            expect(processIpRule('||192.168.1.*')).toEqual({ action: 'keep' });
        });

        it('rejects 3-octet without trailing dot/wildcard', () => {
            const result = processIpRule('192.168.1');
            expect(result.action).toBe('reject');
        });

        it('rejects 3-octet with ^', () => {
            const result = processIpRule('||192.168.1^');
            expect(result.action).toBe('reject');
        });

        it('rejects 2-octet patterns', () => {
            expect(processIpRule('192.168.').action).toBe('reject');
            expect(processIpRule('||192.168^').action).toBe('reject');
        });

        it('rejects 1-octet patterns', () => {
            expect(processIpRule('1.').action).toBe('reject');
            expect(processIpRule('||1^').action).toBe('reject');
        });

        it('keeps comments', () => {
            expect(processIpRule('! comment')).toEqual({ action: 'keep' });
            expect(processIpRule('# comment')).toEqual({ action: 'keep' });
        });

        it('keeps empty lines', () => {
            expect(processIpRule('')).toEqual({ action: 'keep' });
            expect(processIpRule('   ')).toEqual({ action: 'keep' });
        });

        it('keeps exception rules', () => {
            expect(processIpRule('@@||1.2.3.4^')).toEqual({ action: 'keep' });
        });

        it('normalizes exception rules (@@) with 4-octet IPs', () => {
            expect(processIpRule('@@1.2.3.4')).toEqual({
                action: 'normalize',
                normalized: '@@||1.2.3.4^',
            });
            expect(processIpRule('@@1.2.3.4^')).toEqual({
                action: 'normalize',
                normalized: '@@||1.2.3.4^',
            });
            expect(processIpRule('@@|1.2.3.4^')).toEqual({
                action: 'normalize',
                normalized: '@@||1.2.3.4^',
            });
            expect(processIpRule('@@||1.2.3.4')).toEqual({
                action: 'normalize',
                normalized: '@@||1.2.3.4^',
            });
        });

        it('normalizes exception rules (@@) with 3-octet subnets', () => {
            expect(processIpRule('@@192.168.1.')).toEqual({
                action: 'normalize',
                normalized: '@@||192.168.1.',
            });
            expect(processIpRule('@@192.168.1.*')).toEqual({
                action: 'normalize',
                normalized: '@@||192.168.1.*',
            });
            expect(processIpRule('@@||192.168.1.')).toEqual({ action: 'keep' });
            expect(processIpRule('@@||192.168.1.*')).toEqual({ action: 'keep' });
        });

        it('normalizes exception rules (@@) with modifiers', () => {
            expect(processIpRule('@@1.2.3.4$important')).toEqual({
                action: 'normalize',
                normalized: '@@||1.2.3.4^$important',
            });
        });

        it('rejects exception rules (@@) with unsafe patterns', () => {
            expect(processIpRule('@@192.168.1').action).toBe('reject');
            expect(processIpRule('@@||192.168.1^').action).toBe('reject');
            expect(processIpRule('@@1.2.').action).toBe('reject');
            expect(processIpRule('@@||10^').action).toBe('reject');
        });

        it('keeps domain rules', () => {
            expect(processIpRule('||example.com^')).toEqual({ action: 'keep' });
            expect(processIpRule('example.com')).toEqual({ action: 'keep' });
        });
    });

    describe('normalizeIpRules', () => {
        it('normalizes multiple IP rules', () => {
            const rules = [
                '! comment',
                '1.2.3.4',
                '||5.6.7.8^',
                '192.168.1.',
                '||example.com^',
            ];
            const result = normalizeIpRules(rules);
            expect(result).toEqual([
                '! comment',
                '||1.2.3.4^',
                '||5.6.7.8^',
                '||192.168.1.',
                '||example.com^',
            ]);
        });

        it('removes rejected rules', () => {
            const rules = [
                '||1.2.3.4^',
                '192.168.1', // rejected - ambiguous
                '||192.168^', // rejected - doesn't work
                '1.2.', // rejected - too wide
            ];
            const result = normalizeIpRules(rules);
            expect(result).toEqual(['||1.2.3.4^']);
        });

        it('preserves modifiers during normalization', () => {
            const rules = [
                '1.2.3.4$important',
                '5.6.7.8$client=192.168.1.1',
                '||9.10.11.12^$denyallow=example.com',
            ];
            const result = normalizeIpRules(rules);
            expect(result).toEqual([
                '||1.2.3.4^$important',
                '||5.6.7.8^$client=192.168.1.1',
                '||9.10.11.12^$denyallow=example.com',
            ]);
        });

        it('normalizes and rejects exception rules (@@)', () => {
            const rules = [
                '@@1.2.3.4',
                '@@|5.6.7.8^',
                '@@||9.10.11.12^',
                '@@192.168.1.',
                '@@||10.0.0.',
                '@@192.168.1', // rejected - ambiguous
                '@@1.2.', // rejected - too wide
                '@@||10.0.1^', // rejected - doesn't work
            ];
            const result = normalizeIpRules(rules);
            expect(result).toEqual([
                '@@||1.2.3.4^',
                '@@||5.6.7.8^',
                '@@||9.10.11.12^',
                '@@||192.168.1.',
                '@@||10.0.0.',
            ]);
        });
    });
});
