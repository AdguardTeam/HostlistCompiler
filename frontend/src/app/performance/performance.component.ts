/**
 * Performance Metrics Component
 *
 * Displays real compilation performance data from /api/metrics.
 * Uses rxResource() for signal-native async data fetching and
 * afterRenderEffect() for DOM measurements.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';

/** Metrics response shape from /api/metrics */
interface MetricsResponse {
    readonly totalRequests: number;
    readonly averageDuration: number;
    readonly p95Duration: number;
    readonly p99Duration: number;
    readonly successRate: number;
    readonly cacheHitRate: number;
    readonly endpoints: EndpointMetric[];
}

interface EndpointMetric {
    readonly endpoint: string;
    readonly requests: number;
    readonly avgDuration: number;
    readonly errorRate: number;
}

/** Health response shape from /api/health */
interface HealthResponse {
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly uptime: number;
    readonly version: string;
    readonly timestamp: string;
}

@Component({
    selector: 'app-performance',
    standalone: true,
    imports: [
        DecimalPipe,
        TitleCasePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatDividerModule,
        MatTableModule,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">Performance</h1>
        <p class="subtitle mat-body-1">
            Real-time compilation performance metrics from the API
        </p>

        <!-- Health Status -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar
                    [style.color]="healthStatusColor()">
                    {{ healthStatusIcon() }}
                </mat-icon>
                <mat-card-title>System Health</mat-card-title>
                <mat-card-subtitle>
                    @if (healthResource.isLoading()) {
                        Checking…
                    } @else if (healthResource.value(); as h) {
                        {{ h.status | titlecase }} — v{{ h.version }}
                    } @else {
                        Unable to reach API
                    }
                </mat-card-subtitle>
            </mat-card-header>
            @if (healthResource.value(); as h) {
                <mat-card-content>
                    <mat-chip-set>
                        <mat-chip highlighted [color]="h.status === 'healthy' ? 'primary' : 'warn'">
                            {{ h.status | titlecase }}
                        </mat-chip>
                        <mat-chip>Uptime: {{ formatUptime(h.uptime) }}</mat-chip>
                        <mat-chip>v{{ h.version }}</mat-chip>
                    </mat-chip-set>
                </mat-card-content>
            }
        </mat-card>

        <!-- Key Metrics -->
        @if (metricsResource.isLoading()) {
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-content class="loading-content">
                    <mat-spinner diameter="32"></mat-spinner>
                    <span class="mat-body-2">Loading metrics…</span>
                </mat-card-content>
            </mat-card>
        } @else if (metricsResource.value(); as m) {
            <div class="metrics-grid">
                <mat-card appearance="outlined">
                    <mat-card-content class="metric-card">
                        <mat-icon class="metric-icon" style="color: var(--mat-sys-primary)">api</mat-icon>
                        <div class="metric-value">{{ m.totalRequests | number }}</div>
                        <div class="metric-label mat-caption">Total Requests</div>
                    </mat-card-content>
                </mat-card>
                <mat-card appearance="outlined">
                    <mat-card-content class="metric-card">
                        <mat-icon class="metric-icon" style="color: var(--mat-sys-tertiary)">timer</mat-icon>
                        <div class="metric-value">{{ m.averageDuration | number:'1.0-0' }} ms</div>
                        <div class="metric-label mat-caption">Avg Duration</div>
                    </mat-card-content>
                </mat-card>
                <mat-card appearance="outlined">
                    <mat-card-content class="metric-card">
                        <mat-icon class="metric-icon" style="color: var(--mat-sys-secondary)">speed</mat-icon>
                        <div class="metric-value">{{ m.p95Duration | number:'1.0-0' }} ms</div>
                        <div class="metric-label mat-caption">p95 Latency</div>
                    </mat-card-content>
                </mat-card>
                <mat-card appearance="outlined">
                    <mat-card-content class="metric-card">
                        <mat-icon class="metric-icon" style="color: var(--mat-sys-error)">check_circle</mat-icon>
                        <div class="metric-value">{{ m.successRate }}%</div>
                        <div class="metric-label mat-caption">Success Rate</div>
                    </mat-card-content>
                </mat-card>
                <mat-card appearance="outlined">
                    <mat-card-content class="metric-card">
                        <mat-icon class="metric-icon" style="color: var(--mat-sys-primary)">cached</mat-icon>
                        <div class="metric-value">{{ m.cacheHitRate }}%</div>
                        <div class="metric-label mat-caption">Cache Hit Rate</div>
                    </mat-card-content>
                </mat-card>
                <mat-card appearance="outlined">
                    <mat-card-content class="metric-card">
                        <mat-icon class="metric-icon" style="color: var(--mat-sys-tertiary)">warning</mat-icon>
                        <div class="metric-value">{{ m.p99Duration | number:'1.0-0' }} ms</div>
                        <div class="metric-label mat-caption">p99 Latency</div>
                    </mat-card-content>
                </mat-card>
            </div>

            <!-- Endpoint Breakdown -->
            @if (m.endpoints.length > 0) {
                <mat-card appearance="outlined" class="mb-2 mt-2">
                    <mat-card-header>
                        <mat-icon mat-card-avatar>table_chart</mat-icon>
                        <mat-card-title>Endpoint Breakdown</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                        <table mat-table [dataSource]="m.endpoints" class="endpoint-table">
                            <ng-container matColumnDef="endpoint">
                                <th mat-header-cell *matHeaderCellDef>Endpoint</th>
                                <td mat-cell *matCellDef="let row">{{ row.endpoint }}</td>
                            </ng-container>
                            <ng-container matColumnDef="requests">
                                <th mat-header-cell *matHeaderCellDef>Requests</th>
                                <td mat-cell *matCellDef="let row">{{ row.requests | number }}</td>
                            </ng-container>
                            <ng-container matColumnDef="avgDuration">
                                <th mat-header-cell *matHeaderCellDef>Avg (ms)</th>
                                <td mat-cell *matCellDef="let row">{{ row.avgDuration | number:'1.0-0' }}</td>
                            </ng-container>
                            <ng-container matColumnDef="errorRate">
                                <th mat-header-cell *matHeaderCellDef>Error Rate</th>
                                <td mat-cell *matCellDef="let row">{{ row.errorRate }}%</td>
                            </ng-container>
                            <tr mat-header-row *matHeaderRowDef="endpointColumns"></tr>
                            <tr mat-row *matRowDef="let row; columns: endpointColumns;"></tr>
                        </table>
                    </mat-card-content>
                </mat-card>
            }
        } @else if (metricsResource.status() === 'error') {
            <mat-card appearance="outlined" class="error-card mb-2">
                <mat-card-content>
                    <div class="error-content">
                        <mat-icon color="warn">error</mat-icon>
                        <span>Failed to load metrics. The API may be unavailable.</span>
                    </div>
                </mat-card-content>
                <mat-card-actions>
                    <button mat-button (click)="refreshMetrics()">
                        <mat-icon>refresh</mat-icon> Retry
                    </button>
                </mat-card-actions>
            </mat-card>
        }

        <!-- Refresh button -->
        <div class="actions mt-2">
            <button mat-stroked-button (click)="refreshMetrics()" [disabled]="metricsResource.isLoading()">
                <mat-icon>refresh</mat-icon> Refresh Metrics
            </button>
        </div>
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
    }
    .metric-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px 16px;
        text-align: center;
    }
    .metric-icon { font-size: 32px; width: 32px; height: 32px; margin-bottom: 8px; }
    .metric-value { font-size: 1.5rem; font-weight: 700; color: var(--mat-sys-on-surface); }
    .metric-label { color: var(--mat-sys-on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .endpoint-table { width: 100%; }
    .error-card { border-color: var(--mat-sys-error); }
    .error-content { display: flex; align-items: center; gap: 8px; color: var(--mat-sys-error); }
    .loading-content { display: flex; align-items: center; gap: 16px; padding: 24px; }
    .actions { display: flex; gap: 12px; }
  `],
})
export class PerformanceComponent {
    readonly endpointColumns = ['endpoint', 'requests', 'avgDuration', 'errorRate'];

    private readonly http = inject(HttpClient);
    private readonly apiBaseUrl = inject(API_BASE_URL);

    /** Signal to trigger refresh — when updated, rxResource re-fetches */
    private readonly refreshTrigger = signal(0);

    readonly metricsResource = rxResource<MetricsResponse, number>({
        params: () => this.refreshTrigger(),
        stream: () => this.http.get<MetricsResponse>(`${this.apiBaseUrl}/metrics`).pipe(
            catchError(() => of({
                totalRequests: 0,
                averageDuration: 0,
                p95Duration: 0,
                p99Duration: 0,
                successRate: 0,
                cacheHitRate: 0,
                endpoints: [],
            } as MetricsResponse)),
        ),
    });

    readonly healthResource = rxResource<HealthResponse, number>({
        params: () => this.refreshTrigger(),
        stream: () => this.http.get<HealthResponse>(`${this.apiBaseUrl}/health`).pipe(
            catchError(() => of({
                status: 'unhealthy' as const,
                uptime: 0,
                version: 'unknown',
                timestamp: new Date().toISOString(),
            })),
        ),
    });

    readonly healthStatusColor = computed(() => {
        const health = this.healthResource.value();
        if (!health) return 'var(--mat-sys-on-surface-variant)';
        switch (health.status) {
            case 'healthy': return 'var(--mat-sys-primary)';
            case 'degraded': return 'var(--mat-sys-error)';
            case 'unhealthy': return 'var(--mat-sys-error)';
        }
    });

    readonly healthStatusIcon = computed(() => {
        const health = this.healthResource.value();
        if (!health) return 'help_outline';
        switch (health.status) {
            case 'healthy': return 'check_circle';
            case 'degraded': return 'warning';
            case 'unhealthy': return 'error';
        }
    });

    refreshMetrics(): void {
        this.refreshTrigger.update(v => v + 1);
    }

    formatUptime(seconds: number): string {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
        return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
    }
}
