/**
 * MetricsStore — Shared singleton signal store for metrics & health data.
 *
 * Centralises API data that multiple components need (Home, Performance)
 * into a single cache-aware store. Uses SwrCacheService for stale-while-
 * revalidate semantics — consumers see cached data immediately while
 * fresh data loads in the background.
 *
 * Angular 21 patterns: signal(), computed(), Injectable, inject()
 */

import { Injectable, inject, computed, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MetricsService, type MetricsResponse, type HealthResponse } from '../services/metrics.service';
import { SwrCacheService, type SwrEntry } from '../services/swr-cache.service';

/** Extended metrics response (PerformanceComponent needs extra fields) */
export interface ExtendedMetricsResponse extends MetricsResponse {
    readonly p95Duration?: number;
    readonly p99Duration?: number;
    readonly endpoints?: EndpointMetric[];
}

export interface EndpointMetric {
    readonly endpoint: string;
    readonly requests: number;
    readonly avgDuration: number;
    readonly errorRate: number;
}

/** Extended health response with optional uptime/timestamp */
export interface ExtendedHealthResponse extends HealthResponse {
    readonly uptime?: number;
    readonly timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class MetricsStore {
    private readonly metricsService = inject(MetricsService);
    private readonly swrCache = inject(SwrCacheService);

    private readonly metricsSwr: SwrEntry<ExtendedMetricsResponse>;
    private readonly healthSwr: SwrEntry<ExtendedHealthResponse>;

    /** Cached metrics data (may be stale) */
    readonly metrics: Signal<ExtendedMetricsResponse | undefined>;
    /** Cached health data (may be stale) */
    readonly health: Signal<ExtendedHealthResponse | undefined>;
    /** Whether metrics are being revalidated */
    readonly isMetricsRevalidating: Signal<boolean>;
    /** Whether health is being revalidated */
    readonly isHealthRevalidating: Signal<boolean>;
    /** Whether either resource is loading/revalidating */
    readonly isLoading: Signal<boolean>;
    /** Whether cached data is stale */
    readonly isStale: Signal<boolean>;

    constructor() {
        this.metricsSwr = this.swrCache.get<ExtendedMetricsResponse>(
            'metrics',
            () => firstValueFrom(this.metricsService.getMetrics()) as Promise<ExtendedMetricsResponse>,
            30_000,
        );

        this.healthSwr = this.swrCache.get<ExtendedHealthResponse>(
            'health',
            () => firstValueFrom(this.metricsService.getHealth()) as Promise<ExtendedHealthResponse>,
            30_000,
        );

        this.metrics = this.metricsSwr.data;
        this.health = this.healthSwr.data;
        this.isMetricsRevalidating = this.metricsSwr.isRevalidating;
        this.isHealthRevalidating = this.healthSwr.isRevalidating;
        this.isLoading = computed(() => this.metricsSwr.isRevalidating() || this.healthSwr.isRevalidating());
        this.isStale = computed(() => this.metricsSwr.isStale() || this.healthSwr.isStale());
    }

    /** Force refresh both metrics and health */
    refresh(): void {
        this.metricsSwr.revalidate();
        this.healthSwr.revalidate();
    }

    /** Force refresh metrics only */
    refreshMetrics(): void {
        this.metricsSwr.revalidate();
    }

    /** Force refresh health only */
    refreshHealth(): void {
        this.healthSwr.revalidate();
    }
}
