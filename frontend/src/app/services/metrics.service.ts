/**
 * MetricsService
 *
 * Wraps /api/metrics and /api/health endpoints. Centralises API calls
 * that were previously made directly in HomeComponent via HttpClient.
 */

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

/** Metrics response from /api/metrics */
export interface MetricsResponse {
    readonly totalRequests: number;
    readonly averageDuration: number;
    readonly cacheHitRate: number;
    readonly successRate: number;
}

/** Health response from /api/health */
export interface HealthResponse {
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly version: string;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
    private readonly http = inject(HttpClient);
    private readonly apiBaseUrl = inject(API_BASE_URL);

    /** Fetch compilation metrics */
    getMetrics(): Observable<MetricsResponse> {
        return this.http.get<MetricsResponse>(`${this.apiBaseUrl}/metrics`);
    }

    /** Fetch system health status */
    getHealth(): Observable<HealthResponse> {
        return this.http.get<HealthResponse>(`${this.apiBaseUrl}/health`);
    }
}
