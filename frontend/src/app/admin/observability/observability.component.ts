/**
 * ObservabilityComponent — Observability dashboard.
 *
 * Three-tab layout: Metrics, Logs, Health. Each tab loads data from
 * admin endpoints and gracefully handles 404s when Analytics Engine
 * or health endpoints are not yet configured.
 */

import {
    Component, afterNextRender, inject, signal,
    ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

interface MetricsSummary {
    readonly totalRequests: number;
    readonly errorRate: number;
    readonly avgLatencyMs: number;
    readonly activeUsers: number;
}

interface LogEntry {
    readonly timestamp: string;
    readonly level: string;
    readonly message: string;
    readonly trace_id: string | null;
}

interface LogListResponse {
    readonly success: boolean;
    readonly items: LogEntry[];
    readonly total: number;
}

interface HealthCheck {
    readonly service: string;
    readonly status: 'healthy' | 'degraded' | 'down' | 'unknown';
    readonly latencyMs: number | null;
    readonly message: string | null;
}

interface HealthResponse {
    readonly success: boolean;
    readonly checks: HealthCheck[];
}

@Component({
    selector: 'app-admin-observability',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DecimalPipe,
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatSelectModule,
        MatTableModule,
        MatTabsModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">monitoring</mat-icon>
            <mat-card-title>Observability</mat-card-title>
            <mat-card-subtitle>Metrics, logs, and system health</mat-card-subtitle>
        </mat-card-header>
    </mat-card>

    <mat-card appearance="outlined">
        <mat-tab-group>
            <!-- Metrics Tab -->
            <mat-tab label="Metrics">
                <div class="tab-content">
                    @if (metricsLoading()) {
                        <div class="loading-container">
                            <mat-progress-spinner diameter="40" mode="indeterminate" />
                        </div>
                    } @else if (!metricsAvailable()) {
                        <div class="placeholder-state">
                            <mat-icon aria-hidden="true" class="placeholder-icon">analytics</mat-icon>
                            <p>Data available when Analytics Engine is configured</p>
                            <button mat-stroked-button (click)="loadMetrics()">
                                <mat-icon aria-hidden="true">refresh</mat-icon> Retry
                            </button>
                        </div>
                    } @else {
                        <div class="metrics-grid">
                            <mat-card appearance="outlined" class="metric-card">
                                <mat-card-content>
                                    <mat-icon aria-hidden="true" class="metric-icon">trending_up</mat-icon>
                                    <div class="metric-value">{{ metrics()!.totalRequests | number }}</div>
                                    <div class="metric-label">Total Requests</div>
                                </mat-card-content>
                            </mat-card>
                            <mat-card appearance="outlined" class="metric-card">
                                <mat-card-content>
                                    <mat-icon aria-hidden="true" class="metric-icon metric-error">error_outline</mat-icon>
                                    <div class="metric-value">{{ metrics()!.errorRate | number:'1.1-1' }}%</div>
                                    <div class="metric-label">Error Rate</div>
                                </mat-card-content>
                            </mat-card>
                            <mat-card appearance="outlined" class="metric-card">
                                <mat-card-content>
                                    <mat-icon aria-hidden="true" class="metric-icon metric-latency">speed</mat-icon>
                                    <div class="metric-value">{{ metrics()!.avgLatencyMs | number:'1.0-0' }}ms</div>
                                    <div class="metric-label">Avg Latency</div>
                                </mat-card-content>
                            </mat-card>
                            <mat-card appearance="outlined" class="metric-card">
                                <mat-card-content>
                                    <mat-icon aria-hidden="true" class="metric-icon metric-users">people</mat-icon>
                                    <div class="metric-value">{{ metrics()!.activeUsers | number }}</div>
                                    <div class="metric-label">Active Users</div>
                                </mat-card-content>
                            </mat-card>
                        </div>
                    }
                </div>
            </mat-tab>

            <!-- Logs Tab -->
            <mat-tab label="Logs">
                <div class="tab-content">
                    <div class="log-toolbar">
                        <mat-form-field appearance="outline" class="filter-field-sm">
                            <mat-label>Level</mat-label>
                            <mat-select [(ngModel)]="logLevel" (ngModelChange)="applyLogFilter()">
                                <mat-option value="all">All</mat-option>
                                @for (l of logLevels; track l) {
                                    <mat-option [value]="l">{{ l }}</mat-option>
                                }
                            </mat-select>
                        </mat-form-field>
                        <button mat-stroked-button (click)="loadLogs()">
                            <mat-icon aria-hidden="true">refresh</mat-icon> Refresh
                        </button>
                    </div>

                    @if (logsLoading()) {
                        <div class="loading-container">
                            <mat-progress-spinner diameter="40" mode="indeterminate" />
                        </div>
                    } @else if (!logsAvailable()) {
                        <div class="placeholder-state">
                            <mat-icon aria-hidden="true" class="placeholder-icon">article</mat-icon>
                            <p>Data available when structured logging is configured</p>
                        </div>
                    } @else if (filteredLogs().length === 0) {
                        <p class="empty-state">No log entries match the current filter.</p>
                    } @else {
                        <table mat-table [dataSource]="filteredLogs()" class="logs-table">
                            <ng-container matColumnDef="timestamp">
                                <th mat-header-cell *matHeaderCellDef>Timestamp</th>
                                <td mat-cell *matCellDef="let row">
                                    <span class="log-ts">{{ row.timestamp }}</span>
                                </td>
                            </ng-container>

                            <ng-container matColumnDef="level">
                                <th mat-header-cell *matHeaderCellDef>Level</th>
                                <td mat-cell *matCellDef="let row">
                                    <span class="level-chip" [class]="'level-' + row.level">{{ row.level }}</span>
                                </td>
                            </ng-container>

                            <ng-container matColumnDef="message">
                                <th mat-header-cell *matHeaderCellDef>Message</th>
                                <td mat-cell *matCellDef="let row">
                                    <span class="log-msg">{{ row.message }}</span>
                                </td>
                            </ng-container>

                            <ng-container matColumnDef="trace_id">
                                <th mat-header-cell *matHeaderCellDef>Trace ID</th>
                                <td mat-cell *matCellDef="let row">
                                    <code class="trace-id">{{ row.trace_id || '—' }}</code>
                                </td>
                            </ng-container>

                            <tr mat-header-row *matHeaderRowDef="logColumns"></tr>
                            <tr mat-row *matRowDef="let row; columns: logColumns;"></tr>
                        </table>
                    }
                </div>
            </mat-tab>

            <!-- Health Tab -->
            <mat-tab label="Health">
                <div class="tab-content">
                    @if (healthLoading()) {
                        <div class="loading-container">
                            <mat-progress-spinner diameter="40" mode="indeterminate" />
                        </div>
                    } @else {
                        <div class="health-grid">
                            @for (check of healthChecks(); track check.service) {
                                <mat-card appearance="outlined" class="health-card">
                                    <mat-card-content>
                                        <div class="health-header">
                                            <span class="health-dot" [class]="'dot-' + check.status"></span>
                                            <span class="health-service">{{ check.service }}</span>
                                        </div>
                                        <div class="health-status" [class]="'hs-' + check.status">
                                            {{ check.status }}
                                        </div>
                                        @if (check.latencyMs !== null) {
                                            <div class="health-latency">{{ check.latencyMs }}ms</div>
                                        }
                                        @if (check.message) {
                                            <div class="health-msg">{{ check.message }}</div>
                                        }
                                    </mat-card-content>
                                </mat-card>
                            } @empty {
                                <div class="placeholder-state">
                                    <mat-icon aria-hidden="true" class="placeholder-icon">health_and_safety</mat-icon>
                                    <p>Health checks not yet configured</p>
                                    <button mat-stroked-button (click)="loadHealth()">
                                        <mat-icon aria-hidden="true">refresh</mat-icon> Retry
                                    </button>
                                </div>
                            }
                        </div>
                    }
                </div>
            </mat-tab>
        </mat-tab-group>
    </mat-card>
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .tab-content { padding: 16px; }
    .loading-container { display: flex; justify-content: center; padding: 32px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 32px; }
    .placeholder-state {
        display: flex; flex-direction: column; align-items: center; gap: 12px;
        padding: 48px 16px; color: var(--mat-sys-on-surface-variant);
    }
    .placeholder-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.4; }

    /* Metrics */
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .metric-card { text-align: center; }
    .metric-icon { font-size: 32px; width: 32px; height: 32px; color: var(--mat-sys-primary); margin-bottom: 4px; }
    .metric-error { color: #c62828; }
    .metric-latency { color: #ef6c00; }
    .metric-users { color: #2e7d32; }
    .metric-value { font-size: 28px; font-weight: 700; color: var(--mat-sys-on-surface); }
    .metric-label { font-size: 12px; color: var(--mat-sys-on-surface-variant); text-transform: uppercase; letter-spacing: 0.06em; }

    /* Logs */
    .log-toolbar { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
    .filter-field-sm { min-width: 140px; }
    .logs-table { width: 100%; }
    .log-ts { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--mat-sys-on-surface-variant); white-space: nowrap; }
    .level-chip {
        display: inline-block; padding: 2px 8px; border-radius: 10px;
        font-size: 11px; font-weight: 600; text-transform: uppercase;
    }
    .level-debug { background: #e0e0e0; color: #616161; }
    .level-info { background: #e3f2fd; color: #1565c0; }
    .level-warn { background: #fff3e0; color: #ef6c00; }
    .level-error { background: #fce4ec; color: #c62828; }
    .level-fatal { background: #c62828; color: #fff; }
    .log-msg { font-size: 13px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .trace-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; }

    /* Health */
    .health-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .health-card { text-align: center; }
    .health-header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }
    .health-dot {
        width: 12px; height: 12px; border-radius: 50%; display: inline-block;
    }
    .dot-healthy { background: #4caf50; }
    .dot-degraded { background: #ff9800; }
    .dot-down { background: #f44336; }
    .dot-unknown { background: #9e9e9e; }
    .health-service { font-size: 14px; font-weight: 600; }
    .health-status { font-size: 13px; text-transform: capitalize; margin-bottom: 4px; }
    .hs-healthy { color: #2e7d32; }
    .hs-degraded { color: #ef6c00; }
    .hs-down { color: #c62828; }
    .hs-unknown { color: #757575; }
    .health-latency { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .health-msg { font-size: 12px; color: var(--mat-sys-on-surface-variant); margin-top: 4px; }
    `],
})
export class ObservabilityComponent {
    private readonly http = inject(HttpClient);

    // Metrics state
    readonly metrics = signal<MetricsSummary | null>(null);
    readonly metricsLoading = signal(false);
    readonly metricsAvailable = signal(false);

    // Logs state
    readonly allLogs = signal<LogEntry[]>([]);
    readonly filteredLogs = signal<LogEntry[]>([]);
    readonly logsLoading = signal(false);
    readonly logsAvailable = signal(false);
    readonly logColumns = ['timestamp', 'level', 'message', 'trace_id'];
    readonly logLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
    logLevel = 'all';

    // Health state
    readonly healthChecks = signal<HealthCheck[]>([]);
    readonly healthLoading = signal(false);

    private readonly _init = afterNextRender(() => {
        this.loadMetrics();
        this.loadLogs();
        this.loadHealth();
    });

    loadMetrics(): void {
        this.metricsLoading.set(true);
        this.http.get<{ success: boolean } & MetricsSummary>('/admin/observability/metrics').subscribe({
            next: (res) => {
                this.metrics.set(res);
                this.metricsAvailable.set(true);
                this.metricsLoading.set(false);
            },
            error: () => {
                this.metricsAvailable.set(false);
                this.metricsLoading.set(false);
            },
        });
    }

    loadLogs(): void {
        this.logsLoading.set(true);
        this.http.get<LogListResponse>('/admin/observability/logs').subscribe({
            next: (res) => {
                this.allLogs.set(res.items ?? []);
                this.logsAvailable.set(true);
                this.applyLogFilter();
                this.logsLoading.set(false);
            },
            error: () => {
                this.allLogs.set([]);
                this.filteredLogs.set([]);
                this.logsAvailable.set(false);
                this.logsLoading.set(false);
            },
        });
    }

    loadHealth(): void {
        this.healthLoading.set(true);
        this.http.get<HealthResponse>('/health').subscribe({
            next: (res) => {
                this.healthChecks.set(res.checks ?? []);
                this.healthLoading.set(false);
            },
            error: () => {
                // Fallback: show default services as unknown
                this.healthChecks.set([
                    { service: 'Worker', status: 'unknown', latencyMs: null, message: 'Health endpoint not configured' },
                    { service: 'D1 Database', status: 'unknown', latencyMs: null, message: 'Health endpoint not configured' },
                    { service: 'KV Store', status: 'unknown', latencyMs: null, message: 'Health endpoint not configured' },
                    { service: 'R2 Storage', status: 'unknown', latencyMs: null, message: 'Health endpoint not configured' },
                ]);
                this.healthLoading.set(false);
            },
        });
    }

    applyLogFilter(): void {
        const logs = this.allLogs();
        if (this.logLevel === 'all') {
            this.filteredLogs.set(logs);
        } else {
            this.filteredLogs.set(logs.filter(l => l.level === this.logLevel));
        }
    }
}
