/**
 * CompilerService — Wraps all /compile/* and /ast/* API endpoints.
 *
 * Provides methods for every compilation mode the worker supports:
 *   - compile()           → POST /compile       (JSON response)
 *   - compileAsync()      → POST /compile/async  (queued, returns requestId)
 *   - compileBatch()      → POST /compile/batch  (multiple configs, JSON)
 *   - compileBatchAsync()→ POST /compile/batch/async (multiple configs, queued)
 *   - astParse()          → POST /ast/parse      (AGTree AST)
 *
 * Angular 21 Pattern: Injectable service with functional DI via inject()
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import {
    CompileResponseSchema,
    AsyncCompileResponseSchema,
    BatchCompileResponseSchema,
    ASTResultSchema,
    validateResponse,
} from '../schemas/api-responses';

export interface CompileRequest {
    configuration: {
        name: string;
        sources: Array<{ source: string; useBrowser?: boolean }>;
        transformations: string[];
    };
    benchmark?: boolean;
    turnstileToken?: string;
}

export interface CompileResponse {
    success: boolean;
    rules?: string[];
    ruleCount?: number;
    sources?: number;
    benchmark?: { duration?: string; startTime?: number; endTime?: number };
    metrics?: {
        totalDuration?: number;
        sourceCount?: number;
        transformationCount?: number;
        inputRuleCount?: number;
        outputRuleCount?: number;
        phases?: Record<string, number>;
    };
    compiledAt?: string;
    previousVersion?: { rules: string[]; ruleCount: number; compiledAt: string };
    cached?: boolean;
    deduplicated?: boolean;
    error?: string;
}

export interface BatchCompileItem extends CompileResponse {
    id: string;
}

export interface AsyncCompileResponse {
    success: boolean;
    requestId: string;
    note: string;
    message?: string;
    batchSize?: number;
    priority?: string;
    error?: string;
}

export interface ASTResult {
    success: boolean;
    parsedRules: unknown;
    summary?: unknown;
    error?: string;
}

@Injectable({
    providedIn: 'root',
})
export class CompilerService {
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly http = inject(HttpClient);

    /** POST /compile — synchronous JSON compilation */
    compile(urls: string[], transformations: string[], turnstileToken?: string): Observable<CompileResponse> {
        const payload: CompileRequest = {
            configuration: {
                name: 'Adblock Compilation',
                sources: urls.map((url) => ({ source: url })),
                transformations,
            },
            benchmark: true,
            turnstileToken,
        };

        return this.http
            .post<unknown>(`${this.apiBaseUrl}/compile`, payload)
            .pipe(map((raw) => validateResponse(CompileResponseSchema, raw, 'POST /compile')));
    }

    /** POST /compile/async — queue for background processing, returns requestId */
    compileAsync(urls: string[], transformations: string[], turnstileToken?: string): Observable<AsyncCompileResponse> {
        const payload: CompileRequest = {
            configuration: {
                name: 'Async Compilation',
                sources: urls.map((url) => ({ source: url })),
                transformations,
            },
            benchmark: true,
            turnstileToken,
        };

        return this.http
            .post<unknown>(`${this.apiBaseUrl}/compile/async`, payload)
            .pipe(map((raw) => validateResponse(AsyncCompileResponseSchema, raw, 'POST /compile/async')));
    }

    /** POST /compile/batch — compile multiple configurations in parallel.
     *
     * The Worker expects `{ requests: [{ id, configuration, benchmark? }] }` and responds
     * with `{ success: true, results: [{ id, ...CompilationResult }] }`.
     */
    compileBatch(configurations: CompileRequest['configuration'][], turnstileToken?: string): Observable<BatchCompileItem[]> {
        const requests = configurations.map((configuration, i) => ({
            id: `batch-${i}`,
            configuration,
            benchmark: true,
        }));
        return this.http
            .post<unknown>(`${this.apiBaseUrl}/compile/batch`, { requests, turnstileToken })
            .pipe(map((raw) => {
                const validated = validateResponse(BatchCompileResponseSchema, raw, 'POST /compile/batch');
                return validated.results;
            }));
    }

    /** POST /compile/batch/async — queue batch for background processing.
     *
     * The Worker expects `{ requests: [{ id, configuration, benchmark? }], priority? }` and
     * responds with a 202 `{ success, requestId, batchSize, ... }`.
     */
    compileBatchAsync(configurations: CompileRequest['configuration'][], turnstileToken?: string): Observable<AsyncCompileResponse> {
        const requests = configurations.map((configuration, i) => ({
            id: `batch-async-${i}`,
            configuration,
            benchmark: true,
        }));
        return this.http
            .post<unknown>(`${this.apiBaseUrl}/compile/batch/async`, { requests, turnstileToken })
            .pipe(map((raw) => validateResponse(AsyncCompileResponseSchema, raw, 'POST /compile/batch/async')));
    }

    /** POST /ast/parse — parse filter rules into AST */
    astParse(rules: string[]): Observable<ASTResult> {
        return this.http
            .post<unknown>(`${this.apiBaseUrl}/ast/parse`, { rules })
            .pipe(map((raw) => validateResponse(ASTResultSchema, raw, 'POST /ast/parse')));
    }

    getAvailableTransformations(): string[] {
        return [
            'RemoveComments',
            'Compress',
            'RemoveModifiers',
            'Validate',
            'ValidateAllowIp',
            'Deduplicate',
            'InvertAllow',
            'RemoveEmptyLines',
            'TrimLines',
            'InsertFinalNewLine',
            'ConvertToAscii',
        ];
    }
}
