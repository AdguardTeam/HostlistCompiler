/**
 * Handler for POST /api/validate-rule
 *
 * Validates a single adblock filter rule and, when a testUrl is provided,
 * checks whether the rule matches that URL.
 */

import { ValidateRuleRequestSchema } from '../schemas.ts';
import { JsonResponse } from '../utils/response.ts';
import type { ParsedRuleInfo } from '../../src/services/ASTViewerService.ts';
import type { Env } from '../types.ts';

/**
 * Attempts a simple URL-match check against a parsed network rule's properties.
 * Returns undefined when the parsed node does not carry enough information
 * to do a reliable host/URL match (e.g. cosmetic/script rules).
 */
function testRuleAgainstUrl(info: ParsedRuleInfo, testUrl: string): boolean | undefined {
    try {
        const url = new URL(testUrl);
        const hostname = url.hostname;
        const networkPattern = info.properties?.network?.pattern;
        if (!networkPattern) {
            return undefined;
        }
        // Strip leading ||, trailing ^ or / for basic hostname matching
        const cleaned = networkPattern.replace(/^\|\|/, '').replace(/[\^/].*$/, '');
        if (!cleaned) {
            return undefined;
        }
        return hostname === cleaned || hostname.endsWith(`.${cleaned}`);
    } catch {
        return undefined;
    }
}

export async function handleValidateRule(request: Request, _env: Env): Promise<Response> {
    const startTime = Date.now();

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }

    const parsed = ValidateRuleRequestSchema.safeParse(body);
    if (!parsed.success) {
        return JsonResponse.error(parsed.error.issues.map((i) => i.message).join('; '), 422);
    }

    const { rule, testUrl, strict } = parsed.data;

    try {
        const { ASTViewerService } = await import('../../src/services/ASTViewerService.ts');

        // When strict mode is requested, run the non-tolerant parser first.
        // The strict parser (tolerant: false) rejects rules that would otherwise
        // be silently accepted, such as those with unrecognised modifiers or
        // malformed patterns that the tolerant parser falls back on.
        if (strict) {
            const { AGTreeParser } = await import('../../src/utils/AGTreeParser.ts');
            try {
                AGTreeParser.parseStrict(rule);
            } catch (strictErr) {
                const message = strictErr instanceof Error ? strictErr.message : String(strictErr);
                return JsonResponse.success({
                    valid: false,
                    rule,
                    error: message,
                    duration: `${Date.now() - startTime}ms`,
                });
            }
        }

        const result: ParsedRuleInfo = ASTViewerService.parseRule(rule);

        const duration = `${Date.now() - startTime}ms`;

        if (!result.success) {
            return JsonResponse.success({
                valid: false,
                rule,
                ruleType: result.type,
                error: result.error,
                duration,
            });
        }

        let matchResult: boolean | undefined;
        if (testUrl) {
            matchResult = testRuleAgainstUrl(result, testUrl);
        }

        return JsonResponse.success({
            valid: true,
            rule,
            ruleType: result.type,
            category: result.category,
            syntax: result.syntax,
            ast: result.ast ?? null,
            ...(testUrl !== undefined && { testUrl, matchResult }),
            duration,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}
