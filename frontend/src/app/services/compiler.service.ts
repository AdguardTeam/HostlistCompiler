/**
 * Angular PoC - Compiler API Service
 *
 * Angular 21 Pattern: Service with functional DI using inject()
 * Services are singleton instances that handle business logic and API calls
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, delay } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';

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
}
