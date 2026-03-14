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
    ruleCount: number;
    sources: number;
    transformations: string[];
    message: string;
    rules?: string[];
    cached?: boolean;
    benchmark?: {
        duration: string;
        rulesPerSecond: number;
    };
}

export interface AsyncCompileResponse {
    success: boolean;
    requestId: string;
    note: string;
    error?: string;
}

export interface ASTResult {
    success: boolean;
    ast: unknown;
    ruleCount: number;
    parseTime?: string;
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

    /** POST /compile/batch — compile multiple configurations in parallel */
    compileBatch(configurations: CompileRequest['configuration'][], turnstileToken?: string): Observable<CompileResponse[]> {
        return this.http
            .post<unknown>(`${this.apiBaseUrl}/compile/batch`, {
                configurations,
                benchmark: true,
                turnstileToken,
            })
            .pipe(map((raw) => {
                const arr = Array.isArray(raw) ? raw : [];
                return arr.map((item, i) =>
                    validateResponse(CompileResponseSchema, item, `POST /compile/batch[${i}]`),
                );
            }));
    }

    /** POST /compile/batch/async — queue batch for background processing */
    compileBatchAsync(configurations: CompileRequest['configuration'][], turnstileToken?: string): Observable<AsyncCompileResponse> {
        return this.http
            .post<unknown>(`${this.apiBaseUrl}/compile/batch/async`, {
                configurations,
                benchmark: true,
                turnstileToken,
            })
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
