/**
 * ValidationService — wraps the /api/validate endpoint.
 *
 * Validates adblock filter rules using the backend AGTree parser.
 * Returns structured validation results with error types, line numbers,
 * and color-coded severity levels.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import { ValidationResultSchema, validateResponse } from '../schemas/api-responses';

export interface ValidationError {
    readonly line: number;
    readonly column?: number;
    readonly rule: string;
    readonly errorType: string;
    readonly message: string;
    readonly severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
    readonly success: boolean;
    readonly valid: boolean;
    readonly totalRules: number;
    readonly validRules: number;
    readonly invalidRules: number;
    readonly errors: ValidationError[];
    readonly warnings: ValidationError[];
    readonly duration?: string;
}

export interface ValidateRequest {
    readonly rules: string[];
    readonly strict?: boolean;
}

@Injectable({
    providedIn: 'root',
})
export class ValidationService {
    private readonly http = inject(HttpClient);
    private readonly apiBaseUrl = inject(API_BASE_URL);

    /**
     * Validate one or more filter rules against the backend parser.
     */
    validate(rules: string[], strict = false): Observable<ValidationResult> {
        return this.http
            .post<unknown>(`${this.apiBaseUrl}/validate`, {
                rules,
                strict,
            } satisfies ValidateRequest)
            .pipe(map((raw) => validateResponse(ValidationResultSchema, raw, 'POST /validate')));
    }
}
