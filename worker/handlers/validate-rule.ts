/**
 * Handler for POST /api/validate-rule
 *
 * Validates a single adblock filter rule and, when a testUrl is provided,
 * checks whether the rule matches that URL.
 */

import { ValidateRuleRequestSchema } from '../schemas.ts';
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
        return Response.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
        );
    }

    const parsed = ValidateRuleRequestSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json(
            { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
            { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } },
        );
    }

    const { rule, testUrl } = parsed.data;

    try {
        const { ASTViewerService } = await import('../../src/services/ASTViewerService.ts');
        const result: ParsedRuleInfo = ASTViewerService.parseRule(rule);

        const duration = `${Date.now() - startTime}ms`;

        if (!result.success) {
            return Response.json(
                {
                    success: true,
                    valid: false,
                    rule,
                    ruleType: result.type,
                    error: result.error,
                    duration,
                },
                { headers: { 'Access-Control-Allow-Origin': '*' } },
            );
        }

        let matchResult: boolean | undefined;
        if (testUrl) {
            matchResult = testRuleAgainstUrl(result, testUrl);
        }

        return Response.json(
            {
                success: true,
                valid: true,
                rule,
                ruleType: result.type,
                category: result.category,
                syntax: result.syntax,
                ast: result.ast ?? null,
                ...(testUrl !== undefined && { testUrl, matchResult }),
                duration,
            },
            { headers: { 'Access-Control-Allow-Origin': '*' } },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json(
            { success: false, error: message },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } },
        );
    }
}
