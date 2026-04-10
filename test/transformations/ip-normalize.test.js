const {
    ACTION,
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
                action: ACTION.NORMALIZE,
                normalized: '||192.168.1.',
            });
        });

        it('allows 3-octet with trailing wildcard', () => {
            expect(check3OctetSubnet('192.168.1.*')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '||192.168.1.*',
            });
        });

        it('normalizes 3-octet with single | and trailing dot', () => {
            expect(check3OctetSubnet('|192.168.1.')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '||192.168.1.',
            });
        });

        it('normalizes 3-octet with single | and trailing wildcard', () => {
            expect(check3OctetSubnet('|192.168.1.*')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '||192.168.1.*',
            });
        });

        it('allows 3-octet with || and trailing dot', () => {
            expect(check3OctetSubnet('||192.168.1.')).toEqual({
                action: ACTION.ALLOW,
            });
        });

        it('allows 3-octet with || and trailing wildcard', () => {
            expect(check3OctetSubnet('||192.168.1.*')).toEqual({
                action: ACTION.ALLOW,
            });
        });

        it('rejects 3-octet without trailing dot/wildcard', () => {
            const result = check3OctetSubnet('192.168.1');
            expect(result.action).toBe(ACTION.REJECT);
            expect(result.reason).toContain('ambiguous');
        });

        it('rejects 3-octet with || but no trailing dot/wildcard', () => {
            const result = check3OctetSubnet('||192.168.1');
            expect(result.action).toBe(ACTION.REJECT);
            expect(result.reason).toContain('ambiguous');
        });

        it('rejects 3-octet with ^', () => {
            const result = check3OctetSubnet('||192.168.1^');
            expect(result.action).toBe(ACTION.REJECT);
            expect(result.reason).toContain('does not work');
        });

        it('rejects 3-octet without || but with ^', () => {
            const result = check3OctetSubnet('192.168.1^');
            expect(result.action).toBe(ACTION.REJECT);
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
            expect(checkTooWidePattern('1.').action).toBe(ACTION.REJECT);
            expect(checkTooWidePattern('1.*').action).toBe(ACTION.REJECT);
            expect(checkTooWidePattern('||1.').action).toBe(ACTION.REJECT);
        });

        it('rejects 2-octet patterns', () => {
            expect(checkTooWidePattern('1.2.').action).toBe(ACTION.REJECT);
            expect(checkTooWidePattern('1.2.*').action).toBe(ACTION.REJECT);
            expect(checkTooWidePattern('||1.2.').action).toBe(ACTION.REJECT);
            expect(checkTooWidePattern('||1.2^').action).toBe(ACTION.REJECT);
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

    // processIpRule — only tests logic unique to this function:
    // @@-prefix handling, $modifier extraction, comments/empty lines, domain passthrough.
    // Pattern-level normalize/reject/allow decisions are covered by helper tests above.
    describe('processIpRule', () => {
        it('keeps comments and empty lines', () => {
            expect(processIpRule('! comment')).toEqual({ action: ACTION.KEEP });
            expect(processIpRule('# comment')).toEqual({ action: ACTION.KEEP });
            expect(processIpRule('')).toEqual({ action: ACTION.KEEP });
            expect(processIpRule('   ')).toEqual({ action: ACTION.KEEP });
        });

        it('keeps domain rules unchanged', () => {
            expect(processIpRule('||example.com^')).toEqual({ action: ACTION.KEEP });
            expect(processIpRule('example.com')).toEqual({ action: ACTION.KEEP });
        });

        it('preserves modifiers during normalization', () => {
            expect(processIpRule('1.2.3.4$important')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '||1.2.3.4^$important',
            });
            expect(processIpRule('@@1.2.3.4$important')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '@@||1.2.3.4^$important',
            });
        });

        it('normalizes single-pipe 3-octet subnet to ||', () => {
            expect(processIpRule('|192.168.1.')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '||192.168.1.',
            });
            expect(processIpRule('|192.168.1.*')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '||192.168.1.*',
            });
        });

        it('normalizes exception rules (@@)', () => {
            expect(processIpRule('@@1.2.3.4')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '@@||1.2.3.4^',
            });
            expect(processIpRule('@@|1.2.3.4^')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '@@||1.2.3.4^',
            });
            expect(processIpRule('@@||1.2.3.4')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '@@||1.2.3.4^',
            });
            expect(processIpRule('@@192.168.1.')).toEqual({
                action: ACTION.NORMALIZE,
                normalized: '@@||192.168.1.',
            });
            // already correct — keep as-is
            expect(processIpRule('@@||1.2.3.4^')).toEqual({ action: ACTION.KEEP });
            expect(processIpRule('@@||192.168.1.')).toEqual({ action: ACTION.KEEP });
        });

        it('does not reject invalid @@-patterns — normalization-only, validateAllowIp will reject', () => {
            // processIpRule cannot normalize these, so it keeps them unchanged.
            // Rejection is the sole responsibility of the validator (validate.js),
            // not of the normalizer — that eliminates double-rejection.
            expect(processIpRule('@@192.168.1').action).toBe(ACTION.KEEP);
            expect(processIpRule('@@||192.168.1^').action).toBe(ACTION.KEEP);
            expect(processIpRule('@@1.2.').action).toBe(ACTION.KEEP);
            expect(processIpRule('@@||10^').action).toBe(ACTION.KEEP);
        });
    });

    // normalizeIpRules — one integration test with a mixed list covering
    // normalize, reject, keep, @@, and modifiers in a single scenario.
    describe('normalizeIpRules', () => {
        it('processes a mixed list of rules', () => {
            const rules = [
                // keep
                '! comment',
                '||5.6.7.8^',
                '||example.com^',
                // normalize
                '1.2.3.4',
                '192.168.1.',
                '1.2.3.4$important',
                '5.6.7.8$client=192.168.1.1',
                // normalize @@
                '@@1.2.3.4',
                '@@|5.6.7.8^',
                '@@192.168.1.',
                // normalizeIpRules cannot normalize these — passes them through unchanged.
                // validateAllowIp's validator is the single place responsible for rejecting
                // invalid patterns (separation of concerns, no double-rejection).
                '192.168.1',
                '||192.168^',
                '1.2.',
                '@@192.168.1',
                '@@1.2.',
                '@@||10.0.1^',
            ];
            const result = normalizeIpRules(rules);
            expect(result).toEqual([
                '! comment',
                '||5.6.7.8^',
                '||example.com^',
                '||1.2.3.4^',
                '||192.168.1.',
                '||1.2.3.4^$important',
                '||5.6.7.8^$client=192.168.1.1',
                '@@||1.2.3.4^',
                '@@||5.6.7.8^',
                '@@||192.168.1.',
                // normalizer passes invalid patterns through; validator rejects them
                '192.168.1',
                '||192.168^',
                '1.2.',
                '@@192.168.1',
                '@@1.2.',
                '@@||10.0.1^',
            ]);
        });
    });
});
