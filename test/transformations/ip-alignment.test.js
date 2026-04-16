/**
 * IP pipeline alignment tests.
 *
 * Runs the same pattern matrix through processIpRule(), Validate, and
 * ValidateAllowIp to ensure all three agree — and to catch any future
 * divergence caused by editing one module without updating the others.
 */
const { ACTION, processIpRule } = require('../../src/transformations/ip-normalize');
const { validate } = require('../../src/transformations/validate');
const { validateAllowIp } = require('../../src/transformations/validate-allow-ip');

/**
 * Each row: [ input, expectedNormalized, survivesValidate, survivesValidateAllowIp ]
 *
 * expectedNormalized: if processIpRule rewrites the rule, this is the canonical
 *   form; null means processIpRule leaves the input unchanged (keep/allow).
 * survives*: whether the canonical form is kept by that transformation.
 *
 * Note: Validate (without AllowIp) rejects all IP-like patterns regardless of
 * canonical form — IPs are only permitted in the ValidateAllowIp path.
 */
const CASES = [
    // Full 4-octet IPs — already canonical; dropped by Validate, kept by ValidateAllowIp
    ['||1.2.3.4^', null, false, true],
    // Full 4-octet IPs — normalizer rewrites to canonical form first
    ['1.2.3.4', '||1.2.3.4^', false, true],
    ['1.2.3.4^', '||1.2.3.4^', false, true],
    ['1.2.3.4^|', '||1.2.3.4^', false, true],
    ['|1.2.3.4^|', '||1.2.3.4^', false, true],
    ['||1.2.3.4^|', '||1.2.3.4^', false, true],
    // 3-octet subnets with || — normalizer keeps them as-is
    ['||192.168.1.', null, false, true],
    ['||192.168.1.*', null, false, true],
    // 3-octet subnets without || — normalizer adds the prefix
    ['192.168.1.', '||192.168.1.', false, true],
    ['192.168.1.*', '||192.168.1.*', false, true],
    ['||192.168.1.^|', null, false, false],
    // Patterns rejected by all validators
    ['||1.2.3^', null, false, false],
    ['||1.2^', null, false, false],
    ['192.168.1', null, false, false],
];

describe('IP pipeline alignment: processIpRule / Validate / ValidateAllowIp', () => {
    it.each(CASES)(
        'input=%s, normalized=%s, validate=%s, allowIp=%s',
        (input, expectedNorm, expectsValidate, expectsAllowIp) => {
            // 1. Normalization step
            const result = processIpRule(input);
            const canonical = result.action === ACTION.NORMALIZE ? result.normalized : input;

            if (expectedNorm !== null) {
                expect(canonical).toBe(expectedNorm);
            } else {
                expect(canonical).toBe(input);
            }

            // 2. Validate — receives the canonical form (no IP normalization in this path)
            expect(validate([canonical]).includes(canonical)).toBe(expectsValidate);

            // 3. ValidateAllowIp — receives the raw input (it runs normalization internally)
            expect(validateAllowIp([input]).includes(canonical)).toBe(expectsAllowIp);
        },
    );
});
