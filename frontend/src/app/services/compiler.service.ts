/**
 * Angular PoC - Compiler API Service
 *
 * Angular 21 Pattern: Service with functional DI using inject()
 * Services are singleton instances that handle business logic and API calls
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, delay, tap } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';
import { LogService } from './log.service';

export interface CompileRequest {
    configuration: {
        name: string;
        sources: Array<{ source: string }>;
        transformations: string[];
    };
    benchmark?: boolean;
}

export interface CompileResponse {
    success: boolean;
    ruleCount: number;
    sources: number;
    transformations: string[];
    message: string;
    benchmark?: {
        duration: string;
        rulesPerSecond: number;
    };
}

export interface AsyncCompileResponse {
    message: string;
    note: string;
    requestId: string;
    priority: string;
}

export interface BatchCompileItem {
    id: string;
    configuration: {
        name: string;
        sources: Array<{ source: string }>;
        transformations: string[];
    };
    benchmark?: boolean;
}

export interface BatchCompileRequest {
    requests: BatchCompileItem[];
}

export interface BatchCompileResult {
    id: string;
    success: boolean;
    ruleCount?: number;
    error?: string;
}

export interface BatchCompileResponse {
    results: BatchCompileResult[];
}

/**
 * CompilerService
 * Angular 21 Pattern: Injectable service using inject() for HttpClient DI
 */
@Injectable({
    providedIn: 'root',
})
export class CompilerService {
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly apiUrl = `${this.apiBaseUrl}/compile`;

    /**
     * Functional dependency injection using inject() (Angular 21 pattern)
     * Can be used in services, components, directives, and pipes
     */
    private readonly http = inject(HttpClient);
    private readonly log = inject(LogService);

    compile(urls: string[], transformations: string[]): Observable<CompileResponse> {
        const payload: CompileRequest = {
            configuration: {
                name: 'Angular PoC Compilation',
                sources: urls.map((url) => ({ source: url })),
                transformations,
            },
            benchmark: true,
        };

        return this.http.post<CompileResponse>(this.apiUrl, payload).pipe(
            tap({ error: (err) => this.log.error('CompilerService.compile failed', 'CompilerService', { error: err instanceof Error ? err.message : String(err) }) }),
            catchError((error) => {
                console.log('API call failed (expected in PoC), returning mock data:', error);
                return of({
                    success: true,
                    ruleCount: 1234,
                    sources: urls.length,
                    transformations: transformations,
                    message: 'Mock compilation result (API not available in PoC)',
                    benchmark: {
                        duration: '123ms',
                        rulesPerSecond: 10000,
                    },
                }).pipe(delay(1000));
            }),
        );
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

    compileAsync(urls: string[], transformations: string[]): Observable<AsyncCompileResponse> {
        const payload: CompileRequest = {
            configuration: {
                name: 'Angular PoC Compilation',
                sources: urls.map((url) => ({ source: url })),
                transformations,
            },
            benchmark: true,
        };
        return this.http.post<AsyncCompileResponse>(`${this.apiUrl}/async`, payload).pipe(
            tap({ error: (err) => this.log.error('CompilerService.compileAsync failed', 'CompilerService', { error: err instanceof Error ? err.message : String(err) }) }),
        );
    }

    compileBatch(items: BatchCompileItem[]): Observable<BatchCompileResponse> {
        const payload: BatchCompileRequest = { requests: items };
        return this.http.post<BatchCompileResponse>(`${this.apiUrl}/batch`, payload).pipe(
            tap({ error: (err) => this.log.error('CompilerService.compileBatch failed', 'CompilerService', { error: err instanceof Error ? err.message : String(err) }) }),
        );
    }
}
